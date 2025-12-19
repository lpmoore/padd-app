import React, { useState, useEffect } from 'react';
import LCARSButton from '../components/LCARSButton';
import './Notes.css';

const Notes = () => {
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('padd-notes');
    return saved ? JSON.parse(saved) : [{ id: 1, title: 'CAPTAIN\'S LOG', content: 'Stardate 4755. The crew is performing admirably...' }];
  });
  const [activeNoteId, setActiveNoteId] = useState(notes[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('EDIT'); // 'EDIT' | 'READ'
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matches, setMatches] = useState([]); // Array of match indices/ids for navigation

  // Reset view mode when changing notes
  useEffect(() => {
    setViewMode('EDIT');
    setMatches([]);
    setCurrentMatchIndex(0);
  }, [activeNoteId]);

  // When searching, switch to READ mode automatically if matches exist
  useEffect(() => {
    if (searchQuery) {
        setViewMode('READ');
    } else {
        setViewMode('EDIT');
    }
  }, [searchQuery]);

  // Search Logic
  const getMatchCount = (text, query) => {
    if (!query || !text) return 0;
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  };

  const filteredNotes = notes.map(note => {
     const titleMatches = getMatchCount(note.title, searchQuery);
     const contentMatches = getMatchCount(note.content, searchQuery);
     return { 
       ...note, 
       matchCount: titleMatches + contentMatches 
     };
  }).filter(note => {
      if (!searchQuery) return true;
      return note.matchCount > 0;
  });

  useEffect(() => {
    localStorage.setItem('padd-notes', JSON.stringify(notes));
  }, [notes]);

  const activeNote = notes.find(n => n.id === activeNoteId);
  // Ensure we can still see the active note even if it's filtered out? 
  // Standard behavior is probably to deselect if not in results, OR just show results.
  // For now, simple standard list.
  // Calculate total results found
  const totalResults = filteredNotes.length;
  
  // Determine if active note is in the search results
  // If search matches exist (filteredNotes > 0) AND the active note isn't one of them -> Dim it
  const isDimmed = searchQuery && filteredNotes.length > 0 && !filteredNotes.find(n => n.id === activeNoteId);

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
           <div className="search-wrapper">
               <input 
                  className="notes-search-input"
                  type="text"
                  placeholder="SEARCH LOGS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
               />
               {searchQuery && (
                   <div className="search-count-display">
                       {totalResults} FND
                   </div>
               )}
           </div>
           <LCARSButton onClick={handleNewNote} color="var(--lcars-tan)" rounded="left" block>
             NEW ENTRY
           </LCARSButton>
        </div>
        <div className="notes-list">
          {filteredNotes.map(note => (
            <div 
              key={note.id} 
              className={`note-item ${note.id === activeNoteId ? 'active' : ''}`}
              onClick={() => {
                  setActiveNoteId(note.id);
                  // Default to read mode if searching
                  if (searchQuery) setViewMode('READ');
              }}
            >
              <div className="note-item-header">
                  <div className="note-title">{note.title}</div>
                  {searchQuery && note.matchCount > 0 && (
                      <div className="note-match-count">{note.matchCount} MATCHES</div>
                  )}
              </div>
              <div className="note-delete" onClick={(e) => deleteNote(e, note.id)}>X</div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className={`notes-editor ${isDimmed ? 'dimmed' : ''}`}>
        {activeNote ? (
          <>
             <div className="note-editor-header">
                <input 
                  className="note-title-input"
                  value={activeNote.title}
                  onChange={(e) => updateActiveNote('title', e.target.value.toUpperCase())}
                  onFocus={(e) => {
                      if (e.target.value === 'NEW ENTRY') {
                          updateActiveNote('title', '');
                      }
                  }}
                  placeholder="TITLE"
                  disabled={viewMode === 'READ'}
                />
                
                 {/* Navigation & Mode Controls */}
                 <div className="note-editor-controls">
                    {searchQuery && (
                        <>
                             <div className="match-navigation">
                                <button 
                                    className="nav-btn"
                                    onClick={() => {
                                        setCurrentMatchIndex(prev => prev > 0 ? prev - 1 : matches.length - 1);
                                        // Scroll logic will be handled by HighlightView effect
                                    }}
                                >
                                    Scan Down
                                </button>
                                <span className="match-counter">{matches.length > 0 ? currentMatchIndex + 1 : 0} / {matches.length}</span>
                                <button 
                                    className="nav-btn"
                                    onClick={() => {
                                        setCurrentMatchIndex(prev => prev < matches.length - 1 ? prev + 1 : 0);
                                    }}
                                >
                                    Scan Up
                                </button>
                             </div>
                        </>
                    )}
                    
                    <button 
                        className="mode-toggle-btn"
                        onClick={() => setViewMode(viewMode === 'EDIT' ? 'READ' : 'EDIT')}
                    >
                        {viewMode === 'EDIT' ? 'VIEW LOG' : 'EDIT LOG'}
                    </button>
                 </div>
             </div>

            {viewMode === 'EDIT' ? (
                <textarea
                  className="note-content-input"
                  value={activeNote.content}
                  onChange={(e) => updateActiveNote('content', e.target.value)}
                  placeholder="Start typing..."
                />
            ) : (
                <HighlightView 
                    content={activeNote.content} 
                    query={searchQuery} 
                    currentMatchIndex={currentMatchIndex}
                    onMatchesFound={(foundMatches) => setMatches(foundMatches)}
                />
            )}
          </>
        ) : (
          <div className="no-note-selected">SELECT OR CREATE A LOG ENTRY</div>
        )}
      </div>
    </div>
  );
};

// Internal Component for Highlighting
const HighlightView = ({ content, query, currentMatchIndex, onMatchesFound }) => {
    // We need to parse certain things to find matches
    // But we also need to report back how many matches we found
    
    // Simple splitting approach
    if (!query) return <div className="note-content-read">{content}</div>;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = content.split(regex);
    
    // We need to track which "part" is a match to assign indices
    let matchCount = 0;

    // Effect to report matches count up - THIS IS TRICKY IN RENDER
    // Better: Calculate matches first
    const matches = content.match(regex) || [];
    
    useEffect(() => {
        onMatchesFound(matches);
    }, [matches.length, query]);

    // Scroll to active match
    useEffect(() => {
        const activeEl = document.getElementById(`match-${currentMatchIndex}`);
        if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentMatchIndex]);

    return (
        <div className="note-content-read">
            {parts.map((part, i) => {
                if (part.toLowerCase() === query.toLowerCase()) {
                    const isCurrent = matchCount === currentMatchIndex;
                    const id = `match-${matchCount}`;
                    matchCount++;
                    return (
                        <mark 
                            key={i} 
                            id={id}
                            className={`search-highlight ${isCurrent ? 'current' : ''}`}
                        >
                            {part}
                        </mark>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </div>
    );
};

export default Notes;
