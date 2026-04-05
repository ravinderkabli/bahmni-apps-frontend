import {
  createPatient,
  getIdentifierData,
} from '@bahmni/services';
import { RegisterPatientInput, ToolResult } from '../types/agentTypes';
import { getFhirPatient } from '../services/fhirPatientService';

/**
 * Converts estimated age in years to an approximate birthdate (Jan 1 of that year).
 */
const estimatedAgeToBirthdate = (years: number): string => {
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - years);
  return dob.toISOString().split('T')[0];
};

export const registerPatient = async (
  input: RegisterPatientInput,
): Promise<ToolResult> => {
  try {
    const { prefixes, sourcesByPrefix, primaryIdentifierTypeUuid } =
      await getIdentifierData();

    if (!primaryIdentifierTypeUuid) {
      return {
        success: false,
        error: 'No primary identifier type configured in Bahmni. Patient registration is not possible at this time.',
      };
    }

    // Pick the first available identifier source
    const prefix = prefixes[0] ?? '';
    const identifierSourceUuid = prefix ? sourcesByPrefix.get(prefix) : undefined;

    let birthdate: string;
    let birthdateEstimated = false;

    if (input.dateOfBirth) {
      birthdate = input.dateOfBirth;
    } else if (input.estimatedAgeYears !== undefined) {
      birthdate = estimatedAgeToBirthdate(input.estimatedAgeYears);
      birthdateEstimated = true;
    } else {
      // Default — still register but mark as estimated with current date minus 0 years
      birthdate = new Date().toISOString().split('T')[0];
      birthdateEstimated = true;
    }

    const payload = {
      patient: {
        person: {
          names: [
            {
              givenName: input.firstName,
              familyName: input.lastName,
              preferred: true,
            },
          ],
          gender: input.gender,
          birthdate,
          birthdateEstimated,
          birthtime: null,
          addresses: input.address
            ? [{ address1: input.address }]
            : undefined,
          attributes: input.phoneNumber
            ? [
                {
                  attributeType: { uuid: '' }, // placeholder — phone attribute type resolved at runtime
                  value: input.phoneNumber,
                },
              ]
            : [],
        },
        identifiers: [
          {
            identifierType: primaryIdentifierTypeUuid,
            preferred: true,
            ...(identifierSourceUuid
              ? { identifierSourceUuid, identifierPrefix: prefix }
              : {}),
          },
        ],
      },
      relationships: [],
    };

    // Remove phone attribute placeholder if no phone provided (attributes array is empty)
    if (!input.phoneNumber) {
      payload.patient.person.attributes = [];
    }

    const response = await createPatient(payload);
    const patientUuid = response.patient.uuid;

    // Best-effort: enrich result with FHIR2 R4 data (official name, identifiers, telecom)
    const fhirPatient = await getFhirPatient(patientUuid);

    return {
      success: true,
      data: {
        patientUuid,
        displayName: response.patient.display,
        identifier: response.patient.identifiers?.[0]?.identifier ?? '',
        fhir: fhirPatient
          ? {
              officialName: fhirPatient.name?.[0],
              identifiers: fhirPatient.identifier,
              birthDate: fhirPatient.birthDate,
              gender: fhirPatient.gender,
              telecom: fhirPatient.telecom,
            }
          : undefined,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Patient registration failed',
    };
  }
};
