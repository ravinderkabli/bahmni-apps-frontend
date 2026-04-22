import {
  checkIfActiveVisitExists,
  createVisitForPatient,
  getVisitTypes,
} from '@bahmni/services';
import { AGENT_OPEN_CONSULTATION_PAD_EVENT } from '../constants/agentConstants';
import { useAgentStore } from '../stores/agentStore';
import { StartEncounterInput, ToolResult } from '../types/agentTypes';

type NavigateFn = (path: string) => void;

export const startEncounter = async (
  input: StartEncounterInput,
  navigate: NavigateFn,
): Promise<ToolResult> => {
  try {
    // 1. Ensure the patient has an active OPD visit before opening consultation
    const hasActiveVisit = await checkIfActiveVisitExists(input.patientUuid);

    if (!hasActiveVisit) {
      const visitTypesResponse = await getVisitTypes();
      const opdUuid = visitTypesResponse.visitTypes?.['OPD'];

      if (!opdUuid) {
        return {
          success: false,
          error:
            'OPD visit type not found in Bahmni configuration. Please start a visit manually.',
        };
      }

      await createVisitForPatient(input.patientUuid, {
        name: 'OPD',
        uuid: opdUuid,
      });
    }

    // 2. Track active patient in agent store
    useAgentStore.getState().setActivePatientUuid(input.patientUuid);

    // 3. Navigate to consultation page if not already there
    const currentPath = window.location.pathname;
    const targetPath = `/clinical/${input.patientUuid}`;

    if (!currentPath.includes(input.patientUuid)) {
      navigate(targetPath);
    }

    // 4. Fire event so ConsultationPad knows to open the action area
    window.dispatchEvent(
      new CustomEvent(AGENT_OPEN_CONSULTATION_PAD_EVENT, {
        detail: { patientUuid: input.patientUuid },
      }),
    );

    return {
      success: true,
      data: {
        patientUuid: input.patientUuid,
        visitStarted: !hasActiveVisit,
        message: hasActiveVisit
          ? `Patient already has an active OPD visit. Opened consultation.`
          : `Started OPD visit and opened consultation for patient ${input.patientUuid}.`,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to start encounter',
    };
  }
};
