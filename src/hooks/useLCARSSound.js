import { useCallback } from 'react';
import { useSoundSettings } from '../contexts/SoundContext';

const useLCARSSound = () => {
    const { soundEnabled } = useSoundSettings();

    const playSound = useCallback((soundFile) => {
        if (!soundEnabled) return;
        try {
            const audio = new Audio(`/sounds/${soundFile}`);
            audio.volume = 0.5; // Reasonable default
            audio.play().catch(e => console.warn("Audio play failed", e));
        } catch (error) {
            console.error("Audio error", error);
        }
    }, [soundEnabled]);

    const playClick = useCallback(() => playSound('keypress.mp3'), [playSound]);
    const playError = useCallback(() => playSound('error.mp3'), [playSound]);
    const playEngage = useCallback(() => playSound('engage.mp3'), [playSound]);

    return { playClick, playError, playEngage };
};

export default useLCARSSound;
