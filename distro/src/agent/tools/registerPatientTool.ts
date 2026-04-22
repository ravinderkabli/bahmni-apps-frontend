import {
  checkIfActiveVisitExists,
  createPatient,
  createVisitForPatient,
  getIdentifierData,
  getPersonAttributeTypes,
  getVisitTypes,
} from '@bahmni/services';
import { AGENT_OPEN_CONSULTATION_PAD_EVENT } from '../constants/agentConstants';
import { useAgentStore } from '../stores/agentStore';
import { RegisterPatientInput, ToolResult } from '../types/agentTypes';
import { getFhirPatient } from '../services/fhirPatientService';

type NavigateFn = (path: string) => void;

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
  navigate: NavigateFn,
): Promise<ToolResult> => {
  try {
    const [{ prefixes, sourcesByPrefix, primaryIdentifierTypeUuid }, rawAttributeTypes] =
      await Promise.all([getIdentifierData(), getPersonAttributeTypes()]);

    const attributeList = Array.isArray(rawAttributeTypes)
      ? rawAttributeTypes
      : ((rawAttributeTypes as unknown as { results?: unknown[] }).results ?? []);
    const phoneAttributeTypeUuid =
      (attributeList as Array<{ uuid: string; name?: string }>)
        .find((a) => a.name?.toLowerCase().replace(/\s/g, '') === 'phonenumber')
        ?.uuid ?? null;

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
          attributes:
            input.phoneNumber && phoneAttributeTypeUuid
              ? [{ attributeType: { uuid: phoneAttributeTypeUuid }, value: input.phoneNumber }]
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

    const response = await createPatient(payload);
    const patientUuid = response.patient.uuid;

    // Best-effort: enrich result with FHIR2 R4 data (official name, identifiers, telecom)
    const fhirPatient = await getFhirPatient(patientUuid);

    // Auto-start OPD visit and open consultation
    let visitCreated = false;
    try {
      const hasActiveVisit = await checkIfActiveVisitExists(patientUuid);
      if (!hasActiveVisit) {
        const visitTypesResponse = await getVisitTypes();
        const opdUuid = visitTypesResponse.visitTypes?.['OPD'];
        if (opdUuid) {
          await createVisitForPatient(patientUuid, {
            name: 'OPD',
            uuid: opdUuid,
          });
          visitCreated = true;
        }
      }
    } catch {
      // Non-fatal — patient was still registered successfully
    }

    // Track active patient in store, navigate to clinical page, open consultation pad
    useAgentStore.getState().setActivePatientUuid(patientUuid);
    navigate(`/clinical/${patientUuid}`);
    window.dispatchEvent(
      new CustomEvent(AGENT_OPEN_CONSULTATION_PAD_EVENT, {
        detail: { patientUuid },
      }),
    );

    const patientUrl = `${window.location.origin}/bahmni-new/clinical/${patientUuid}`;

    return {
      success: true,
      data: {
        patientUuid,
        patientUrl,
        displayName: response.patient.display,
        identifier: response.patient.identifiers?.[0]?.identifier ?? '',
        visitCreated,
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
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'Patient registration failed';
    // eslint-disable-next-line no-console
    console.error('[registerPatient] failed:', err);
    return { success: false, error: message };
  }
};
