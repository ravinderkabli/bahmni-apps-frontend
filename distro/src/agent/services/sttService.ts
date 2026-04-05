import { STT_SILENCE_DEBOUNCE_MS } from '../constants/agentConstants';
import { SupportedLanguage } from '../types/agentTypes';

export interface SpeechService {
  start: () => void;
  stop: () => void;
  /** Fire onFinal immediately with whatever was captured, then stop */
  stopAndSend: () => void;
  /** User confirmed Submit — fire onFinal with captured text */
  confirmSend: () => void;
  /** User chose Continue — resume mic, keep accumulated text */
  continueListening: () => void;
  setLanguage: (lang: SupportedLanguage) => void;
  isListening: () => boolean;
}

export const isSTTSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
};

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log('[STT]', ...args);
};

type OnInterimCallback = (finalText: string, interimText: string) => void;
type OnFinalCallback = (transcript: string) => void;
type OnSilenceCallback = (transcript: string) => void;
type OnErrorCallback = (error: string) => void;

export const createSpeechService = (
  onInterim: OnInterimCallback,
  onFinal: OnFinalCallback,
  onSilence: OnSilenceCallback,
  onError: OnErrorCallback,
  seedText?: string,
): SpeechService => {
  // const SpeechRecognitionCtor =
  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   (window as any).SpeechRecognition ??
  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   (window as any).webkitSpeechRecognition;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recognition: any = null;
  let listening = false;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let currentLang: SupportedLanguage = 'en-IN';

  let accumulatedFinal = seedText?.trim() ?? '';
  let lastInterim = '';
  let finalFired = false;
  let silenceFired = false;
  let sendPending = false;
  let emptySpeechCount = 0;
  const MAX_EMPTY_NO_SPEECH = 2;

  const clearSilenceTimer = () => {
    if (silenceTimer !== null) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  };

  const capturedText = () => (accumulatedFinal || lastInterim).trim();

  /**
   * Stop recognition but keep the JS reference alive so Chrome can still
   * fire onend. Medispeak pattern: never null the ref before onend fires.
   */
  const callStop = () => {
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      log('recognition.stop() called');
    }
  };

  const clearRecognition = () => {
    recognition = null;
  };

  const fireSilence = () => {
    if (finalFired || silenceFired) {
      log(
        'fireSilence: skipped (finalFired=%s silenceFired=%s)',
        finalFired,
        silenceFired,
      );
      return;
    }
    const text = capturedText();
    if (!text) {
      log('fireSilence: no text, skipping');
      return;
    }
    log('fireSilence:', JSON.stringify(text));
    silenceFired = true;
    listening = false;
    callStop();
    onSilence(text);
  };

  const fireFinal = () => {
    if (finalFired) {
      log('fireFinal: already fired, skipping');
      return;
    }
    const text = capturedText();
    log('fireFinal:', JSON.stringify(text));
    finalFired = true;
    onFinal(text);
  };

  const resetSilenceTimer = () => {
    clearSilenceTimer();
    silenceTimer = setTimeout(() => {
      log('silence timer expired (%dms)', STT_SILENCE_DEBOUNCE_MS);
      fireSilence();
    }, STT_SILENCE_DEBOUNCE_MS);
  };

  const buildRecognition = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SpeechRecognition();
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;
    // currentLang = 
    // r.lang = currentLang;
    r.lang = "en-US";
    log('buildRecognition lang=%s', r.lang);

    r.onstart = () => {
      log('recognition.onstart');
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (event: any) => {
      log(
        'onresult resultIndex=%d results.length=%d',
        event.resultIndex,
        event.results.length,
      );
      let interimText = '';
      let newFinalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        log(
          '  result[%d] isFinal=%s transcript=%s',
          i,
          result.isFinal,
          JSON.stringify(result[0].transcript),
        );
        if (result.isFinal) {
          newFinalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (newFinalText) {
        accumulatedFinal += ' ' + newFinalText;
        accumulatedFinal = accumulatedFinal.trim();
        log('accumulated:', JSON.stringify(accumulatedFinal));
      }
      if (interimText) {
        lastInterim = (accumulatedFinal + ' ' + interimText).trim();
      }

      const hasSomething = accumulatedFinal || interimText;
      if (hasSomething) {
        emptySpeechCount = 0;
        onInterim(accumulatedFinal.trim(), interimText.trim());
        resetSilenceTimer();
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (event: any) => {
      log('onerror: %s', event.error);
      if (event.error === 'no-speech') {
        const text = capturedText();
        if (text) {
          fireSilence();
        } else {
          emptySpeechCount += 1;
          if (emptySpeechCount >= MAX_EMPTY_NO_SPEECH) {
            log('max empty no-speech → onError');
            onError('no-speech-timeout');
          }
        }
        return;
      }
      if (event.error === 'aborted') {
        log('onerror: aborted (ignored)');
        return;
      }
      onError(event.error);
    };

    r.onend = () => {
      log(
        'onend listening=%s finalFired=%s silenceFired=%s sendPending=%s captured=%s',
        listening,
        finalFired,
        silenceFired,
        sendPending,
        JSON.stringify(capturedText()),
      );

      // User tapped mic — fire final with whatever Chrome flushed into onresult
      if (sendPending) {
        sendPending = false;
        clearRecognition();
        fireFinal();
        return;
      }

      // Restart if we're still supposed to be listening
      if (listening && !finalFired && !silenceFired) {
        log('onend → restarting recognition');
        clearRecognition();
        recognition = buildRecognition();
        try {
          recognition.start();
        } catch {
          setTimeout(() => {
            if (listening && !finalFired && !silenceFired) {
              clearRecognition();
              recognition = buildRecognition();
              try {
                recognition.start();
              } catch {
                log('onend retry failed');
              }
            }
          }, 150);
        }
        return;
      }

      clearRecognition();
      log('onend → done');
    };

    return r;
  };

  return {
    start: () => {
      if (listening) {
        log('start: already listening, ignoring');
        return;
      }
      log('start seed=%s', JSON.stringify(seedText));
      listening = true;
      finalFired = false;
      silenceFired = false;
      sendPending = false;
      emptySpeechCount = 0;
      accumulatedFinal = seedText?.trim() ?? '';
      lastInterim = '';
      recognition = buildRecognition();
      try {
        recognition.start();
        if (accumulatedFinal) {
          onInterim(accumulatedFinal, '');
          resetSilenceTimer();
        }
      } catch {
        log('start failed');
        onError('STT_START_FAILED');
      }
    },

    stop: () => {
      log('stop()');
      listening = false;
      sendPending = false;
      clearSilenceTimer();
      callStop();
      clearRecognition();
      accumulatedFinal = '';
      lastInterim = '';
      finalFired = false;
      silenceFired = false;
      emptySpeechCount = 0;
    },

    stopAndSend: () => {
      log('stopAndSend() captured=%s', JSON.stringify(capturedText()));
      clearSilenceTimer();
      listening = false;
      sendPending = true;
      // Keep recognition reference alive so Chrome can fire onend.
      // onend sees sendPending=true and calls fireFinal() there.
      callStop();

      // Fallback: if onend never fires, fire final after 500ms
      setTimeout(() => {
        if (sendPending) {
          log(
            'stopAndSend fallback (onend did not fire) captured=%s',
            JSON.stringify(capturedText()),
          );
          sendPending = false;
          clearRecognition();
          fireFinal();
        }
      }, 500);
    },

    confirmSend: () => {
      log('confirmSend() captured=%s', JSON.stringify(capturedText()));
      clearSilenceTimer();
      fireFinal();
    },

    continueListening: () => {
      if (finalFired) {
        log('continueListening: finalFired, ignoring');
        return;
      }
      log('continueListening()');
      clearSilenceTimer();
      silenceFired = false;
      emptySpeechCount = 0;
      listening = true;
      clearRecognition();
      recognition = buildRecognition();
      try {
        recognition.start();
      } catch {
        log('continueListening start failed');
        onError('STT_RESTART_FAILED');
      }
    },

    setLanguage: (lang: SupportedLanguage) => {
      log('setLanguage: %s', lang);
      currentLang = lang;
      if (listening && recognition) {
        callStop();
        clearRecognition();
        recognition = buildRecognition();
        try {
          recognition.start();
        } catch {
          onError('STT_RESTART_FAILED');
        }
      }
    },

    isListening: () => listening,
  };
};
