'use client';

import React, { useState } from 'react';

interface UrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (url: string) => void;
}

export const UrlModal: React.FC<UrlModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = () => {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) return;

    try {
      let parsed: URL;
      try {
        parsed = new URL(trimmed);
      } catch {
        parsed = new URL(`https://${trimmed}`);
      }

      const proto = parsed.protocol.toLowerCase();
      if (proto !== 'http:' && proto !== 'https:') {
        setError('Only HTTP and HTTPS links are supported. Protocols like file://, ftp://, or javascript: are blocked.');
        return;
      }

      onConfirm(parsed.toString());
      setUrl('');
      setError(null);
      onClose();
    } catch {
      setError('Please enter a valid web URL (e.g. https://example.com/article).');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-header">
          <h3>Add Source URL or Link to Verify</h3>
          <button type="button" className="icon-button modal-close" onClick={() => { setError(null); onClose(); }} aria-label="Close modal">&times;</button>
        </div>
        <div className="modal-body">
          <p className="modal-desc">Paste an article, social post, or suspicious link to ingest, extract claims, and verify against primary sources.</p>
          <input
            type="url"
            className="modal-input"
            placeholder="https://example.com/notice or https://x.com/..."
            value={url}
            onChange={e => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
            autoFocus
          />
          {error && (
            <p style={{ color: 'var(--dam-red)', fontSize: '11.5px', marginTop: '6px', lineHeight: 1.4 }}>
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="quiet-button" onClick={() => { setError(null); onClose(); }}>Cancel</button>
          <button
            type="button"
            className="primary-btn"
            disabled={!url.trim()}
            onClick={handleSubmit}
          >
            Attach & Ingest URL
          </button>
        </div>
      </div>
    </div>
  );
};
