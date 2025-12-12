import React, { useState, useEffect } from 'react';
import LCARSButton from '../components/LCARSButton';
import './Notes.css';

const Notes = () => {
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('padd-notes');
    return saved ? JSON.parse(saved) : [{ id: 1, title: 'CAPTAIN\'S LOG', content: 'Stardate 4755. The crew is performing admirably...' }];
  });
  const [activeNoteId, setActiveNoteId] = useState(notes[0]?.id || null);

  useEffect(() => {
    localStorage.setItem('padd-notes', JSON.stringify(notes));
  }, [notes]);

  const activeNote = notes.find(n => n.id === activeNoteId);

  const handleNewNote = () => {
    const newNote = {
      id: Date.now(),
      title: 'NEW ENTRY',
      content: ''
    };
    setNotes([newNote, ...notes]);
    setActiveNoteId(newNote.id);
  };

  const updateActiveNote = (field, value) => {
    setNotes(notes.map(n => n.id === activeNoteId ? { ...n, [field]: value } : n));
  };

  const deleteNote = (e, id) => {
    e.stopPropagation();
    const newNotes = notes.filter(n => n.id !== id);
    setNotes(newNotes);
    if (activeNoteId === id) {
        setActiveNoteId(newNotes[0]?.id || null);
    }
  };

  return (
    <div className="notes-container">
      {/* Sidebar List */}
      <div className="notes-sidebar">
        <div className="notes-controls">
           <LCARSButton onClick={handleNewNote} color="var(--lcars-tan)" rounded="left" block>
             NEW ENTRY
           </LCARSButton>
        </div>
        <div className="notes-list">
          {notes.map(note => (
            <div 
              key={note.id} 
              className={`note-item ${note.id === activeNoteId ? 'active' : ''}`}
              onClick={() => setActiveNoteId(note.id)}
            >
              <div className="note-title">{note.title}</div>
              <div className="note-delete" onClick={(e) => deleteNote(e, note.id)}>Top X</div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className="notes-editor">
        {activeNote ? (
          <>
            <input 
              className="note-title-input"
              value={activeNote.title}
              onChange={(e) => updateActiveNote('title', e.target.value.toUpperCase())}
              placeholder="TITLE"
            />
            <textarea
              className="note-content-input"
              value={activeNote.content}
              onChange={(e) => updateActiveNote('content', e.target.value)}
              placeholder="Start typing..."
            />
          </>
        ) : (
          <div className="no-note-selected">SELECT OR CREATE A LOG ENTRY</div>
        )}
      </div>
    </div>
  );
};

export default Notes;
