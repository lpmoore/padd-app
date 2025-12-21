import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import LCARSButton from '../../components/LCARSButton';
import './PersonnelManager.css';

const PersonnelManager = () => {
    const [personnel, setPersonnel] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editPerson, setEditPerson] = useState(null); // If set, editor modal is open
    const [viewPerson, setViewPerson] = useState(null); // If set, viewer modal is open
    const fileInputRef = useRef(null);

    // Initial Fetch
    useEffect(() => {
        fetchPersonnel();
    }, []);

    const fetchPersonnel = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('personnel')
            .select('*')
            .order('name');
        
        if (error) console.error('Error fetching personnel:', error);
        else setPersonnel(data);
        setLoading(false);
    };

    // Save (Create or Update)
    const handleSave = async (personData) => {
        const { id, ...dataToSave } = personData;
        dataToSave.user_id = (await supabase.auth.getUser()).data.user.id; // Ensure user_id attached

        let error;
        if (id) {
            // Update
            const { error: err } = await supabase
                .from('personnel')
                .update(dataToSave)
                .eq('id', id);
            error = err;
        } else {
            // Create
            const { error: err } = await supabase
                .from('personnel')
                .insert(dataToSave);
            error = err;
        }

        if (error) {
            alert('Error saving personnel record: ' + error.message);
        } else {
            fetchPersonnel();
            setEditPerson(null);
            if (id) {
                // If we were editing, maybe go back to view? Or just close?
                // For now, let's close everything or maybe update the viewPerson if we strictly want to return to view.
                // User requirement implies "clicking profile -> view -> edit". 
                // After save, usually nice to go back to list or view. Let's go back to null (list) as per existing behavior.
            }
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('DELETE PERSONNEL RECORD?')) return;
        
        const { error } = await supabase.from('personnel').delete().eq('id', id);
        if (error) alert('Error deleting: ' + error.message);
        else fetchPersonnel();
    };

    // --- Modal Logic ---
    const handleAddNew = () => {
        setViewPerson(null); // Ensure viewer is closed
        setEditPerson({
            name: '',
            rank: '',
            image_url: null,
            birthplace: '',
            education: '',
            expertise: '',
            bio: ''
        });
    };

    return (
        <div className="personnel-manager">
            <div className="pm-header">
                <h2 className="lcars-header">PERSONNEL MANAGEMENT</h2>
                <LCARSButton onClick={handleAddNew} color="var(--lcars-orange)">ADD NEW RECORD</LCARSButton>
            </div>

            <div className="pm-grid">
                {/* Add Card */}
                <div className="pm-card pm-add-card" onClick={handleAddNew}>
                    <span style={{ fontSize: '3rem' }}>+</span>
                    <span>NEW ENTRY</span>
                </div>

                {personnel.map(p => (
                    <div key={p.id} className="pm-card" onClick={() => setViewPerson(p)}>
                        <div 
                            className="pm-avatar"
                            style={p.image_url ? { backgroundImage: `url(${p.image_url})` } : {}}
                        >
                            {!p.image_url && <span>?</span>}
                        </div>
                        <div className="pm-info">
                            <div className="pm-name">{p.name || 'UNKNOWN'}</div>
                            <div className="pm-rank">{p.rank || 'UNASSIGNED'}</div>
                        </div>
                    </div>
                ))}
            </div>

            {loading && <div style={{marginTop: '20px'}}>PROCESSING...</div>}

            {/* Edit Modal (Bio-bed style reuse) */}
            {editPerson && (
                <PersonnelEditor 
                    person={editPerson} 
                    onSave={handleSave} 
                    onCancel={() => setEditPerson(null)}
                    onDelete={handleDelete}
                />
            )}

            {/* View Modal */}
            {viewPerson && !editPerson && (
                <PersonnelViewer
                    person={viewPerson}
                    onClose={() => setViewPerson(null)}
                    onEdit={() => {
                        setEditPerson(viewPerson);
                        setViewPerson(null);
                    }}
                />
            )}
        </div>
    );
};

