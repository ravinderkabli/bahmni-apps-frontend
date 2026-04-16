export type AgentStatus =
  | 'standby'     // always-on wake word detection active
  | 'idle'        // mic fully off
  | 'starting'    // getUserMedia pending — mic permission requested, not yet capturing
  | 'listening'   // AudioContext running, capturing audio
  | 'confirming'  // silence detected — waiting for user to Submit or Continue
  | 'processing'  // sending to Claude
  | 'speaking'
  | 'error';

export type SupportedLanguage = 'en-US' | 'en-IN' | 'hi-IN';

export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface ToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContentBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export type ContentBlock =
  | TextContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock;

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage: { input_tokens: number; output_tokens: number };
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ---- Tool input shapes ----

export interface RegisterPatientInput {
  firstName: string;
  lastName: string;
  gender: 'M' | 'F' | 'O';
  dateOfBirth?: string;
  estimatedAgeYears?: number;
  phoneNumber?: string;
  address?: string;
}

export interface SearchPatientInput {
  query: string;
}

export interface StartEncounterInput {
  patientUuid: string;
  encounterTypeName?: string;
}

export interface AddDiagnosisInput {
  conceptName: string;
  certainty: 'confirmed' | 'provisional';
}

export interface AddMedicationInput {
  drugName: string;
  dosage: number;
  dosageUnit: string;
  frequency: string;
  route: string;
  durationDays?: number;
  isStat?: boolean;
}

export interface AddObservationInput {
  conceptName: string;
  value: string | number;
  unit?: string;
}

export interface SubmitConsultationInput {
  confirm: boolean;
}

// ---- Snomed ----

export interface SnomedEntry {
  code: string;
  display: string;
  system: 'http://snomed.info/sct';
}

// ---- Agent observation (lightweight, bypasses Form2) ----

export interface AgentObservation {
  conceptName: string;
  value: string | number;
  unit?: string;
  conceptUuid?: string;
}
