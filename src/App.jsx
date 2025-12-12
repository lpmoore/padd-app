import React, { useState } from 'react';
import LCARSLayout from './components/LCARSLayout';
import LCARSButton from './components/LCARSButton';
import Tasks from './features/Tasks';
import Calendar from './features/Calendar';
import Notes from './features/Notes';
import Library from './features/Library';

function App() {
  const [activeTab, setActiveTab] = useState('MAIN');

  return (
    <LCARSLayout title="PADD 4755">
      <div style={{ padding: '20px' }}>
        
        {/* Navigation - Technically could be in the sidebar, but for now putting controls here for testing */}
        <h2>SYSTEM READY.</h2>
        <p>Current Mode: {activeTab}</p>

        {activeTab === 'TASKS' && <Tasks />}
        {activeTab === 'CALENDAR' && <Calendar />}
        {activeTab === 'NOTES' && <Notes />}
        {activeTab === 'LIBRARY' && <Library />}
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '50px' }}>
             <LCARSButton color="var(--lcars-blue)" rounded="both" onClick={() => setActiveTab('TASKS')}>
               TASKS
             </LCARSButton>
             <LCARSButton color="var(--lcars-purple)" rounded="both" onClick={() => setActiveTab('CALENDAR')}>
               CALENDAR
             </LCARSButton>
             <LCARSButton color="var(--lcars-red)" rounded="both" onClick={() => setActiveTab('NOTES')}>
               NOTES
             </LCARSButton>
             <LCARSButton color="var(--lcars-tan)" rounded="both" onClick={() => setActiveTab('LIBRARY')}>
               LIBRARY
             </LCARSButton>
        </div>

      </div>
    </LCARSLayout>
  );
}

export default App;
