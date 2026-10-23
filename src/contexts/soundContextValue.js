import { createContext, useContext } from 'react';

export const SoundContext = createContext(null);

export const useSoundSettings = () => useContext(SoundContext);
