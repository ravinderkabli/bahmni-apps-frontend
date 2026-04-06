import { Button } from '@bahmni/design-system';
import {
  ChevronDown,
  ChevronUp,
  Key,
  Microphone,
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
  isSTTSupported: boolean;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  onSendText,
  onToggleMic,
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
  } = useAgentStore();

  const [inputText, setInputText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Mirror live transcript into the text input while recording
  useEffect(() => {
    if (status === 'listening') {
      // Only show actual spoken words — skip status strings like "Recording…"
      setInputText(transcript);
    }
  }, [transcript, status]);

  // When recording ends, populate input with final transcript for review/edit before sending
  useEffect(() => {
    if (status === 'idle') {
      if (transcript) setInputText(transcript);
    } else if (status === 'processing') {
      setInputText('');
    }
  }, [status, transcript]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, lastAssistantMessage]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || status === 'processing') return;
    setInputText('');
    onSendText(text);
  };

  const isStarting = status === 'starting';
  const isListening = status === 'listening';
  const isProcessing = status === 'processing';

  const renderStatusTag = () => {
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
          {interimTranscript || 'Listening...'}
        </Tag>
      );
    }
    if (status === 'confirming') {
      return (
        <Tag type="magenta" size="sm">
          Review
        </Tag>
      );
    }
    if (isProcessing) {
      return (
        <Tag type="blue" size="sm">
          Thinking...
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

  return (
    <div className={styles.panel} data-testid="agent-transcript-panel">
      <div className={styles.header}>
        <span className={styles.title}>Agent Bahmni</span>
        <div className={styles.headerActions}>
          {renderStatusTag()}
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
            {conversationHistory.length === 0 && (
              <p className={styles.emptyState}>
                Tap the mic or type a command to start
              </p>
            )}

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

            {/* Confirming state: Submit / Continue Speaking buttons */}
            {status === 'confirming' && (
              <div className={styles.confirmRow}>
                <p className={styles.tapHint}>Tap mic to submit, or choose:</p>
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

          {/* Input row: mic button + text input + send button */}
          <div className={styles.inputRow}>
            <button
              className={`${styles.micBtn} ${isStarting || isListening ? styles.micBtnActive : ''}`}
              onClick={onToggleMic}
              disabled={!isSTTSupported || isProcessing || isStarting}
              aria-label={isListening ? 'Stop and send' : 'Start speaking'}
              title={
                isStarting
                  ? 'Requesting microphone access…'
                  : isListening
                    ? 'Stop and send'
                    : 'Start speaking'
              }
              type="button"
              data-testid="agent-mic-button"
            >
              {isListening ? (
                <StopFilled size={18} />
              ) : (
                <Microphone size={18} />
              )}
            </button>

            <TextInput
              id="agent-text-input"
              data-testid="agent-text-input"
              labelText=""
              hideLabel
              placeholder={
                isStarting
                  ? 'Requesting microphone…'
                  : isListening
                    ? 'Listening — speak your command…'
                    : 'Type or speak a command…'
              }
              value={inputText}
              onChange={(e) => {
                if (!isListening) setInputText(e.target.value);
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
