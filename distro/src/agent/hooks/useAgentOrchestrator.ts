import { useCallback, useEffect, useRef } from 'react';
import { AGENT_SYSTEM_PROMPT } from '../constants/agentConstants';
import { callClaude, extractTextContent } from '../services/anthropicService';
import {
  createSpeechService,
  isSTTSupported,
  SpeechService,
} from '../services/sttService';
import { useAgentStore } from '../stores/agentStore';
import { ToolUseContentBlock } from '../types/agentTypes';
import { AGENT_TOOLS } from '../types/toolSchemas';
import { useToolExecutor } from './useToolExecutor';

/**
 * Core orchestration loop (no wake word — mic click only):
 *
 * [idle]
 *     ↓ click mic
 * [listening] full STT session — accumulates transcript; 1.5s silence → confirming
 *     ↓ final transcript (tap mic OR silence + submit)
 * [processing] Claude Sonnet multi-turn tool-calling loop
 *     ↓ end_turn
 * [idle] ready for next click
 *
 * The mic button:
 *  idle      → click → listening (STT starts)
 *  listening → click → stopAndSend (fire onFinal immediately)
 *  confirming→ click → confirmSend (submit)
 *  anything else → turn off → idle
 */
export const useAgentOrchestrator = () => {
  const { executeTool } = useToolExecutor();

  const mainSttRef = useRef<SpeechService | null>(null);
  const isProcessingRef = useRef(false);
  const isSupported = isSTTSupported();

  // ─── Claude loop ──────────────────────────────────────────────────────────

  const callClaudeLoop = useCallback(async () => {
    const { conversationHistory, apiKey } = useAgentStore.getState();

    if (!apiKey) {
      useAgentStore.getState().setApiKeyModalOpen(true);
      useAgentStore.getState().setStatus('idle');
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

        await callClaudeLoop();
      } else {
        // Done — return to idle (no wake word to restart)
        useAgentStore.getState().setStatus('idle');
      }
    } catch (err) {
      useAgentStore
        .getState()
        .setError(
          err instanceof Error
            ? err.message
            : 'An error occurred while processing your request',
        );
      useAgentStore.getState().setStatus('idle');
    } finally {
      isProcessingRef.current = false;
    }
  }, [executeTool]);

  // ─── Main STT (full listening session) ───────────────────────────────────

  const startMainListening = useCallback(() => {
    const { currentLanguage } = useAgentStore.getState();

    // Show 'starting' immediately so the mic button gives feedback,
    // but don't allow stop until capture is actually live (onReady fires).
    useAgentStore.getState().setStatus('starting');

    mainSttRef.current = createSpeechService(
      // onInterim — update live transcript: finalText (black) + interimText (grey)
      (finalText, interimText) => {
        useAgentStore.getState().setTranscript(finalText);
        useAgentStore.getState().setInterimTranscript(interimText);
      },
      // onFinal — transcript ready; surface in text input for review, don't auto-send
      (final) => {
        useAgentStore.getState().setTranscript(final);
        useAgentStore.getState().setInterimTranscript('');
        useAgentStore.getState().clearConfirmCallbacks();
        mainSttRef.current = null;
        isProcessingRef.current = false;
        useAgentStore.getState().setStatus('idle');
      },
      // onSilence — pause for user to choose Submit or Continue
      (silentText) => {
        useAgentStore.getState().setTranscript(silentText);
        useAgentStore.getState().setInterimTranscript('');
        useAgentStore.getState().setStatus('confirming');

        useAgentStore.getState().setConfirmCallbacks(
          // Submit — commit to Claude
          () => {
            mainSttRef.current?.confirmSend();
          },
          // Continue — resume mic, append more speech
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
          // No command detected — silently go back to idle
          useAgentStore.getState().setStatus('idle');
        } else {
          useAgentStore
            .getState()
            .setError(`Speech recognition error: ${error}`);
          useAgentStore.getState().setStatus('idle');
        }
      },
      // onReady — audio capture is live; now safe to show stop button
      () => {
        useAgentStore.getState().setStatus('listening');
      },
    );

    mainSttRef.current.setLanguage(currentLanguage);
    mainSttRef.current.start();
  }, [callClaudeLoop]);

  // ─── Text command (typed input) ──────────────────────────────────────────

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

  // ─── Mic button toggle ────────────────────────────────────────────────────

  const toggleListening = useCallback(() => {
    const { status } = useAgentStore.getState();

    if (status === 'idle') {
      // Start listening directly — no wake word
      startMainListening();
    } else if (status === 'starting') {
      // Clicked stop before capture started — cancel and return to idle
      mainSttRef.current?.stop();
      mainSttRef.current = null;
      useAgentStore.getState().setStatus('idle');
    } else if (status === 'listening') {
      if (mainSttRef.current) {
        // Tap to send — immediately fire onFinal with whatever was captured so far
        mainSttRef.current.stopAndSend();
      } else {
        // Recognition ref is gone (failed to start) — recover
        useAgentStore.getState().setStatus('idle');
      }
    } else if (status === 'confirming') {
      // Tap mic while confirming → submit (same as the Submit button)
      mainSttRef.current?.confirmSend();
    } else {
      // Turn off everything (processing, error)
      mainSttRef.current?.stop();
      mainSttRef.current = null;
      isProcessingRef.current = false;
      useAgentStore.getState().setStatus('idle');
      useAgentStore.getState().setTranscript('');
      useAgentStore.getState().setInterimTranscript('');
    }
  }, [startMainListening]);

  // ─── Sync language changes ────────────────────────────────────────────────

  const currentLanguage = useAgentStore((s) => s.currentLanguage);
  useEffect(() => {
    mainSttRef.current?.setLanguage(currentLanguage);
  }, [currentLanguage]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      mainSttRef.current?.stop();
      mainSttRef.current = null;
    };
  }, []);

  return { isSupported, toggleListening, sendTextCommand };
};
