'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (openaiKey: string, tavilyKey: string) => void;
}

export const ApiKeysModal: React.FC<ApiKeysModalProps> = ({ isOpen, onClose, onSave }) => {
  const [openaiKey, setOpenaiKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setOpenaiKey(localStorage.getItem('dam-openai-key') || '');
        setTavilyKey(localStorage.getItem('dam-tavily-key') || '');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ width: 'min(580px, 100%)' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/assets/dam-mark-transparent.png" alt="DAM" width={28} height={28} className="brand-mark-img" />
            <div>
              <h3>API Keys &amp; Engine Settings</h3>
              <small style={{ color: 'var(--dam-text-muted)' }}>Stored securely in your local browser session</small>
            </div>
          </div>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--dam-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              1. Reasoning &amp; Challenger AI Provider (OpenAI)
            </label>
            <input
              type="password"
              className="modal-input"
              placeholder="Paste OpenAI API key (sk-proj-...)"
              value={openaiKey}
              onChange={e => setOpenaiKey(e.target.value)}
            />
            <small style={{ color: 'var(--dam-text-muted)', fontSize: 11, marginTop: 4, display: 'block' }}>
              Powers verifiable claim extraction, regulatory cross-examination, and the challenger agent.
            </small>
          </div>

          <div style={{ height: 1, background: 'var(--dam-border-default)' }} />

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--dam-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              2. Live Web Search &amp; Registry Crawler (Tavily)
            </label>
            <input
              type="password"
              className="modal-input"
              placeholder="Paste Tavily API key (tvly-...)"
              value={tavilyKey}
              onChange={e => setTavilyKey(e.target.value)}
            />
            <small style={{ color: 'var(--dam-text-muted)', fontSize: 11, marginTop: 4, display: 'block' }}>
              Queries live Indian regulatory endpoints (RBI Master Circulars, PIB Fact Check, TRAI Chakshu).
            </small>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            className="quiet-button"
            style={{ color: 'var(--dam-red)' }}
            onClick={() => {
              localStorage.removeItem('dam-openai-key');
              localStorage.removeItem('dam-tavily-key');
              setOpenaiKey('');
              setTavilyKey('');
              onClose();
            }}
          >
            Clear Keys
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="quiet-button" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                if (openaiKey) localStorage.setItem('dam-openai-key', openaiKey);
                if (tavilyKey) localStorage.setItem('dam-tavily-key', tavilyKey);
                onSave(openaiKey, tavilyKey);
                onClose();
              }}
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
