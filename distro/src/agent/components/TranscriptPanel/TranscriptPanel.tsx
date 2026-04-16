import { Button } from '@bahmni/design-system';
import {
  ChevronDown,
  ChevronUp,
  Key,
  Microphone,
  Power,
  StopFilled,
  TrashCan,
} from '@carbon/icons-react';
import { Tag, TextInput } from '@carbon/react';
import React, { useEffect, useRef, useState } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import styles from './TranscriptPanel.module.scss';

interface TranscriptPanelProps {
  onSendText: (text: string) => void;
  onToggleMic: () => void;
  onToggleStandby: () => void;
  isSTTSupported: boolean;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  onSendText,
  onToggleMic,
  onToggleStandby,
  isSTTSupported,
}) => {
  const {
    conversationHistory,
    transcript,
    interimTranscript,
    lastAssistantMessage,
    status,
    isOpen,
    setIsOpen,
    resetConversation,
    errorMessage,
    onConfirmSubmit,
    onConfirmContinue,
    setApiKeyModalOpen,
    isStandbyMode,
  } = useAgentStore();

  const [inputText, setInputText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputTextRef = useRef(inputText);

  const clearAutoSendTimer = () => {
    if (autoSendTimerRef.current !== null) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
  };

  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

  // Clear stale transcript on mount
  useEffect(() => {
    if (status === 'idle' && transcript) {
      useAgentStore.getState().setTranscript('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror live transcript into text input while recording
  useEffect(() => {
    if (status === 'listening') {
      setInputText(transcript);
    }
  }, [transcript, status]);

  // When recording ends (→ idle), populate input and auto-send after 2 s
  useEffect(() => {
    if (status === 'idle') {
      if (transcript) {
        setInputText(transcript);
        clearAutoSendTimer();
        autoSendTimerRef.current = setTimeout(() => {
          autoSendTimerRef.current = null;
          const text = inputTextRef.current.trim();
          if (text) {
            setInputText('');
            onSendText(text);
          }
        }, 2000);
      }
    } else if (status === 'processing') {
      clearAutoSendTimer();
      setInputText('');
    }
    return clearAutoSendTimer;
  }, [status, transcript, onSendText]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, lastAssistantMessage]);

  const handleSend = () => {
    clearAutoSendTimer();
    const text = inputText.trim();
    if (!text || status === 'processing') return;
    setInputText('');
    onSendText(text);
  };

  const isStandby = status === 'standby';
  const isStarting = status === 'starting';
  const isListening = status === 'listening';
  const isProcessing = status === 'processing';
  const isConfirming = status === 'confirming';

  // ── Status tag in header ─────────────────────────────────────────────────

  const renderStatusTag = () => {
    if (isStandby) {
      return (
        <Tag type="teal" size="sm" className={styles.standbyTag}>
          <span className={styles.standbyDot} />
          Waiting for wake word…
        </Tag>
      );
    }
    if (isStarting) {
      return (
        <Tag type="red" size="sm">
          Starting…
        </Tag>
      );
    }
    if (isListening) {
      return (
        <Tag type="red" size="sm">
          Listening…
        </Tag>
      );
    }
    if (isConfirming) {
      return (
        <Tag type="magenta" size="sm">
          Review
        </Tag>
      );
    }
    if (isProcessing) {
      return (
        <Tag type="blue" size="sm">
          Thinking…
        </Tag>
      );
    }
    if (status === 'error') {
      return (
        <Tag type="red" size="sm">
          Error
        </Tag>
      );
    }
    return null;
  };

  // ── Live transcript box (shown during listening / confirming) ─────────────

  const renderLiveTranscript = () => {
    if (!isListening && !isConfirming) return null;
    if (!transcript && !interimTranscript) return null;

    return (
      <div className={styles.liveTranscriptBox}>
        <span className={styles.liveLabel}>
          {isListening ? '🎤 Hearing:' : '✅ Captured:'}
        </span>
        <p className={styles.liveTranscriptText}>
          {transcript && <span className={styles.finalText}>{transcript}</span>}
          {interimTranscript && (
            <span className={styles.interimText}> {interimTranscript}</span>
          )}
        </p>
      </div>
    );
  };

  // ── Standby hero (empty state when standby is on) ─────────────────────────

  const renderStandbyHero = () => {
    if (!isStandby || conversationHistory.length > 0) return null;
    return (
      <div className={styles.standbyHero}>
        <div className={styles.standbyRing}>
          <Microphone size={28} />
        </div>
        <p className={styles.standbyHeroTitle}>Always listening</p>
        <p className={styles.standbyHeroHint}>
          Say <strong>&ldquo;Hey Bahmni&rdquo;</strong> followed by your command
        </p>
        <div className={styles.standbyExamples}>
          <code>&ldquo;Hey Bahmni, create patient Ramesh 45 male&rdquo;</code>
          <code>&ldquo;Hey Bahmni, add HbA1c 7 for current patient&rdquo;</code>
          <code>&ldquo;Hey Bahmni, add BP 140 over 90 for Ravi&rdquo;</code>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.panel} data-testid="agent-transcript-panel">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className={`${styles.header} ${isStandby ? styles.headerStandby : ''}`}
      >
        <span className={styles.title}>Agent Bahmni</span>
        <div className={styles.headerActions}>
          {renderStatusTag()}

          {/* Standby toggle */}
          <button
            className={`${styles.iconBtn} ${isStandbyMode ? styles.standbyToggleActive : ''}`}
            onClick={onToggleStandby}
            disabled={!isSTTSupported}
            aria-label={
              isStandbyMode
                ? 'Disable wake word'
                : 'Enable wake word (Hey Bahmni)'
            }
            title={
              isStandbyMode
                ? 'Always-on: ON — click to turn off'
                : 'Always-on: OFF — click to enable "Hey Bahmni"'
            }
            type="button"
          >
            <Power size={16} />
          </button>

          <button
            className={styles.iconBtn}
            onClick={() => setApiKeyModalOpen(true)}
            aria-label="Set Anthropic API key"
            type="button"
            title="Set Anthropic API key"
            data-testid="agent-set-api-key-btn"
          >
            <Key size={16} />
          </button>
          <button
            className={styles.iconBtn}
            onClick={resetConversation}
            aria-label="Clear conversation"
            type="button"
            title="Clear conversation"
          >
            <TrashCan size={16} />
          </button>
          <button
            className={styles.iconBtn}
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Collapse panel' : 'Expand panel'}
            type="button"
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          <div className={styles.messages}>
            {/* Standby hero (no messages yet) */}
            {renderStandbyHero()}

            {/* Empty state — no standby, no messages */}
            {!isStandby && conversationHistory.length === 0 && (
              <p className={styles.emptyState}>
                Tap the mic or type a command to start
              </p>
            )}

            {/* Conversation history */}
            {conversationHistory.map((msg, idx) => {
              const key = `${msg.role}-${idx}`;
              if (msg.role === 'user' && typeof msg.content === 'string') {
                return (
                  <div key={key} className={styles.userMessage}>
                    <span className={styles.bubble}>{msg.content}</span>
                  </div>
                );
              }
              if (msg.role === 'assistant' && Array.isArray(msg.content)) {
                const text = msg.content
                  .filter((b) => b.type === 'text' && 'text' in b)
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((b) => (b as any).text)
                  .join('');
                if (!text) return null;
                return (
                  <div key={key} className={styles.assistantMessage}>
                    <span className={styles.bubble}>{text}</span>
                  </div>
                );
              }
              return null;
            })}

            {/* Live streaming transcript */}
            {renderLiveTranscript()}

            {/* Confirming state: Submit / Continue Speaking */}
            {isConfirming && (
              <div className={styles.confirmRow}>
                <p className={styles.tapHint}>Review captured command:</p>
                <div className={styles.confirmActions}>
                  <Button
                    kind="secondary"
                    size="sm"
                    onClick={onConfirmContinue ?? undefined}
                  >
                    Continue speaking
                  </Button>
                  <Button
                    kind="primary"
                    size="sm"
                    onClick={onConfirmSubmit ?? undefined}
                  >
                    Submit
                  </Button>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className={styles.errorMessage}>
                <span className={styles.bubble}>{errorMessage}</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── Input row ─────────────────────────────────────────────── */}
          <div className={styles.inputRow}>
            <button
              className={`${styles.micBtn} ${isStarting || isListening ? styles.micBtnActive : ''} ${isStandby ? styles.micBtnStandby : ''}`}
              onClick={onToggleMic}
              disabled={!isSTTSupported || isProcessing}
              aria-label={
                isStandby
                  ? 'Click to listen manually'
                  : isListening
                    ? 'Stop and send'
                    : 'Start speaking'
              }
              title={
                isStandby
                  ? 'Click to manually activate mic (bypasses wake word)'
                  : isStarting
                    ? 'Requesting microphone access…'
                    : isListening
                      ? 'Stop and send'
                      : 'Start speaking'
              }
              type="button"
              data-testid="agent-mic-button"
            >
              {isListening || isStarting ? (
                <StopFilled size={18} />
              ) : (
                <Microphone size={18} />
              )}
            </button>

            <TextInput
              id="agent-text-input"
              data-testid="agent-text-input"
              autoComplete="off"
              labelText=""
              hideLabel
              placeholder={
                isStandby
                  ? 'Say "Hey Bahmni" or type a command…'
                  : isStarting
                    ? 'Requesting microphone…'
                    : isListening
                      ? 'Listening — speak your command…'
                      : 'Type or speak a command…'
              }
              value={inputText}
              onChange={(e) => {
                if (!isListening) {
                  clearAutoSendTimer();
                  setInputText(e.target.value);
                }
              }}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' && !isListening) handleSend();
              }}
              disabled={isProcessing}
            />

            <Button
              kind="primary"
              size="sm"
              onClick={handleSend}
              disabled={!inputText.trim() || isProcessing || isListening}
            >
              Send
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default TranscriptPanel;
