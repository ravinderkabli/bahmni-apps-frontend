import type { Appointment, Bundle, BundleEntry } from 'fhir/r4';

export const createEmptyBundle = (): Bundle<Appointment> => ({
  resourceType: 'Bundle',
  type: 'searchset',
  entry: [],
});

export const createBundleWithEntry = (
  entry: BundleEntry<Appointment>[],
): Bundle<Appointment> => ({
  resourceType: 'Bundle',
  type: 'searchset',
  entry,
});

export const createBundleWithAppointments = (
  appointments: Appointment[],
): Bundle<Appointment> =>
  createBundleWithEntry(
    appointments.map((appt) => ({
      resource: appt,
    })),
  );

export const createMockAppointment = (
  uuid: string,
  appointmentNumber: string,
  startDate: string,
  provider: string,
  status: string,
): Appointment => ({
  resourceType: 'Appointment',
  id: uuid,
  status: status as Appointment['status'],
  identifier: [
    {
      system: 'urn:system:bahmni:appointments',
      value: appointmentNumber,
    },
  ],
  serviceType: [
    {
      text: 'Consultation',
      coding: [
        {
          code: 'service-uuid',
          display: 'Consultation',
        },
      ],
    },
  ],
  participant: [
    {
      actor: {
        reference: `Patient/patient-uuid-123`,
        display: 'John Doe (Patient Identifier: ABC200001)',
      },
      status: 'accepted',
    },
    {
      actor: {
        reference: `Practitioner/provider-uuid`,
        display: provider,
      },
      status: 'accepted',
    },
    {
      actor: {
        reference: `Location/location-uuid`,
        display: 'OPD-1',
      },
      status: 'accepted',
    },
  ],
  start: startDate,
  end: startDate,
  comment: 'Follow-up visit',
});

export const createMockAppointmentBundle = (
  appointments: Appointment[],
): Bundle<Appointment> => ({
  resourceType: 'Bundle',
  type: 'searchset',
  entry: appointments.map((resource) => ({
    resource,
  })),
});
