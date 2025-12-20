import React, { useState, useEffect, useRef } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  useDroppable
} from '@dnd-kit/core';
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import TaskItem from './TaskItem';
import LCARSButton from '../components/LCARSButton';
import LCARSDatePicker from '../components/LCARSDatePicker'; // Custom Picker
import './Tasks.css';

/* 
   Fix: useDroppable must be used INSIDE DndContext.
   We extract a simple wrapper component for the root drop zone.
*/
const RootDroppable = ({ children }) => {
  const { setNodeRef } = useDroppable({ id: 'root-droppable' });
  return (
      <div className="tasks-scroll-area" ref={setNodeRef}>
          {children}
      </div>
  );
};

const Tasks = ({ tasks, onAddTask, onUpdateTask, onDeleteTask, onMoveTask, onOpenDossier }) => {
  const [inputValue, setInputValue] = useState('');
  const [inputDate, setInputDate] = useState('');
  const mainInputDateRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [isShiftHeld, setIsShiftHeld] = useState(false);

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

  const handleAdd = () => {
    if (!inputValue.trim()) return;
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

  // Drag and Drop (Simplified for Nesting Only)
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    let newParentId = undefined; 

    if (over.id === 'root-droppable') {
        onMoveTask(active.id, null);
        return;
    }

    if (String(over.id).startsWith('placeholder-')) {
        const parentId = over.id.replace('placeholder-', '');
        onMoveTask(active.id, parentId);
        return;
    }

    if (isShiftHeld) {
        // Nesting into the hovered task
        onMoveTask(active.id, over.id);
        return;
    }
  };

  const handleDragStart = (event) => {
    // No backup needed
  };

  const handleDragCancel = () => {
    // No backup needed
  };

  return (
    <div className="tasks-container">
      <h2 className="lcars-header">TASK LOG</h2>
      <p className="lcars-instruction" style={{ color: 'var(--lcars-tan)', fontSize: '0.8rem', textAlign: 'right', marginBottom: '10px', marginTop: '-5px' }}>
          HOLD SHIFT TO NEST TASKS
      </p>

      <div className="tasks-input-area">
        <input
          className="lcars-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="ENTER MAIN TASK SPECIFICATION..."
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        
        <div style={{ marginLeft: '10px' }}>
           <LCARSDatePicker 
             value={inputDate}
             onChange={(e) => setInputDate(e.target.value)}
             label="SET DATE"
           />
        </div>

        <LCARSButton onClick={handleAdd} rounded="right" color="var(--lcars-orange)">
          ENGAGE
        </LCARSButton>
      </div>

      <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter} 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
      >
        <div className="tasks-scroll-area">
            <SortableContext 
                items={tasks.map(t => t.id)} 
                strategy={verticalListSortingStrategy}
            >
                <div className="tasks-list">
                    {tasks.map(task => (
                        <TaskItem 
                            key={task.id} 
                            task={task} 
                            onDelete={handleDelete}
                            onToggle={handleToggle}
                            onAddSubtask={handleAddSubtask}
                            onUpdate={handleUpdate}
                            isShiftHeld={isShiftHeld}
                            onOpenDossier={onOpenDossier}
                        />
                    ))}
                    {tasks.length === 0 && <p className="no-tasks">NO ACTIVE TASKS RECORDED.</p>}
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
        <div 
            ref={setNodeRef} 
            className={`root-drop-zone ${isOver ? 'over' : ''}`}
        >
            DROP HERE TO MAKE PARENT TASK
        </div>
    );
};

export default Tasks;
