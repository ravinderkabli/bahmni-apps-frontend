import { useNavigate } from 'react-router-dom';
import { ToolUseContentBlock, ToolResult } from '../types/agentTypes';
import { registerPatient } from '../tools/registerPatientTool';
import { searchPatient } from '../tools/searchPatientTool';
import { startEncounter } from '../tools/startEncounterTool';
import { startConsultation } from '../tools/startConsultationTool';
import { addDiagnosis } from '../tools/addDiagnosisTool';
import { addMedication } from '../tools/addMedicationTool';
import { addObservation } from '../tools/addObservationTool';
import { submitConsultation } from '../tools/submitConsultationTool';
import type {
  RegisterPatientInput,
  SearchPatientInput,
  StartEncounterInput,
  StartConsultationInput,
  AddDiagnosisInput,
  AddMedicationInput,
  AddObservationInput,
  SubmitConsultationInput,
} from '../types/agentTypes';

export interface UseToolExecutorReturn {
  executeTool: (toolBlock: ToolUseContentBlock) => Promise<ToolResult>;
}

/**
 * Hook (to access useNavigate) that dispatches tool_use blocks to their handlers.
 */
export const useToolExecutor = (): UseToolExecutorReturn => {
  const navigate = useNavigate();

  const executeTool = async (
    toolBlock: ToolUseContentBlock,
  ): Promise<ToolResult> => {
    const { name, input } = toolBlock;

    switch (name) {
      case 'register_patient':
        return registerPatient(input as RegisterPatientInput, navigate);

      case 'search_patient':
        return searchPatient(input as SearchPatientInput);

      case 'start_encounter':
        return startEncounter(input as StartEncounterInput, navigate);

      case 'start_consultation':
        return startConsultation(input as StartConsultationInput, navigate);

      case 'add_diagnosis':
        return addDiagnosis(input as AddDiagnosisInput);

      case 'add_medication':
        return addMedication(input as AddMedicationInput);

      case 'add_observation':
        return addObservation(input as AddObservationInput);

      case 'submit_consultation':
        return submitConsultation(input as SubmitConsultationInput);

      default:
        return {
          success: false,
          error: `Unknown tool: ${name}`,
        };
    }
  };

  return { executeTool };
};
