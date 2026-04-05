import React, { useState, useEffect } from 'react';
import { Modal } from '@bahmni/design-system';
import { TextInput } from '@carbon/react';
import { View, ViewOff } from '@carbon/icons-react';
import { useAgentStore } from '../../stores/agentStore';
import styles from './ApiKeyModal.module.scss';

const ApiKeyModal: React.FC = () => {
  const { isApiKeyModalOpen, setApiKeyModalOpen, setApiKey, apiKey, onApiKeyConfirmed, setApiKeyConfirmedCallback } =
    useAgentStore();
  const [inputValue, setInputValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill with the currently stored key so users can see/verify what's saved
  useEffect(() => {
    if (isApiKeyModalOpen) {
      setInputValue(apiKey ?? '');
      setShowKey(false);
      setError('');
    }
  }, [isApiKeyModalOpen, apiKey]);

  const handleConfirm = () => {
    if (!inputValue.trim()) {
      setError('API key is required');
      return;
    }
    if (!inputValue.trim().startsWith('sk-ant-')) {
      setError('Anthropic keys start with "sk-ant-" — please check your key');
      return;
    }
    setApiKey(inputValue.trim());
    setApiKeyModalOpen(false);
    setInputValue('');
    setError('');
    if (onApiKeyConfirmed) {
      setApiKeyConfirmedCallback(null);
      onApiKeyConfirmed();
    }
  };

  const handleClose = () => {
    setApiKeyModalOpen(false);
    setInputValue('');
    setError('');
  };

  return (
    <Modal
      open={isApiKeyModalOpen}
      modalHeading="Agent Bahmni — Anthropic API Key"
      primaryButtonText="Confirm"
      secondaryButtonText="Cancel"
      onRequestSubmit={handleConfirm}
      onRequestClose={handleClose}
      onSecondarySubmit={handleClose}
      preventCloseOnClickOutside
      testId="agent-api-key-modal"
    >
      <div className={styles.modalBody}>
        <p className={styles.description}>
          Agent Bahmni uses Claude AI (Anthropic) to understand your commands.
          Your API key is stored only in this browser tab and cleared when you close it.
        </p>
        <div className={styles.inputWrapper}>
          <TextInput
            id="agent-api-key-input"
            type={showKey ? 'text' : 'password'}
            labelText="Anthropic API Key"
            placeholder="sk-ant-api03-..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (error) setError('');
            }}
            invalid={!!error}
            invalidText={error}
            data-testid="agent-api-key-input"
          />
          <button
            type="button"
            className={styles.showHideBtn}
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
            title={showKey ? 'Hide' : 'Show'}
          >
            {showKey ? <ViewOff size={16} /> : <View size={16} />}
          </button>
        </div>
        <p className={styles.hint}>
          Get your key from <strong>console.anthropic.com</strong> → API Keys.
          Keys start with <code>sk-ant-</code>.
        </p>
      </div>
    </Modal>
  );
};

export default ApiKeyModal;
