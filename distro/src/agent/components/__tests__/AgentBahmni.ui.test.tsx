/**
 * Full UI flow tests for AgentBahmni component.
 *
 * Key behaviours tested:
 *  - TranscriptPanel always visible (no mic click needed)
 *  - Live voice transcript streams as a bubble in the chat panel
 *  - Text input sends commands to Claude
 *  - Confirming buttons (Submit / Continue) appear in chat panel
 *  - API key modal flow
 */

import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock all services before importing components ─────────────────────────────

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
    content: [{ type: 'text', text: 'Done. I have added the fever diagnosis.' }],
  }),
  extractTextContent: jest.fn(() => 'Done. I have added the fever diagnosis.'),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import AgentBahmni from '../AgentBahmni';
import { useAgentStore } from '../../stores/agentStore';
import { createSpeechService } from '../../services/sttService';

const mockedCreateSpeechService = jest.mocked(createSpeechService);

// ── Setup ─────────────────────────────────────────────────────────────────────

const renderAgent = () =>
  render(
    <MemoryRouter>
      <AgentBahmni />
    </MemoryRouter>,
  );

const getStatus = () => useAgentStore.getState().status;

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  jest.useFakeTimers();
  useAgentStore.setState({
    status: 'idle',
    transcript: '',
    interimTranscript: '',
    conversationHistory: [],
    isOpen: true, // panel is always open for tests
    apiKey: 'sk-ant-test-key',
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AgentBahmni — full UI flow', () => {

  // ── Chat panel ────────────────────────────────────────────────────────────

  it('chat panel (TranscriptPanel) is present on render', () => {
    renderAgent();
    expect(screen.getByTestId('agent-transcript-panel')).toBeInTheDocument();
  });

  it('chat panel shows empty state hint', () => {
    renderAgent();
    expect(screen.getByText(/tap mic or type a command/i)).toBeInTheDocument();
  });

  it('no floating recording popup rendered', () => {
    renderAgent();
    expect(screen.queryByTestId('agent-recording-popup')).not.toBeInTheDocument();
  });

  it('text input field is visible in chat panel', () => {
    renderAgent();
    expect(screen.getByTestId('agent-text-input')).toBeInTheDocument();
  });

  // ── Mic button ────────────────────────────────────────────────────────────

  it('mic button renders and is enabled', () => {
    renderAgent();
    const micBtn = screen.getByTestId('agent-mic-button');
    expect(micBtn).toBeInTheDocument();
    expect(micBtn).not.toBeDisabled();
    expect(micBtn).toHaveAttribute('aria-label', expect.stringContaining('Start Agent Bahmni'));
  });

  it('click mic → listening starts immediately', () => {
    renderAgent();
    fireEvent.click(screen.getByTestId('agent-mic-button'));
    expect(getStatus()).toBe('listening');
    expect(mockedCreateSpeechService).toHaveBeenCalled();
  });

  // ── Live transcript in chat panel ─────────────────────────────────────────

  it('STT interim fires → live transcript shows in chat panel (not a popup)', () => {
    renderAgent();
    fireEvent.click(screen.getByTestId('agent-mic-button'));

    const [onInterim] = mockedCreateSpeechService.mock.calls[0];
    act(() => { (onInterim as (f: string, i: string) => void)('add fever', 'for Ramesh'); });

    // Appears inside the panel, NOT in a floating popup
    const panel = screen.getByTestId('agent-transcript-panel');
    expect(panel).toHaveTextContent('add fever');
    expect(panel).toHaveTextContent('for Ramesh');
    expect(screen.queryByTestId('agent-recording-popup')).not.toBeInTheDocument();
  });

  // ── Tap mic to send ───────────────────────────────────────────────────────

  it('tap mic while listening → calls stopAndSend', () => {
    renderAgent();
    const micBtn = screen.getByTestId('agent-mic-button');
    fireEvent.click(micBtn);
    const sttSvc = mockedCreateSpeechService.mock.results[0].value;
    fireEvent.click(micBtn);
    expect(sttSvc.stopAndSend).toHaveBeenCalled();
  });

  // ── Full voice happy path ─────────────────────────────────────────────────

  it('voice: onFinal → panel shows user + assistant messages', async () => {
    renderAgent();
    fireEvent.click(screen.getByTestId('agent-mic-button'));
    const [, onFinal] = mockedCreateSpeechService.mock.calls[0];
    await act(async () => {
      (onFinal as (t: string) => void)('add fever for Ramesh');
    });

    expect(useAgentStore.getState().isOpen).toBe(true);
    expect(useAgentStore.getState().conversationHistory[0]).toMatchObject({
      role: 'user',
      content: 'add fever for Ramesh',
    });
    const lastMsg = useAgentStore.getState().conversationHistory.at(-1);
    expect(lastMsg?.role).toBe('assistant');
  });

  it('voice: after Claude responds → status returns to idle', async () => {
    renderAgent();
    fireEvent.click(screen.getByTestId('agent-mic-button'));
    const [, onFinal] = mockedCreateSpeechService.mock.calls[0];
    await act(async () => {
      (onFinal as (t: string) => void)('add fever for Ramesh');
    });
    expect(getStatus()).toBe('idle');
  });

  // ── Text input ────────────────────────────────────────────────────────────

  it('typing and pressing Enter sends command to Claude', async () => {
    renderAgent();
    const textInput = screen.getByTestId('agent-text-input');

    fireEvent.change(textInput, { target: { value: 'register John Doe male' } });
    await act(async () => {
      fireEvent.keyDown(textInput, { key: 'Enter' });
    });

    expect(useAgentStore.getState().conversationHistory[0]).toMatchObject({
      role: 'user',
      content: 'register John Doe male',
    });
  });

  it('clicking Send button sends command to Claude', async () => {
    renderAgent();
    const textInput = screen.getByTestId('agent-text-input');

    fireEvent.change(textInput, { target: { value: 'search Ramesh' } });
    const sendBtn = screen.getByRole('button', { name: /send/i });
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    expect(useAgentStore.getState().conversationHistory[0]).toMatchObject({
      role: 'user',
      content: 'search Ramesh',
    });
  });

  it('text input clears after Send', async () => {
    renderAgent();
    const textInput = screen.getByTestId('agent-text-input');

    fireEvent.change(textInput, { target: { value: 'search Ramesh' } });
    await act(async () => {
      fireEvent.keyDown(textInput, { key: 'Enter' });
    });

    expect(textInput).toHaveValue('');
  });

  it('Send button disabled when input is empty', () => {
    renderAgent();
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeDisabled();
  });

  // ── Confirming state in panel ─────────────────────────────────────────────

  it('silence detected → confirming buttons appear in chat panel (not popup)', () => {
    renderAgent();
    fireEvent.click(screen.getByTestId('agent-mic-button'));

    const [,, onSilence] = mockedCreateSpeechService.mock.calls[0];
    act(() => { (onSilence as (t: string) => void)('add fever'); });

    expect(getStatus()).toBe('confirming');

    const panel = screen.getByTestId('agent-transcript-panel');
    expect(panel).toHaveTextContent('Submit');
    expect(panel).toHaveTextContent('Continue speaking');
    expect(screen.queryByTestId('agent-recording-popup')).not.toBeInTheDocument();
  });

  it('confirming → tap mic → calls confirmSend', () => {
    renderAgent();
    const micBtn = screen.getByTestId('agent-mic-button');
    fireEvent.click(micBtn);
    const sttSvc = mockedCreateSpeechService.mock.results[0].value;
    const [,, onSilence] = mockedCreateSpeechService.mock.calls[0];
    act(() => { (onSilence as (t: string) => void)('add fever'); });
    fireEvent.click(micBtn);
    expect(sttSvc.confirmSend).toHaveBeenCalled();
    expect(sttSvc.stop).not.toHaveBeenCalled();
  });

  // ── API key modal ─────────────────────────────────────────────────────────

  it('no API key → text command → API key modal opens', async () => {
    useAgentStore.setState({ apiKey: null });
    renderAgent();
    const textInput = screen.getByTestId('agent-text-input');
    fireEvent.change(textInput, { target: { value: 'add fever' } });
    await act(async () => {
      fireEvent.keyDown(textInput, { key: 'Enter' });
    });
    expect(useAgentStore.getState().isApiKeyModalOpen).toBe(true);
    expect(screen.getByTestId('agent-api-key-modal')).toBeInTheDocument();
  });

  it('no API key → voice → API key modal opens', async () => {
    useAgentStore.setState({ apiKey: null });
    renderAgent();
    fireEvent.click(screen.getByTestId('agent-mic-button'));
    const [, onFinal] = mockedCreateSpeechService.mock.calls[0];
    await act(async () => { (onFinal as (t: string) => void)('add fever'); });
    expect(useAgentStore.getState().isApiKeyModalOpen).toBe(true);
  });

  it('no API key → enter key → confirm → command processes immediately', async () => {
    useAgentStore.setState({ apiKey: null });
    renderAgent();
    const textInput = screen.getByTestId('agent-text-input');
    fireEvent.change(textInput, { target: { value: 'add fever for Ramesh' } });
    await act(async () => { fireEvent.keyDown(textInput, { key: 'Enter' }); });

    expect(useAgentStore.getState().isApiKeyModalOpen).toBe(true);
    expect(useAgentStore.getState().onApiKeyConfirmed).not.toBeNull();

    const keyInput = screen.getByTestId('agent-api-key-input');
    fireEvent.change(keyInput, { target: { value: 'sk-ant-real-key' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    });

    expect(useAgentStore.getState().apiKey).toBe('sk-ant-real-key');
    expect(useAgentStore.getState().isApiKeyModalOpen).toBe(false);
    expect(useAgentStore.getState().onApiKeyConfirmed).toBeNull();
    expect(useAgentStore.getState().conversationHistory[0]).toMatchObject({
      role: 'user',
      content: 'add fever for Ramesh',
    });
  });

  it('API key modal cancel → no command sent', async () => {
    useAgentStore.setState({ apiKey: null });
    renderAgent();
    const textInput = screen.getByTestId('agent-text-input');
    fireEvent.change(textInput, { target: { value: 'add fever' } });
    await act(async () => { fireEvent.keyDown(textInput, { key: 'Enter' }); });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(useAgentStore.getState().isApiKeyModalOpen).toBe(false);
    expect(useAgentStore.getState().conversationHistory).toHaveLength(0);
  });

  it('API key confirm button disabled when input is empty', async () => {
    useAgentStore.setState({ apiKey: null });
    renderAgent();
    const textInput = screen.getByTestId('agent-text-input');
    fireEvent.change(textInput, { target: { value: 'add fever' } });
    await act(async () => { fireEvent.keyDown(textInput, { key: 'Enter' }); });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(screen.getByText(/api key is required/i)).toBeInTheDocument();
    expect(useAgentStore.getState().isApiKeyModalOpen).toBe(true);
  });
});
