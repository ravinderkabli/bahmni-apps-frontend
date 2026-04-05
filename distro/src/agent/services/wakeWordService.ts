import { SupportedLanguage } from '../types/agentTypes';

/**
 * Wake word patterns — STT often mishears "Hey Bahmni" so we match loosely.
 * We check if the transcript contains "bahmni" or close phonetic variants.
 */
const WAKE_WORD_PATTERNS = [
  /\bbahmni\b/i,
  /\bbahm\b/i,
  /\bbahm\s*ni\b/i,
  /\bbam\s*ni\b/i,
  /\bbami\b/i,
  /\bbhumi\b/i,    // common STT variant
  /\bbahumi\b/i,
  /\bba[hm]+ni\b/i,
];

export const detectsWakeWord = (transcript: string): boolean => {
  const lower = transcript.toLowerCase();
  return WAKE_WORD_PATTERNS.some((p) => p.test(lower));
};

/**
 * Strip the wake phrase ("hey bahmni" and variants) from the beginning of a
 * transcript and return only the command portion that follows.
 *
 * Example:
 *   "hey bahmni add BP 140/90 for Ravi"  →  "add BP 140/90 for Ravi"
 *   "bahmni search patient Sita"          →  "search patient Sita"
 */
export const extractCommandPortion = (transcript: string): string => {
  // Match an optional "hey" followed by any of the wake word variants,
  // then consume any trailing punctuation / whitespace.
  const stripped = transcript
    .replace(/^(?:hey\s+)?(?:bahmni|bahm(?:\s*ni)?|bam\s*ni|bami|bhumi|bahumi|ba[hm]+ni)\b[,.\s]*/i, '')
    .trim();
  return stripped;
};

/** onWakeWord now receives the command portion already extracted from the transcript */
export type WakeWordCallback = (commandPortion: string) => void;
export type WakeWordErrorCallback = (error: string) => void;

export interface WakeWordService {
  start: () => void;
  stop: () => void;
  /** Immediately abort (faster mic release than stop()) */
  abort: () => void;
  setLanguage: (lang: SupportedLanguage) => void;
  isActive: () => boolean;
}

/**
 * Lightweight always-on SpeechRecognition instance that listens for the wake word.
 * Uses short recognition windows (no accumulation) to stay responsive.
 * Calls onWakeWord() when "Hey Bahmni" (or variant) is detected.
 */
export const createWakeWordService = (
  onWakeWord: WakeWordCallback,
  onError: WakeWordErrorCallback,
): WakeWordService => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  let recognition: SpeechRecognition | null = null;
  let active = false;
  let currentLang: SupportedLanguage = 'en-IN';
  let triggered = false;

  // Forward-declare so onend can reference it
  // eslint-disable-next-line prefer-const
  let build: () => SpeechRecognition;

  build = (): SpeechRecognition => {
    const r = new SpeechRecognition();
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 3;
    r.lang = currentLang;

    r.onresult = (event: SpeechRecognitionEvent) => {
      if (triggered) return;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        for (let j = 0; j < result.length; j++) {
          if (detectsWakeWord(result[j].transcript)) {
            triggered = true;
            onWakeWord(extractCommandPortion(result[j].transcript));
            return;
          }
        }
      }
    };

    r.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      onError(event.error);
    };

    r.onend = () => {
      // Build a FRESH instance on every restart to avoid Chrome's
      // "InvalidStateError" when restarting an errored recognition object.
      if (active && !triggered) {
        recognition = build();
        try {
          recognition.start();
        } catch {
          setTimeout(() => {
            if (active && !triggered) {
              recognition = build();
              try { recognition.start(); } catch { /* give up */ }
            }
          }, 150);
        }
      }
    };

    return r;
  };

  const stopRecognition = (useAbort: boolean) => {
    active = false;
    triggered = false;
    if (recognition) {
      try {
        if (useAbort) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (recognition as any).abort();
        } else {
          recognition.stop();
        }
      } catch { /* ignore */ }
      recognition = null;
    }
  };

  return {
    start: () => {
      if (active) return;
      active = true;
      triggered = false;
      recognition = build();
      try {
        recognition.start();
      } catch {
        onError('WAKE_WORD_START_FAILED');
      }
    },

    stop: () => stopRecognition(false),

    /** abort() releases the mic faster than stop() — use when handing off to main STT */
    abort: () => stopRecognition(true),

    setLanguage: (lang: SupportedLanguage) => {
      currentLang = lang;
      if (active && recognition) {
        try { recognition.stop(); } catch { /* ignore */ }
        recognition = build();
        try { recognition.start(); } catch { /* ignore */ }
      }
    },

    isActive: () => active,
  };
};