// Sub-component for the Editor Modal
const PersonnelEditor = ({ person, onSave, onCancel, onDelete }) => {
    const [formData, setFormData] = useState({ ...person });
    const fileRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleImageSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `personnel/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        // Upload
        const { error: uploadError } = await supabase.storage
            .from('task-images') // Reuse bucket
            .upload(fileName, file);

        if (uploadError) {
            alert('Upload failed: ' + uploadError.message);
            setUploading(false);
            return;
        }

        // Get URL
        const { data: { publicUrl } } = supabase.storage
            .from('task-images')
            .getPublicUrl(fileName);

        handleChange('image_url', publicUrl);
        setUploading(false);
    };

    return (
        <div className="dossier-overlay" onClick={onCancel}>
            <div className="personnel-detail-overlay" onClick={e => e.stopPropagation()}>
                <div className="detail-bio-header">
                    <h3 style={{ margin: 0 }}>
                        {formData.id ? `EDIT RECORD: ${formData.name}` : 'NEW PERSONNEL FILE'}
                    </h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {formData.id && (
                             <LCARSButton onClick={() => { onDelete(formData.id); onCancel(); }} color="var(--lcars-red)">DELETE</LCARSButton>
                        )}
                         <LCARSButton onClick={onCancel} color="white">CANCEL</LCARSButton>
                        <LCARSButton onClick={() => onSave(formData)} color="var(--lcars-orange)">SAVE RECORD</LCARSButton>
                    </div>
                </div>

                <div className="detail-bio-content">
                    <div className="pm-form-grid" style={{ width: '100%' }}>
                        
                        {/* Left Column: Image & Basic Info */}
                        <div className="pm-form-left">
                            <div 
                                className="pm-image-upload"
                                style={formData.image_url ? { backgroundImage: `url(${formData.image_url})` } : {}}
                                onClick={() => fileRef.current?.click()}
                            >
                                {uploading ? 'UPLOADING...' : (!formData.image_url && 'UPLOAD PHOTO')}
                            </div>
                            <input 
                                type="file" 
                                ref={fileRef} 
                                style={{ display: 'none' }} 
                                accept="image/*"
                                onChange={handleImageSelect}
                            />

                            <div className="bio-input-group">
                                <label className="bio-label">NAME</label>
                                <input 
                                    className="bio-input" 
                                    value={formData.name} 
                                    onChange={e => handleChange('name', e.target.value)}
                                    placeholder="Full Name"
                                    autoFocus
                                />
                            </div>
                            <div className="bio-input-group">
                                <label className="bio-label">RANK / TITLE</label>
                                <input 
                                    className="bio-input" 
                                    value={formData.rank} 
                                    onChange={e => handleChange('rank', e.target.value)}
                                    placeholder="Rank"
                                />
                            </div>
                        </div>

                        {/* Right Column: Stats */}
                        <div className="pm-form-right">
                             <div className="bio-input-group">
                                <label className="bio-label">BIRTHPLACE / ORIGIN</label>
                                <input 
                                    className="bio-input" 
                                    value={formData.birthplace || ''} 
                                    onChange={e => handleChange('birthplace', e.target.value)}
                                />
                            </div>
                             <div className="bio-input-group">
                                <label className="bio-label">EDUCATION / ACADEMY</label>
                                <input 
                                    className="bio-input" 
                                    value={formData.education || ''} 
                                    onChange={e => handleChange('education', e.target.value)}
                                />
                            </div>
                             <div className="bio-input-group">
                                <label className="bio-label">EXPERTISE</label>
                                <input 
                                    className="bio-input" 
                                    value={formData.expertise || ''} 
                                    onChange={e => handleChange('expertise', e.target.value)}
                                />
                            </div>
                             <div className="bio-input-group" style={{ flex: 1 }}>
                                <label className="bio-label">SERVICE RECORD / BIO</label>
                                <textarea 
                                    className="bio-textarea" 
                                    style={{ height: '100%' }}
                                    value={formData.bio || ''} 
                                    onChange={e => handleChange('bio', e.target.value)}
                                />
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default PersonnelManager;

const PersonnelViewer = ({ person, onClose, onEdit }) => {
    return (
        <div className="dossier-overlay" onClick={onClose}>
            <div className="personnel-detail-overlay" onClick={e => e.stopPropagation()}>
                <div className="detail-bio-header">
                    <h3 style={{ margin: 0 }}>
                        PERSONNEL FILE: {person.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <LCARSButton onClick={onClose} color="white">CLOSE</LCARSButton>
                        <LCARSButton onClick={onEdit} color="var(--lcars-orange)">EDIT RECORD</LCARSButton>
                    </div>
                </div>

                <div className="detail-bio-content">
                    <div className="pm-form-grid" style={{ width: '100%' }}>
                        
                        {/* Left Column: Image & Basic Info */}
                        <div className="pm-form-left">
                            <div 
                                className="pm-image-upload"
                                style={{ 
                                    backgroundImage: person.image_url ? `url(${person.image_url})` : 'none',
                                    cursor: 'default',
                                    border: '2px solid var(--lcars-orange)'
                                }}
                            >
                                {!person.image_url && <span>NO IMAGE</span>}
                            </div>

                            <div className="bio-input-group">
                                <label className="bio-label">NAME</label>
                                <div className="bio-value">{person.name}</div>
                            </div>
                            <div className="bio-input-group">
                                <label className="bio-label">RANK / TITLE</label>
                                <div className="bio-value">{person.rank}</div>
                            </div>
                        </div>

                        {/* Right Column: Stats */}
                        <div className="pm-form-right">
                             <div className="bio-input-group">
                                <label className="bio-label">BIRTHPLACE / ORIGIN</label>
                                <div className="bio-value">{person.birthplace || 'N/A'}</div>
                            </div>
                             <div className="bio-input-group">
                                <label className="bio-label">EDUCATION / ACADEMY</label>
                                <div className="bio-value">{person.education || 'N/A'}</div>
                            </div>
                             <div className="bio-input-group">
                                <label className="bio-label">EXPERTISE</label>
                                <div className="bio-value">{person.expertise || 'N/A'}</div>
                            </div>
                             <div className="bio-input-group" style={{ flex: 1 }}>
                                <label className="bio-label">SERVICE RECORD / BIO</label>
                                <div className="bio-value bio-scroll" style={{ whiteSpace: 'pre-wrap', height: '100%', overflowY: 'auto' }}>
                                    {person.bio || 'No service record available.'}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
