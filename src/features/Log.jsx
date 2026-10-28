import './Log.css';

import React, { useEffect, useRef, useState } from 'react';

import LCARSButton from '../components/LCARSButton';
import { formatLogDate } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import {
  alertUploadErrors,
  imagesNoLongerUsed,
  openStoredImage,
  removeImagesByUrl,
  uploadImages,
} from '../lib/storage';
import { useSettings } from '../contexts/settingsContextValue';
import { StoredBackground } from '../components/StoredImage';
import { confirmAction, notifyError } from '../lib/notify';

const pickRandomIndex = (length) => Math.floor(Math.random() * length);

const Log = () => {
  // Extract toggle state from settings context
  const settings = useSettings();
  const isStardateEnabled = settings?.isStardateEnabled || false;

  const scrollToLog = (id) => {
    const el = document.getElementById(`log-entry-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Random log handler
  const handleRandomLog = () => {
    if (!logs.length) return;
    const randomIndex = pickRandomIndex(logs.length);
    const randomLogId = logs[randomIndex].id;
    scrollToLog(randomLogId);
  };

  // Duplicate scrollToLog removed

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

  // The entry's saved images and the files uploaded since the edit started, so
  // save can delete what was dropped and cancel can delete what was added.
  // The session counter lets an upload that outlives its edit clean up after itself.
  const editTracking = useRef({ images: [], uploads: [] });
  const editSession = useRef(0);
  const startEditTracking = (images = []) => {
    editSession.current += 1;
    editTracking.current = { images, uploads: [] };
  };

  // Get Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('notes') // Keeping table name 'notes' for now to avoid DB migration complexity
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching logs:', error);
    else setLogs(data || []);
  };

  // Fetch Logs
  useEffect(() => {
    if (session) fetchLogs();
  }, [session]);

  // Filter Logs
  const filteredLogs = logs.filter((log) => {
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
    startEditTracking();
    // Auto-generate title with Stardate?
    // For now, let's just leave blank or "CAPTAIN'S LOG"
  };

  const handleStartEdit = (log) => {
    setEditingId(log.id);
    setIsCreating(false);
    setEditTitle(log.title);
    setEditContent(log.content);
    setEditImages(log.images || []);
    startEditTracking(log.images || []);
  };

  const handleCancel = () => {
    removeImagesByUrl(editTracking.current.uploads);
    startEditTracking();
    setIsCreating(false);
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditImages([]);
  };

  const handleSave = async () => {
    if (!editTitle.trim() && !editContent.trim()) return;

    // Once saved, files the entry no longer references can go
    const cleanUpAfterSave = () => {
      const { images, uploads } = editTracking.current;
      removeImagesByUrl(imagesNoLongerUsed([...images, ...uploads], editImages));
      startEditTracking();
    };

    const logData = {
      user_id: session.user.id,
      title: editTitle.toUpperCase(), // LCARS convention
      content: editContent,
      images: editImages,
      updated_at: new Date(),
    };

    if (isCreating) {
      const { data, error } = await supabase
        .from('notes')
        .insert(logData)
        .select()
        .single();

      if (error) {
        console.error('Error creating log:', error);
        notifyError('SAVE FAILED', `Could not record log entry: ${error.message}`);
      } else {
        setLogs([data, ...logs]);
        cleanUpAfterSave();
        setIsCreating(false);
      }
    } else if (editingId) {
      const { error } = await supabase
        .from('notes')
        .update(logData)
        .eq('id', editingId);

      if (error) {
        console.error('Error updating log:', error);
        notifyError('SAVE FAILED', `Could not update log entry: ${error.message}`);
      } else {
        setLogs(
          logs.map((l) => (l.id === editingId ? { ...l, ...logData } : l)),
        );
        cleanUpAfterSave();
        setEditingId(null);
      }
    }
  };

  const handleDelete = async (id) => {
    const log = logs.find((l) => l.id === id);
    const confirmed = await confirmAction(
      `Purge log entry "${log?.title || 'UNKNOWN'}"? This cannot be undone.`,
      { title: 'PURGE LOG ENTRY', confirmLabel: 'PURGE', danger: true },
    );
    if (!confirmed) return;

    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) {
      console.error('Error deleting log:', error);
      notifyError('PURGE FAILED', `Could not purge log entry: ${error.message}`);
    } else {
      removeImagesByUrl(log?.images || []);
      setLogs(logs.filter((l) => l.id !== id));
    }
  };

  const handleImageSelect = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);

    const files = Array.from(e.target.files);

    // Use a temp ID for new creates if needed, or just generic folder
    const folderId = editingId || 'temp';

    const session = editSession.current;
    const { urls: newImageUrls, errors } = await uploadImages(files, `logs/${folderId}`);
    if (session !== editSession.current) {
      // The edit ended while uploading; nothing references these files
      removeImagesByUrl(newImageUrls);
      setUploading(false);
      return;
    }
    alertUploadErrors(errors);
    editTracking.current.uploads.push(...newImageUrls);

    setEditImages((prev) => [...prev, ...newImageUrls]);
    setUploading(false);
  };

  const removeImage = (index) => {
    // Uploaded during this edit, so nothing saved uses it: delete it now.
    // Saved images wait for save, so cancel can still restore them.
    const url = editImages[index];
    const { uploads } = editTracking.current;
    if (uploads.includes(url)) {
      editTracking.current.uploads = uploads.filter((u) => u !== url);
      removeImagesByUrl([url]);
    }
    setEditImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className='log-container'>
      {/* Header Controls */}
      <div className='log-header'>
        {!isCreating && !editingId && (
          <>
            <LCARSButton
              onClick={handleStartCreate}
              color='var(--lcars-orange)'
              rounded='both'
            >
              NEW ENTRY
            </LCARSButton>
            <LCARSButton
              onClick={handleRandomLog}
              color='var(--lcars-cyan)'
              rounded='both'
              disabled={logs.length === 0}
            >
              RANDOM LOG
            </LCARSButton>
          </>
        )}
        <div className='log-search-wrapper'>
          <input
            className='log-search-input'
            placeholder="SEARCH CAPTAIN'S LOG..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <div className='log-search-count'>{filteredLogs.length} FOUND</div>
          )}
        </div>
      </div>

      {/* Editor Area (Create/Edit) */}
      {(isCreating || editingId) && (
        <div className='new-log-area'>
          <div className='new-log-header'>
            <input
              className='new-log-title'
              placeholder='TITLE / SUBJECT'
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <div style={{ color: 'var(--lcars-tan)' }}>
              {isCreating ? 'RECORDING NEW LOG' : 'EDITING LOG'}
            </div>
          </div>
          <textarea
            className='new-log-content'
            placeholder='Log content...'
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
          />

          {/* Image Previews */}
          <div className='log-images'>
            {editImages.map((img, idx) => (
              <StoredBackground
                key={idx}
                className='log-image-thumb'
                value={img}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: 'red',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '0 5px',
                    fontSize: '10px',
                  }}
                  onClick={() => removeImage(idx)}
                >
                  X
                </div>
              </StoredBackground>
            ))}
          </div>

          <div className='new-log-footer'>
            <label className='image-upload-label'>
              <input
                type='file'
                hidden
                multiple
                accept='image/*'
                onChange={handleImageSelect}
                ref={fileInputRef}
              />
              {uploading ? 'UPLOADING...' : '+ ATTACH VISUALS'}
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <LCARSButton
                onClick={handleCancel}
                color='var(--lcars-gray)'
                rounded='left'
                small
              >
                CANCEL
              </LCARSButton>
              <LCARSButton
                onClick={handleSave}
                color='var(--lcars-orange)'
                rounded='right'
                small
              >
                {isCreating ? 'RECORD' : 'UPDATE'}
              </LCARSButton>
            </div>
          </div>
        </div>
      )}

      {/* Log Feed */}
      <div className='log-feed'>
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            id={`log-entry-${log.id}`}
            className={`log-entry ${editingId === log.id ? 'active' : ''}`}
          >
            <div className='log-entry-header'>
              <div className='log-meta'>
                <span className='log-stardate'>
                  {formatLogDate(log.created_at, isStardateEnabled)}
                </span>
                <span className='log-title'>{log.title || 'UNKNOWN'}</span>
              </div>
              <div className='log-actions'>
                <button
                  className='log-action-btn'
                  onClick={() => handleStartEdit(log)}
                >
                  EDIT
                </button>
                <button
                  className='log-action-btn'
                  onClick={() => handleDelete(log.id)}
                >
                  PURGE
                </button>
              </div>
            </div>
            <div className='log-entry-body'>{log.content}</div>
            {log.images && log.images.length > 0 && (
              <div className='log-images'>
                {log.images.map((img, idx) => (
                  <StoredBackground
                    key={idx}
                    className='log-image-thumb'
                    value={img}
                    onClick={() => openStoredImage(img)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--lcars-gray)',
              marginTop: '50px',
            }}
          >
            NO LOG ENTRIES FOUND
          </div>
        )}
      </div>
    </div>
  );
};

export default Log;
