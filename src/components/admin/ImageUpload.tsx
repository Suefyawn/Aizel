'use client';

import { useState, useRef, useCallback } from 'react';

interface Props {
  name: string;
  currentUrl?: string | null;
  label?: string;
  aspect?: number; // width/height ratio, default 1
}

export function ImageUpload({ name, currentUrl, label = 'Image', aspect = 1 }: Props) {
  const [url, setUrl] = useState(currentUrl ?? '');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please select an image file (JPEG, PNG, WebP)'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Max file size is 5 MB'); return; }

    setUploading(true);
    setError('');
    setProgress(10);

    try {
      const fd = new FormData();
      fd.append('file', file);

      // Simulate progress while uploading
      const timer = setInterval(() => setProgress(p => Math.min(p + 15, 85)), 200);

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      clearInterval(timer);
      setProgress(100);

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Upload failed'); }
      else { setUrl(data.url); }
    } catch {
      setError('Upload failed — check your connection');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 600);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }, [upload]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = '';
  };

  const hasImage = Boolean(url);

  return (
    <div>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>{label}</div>

      {/* Hidden value input */}
      <input type="hidden" name={name} value={url} />

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          position: 'relative',
          border: `2px dashed ${dragging ? '#6366f1' : hasImage ? '#e5e7eb' : '#d1d5db'}`,
          borderRadius: 10,
          background: dragging ? '#eef2ff' : hasImage ? '#f9fafb' : '#fafafa',
          cursor: uploading ? 'wait' : 'pointer',
          overflow: 'hidden',
          transition: 'all 0.15s',
          aspectRatio: String(aspect),
        }}
      >
        {/* Current image preview */}
        {hasImage && !uploading && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
            />
            {/* Hover overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.45)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0)'; }}
            >
              <div style={{
                color: '#fff', textAlign: 'center', padding: 12,
                fontSize: '0.8125rem', fontWeight: 600,
                textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                opacity: 0,
                transition: 'opacity 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0'; }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>↑</div>
                Click or drop to replace
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!hasImage && !uploading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, textAlign: 'center', minHeight: 140 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: '1.25rem' }}>
              ↑
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              {dragging ? 'Drop to upload' : 'Upload image'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              Drag & drop or click to browse<br />JPEG, PNG, WebP · Max 5 MB
            </div>
          </div>
        )}

        {/* Uploading state */}
        {uploading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, minHeight: 140 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6366f1', marginBottom: 12 }}>Uploading…</div>
            <div style={{ width: '70%', height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#6366f1', borderRadius: 2, width: `${progress}%`, transition: 'width 0.2s' }} />
            </div>
          </div>
        )}

        {/* Progress bar at bottom */}
        {uploading && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#e5e7eb' }}>
            <div style={{ height: '100%', background: '#6366f1', width: `${progress}%`, transition: 'width 0.2s' }} />
          </div>
        )}
      </div>

      {/* Controls below */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} style={{
          padding: '6px 14px', background: '#f3f4f6', border: '1px solid #e5e7eb',
          borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', color: '#374151',
        }}>
          {hasImage ? 'Replace' : 'Choose file'}
        </button>
        {hasImage && (
          <button type="button" onClick={() => setUrl('')} style={{
            padding: '6px 10px', background: 'transparent', border: '1px solid #fecaca',
            borderRadius: 6, fontSize: '0.8125rem', color: '#ef4444', cursor: 'pointer',
          }}>
            Remove
          </button>
        )}
        {error && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{error}</span>}
      </div>

      {/* Hidden file input */}
      <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
    </div>
  );
}
