export interface AppointmentsConfig {
  serviceTableFields: string[];
}

export interface AppointmentsConfigContextType {
  appointmentsConfig: AppointmentsConfig | null | undefined;
  isLoading: boolean;
  error: Error | null;
}
