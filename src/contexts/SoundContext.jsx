import React, { createContext, useState, useContext, useEffect } from 'react';

const SoundContext = createContext();

export const useSoundSettings = () => {
    return useContext(SoundContext);
};

export const SoundProvider = ({ children }) => {
    // Check local storage for initial state, default to true if not set
    const [soundEnabled, setSoundEnabled] = useState(() => {
        const stored = localStorage.getItem('padd_sounds_enabled');
        return stored !== null ? JSON.parse(stored) : true;
    });

    useEffect(() => {
        localStorage.setItem('padd_sounds_enabled', JSON.stringify(soundEnabled));
    }, [soundEnabled]);

    const toggleSound = () => {
        setSoundEnabled(prev => !prev);
    };

    return (
        <SoundContext.Provider value={{ soundEnabled, toggleSound, setSoundEnabled }}>
            {children}
        </SoundContext.Provider>
    );
};
