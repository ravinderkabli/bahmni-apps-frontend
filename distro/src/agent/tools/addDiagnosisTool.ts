import { useConditionsAndDiagnosesStore } from '@bahmni/clinical-app/stores/conditionsAndDiagnosesStore';
import { AddDiagnosisInput, ToolResult } from '../types/agentTypes';
import { resolveConcept } from '../services/snomedService';

const CERTAINTY_CODING = {
  confirmed: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
    code: 'CONFIRMED',
    display: 'Confirmed',
  },
  provisional: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
    code: 'PRESUMED',
    display: 'Provisional',
  },
} as const;

export const addDiagnosis = async (
  input: AddDiagnosisInput,
): Promise<ToolResult> => {
  try {
    const resolution = await resolveConcept(input.conceptName);

    if (!resolution.conceptUuid) {
      return {
        success: false,
        error: `Could not find a concept matching "${input.conceptName}". Please try a more specific or alternate clinical name.`,
      };
    }

    const store = useConditionsAndDiagnosesStore.getState();

    store.addDiagnosis({
      conceptUuid: resolution.conceptUuid,
      conceptName: resolution.conceptName,
      matchedName: resolution.conceptName,
    });

    store.updateCertainty(
      resolution.conceptUuid,
      CERTAINTY_CODING[input.certainty],
    );

    return {
      success: true,
      data: {
        conceptUuid: resolution.conceptUuid,
        display: resolution.conceptName,
        certainty: input.certainty,
        snomedCode: resolution.snomedEntry?.code ?? null,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add diagnosis',
    };
  }
};
