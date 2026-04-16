import { WHISPER_SERVER_URL } from '../constants/agentConstants';
import { SupportedLanguage } from '../types/agentTypes';

export interface SpeechService {
  start: () => void;
  stop: () => void;
  stopAndSend: () => void;
  confirmSend: () => void;
  continueListening: () => void;
  setLanguage: (lang: SupportedLanguage) => void;
  isListening: () => boolean;
}

export const isSTTSupported = (): boolean => {
  if (typeof window === 'undefined') return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const hasAudioContext = !!(w.AudioContext ?? w.webkitAudioContext);
  return hasAudioContext && !!navigator.mediaDevices?.getUserMedia;
};

// eslint-disable-next-line no-console
const log = (...args: unknown[]) => console.log('[STT]', ...args);

type OnInterimCallback = (finalText: string, interimText: string) => void;
type OnFinalCallback = (transcript: string) => void;
type OnSilenceCallback = (transcript: string) => void;
type OnErrorCallback = (error: string) => void;

/** Sample rate sent to Whisper — 16 kHz is optimal for speech models */
const SAMPLE_RATE = 16000;

/** How often accumulated audio is sent to Whisper for live transcription */
const CHUNK_INTERVAL_MS = 3000;

/** ScriptProcessorNode buffer size (must be power of 2) */
const PROCESSOR_BUFFER_SIZE = 4096;

// ─── WAV encoding ────────────────────────────────────────────────────────────

const writeString = (view: DataView, offset: number, str: string) => {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
};

