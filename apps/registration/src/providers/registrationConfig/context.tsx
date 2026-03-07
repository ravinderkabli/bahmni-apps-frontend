import { createContext } from 'react';
import { RegistrationConfigContextType } from './models';

export const RegistrationConfigContext = createContext<
  RegistrationConfigContextType | undefined
>(undefined);
