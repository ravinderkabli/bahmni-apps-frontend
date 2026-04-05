import { SubmitConsultationInput, ToolResult } from '../types/agentTypes';
import { AGENT_SUBMIT_CONSULTATION_EVENT } from '../constants/agentConstants';

/** Tracks whether a ConsultationPad is currently mounted (registered via DOM event) */
let isConsultationPadListenerActive = false;

if (typeof window !== 'undefined') {
  window.addEventListener('agent-consultation-pad-mounted', () => {
    isConsultationPadListenerActive = true;
  });
  window.addEventListener('agent-consultation-pad-unmounted', () => {
    isConsultationPadListenerActive = false;
  });
}

export const submitConsultation = (
  input: SubmitConsultationInput,
): ToolResult => {
  if (!input.confirm) {
    return {
      success: false,
      error: 'Submission not confirmed. Please explicitly confirm to submit.',
    };
  }

  if (!isConsultationPadListenerActive) {
    return {
      success: false,
      error:
        'No active consultation is open. Please open a patient consultation first.',
    };
  }

  window.dispatchEvent(new CustomEvent(AGENT_SUBMIT_CONSULTATION_EVENT));

  return {
    success: true,
    data: { message: 'Consultation submitted.' },
  };
};
