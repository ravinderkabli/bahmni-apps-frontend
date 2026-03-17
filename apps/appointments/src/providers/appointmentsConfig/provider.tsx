import { getConfig } from '@bahmni/services';
import { createConfigProvider } from '@bahmni/widgets';
import { APPOINTMENTS_CONFIG_URL } from './constants';
import { AppointmentsConfigContext } from './context';
import { AppointmentsConfig, AppointmentsConfigContextType } from './models';
import appointmentsConfigSchema from './schema.json';

export const AppointmentsConfigProvider = createConfigProvider<
  AppointmentsConfig,
  AppointmentsConfigContextType
>({
  context: AppointmentsConfigContext,
  queryKey: ['appointmentsConfig'],
  queryFn: () =>
    getConfig<AppointmentsConfig>(
      APPOINTMENTS_CONFIG_URL,
      appointmentsConfigSchema,
    ),
  valueMapper: (appointmentsConfig, isLoading, error) => ({
    appointmentsConfig,
    isLoading,
    error,
  }),
  id: 'appointments-config',
  name: 'Appointments Config',
  displayName: 'AppointmentsConfigProvider',
});
