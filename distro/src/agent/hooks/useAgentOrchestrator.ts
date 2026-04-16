import { useCallback, useEffect, useRef } from 'react';
import { AGENT_SYSTEM_PROMPT } from '../constants/agentConstants';
import { callClaude, extractTextContent } from '../services/anthropicService';
import {
  createSpeechService,
  isSTTSupported,
  SpeechService,
} from '../services/sttService';
import {
  createWakeWordService,
  WakeWordService,
} from '../services/wakeWordService';
import { useAgentStore } from '../stores/agentStore';
import { ToolUseContentBlock } from '../types/agentTypes';
import { AGENT_TOOLS } from '../types/toolSchemas';
import { useToolExecutor } from './useToolExecutor';

/**
 * Core orchestration — state machine:
 *
 *  STANDBY (wake word passive listening)
 *    ↓ "Hey Bahmni" detected
 *  STARTING → LISTENING (main STT active)
 *    ↓ 1.5 s silence → CONFIRMING  OR  mic tap → stopAndSend
 *  PROCESSING (Claude multi-turn tool loop)
 *    ↓ end_turn
 *  STANDBY  (if standby mode on)  OR  IDLE  (if standby off)
 *
 *  Manual path (mic click):
 *  IDLE → STARTING → LISTENING → CONFIRMING/PROCESSING → IDLE
 */
