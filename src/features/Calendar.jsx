import React, { useState, useEffect } from 'react';
import './Calendar.css';

const Calendar = () => {
    const [date, setDate] = useState(new Date());

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const year = date.getFullYear();
    const month = date.getMonth();
    const today = new Date();

    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
        "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
    ];

    const generateCalendar = () => {
        const days = [];
        const totalDays = daysInMonth(year, month);
        const startDay = firstDayOfMonth(year, month);

        // Padding for empty days
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        // Days
        for (let d = 1; d <= totalDays; d++) {
            const isToday = 
                d === today.getDate() && 
                month === today.getMonth() && 
                year === today.getFullYear();
            
            days.push(
                <div key={d} className={`calendar-day ${isToday ? 'today' : ''}`}>
                    <span className="day-number">{d}</span>
                    <div className="day-content"></div>
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
        </div>
    );
};

export default Calendar;
