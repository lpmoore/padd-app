import React, { useState, useEffect, useRef } from 'react';
import { 
  DndContext, 
  closestCenter,
  closestCorners,
  pointerWithin,
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  useDroppable
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import TaskItem from './TaskItem';
import LCARSButton from '../components/LCARSButton';
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

const Tasks = () => {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('padd-tasks-v2');
    return saved ? JSON.parse(saved) : []; 
  });
  const [inputValue, setInputValue] = useState('');
  const [inputDate, setInputDate] = useState('');
  const mainInputDateRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Track Shift key state globally
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

  useEffect(() => {
    localStorage.setItem('padd-tasks-v2', JSON.stringify(tasks));
  }, [tasks]);

  const handleAdd = () => {
    if (!inputValue.trim()) return;
    const newTask = { 
      id: `task-${Date.now()}`, 
      text: inputValue, 
      completed: false, 
      subtasks: [],
      dueDate: inputDate || ''
    };
    setTasks([...tasks, newTask]);
    setInputValue('');
    setInputDate('');
  };

  const handleAddSubtask = (parentId, text, dueDate) => {
    console.log('handleAddSubtask called with:', { parentId, text, dueDate });
    const newSub = { 
        id: `sub-${Date.now()}`, 
        text, 
        completed: false, 
        subtasks: [],
        dueDate: dueDate || '' 
    };

    const updateRecursively = (list) => {
      return list.map(t => {
        if (t.id === parentId) {
          return { ...t, subtasks: [...(t.subtasks || []), newSub] };
        }
        if (t.subtasks && t.subtasks.length > 0) {
          return { ...t, subtasks: updateRecursively(t.subtasks) };
        }
        return t;
      });
    };
    setTasks(updateRecursively(tasks));
  };

  const handleDelete = (id) => {
    const deleteRecursively = (list) => {
      return list.filter(t => t.id !== id).map(t => ({
          ...t,
          subtasks: deleteRecursively(t.subtasks || [])
      }));
    };
    setTasks(deleteRecursively(tasks));
  };

  const handleToggle = (id) => {
     const toggleRecursively = (list) => {
      return list.map(t => {
        if (t.id === id) {
          return { ...t, completed: !t.completed };
        }
        return { ...t, subtasks: toggleRecursively(t.subtasks || []) };
      });
    };
    setTasks(toggleRecursively(tasks));
  };

   const handleUpdate = (id, updates) => {
     const updateRecursively = (list) => {
      return list.map(t => {
        if (t.id === id) {
          return { ...t, ...updates };
        }
        return { ...t, subtasks: updateRecursively(t.subtasks || []) };
      });
    };
    setTasks(updateRecursively(tasks));
  };

  // Drag and Drop State Management
  const [dragBackup, setDragBackup] = useState(null);

  const handleDragStart = (event) => {
    // Save current state as backup in case drag fails
    setDragBackup([...tasks]);
    console.log('DragStart:', event.active.id);
  };

  const handleDragCancel = () => {
    // Restore from backup if drag was cancelled
    if (dragBackup) {
      console.log('DragCancel: Restoring state');
      setTasks(dragBackup);
      setDragBackup(null);
    }
  };

  /* 
    This part is complex, we need to handle:
    1. Reordering within same list (already done)
    2. Moving from one list (parent) to another (another parent or root)
    3. Preventing cycles (dragging parent into own child)
  */
  /* 
    Updated Complex Logic for Nested Drag and Drop
    Major Fix: `findContainer` needs to correctly identify the array containing the item, even deep in the tree.
  */
  const handleDragEnd = (event) => {
    const { active, over } = event;

    
    console.log('DragEnd:', { activeId: active?.id, overId: over?.id });

    if (!over) return;
    if (active.id === over.id) return;

    // Helper: Find the *Task Object* that ID belongs to
    const findTaskObject = (id, list) => {
        for (const t of list) {
            if (t.id === id) return t;
            if (t.subtasks) {
                const found = findTaskObject(id, t.subtasks);
                if (found) return found;
            }
        }
        return null;
    };

    // Helper: Is 'child' a descendant of 'possibleParent'?
    const isDescendant = (parent, childId) => {
        if (parent.id === childId) return true;
        if (parent.subtasks) {
            return parent.subtasks.some(sub => isDescendant(sub, childId));
        }
        return false;
    };

    // Helper: Find the *Array* that an ID belongs to
    const findContainerArray = (id, list) => {
        if (list.find(t => t.id === id)) return list;
        for (const t of list) {
            if (t.subtasks) {
                const found = findContainerArray(id, t.subtasks);
                if (found) return found;
            }
        }
        return null;
    };

    // SCENARIO 3: Dropping on Root Container (un-nesting)
    if (over.id === 'root-droppable') {
        console.log('Scenario 3: Root Drop');
        const movedTask = findTaskObject(active.id, tasks); 
        if (!movedTask) return;

        let newTasks = [...tasks];
        const removeRecursive = (list) => {
            return list.filter(t => t.id !== active.id).map(t => ({
                ...t,
                subtasks: removeRecursive(t.subtasks || [])
            }));
        };
        newTasks = removeRecursive(newTasks);
        
        // Add to end of root
        newTasks.push(movedTask);
        setTasks(newTasks);
        setDragBackup(null); // Clear backup on success
        return;
    }
    
    // SCENARIO 4: Dropping on a "Placeholder" (dropping into empty subtask list)
    if (String(over.id).startsWith('placeholder-')) {
        console.log('Scenario 4: Placeholder Drop');
        const parentId = over.id.replace('placeholder-', '');
        
        // Find the parent
        const findTaskRecursive = (id, list) => {
             for (const t of list) {
                 if (String(t.id) === String(id)) return t;
                 if (t.subtasks) {
                     const f = findTaskRecursive(id, t.subtasks);
                     if (f) return f;
                 }
             }
             return null;
        };
        const parentTask = findTaskRecursive(parentId, tasks);
        if (!parentTask) {
             console.error('Parent not found for placeholder', parentId);
             return; 
        }

        const activeTaskObj = findTaskObject(active.id, tasks);
        if (!activeTaskObj) return;

        let newTasks = [...tasks];
        
        // Remove active from old location
        const removeRecursive = (list) => {
            return list.filter(t => t.id !== active.id).map(t => ({
                ...t,
                subtasks: removeRecursive(t.subtasks || [])
            }));
        };
        newTasks = removeRecursive(newTasks);

        // Add to new parent's subtasks
        const addToParent = (list) => {
            return list.map(t => {
                if (String(t.id) === String(parentId)) {
                    return { ...t, subtasks: [...(t.subtasks || []), activeTaskObj] };
                }
                if (t.subtasks) {
                    return { ...t, subtasks: addToParent(t.subtasks) };
                }
                return t;
            });
        };
        setTasks(addToParent(newTasks));
        setDragBackup(null); // Clear backup on success
        return;
    }

    // SCENARIO 5: Nesting - Dropping onto a task to make it a child
    // This is the NEW scenario for automatic nesting
    const activeTask = findTaskObject(active.id, tasks);
    const overTask = findTaskObject(over.id, tasks);
    
    // Safety check
    if (!activeTask) {
        console.warn('Active task object not found');
        return;
    }

    if (!overTask) {
        console.warn('Over task object not found');
        return;
    }

    // Prevent dragging parent into its own child (cycle detection)
    if (isDescendant(activeTask, overTask.id)) {
        console.warn('Attempted cycle (parent into child)');
        setDragBackup(null); // Clear backup
        return;
    }

    const activeContainer = findContainerArray(active.id, tasks);
    const overContainer = findContainerArray(over.id, tasks);

    if (!activeContainer || !overContainer) {
         console.warn('Active or Over container not found');
         return;
    }
    
    // Use tracked Shift key state instead of activatorEvent
    const shiftHeld = isShiftHeld;
    
    // Check if both are at root level (for reordering)
    const bothAtRoot = activeContainer === tasks && overContainer === tasks;
    
    if (bothAtRoot && !shiftHeld) {
        // SCENARIO: Reordering parent tasks at root level
        console.log('Reordering parent tasks');
        const oldIndex = tasks.findIndex(t => t.id === active.id);
        const newIndex = tasks.findIndex(t => t.id === over.id);
        
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const reordered = arrayMove(tasks, oldIndex, newIndex);
            setTasks(reordered);
            setDragBackup(null);
        }
    } else if (activeContainer === overContainer && !shiftHeld) {
        // SCENARIO: Reordering within same subtask level
        console.log('Reordering subtasks');
        const oldIndex = activeContainer.findIndex(t => t.id === active.id);
        const newIndex = activeContainer.findIndex(t => t.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const newOrder = arrayMove(activeContainer, oldIndex, newIndex);
            
            // Find parent and update
            const updateRecursively = (list) => {
               return list.map(t => {
                   if (t.subtasks && t.subtasks.length > 0) {
                       const hasActiveId = t.subtasks.some(sub => sub.id === active.id);
                       if (hasActiveId) {
                           return { ...t, subtasks: newOrder };
                       }
                       return { ...t, subtasks: updateRecursively(t.subtasks) };
                   }
                   return t;
               });
           };
           setTasks(updateRecursively(tasks));
        }
        setDragBackup(null);
    } else {
        // SCENARIO: Nesting - Moving from one container to another OR Shift key held
        console.log('Nesting (making child of target)');

        // 1. Remove active task from old location
        let newTasks = [...tasks];

        const removeRecursive = (list) => {
            return list.filter(t => t.id !== active.id).map(t => ({
                ...t,
                subtasks: removeRecursive(t.subtasks || [])
            }));
        };
        newTasks = removeRecursive(newTasks);

        // 2. Add as child of the over task
        const addAsChild = (list) => {
            return list.map(t => {
                if (t.id === over.id) {
                    // Add to this task's subtasks
                    return { 
                        ...t, 
                        subtasks: [...(t.subtasks || []), activeTask] 
                    };
                }
                if (t.subtasks && t.subtasks.length > 0) {
                    return { ...t, subtasks: addAsChild(t.subtasks) };
                }
                return t;
            });
        };

        const updatedTasks = addAsChild(newTasks);
        console.log('Updated tasks after nesting:', JSON.stringify(updatedTasks, null, 2));
        setTasks(updatedTasks);
        setDragBackup(null);
    }
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
        <div className="lcars-date-wrapper" onClick={() => mainInputDateRef.current?.showPicker()}>
             <input 
              ref={mainInputDateRef}
              type="datetime-local"
              className="lcars-input-date-main"
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
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
