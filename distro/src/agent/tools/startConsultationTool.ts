import {
  checkIfActiveVisitExists,
  createVisitForPatient,
  getVisitTypes,
} from '@bahmni/services';
import { AGENT_OPEN_CONSULTATION_PAD_EVENT } from '../constants/agentConstants';
import { useAgentStore } from '../stores/agentStore';
import { StartConsultationInput, ToolResult } from '../types/agentTypes';

type NavigateFn = (path: string) => void;

/**
 * Extract the patient UUID from the current URL path.
 * Bahmni clinical URLs follow the pattern: /clinical/{patientUuid}/...
 */
const extractPatientUuidFromUrl = (): string | null => {
  const match = window.location.pathname.match(/\/clinical\/([a-f0-9-]{36})/i);
  return match ? match[1] : null;
};

/**
 * Simulates clicking "New Consultation" — resolves the active patient from the
 * agent store or the current URL, ensures an OPD visit exists, navigates to the
 * consultation page, and fires the open-consultation-pad event.
 *
 * The patientUuid parameter is optional: Claude may supply it when it is already
 * known (e.g. after search_patient), but the tool will fall back to the store's
 * activePatientUuid or the UUID embedded in the current URL.
 */
export const startConsultation = async (
  input: StartConsultationInput,
  navigate: NavigateFn,
): Promise<ToolResult> => {
  try {
    // Resolve patient UUID — prefer explicit input, then store, then URL
    const patientUuid =
      input.patientUuid ||
      useAgentStore.getState().activePatientUuid ||
      extractPatientUuidFromUrl();

    if (!patientUuid) {
      return {
        success: false,
        error:
          'No patient is currently selected. Please search for a patient first (e.g. "search patient Ramesh").',
      };
    }

    // Ensure an active OPD visit exists before opening the consultation pad
    const hasActiveVisit = await checkIfActiveVisitExists(patientUuid);

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

      await createVisitForPatient(patientUuid, { name: 'OPD', uuid: opdUuid });
    }

    // Track active patient in agent store
    useAgentStore.getState().setActivePatientUuid(patientUuid);

    // Navigate to the consultation page if not already there
    const targetPath = `/clinical/${patientUuid}`;
    if (!window.location.pathname.includes(patientUuid)) {
      navigate(targetPath);
    }

    // Fire the event that ConsultationPad listens for to open its action area
    window.dispatchEvent(
      new CustomEvent(AGENT_OPEN_CONSULTATION_PAD_EVENT, {
        detail: { patientUuid },
      }),
    );

    return {
      success: true,
      data: {
        patientUuid,
        visitCreated: !hasActiveVisit,
        message: hasActiveVisit
          ? 'Consultation page opened.'
          : 'OPD visit started and consultation page opened.',
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'Failed to start consultation',
    };
  }
};
