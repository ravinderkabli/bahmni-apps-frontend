import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, TrashCan, Key } from '@carbon/icons-react';
import { Tag, TextInput } from '@carbon/react';
import { Button } from '@bahmni/design-system';
import { useAgentStore } from '../../stores/agentStore';
import styles from './TranscriptPanel.module.scss';

interface TranscriptPanelProps {
  onSendText: (text: string) => void;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ onSendText }) => {
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, lastAssistantMessage, transcript, interimTranscript]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || status === 'processing') return;
    setInputText('');
    onSendText(text);
  };

  const renderStatusTag = () => {
    if (status === 'listening') {
      return <Tag type="red" size="sm">Listening...</Tag>;
    }
    if (status === 'confirming') {
      return <Tag type="magenta" size="sm">Review</Tag>;
    }
    if (status === 'processing') {
      return <Tag type="blue" size="sm">Thinking...</Tag>;
    }
    if (status === 'error') {
      return <Tag type="red" size="sm">Error</Tag>;
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
            {conversationHistory.length === 0 && !transcript && !interimTranscript && (
              <p className={styles.emptyState}>
                Tap mic or type a command to start
              </p>
            )}

            {conversationHistory.map((msg, idx) => {
              if (msg.role === 'user' && typeof msg.content === 'string') {
                return (
                  <div key={idx} className={styles.userMessage}>
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
                  <div key={idx} className={styles.assistantMessage}>
                    <span className={styles.bubble}>{text}</span>
                  </div>
                );
              }
              return null;
            })}

            {/* Live transcript bubble while speaking — replaces the floating RecordingPopup */}
            {(status === 'listening' || status === 'confirming') &&
              (transcript || interimTranscript) && (
                <div className={styles.userMessage}>
                  <span className={`${styles.bubble} ${styles.interim}`}>
                    {transcript && (
                      <span className={styles.finalText}>{transcript}</span>
                    )}
                    {interimTranscript && (
                      <span className={styles.interimText}>
                        {transcript ? ' ' : ''}{interimTranscript}
                      </span>
                    )}
                  </span>
                </div>
              )}

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

            {/* Error display */}
            {errorMessage && (
              <div className={styles.errorMessage}>
                <span className={styles.bubble}>{errorMessage}</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Text input row */}
          <div className={styles.inputRow}>
            <TextInput
              id="agent-text-input"
              data-testid="agent-text-input"
              labelText=""
              hideLabel
              placeholder="Type a command..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter') handleSend();
              }}
              disabled={status === 'processing'}
            />
            <Button
              kind="primary"
              size="sm"
              onClick={handleSend}
              disabled={!inputText.trim() || status === 'processing'}
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
