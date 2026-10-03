'use client';

import React, { useRef, useEffect } from 'react';
import { Attachment } from '@/lib/investigation/types';
import { FileIcon, ImageIcon, LinkIcon, StopIcon } from './icons';

interface ComposerProps {
  input: string;
  setInput: (val: string) => void;
  attachments: Attachment[];
  onAddAttachment: (att: Attachment) => void;
  onRemoveAttachment: (index: number) => void;
  activeMode: string;
  setActiveMode: (mode: string) => void;
  activeLang: string;
  setActiveLang: (lang: string) => void;
  isStreaming: boolean;
  onSend: () => void;
  onStop: () => void;
  onOpenUrlModal: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  input,
  setInput,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  activeMode,
  setActiveMode,
  activeLang,
  setActiveLang,
  isStreaming,
  onSend,
  onStop,
  onOpenUrlModal,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px';
    }
  }, [input]);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`"${file.name}" exceeds 10MB limit.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        onAddAttachment({
          name: file.name,
          type: file.type,
          size: file.size,
          preview: e.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(input ? input + '\n' + text : text);
      }
    } catch (err) {
      alert('Clipboard access denied.');
    }
  };

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isStreaming;

  return (
    <div className="composer-container" id="composerContainer">
      {/* Attachment Tray */}
      {attachments.length > 0 && (
        <div className="attachment-tray" aria-label="Attached files">
          {attachments.map((att, idx) => (
            <div key={idx} className="attachment-chip">
              {att.type === 'application/pdf' ? (
                <FileIcon className="w-3.5 h-3.5 text-blue-400" />
              ) : att.isUrl ? (
                <LinkIcon className="w-3.5 h-3.5 text-green-400" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={att.preview} alt={att.name} className="attachment-thumb" />
              )}
              <span className="attachment-name">{att.name}</span>
              <button
                type="button"
                className="attachment-remove"
                onClick={() => onRemoveAttachment(idx)}
                aria-label="Remove"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Helper Quick Chips */}
      <div className="composer-quick-chips" id="composerQuickChips">
        <label className="quick-chip" title="Upload screenshot">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Screenshot</span>
          <input
            ref={screenshotInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={e => { handleFileUpload(e.target.files); e.target.value = ''; }}
          />
        </label>

        <label className="quick-chip" title="Upload official PDF or circular">
          <FileIcon className="w-3.5 h-3.5" />
          <span>PDF Notice</span>
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            multiple
            hidden
            onChange={e => { handleFileUpload(e.target.files); e.target.value = ''; }}
          />
        </label>

        <button
          type="button"
          className="quick-chip"
          title="Add web page or tweet URL to verify"
          onClick={onOpenUrlModal}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          <span>URL</span>
        </button>

        <button
          type="button"
          className="quick-chip"
          title="Paste text from clipboard"
          onClick={handlePasteClipboard}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
          <span>Paste from clipboard</span>
        </button>
      </div>

      {/* Main Composer Box */}
      <form
        className="composer"
        id="composer"
        onSubmit={e => {
          e.preventDefault();
          if (canSend) onSend();
        }}
      >
        <textarea
          ref={textareaRef}
          id="promptInput"
          rows={2}
          placeholder="Paste a claim, suspicious message, or question to investigate…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
        />

        <div className="composer-bottom">
          <div className="composer-tools">
            <label className="tool-button" title="Attach file or screenshot (PNG, JPG, PDF up to 10MB)">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 5-6.5 6.5a4 4 0 0 0 5.7 5.7l7-7a2.7 2.7 0 0 0-3.8-3.8l-7 7a1.3 1.3 0 1 0 1.8 1.8l6.4-6.4"/></svg>
              <span>Attach</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                multiple
                hidden
                onChange={e => { handleFileUpload(e.target.files); e.target.value = ''; }}
              />
            </label>

            {/* Mode Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <select
                value={activeMode}
                onChange={e => setActiveMode(e.target.value)}
                className="modal-input"
                style={{ height: 28, fontSize: 11, padding: '0 6px', width: 'auto', background: 'var(--dam-bg-panel)' }}
              >
                <option value="evidence">Evidence mode (Strict)</option>
                <option value="quick">Quick check (Triage)</option>
                <option value="deep">Deep investigation</option>
              </select>
            </div>

            {/* Language Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <select
                value={activeLang}
                onChange={e => setActiveLang(e.target.value)}
                className="modal-input"
                style={{ height: 28, fontSize: 11, padding: '0 6px', width: 'auto', background: 'var(--dam-bg-panel)' }}
              >
                <option value="auto">Auto-detect</option>
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="bn">বাংলা (Bengali)</option>
                <option value="te">తెలుగు (Telugu)</option>
              </select>
            </div>
          </div>

          <div className="composer-submit-group">
            {isStreaming ? (
              <button
                type="button"
                className="send-button stop-btn"
                style={{ background: 'var(--dam-red)', color: '#fff' }}
                onClick={onStop}
                title="Stop generation"
              >
                <StopIcon className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                className="send-button"
                id="sendButton"
                type="submit"
                disabled={!canSend}
                title="Send investigation (Enter)"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5m0 0-5 5m5-5 5 5"/></svg>
              </button>
            )}
          </div>
        </div>
      </form>

      <p className="composer-note">
        DAM prioritizes primary Indian gazettes and regulatory feeds. 
        <a href="#how-dam-verifies" onClick={e => { e.preventDefault(); alert("Open Methodology from the topbar or modal."); }}> How DAM verifies evidence &rarr;</a>
      </p>
    </div>
  );
};
