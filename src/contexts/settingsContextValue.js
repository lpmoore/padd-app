import { createContext, useContext } from 'react';

export const SettingsContext = createContext(null);

export const useSettings = () => useContext(SettingsContext);
