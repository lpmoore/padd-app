import React, { useState, useEffect } from 'react';
import LCARSButton from '../components/LCARSButton';
import './Tasks.css';

const Tasks = () => {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('padd-tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    localStorage.setItem('padd-tasks', JSON.stringify(tasks));
  }, [tasks]);

  const handleAdd = () => {
    if (!inputValue.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: inputValue, completed: false }]);
    setInputValue('');
  };

  const handleDelete = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const toggleComplete = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  return (
    <div className="tasks-container">
      <h2 className="lcars-header">TASK LOG</h2>
      
      <div className="tasks-input-area">
        <input 
          className="lcars-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="ENTER TASK SPECIFICATION..."
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <LCARSButton onClick={handleAdd} rounded="right" color="var(--lcars-orange)">
          ENGAGE
        </LCARSButton>
      </div>

      <div className="tasks-list">
        {tasks.map(task => (
          <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
            <div className="task-content" onClick={() => toggleComplete(task.id)}>
              <span className="task-marker">{task.completed ? '■' : '□'}</span>
              {task.text}
            </div>
            <LCARSButton 
              onClick={() => handleDelete(task.id)} 
              color="var(--lcars-red)" 
              rounded="both"
              className="delete-btn"
            >
              X
            </LCARSButton>
          </div>
        ))}
        {tasks.length === 0 && <p className="no-tasks">NO ACTIVE TASKS RECORDED.</p>}
      </div>
    </div>
  );
};

export default Tasks;
