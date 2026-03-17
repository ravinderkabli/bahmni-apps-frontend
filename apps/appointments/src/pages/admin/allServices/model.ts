export interface AppointmentServiceViewModel {
  id: string;
  name: string;
  location: string | null;
  speciality: string | null;
  durationMins: number | null | undefined;
  description: string | null;
  attributes: Record<string, string | null>;
}
