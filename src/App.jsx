import React, { useState } from 'react';
import LCARSLayout from './components/LCARSLayout';
import LCARSButton from './components/LCARSButton';
import Tasks from './features/Tasks';
import Calendar from './features/Calendar';
import Notes from './features/Notes';
import Library from './features/Library';

const INITIAL_NAV_ITEMS = [
  { id: 'TASKS', label: 'TASKS', color: 'var(--lcars-cyan)' }, // Primary Light Blue
  { id: 'CALENDAR', label: 'CALENDAR', color: 'var(--lcars-teal)' }, // Teal
  { id: 'NOTES', label: 'NOTES', color: 'var(--lcars-ice-blue)' }, // Ice Blue
  { id: 'LIBRARY', label: 'LIBRARY', color: 'var(--lcars-periwinkle)' }, // Periwinkle
];

function App() {
  const [activeTab, setActiveTab] = useState('TASKS');
  const [navItems, setNavItems] = useState(INITIAL_NAV_ITEMS);

  // Lifted State for Tasks
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('padd-tasks-v2');
    return saved ? JSON.parse(saved) : []; 
  });

  React.useEffect(() => {
    localStorage.setItem('padd-tasks-v2', JSON.stringify(tasks));
  }, [tasks]);

  const handleNavClick = (id) => {
    setActiveTab(id);
    
    // Reorder items: move active item to the top (index 0)
    // This creates the slide-to-top effect when rendered
    setNavItems(prevItems => {
      const activeItem = prevItems.find(item => item.id === id);
      const otherItems = prevItems.filter(item => item.id !== id);
      return [activeItem, ...otherItems];
    });
  };

  return (
    <LCARSLayout 
      title="PADD 4755"
      activeTab={activeTab}
      navItems={navItems}
      onNavClick={handleNavClick}
    >
      <div style={{ padding: '20px' }}>
        
        {/* Helper text if needed, or remove completely */}
        {/* <h2>SYSTEM READY.</h2> */}
        
        {activeTab === 'TASKS' && <Tasks tasks={tasks} setTasks={setTasks} />}
        {activeTab === 'CALENDAR' && <Calendar tasks={tasks} />}
        {activeTab === 'NOTES' && <Notes />}
        {activeTab === 'LIBRARY' && <Library />}
        
        {/* Old buttons removed - now in sidebar */}

      </div>
    </LCARSLayout>
  );
}

export default App;
