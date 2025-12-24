import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import LCARSButton from './LCARSButton';
import './LCARSDatePicker.css';

/**
 * Custom LCARS Date Picker
 * Replaces native input to allow custom styling and explicit "ENGAGE" button.
 * 
 * Props:
 * - value: string (YYYY-MM-DDTHH:mm) - Local time string
 * - onChange: function(newValue) - Called when ENGAGE is clicked
 * - label: string - Placeholder text (default: "SELECT DATE")
 */
const LCARSDatePicker = ({ value, onChange, label = "SELECT DATE" }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Internal state for the popup (draft selection)
    // We parse the value prop into Date parts for the calendar
    const [draftDate, setDraftDate] = useState(new Date());
    const [draftTime, setDraftTime] = useState({ hours: '12', minutes: '00' });
    
    // Initialize internal state when opening or when value changes
    useEffect(() => {
        if (value) {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                setDraftDate(d);
                setDraftTime({
                    hours: String(d.getHours()).padStart(2, '0'),
                    minutes: String(d.getMinutes()).padStart(2, '0')
                });
            }
        }
    }, [value, isOpen]);

    // Calendar Navigation State
    const [viewDate, setViewDate] = useState(new Date()); // For browsing months

    useEffect(() => {
        if (isOpen) {
            // Sync view with current draft selection
            setViewDate(new Date(draftDate));
        }
    }, [isOpen]);

    const handleDayClick = (day) => {
        const newDate = new Date(draftDate);
        newDate.setFullYear(viewDate.getFullYear());
        newDate.setMonth(viewDate.getMonth());
        newDate.setDate(day);
        setDraftDate(newDate);
    };

    const handleMonthChange = (delta) => {
        const newView = new Date(viewDate);
        newView.setMonth(newView.getMonth() + delta);
        setViewDate(newView);
    };

    const handleTimeChange = (field, val) => {
        // Validate numbers
        let num = parseInt(val, 10);
        if (isNaN(num)) num = 0;
        
        if (field === 'hours') {
            num = Math.max(0, Math.min(23, num));
        } else {
            num = Math.max(0, Math.min(59, num));
        }
        
        setDraftTime(prev => ({
            ...prev,
            [field]: String(num).padStart(2, '0')
        }));
    };

    const handleEngage = () => {
        // Construct final local ISO string
        const finalDate = new Date(draftDate);
        finalDate.setHours(parseInt(draftTime.hours, 10));
        finalDate.setMinutes(parseInt(draftTime.minutes, 10));
        
        // Format: YYYY-MM-DDTHH:mm
        const pad = n => String(n).padStart(2, '0');
        const isoLocal = `${finalDate.getFullYear()}-${pad(finalDate.getMonth()+1)}-${pad(finalDate.getDate())}T${pad(finalDate.getHours())}:${pad(finalDate.getMinutes())}`;
        
        onChange({ target: { value: isoLocal } }); // Mock event object for compatibility
        setIsOpen(false);
    };

    // Calendar Generation Logic
    const getDaysInMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };
    
    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const renderCalendarGrid = () => {
        const daysInMonth = getDaysInMonth(viewDate);
        const startDay = getFirstDayOfMonth(viewDate);
        const grid = [];

        // Empty slots
        for (let i = 0; i < startDay; i++) {
            grid.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const isSelected = 
                draftDate.getDate() === d && 
                draftDate.getMonth() === viewDate.getMonth() &&
                draftDate.getFullYear() === viewDate.getFullYear();
            
            const isToday = 
                new Date().getDate() === d &&
                new Date().getMonth() === viewDate.getMonth() &&
                new Date().getFullYear() === viewDate.getFullYear();

            grid.push(
                <div 
                    key={d} 
                    className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => handleDayClick(d)}
                >
                    {d}
                </div>
            );
        }
        return grid;
    };

    // Format display text
    const displayValue = value ? new Date(value).toLocaleString([], { 
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    }) : label;

    return (
        <div className="lcars-date-picker-wrapper">
            {/* Trigger Button */}
            <div 
                className={`lcars-date-display ${value ? 'has-date' : ''}`} 
                onClick={() => setIsOpen(true)}
            >
                <Calendar size={16} />
                <span>{displayValue}</span>
            </div>

            {/* Popup Modal */}
            {isOpen && (
                <div className="lcars-popup-overlay" onClick={() => setIsOpen(false)}>
                    <div className="lcars-calendar-panel" onClick={e => e.stopPropagation()}>
                        
                        {/* Header */}
                        <div className="lcars-calendar-header">
                            <button className="lcars-nav-btn" onClick={() => handleMonthChange(-1)}>
                                <ChevronLeft size={20} />
                            </button>
                            <span>
                                {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()}
                            </span>
                            <button className="lcars-nav-btn" onClick={() => handleMonthChange(1)}>
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Day Labels */}
                        <div className="lcars-calendar-grid">
                            {['S','M','T','W','T','F','S'].map((day, i) => (
                                <div key={i} className="day-label">{day}</div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="lcars-calendar-grid">
                            {renderCalendarGrid()}
                        </div>

                        {/* Time Picker */}
                        <div className="lcars-time-picker">
                            <Clock size={20} color="var(--lcars-ice-blue)" />
                            <input 
                                className="time-input" 
                                type="number" 
                                min="0" max="23" 
                                value={draftTime.hours}
                                onChange={(e) => handleTimeChange('hours', e.target.value)}
                                autoComplete="off"
                            />
                            <span style={{color: 'var(--lcars-cyan)', fontSize: '1.8rem', fontWeight: 'bold'}}>:</span>
                            <input 
                                className="time-input" 
                                type="number" 
                                min="0" max="59" 
                                value={draftTime.minutes}
                                onChange={(e) => handleTimeChange('minutes', e.target.value)}
                                autoComplete="off" 
                            />
                        </div>

                        {/* Footer Buttons */}
                        <div className="lcars-calendar-footer">
                            <LCARSButton 
                                color="var(--lcars-red)" 
                                onClick={() => setIsOpen(false)}
                                rounded="left"
                            >
                                CANCEL
                            </LCARSButton>
                            <LCARSButton 
                                color="var(--lcars-orange)" 
                                onClick={handleEngage}
                                rounded="right"
                            >
                                ENGAGE
                            </LCARSButton>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default LCARSDatePicker;
