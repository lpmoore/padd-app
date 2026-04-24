import './Tasks.css';

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import React, { useEffect, useState } from 'react';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import LCARSButton from '../components/LCARSButton';
import LCARSDatePicker from '../components/LCARSDatePicker'; // Custom Picker
import TaskItem from './TaskItem';
import { calculateStardate } from '../utils/stardate';
import useLCARSSound from '../hooks/useLCARSSound';
import { useSettings } from '../contexts/settingsContextValue';

/* 
   Fix: useDroppable must be used INSIDE DndContext.
   We extract a simple wrapper component for the root drop zone.
*/
const RootDroppable = ({ children }) => {
  const { setNodeRef } = useDroppable({ id: 'root-droppable' });
  return (
    <div className='tasks-scroll-area' ref={setNodeRef}>
      {children}
    </div>
  );
};

function formatStandardDate(dateString) {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString();
}

const INITIAL_TASKS = [
  {
    title: 'DIAGNOSTIC: WARP CORE',
    completed: false,
    date: null,
    subtasks: [],
  },
  { title: 'SENSOR CALIBRATION', completed: true, date: null, subtasks: [] },
  {
    title: 'WEEKLY STAFF MEETING',
    completed: false,
    date: new Date().toISOString(),
    subtasks: [
      { title: 'PREPARE REPORT', completed: false },
      { title: 'REVIEW LOGS', completed: false },
    ],
  },
  { title: 'RESUPPLY AT DS9', completed: false, date: null, subtasks: [] },
];

const Tasks = ({
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onMoveTask,
  onOpenDossier,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [inputDate, setInputDate] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [isShiftHeld, setIsShiftHeld] = useState(false);
  const [isNestingLocked, setIsNestingLocked] = useState(false);

  const isNestingActive = isShiftHeld || isNestingLocked;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Shift') setIsShiftHeld(true);
    };
    const handleKeyUp = (e) => {
      if (e.key === 'Shift') setIsShiftHeld(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const { playEngage, playError } = useLCARSSound();

  const { isStardateEnabled = false } = useSettings() || {};
  const aDate = inputDate ? formatStandardDate(inputDate) : null;

  const handleAdd = () => {
    if (!inputValue.trim()) {
      playError();
      return;
    }
    playEngage();
    // Call parent handler (Supabase)
    // Pass inputDate to root task creation
    onAddTask(inputValue, null, inputDate);
    setInputValue('');
    setInputDate('');
  };

  const handleAddSubtask = (parentId, text, dueDate) => {
    // Call parent handler (Supabase)
    onAddTask(text, parentId, dueDate);
  };

  const handleDelete = (id) => {
    onDeleteTask(id);
  };

  const handleToggle = (id) => {
    const findTask = (list) => {
      for (const t of list) {
        if (t.id === id) return t;
        if (t.subtasks) {
          const f = findTask(t.subtasks);
          if (f) return f;
        }
      }
      return null;
    };
    const task = findTask(tasks);
    if (task) {
      onUpdateTask(id, { completed: !task.completed });
    }
  };

  const handleUpdate = (id, updates) => {
    onUpdateTask(id, updates);
  };

  // Custom Seed Function for Demo
  const handleSeedTasks = () => {
    if (!confirm('INITIALIZE TASK PROTOCOLS WITH DEMO DATA?')) return;
    INITIAL_TASKS.forEach((t) => {
      onAddTask(t.title, null, t.date);
    });
  };

  // Drag and Drop (Simplified for Nesting Only)
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    if (over.id === 'root-droppable') {
      onMoveTask(active.id, null);
      return;
    }

    if (String(over.id).startsWith('placeholder-')) {
      const parentId = over.id.replace('placeholder-', '');
      onMoveTask(active.id, parentId);
      return;
    }

    if (isNestingActive) {
      // Nesting into the hovered task
      onMoveTask(active.id, over.id);
      return;
    }
  };

  const handleDragStart = () => {
    // No backup needed
  };

  const handleDragCancel = () => {
    // No backup needed
  };

  return (
    <div className='tasks-container'>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderBottom: '2px solid var(--lcars-orange)',
          marginBottom: '10px',
          paddingBottom: '5px',
        }}
      >
        <h2 style={{ margin: 0, color: 'var(--lcars-orange)' }}>TASK LOG</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span>
            {isStardateEnabled && aDate
              ? calculateStardate(new Date(aDate))
              : aDate
                ? formatStandardDate(aDate)
                : 'NO DATE SET'}
          </span>
          <span
            style={{
              color: 'var(--lcars-tan)',
              fontSize: '0.8rem',
              display: 'none',
            }}
          >
            HOLD SHIFT TO NEST
          </span>
          <button
            onClick={() => setIsNestingLocked(!isNestingLocked)}
            style={{
              background: isNestingActive
                ? 'var(--lcars-orange)'
                : 'rgba(255, 153, 0, 0.2)',
              border: '1px solid var(--lcars-orange)',
              color: isNestingActive ? 'black' : 'var(--lcars-orange)',
              padding: '2px 10px',
              borderRadius: '10px',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            NEST MODE: {isNestingActive ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className='tasks-input-area'>
        <input
          className='lcars-input'
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder='ENTER MAIN TASK SPECIFICATION...'
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />

        <div style={{ marginLeft: '10px' }}>
          <LCARSDatePicker
            value={inputDate}
            onChange={(e) => setInputDate(e.target.value)}
            label='SET DATE'
          />
        </div>

        <LCARSButton
          onClick={handleAdd}
          rounded='right'
          color='var(--lcars-orange)'
          sound={false} // Handle sound manually for success/failure
        >
          ENGAGE
        </LCARSButton>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className='tasks-scroll-area'>
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={isNestingActive ? undefined : verticalListSortingStrategy}
          >
            <div className='tasks-list'>
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                  onAddSubtask={handleAddSubtask}
                  onUpdate={handleUpdate}
                  isShiftHeld={isNestingActive}
                  onOpenDossier={onOpenDossier}
                />
              ))}
              {tasks.length === 0 && (
                <div className='no-tasks'>
                  <p>NO ACTIVE TASKS RECORDED.</p>
                  <LCARSButton
                    onClick={handleSeedTasks}
                    color='var(--lcars-tan)'
                    tiny
                  >
                    INITIALIZE DEMO PROTOCOLS
                  </LCARSButton>
                </div>
              )}
            </div>
          </SortableContext>

          {/* Root droppable zone for un-nesting */}
          <UnNestDropZone />
        </div>
      </DndContext>
    </div>
  );
};

// Drop zone for un-nesting tasks back to root level
const UnNestDropZone = () => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'root-droppable',
  });

  return (
    <div ref={setNodeRef} className={`root-drop-zone ${isOver ? 'over' : ''}`}>
      DROP HERE TO MAKE PARENT TASK
    </div>
  );
};

export default Tasks;
