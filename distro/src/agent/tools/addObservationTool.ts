import { AddObservationInput, ToolResult } from '../types/agentTypes';
import { useAgentStore } from '../stores/agentStore';
import { resolveConcept } from '../services/snomedService';

export const addObservation = async (
  input: AddObservationInput,
): Promise<ToolResult> => {
  try {
    // Resolve concept UUID for the observation
    const resolution = await resolveConcept(input.conceptName);

    useAgentStore.getState().addPendingObservation({
      conceptName: resolution.conceptName,
      value: input.value,
      unit: input.unit,
      conceptUuid: resolution.conceptUuid ?? undefined,
    });

    return {
      success: true,
      data: {
        conceptName: resolution.conceptName,
        value: input.value,
        unit: input.unit,
        conceptUuid: resolution.conceptUuid,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to record observation',
    };
  }
};
