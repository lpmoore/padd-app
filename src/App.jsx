import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Auth from './features/Auth';
import LCARSLayout from './components/LCARSLayout';
import LCARSButton from './components/LCARSButton';
import Tasks from './features/Tasks';
import Calendar from './features/Calendar';
import Notes from './features/Notes';
import Library from './features/Library';
import TaskDossier from './features/TaskDossier';
import { formatDateForStorage } from './utils/dateUtils';

const INITIAL_NAV_ITEMS = [
  { id: 'TASKS', label: 'TASKS', color: 'var(--lcars-cyan)' }, 
  { id: 'CALENDAR', label: 'CALENDAR', color: 'var(--lcars-teal)' }, 
  { id: 'NOTES', label: 'NOTES', color: 'var(--lcars-ice-blue)' }, 
  { id: 'LIBRARY', label: 'LIBRARY', color: 'var(--lcars-periwinkle)' }, 
  { id: 'LOGOUT', label: 'LOGOUT', color: 'var(--lcars-red)' }, // Added Logout
];

function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('TASKS');
  const [navItems, setNavItems] = useState(INITIAL_NAV_ITEMS);

  // Auth Session Management
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Data Fetching & Realtime Subscription
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    if (!session) return;

    fetchTasks();

    const channel = supabase
      .channel('tasks_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', session.user.id) // Security: Only fetch own tasks
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
    } else {
      setTasks(buildTaskTree(data));
    }
  };

  // Convert flat DB list (with parent_id) to nested tree
  const buildTaskTree = (flatTasks) => {
    const taskMap = {};
    const rootTasks = [];

    // 1. Initialize map
    flatTasks.forEach(t => {
      taskMap[t.id] = { 
          ...t, 
          // Map snake_case DB fields to camelCase UI props if needed
          dueDate: t.due_date, 
          subtasks: [] 
      };
    });

    // 2. Build tree
    flatTasks.forEach(t => {
      if (t.parent_id) {
        if (taskMap[t.parent_id]) {
            taskMap[t.parent_id].subtasks.push(taskMap[t.id]);
        }
      } else {
        rootTasks.push(taskMap[t.id]);
      }
    });

    return rootTasks;
  };

  const [activeDossierTaskId, setActiveDossierTaskId] = useState(null);

  const handleNavClick = async (id) => {
    if (id === 'LOGOUT') {
        await supabase.auth.signOut();
        return;
    }

    setActiveTab(id);
    // Removed reordering logic to keep sidebar buttons static
  };

  // CRUD Operations
  const addTask = async (text, parentId = null, dueDate = null) => {
      const insertPayload = {
          user_id: session.user.id,
          text,
          parent_id: parentId
      };
      // Convert Local Input String (YYYY-MM-DDTHH:mm) to UTC ISO String for Storage
      if (dueDate) insertPayload.due_date = formatDateForStorage(dueDate);

      const { data, error } = await supabase.from('tasks').insert(insertPayload);
      if (error) console.error('Error adding task:', error);
      else fetchTasks();
  };

  const updateTask = async (id, updates) => {
      const dbUpdates = {};
      // Map UI fields to DB fields
      if (updates.text !== undefined) dbUpdates.text = updates.text;
      if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
      
      // Convert Date
      if (updates.dueDate !== undefined) {
         dbUpdates.due_date = formatDateForStorage(updates.dueDate);
      }
      
      if (updates.details !== undefined) dbUpdates.details = updates.details;
      if (updates.personnel !== undefined) dbUpdates.personnel = updates.personnel;
      if (updates.images !== undefined) dbUpdates.images = updates.images;
      
      const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', id);
      if (error) console.error('Error updating task:', error);
      else fetchTasks();
  };

  const deleteTask = async (id) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) console.error('Error deleting task:', error);
      else fetchTasks();
  };

  const moveTask = async (id, newParentId) => {
      const { error } = await supabase.from('tasks').update({ parent_id: newParentId }).eq('id', id);
      if (error) console.error('Error moving task:', error);
      else fetchTasks();
  };
  
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

  if (!session) {
      return <Auth />;
  }

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
                onAddTask={addTask}
                onUpdateTask={updateTask}
                onDeleteTask={deleteTask}
                onMoveTask={moveTask}
                onOpenDossier={setActiveDossierTaskId} 
            />
        )}
        {activeTab === 'CALENDAR' && (
            <Calendar 
                tasks={tasks} 
                onOpenDossier={setActiveDossierTaskId}
                // Calendar might need update capabilities later
            />
        )}
        {activeTab === 'NOTES' && <Notes />}
        {activeTab === 'LIBRARY' && <Library />}
        
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
