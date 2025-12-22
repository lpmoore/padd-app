import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import LCARSButton from '../components/LCARSButton';
import './Library.css';

// Keep static data for seeding purposes
const INITIAL_DATA = [
    { category: 'SHIPS', title: 'USS ENTERPRISE NCC-1701-D', subtitle: 'Galaxy Class', details: { crew: '1014', speed: 'Warp 9.6' }, desc: 'The flagship of the Federation. Commanded by Captain Jean-Luc Picard.' },
    { category: 'SHIPS', title: 'USS DEFIANT NX-74205', subtitle: 'Defiant Class', details: { crew: '50', speed: 'Warp 9.5' }, desc: 'Escort vessel attached to Deep Space 9. Commanded by Captain Benjamin Sisko.' },
    { category: 'SHIPS', title: 'USS VOYAGER NCC-74656', subtitle: 'Intrepid Class', details: { crew: '141', speed: 'Warp 9.975' }, desc: 'Lost in the Delta Quadrant. Commanded by Captain Kathryn Janeway.' },
    { category: 'PLANETS', title: 'EARTH', subtitle: 'Sector 001', details: { population: '9 Billion' }, desc: 'Homeworld of the Human species and capital of the United Federation of Planets.' },
    { category: 'PLANETS', title: 'VULCAN', subtitle: 'Sector 005', details: { population: '6 Billion' }, desc: 'Homeworld of the Vulcans. Known for its harsh desert climate and logical inhabitants.' },
    { category: 'PLANETS', title: 'Q\'ONOS', subtitle: 'Sector 221', details: { population: '4 Billion' }, desc: 'Homeworld of the Klingon Empire. A dark and stormy world.' },
];

