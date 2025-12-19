import React, { useState, useEffect } from 'react';
import './Calendar.css';

const Calendar = ({ tasks = [], onOpenDossier }) => {
    const [date, setDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null); 

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const year = date.getFullYear();
    const month = date.getMonth();
    const today = new Date();

    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
        "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
    ];

    const getTasksForDate = (y, m, d) => {
        const checkStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const allTasks = [];
        const traverse = (list) => {
            list.forEach(t => {
                if (t.dueDate && t.dueDate.startsWith(checkStr)) allTasks.push(t);
                if (t.subtasks) traverse(t.subtasks);
            });
        };
        traverse(tasks);
        return allTasks;
    };

    const handleDayClick = (day) => {
        const dayTasks = getTasksForDate(year, month, day);
        setSelectedDate({ day, tasks: dayTasks });
    };

    const closeDetail = () => setSelectedDate(null);

    const generateCalendar = () => {
        const days = [];
        const totalDays = daysInMonth(year, month);
        const startDay = firstDayOfMonth(year, month);

        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        for (let d = 1; d <= totalDays; d++) {
            const isToday = 
                d === today.getDate() && 
                month === today.getMonth() && 
                year === today.getFullYear();
            
            const dayTasks = getTasksForDate(year, month, d);
            const hasTasks = dayTasks.length > 0;

            days.push(
                <div key={d} className={`calendar-day ${isToday ? 'today' : ''} ${hasTasks ? 'has-tasks' : ''}`} onClick={() => handleDayClick(d)}>
                    <span className="day-number">{d}</span>
                    <div className="day-content">
                        {dayTasks.slice(0, 3).map((t, i) => (
                           <div key={i} className="task-marker" title={t.text}></div>
                        ))}
                        {dayTasks.length > 3 && <div className="task-marker-more">+</div>}
                    </div>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="calendar-container">
            <div className="calendar-header">
                <h2 className="lcars-header">STARDATE {year}.{(month + 1).toString().padStart(2, '0')}</h2>
                <div className="month-display">{monthNames[month]}</div>
            </div>
            
            <div className="calendar-grid">
                <div className="day-label">SUN</div>
                <div className="day-label">MON</div>
                <div className="day-label">TUE</div>
                <div className="day-label">WED</div>
                <div className="day-label">THU</div>
                <div className="day-label">FRI</div>
                <div className="day-label">SAT</div>
                {generateCalendar()}
            </div>

            {selectedDate && (
                <div className="calendar-overlay" onClick={closeDetail}>
                    <div className="calendar-detail-panel" onClick={e => e.stopPropagation()}>
                        <div className="detail-header">
                            <h3>STARDATE {year}.{(month + 1).toString().padStart(2, '0')}.{selectedDate.day}</h3>
                            <button className="close-btn" onClick={closeDetail}>X</button>
                        </div>
                        <div className="detail-content">
                            {selectedDate.tasks.length > 0 ? (
                                <ul className="detail-task-list">
                                    {selectedDate.tasks.map(task => (
                                        <li 
                                            key={task.id} 
                                            className="detail-task-item"
                                            onClick={() => {
                                                onOpenDossier(task.id);
                                                closeDetail(); // Close detail to show Dossier
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <span className="task-time">{task.dueDate ? task.dueDate.split('T')[1] : '--:--'}</span>
                                            <span className="task-text">{task.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="no-tasks-msg">NO TASKS SCHEDULED</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Calendar;
