import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import LCARSButton from '../components/LCARSButton';
import './Log.css';

const Log = () => {
    const [logs, setLogs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [session, setSession] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    
    // New/Edit State
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editImages, setEditImages] = useState([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Get Session
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });
    }, []);

    // Fetch Logs
    useEffect(() => {
        if (session) fetchLogs();
    }, [session]);

    const fetchLogs = async () => {
        const { data, error } = await supabase
            .from('notes') // Keeping table name 'notes' for now to avoid DB migration complexity
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) console.error('Error fetching logs:', error);
        else setLogs(data || []);
    };

    // Filter Logs
    const filteredLogs = logs.filter(log => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (log.title && log.title.toLowerCase().includes(q)) ||
            (log.content && log.content.toLowerCase().includes(q))
        );
    });

    const handleStartCreate = () => {
        setIsCreating(true);
        setEditingId(null);
        setEditTitle('');
        setEditContent('');
        setEditImages([]);
        // Auto-generate title with Stardate? 
        // For now, let's just leave blank or "CAPTAIN'S LOG"
    };

    const handleStartEdit = (log) => {
        setEditingId(log.id);
        setIsCreating(false);
        setEditTitle(log.title);
        setEditContent(log.content);
        setEditImages(log.images || []);
    };

    const handleCancel = () => {
        setIsCreating(false);
        setEditingId(null);
        setEditTitle('');
        setEditContent('');
        setEditImages([]);
    };

    const handleSave = async () => {
        if (!editTitle.trim() && !editContent.trim()) return;

        const logData = {
            user_id: session.user.id,
            title: editTitle.toUpperCase(), // LCARS convention
            content: editContent,
            images: editImages,
            updated_at: new Date()
        };

        if (isCreating) {
            const { data, error } = await supabase
                .from('notes')
                .insert(logData)
                .select()
                .single();
            
            if (error) {
                console.error('Error creating log:', error);
                alert('Failed to record log entry.');
            } else {
                setLogs([data, ...logs]);
                setIsCreating(false);
            }
        } else if (editingId) {
            const { error } = await supabase
                .from('notes')
                .update(logData)
                .eq('id', editingId);

            if (error) {
                console.error('Error updating log:', error);
                alert('Failed to update log entry.');
            } else {
                setLogs(logs.map(l => l.id === editingId ? { ...l, ...logData } : l));
                setEditingId(null);
            }
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to purge this log entry?')) return;

        const { error } = await supabase.from('notes').delete().eq('id', id);
        if (error) {
            console.error('Error deleting log:', error);
        } else {
            setLogs(logs.filter(l => l.id !== id));
        }
    };

    const handleImageSelect = async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setUploading(true);
        
        const newImageUrls = [];
        const files = Array.from(e.target.files);
    
        // Use a temp ID for new creates if needed, or just generic folder
        const folderId = editingId || 'temp'; 
    
        for (const file of files) {
            if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) continue;
            
            const fileExt = file.name.split('.').pop();
            const fileName = `logs/${folderId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
            const { error: uploadError } = await supabase.storage
                .from('task-images') // Reusing bucket
                .upload(fileName, file);
    
            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage
                    .from('task-images')
                    .getPublicUrl(fileName);
                newImageUrls.push(publicUrl);
            } else {
                 console.error('Upload failed:', uploadError);
            }
        }
    
        setEditImages(prev => [...prev, ...newImageUrls]);
        setUploading(false);
      };

    const removeImage = (index) => {
        setEditImages(prev => prev.filter((_, i) => i !== index));
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).toUpperCase();
    };

    return (
        <div className="log-container">
            {/* Header Controls */}
            <div className="log-header">
                <div className="log-search-wrapper">
                    <input 
                        className="log-search-input"
                        placeholder="SEARCH CAPTAIN'S LOG..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && <div className="log-search-count">{filteredLogs.length} FOUND</div>}
                </div>
                {!isCreating && !editingId && (
                     <LCARSButton onClick={handleStartCreate} color="var(--lcars-orange)" rounded="both">
                        NEW ENTRY
                     </LCARSButton>
                )}
            </div>

            {/* Editor Area (Create/Edit) */}
            {(isCreating || editingId) && (
                <div className="new-log-area">
                    <div className="new-log-header">
                         <input 
                            className="new-log-title"
                            placeholder="TITLE / SUBJECT"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                         />
                         <div style={{color:'var(--lcars-tan)'}}>
                             {isCreating ? 'RECORDING NEW LOG' : 'EDITING LOG'}
                         </div>
                    </div>
                    <textarea 
                        className="new-log-content"
                        placeholder="Log content..."
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                    />
                    
                    {/* Image Previews */}
                    <div className="log-images">
                        {editImages.map((img, idx) => (
                             <div key={idx} className="log-image-thumb" style={{backgroundImage: `url(${img})`}}>
                                 <div 
                                    style={{
                                        position: 'absolute', top: 0, right: 0, background: 'red', color: 'white', 
                                        cursor: 'pointer', padding: '0 5px', fontSize: '10px'
                                    }}
                                    onClick={() => removeImage(idx)}
                                 >X</div>
                             </div>
                        ))}
                    </div>

                    <div className="new-log-footer">
                        <label className="image-upload-label">
                            <input 
                                type="file" 
                                hidden 
                                multiple 
                                accept="image/*"
                                onChange={handleImageSelect}
                                ref={fileInputRef}
                            />
                            {uploading ? 'UPLOADING...' : '+ ATTACH VISUALS'}
                        </label>
                        <div style={{display:'flex', gap:'10px'}}>
                            <LCARSButton onClick={handleCancel} color="var(--lcars-gray)" rounded="left" small>CANCEL</LCARSButton>
                            <LCARSButton onClick={handleSave} color="var(--lcars-orange)" rounded="right" small>
                                {isCreating ? 'RECORD' : 'UPDATE'}
                            </LCARSButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Log Feed */}
            <div className="log-feed">
                {filteredLogs.map(log => (
                    <div key={log.id} className={`log-entry ${editingId === log.id ? 'active' : ''}`}>
                        <div className="log-entry-header">
                            <div className="log-meta">
                                <span className="log-stardate">{formatDate(log.created_at)}</span>
                                <span className="log-title">{log.title || 'UNKNOWN'}</span>
                            </div>
                            <div className="log-actions">
                                <button className="log-action-btn" onClick={() => handleStartEdit(log)}>EDIT</button>
                                <button className="log-action-btn" onClick={() => handleDelete(log.id)}>PURGE</button>
                            </div>
                        </div>
                        <div className="log-entry-body">
                            {log.content}
                        </div>
                        {log.images && log.images.length > 0 && (
                            <div className="log-images">
                                {log.images.map((img, idx) => (
                                    <div 
                                        key={idx} 
                                        className="log-image-thumb" 
                                        style={{backgroundImage: `url(${img})`}}
                                        onClick={() => window.open(img, '_blank')}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {filteredLogs.length === 0 && (
                    <div style={{textAlign:'center', color:'var(--lcars-gray)', marginTop:'50px'}}>
                        NO LOG ENTRIES FOUND
                    </div>
                )}
            </div>
        </div>
    );
};

export default Log;