export const useAgentOrchestrator = () => {
  const { executeTool } = useToolExecutor();

  const mainSttRef = useRef<SpeechService | null>(null);
  const wakeWordSvcRef = useRef<WakeWordService | null>(null);
  const isProcessingRef = useRef(false);
  const isSupported = isSTTSupported();

  // Forward refs to break circular dependencies between callbacks
  const callClaudeLoopRef = useRef<() => Promise<void>>(async () => {});
  const handleWakeWordRef = useRef<(cmd: string) => void>(() => {});

  // ─── Return to standby or idle after a session completes ─────────────────

  const returnToBaseState = useCallback(() => {
    const { isStandbyMode } = useAgentStore.getState();
    if (isStandbyMode) {
      // Re-arm wake word detection
      wakeWordSvcRef.current?.abort();
      wakeWordSvcRef.current = null;
      const svc = createWakeWordService(
        (cmd) => handleWakeWordRef.current(cmd),
        () => {
          /* ignore wake word errors silently */
        },
      );
      const { currentLanguage } = useAgentStore.getState();
      svc.setLanguage(currentLanguage);
      svc.start();
      wakeWordSvcRef.current = svc;
      useAgentStore.getState().setStatus('standby');
    } else {
      useAgentStore.getState().setStatus('idle');
    }
  }, []);

  // ─── Claude multi-turn loop ───────────────────────────────────────────────

  const callClaudeLoop = useCallback(async () => {
    const { conversationHistory, apiKey } = useAgentStore.getState();

    if (!apiKey) {
      useAgentStore.getState().setApiKeyModalOpen(true);
      returnToBaseState();
      return;
    }

    useAgentStore.getState().setStatus('processing');

    try {
      const response = await callClaude(
        conversationHistory,
        AGENT_TOOLS,
        apiKey,
        AGENT_SYSTEM_PROMPT,
      );

      useAgentStore.getState().appendAssistantMessage(response.content);

      const textContent = extractTextContent(response);
      if (textContent) {
        useAgentStore.getState().setLastAssistantMessage(textContent);
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (b): b is ToolUseContentBlock => b.type === 'tool_use',
        );
        for (const toolBlock of toolUseBlocks) {
          const result = await executeTool(toolBlock);
          useAgentStore
            .getState()
            .appendToolResult(toolBlock.id, JSON.stringify(result));
        }
        await callClaudeLoopRef.current();
      } else {
        returnToBaseState();
      }
    } catch (err) {
      useAgentStore
        .getState()
        .setError(
          err instanceof Error
            ? err.message
            : 'An error occurred while processing your request',
        );
      returnToBaseState();
    } finally {
      isProcessingRef.current = false;
    }
  }, [executeTool, returnToBaseState]);

  callClaudeLoopRef.current = callClaudeLoop;

  // ─── Main STT (full listening session, optionally prefixed from wake word) ─

  const startMainListening = useCallback(
    (prefixText = '') => {
      const { currentLanguage } = useAgentStore.getState();
      useAgentStore.getState().setStatus('starting');

      // Pre-populate transcript with any command portion captured by wake word
      if (prefixText) {
        useAgentStore.getState().setTranscript(prefixText);
      }

      mainSttRef.current = createSpeechService(
        // onInterim — live update: committed (black) + interim (grey)
        (finalText, interimText) => {
          const combined = prefixText
            ? `${prefixText} ${finalText}`.trim()
            : finalText;
          useAgentStore.getState().setTranscript(combined);
          useAgentStore.getState().setInterimTranscript(interimText);
        },
        // onFinal — STT session complete; surface in input for review
        (final) => {
          const combined = prefixText ? `${prefixText} ${final}`.trim() : final;
          useAgentStore.getState().setTranscript(combined);
          useAgentStore.getState().setInterimTranscript('');
          useAgentStore.getState().clearConfirmCallbacks();
          mainSttRef.current = null;
          isProcessingRef.current = false;
          useAgentStore.getState().setStatus('idle');
        },
        // onSilence — pause detected; show Submit / Continue Speaking
        (silentText) => {
          const combined = prefixText
            ? `${prefixText} ${silentText}`.trim()
            : silentText;
          useAgentStore.getState().setTranscript(combined);
          useAgentStore.getState().setInterimTranscript('');
          useAgentStore.getState().setStatus('confirming');

          useAgentStore.getState().setConfirmCallbacks(
            // Submit — commit transcript to Claude
            () => {
              mainSttRef.current?.confirmSend();
            },
            // Continue speaking — resume mic
            () => {
              useAgentStore.getState().clearConfirmCallbacks();
              useAgentStore.getState().setStatus('listening');
              mainSttRef.current?.continueListening();
            },
          );
        },
        // onError
        (error) => {
          if (error === 'no-speech-timeout') {
            returnToBaseState();
          } else {
            useAgentStore
              .getState()
              .setError(`Speech recognition error: ${error}`);
            returnToBaseState();
          }
        },
        // onReady — mic is live; now safe to show stop button
        () => {
          useAgentStore.getState().setStatus('listening');
        },
      );

      mainSttRef.current.setLanguage(currentLanguage);
      mainSttRef.current.start();
    },
    [returnToBaseState],
  );

  // ─── Wake word handler ─────────────────────────────────────────────────────

  const handleWakeWord = useCallback(
    (commandPortion: string) => {
      // Stop wake word service — hand off to main STT
      wakeWordSvcRef.current?.abort();
      wakeWordSvcRef.current = null;

      const wordCount = commandPortion
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;

      if (wordCount >= 3) {
        // Complete command was captured in the same utterance — send directly
        isProcessingRef.current = true;
        useAgentStore.getState().setTranscript(commandPortion);
        useAgentStore.getState().setIsOpen(true);
        useAgentStore.getState().appendUserMessage(commandPortion);
        useAgentStore.getState().setTranscript('');
        void callClaudeLoop();
      } else {
        // Partial or no command — start main STT; prepend any prefix
        startMainListening(commandPortion);
      }
    },
    [callClaudeLoop, startMainListening],
  );

  handleWakeWordRef.current = handleWakeWord;

  // ─── Text command (typed input) ───────────────────────────────────────────

  const sendTextCommand = useCallback(
    async (text: string) => {
      if (!text.trim() || isProcessingRef.current) return;
      isProcessingRef.current = true;
      useAgentStore.getState().setTranscript('');

      const { apiKey } = useAgentStore.getState();
      if (!apiKey) {
        useAgentStore.getState().setApiKeyConfirmedCallback(async () => {
          useAgentStore.getState().setIsOpen(true);
          useAgentStore.getState().appendUserMessage(text);
          await callClaudeLoop();
        });
        useAgentStore.getState().setApiKeyModalOpen(true);
        useAgentStore.getState().setStatus('processing');
        isProcessingRef.current = false;
        return;
      }

      useAgentStore.getState().setIsOpen(true);
      useAgentStore.getState().appendUserMessage(text);
      await callClaudeLoop();
    },
    [callClaudeLoop],
  );

  // ─── Toggle standby (wake word always-on mode) ────────────────────────────

  const toggleStandby = useCallback(() => {
    const { isStandbyMode, status } = useAgentStore.getState();
    const newMode = !isStandbyMode;
    useAgentStore.getState().setStandbyMode(newMode);

    if (newMode) {
      // Stop any active main STT and arm wake word
      mainSttRef.current?.stop();
      mainSttRef.current = null;
      const svc = createWakeWordService(
        (cmd) => handleWakeWordRef.current(cmd),
        () => {
          /* ignore */
        },
      );
      const { currentLanguage } = useAgentStore.getState();
      svc.setLanguage(currentLanguage);
      svc.start();
      wakeWordSvcRef.current = svc;
      useAgentStore.getState().setStatus('standby');
    } else {
      // Disarm wake word
      wakeWordSvcRef.current?.abort();
      wakeWordSvcRef.current = null;
      if (status === 'standby') {
        useAgentStore.getState().setStatus('idle');
      }
    }
  }, []);

  // ─── Mic button toggle ────────────────────────────────────────────────────

  const toggleListening = useCallback(() => {
    const { status } = useAgentStore.getState();

    if (status === 'standby') {
      // Manual override: stop wake word, start full listening
      wakeWordSvcRef.current?.abort();
      wakeWordSvcRef.current = null;
      startMainListening();
    } else if (status === 'idle') {
      startMainListening();
    } else if (status === 'starting') {
      mainSttRef.current?.stop();
      mainSttRef.current = null;
      returnToBaseState();
    } else if (status === 'listening') {
      if (mainSttRef.current) {
        mainSttRef.current.stopAndSend();
      } else {
        returnToBaseState();
      }
    } else if (status === 'confirming') {
      mainSttRef.current?.confirmSend();
    } else {
      // processing / error — cancel everything
      mainSttRef.current?.stop();
      mainSttRef.current = null;
      isProcessingRef.current = false;
      useAgentStore.getState().setTranscript('');
      useAgentStore.getState().setInterimTranscript('');
      returnToBaseState();
    }
  }, [startMainListening, returnToBaseState]);

  // ─── Sync language to active services ────────────────────────────────────

  const currentLanguage = useAgentStore((s) => s.currentLanguage);
  useEffect(() => {
    mainSttRef.current?.setLanguage(currentLanguage);
    wakeWordSvcRef.current?.setLanguage(currentLanguage);
  }, [currentLanguage]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      mainSttRef.current?.stop();
      mainSttRef.current = null;
      wakeWordSvcRef.current?.abort();
      wakeWordSvcRef.current = null;
    };
  }, []);

  return { isSupported, toggleListening, sendTextCommand, toggleStandby };
};
