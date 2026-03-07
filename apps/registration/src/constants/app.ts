export const REGISTRATION_NAMESPACE = 'registration';
export const BAHMNI_REGISTRATION_SEARCH = '/bahmni-new/registration/search';
export const BAHMNI_REGISTRATION_PATIENT = `/${REGISTRATION_NAMESPACE}/patient`;
export const REGISTRATION_CONFIG_BASE_URL =
  '/bahmni_config/openmrs/apps/registration/v2';

export const getPatientUrl = (patientUuid: string): string =>
  `${BAHMNI_REGISTRATION_PATIENT}/${patientUuid}`;

export const getPatientUrlExternal = (patientUuid: string): string =>
  `/bahmni-new${BAHMNI_REGISTRATION_PATIENT}/${patientUuid}`;
