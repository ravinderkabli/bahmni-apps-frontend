import React from 'react';
import { Button } from '@carbon/react';
import { useAgentStore } from '../../stores/agentStore';
import styles from './RecordingPopup.module.scss';

/**
 * Small floating popup above the mic button that shows:
 * - Live interim transcript while listening (tap mic to send immediately)
 * - Submit / Continue choice after silence is detected
 * - "Processing…" while Claude is thinking
 */
const RecordingPopup: React.FC = () => {
  const { status, transcript, interimTranscript, onConfirmSubmit, onConfirmContinue } =
    useAgentStore();

  const isVisible =
    status === 'listening' ||
    status === 'confirming' ||
    status === 'processing';

  if (!isVisible) return null;

  const renderContent = () => {
    if (status === 'listening') {
      const hasText = transcript || interimTranscript;
      return (
        <div className={styles.listeningContent}>
          <div className={styles.listeningHeader}>
            <div className={styles.bars}>
              <span className={styles.bar} />
              <span className={styles.bar} />
              <span className={styles.bar} />
              <span className={styles.bar} />
            </div>
            <span className={styles.listeningLabel}>Listening…</span>
          </div>
          <p className={styles.transcript}>
            {hasText ? (
              <>
                {transcript && (
                  <span className={styles.finalText}>{transcript}</span>
                )}
                {interimTranscript && (
                  <span className={styles.interimText}>
                    {transcript ? ' ' : ''}{interimTranscript}
                  </span>
                )}
              </>
            ) : (
              <em className={styles.placeholder}>Say your command…</em>
            )}
          </p>
          <span className={styles.tapHint}>Tap mic to send</span>
        </div>
      );
    }

    if (status === 'confirming') {
      return (
        <div className={styles.confirmingContent}>
          <p className={styles.confirmedTranscript}>
            {transcript}
          </p>
          <p className={styles.tapHint}>Tap mic to submit</p>
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
      );
    }

    if (status === 'processing') {
      return (
        <div className={styles.processingContent}>
          <span className={styles.spinner} />
          <span className={styles.processingText}>
            {transcript ? `"${transcript}"` : 'Processing…'}
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className={styles.popup}
      data-status={status}
      data-testid="agent-recording-popup"
      role="status"
      aria-live="polite"
    >
      {renderContent()}
    </div>
  );
};

export default RecordingPopup;
