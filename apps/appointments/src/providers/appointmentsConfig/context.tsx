import { createContext } from 'react';
import { AppointmentsConfigContextType } from './models';

export const AppointmentsConfigContext = createContext<
  AppointmentsConfigContextType | undefined
>(undefined);
