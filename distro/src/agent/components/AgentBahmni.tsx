import React from 'react';
import { useAgentOrchestrator } from '../hooks/useAgentOrchestrator';
import ApiKeyModal from './ApiKeyModal/ApiKeyModal';
import TranscriptPanel from './TranscriptPanel/TranscriptPanel';

/**
 * Root Agent Bahmni component — mounted once in App.tsx.
 * Renders the floating chat panel and API key modal.
 */
const AgentBahmni: React.FC = () => {
  const { isSupported, toggleListening, sendTextCommand, toggleStandby } =
    useAgentOrchestrator();

  return (
    <>
      <TranscriptPanel
        onSendText={sendTextCommand}
        onToggleMic={toggleListening}
        onToggleStandby={toggleStandby}
        isSTTSupported={isSupported}
      />

      <ApiKeyModal />
    </>
  );
};

export default AgentBahmni;
