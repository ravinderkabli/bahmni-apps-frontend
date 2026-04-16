import { get, OPENMRS_FHIR_R4 } from '@bahmni/services';

export interface FhirPatientResource {
  resourceType: 'Patient';
  id: string;
  identifier?: Array<{
    use?: string;
    type?: { text?: string; coding?: Array<{ system?: string; code?: string; display?: string }> };
    system?: string;
    value: string;
  }>;
  name?: Array<{
    use?: string;
    text?: string;
    given?: string[];
    family?: string;
  }>;
  gender?: string;
  birthDate?: string;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  address?: Array<{
    use?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
}

/**
 * Fetches a FHIR R4 Patient resource by UUID.
 * Returns null (best-effort) if the request fails — callers must handle null gracefully.
 */
export const getFhirPatient = async (
  uuid: string,
): Promise<FhirPatientResource | null> => {
  try {
    return await get<FhirPatientResource>(`${OPENMRS_FHIR_R4}/Patient/${uuid}`);
  } catch {
    return null;
  }
};
