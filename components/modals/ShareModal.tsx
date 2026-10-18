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
  const language = [...(conversation?.turns || [])].reverse().find(turn => turn.role === 'assistant' && turn.meta)?.meta?.language || 'en';
  const copy = language === 'hi'
    ? { title: 'जाँच सार साझा करें', sub: 'साझा करने से पहले सटीक, गोपनीयता-सुरक्षित पाठ देखें', briefing: 'पाठ सार', privacy: 'अपलोड की गई फ़ाइलें, बातचीत का इतिहास और व्यक्तिगत पहचानकर्ता डिफ़ॉल्ट रूप से शामिल नहीं हैं।', share: 'पाठ साझा करें', copied: 'कॉपी हो गया!', copy: 'पाठ कॉपी करें', unavailable: 'कॉपी उपलब्ध नहीं', incomplete: 'सार साझा करने से पहले जाँच पूरी करें।' }
    : language === 'ta'
      ? { title: 'ஆய்வுச் சுருக்கத்தைப் பகிரவும்', sub: 'பகிர்வதற்கு முன் துல்லியமான தனியுரிமை-பாதுகாப்பான உரையைப் பார்க்கவும்', briefing: 'உரைச் சுருக்கம்', privacy: 'பதிவேற்றிய கோப்புகள், உரையாடல் வரலாறு மற்றும் தனிப்பட்ட அடையாளங்கள் இயல்பாக விலக்கப்படுகின்றன.', share: 'உரையைப் பகிரவும்', copied: 'நகலெடுக்கப்பட்டது!', copy: 'உரையை நகலெடுக்கவும்', unavailable: 'நகலெடுக்க முடியவில்லை', incomplete: 'சுருக்கத்தைப் பகிர்வதற்கு முன் ஆய்வை முடிக்கவும்.' }
      : { title: 'Share Investigation Briefing', sub: 'Review the exact privacy-safe text before sharing', briefing: 'Text briefing', privacy: 'Uploaded files, conversation history, and personal identifiers are excluded by default.', share: 'Share text', copied: 'Copied!', copy: 'Copy text', unavailable: 'Copy unavailable', incomplete: 'Complete the investigation before sharing a briefing.' };

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
      await navigator.share({ title: copy.title, text: payload.text });
      setStatus('shared');
      window.setTimeout(() => setStatus('idle'), 2200);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await handleCopy();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={copy.title}>
      <div className="modal-panel share-modal" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <ShareIcon className="modal-icon text-red" />
            <div>
              <h3>{copy.title}</h3>
              <p className="modal-sub">{copy.sub}</p>
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
                <strong>{copy.briefing}</strong>
                <small>{copy.privacy}</small>
              </div>
            </div>

            {payload ? (
              <>
                <pre className="share-preview-box" aria-label="Exact text that will be shared">{payload.text}</pre>
                <div className="share-actions-row">
                  <button type="button" className="primary-btn share-action-btn" onClick={handleNativeShare}>
                    <ShareIcon className="w-3.5 h-3.5" />
                    <span>{status === 'copied' ? copy.copied : copy.share}</span>
                  </button>
                  <button
                    type="button"
                    className={`secondary-button share-action-btn ${status === 'copied' ? 'copied' : ''}`}
                    onClick={handleCopy}
                  >
                    <CopyIcon className="w-3.5 h-3.5" />
                    <span>{status === 'copied' ? copy.copied : status === 'error' ? copy.unavailable : copy.copy}</span>
                  </button>
                </div>
              </>
            ) : (
              <p className="modal-sub">{copy.incomplete}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
