import React, { createContext, useState, useContext, useEffect } from 'react';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  // Initialize state from localStorage, defaulting to false if not found
  const [isStardateEnabled, setIsStardateEnabled] = useState(() => {
    const saved = localStorage.getItem('padd-is-stardate-enabled');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Persist preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('padd-is-stardate-enabled', JSON.stringify(isStardateEnabled));
  }, [isStardateEnabled]);

  return (
    <SettingsContext.Provider value={{ isStardateEnabled, setIsStardateEnabled }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);