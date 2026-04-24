import React, { useEffect, useState } from 'react';
import { supabase, supabaseConfigError } from './lib/supabase';

import Admin from './features/Admin'; // New Admin Feature
import Auth from './features/Auth';
import Calendar from './features/Calendar';
import LCARSButton from './components/LCARSButton';
import LCARSLayout from './components/LCARSLayout';
import Library from './features/Library';
import Log from './features/Log';
import TaskDossier from './features/TaskDossier';
import Tasks from './features/Tasks';
import { formatDateForStorage } from './utils/dateUtils';

const INITIAL_NAV_ITEMS = [
  { id: 'CALENDAR', label: 'CALENDAR', color: 'var(--lcars-teal)' },
  { id: 'TASKS', label: 'TASKS', color: 'var(--lcars-cyan)' },
  { id: 'LIBRARY', label: 'LIBRARY', color: 'var(--lcars-periwinkle)' },
  { id: 'LOG', label: 'LOG', color: 'var(--lcars-ice-blue)' },
  { id: 'ADMIN', label: 'ADMIN', color: 'var(--lcars-orange)' },
];

function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('CALENDAR');
  const [navItems, setNavItems] = useState(INITIAL_NAV_ITEMS);

  // Auth Session Management
  useEffect(() => {
    if (!supabase) return;

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
    if (!supabase || !session) return;

    fetchTasks();

    const channel = supabase
      .channel('tasks_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          fetchTasks();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const fetchTasks = async () => {
    if (!supabase || !session) return;

    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_personnel(personnel_id)')
      .eq('user_id', session.user.id)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
    } else {
      setTasks(buildTaskTree(data));
    }
  };

  const buildTaskTree = (flatTasks) => {
    const taskMap = {};
    const rootTasks = [];

    flatTasks.forEach((t) => {
      taskMap[t.id] = {
        ...t,
        dueDate: t.due_date,
        // Map foreign key join to local property expected by TaskItem
        personnel: t.task_personnel || [],
        subtasks: [],
      };
    });

    flatTasks.forEach((t) => {
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
  const [activeDossierTab, setActiveDossierTab] = useState('PROTOCOL');

  const handleOpenDossier = (id, tab = 'PROTOCOL') => {
    setActiveDossierTaskId(id);
    setActiveDossierTab(tab);
  };

  const handleNavClick = async (id) => {
    setActiveTab(id);
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  // CRUD Operations
  const addTask = async (text, parentId = null, dueDate = null) => {
    if (!supabase || !session) return;

    const insertPayload = {
      user_id: session.user.id,
      text,
      parent_id: parentId,
    };
    if (dueDate) insertPayload.due_date = formatDateForStorage(dueDate);

    const { data, error } = await supabase.from('tasks').insert(insertPayload);
    if (error) console.error('Error adding task:', error);
    else fetchTasks();
  };

  const updateTask = async (id, updates) => {
    if (!supabase) return;

    const dbUpdates = {};
    if (updates.text !== undefined) dbUpdates.text = updates.text;
    if (updates.completed !== undefined)
      dbUpdates.completed = updates.completed;

    if (updates.dueDate !== undefined) {
      dbUpdates.due_date = formatDateForStorage(updates.dueDate);
    }

    if (updates.details !== undefined) dbUpdates.details = updates.details;
    // Personnel update logic might move to TaskDossier entirely, but basic struct update remains
    if (updates.personnel !== undefined)
      dbUpdates.personnel = updates.personnel;
    if (updates.images !== undefined) dbUpdates.images = updates.images;

    const { error } = await supabase
      .from('tasks')
      .update(dbUpdates)
      .eq('id', id);
    if (error) console.error('Error updating task:', error);
    else fetchTasks();
  };

  const deleteTask = async (id) => {
    if (!supabase) return;

    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) console.error('Error deleting task:', error);
    else fetchTasks();
  };

  const moveTask = async (id, newParentId) => {
    if (!supabase) return;

    const { error } = await supabase
      .from('tasks')
      .update({ parent_id: newParentId })
      .eq('id', id);
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

  const activeDossierTask = activeDossierTaskId
    ? findTask(activeDossierTaskId, tasks)
    : null;

  if (supabaseConfigError) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'black',
          color: 'var(--lcars-orange)',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '680px',
            border: '3px solid var(--lcars-orange)',
            borderRadius: '20px',
            padding: '24px',
            fontSize: '1.1rem',
            lineHeight: 1.4,
          }}
        >
          <h2 style={{ marginTop: 0, color: 'var(--lcars-orange)' }}>
            CONFIGURATION REQUIRED
          </h2>
          <p style={{ marginBottom: 0 }}>{supabaseConfigError}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <LCARSLayout
      title='PADD 4755'
      activeTab={activeTab}
      navItems={navItems}
      onNavClick={handleNavClick}
      onLogout={handleLogout}
    >
      <div style={{ padding: '20px' }}>
        {activeTab === 'TASKS' && (
          <Tasks
            tasks={tasks}
            onAddTask={addTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            onMoveTask={moveTask}
            onOpenDossier={handleOpenDossier}
          />
        )}
        {activeTab === 'ADMIN' && <Admin />}
        {activeTab === 'CALENDAR' && (
          <Calendar tasks={tasks} onOpenDossier={handleOpenDossier} />
        )}
        {activeTab === 'LOG' && <Log />}
        {activeTab === 'LIBRARY' && <Library />}

        {activeDossierTask && (
          <TaskDossier
            task={activeDossierTask}
            initialTab={activeDossierTab}
            onClose={() => setActiveDossierTaskId(null)}
            // We still pass onUpdate, but Personnel handling will change inside Dossier.
            onUpdate={updateTask}
          />
        )}
      </div>
    </LCARSLayout>
  );
}

export default App;
