import { useCallback, useEffect, useRef } from 'react';
import { createSpeechService, isSTTSupported, SpeechService } from '../services/sttService';
import { useAgentStore } from '../stores/agentStore';

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

/**
 * React hook that manages the SpeechRecognition lifecycle.
 * Calls back into agentStore and triggers onFinal when a sentence is complete.
 */
export const useSpeechRecognition = (
  onFinalTranscript: (transcript: string) => void,
): UseSpeechRecognitionReturn => {
  const serviceRef = useRef<SpeechService | null>(null);
  const isSupported = isSTTSupported();

  const { setTranscript, setInterimTranscript, setStatus, status, currentLanguage } = useAgentStore();

  // Sync language changes to the speech service
  useEffect(() => {
    serviceRef.current?.setLanguage(currentLanguage);
  }, [currentLanguage]);

  const initService = useCallback(() => {
    if (!isSupported) return;

    serviceRef.current = createSpeechService(
      (finalText, interimText) => {
        setTranscript(finalText);
        setInterimTranscript(interimText);
      },
      (final) => {
        setTranscript(final);
        setInterimTranscript('');
        onFinalTranscript(final);
      },
      // onSilence — treat the same as onFinal for this simpler hook
      (silentText) => {
        setTranscript(silentText);
        setInterimTranscript('');
        onFinalTranscript(silentText);
      },
      (error) => {
        useAgentStore.getState().setError(`Speech recognition error: ${error}`);
      },
    );
    serviceRef.current.setLanguage(currentLanguage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported, currentLanguage]);

  const startListening = useCallback(() => {
    if (!isSupported) return;
    if (!serviceRef.current) {
      initService();
    }
    serviceRef.current?.start();
    setStatus('listening');
  }, [isSupported, initService, setStatus]);

  const stopListening = useCallback(() => {
    serviceRef.current?.stop();
    if (status === 'listening') {
      setStatus('idle');
    }
  }, [status, setStatus]);

  const toggleListening = useCallback(() => {
    if (serviceRef.current?.isListening()) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      serviceRef.current?.stop();
      serviceRef.current = null;
    };
  }, []);

  return { isSupported, startListening, stopListening, toggleListening };
};
