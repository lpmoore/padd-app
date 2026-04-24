import './Settings.css';

import React from 'react';
import useLCARSSound from '../../hooks/useLCARSSound';
import { useSettings } from '../../contexts/settingsContextValue';
import { useSoundSettings } from '../../contexts/SoundContext';

const Settings = () => {
  const settings = useSettings();
  const soundSettings = useSoundSettings();
  const { playClick } = useLCARSSound();

  // Render a loading state or null if contexts are not yet available
  if (!settings || !soundSettings) {
    return <div className='settings-panel'>LOADING SETTINGS...</div>;
  }

  const { isStardateEnabled, setIsStardateEnabled } = settings;
  const { soundEnabled, toggleSound } = soundSettings;

  const handleStardateToggle = () => {
    setIsStardateEnabled(!isStardateEnabled);
    playClick();
  };

  const handleSoundToggle = () => {
    toggleSound();
    // Play sound on enable, but not on disable
    if (!soundEnabled) {
      new Audio('/sounds/button-1.mp3').play();
    }
  };

  return (
    <div className='settings-panel'>
      <h2 className='lcars-header-text'>SYSTEM SETTINGS</h2>

      {/* Stardate Toggle */}
      <div className='setting-item'>
        <div className='setting-label'>
          <span className='label-text'>USE STARDATES</span>
          <span className='label-desc'>
            Toggle between standard Earth dates and TNG-era Stardates for all
            date displays.
          </span>
        </div>
        <div className='lcars-toggle' onClick={handleStardateToggle}>
          <div className={`toggle-switch ${isStardateEnabled ? 'on' : 'off'}`}>
            <div className='toggle-handle'></div>
          </div>
          <span className='toggle-label'>
            {isStardateEnabled ? 'ENGAGED' : 'DISABLED'}
          </span>
        </div>
      </div>

      {/* Sound Toggle */}
      <div className='setting-item'>
        <div className='setting-label'>
          <span className='label-text'>INTERFACE SOUNDS</span>
          <span className='label-desc'>
            Enable or disable auditory feedback for user interface interactions.
          </span>
        </div>
        <div className='lcars-toggle' onClick={handleSoundToggle}>
          <div className={`toggle-switch ${soundEnabled ? 'on' : 'off'}`}>
            <div className='toggle-handle'></div>
          </div>
          <span className='toggle-label'>
            {soundEnabled ? 'ENABLED' : 'MUTED'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Settings;
