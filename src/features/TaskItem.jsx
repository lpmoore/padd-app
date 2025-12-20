import React, { useState, useRef, useEffect } from 'react';
import { useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { ChevronRight, ChevronDown, GripVertical, Calendar, Trash2, CheckSquare, Square, FileText, Users, Image as ImageIcon, Check } from 'lucide-react';
import LCARSButton from '../components/LCARSButton';
import { formatDateForInput } from '../utils/dateUtils';

const TaskItem = ({ task, onDelete, onToggle, onAddSubtask, onUpdate, depth = 0, isShiftHeld, onOpenDossier }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.text);
  
  // Date Handling
  // We keep a local draft of the date string (YYYY-MM-DDTHH:mm)
  const initialDate = formatDateForInput(task.dueDate);
  const [draftDate, setDraftDate] = useState(initialDate);
  
  // Update local draft if task prop changes externally
  useEffect(() => {
      setDraftDate(formatDateForInput(task.dueDate));
  }, [task.dueDate]);

  const [subtaskDate, setSubtaskDate] = useState('');
  const [showSubInput, setShowSubInput] = useState(false);
  const [subtaskInput, setSubtaskInput] = useState('');

  const dateInputRef = useRef(null);
  const subDateInputRef = useRef(null);

  const openDatePicker = (ref) => {
    try {
      ref.current?.showPicker();
    } catch (e) {
      console.log('DatePicker error:', e);
    }
  };

  // Check for content
  const hasProtocol = task.details && task.details.trim().length > 0;
  const hasPersonnel = task.personnel && task.personnel.length > 0;
  const hasVisuals = task.images && task.images.length > 0;

  // Drag and Drop
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: task.id,
  });

  const setNodeRef = (node) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  let backgroundStyle = undefined;
  let borderStyle = undefined;

  if (isOver && !isDragging) {
      if (isShiftHeld) {
          backgroundStyle = 'rgba(255, 153, 0, 0.2)'; 
          borderStyle = '2px dashed var(--lcars-orange)';
      } else {
          backgroundStyle = 'rgba(89, 195, 234, 0.1)'; 
      }
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: backgroundStyle,
    border: borderStyle,
  };

  React.useEffect(() => {
    if (task.subtasks && task.subtasks.length > 0) {
      setIsExpanded(true);
    }
  }, [task.subtasks?.length]);

  const handleSave = () => {
    if (editValue.trim()) {
      onUpdate(task.id, { text: editValue });
    }
    setIsEditing(false);
  };

  const handleAddSub = () => {
    if (!subtaskInput.trim()) return;
    onAddSubtask(task.id, subtaskInput, subtaskDate); // subtaskDate is already draft format
    
    setSubtaskInput('');
    setSubtaskDate('');
    setShowSubInput(false);
    setIsExpanded(true);
  };

  // Date Change Handler: Just update local state
  const handleDateChange = (e) => {
      setDraftDate(e.target.value);
  };

  // Date Save Handler: Push to Database
  const saveDate = () => {
      onUpdate(task.id, { dueDate: draftDate });
  };

  // Determine if date is dirty
  // We compare draftDate against formatted initial prop
  const dateIsDirty = draftDate !== formatDateForInput(task.dueDate);

  return (
    <div style={style} className="task-wrapper">
      <div 
        ref={setNodeRef} 
        className={`task-item ${task.completed ? 'completed' : ''} ${isDragging ? 'dragging' : ''}`}
      >
        <div className="task-drag-handle" {...attributes} {...listeners}>
          <GripVertical size={20} color="var(--lcars-orange)" />
        </div>
        
        <div className="task-main-content">
          <div className="task-header">
             <button 
              className="expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{ visibility: (task.subtasks && task.subtasks.length > 0) ? 'visible' : 'hidden' }}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            <div className="task-checkbox" onClick={() => onToggle(task.id)}>
              {task.completed ? <CheckSquare size={20} color="var(--lcars-orange)" /> : <Square size={20} color="var(--lcars-blue)" />}
            </div>

            {isEditing ? (
              <input 
                className="lcars-edit-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
              />
            ) : (
              <span className="task-text" onDoubleClick={() => setIsEditing(true)}>
                {task.text}
              </span>
            )}
          </div>

          <div className="task-meta">
             <div className="date-picker-container" onClick={() => !dateIsDirty && openDatePicker(dateInputRef)}>
                <Calendar size={14} color="var(--lcars-tan)" />
                <input 
                  ref={dateInputRef}
                  type="datetime-local" 
                  className="lcars-date-input"
                  value={draftDate}
                  onChange={handleDateChange}
                />
                {dateIsDirty && (
                    <button 
                        className="icon-btn save-date-btn" 
                        onClick={(e) => { e.stopPropagation(); saveDate(); }}
                        title="Save Date"
                        style={{ padding: '0 4px', color: 'var(--lcars-orange)' }}
                    >
                        <Check size={16} />
                    </button>
                )}
             </div>
          </div>
        </div>

        <div className="task-actions">
           {/* Info Wrapper with Icons */}
           <div className="task-info-group">
               <div className="task-content-icons">
                   {hasProtocol && <FileText size={14} color="var(--lcars-tan)" title="Protocol" />}
                   {hasPersonnel && <Users size={14} color="var(--lcars-red)" title="Personnel" />}
                   {hasVisuals && <ImageIcon size={14} color="var(--lcars-blue)" title="Visuals" />}
               </div>
               <LCARSButton 
                onClick={() => onOpenDossier(task.id)}
                color="var(--lcars-tan)"
                scale={0.7}
                rounded="left"
               >
                 INFO
               </LCARSButton>
           </div>
           
           <LCARSButton 
            onClick={() => setShowSubInput(!showSubInput)}
            color="var(--lcars-blue)"
            scale={0.7}
            rounded="none"
           >
             +SUB
           </LCARSButton>
           <button className="icon-btn delete-btn" onClick={() => onDelete(task.id)}>
             <Trash2 size={18} color="var(--lcars-red)" />
           </button>
        </div>
      </div>

      {showSubInput && (
        <div className="subtask-input-area" style={{ marginLeft: '40px' }}>
          <div className="subtask-input-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                className="lcars-sub-input"
                style={{ flex: 1 }}
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                placeholder="NEW SUBTASK SPECIFICATION..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddSub()}
                autoFocus
              />
               <div className="date-picker-container" onClick={() => openDatePicker(subDateInputRef)}>
                    <Calendar size={14} color="var(--lcars-tan)" />
                    <input 
                      ref={subDateInputRef}
                      type="datetime-local" 
                      className="lcars-date-input"
                      value={subtaskDate}
                      onChange={(e) => setSubtaskDate(e.target.value)}
                    />
               </div>
               <LCARSButton onClick={handleAddSub} scale={0.6} color="var(--lcars-orange)" rounded="right">ADD</LCARSButton>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="subtasks-list">
          {task.subtasks && task.subtasks.length > 0 ? (
            <SortableContext 
                items={task.subtasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
            >
                {task.subtasks.map(subtask => (
                <TaskItem 
                    key={subtask.id}
                    task={subtask}
                    onDelete={onDelete}
                    onToggle={onToggle}
                    onAddSubtask={onAddSubtask}
                    onUpdate={onUpdate}
                    depth={depth + 1}
                    isShiftHeld={isShiftHeld}
                    onOpenDossier={onOpenDossier}
                />
                ))}
            </SortableContext>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default TaskItem;
