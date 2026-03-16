import { OPENMRS_FHIR_R4 } from '../constants/app';

export const SERVICE_REQUESTS_URL = (
  category: string,
  patientUuid: string,
  encounterUuids?: string,
  numberOfVisits?: number,
  revinclude?: string,
) => {
  // _count=100: Practical upper limit to avoid unbounded queries.
  // Patients with >100 service requests of the same category will be silently truncated.
  const baseUrl =
    OPENMRS_FHIR_R4 + '/ServiceRequest?_count=100&_sort=-_lastUpdated';
  let url = `${baseUrl}&category=${category}&patient=${patientUuid}`;

  if (revinclude) {
    url += `&_revinclude=${revinclude}`;
  }

  if (encounterUuids) {
    url += `&encounter=${encounterUuids}`;
  } else if (numberOfVisits) {
    url += `&numberOfVisits=${numberOfVisits}`;
  }

  return url;
};
