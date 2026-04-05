import { createSpeechService, isSTTSupported } from '../sttService';

// ── Mock Web Speech API ──────────────────────────────────────────────────────

type SpeechRecognitionEventListener = (event: SpeechRecognitionEvent) => void;
type SpeechRecognitionErrorEventListener = (event: SpeechRecognitionErrorEvent) => void;

interface MockSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  start: jest.Mock;
  stop: jest.Mock;
  abort: jest.Mock;
  onresult: SpeechRecognitionEventListener | null;
  onerror: SpeechRecognitionErrorEventListener | null;
  onend: (() => void) | null;
}

const createMockRecognition = (): MockSpeechRecognition => ({
  continuous: false,
  interimResults: false,
  maxAlternatives: 1,
  lang: '',
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  onresult: null,
  onerror: null,
  onend: null,
});

/** Build a minimal SpeechRecognitionEvent-like object */
const makeSpeechEvent = (
  results: Array<{ transcript: string; isFinal: boolean }>,
): SpeechRecognitionEvent => {
  const resultList = results.map(({ transcript, isFinal }) => {
    const alternative = [{ transcript, confidence: 1 }];
    return Object.assign(alternative, { isFinal, length: 1, item: (i: number) => alternative[i] });
  });
  return {
    resultIndex: 0,
    results: Object.assign(resultList, {
      length: resultList.length,
      item: (i: number) => resultList[i],
    }),
  } as unknown as SpeechRecognitionEvent;
};

/** Build a no-speech error event */
const makeNoSpeechEvent = (): SpeechRecognitionErrorEvent =>
  ({ error: 'no-speech' } as SpeechRecognitionErrorEvent);

let mockInstance: MockSpeechRecognition;

beforeEach(() => {
  jest.useFakeTimers();

  mockInstance = createMockRecognition();
  const MockRecognition = jest.fn(() => mockInstance);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).webkitSpeechRecognition = MockRecognition;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).SpeechRecognition;
});

afterEach(() => {
  jest.useRealTimers();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).webkitSpeechRecognition;
});

// ── isSTTSupported ────────────────────────────────────────────────────────────

describe('isSTTSupported', () => {
  it('returns true when webkitSpeechRecognition is available', () => {
    expect(isSTTSupported()).toBe(true);
  });

  it('returns false when neither SpeechRecognition nor webkitSpeechRecognition is available', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).webkitSpeechRecognition;
    expect(isSTTSupported()).toBe(false);
  });
});

// ── Basic STT flow ────────────────────────────────────────────────────────────

describe('createSpeechService — basic flow', () => {
  it('calls onInterim with finalText and interimText separately', () => {
    const onInterim = jest.fn();
    const svc = createSpeechService(onInterim, jest.fn(), jest.fn(), jest.fn());
    svc.start();

    // Simulate an interim result
    mockInstance.onresult!(makeSpeechEvent([{ transcript: 'add fever', isFinal: false }]));

    expect(onInterim).toHaveBeenCalledWith('', 'add fever');
  });

  it('accumulates final text across multiple results', () => {
    const onInterim = jest.fn();
    const svc = createSpeechService(onInterim, jest.fn(), jest.fn(), jest.fn());
    svc.start();

    mockInstance.onresult!(makeSpeechEvent([{ transcript: 'add', isFinal: true }]));
    mockInstance.onresult!(makeSpeechEvent([{ transcript: 'fever', isFinal: true }]));

    const lastCall = onInterim.mock.calls[onInterim.mock.calls.length - 1];
    expect(lastCall[0]).toBe('add fever');  // finalText
    expect(lastCall[1]).toBe('');           // interimText
  });

  it('fires onSilence after STT_SILENCE_DEBOUNCE_MS of no speech', () => {
    const onSilence = jest.fn();
    const svc = createSpeechService(jest.fn(), jest.fn(), onSilence, jest.fn());
    svc.start();

    mockInstance.onresult!(makeSpeechEvent([{ transcript: 'add fever', isFinal: true }]));

    expect(onSilence).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1500);

    expect(onSilence).toHaveBeenCalledWith('add fever');
  });

  it('fires onFinal immediately when stopAndSend is called', () => {
    const onFinal = jest.fn();
    const svc = createSpeechService(jest.fn(), onFinal, jest.fn(), jest.fn());
    svc.start();

    mockInstance.onresult!(makeSpeechEvent([{ transcript: 'add fever', isFinal: true }]));
    svc.stopAndSend();

    expect(onFinal).toHaveBeenCalledWith('add fever');
  });

  it('fires onFinal when confirmSend is called after onSilence', () => {
    const onSilence = jest.fn();
    const onFinal = jest.fn();
    const svc = createSpeechService(jest.fn(), onFinal, onSilence, jest.fn());
    svc.start();

    mockInstance.onresult!(makeSpeechEvent([{ transcript: 'add fever', isFinal: true }]));
    jest.advanceTimersByTime(1500); // triggers onSilence

    svc.confirmSend();
    expect(onFinal).toHaveBeenCalledWith('add fever');
  });
});

// ── Bug fix: silence timer starts immediately with seed text ──────────────────

