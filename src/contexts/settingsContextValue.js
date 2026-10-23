import { createContext, useContext } from 'react';

export const SettingsContext = createContext(null);

export const useSettings = () => useContext(SettingsContext);

export const useStardateEnabled = () =>
  useContext(SettingsContext)?.isStardateEnabled ?? false;
