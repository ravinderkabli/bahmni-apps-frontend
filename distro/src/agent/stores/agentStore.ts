import { create } from 'zustand';
import {
  AgentObservation,
  AgentStatus,
  ContentBlock,
  ConversationMessage,
  SupportedLanguage,
} from '../types/agentTypes';
import { AGENT_API_KEY_SESSION_STORAGE_KEY } from '../constants/agentConstants';

export interface AgentState {
  status: AgentStatus;
  isOpen: boolean;
  /** Committed (finalized) words — rendered in primary colour */
  transcript: string;
  /** In-flight interim words — rendered in secondary/grey colour */
  interimTranscript: string;
  conversationHistory: ConversationMessage[];
  currentLanguage: SupportedLanguage;
  apiKey: string | null;
  isApiKeyModalOpen: boolean;
  lastAssistantMessage: string;
  errorMessage: string | null;
  /** Observations collected via add_observation tool, submitted at save time */
  pendingObservations: AgentObservation[];
  /** UUID of patient currently being consulted (set by start_encounter tool) */
  activePatientUuid: string | null;
  /**
   * Callbacks set by the orchestrator when entering 'confirming' state.
   * RecordingPopup buttons call these directly.
   */
  onConfirmSubmit: (() => void) | null;
  onConfirmContinue: (() => void) | null;
  /** Called by ApiKeyModal after the key is saved, to re-run the pending command */
  onApiKeyConfirmed: (() => void) | null;

  setStatus: (status: AgentStatus) => void;
  setIsOpen: (open: boolean) => void;
  setTranscript: (transcript: string) => void;
  setInterimTranscript: (interimTranscript: string) => void;
  appendUserMessage: (text: string) => void;
  appendAssistantMessage: (content: ContentBlock[]) => void;
  appendToolResult: (toolUseId: string, result: string) => void;
  setLanguage: (lang: SupportedLanguage) => void;
  setApiKey: (key: string) => void;
  setApiKeyModalOpen: (open: boolean) => void;
  setLastAssistantMessage: (msg: string) => void;
  setError: (msg: string | null) => void;
  addPendingObservation: (obs: AgentObservation) => void;
  setActivePatientUuid: (uuid: string | null) => void;
  setConfirmCallbacks: (onSubmit: () => void, onContinue: () => void) => void;
  clearConfirmCallbacks: () => void;
  setApiKeyConfirmedCallback: (cb: (() => void) | null) => void;
  resetConversation: () => void;
}

const readApiKeyFromStorage = (): string | null => {
  try {
    return sessionStorage.getItem(AGENT_API_KEY_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const useAgentStore = create<AgentState>((set, get) => ({
  status: 'idle',
  isOpen: true,
  transcript: '',
  interimTranscript: '',
  conversationHistory: [],
  currentLanguage: 'en-IN',
  apiKey: readApiKeyFromStorage(),
  isApiKeyModalOpen: false,
  lastAssistantMessage: '',
  errorMessage: null,
  pendingObservations: [],
  activePatientUuid: null,
  onConfirmSubmit: null,
  onConfirmContinue: null,
  onApiKeyConfirmed: null,

  setStatus: (status) => set({ status }),
  setIsOpen: (isOpen) => set({ isOpen }),
  setTranscript: (transcript) => set({ transcript }),
  setInterimTranscript: (interimTranscript) => set({ interimTranscript }),

  appendUserMessage: (text) =>
    set((state) => ({
      conversationHistory: [
        ...state.conversationHistory,
        { role: 'user', content: text },
      ],
    })),

  appendAssistantMessage: (content) =>
    set((state) => ({
      conversationHistory: [
        ...state.conversationHistory,
        { role: 'assistant', content },
      ],
    })),

  appendToolResult: (toolUseId, result) =>
    set((state) => {
      const toolResultBlock = {
        type: 'tool_result' as const,
        tool_use_id: toolUseId,
        content: result,
      };
      // Tool results are sent as user messages per Anthropic API spec
      return {
        conversationHistory: [
          ...state.conversationHistory,
          { role: 'user', content: [toolResultBlock] },
        ],
      };
    }),

  setLanguage: (currentLanguage) => set({ currentLanguage }),

  setApiKey: (key) => {
    try {
      sessionStorage.setItem(AGENT_API_KEY_SESSION_STORAGE_KEY, key);
    } catch {
      // sessionStorage may be unavailable
    }
    set({ apiKey: key });
  },

  setApiKeyModalOpen: (isApiKeyModalOpen) => set({ isApiKeyModalOpen }),

  setLastAssistantMessage: (lastAssistantMessage) =>
    set({ lastAssistantMessage }),

  setError: (errorMessage) => set({ errorMessage, status: 'error' }),

  addPendingObservation: (obs) =>
    set((state) => ({
      pendingObservations: [...state.pendingObservations, obs],
    })),

  setActivePatientUuid: (activePatientUuid) => set({ activePatientUuid }),

  setConfirmCallbacks: (onConfirmSubmit, onConfirmContinue) =>
    set({ onConfirmSubmit, onConfirmContinue }),

  clearConfirmCallbacks: () =>
    set({ onConfirmSubmit: null, onConfirmContinue: null }),

  setApiKeyConfirmedCallback: (onApiKeyConfirmed) => set({ onApiKeyConfirmed }),

  resetConversation: () =>
    set({
      conversationHistory: [],
      transcript: '',
      interimTranscript: '',
      lastAssistantMessage: '',
      errorMessage: null,
      pendingObservations: [],
      status: 'idle',
    }),
}));

export default useAgentStore;