describe('createSpeechService — seed text (Bug fix #1)', () => {
  it('calls onInterim immediately with seed text when STT starts', () => {
    const onInterim = jest.fn();
    createSpeechService(onInterim, jest.fn(), jest.fn(), jest.fn(), 'add fever for Ramesh').start();

    // onInterim should have been called synchronously in start()
    expect(onInterim).toHaveBeenCalledWith('add fever for Ramesh', '');
  });

  it('fires onSilence after 1.5 s when seed text is present and no new speech comes', () => {
    const onSilence = jest.fn();
    createSpeechService(
      jest.fn(),
      jest.fn(),
      onSilence,
      jest.fn(),
      'add blood pressure 140 over 90',
    ).start();

    expect(onSilence).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1500);

    expect(onSilence).toHaveBeenCalledWith('add blood pressure 140 over 90');
  });

  it('resets the silence timer when new speech arrives after seed', () => {
    const onSilence = jest.fn();
    createSpeechService(
      jest.fn(),
      jest.fn(),
      onSilence,
      jest.fn(),
      'add fever',
    ).start();

    // Advance 800ms — timer should NOT have fired yet because new speech comes in
    jest.advanceTimersByTime(800);
    mockInstance.onresult!(makeSpeechEvent([{ transcript: 'for Ramesh', isFinal: true }]));

    // 1200ms after the last onresult — still not fired (1500 - 1200 remaining)
    jest.advanceTimersByTime(1200);
    expect(onSilence).not.toHaveBeenCalled();

    // Full 1500ms after the last onresult — should fire now
    jest.advanceTimersByTime(300);
    expect(onSilence).toHaveBeenCalledWith('add fever for Ramesh');
  });

  it('appends new speech to the seed text', () => {
    const onInterim = jest.fn();
    createSpeechService(
      onInterim,
      jest.fn(),
      jest.fn(),
      jest.fn(),
      'add fever',
    ).start();

    mockInstance.onresult!(makeSpeechEvent([{ transcript: 'for Ramesh', isFinal: true }]));

    const lastCall = onInterim.mock.calls[onInterim.mock.calls.length - 1];
    expect(lastCall[0]).toBe('add fever for Ramesh');
  });
});

// ── Bug fix: no-speech loop prevention ───────────────────────────────────────

describe('createSpeechService — no-speech loop prevention (Bug fix #2)', () => {
  it('does not call onError on the first no-speech event when no text captured', () => {
    const onError = jest.fn();
    const svc = createSpeechService(jest.fn(), jest.fn(), jest.fn(), onError);
    svc.start();

    // First no-speech with no captured text
    mockInstance.onerror!(makeNoSpeechEvent());

    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onError("no-speech-timeout") after MAX_EMPTY_NO_SPEECH consecutive empty no-speech events', () => {
    const onError = jest.fn();
    const svc = createSpeechService(jest.fn(), jest.fn(), jest.fn(), onError);
    svc.start();

    // Two consecutive no-speech events with no captured text
    mockInstance.onerror!(makeNoSpeechEvent());
    mockInstance.onerror!(makeNoSpeechEvent());

    expect(onError).toHaveBeenCalledWith('no-speech-timeout');
  });

  it('resets the no-speech counter when speech is received', () => {
    const onError = jest.fn();
    const svc = createSpeechService(jest.fn(), jest.fn(), jest.fn(), onError);
    svc.start();

    // One no-speech event (counter = 1)
    mockInstance.onerror!(makeNoSpeechEvent());
    expect(onError).not.toHaveBeenCalled();

    // Speech received — counter resets to 0
    mockInstance.onresult!(makeSpeechEvent([{ transcript: 'add fever', isFinal: true }]));

    // Another no-speech event — counter is back to 1, not 2, so no timeout
    mockInstance.onerror!(makeNoSpeechEvent());
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onSilence (not onError) when no-speech fires and there IS captured text', () => {
    const onSilence = jest.fn();
    const onError = jest.fn();
    const svc = createSpeechService(jest.fn(), jest.fn(), onSilence, onError);
    svc.start();

    mockInstance.onresult!(makeSpeechEvent([{ transcript: 'add fever', isFinal: true }]));
    mockInstance.onerror!(makeNoSpeechEvent());

    expect(onSilence).toHaveBeenCalledWith('add fever');
    expect(onError).not.toHaveBeenCalled();
  });
});

// ── stop / continueListening ──────────────────────────────────────────────────

describe('createSpeechService — lifecycle', () => {
  it('stop() clears the silence timer', () => {
    const onSilence = jest.fn();
    const svc = createSpeechService(jest.fn(), jest.fn(), onSilence, jest.fn());
    svc.start();

    mockInstance.onresult!(makeSpeechEvent([{ transcript: 'add fever', isFinal: true }]));
    svc.stop();

    jest.advanceTimersByTime(2000);
    expect(onSilence).not.toHaveBeenCalled();
  });

  it('continueListening() resumes capture after onSilence', () => {
    const onSilence = jest.fn();
    const onFinal = jest.fn();
    const svc = createSpeechService(jest.fn(), onFinal, onSilence, jest.fn());
    svc.start();

    mockInstance.onresult!(makeSpeechEvent([{ transcript: 'add fever', isFinal: true }]));
    jest.advanceTimersByTime(1500); // triggers onSilence

    svc.continueListening();

    // Speak more — then confirm
    mockInstance.onresult!(makeSpeechEvent([{ transcript: 'for Ramesh', isFinal: true }]));
    svc.confirmSend();

    expect(onFinal).toHaveBeenCalledWith('add fever for Ramesh');
  });
});