const Library = () => {
    const [category, setCategory] = useState('SHIPS');
    const [items, setItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(false);
    
    // Auth & Edit State
    const [session, setSession] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editFormData, setEditFormData] = useState({});
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    }, []);

    useEffect(() => {
        fetchItems();
    }, [category]);

    const fetchItems = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('library_items')
            .select('*')
            .eq('category', category)
            .order('title');

        if (error) {
            console.error('Error fetching library items:', error);
            // If table doesn't exist, this will error.
        } else {
            setItems(data || []);
            if (data && data.length > 0) {
                // If we have a selected item, try to keep it selected if it exists in new data
                if (selectedItem) {
                    const stillExists = data.find(i => i.id === selectedItem.id);
                    if (stillExists) setSelectedItem(stillExists);
                    else setSelectedItem(data[0]);
                } else {
                    setSelectedItem(data[0]);
                }
            } else {
                setSelectedItem(null);
            }
        }
        setLoading(false);
    };

    const handleSeedData = async () => {
        if (!confirm('Populate database with default library data?')) return;
        setLoading(true);
        const user = (await supabase.auth.getUser()).data.user;
        
        const rows = INITIAL_DATA.map(d => ({
            category: d.category,
            title: d.title,
            subtitle: d.subtitle,
            details: d.details,
            description: d.desc, // Map desc to description
            user_id: user?.id
        }));

        const { error } = await supabase.from('library_items').insert(rows);
        if (error) alert('Seed failed: ' + error.message);
        else fetchItems();
        setLoading(false);
    };

    const handleCategoryChange = (cat) => {
        setCategory(cat);
        setIsEditing(false);
    };

    // --- Edit Logic ---
    const handleEditClick = () => {
        setEditFormData({ ...selectedItem });
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditFormData({});
    };

    const handleInputChange = (field, value) => {
        setEditFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleDetailChange = (key, value) => {
        setEditFormData(prev => ({
            ...prev,
            details: {
                ...prev.details,
                [key]: value
            }
        }));
    };

    const handleSave = async () => {
        const { id, ...updates } = editFormData;
        const { error } = await supabase
            .from('library_items')
            .update(updates)
            .eq('id', id);

        if (error) {
            alert('Error saving: ' + error.message);
        } else {
            setIsEditing(false);
            fetchItems();
        }
    };

    // --- Image Upload ---
    const handleImageSelect = async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setUploading(true);
        
        const newImageUrls = [];
        const files = Array.from(e.target.files);
    
        for (const file of files) {
            if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) continue;
            
            const fileExt = file.name.split('.').pop();
            const fileName = `library/${selectedItem.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
            const { error: uploadError } = await supabase.storage
                .from('task-images') // Reuse bucket
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
    
        if (newImageUrls.length > 0) {
            const currentImages = editFormData.images || [];
            // Update local form state directly
            const updatedImages = [...currentImages, ...newImageUrls];
            handleInputChange('images', updatedImages);
        }
        setUploading(false);
    };

    const removeImage = (index) => {
        const currentImages = editFormData.images || [];
        const newImages = currentImages.filter((_, i) => i !== index);
        handleInputChange('images', newImages);
    };


    return (
        <div className="library-container">
            <div className="library-sidebar">
                <LCARSButton 
                   onClick={() => handleCategoryChange('SHIPS')} 
                   color={category === 'SHIPS' ? 'var(--lcars-orange)' : 'var(--lcars-tan)'} 
                   rounded="left" block
                >SHIPS</LCARSButton>
                <LCARSButton 
                   onClick={() => handleCategoryChange('PLANETS')} 
                   color={category === 'PLANETS' ? 'var(--lcars-orange)' : 'var(--lcars-tan)'} 
                   rounded="left" block
                >PLANETS</LCARSButton>
                
                <div className="library-list">
                   {items.map(item => (
                     <div 
                       key={item.id} 
                       className={`library-list-item ${selectedItem?.id === item.id ? 'active' : ''}`}
                       onClick={() => { setSelectedItem(item); setIsEditing(false); }}
                     >
                       {item.title}
                     </div>
                   ))}
                   {items.length === 0 && !loading && (
                       <div style={{padding:'20px', color:'var(--lcars-tan)', textAlign:'center', cursor:'pointer', border:'1px dashed var(--lcars-tan)'}} onClick={handleSeedData}>
                           NO DATA FOUND. <br/>CLICK TO INITIALIZE DATABASE.
                       </div>
                   )}
                </div>
            </div>

            <div className="library-content">
                {loading && <div className="loading">ACCESSING DATABASE...</div>}
                
                {!loading && selectedItem && !isEditing && (
                    <>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                             <div className="library-header-group">
                                <h2 className="library-title">{selectedItem.title}</h2>
                                <h3 className="library-subtitle">{selectedItem.subtitle}</h3>
                             </div>
                             {session && (
                                 <LCARSButton onClick={handleEditClick} color="var(--lcars-orange)" tiny>EDIT</LCARSButton>
                             )}
                        </div>

                        {/* Image Gallery (Read Mode) */}
                        {selectedItem.images && selectedItem.images.length > 0 && (
                            <div className="library-gallery">
                                {selectedItem.images.map((img, idx) => (
                                    <div key={idx} className="library-image-view" style={{backgroundImage:`url(${img})`}} onClick={() => window.open(img, '_blank')}></div>
                                ))}
                            </div>
                        )}

                        <div className="library-data-grid">
                            {selectedItem.details && Object.entries(selectedItem.details).map(([key, value]) => (
                                <div key={key} className="data-row">
                                    <span className="data-label">{key.toUpperCase()}:</span>
                                    <span className="data-value">{value}</span>
                                </div>
                            ))}
                        </div>
                        <p className="library-desc">{selectedItem.description || selectedItem.desc}</p>
                    </>
                )}

                {/* Edit Mode */}
                {!loading && selectedItem && isEditing && (
                    <div className="library-edit-form">
                        <div className="edit-header">
                            <span>EDITING RECORD</span>
                            <div style={{display:'flex', gap:'10px'}}>
                                <LCARSButton onClick={handleSave} color="var(--lcars-orange)" tiny>SAVE</LCARSButton>
                                <LCARSButton onClick={handleCancelEdit} color="var(--lcars-red)" tiny>CANCEL</LCARSButton>
                            </div>
                        </div>

                        <div className="edit-field-group">
                            <label>TITLE</label>
                            <input value={editFormData.title || ''} onChange={e => handleInputChange('title', e.target.value)} />
                        </div>
                        <div className="edit-field-group">
                            <label>SUBTITLE</label>
                            <input value={editFormData.subtitle || ''} onChange={e => handleInputChange('subtitle', e.target.value)} />
                        </div>

                        {/* Visuals Editor */}
                        <div className="note-visuals-strip">
                            <div className="note-visuals-header">VISUAL ATTACHMENTS</div>
                            <div className="note-visuals-grid">
                                {(editFormData.images || []).map((img, idx) => (
                                    <div key={idx} className="note-visual-thumb" style={{backgroundImage: `url(${img})`}}>
                                        <div className="note-visual-remove" onClick={() => removeImage(idx)}>X</div>
                                    </div>
                                ))}
                                <div className="note-visual-add" onClick={() => fileInputRef.current?.click()}>
                                    {uploading ? '...' : '+'}
                                </div>
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                style={{display:'none'}} 
                                accept="image/*" 
                                multiple 
                                onChange={handleImageSelect} 
                            />
                        </div>


                        {/* Dynamic Details Editor */}
                        <div className="edit-details-section">
                            <label>TECHNICAL DATA</label>
                            {editFormData.details && Object.entries(editFormData.details).map(([key, value]) => (
                                <div key={key} className="edit-detail-row">
                                    <span className="detail-key">{key.toUpperCase()}</span>
                                    <input value={value} onChange={e => handleDetailChange(key, e.target.value)} />
                                </div>
                            ))}
                             {/* Add more arbitrary fields? Keep simple for now */}
                        </div>

                        <div className="edit-field-group" style={{flex:1}}>
                            <label>DESCRIPTION</label>
                            <textarea 
                                value={editFormData.description || editFormData.desc || ''} 
                                onChange={e => {
                                    handleInputChange('description', e.target.value);
                                    handleInputChange('desc', e.target.value); // Sync for legacy compat
                                }} 
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Library;
