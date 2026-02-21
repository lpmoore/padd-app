import React, { useState } from 'react';
import LCARSButton from '../components/LCARSButton';
import PersonnelManager from './admin/PersonnelManager';
import Security from './admin/Security';
import Settings from './admin/Settings';
import './Admin.css';

const Admin = () => {
    // Basic Tab switching for future admin tools
    const [subTab, setSubTab] = useState('PERSONNEL');

    return (
        <div className="admin-container">
            <div className="admin-tabs">
                <button 
                    className={`admin-tab-btn ${subTab === 'PERSONNEL' ? 'active' : ''}`}
                    onClick={() => setSubTab('PERSONNEL')}
                >
                    PERSONNEL
                </button>
                <button 
                    className={`admin-tab-btn ${subTab === 'SECURITY' ? 'active' : ''}`}
                    onClick={() => setSubTab('SECURITY')}
                >
                    SECURITY
                </button>
                <button 
                    className={`admin-tab-btn ${subTab === 'SETTINGS' ? 'active' : ''}`}
                    onClick={() => setSubTab('SETTINGS')}
                >
                    SETTINGS
                </button>
            </div>
            
            {subTab === 'PERSONNEL' && <PersonnelManager />}
            {subTab === 'SECURITY' && <Security />}
            {subTab === 'SETTINGS' && <Settings />}
        </div>
    );
};

export default Admin;
