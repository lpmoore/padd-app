import React, { useState } from 'react';
import LCARSButton from '../components/LCARSButton';
import PersonnelManager from './admin/PersonnelManager';
import Security from './admin/Security';

const Admin = () => {
    // Basic Tab switching for future admin tools
    const [subTab, setSubTab] = useState('PERSONNEL');

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
                display: 'flex', 
                gap: '10px', 
                marginBottom: '10px',
                borderBottom: '2px solid var(--lcars-tan)',
                paddingBottom: '10px'
            }}>
                <button 
                    onClick={() => setSubTab('PERSONNEL')}
                    style={{
                        background: subTab === 'PERSONNEL' ? 'var(--lcars-tan)' : 'var(--lcars-bg)',
                        color: subTab === 'PERSONNEL' ? 'black' : 'var(--lcars-tan)',
                        border: '1px solid var(--lcars-tan)',
                        padding: '5px 15px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontFamily: 'var(--font-main)',
                        borderRadius: '10px 10px 0 0'
                    }}
                >
                    PERSONNEL
                </button>
                <button 
                    onClick={() => setSubTab('SECURITY')}
                    style={{
                        background: subTab === 'SECURITY' ? 'var(--lcars-tan)' : 'var(--lcars-bg)',
                        color: subTab === 'SECURITY' ? 'black' : 'var(--lcars-tan)',
                        border: '1px solid var(--lcars-tan)',
                        padding: '5px 15px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontFamily: 'var(--font-main)',
                        borderRadius: '10px 10px 0 0'
                    }}
                >
                    SECURITY
                </button>
            </div>
            
            {subTab === 'PERSONNEL' && <PersonnelManager />}
            {subTab === 'SECURITY' && <Security />}
        </div>
    );
};

export default Admin;
