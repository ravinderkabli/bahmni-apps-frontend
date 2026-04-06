import React from 'react';
import { useAgentOrchestrator } from '../hooks/useAgentOrchestrator';
import ApiKeyModal from './ApiKeyModal/ApiKeyModal';
import TranscriptPanel from './TranscriptPanel/TranscriptPanel';

/**
 * Root Agent Bahmni component — mounted once in App.tsx.
 * Renders the floating mic button, always-visible chat panel, and API key modal.
 * The floating RecordingPopup has been merged into TranscriptPanel.
 */
const AgentBahmni: React.FC = () => {
  const { isSupported, toggleListening, sendTextCommand } =
    useAgentOrchestrator();

  return (
    <>
      <TranscriptPanel
        onSendText={sendTextCommand}
        onToggleMic={toggleListening}
        isSTTSupported={isSupported}
      />

      <ApiKeyModal />
    </>
  );
};

export default AgentBahmni;
