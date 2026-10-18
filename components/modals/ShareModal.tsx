'use client';

import React, { useMemo, useState } from 'react';
import { Conversation } from '@/lib/investigation/types';
import { buildShareBriefing } from '@/lib/investigation/shareBriefing';
import { CopyIcon, ShareIcon } from '../icons';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Clipboard timed out')), 800)),
      ]);
      return;
    } catch {
      // Fall through to the browser-compatible selection copy below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard copy is unavailable');
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, conversation }) => {
  const [status, setStatus] = useState<'idle' | 'copied' | 'shared' | 'error'>('idle');
  const payload = useMemo(
    () => conversation ? buildShareBriefing(conversation) : null,
    [conversation],
  );

  if (!isOpen || !conversation) return null;

  const handleCopy = async () => {
    if (!payload) return;
    try {
      await copyText(payload.text);
      setStatus('copied');
      window.setTimeout(() => setStatus('idle'), 2200);
    } catch {
      setStatus('error');
    }
  };

  const handleNativeShare = async () => {
    if (!payload) return;
    if (!navigator.share) {
      await handleCopy();
      return;
    }
    try {
      await navigator.share({ title: 'UseDAM investigation briefing', text: payload.text });
      setStatus('shared');
      window.setTimeout(() => setStatus('idle'), 2200);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await handleCopy();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Share Investigation Briefing">
      <div className="modal-panel share-modal" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <ShareIcon className="modal-icon text-red" />
            <div>
              <h3>Share Investigation Briefing</h3>
              <p className="modal-sub">Review the exact privacy-safe text before sharing</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="modal-body share-modal-body">
          <div className="share-option-card">
            <div className="share-option-header">
              <span className="share-icon green"><ShareIcon className="w-4 h-4" /></span>
              <div>
                <strong>Text briefing</strong>
                <small>Uploaded files, conversation history, and personal identifiers are excluded by default.</small>
              </div>
            </div>

            {payload ? (
              <>
                <pre className="share-preview-box" aria-label="Exact text that will be shared">{payload.text}</pre>
                <div className="share-actions-row">
                  <button type="button" className="primary-btn share-action-btn" onClick={handleNativeShare}>
                    <ShareIcon className="w-3.5 h-3.5" />
                    <span>{status === 'shared' ? 'Shared' : status === 'copied' ? 'Copied!' : 'Share text'}</span>
                  </button>
                  <button
                    type="button"
                    className={`secondary-button share-action-btn ${status === 'copied' ? 'copied' : ''}`}
                    onClick={handleCopy}
                  >
                    <CopyIcon className="w-3.5 h-3.5" />
                    <span>{status === 'copied' ? 'Copied!' : status === 'error' ? 'Copy unavailable' : 'Copy text'}</span>
                  </button>
                </div>
              </>
            ) : (
              <p className="modal-sub">Complete the investigation before sharing a briefing.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
