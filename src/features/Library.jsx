import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { alertUploadErrors, openStoredImage, removeImagesByUrl, uploadImages } from '../lib/storage';
import LCARSButton from '../components/LCARSButton';
import './Library.css';
import { StoredBackground } from '../components/StoredImage';

// Keep static data for seeding purposes
const INITIAL_DATA = [
    { category: 'SHIPS', title: 'USS ENTERPRISE NCC-1701-D', subtitle: 'Galaxy Class', details: { crew: '1014', speed: 'Warp 9.6' }, desc: 'The flagship of the Federation. Commanded by Captain Jean-Luc Picard.' },
    { category: 'SHIPS', title: 'USS DEFIANT NX-74205', subtitle: 'Defiant Class', details: { crew: '50', speed: 'Warp 9.5' }, desc: 'Escort vessel attached to Deep Space 9. Commanded by Captain Benjamin Sisko.' },
    { category: 'SHIPS', title: 'USS VOYAGER NCC-74656', subtitle: 'Intrepid Class', details: { crew: '141', speed: 'Warp 9.975' }, desc: 'Lost in the Delta Quadrant. Commanded by Captain Kathryn Janeway.' },
    { category: 'PLANETS', title: 'EARTH', subtitle: 'Sector 001', details: { population: '9 Billion' }, desc: 'Homeworld of the Human species and capital of the United Federation of Planets.' },
    { category: 'PLANETS', title: 'VULCAN', subtitle: 'Sector 005', details: { population: '6 Billion' }, desc: 'Homeworld of the Vulcans. Known for its harsh desert climate and logical inhabitants.' },
    { category: 'PLANETS', title: 'Q\'ONOS', subtitle: 'Sector 221', details: { population: '4 Billion' }, desc: 'Homeworld of the Klingon Empire. A dark and stormy world.' },
];

const DEFAULT_CATEGORIES = ['SHIPS', 'PLANETS'];

