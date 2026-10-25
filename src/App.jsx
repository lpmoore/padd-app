import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { removeImagesByUrl } from './lib/storage';

const INITIAL_NAV_ITEMS = [
  { id: 'CALENDAR', label: 'CALENDAR', color: 'var(--lcars-teal)' },
  { id: 'TASKS', label: 'TASKS', color: 'var(--lcars-cyan)' },
  { id: 'LIBRARY', label: 'LIBRARY', color: 'var(--lcars-periwinkle)' },
  { id: 'LOG', label: 'LOG', color: 'var(--lcars-ice-blue)' },
  { id: 'ADMIN', label: 'ADMIN', color: 'var(--lcars-orange)' },
];

const OWN_WRITE_TTL_MS = 5000;
const REALTIME_REFETCH_DELAY_MS = 150;

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

function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('CALENDAR');

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
  const userId = session?.user.id;

  // Writes made by this tab refetch directly, so their realtime echoes are
  // skipped; only changes from other tabs/devices refetch via realtime.
  const knownTaskIds = useRef(new Set());
  const ownWrites = useRef(new Map()); // task id -> expiry timer
  const markOwnWrite = (id) => {
    // Re-marking resets the timer so an older expiry can't clear a newer write
    clearTimeout(ownWrites.current.get(id));
    // Expire in case the echo never arrives (e.g. realtime disabled)
    const timer = setTimeout(() => ownWrites.current.delete(id), OWN_WRITE_TTL_MS);
    ownWrites.current.set(id, timer);
  };
  // Returns true (and forgets the mark) if this change is our own write's echo
  const consumeOwnWrite = (id) => {
    if (!ownWrites.current.has(id)) return false;
    clearTimeout(ownWrites.current.get(id));
    ownWrites.current.delete(id);
    return true;
  };

  const fetchTasks = useCallback(async () => {
    if (!supabase || !userId) return;

    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_personnel(personnel_id)')
      .eq('user_id', userId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
    } else {
      knownTaskIds.current = new Set(data.map((t) => t.id));
      setTasks(buildTaskTree(data));
    }
  }, [userId]);

  useEffect(() => {
    if (!supabase || !userId) return;

    fetchTasks();

    // Coalesce bursts (e.g. cascade-deleted subtasks) into one refetch
    let refetchTimer;
    const handleRemoteChange = (id) => {
      if (consumeOwnWrite(id)) return;
      clearTimeout(refetchTimer);
      refetchTimer = setTimeout(fetchTasks, REALTIME_REFETCH_DELAY_MS);
    };

    const channel = supabase
      .channel('tasks_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => handleRemoteChange(payload.new?.id ?? payload.old?.id),
      )
      // Supabase Realtime can't filter DELETE events, so listen to them
      // separately and ignore deletes of tasks that aren't in our list.
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tasks' },
        (payload) => {
          const id = payload.old?.id;
          if (knownTaskIds.current.has(id)) handleRemoteChange(id);
        },
      )
      .subscribe();

    const pendingOwnWrites = ownWrites.current;
    return () => {
      clearTimeout(refetchTimer);
      pendingOwnWrites.forEach((timer) => clearTimeout(timer));
      pendingOwnWrites.clear();
      supabase.removeChannel(channel);
    };
  }, [userId, fetchTasks]);

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

    // Client-generated id so the realtime echo of this insert can be recognised
    const id = crypto.randomUUID();
    markOwnWrite(id);
    const insertPayload = {
      id,
      user_id: session.user.id,
      text,
      parent_id: parentId,
    };
    if (dueDate) insertPayload.due_date = formatDateForStorage(dueDate);

    const { error } = await supabase.from('tasks').insert(insertPayload);
    if (error) console.error('Error adding task:', error);
    else fetchTasks();
  };

  // Resolves to true on success so callers (e.g. Dossier autosave) can retry on failure
  const updateTask = async (id, updates) => {
    if (!supabase) return false;

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

    markOwnWrite(id);
    const { error } = await supabase
      .from('tasks')
      .update(dbUpdates)
      .eq('id', id);
    if (error) {
      console.error('Error updating task:', error);
      return false;
    }
    fetchTasks();
    return true;
  };

  const deleteTask = async (id) => {
    if (!supabase) return;

    // Subtasks are cascade-deleted by the database, so their echoes (and images) are ours too
    const images = [];
    const markTree = (task) => {
      markOwnWrite(task.id);
      images.push(...(task.images || []));
      task.subtasks?.forEach(markTree);
    };
    markTree(findTask(id, tasks) ?? { id });
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      console.error('Error deleting task:', error);
    } else {
      fetchTasks();
      removeImagesByUrl(images);
    }
  };

  const moveTask = async (id, newParentId) => {
    if (!supabase) return;

    markOwnWrite(id);
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
      navItems={INITIAL_NAV_ITEMS}
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
            key={activeDossierTask.id}
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
