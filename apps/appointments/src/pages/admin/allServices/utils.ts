import {
  AppointmentService,
  camelToScreamingSnakeCase,
} from '@bahmni/services';
import { KNOWN_FIELDS } from './constants';
import { AppointmentServiceViewModel } from './model';

export function extractServiceAttributeNames(fields: string[]): string[] {
  return fields.filter((field) => !KNOWN_FIELDS.includes(field));
}

export function createServiceHeaders(
  fields: string[],
  t: (key: string) => string,
): Array<{ key: string; header: string }> {
  return [
    ...fields.map((field) => ({
      key: field,
      header: t(
        `ADMIN_ALL_SERVICES_COLUMN_${camelToScreamingSnakeCase(field)}`,
      ),
    })),
    {
      key: 'actions',
      header: t('ADMIN_ALL_SERVICES_COLUMN_ACTIONS'),
    },
  ];
}

export function createAppointmentServiceViewModels(
  services: AppointmentService[],
  attributeNames: string[],
): AppointmentServiceViewModel[] {
  return services.map((service) => ({
    id: service.uuid,
    name: service.name,
    location: service.location?.name ?? null,
    speciality: service.speciality?.name ?? null,
    durationMins: service.durationMins,
    description: service.description,
    attributes: Object.fromEntries(
      attributeNames.map((name) => [
        name,
        service.attributes?.find((a) => a.attributeType === name)?.value ??
          null,
      ]),
    ),
  }));
}
