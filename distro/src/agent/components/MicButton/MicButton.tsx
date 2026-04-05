import React from 'react';
import { Microphone, MicrophoneOff, WarningAlt } from '@carbon/icons-react';
import { InlineLoading } from '@carbon/react';
import { useAgentStore } from '../../stores/agentStore';
import styles from './MicButton.module.scss';

interface MicButtonProps {
  onToggle: () => void;
  isSupported: boolean;
}

const MicButton: React.FC<MicButtonProps> = ({ onToggle, isSupported }) => {
  const { status } = useAgentStore();

  const isListening = status === 'listening';
  const isProcessing = status === 'processing';
  const isError = status === 'error';
  const isOff = status === 'idle';

  const getButtonClass = () => {
    const classes = [styles.micButton];
    if (!isSupported) classes.push(styles.unsupported);
    else if (isOff) classes.push(styles.off);
    else if (isListening) classes.push(styles.listening);
    else if (isError) classes.push(styles.error);
    return classes.join(' ');
  };

  const getAriaLabel = () => {
    if (!isSupported) return 'Voice input not supported in this browser';
    if (isOff) return 'Start Agent Bahmni — click to start listening';
    if (isListening) return 'Listening — speak your command';
    if (isProcessing) return 'Processing...';
    if (isError) return 'Error — click to retry';
    return 'Agent Bahmni';
  };

  const renderIcon = () => {
    if (isProcessing) {
      return <InlineLoading className={styles.spinner} description="" status="active" />;
    }
    if (isError) return <WarningAlt size={24} />;
    if (isOff || !isSupported) return <MicrophoneOff size={24} />;
    return <Microphone size={24} />;
  };

  return (
    <button
      className={getButtonClass()}
      onClick={onToggle}
      disabled={!isSupported}
      aria-label={getAriaLabel()}
      aria-pressed={isListening}
      data-testid="agent-mic-button"
      title={getAriaLabel()}
      type="button"
    >
      {renderIcon()}
    </button>
  );
};

export default MicButton;