const Library = () => {
    // null until categories load, so items are fetched once for the real category
    const [activeCategory, setActiveCategory] = useState(null);
    const [availableCategories, setAvailableCategories] = useState(DEFAULT_CATEGORIES);
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
    const [imagesToDelete, setImagesToDelete] = useState([]); // Selected in the grid
    const [stagedRemovals, setStagedRemovals] = useState([]); // Removed from the record, deleted on save
    const [editUploads, setEditUploads] = useState([]); // Uploaded during this edit, deleted on cancel
    const fileInputRef = useRef(null);

    // Bumped whenever an edit starts or ends, so an upload that finishes after
    // its edit was cancelled/saved can tell and clean up after itself.
    const editSession = useRef(0);

    const resetEditImageTracking = () => {
        editSession.current += 1;
        setStagedRemovals([]);
        setEditUploads([]);
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    }, []);

    // Separate fetch for categories to update sidebar
    const refreshCategories = useCallback(async () => {
        const { data, error } = await supabase
            .from('library_items')
            .select('category');

        if (error) console.error('Error fetching library categories:', error);
        const cats = error ? [] : [...new Set(data.map(i => i.category))].sort();
        if (cats.length > 0) setAvailableCategories(cats);
        setActiveCategory(prev => {
            if (cats.length === 0) return prev ?? DEFAULT_CATEGORIES[0];
            // Fall back to the first category if the current one no longer exists
            return cats.includes(prev) ? prev : cats[0];
        });
    }, []);

    // Only the most recent category request may update the view, so
    // switching categories quickly can't leave stale items on screen.
    const latestCategoryRequest = useRef(0);

    const fetchItemsForCategory = async (cat) => {
        const requestId = ++latestCategoryRequest.current;
        setLoading(true);
        const { data } = await supabase
            .from('library_items')
            .select('*')
            .eq('category', cat)
            .order('title');
        if (requestId !== latestCategoryRequest.current) return;

        setItems(data || []);
        if (data && data.length > 0 && !isEditing) {
             setSelectedItem(data[0]);
        } else if (!isEditing) {
             setSelectedItem(null);
        }
        setLoading(false);
    };

    useEffect(() => {
        refreshCategories();
    }, [refreshCategories]);

    useEffect(() => {
        if (!activeCategory) return;
        fetchItemsForCategory(activeCategory);
        // Refetch only on category change; isEditing is read at call time on purpose.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCategory]);


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
            category: activeCategory ?? DEFAULT_CATEGORIES[0], // Default to current
            title: '',
            subtitle: '',
            details: { 'DATA': '' },
            description: '',
            images: []
        });
        setIsCustomCategory(false);
        setIsEditing(true);
        setImagesToDelete([]);
        resetEditImageTracking();
    };

    const handleEditClick = () => {
        setEditFormData({ ...selectedItem });
        setIsCustomCategory(!availableCategories.includes(selectedItem.category));
        setIsEditing(true);
        setImagesToDelete([]);
        resetEditImageTracking();
    };

    const handleCancelEdit = () => {
        // Discard files uploaded during this edit; the saved record never referenced them.
        // Not awaited so the form closes immediately; uploads still in flight are
        // handled by the editSession check in uploadFiles.
        removeImagesByUrl(editUploads);
        resetEditImageTracking();
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
            // Only now that the record no longer references them, delete removed files
            await removeImagesByUrl(stagedRemovals);
            resetEditImageTracking();
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
                await removeImagesByUrl(selectedItem.images || []);
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

    // Saved images are staged and only deleted from storage once the edit is saved.
    // Images uploaded during this edit aren't saved anywhere, so they're deleted now.
    const handleDeleteSelectedImages = () => {
        if (!window.confirm(`Remove ${imagesToDelete.length} selected image(s)? Takes effect when you save.`)) return;

        const remainingImages = (editFormData.images || []).filter(img => !imagesToDelete.includes(img));
        const unsaved = imagesToDelete.filter(img => editUploads.includes(img));

        setEditFormData(prev => ({ ...prev, images: remainingImages }));
        removeImagesByUrl(unsaved);
        setEditUploads(prev => prev.filter(img => !unsaved.includes(img)));
        setStagedRemovals(prev => [...prev, ...imagesToDelete.filter(img => !unsaved.includes(img))]);
        setImagesToDelete([]);
    };

    // Image Upload
    const uploadFiles = async (filesArray) => {
        if (!filesArray || filesArray.length === 0) return;
        setUploading(true);
        const recordId = editFormData.id || 'new';
        const session = editSession.current;

        const { urls: newImageUrls, errors } = await uploadImages(filesArray, `library/${recordId}`);
        if (session !== editSession.current) {
            // The edit ended while uploading; nothing references these files
            await removeImagesByUrl(newImageUrls);
            setUploading(false);
            return;
        }
        alertUploadErrors(errors);
        if (newImageUrls.length > 0) {
            setEditFormData(prev => ({
                ...prev,
                images: [...(prev.images || []), ...newImageUrls]
            }));
            setEditUploads(prev => [...prev, ...newImageUrls]);
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
                        onClick={() => { handleCancelEdit(); setActiveCategory(cat); }} 
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
                       onClick={() => { handleCancelEdit(); setSelectedItem(item); }}
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
                                    <StoredBackground key={idx} className="library-image-view" value={img} onClick={() => openStoredImage(img)} />
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

                        <div className="edit-details-section">
                            <label style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <span>DETAILS</span>
                                <LCARSButton onClick={handleAddDetail} color="var(--lcars-ice-blue)" tiny>+ ADD</LCARSButton>
                            </label>
                            {(editFormData.details ? Object.entries(editFormData.details) : []).map(([key, value], idx) => (
                                <div key={idx} className="edit-detail-row">
                                    <input 
                                        className="detail-key"
                                        value={key} 
                                        onChange={e => handleDetailKeyChange(key, e.target.value)} 
                                        placeholder="KEY" 
                                    />
                                    <input 
                                        value={value} 
                                        onChange={e => handleDetailValueChange(key, e.target.value)} 
                                        placeholder="VALUE" 
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
                                        REMOVE SELECTED ({imagesToDelete.length})
                                    </LCARSButton>
                                )}
                            </div>
                            <div className="note-visuals-grid">
                                {(editFormData.images || []).map((img, idx) => (
                                    <StoredBackground 
                                        key={idx} 
                                        className="note-visual-thumb" 
                                        value={img}
                                        style={{
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
                                    </StoredBackground>
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
