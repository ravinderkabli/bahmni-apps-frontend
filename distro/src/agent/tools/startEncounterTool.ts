import { StartEncounterInput, ToolResult } from '../types/agentTypes';
import {
  AGENT_OPEN_CONSULTATION_PAD_EVENT,
} from '../constants/agentConstants';
import { useAgentStore } from '../stores/agentStore';

type NavigateFn = (path: string) => void;

export const startEncounter = (
  input: StartEncounterInput,
  navigate: NavigateFn,
): ToolResult => {
  try {
    // Track active patient in agent store
    useAgentStore.getState().setActivePatientUuid(input.patientUuid);

    const currentPath = window.location.pathname;
    const targetPath = `/clinical/${input.patientUuid}/consultation`;

    if (!currentPath.includes(input.patientUuid)) {
      navigate(targetPath);
    }

    // Fire event so ConsultationPad knows to open the action area
    window.dispatchEvent(
      new CustomEvent(AGENT_OPEN_CONSULTATION_PAD_EVENT, {
        detail: { patientUuid: input.patientUuid },
      }),
    );

    return {
      success: true,
      data: {
        patientUuid: input.patientUuid,
        message: `Navigating to consultation for patient ${input.patientUuid}`,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to start encounter',
    };
  }
};
