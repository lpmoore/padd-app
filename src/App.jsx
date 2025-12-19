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

import TaskDossier from './features/TaskDossier';

function App() {
  const [activeTab, setActiveTab] = useState('TASKS');
  const [navItems, setNavItems] = useState(INITIAL_NAV_ITEMS);

  // Lifted State for Tasks
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('padd-tasks-v2');
    return saved ? JSON.parse(saved) : []; 
  });

  // Dossier State
  const [activeDossierTaskId, setActiveDossierTaskId] = useState(null);

  React.useEffect(() => {
    localStorage.setItem('padd-tasks-v2', JSON.stringify(tasks));
  }, [tasks]);

  const handleNavClick = (id) => {
    setActiveTab(id);
    setNavItems(prevItems => {
      const activeItem = prevItems.find(item => item.id === id);
      const otherItems = prevItems.filter(item => item.id !== id);
      return [activeItem, ...otherItems];
    });
  };

  // Helper to update a single task (deep update)
  const updateTask = (id, updates) => {
      const updateRecursively = (list) => {
      return list.map(t => {
        if (t.id === id) {
          return { ...t, ...updates };
        }
        if (t.subtasks && t.subtasks.length > 0) {
            return { ...t, subtasks: updateRecursively(t.subtasks) };
        }
        return t;
      });
    };
    setTasks(updateRecursively(tasks));
  };
  
  // Helper to find a task object by ID
  const findTask = (id, list) => {
      for (const t of list) {
          if (t.id === id) return t;
          if (t.subtasks) {
              const f = findTask(id, t.subtasks);
              if (f) return f;
          }
      }
      return null;
  };

  const activeDossierTask = activeDossierTaskId ? findTask(activeDossierTaskId, tasks) : null;

  return (
    <LCARSLayout 
      title="PADD 4755"
      activeTab={activeTab}
      navItems={navItems}
      onNavClick={handleNavClick}
    >
      <div style={{ padding: '20px' }}>
        
        {activeTab === 'TASKS' && (
            <Tasks 
                tasks={tasks} 
                setTasks={setTasks} 
                onOpenDossier={setActiveDossierTaskId} 
            />
        )}
        {activeTab === 'CALENDAR' && (
            <Calendar 
                tasks={tasks} 
                onOpenDossier={setActiveDossierTaskId}
            />
        )}
        {activeTab === 'NOTES' && <Notes />}
        {activeTab === 'LIBRARY' && <Library />}
        
        {/* Render Dossier Modal if active */}
        {activeDossierTask && (
            <TaskDossier 
                task={activeDossierTask}
                onClose={() => setActiveDossierTaskId(null)}
                onUpdate={updateTask}
            />
        )}

      </div>
    </LCARSLayout>
  );
}

export default App;
