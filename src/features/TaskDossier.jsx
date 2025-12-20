import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import LCARSButton from '../components/LCARSButton';
import './TaskDossier.css';

const TaskDossier = ({ task, onClose, onUpdate }) => {
    const [activeTab, setActiveTab] = useState('PROTOCOL');
    
    // Local state for editing; save to parent on change/blur or close
    // We initialize from task props
    const [protocol, setProtocol] = useState(task.details || '');
    const [personnel, setPersonnel] = useState(task.personnel || []);
    const [images, setImages] = useState(task.images || []);
    
    const [activePerson, setActivePerson] = useState(null);
    const [activeImageIndex, setActiveImageIndex] = useState(null); // Lightbox state
    const personImageInputRef = React.useRef(null);

    // Use a ref for the hidden file input
    const fileInputRef = React.useRef(null);

    // Lightbox Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (activeImageIndex === null) return;

            if (e.key === 'Escape' || e.key === 'Enter') {
                setActiveImageIndex(null);
            } else if (e.key === 'ArrowLeft') {
                setActiveImageIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
            } else if (e.key === 'ArrowRight') {
                setActiveImageIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeImageIndex, images.length]);

    // Auto-save effect logic
    useEffect(() => {
        onUpdate(task.id, {
            details: protocol,
            personnel: personnel,
            images: images
        });
    }, [protocol, personnel, images]); 

    const handleAddPerson = () => {
        const newPerson = { 
            id: Date.now(), 
            name: '', 
            rank: '', 
            image: null, 
            stats: { birthplace: '', education: '', expertise: '', otherFacts: '' } 
        };
        setPersonnel([...personnel, newPerson]);
        setActivePerson(newPerson); // Open immediately
    };

    // Update the local state for the currently open person, AND the main list
    const updateActivePerson = (field, value) => {
        if (!activePerson) return;
        const updated = { ...activePerson, [field]: value };
        setActivePerson(updated);
        setPersonnel(personnel.map(p => p.id === activePerson.id ? updated : p));
    };

    const updateActivePersonStats = (statField, value) => {
        if (!activePerson) return;
        const updatedStats = { ...activePerson.stats, [statField]: value };
        const updated = { ...activePerson, stats: updatedStats };
        setActivePerson(updated);
        setPersonnel(personnel.map(p => p.id === activePerson.id ? updated : p));
    };

    const handleDeletePerson = (id) => {
        setPersonnel(personnel.filter(p => p.id !== id));
        setActivePerson(null);
    };

    // Use Base64 for personnel images for now (simpler migration)
    // Future: Migrate this to storage too
    const handlePersonImageSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onloadend = () => {
            updateActivePerson('image', reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(Array.from(e.target.files));
        }
    };

    const processFiles = async (files) => {
        const newImageUrls = [];

        for (const file of files) {
            // Validate File Type
            if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
                alert(`FORMAT NOT SUPPORTED: ${file.name}\n प्लीज USE: JPG, PNG, GIF, WEBP`);
                continue;
            }

            // Validate File Size (2MB Limit)
            if (file.size > 2 * 1024 * 1024) {
                alert(`FILE TOO LARGE: ${file.name}\nMAX SIZE: 2MB`);
                continue;
            }
            
            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${task.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('task-images')
                .upload(fileName, file);

            if (uploadError) {
                console.error('Error uploading image:', uploadError);
                alert(`FAILED TO UPLOAD: ${file.name}`);
                continue;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('task-images')
                .getPublicUrl(fileName);
            
            newImageUrls.push(publicUrl);
        }
        
        if (newImageUrls.length > 0) {
            setImages(prev => [...prev, ...newImageUrls]);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleAddImageClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="dossier-overlay" onClick={onClose}>
            <div className="dossier-panel" onClick={e => e.stopPropagation()}>
                <div className="dossier-header">
                    <div className="dossier-title">DOSSIER: {task.text.toUpperCase()}</div>
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
                                {personnel.map(p => (
                                    <div key={p.id} className="personnel-card" onClick={() => setActivePerson(p)}>
                                        <div 
                                            className="personnel-avatar-placeholder"
                                            style={p.image ? { backgroundImage: `url(${p.image})` } : {}}
                                        >
                                            {!p.image && <span style={{fontSize: '3rem'}}>?</span>}
                                        </div>
                                        <div className="personnel-card-info">
                                            <div className="personnel-name">{p.name || 'UNKNOWN'}</div>
                                            <div className="personnel-role">{p.rank || p.role || 'UNASSIGNED'}</div>
                                        </div>
                                    </div>
                                ))}
                                <div className="personnel-card personnel-add-card" onClick={handleAddPerson}>
                                    <span style={{fontSize: '2rem'}}>+</span>
                                    <span>ADD CREW</span>
                                </div>
                             </div>
                        </div>
                    )}

                    {activeTab === 'VISUALS' && (
                        <>
                            <div 
                                className="visuals-grid" 
                                onDragOver={handleDragOver} 
                                onDrop={handleDrop}
                                style={{ minHeight: '200px' }} // Ensure hit area is large enough
                            >
                                {images.map((img, idx) => (
                                    <div key={idx} className="visual-item" style={{ backgroundImage: `url(${img})` }} onClick={() => setActiveImageIndex(idx)}>
                                         <div 
                                            style={{ position: 'absolute', top: 0, right: 0, background: 'black', cursor: 'pointer', padding: '5px', zIndex: 5 }} 
                                            onClick={(e) => { e.stopPropagation(); setImages(images.filter((_, i) => i !== idx)); }}
                                        >
                                            X
                                        </div>
                                    </div>
                                ))}
                                <div className="visual-add-btn" onClick={handleAddImageClick}>
                                    <span>+ UPLOAD VISUAL</span>
                                    <span style={{fontSize:'0.6rem', marginTop:'5px', color:'var(--lcars-blue)'}}>JPG/PNG/GIF • MAX 2MB</span>
                                </div>
                            </div>
                            
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                style={{ display: 'none' }} 
                                accept="image/*" 
                                multiple
                                onChange={handleFileSelect}
                            />
                        </>
                    )}
                </div>

                {/* Personnel Detail Overlay (Bio-bed style) */}
                {activePerson && (
                    <div className="personnel-detail-overlay">
                        {/* ... existing personnel detail code ... */}
                        <div className="detail-bio-header">
                            <h3 style={{margin:0}}>PERSONNEL RECORD: {activePerson.name.toUpperCase() || 'NEW ENTRY'}</h3>
                            <div style={{display:'flex', gap:'10px'}}>
                                <LCARSButton onClick={() => handleDeletePerson(activePerson.id)} color="var(--lcars-red)">DELETE RECORD</LCARSButton>
                                <LCARSButton onClick={() => setActivePerson(null)} color="white">CLOSE</LCARSButton>
                            </div>
                        </div>
                        <div className="detail-bio-content">
                            <div className="bio-left">
                                <div 
                                    className="bio-image-preview" 
                                    onClick={() => personImageInputRef.current?.click()}
                                    style={activePerson.image ? { backgroundImage: `url(${activePerson.image})` } : {}}
                                >
                                    {!activePerson.image && <span>NO PHOTO</span>}
                                </div>
                                <input 
                                    type="file" 
                                    ref={personImageInputRef} 
                                    style={{display:'none'}} 
                                    accept="image/*"
                                    onChange={handlePersonImageSelect}
                                />
                                <div className="bio-input-group">
                                    <label className="bio-label">NAME</label>
                                    <input 
                                        className="bio-input" 
                                        value={activePerson.name} 
                                        onChange={(e) => updateActivePerson('name', e.target.value)}
                                        placeholder="Full Name"
                                    />
                                </div>
                                <div className="bio-input-group">
                                    <label className="bio-label">RANK / TITLE</label>
                                    <input 
                                        className="bio-input" 
                                        value={activePerson.rank} 
                                        onChange={(e) => updateActivePerson('rank', e.target.value)}
                                        placeholder="Lieutentant, etc."
                                    />
                                </div>
                            </div>
                            <div className="bio-right">
                                <div className="bio-input-group">
                                    <label className="bio-label">BIRTHPLACE / ORIGIN</label>
                                    <input 
                                        className="bio-input" 
                                        value={activePerson.stats?.birthplace || ''} 
                                        onChange={(e) => updateActivePersonStats('birthplace', e.target.value)}
                                    />
                                </div>
                                 <div className="bio-input-group">
                                    <label className="bio-label">EDUCATION / ACADEMY</label>
                                    <input 
                                        className="bio-input" 
                                        value={activePerson.stats?.education || ''} 
                                        onChange={(e) => updateActivePersonStats('education', e.target.value)}
                                    />
                                </div>
                                 <div className="bio-input-group">
                                    <label className="bio-label">EXPERTISE (Comma Seps)</label>
                                    <input 
                                        className="bio-input" 
                                        value={activePerson.stats?.expertise || ''} 
                                        onChange={(e) => updateActivePersonStats('expertise', e.target.value)}
                                    />
                                </div>
                                <div className="bio-input-group" style={{flex:1}}>
                                    <label className="bio-label">SERVICE RECORD / BIO / FACTS</label>
                                    <textarea 
                                        className="bio-textarea" 
                                        style={{height: '100%'}}
                                        value={activePerson.stats?.otherFacts || ''}
                                        onChange={(e) => updateActivePersonStats('otherFacts', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Lightbox Overlay */}
                {activeImageIndex !== null && (
                    <div className="lightbox-overlay" onClick={() => setActiveImageIndex(null)}>
                        <div className="lightbox-content" onClick={e => e.stopPropagation()}>
                            <button 
                                className="lightbox-nav-btn nav-prev" 
                                onClick={() => setActiveImageIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))}
                            >
                                &#9664;
                            </button>
                            
                            <img 
                                src={images[activeImageIndex]} 
                                className="lightbox-image" 
                                alt="Visual Log" 
                            />
                            
                            <button 
                                className="lightbox-nav-btn nav-next" 
                                onClick={() => setActiveImageIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))}
                            >
                                &#9654;
                            </button>
                            
                            <div className="lightbox-close-hint">
                                PRESS ESC OR ENTER TO CLOSE
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskDossier;
