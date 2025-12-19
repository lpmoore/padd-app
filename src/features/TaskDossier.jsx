import React, { useState, useEffect } from 'react';
import LCARSButton from '../components/LCARSButton';
import './TaskDossier.css';

const TaskDossier = ({ task, onClose, onUpdate }) => {
    const [activeTab, setActiveTab] = useState('PROTOCOL');
    
    // Local state for editing; save to parent on change/blur or close
    // We initialize from task props
    const [protocol, setProtocol] = useState(task.details || '');
    const [personnel, setPersonnel] = useState(task.personnel || []);
    const [images, setImages] = useState(task.images || []);
    
    // Helper state for image URL input
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [tempUrl, setTempUrl] = useState('');

    // Auto-save effect or explicit save? 
    // Let's do auto-save on unmount or specific actions to keep it snappy
    // For now, simpler: Update parent object whenever local state changes
    useEffect(() => {
        onUpdate(task.id, {
            details: protocol,
            personnel: personnel,
            images: images
        });
    }, [protocol, personnel, images]); // Warning: this might be too frequent. Debounce in real app.

    const handleAddPerson = () => {
        setPersonnel([...personnel, { id: Date.now(), name: '', role: '' }]);
    };

    const updatePerson = (id, field, value) => {
        setPersonnel(personnel.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const removePerson = (id) => {
        setPersonnel(personnel.filter(p => p.id !== id));
    };

    const handleAddImage = () => {
        if (tempUrl) {
            setImages([...images, tempUrl]);
            setTempUrl('');
            setShowUrlInput(false);
        }
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
                            <div className="personnel-list">
                                {personnel.map(p => (
                                    <div key={p.id} className="personnel-item">
                                        <input 
                                            className="personnel-input" 
                                            placeholder="NAME / RANK"
                                            value={p.name}
                                            onChange={(e) => updatePerson(p.id, 'name', e.target.value)}
                                        />
                                        <input 
                                            className="personnel-role-input" 
                                            placeholder="ROLE"
                                            value={p.role}
                                            onChange={(e) => updatePerson(p.id, 'role', e.target.value)}
                                        />
                                        <LCARSButton onClick={() => removePerson(p.id)} color="var(--lcars-red)" scale={0.5}>X</LCARSButton>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '20px' }}>
                                <LCARSButton onClick={handleAddPerson} color="var(--lcars-ice-blue)" rounded="both">ADD PERSONNEL</LCARSButton>
                            </div>
                        </div>
                    )}

                    {activeTab === 'VISUALS' && (
                        <>
                            <div className="visuals-grid">
                                {images.map((img, idx) => (
                                    <div key={idx} className="visual-item" style={{ backgroundImage: `url(${img})` }}>
                                         <div style={{ position: 'absolute', top: 0, right: 0, background: 'black', cursor: 'pointer' }} onClick={() => setImages(images.filter((_, i) => i !== idx))}>X</div>
                                    </div>
                                ))}
                                <div className="visual-add-btn" onClick={() => setShowUrlInput(true)}>
                                    <span>+ ADD VISUAL</span>
                                </div>
                            </div>
                            
                            {/* Simple URL Input Modal for MVP */}
                            {showUrlInput && (
                                <div className="url-input-modal">
                                    <h4 style={{ color: 'var(--lcars-red)', margin: 0 }}>ENTER IMAGE URL</h4>
                                    <input 
                                        style={{ background: '#333', color: 'white', border: 'none', padding: '10px', width: '300px' }}
                                        value={tempUrl}
                                        onChange={(e) => setTempUrl(e.target.value)}
                                        placeholder="https://..."
                                    />
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                        <LCARSButton onClick={handleAddImage} color="var(--lcars-orange)">ADD</LCARSButton>
                                        <LCARSButton onClick={() => setShowUrlInput(false)} color="var(--lcars-gray)">CANCEL</LCARSButton>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskDossier;
