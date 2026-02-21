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
    const [activeCategory, setActiveCategory] = useState('SHIPS');
    const [availableCategories, setAvailableCategories] = useState(['SHIPS', 'PLANETS']);
    const [items, setItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Auth & Edit State
    const [session, setSession] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCustomCategory, setIsCustomCategory] = useState(false); // Top level state
    const [editFormData, setEditFormData] = useState({});
    const [uploading, setUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [imagesToDelete, setImagesToDelete] = useState([]);
    const fileInputRef = useRef(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    }, []);

    // 1. Fetch Categories & Items
    useEffect(() => {
        fetchLibraryData();
    }, []);

    const fetchLibraryData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('library_items')
            .select('*')
            .order('title');

        if (error) {
            console.error('Error fetching library items:', error);
        } else {
            const allItems = data || [];
            
            // Extract unique categories
            const cats = [...new Set(allItems.map(i => i.category))].sort();
            if (cats.length === 0) cats.push('SHIPS', 'PLANETS'); // Defaults if empty
            setAvailableCategories(cats);

            // Filter items for current category view
            let cleanActiveCat = activeCategory;
            if (!cats.includes(activeCategory) && cats.length > 0) {
                 cleanActiveCat = cats[0];
                 setActiveCategory(cleanActiveCat);
            }

            const filtered = allItems.filter(i => i.category === cleanActiveCat);
            setItems(filtered);

            // Maintain selection if possible
            if (filtered.length > 0) {
                if (selectedItem) {
                    const stillExists = filtered.find(i => i.id === selectedItem.id);
                    if (stillExists) setSelectedItem(stillExists);
                    else setSelectedItem(filtered[0]);
                } else {
                    setSelectedItem(filtered[0]);
                }
            } else {
                setSelectedItem(null);
            }
        }
        setLoading(false);
    };

    // Re-filter when category changes
    useEffect(() => {
        if (!loading) fetchItemsForCategory(activeCategory);
    }, [activeCategory]);

    const fetchItemsForCategory = async (cat) => {
        setLoading(true);
        const { data } = await supabase
            .from('library_items')
            .select('*')
            .eq('category', cat)
            .order('title');
        
        setItems(data || []);
        if (data && data.length > 0 && !isEditing) {
             setSelectedItem(data[0]);
        } else if (!isEditing) {
             setSelectedItem(null);
        }
        setLoading(false);
    };

    // Separate fetch for categories to update sidebar
    const refreshCategories = async () => {
        const { data } = await supabase
            .from('library_items')
            .select('category');
        
        if (data) {
             const cats = [...new Set(data.map(i => i.category))].sort();
             if (cats.length > 0) setAvailableCategories(cats);
        }
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
            description: d.desc,
            user_id: user?.id
        }));

        const { error } = await supabase.from('library_items').insert(rows);
        if (error) alert('Seed failed: ' + error.message);
        else {
            await refreshCategories();
            fetchItemsForCategory(activeCategory);
        }
        setLoading(false);
    };

    // --- Actions ---
    const handleAddNew = () => {
        setSelectedItem(null);
        setEditFormData({
            category: activeCategory, // Default to current
            title: '',
            subtitle: '',
            details: { 'DATA': '' },
            description: '',
            images: []
        });
        setIsCustomCategory(false);
        setIsEditing(true);
        setImagesToDelete([]);
    };

    const handleEditClick = () => {
        setEditFormData({ ...selectedItem });
        setIsCustomCategory(!availableCategories.includes(selectedItem.category));
        setIsEditing(true);
        setImagesToDelete([]);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditFormData({});
        setIsCustomCategory(false);
        setImagesToDelete([]);
        // Restore selection
        if (!selectedItem && items.length > 0) setSelectedItem(items[0]);
    };

    const handleSave = async () => {
        // Prepare Payload
        const { id, ...dataToSave } = editFormData;
        // Ensure user_id
        if (session) dataToSave.user_id = session.user.id;

        let error;
        if (id) {
            // Update
            const { error: err } = await supabase
                .from('library_items')
                .update(dataToSave)
                .eq('id', id);
            error = err;
        } else {
            // Create
            const { error: err } = await supabase
                .from('library_items')
                .insert(dataToSave);
            error = err;
        }

        if (error) {
            alert('Error saving: ' + error.message);
        } else {
            setIsEditing(false);
            // Refresh everything in case Category changed
            await refreshCategories();
            // If we changed category, switch to it?
            if (dataToSave.category !== activeCategory) {
                setActiveCategory(dataToSave.category);
            } else {
                fetchItemsForCategory(activeCategory);
            }
        }
    };

    const handleDelete = async () => {
        if (!selectedItem) return;
        if (window.confirm(`Delete record: ${selectedItem.title}?`)) {
            const { error } = await supabase
                .from('library_items')
                .delete()
                .eq('id', selectedItem.id);
            
            if (error) {
                alert('Error deleting: ' + error.message);
            } else {
                setSelectedItem(null);
                await refreshCategories();
                fetchItemsForCategory(activeCategory);
            }
        }
    };

    // Form Handling
    const handleInputChange = (field, value) => {
        setEditFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleDetailKeyChange = (oldKey, newKey) => {
        setEditFormData(prev => {
            const newDetails = { ...prev.details };
            if (oldKey !== newKey) {
                newDetails[newKey] = newDetails[oldKey];
                delete newDetails[oldKey];
            }
            return { ...prev, details: newDetails };
        });
    };

    const handleDetailValueChange = (key, value) => {
        setEditFormData(prev => ({
            ...prev,
            details: { ...prev.details, [key]: value }
        }));
    };

    const handleAddDetail = () => {
        const newKey = `NEW_DETAIL_${Date.now()}`;
        setEditFormData(prev => ({
            ...prev,
            details: { ...prev.details, [newKey]: '' }
        }));
    };

    const handleRemoveDetail = (keyToRemove) => {
        setEditFormData(prev => {
            const newDetails = { ...prev.details };
            delete newDetails[keyToRemove];
            return { ...prev, details: newDetails };
        });
    };

    const toggleImageDeletion = (imgUrl) => {
        setImagesToDelete(prev => 
            prev.includes(imgUrl) 
                ? prev.filter(url => url !== imgUrl)
                : [...prev, imgUrl]
        );
    };

    const handleDeleteSelectedImages = async () => {
        if (!window.confirm(`Delete ${imagesToDelete.length} selected image(s)?`)) return;
        setLoading(true);

        const storagePathsToDelete = imagesToDelete
            .filter(url => url.includes('supabase.co') && url.includes('task-images/'))
            .map(url => {
                const parts = url.split('task-images/');
                return parts.length === 2 ? parts[1] : null;
            })
            .filter(Boolean);

        if (storagePathsToDelete.length > 0) {
            const { error: deleteError } = await supabase.storage.from('task-images').remove(storagePathsToDelete);
            if (deleteError) {
                console.error("Error deleting images from storage:", deleteError);
            }
        }

        const remainingImages = (editFormData.images || []).filter(img => !imagesToDelete.includes(img));
        
        setEditFormData(prev => ({ ...prev, images: remainingImages }));
        setImagesToDelete([]);
        setLoading(false);
    };

    // Image Upload
    const uploadFiles = async (filesArray) => {
        if (!filesArray || filesArray.length === 0) return;
        setUploading(true);
        const newImageUrls = [];
        const recordId = editFormData.id || 'new';

        for (const file of filesArray) {
            if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) continue;
            const fileName = `library/${recordId}/${Date.now()}_${file.name}`;
            const { error } = await supabase.storage.from('task-images').upload(fileName, file);
            if (!error) {
                const { data } = supabase.storage.from('task-images').getPublicUrl(fileName);
                newImageUrls.push(data.publicUrl);
            }
        }
        if (newImageUrls.length > 0) {
            setEditFormData(prev => ({
                ...prev,
                images: [...(prev.images || []), ...newImageUrls]
            }));
        }
        setUploading(false);
    };

    const handleImageSelect = (e) => {
        uploadFiles(Array.from(e.target.files));
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            uploadFiles(files);
            return;
        }

        // Handle dragging images from other websites
        let droppedUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        const html = e.dataTransfer.getData('text/html');
        
        if (!droppedUrl && html) {
            const match = html.match(/src=["'](.*?)["']/i);
            if (match) droppedUrl = match[1];
        }

        if (droppedUrl && (droppedUrl.startsWith('http') || droppedUrl.startsWith('data:image'))) {
            setEditFormData(prev => ({
                ...prev,
                images: [...(prev.images || []), droppedUrl]
            }));
        }
    };

    const filteredItems = items.filter(item => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            (item.title && item.title.toLowerCase().includes(query)) ||
            (item.subtitle && item.subtitle.toLowerCase().includes(query)) ||
            (item.description && item.description.toLowerCase().includes(query)) ||
            (item.desc && item.desc.toLowerCase().includes(query))
        );
    });

    return (
        <div className="library-container">
            <div className="library-sidebar">
                <div className="library-sidebar-title">TOPICS</div>
                {availableCategories.map(cat => (
                     <LCARSButton 
                        key={cat}
                        onClick={() => { setActiveCategory(cat); setIsEditing(false); }} 
                        color={activeCategory === cat ? 'var(--lcars-orange)' : 'var(--lcars-tan)'} 
                        rounded="left" block
                     >{cat}</LCARSButton>
                ))}
                
                {/* Add New Entry Button */}
                <div style={{ marginTop: '20px', borderTop: '2px solid var(--lcars-tan)', paddingTop: '10px' }}>
                    <LCARSButton onClick={handleAddNew} color="var(--lcars-ice-blue)" rounded="left" block>
                        + NEW ENTRY
                    </LCARSButton>
                </div>

                <div className="library-list">
                   <div className="library-search-container" style={{ padding: '0 0 10px 0' }}>
                       <input 
                           type="text" 
                           placeholder="SEARCH DATA..." 
                           value={searchQuery}
                           onChange={e => setSearchQuery(e.target.value)}
                       />
                   </div>
                   <div className="library-list-header">RECORDS ({filteredItems.length})</div>
                   {filteredItems.map(item => (
                     <div 
                       key={item.id} 
                       className={`library-list-item ${selectedItem?.id === item.id ? 'active' : ''}`}
                       onClick={() => { setSelectedItem(item); setIsEditing(false); }}
                     >
                       {item.title}
                     </div>
                   ))}
                   {items.length === 0 && !loading && (
                       <div className="library-empty-state" onClick={handleSeedData}>
                           NO DATA. INITIALIZE?
                       </div>
                   )}
                </div>
            </div>

            <div className="library-content">
                {loading && <div className="loading">ACCESSING DATABASE...</div>}
                
                {/* READ MODE */}
                {!loading && !isEditing && selectedItem && (
                    <>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                             <div className="library-header-group">
                                <h2 className="library-title">{selectedItem.title}</h2>
                                <h3 className="library-subtitle">{selectedItem.subtitle}</h3>
                             </div>
                             {session && (
                                 <div style={{display:'flex', gap:'10px'}}>
                                     <LCARSButton onClick={handleEditClick} color="var(--lcars-orange)" tiny>EDIT</LCARSButton>
                                     <LCARSButton onClick={handleDelete} color="var(--lcars-red)" tiny>DELETE</LCARSButton>
                                 </div>
                             )}
                        </div>

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
                
                {/* EDIT / CREATE MODE */}
                {!loading && isEditing && (
                    <div className="library-edit-form">
                        <div className="edit-header">
                            <span>{editFormData.id ? 'EDITING RECORD' : 'NEW LIBRARY RECORD'}</span>
                            <div style={{display:'flex', gap:'10px'}}>
                                <LCARSButton onClick={handleSave} color="var(--lcars-orange)" tiny>SAVE</LCARSButton>
                                <LCARSButton onClick={handleCancelEdit} color="var(--lcars-red)" tiny>CANCEL</LCARSButton>
                            </div>
                        </div>

                        <div className="edit-field-group">
                            <label>CATEGORY (TOPIC)</label>
                            {/* Hybrid Select / Input Logic */}
                            {isCustomCategory ? (
                                <div style={{display:'flex', gap:'10px'}}>
                                    <input 
                                        value={editFormData.category || ''} 
                                        onChange={e => handleInputChange('category', e.target.value.toUpperCase())} 
                                        placeholder="ENTER NEW TOPIC NAME"
                                        autoFocus
                                        style={{flex: 1}}
                                    />
                                    <LCARSButton onClick={() => setIsCustomCategory(false)} color="var(--lcars-tan)" tiny>SELECT EXISTING</LCARSButton>
                                </div>
                            ) : (
                                <div style={{display:'flex', gap:'10px'}}>
                                     <select 
                                        className="lcars-select"
                                        value={availableCategories.includes(editFormData.category) ? editFormData.category : '__NEW__'}
                                        onChange={e => {
                                            if (e.target.value === '__NEW__') {
                                                setIsCustomCategory(true);
                                                handleInputChange('category', '');
                                            } else {
                                                handleInputChange('category', e.target.value);
                                            }
                                        }}
                                        style={{
                                            flex: 1,
                                            backgroundColor: 'var(--lcars-bg)',
                                            color: 'var(--lcars-orange)',
                                            border: '2px solid var(--lcars-orange)',
                                            borderRadius: '15px',
                                            padding: '5px 10px',
                                            fontFamily: 'var(--font-main)',
                                            fontSize: '1em'
                                        }}
                                    >
                                        {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                        <option value="__NEW__">[ NEW TOPIC... ]</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="edit-field-group">
                            <label>TITLE</label>
                            <input value={editFormData.title || ''} onChange={e => handleInputChange('title', e.target.value)} />
                        </div>
                        <div className="edit-field-group">
                            <label>SUBTITLE</label>
                            <input value={editFormData.subtitle || ''} onChange={e => handleInputChange('subtitle', e.target.value)} />
                        </div>

                        <div className="edit-field-group">
                            <label style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <span>DETAILS</span>
                                <LCARSButton onClick={handleAddDetail} color="var(--lcars-ice-blue)" tiny>+ ADD</LCARSButton>
                            </label>
                            {(editFormData.details ? Object.entries(editFormData.details) : []).map(([key, value], idx) => (
                                <div key={idx} style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                                    <input 
                                        value={key} 
                                        onChange={e => handleDetailKeyChange(key, e.target.value)} 
                                        placeholder="KEY" 
                                        style={{flex: 1}}
                                    />
                                    <input 
                                        value={value} 
                                        onChange={e => handleDetailValueChange(key, e.target.value)} 
                                        placeholder="VALUE" 
                                        style={{flex: 2}}
                                    />
                                    <LCARSButton onClick={() => handleRemoveDetail(key)} color="var(--lcars-red)" tiny>x</LCARSButton>
                                </div>
                            ))}
                        </div>

                        <div 
                            className="note-visuals-strip"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            style={{
                                border: isDragging ? '2px dashed var(--lcars-orange)' : 'none',
                                transition: 'border 0.2s ease',
                                padding: isDragging ? '8px' : '0'
                            }}
                        >
                            <div className="note-visuals-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <div>
                                    {isDragging ? 'DROP IMAGES HERE' : 'VISUALS'}
                                    {uploading && <span style={{fontSize:'0.8em', marginLeft:'10px'}}>UPLOADING...</span>}
                                </div>
                                {imagesToDelete.length > 0 && (
                                    <LCARSButton onClick={handleDeleteSelectedImages} color="var(--lcars-red)" tiny>
                                        DELETE SELECTED ({imagesToDelete.length})
                                    </LCARSButton>
                                )}
                            </div>
                            <div className="note-visuals-grid">
                                {(editFormData.images || []).map((img, idx) => (
                                    <div 
                                        key={idx} 
                                        className="note-visual-thumb" 
                                        style={{
                                            backgroundImage: `url(${img})`,
                                            border: imagesToDelete.includes(img) ? '3px solid var(--lcars-red)' : 'none',
                                            opacity: imagesToDelete.includes(img) ? 0.5 : 1,
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => toggleImageDeletion(img)}
                                    >
                                        {imagesToDelete.includes(img) && (
                                            <div style={{display:'flex', height:'100%', alignItems:'center', justifyContent:'center', color:'var(--lcars-red)', fontSize:'24px', fontWeight:'bold', backgroundColor:'rgba(0,0,0,0.5)'}}>
                                                X
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div className="note-visual-add" onClick={() => fileInputRef.current?.click()}>+</div>
                            </div>
                            <input type="file" ref={fileInputRef} hidden accept="image/*" multiple onChange={handleImageSelect} />
                        </div>

                        <div className="edit-field-group" style={{flex:1}}>
                            <label>DESCRIPTION</label>
                            <textarea 
                                value={editFormData.description || editFormData.desc || ''} 
                                onChange={e => handleInputChange('description', e.target.value)} 
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Library;
