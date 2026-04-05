import { searchPatientByNameOrId } from '@bahmni/services';
import { SearchPatientInput, ToolResult } from '../types/agentTypes';
import { PatientSearchResult } from '@bahmni/services';
import { getFhirPatient } from '../services/fhirPatientService';

export interface PatientSearchMatch {
  uuid: string;
  fullName: string;
  gender: string;
  age: string;
  identifier: string;
}

export const searchPatient = async (
  input: SearchPatientInput,
): Promise<ToolResult> => {
  try {
    const bundle = await searchPatientByNameOrId(input.query);
    const results = bundle.pageOfResults as PatientSearchResult[];

    if (!results || results.length === 0) {
      return {
        success: true,
        data: { matches: [], message: 'No patients found matching that name or ID.' },
      };
    }

    const baseMatches: PatientSearchMatch[] = results.slice(0, 5).map((r) => ({
      uuid: r.uuid,
      fullName: [r.givenName, r.middleName, r.familyName]
        .filter(Boolean)
        .join(' '),
      gender: r.gender,
      age: r.age ?? '',
      identifier: r.identifier ?? '',
    }));

    // Best-effort: enrich each match with FHIR2 R4 data (identifiers, telecom)
    const matches = await Promise.all(
      baseMatches.map(async (m) => {
        const fhir = await getFhirPatient(m.uuid);
        return {
          ...m,
          fhirIdentifiers: fhir?.identifier,
          fhirTelecom: fhir?.telecom,
        };
      }),
    );

    return { success: true, data: { matches } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Patient search failed',
    };
  }
};
