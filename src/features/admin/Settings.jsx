import React from 'react';
import LCARSButton from '../../components/LCARSButton';
import { useSoundSettings } from '../../contexts/SoundContext';
import './PersonnelManager.css'; // Reuse basic admin styles for now

const Settings = () => {
    const { soundEnabled, toggleSound } = useSoundSettings();

    return (
        <div className="admin-panel lcars-panel">
            <h2 className="admin-panel-title">SYSTEM PREFERENCES</h2>
            
            <div className="personnel-controls" style={{marginTop: '20px'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start'}}>
                    <div style={{color: 'var(--lcars-tan)', fontSize: '1.2rem', fontWeight: 'bold'}}>
                        UI AUDIO FEEDBACK
                    </div>
                    <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
                        <LCARSButton 
                            onClick={toggleSound} 
                            color={soundEnabled ? 'var(--lcars-orange)' : 'var(--lcars-red)'}
                        >
                            {soundEnabled ? 'DISABLE AUDIO' : 'ENABLE AUDIO'}
                        </LCARSButton>
                        <span style={{color: soundEnabled ? 'var(--lcars-blue)' : 'var(--lcars-gray)'}}>
                            STATUS: {soundEnabled ? 'ACTIVE' : 'MUTED'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
