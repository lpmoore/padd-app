import React, { useState, useEffect, useRef, useCallback, useEffectEvent } from 'react';
import { supabase } from '../lib/supabase';
import { alertUploadErrors, imagesNoLongerUsed, removeImagesByUrl, uploadImages } from '../lib/storage';
import LCARSButton from '../components/LCARSButton';
import './TaskDossier.css';
import { formatDateForDisplay } from '../utils/dateUtils';
import { useStardateEnabled } from '../contexts/settingsContextValue';
import { StoredBackground, StoredImg } from '../components/StoredImage';

const AUTOSAVE_DELAY_MS = 700;

const TaskDossier = ({ task, onClose, onUpdate, initialTab = 'PROTOCOL' }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const isStardateEnabled = useStardateEnabled();
    
    // Core Task Data
    const [protocol, setProtocol] = useState(task.details || '');
    const [images, setImages] = useState(task.images || []);
    
    // Personnel Data (Assignments)
    const [assignedPersonnel, setAssignedPersonnel] = useState([]); // List of person objects
    const [allPersonnel, setAllPersonnel] = useState([]); // For selection modal
    const [isAssigning, setIsAssigning] = useState(false); // Modal state

    const [activePerson, setActivePerson] = useState(null); // Viewing details
    const [activeImageIndex, setActiveImageIndex] = useState(null);
    const fileInputRef = useRef(null);

    const fetchAssignedPersonnel = useCallback(async () => {
        // Join task_personnel -> personnel
        const { data, error } = await supabase
            .from('task_personnel')
            .select(`
                personnel_id,
                personnel:personnel_id (*) 
            `)
            .eq('task_id', task.id);
        
        if (error) {
            console.error("Error fetching assignments:", error);
        } else {
            // Flatten the structure
            const assignments = data.map(item => item.personnel);
            // Sort client-side because Supabase sorting on joined relations is complex
            assignments.sort((a, b) => a.name.localeCompare(b.name));
            setAssignedPersonnel(assignments);
        }
    }, [task.id]);

    // Initial Fetch
    useEffect(() => {
        fetchAssignedPersonnel();
    }, [fetchAssignedPersonnel]);

    // Auto-save PROTOCOL & IMAGES only (Personnel is managed via join table)
    // Debounced so typing doesn't write (and refetch every task) on each keystroke.
    // App renders the dossier with key={task.id}, so task.id is fixed for this instance.
    const lastSaved = useRef({ details: protocol, images });
    const pendingSave = useRef(null); // Unsaved changes (kept until a save succeeds)

    const save = useEffectEvent(async (changes) => {
        const ok = await onUpdate(task.id, changes);
        if (ok) {
            // Images can't be re-added once removed, so files the saved task no longer references can go
            removeImagesByUrl(imagesNoLongerUsed(lastSaved.current.images, changes.images));
            lastSaved.current = changes;
            if (pendingSave.current === changes) pendingSave.current = null;
        }
    });

    useEffect(() => {
        if (protocol === lastSaved.current.details && images === lastSaved.current.images) {
            // Edited back to the saved state: nothing left to save
            pendingSave.current = null;
            return;
        }
        const changes = { details: protocol, images };
        pendingSave.current = changes;
        const timer = setTimeout(() => save(changes), AUTOSAVE_DELAY_MS);
        return () => clearTimeout(timer);
    }, [protocol, images]);

    // Flush unsaved (or previously failed) edits when the dossier closes
    const isOpen = useRef(false);
    useEffect(() => {
        isOpen.current = true;
        return () => {
            isOpen.current = false;
            if (pendingSave.current) save(pendingSave.current);
        };
    }, []);

    // Personnel Assignment Logic
    const openAssignmentModal = async () => {
        setIsAssigning(true);
        // Fetch all available personnel
        const { data } = await supabase.from('personnel').select('*').order('name', { ascending: true });
        setAllPersonnel(data || []);
    };

    const toggleAssignment = async (personId, isCurrentlyAssigned) => {
        if (isCurrentlyAssigned) {
            // Remove assignment
            await supabase
                .from('task_personnel')
                .delete()
                .eq('task_id', task.id)
                .eq('personnel_id', personId);
        } else {
            // Add assignment
            await supabase
                .from('task_personnel')
                .insert({ task_id: task.id, personnel_id: personId });
        }
        // Refresh local list
        fetchAssignedPersonnel();
    };


    // Image Handling (Existing Logic)
    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(Array.from(e.target.files));
        }
    };

    const processFiles = async (files) => {
        const { urls: newImageUrls, errors } = await uploadImages(files, `tasks/${task.id}`);
        if (!isOpen.current) {
            // Closed while uploading; these files will never be saved to the task
            removeImagesByUrl(newImageUrls);
            return;
        }
        alertUploadErrors(errors);
        if (newImageUrls.length > 0) {
            setImages(prev => [...prev, ...newImageUrls]);
        }
    };

    const handleAddImageClick = () => {
        fileInputRef.current?.click();
    };

    // Keyboard Nav (Lightbox)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (activeImageIndex === null) return;
            if (e.key === 'Escape' || e.key === 'Enter') setActiveImageIndex(null);
            else if (e.key === 'ArrowLeft') setActiveImageIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
            else if (e.key === 'ArrowRight') setActiveImageIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeImageIndex, images.length]);

    return (
        <div className="dossier-overlay" onClick={onClose}>
            <div className="dossier-panel" onClick={e => e.stopPropagation()}>
                <div className="dossier-header">
                    <div>
                        <div className="dossier-title">DOSSIER: {task.text.toUpperCase()}</div>
                        <div className="dossier-due">
                            DUE: {task.dueDate ? formatDateForDisplay(task.dueDate, isStardateEnabled).toUpperCase() : 'NO DATE SET'}
                        </div>
                    </div>
                    <button className="dossier-close-btn" onClick={onClose}>CLOSE FILE</button>
                </div>

                <div className="dossier-tabs">
                    <button 
                        className={`dossier-tab-btn ${activeTab === 'PROTOCOL' ? 'active' : ''}`}
                        onClick={() => setActiveTab('PROTOCOL')}
                    >
                        PROTOCOL
                    </button>
                    <button 
                         className={`dossier-tab-btn ${activeTab === 'PERSONNEL' ? 'active' : ''}`}
                        onClick={() => setActiveTab('PERSONNEL')}
                    >
                        PERSONNEL
                    </button>
                    <button 
                         className={`dossier-tab-btn ${activeTab === 'VISUALS' ? 'active' : ''}`}
                        onClick={() => setActiveTab('VISUALS')}
                    >
                        VISUALS
                    </button>
                </div>

                <div className="dossier-content">
                    {activeTab === 'PROTOCOL' && (
                        <textarea
                            className="protocol-editor"
                            placeholder="ENTER MISSION PROTOCOLS, STEPS, AND REQUIREMENTS..."
                            value={protocol}
                            onChange={(e) => setProtocol(e.target.value)}
                        />
                    )}

                    {activeTab === 'PERSONNEL' && (
                        <div className="personnel-container">
                             {/* Personnel Grid */}
                             <div className="personnel-grid">
                                {assignedPersonnel.map(p => (
                                    <div key={p.id} className="personnel-card" onClick={() => setActivePerson(p)}>
                                        <StoredBackground 
                                            className="personnel-avatar-placeholder"
                                            value={p.image_url}
                                        >
                                            {!p.image_url && <span style={{fontSize: '3rem'}}>?</span>}
                                        </StoredBackground>
                                        <div className="personnel-card-info">
                                            <div className="personnel-name">{p.name || 'UNKNOWN'}</div>
                                            <div className="personnel-role">{p.rank || 'UNASSIGNED'}</div>
                                        </div>
                                    </div>
                                ))}
                                <div className="personnel-card personnel-add-card" onClick={openAssignmentModal}>
                                    <span style={{fontSize: '2rem'}}>+</span>
                                    <span>ASSIGN CREW</span>
                                </div>
                             </div>
                        </div>
                    )}

                    {activeTab === 'VISUALS' && (
                        <>
                            <div className="visuals-grid">
                                {images.map((img, idx) => (
                                    <StoredBackground key={idx} className="visual-item" value={img} onClick={() => setActiveImageIndex(idx)}>
                                         <div 
                                            style={{ position: 'absolute', top: 0, right: 0, background: 'black', cursor: 'pointer', padding: '5px', zIndex: 5 }} 
                                            onClick={(e) => { e.stopPropagation(); setImages(images.filter((_, i) => i !== idx)); }}
                                        >
                                            X
                                        </div>
                                    </StoredBackground>
                                ))}
                                <div className="visual-add-btn" onClick={handleAddImageClick}>
                                    <span>+ UPLOAD VISUAL</span>
                                </div>
                            </div>
                            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" multiple onChange={handleFileSelect} />
                        </>
                    )}
                </div>

                {/* READ ONLY Personnel Modal */}
                 {activePerson && (
                    <div className="personnel-detail-overlay" onClick={() => setActivePerson(null)}>
                        <div className="detail-bio-content" style={{maxWidth:'1100px', width: '90%', margin:'auto', background:'black', border:'2px solid var(--lcars-orange)', padding:'30px', borderRadius:'20px'}} onClick={e => e.stopPropagation()}>
                             <h3 style={{color:'var(--lcars-orange)',  marginTop:0, fontSize: '2.5rem'}}>{activePerson.name}</h3>
                             <p style={{color:'var(--lcars-blue)', fontSize: '1.8rem'}}>{activePerson.rank}</p>
                             <hr style={{borderColor:'var(--lcars-tan)'}}/>
                             <div style={{display:'flex', gap:'30px', marginTop:'20px', alignItems: 'flex-start'}}>
                                <StoredBackground value={activePerson.image_url} style={{
                                    width:'300px', 
                                    height:'400px', 
                                    background:'#111', 
                                    backgroundSize:'contain', 
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    border: '1px solid var(--lcars-blue)',
                                    flexShrink: 0
                                }} />
                                <div style={{
                                    flex:1, 
                                    color:'var(--lcars-tan)', 
                                    fontSize: '1.4rem', 
                                    lineHeight: '1.6', 
                                    maxHeight: '400px', 
                                    overflowY: 'auto',
                                    paddingRight: '10px'
                                }}>
                                    <p><strong>BIRTHPLACE:</strong> {activePerson.birthplace}</p>
                                    <p><strong>EDUCATION:</strong> {activePerson.education}</p>
                                    <p><strong>EXPERTISE:</strong> {activePerson.expertise}</p>
                                    <p><strong>BIO:</strong> {activePerson.bio}</p>
                                </div>
                             </div>
                             <div style={{marginTop:'20px', textAlign:'right'}}>
                                 <LCARSButton onClick={() => setActivePerson(null)} color="var(--lcars-orange)" className="close-record-btn">CLOSE RECORD</LCARSButton>
                             </div>
                        </div>
                    </div>
                )}

                {/* Assignment Selector Modal */}
                {isAssigning && (
                    <div className="personnel-detail-overlay" onClick={() => setIsAssigning(false)}>
                         <div className="detail-bio-content" style={{maxWidth:'600px', width: '90%', maxHeight:'80vh', overflowY:'auto', margin:'auto', background:'black', border:'2px solid var(--lcars-blue)', padding:'20px', borderRadius:'20px'}} onClick={e => e.stopPropagation()}>
                             <h3 style={{color:'var(--lcars-blue)', marginTop:0}}>ASSIGN PERSONNEL</h3>
                             <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                                 {allPersonnel.length === 0 && <p>NO PERSONNEL IN DATABASE. ADD VIA ADMIN.</p>}
                                 {allPersonnel.map(person => {
                                     const isAssigned = assignedPersonnel.some(p => p.id === person.id);
                                     return (
                                         <div key={person.id} className="assignment-row" style={{display:'flex', alignItems:'center', gap:'15px', padding:'10px', background:'rgba(255,255,255,0.05)', fontSize: '1.2rem'}}>
                                             <input 
                                                type="checkbox" 
                                                checked={isAssigned}
                                                onChange={() => toggleAssignment(person.id, isAssigned)}
                                                style={{width:'25px', height:'25px', flexShrink: 0, cursor: 'pointer'}}
                                             />
                                             {/* Thumbnail */}
                                             <StoredBackground value={person.image_url} style={{
                                                 width: '50px', 
                                                 height: '50px', 
                                                 background: '#222', 
                                                 backgroundSize: 'cover', 
                                                 backgroundPosition: 'center',
                                                 border: '1px solid var(--lcars-tan)',
                                                 flexShrink: 0
                                             }} />

                                             <div style={{fontWeight:'bold', color: isAssigned ? 'var(--lcars-orange)' : 'var(--lcars-gray)', flex: 1}}>
                                                 {person.name} <span style={{fontWeight:'normal', fontSize:'0.8em', color: 'var(--lcars-blue)'}}>({person.rank})</span>
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                             <div style={{marginTop:'20px', textAlign:'right'}}>
                                 <LCARSButton onClick={() => setIsAssigning(false)} color="var(--lcars-blue)">DONE</LCARSButton>
                             </div>
                         </div>
                    </div>
                )}

                {/* Lightbox Reuse */}
                 {activeImageIndex !== null && (
                    <div className="lightbox-overlay" onClick={() => setActiveImageIndex(null)}>
                        <div className="lightbox-content" onClick={e => e.stopPropagation()}>
                             <StoredImg value={images[activeImageIndex]} className="lightbox-image" alt="Visual" />
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default TaskDossier;
