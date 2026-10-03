'use client';

import React, { useState } from 'react';

interface UrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (url: string) => void;
}

export const UrlModal: React.FC<UrlModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [url, setUrl] = useState('');

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-header">
          <h3>Add Source URL or Link to Verify</h3>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>
        <div className="modal-body">
          <p className="modal-desc">Paste a tweet, news article, or suspicious URL to extract and cross-examine.</p>
          <input
            type="url"
            className="modal-input"
            placeholder="https://example.com/notice or https://twitter.com/..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (url.trim()) {
                  onConfirm(url.trim());
                  setUrl('');
                  onClose();
                }
              }
            }}
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="quiet-button" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              if (url.trim()) {
                onConfirm(url.trim());
                setUrl('');
                onClose();
              }
            }}
          >
            Attach URL
          </button>
        </div>
      </div>
    </div>
  );
};
