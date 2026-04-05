/**
 * Integration tests for useAgentOrchestrator — mic-click-only flow + text input:
 *   1. Click mic (idle) → immediately starts listening
 *   2. Click mic (listening) → sends via stopAndSend
 *   3. Click mic (confirming) → submits via confirmSend (NOT cancels)
 *   4. onFinal fires → message goes to Claude
 *   5. sendTextCommand → message goes to Claude (same path as voice)
 *   6. Click mic (processing/error) → turns off → idle
 */

import { renderHook, act } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../services/sttService', () => ({
  isSTTSupported: jest.fn(() => true),
  createSpeechService: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    stopAndSend: jest.fn(),
    confirmSend: jest.fn(),
    continueListening: jest.fn(),
    setLanguage: jest.fn(),
    isListening: jest.fn(() => true),
  })),
}));

jest.mock('../../services/anthropicService', () => ({
  callClaude: jest.fn().mockResolvedValue({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'Done' }],
  }),
  extractTextContent: jest.fn(() => 'Done'),
}));

jest.mock('../../hooks/useToolExecutor', () => ({
  useToolExecutor: () => ({ executeTool: jest.fn() }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { useAgentOrchestrator } from '../useAgentOrchestrator';
import { useAgentStore } from '../../stores/agentStore';
import { createSpeechService } from '../../services/sttService';

const mockedCreateSpeechService = jest.mocked(createSpeechService);

// ── Helpers ───────────────────────────────────────────────────────────────────

const getStatus = () => useAgentStore.getState().status;

beforeEach(() => {
  jest.useFakeTimers();
  useAgentStore.setState({
    status: 'idle',
    transcript: '',
    interimTranscript: '',
    conversationHistory: [],
    isOpen: false,
    apiKey: 'test-key',
    isApiKeyModalOpen: false,
    lastAssistantMessage: '',
    errorMessage: null,
    pendingObservations: [],
    activePatientUuid: null,
    onConfirmSubmit: null,
    onConfirmContinue: null,
  });
  jest.clearAllMocks();
  mockedCreateSpeechService.mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    stopAndSend: jest.fn(),
    confirmSend: jest.fn(),
    continueListening: jest.fn(),
    setLanguage: jest.fn(),
    isListening: jest.fn(() => true),
  }));
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAgentOrchestrator — mic-click-only flow', () => {

  it('isSupported is true when SpeechRecognition is available', () => {
    const { result } = renderHook(() => useAgentOrchestrator());
    expect(result.current.isSupported).toBe(true);
  });

  it('exposes sendTextCommand function', () => {
    const { result } = renderHook(() => useAgentOrchestrator());
    expect(typeof result.current.sendTextCommand).toBe('function');
  });

  it('idle → click mic → status is listening immediately', () => {
    const { result } = renderHook(() => useAgentOrchestrator());
    act(() => { result.current.toggleListening(); });
    expect(getStatus()).toBe('listening');
    expect(mockedCreateSpeechService).toHaveBeenCalled();
  });

  it('listening → click mic → calls stopAndSend', () => {
    const { result } = renderHook(() => useAgentOrchestrator());
    act(() => { result.current.toggleListening(); });
    const sttSvc = mockedCreateSpeechService.mock.results[0].value;
    act(() => { result.current.toggleListening(); });
    expect(sttSvc.stopAndSend).toHaveBeenCalled();
  });

  it('confirming → click mic → calls confirmSend (submit), NOT stop (cancel)', () => {
    const { result } = renderHook(() => useAgentOrchestrator());
    act(() => { result.current.toggleListening(); });
    const sttSvc = mockedCreateSpeechService.mock.results[0].value;
    const [,, onSilence] = mockedCreateSpeechService.mock.calls[0];
    act(() => { (onSilence as (t: string) => void)('add fever'); });
    expect(getStatus()).toBe('confirming');
    act(() => { result.current.toggleListening(); });
    expect(sttSvc.confirmSend).toHaveBeenCalled();
    expect(sttSvc.stop).not.toHaveBeenCalled();
  });

  it('onFinal fires → user message appended and panel opens', async () => {
    const { result } = renderHook(() => useAgentOrchestrator());
    act(() => { result.current.toggleListening(); });
    const [, onFinal] = mockedCreateSpeechService.mock.calls[0];
    await act(async () => {
      (onFinal as (t: string) => void)('add fever for Ramesh');
    });
    expect(useAgentStore.getState().isOpen).toBe(true);
    expect(useAgentStore.getState().conversationHistory[0]).toMatchObject({
      role: 'user',
      content: 'add fever for Ramesh',
    });
  });

  it('after Claude responds → status returns to idle', async () => {
    const { result } = renderHook(() => useAgentOrchestrator());
    act(() => { result.current.toggleListening(); });
    const [, onFinal] = mockedCreateSpeechService.mock.calls[0];
    await act(async () => {
      (onFinal as (t: string) => void)('add fever for Ramesh');
    });
    expect(getStatus()).toBe('idle');
  });

  // ── sendTextCommand ───────────────────────────────────────────────────────

  it('sendTextCommand → appends user message and opens panel', async () => {
    const { result } = renderHook(() => useAgentOrchestrator());
    await act(async () => {
      await result.current.sendTextCommand('register John Doe male');
    });
    expect(useAgentStore.getState().isOpen).toBe(true);
    expect(useAgentStore.getState().conversationHistory[0]).toMatchObject({
      role: 'user',
      content: 'register John Doe male',
    });
  });

  it('sendTextCommand → Claude called → status returns to idle', async () => {
    const { result } = renderHook(() => useAgentOrchestrator());
    await act(async () => {
      await result.current.sendTextCommand('search Ramesh');
    });
    expect(getStatus()).toBe('idle');
    const lastMsg = useAgentStore.getState().conversationHistory.at(-1);
    expect(lastMsg?.role).toBe('assistant');
  });

  it('sendTextCommand with empty string → does nothing', async () => {
    const { result } = renderHook(() => useAgentOrchestrator());
    await act(async () => {
      await result.current.sendTextCommand('   ');
    });
    expect(useAgentStore.getState().conversationHistory).toHaveLength(0);
    expect(getStatus()).toBe('idle');
  });

  it('sendTextCommand with no API key → opens API key modal', async () => {
    useAgentStore.setState({ apiKey: null });
    const { result } = renderHook(() => useAgentOrchestrator());
    await act(async () => {
      await result.current.sendTextCommand('register John');
    });
    expect(useAgentStore.getState().isApiKeyModalOpen).toBe(true);
    expect(useAgentStore.getState().onApiKeyConfirmed).not.toBeNull();
  });

  it('click mic while error → turns off → status idle', () => {
    const { result } = renderHook(() => useAgentOrchestrator());
    act(() => { result.current.toggleListening(); });
    const sttSvc = mockedCreateSpeechService.mock.results[0].value;
    act(() => { useAgentStore.getState().setStatus('error'); });
    act(() => { result.current.toggleListening(); });
    expect(getStatus()).toBe('idle');
    expect(sttSvc.stop).toHaveBeenCalled();
  });
});
