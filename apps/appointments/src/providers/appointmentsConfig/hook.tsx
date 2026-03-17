import { createConfigHook } from '@bahmni/widgets';
import { AppointmentsConfigContext } from './context';
import { AppointmentsConfigContextType } from './models';

export const useAppointmentsConfig =
  createConfigHook<AppointmentsConfigContextType>(
    AppointmentsConfigContext,
    'useAppointmentsConfig',
    'AppointmentsConfigProvider',
  );
