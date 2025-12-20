import React, { useState } from 'react';
import LCARSButton from '../components/LCARSButton';
import PersonnelManager from './admin/PersonnelManager';

const Admin = () => {
    // Basic Tab switching for future admin tools
    const [subTab, setSubTab] = useState('PERSONNEL');

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* If we add more tools, we need a sub-nav here. currently just one tool. */}
            
            {subTab === 'PERSONNEL' && <PersonnelManager />}
        </div>
    );
};

export default Admin;
