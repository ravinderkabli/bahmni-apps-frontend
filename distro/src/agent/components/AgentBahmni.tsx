import React from 'react';
import { ToastNotification } from '@carbon/react';
import { useAgentOrchestrator } from '../hooks/useAgentOrchestrator';
import MicButton from './MicButton/MicButton';
import TranscriptPanel from './TranscriptPanel/TranscriptPanel';
import ApiKeyModal from './ApiKeyModal/ApiKeyModal';
import styles from './AgentBahmni.module.scss';

/**
 * Root Agent Bahmni component — mounted once in App.tsx.
 * Renders the floating mic button, always-visible chat panel, and API key modal.
 * The floating RecordingPopup has been merged into TranscriptPanel.
 */
const AgentBahmni: React.FC = () => {
  const { isSupported, toggleListening, sendTextCommand } = useAgentOrchestrator();

  return (
    <>
      {!isSupported && (
        <div className={styles.unsupportedBanner}>
          <ToastNotification
            kind="warning"
            title="Voice Unavailable"
            subtitle="Agent Bahmni requires a browser that supports the Web Speech API (Chrome or Edge)."
            hideCloseButton
            lowContrast
          />
        </div>
      )}

      <TranscriptPanel onSendText={sendTextCommand} />

      <MicButton onToggle={toggleListening} isSupported={isSupported} />

      <ApiKeyModal />
    </>
  );
};

export default AgentBahmni;
