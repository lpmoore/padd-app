import { useCallback } from 'react';

const useLCARSSound = () => {
    const playSound = useCallback((soundFile) => {
        try {
            const audio = new Audio(`/sounds/${soundFile}`);
            audio.volume = 0.5; // Reasonable default
            audio.play().catch(e => console.warn("Audio play failed", e));
        } catch (error) {
            console.error("Audio error", error);
        }
    }, []);

    const playClick = useCallback(() => playSound('keypress.mp3'), [playSound]);
    const playError = useCallback(() => playSound('error.mp3'), [playSound]);
    const playEngage = useCallback(() => playSound('engage.mp3'), [playSound]);

    return { playClick, playError, playEngage };
};

export default useLCARSSound;