const encodeWav = (samples: Float32Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

const mergeBuffers = (chunks: Float32Array[]): Float32Array => {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
};

// ─── Speech service ───────────────────────────────────────────────────────────

/**
 * AudioContext-based speech service that captures raw PCM audio, encodes it
 * as WAV in the browser, and sends it to the local faster-whisper server.
 * No ffmpeg required — WAV is decoded natively by faster-whisper.
 *
 * Every CHUNK_INTERVAL_MS, the accumulated audio is flushed to Whisper and
 * the result appended to the live transcript bubble.
 */
export const createSpeechService = (
  onInterim: OnInterimCallback,
  onFinal: OnFinalCallback,
  _onSilence: OnSilenceCallback,
  onError: OnErrorCallback,
  onReady?: () => void,
  seedText?: string,
): SpeechService => {
  let stream: MediaStream | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let audioContext: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processor: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let source: any = null;
  let sampleChunks: Float32Array[] = [];
  let chunkTimerId: ReturnType<typeof setInterval> | null = null;
  let abortController: AbortController | null = null;

  let listening = false;
  let currentLang: SupportedLanguage = 'en-IN';
  let accumulatedText = seedText?.trim() ?? '';
  let isFlushingChunk = false; // prevents overlapping Whisper calls
  let captureSampleRate = SAMPLE_RATE; // updated once AudioContext is created
  // Resolves when getUserMedia + AudioContext setup is complete.
  // stopAndSend awaits this so it never flushes before audio capture starts.
  let captureReady: Promise<void> = Promise.resolve();

  const clearChunkTimer = () => {
    if (chunkTimerId !== null) {
      clearInterval(chunkTimerId);
      chunkTimerId = null;
    }
  };

  const teardown = () => {
    clearChunkTimer();
    try {
      source?.disconnect();
      processor?.disconnect();
    } catch {
      /* ignore */
    }

    audioContext?.close().catch(() => {
      /* ignore */
    });
    stream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    audioContext = null;
    processor = null;
    source = null;
    stream = null;
    sampleChunks = [];
  };

  const transcribeWav = async (wav: Blob): Promise<string> => {
    abortController = new AbortController();
    const formData = new FormData();
    formData.append('audio', wav, 'recording.wav');
    formData.append('language', currentLang);

    try {
      const response = await fetch(`${WHISPER_SERVER_URL}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`Whisper error ${response.status}: ${text}`);
      }

      const data = (await response.json()) as {
        text?: string;
        error?: string;
      };
      if (data.error) throw new Error(data.error);
      return (data.text ?? '').trim();
    } finally {
      abortController = null;
    }
  };

  /**
   * Drain current sampleChunks → encode WAV → send to Whisper → append result.
   * If `isFinal` is true, tears down audio and calls onFinal.
   */
  const flushAudio = async (isFinal: boolean) => {
    if (isFlushingChunk && !isFinal) return; // skip if already transcribing
    isFlushingChunk = true;

    const chunks = sampleChunks;
    sampleChunks = [];

    log(
      'flushAudio isFinal=%s samples=%d',
      isFinal,
      chunks.reduce((n, c) => n + c.length, 0),
    );

    if (chunks.length === 0) {
      isFlushingChunk = false;
      if (isFinal) {
        teardown();
        onFinal(accumulatedText);
      }
      return;
    }

    onInterim(accumulatedText, 'Transcribing…');

    const wav = encodeWav(mergeBuffers(chunks), captureSampleRate);

    let newText = '';
    try {
      newText = await transcribeWav(wav);
    } catch (err) {
      isFlushingChunk = false;
      if (err instanceof Error && err.name === 'AbortError') {
        log('fetch aborted');
        return;
      }
      log('transcribe error:', err);
      onError(err instanceof Error ? err.message : 'transcription-failed');
      return;
    }

    isFlushingChunk = false;

    if (newText) {
      accumulatedText = accumulatedText
        ? `${accumulatedText} ${newText}`
        : newText;
    }
    // eslint-disable-next-line no-console
    console.log(
      '[STT] 🎤 chunk transcript: %s | accumulated: %s',
      JSON.stringify(newText || '(empty — no speech detected)'),
      JSON.stringify(accumulatedText),
    );

    if (isFinal) {
      teardown();
      onFinal(accumulatedText);
    } else {
      onInterim(accumulatedText, 'Recording…');
    }
  };

  const startAudioCapture = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      log('getUserMedia error:', err);
      onError('microphone-access-denied');
      listening = false;
      onInterim('', '');
      return;
    }

    if (!listening) {
      stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      stream = null;
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
    // Use default sample rate — requesting 16000 is ignored by Chrome.
    // We capture at the native rate and encode the WAV with that rate;
    // Whisper resamples internally.
    audioContext = new AudioCtx();
    // AudioContext may be suspended when created after an await — resume it.
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    const nativeSampleRate: number = audioContext.sampleRate as number;
    captureSampleRate = nativeSampleRate;
    log(
      'AudioContext state=%s nativeSampleRate=%d',
      audioContext.state,
      nativeSampleRate,
    );

    source = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(
      PROCESSOR_BUFFER_SIZE,
      1, // input channels
      1, // output channels
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    processor.onaudioprocess = (e: any) => {
      if (!listening) return;
      sampleChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    log(
      'audio capture started nativeSampleRate=%d chunkInterval=%dms',
      nativeSampleRate,
      CHUNK_INTERVAL_MS,
    );

    onInterim(accumulatedText, 'Recording…');

    // Flush audio to Whisper every CHUNK_INTERVAL_MS
    chunkTimerId = setInterval(() => {
      log('chunk timer fired');
      void flushAudio(false);
    }, CHUNK_INTERVAL_MS);

    // Notify caller that capture is live — mic button can now show "stop" state
    onReady?.();
  };

  return {
    start: () => {
      if (listening) {
        log('start: already listening');
        return;
      }
      log('start');
      listening = true;
      accumulatedText = seedText?.trim() ?? '';
      onInterim(accumulatedText, 'Recording…');
      captureReady = startAudioCapture();
    },

    stop: () => {
      log('stop');
      listening = false;
      clearChunkTimer();
      abortController?.abort();
      abortController = null;
      teardown();
      accumulatedText = '';
      onInterim('', '');
    },

    stopAndSend: () => {
      log('stopAndSend accumulated=%s', JSON.stringify(accumulatedText));
      listening = false;
      clearChunkTimer();
      // Wait for audio capture to be ready before flushing — prevents
      // the race where stopAndSend fires before getUserMedia resolves.
      void captureReady.then(() => flushAudio(true));
    },

    confirmSend: () => {
      log('confirmSend accumulated=%s', JSON.stringify(accumulatedText));
      listening = false;
      clearChunkTimer();
      void captureReady.then(() => flushAudio(true));
    },

    continueListening: () => {
      log('continueListening');
      listening = true;
      if (!audioContext) {
        captureReady = startAudioCapture();
      } else {
        onInterim(accumulatedText, 'Recording…');
        chunkTimerId = setInterval(() => {
          log('chunk timer fired (resumed)');
          void flushAudio(false);
        }, CHUNK_INTERVAL_MS);
      }
    },

    setLanguage: (lang: SupportedLanguage) => {
      log('setLanguage: %s', lang);
      currentLang = lang;
    },

    isListening: () => listening,
  };
};
