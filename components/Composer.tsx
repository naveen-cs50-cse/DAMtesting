'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Attachment } from '@/lib/investigation/types';
import { FileIcon, ImageIcon, LinkIcon, StopIcon } from './icons';

interface ComposerProps {
  input: string;
  setInput: (val: string) => void;
  attachments: Attachment[];
  onAddAttachment: (att: Attachment) => void;
  onUpdateAttachment?: (index: number, updated: Partial<Attachment>) => void;
  onRemoveAttachment: (index: number) => void;
  activeMode: string;
  setActiveMode: (mode: string) => void;
  activeLang: string;
  setActiveLang: (lang: string) => void;
  isStreaming: boolean;
  onSend: () => void;
  onStop: () => void;
  onOpenUrlModal: () => void;
  hasCompletedTurn?: boolean;
}

export const Composer: React.FC<ComposerProps> = ({
  input,
  setInput,
  attachments,
  onAddAttachment,
  onUpdateAttachment,
  onRemoveAttachment,
  activeMode,
  setActiveMode,
  activeLang,
  setActiveLang,
  isStreaming,
  onSend,
  onStop,
  onOpenUrlModal,
  hasCompletedTurn = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Auto-resize textarea to fit text (min 28px, max 160px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.max(28, Math.min(scrollH, 160)) + 'px';
    }
  }, [input]);

  // Close attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    };
    if (attachMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [attachMenuOpen]);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file, index) => {
      if (file.size > 15 * 1024 * 1024) {
        alert(`"${file.name}" exceeds 15MB limit.`);
        return;
      }
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/');

      const reader = new FileReader();
      reader.onload = async e => {
        const preview = e.target?.result as string;

        // Add attachment with pending OCR/analysis status
        onAddAttachment({
          name: file.name,
          type: file.type || (isPdf ? 'application/pdf' : 'application/octet-stream'),
          size: file.size,
          preview: isImage ? preview : undefined,
          ocrStatus: 'pending'
        });

        // Trigger server-side analysis via /api/upload
        try {
          const apiKey = typeof window !== 'undefined' ? localStorage.getItem('dam-openai-key') || '' : '';
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              type: file.type || (isPdf ? 'application/pdf' : 'application/octet-stream'),
              size: file.size,
              base64: preview,
              apiKey
            })
          });
          const data = await res.json();
          const currentIdx = attachments.length + index;

          if (res.ok && data.success && data.file) {
            onUpdateAttachment?.(currentIdx, {
              id: data.file.id,
              url: data.file.previewUrl,
              preview: isImage ? preview : undefined,
              extractedText: data.file.extractedText,
              ocrStatus: data.file.ocrStatus,
              threatEntities: data.file.threatEntities,
              documentAnalysis: data.file.documentAnalysis
            });
          } else {
            const errMsg = data.error || 'Failed to process document.';
            console.warn('Document processing warning:', errMsg);
            onUpdateAttachment?.(currentIdx, {
              ocrStatus: 'failed',
              extractedText: `[Document Processing Notice: ${errMsg}]`,
              documentAnalysis: data.file?.documentAnalysis
            });
            alert(`Document "${file.name}": ${errMsg}`);
          }
        } catch (err) {
          console.error('Upload Error:', err);
          const currentIdx = attachments.length + index;
          onUpdateAttachment?.(currentIdx, { ocrStatus: 'failed' });
        }
      };
      reader.readAsDataURL(file);
    });
    setAttachMenuOpen(false);
  };

  const handlePasteClipboard = async () => {
    setAttachMenuOpen(false);
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(input ? input + '\n' + text : text);
      }
    } catch {
      alert('Clipboard access denied or empty.');
    }
  };

  const handleToggleVoice = () => {
    interface SpeechRecognitionInstance {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onstart: () => void;
      onend: () => void;
      onerror: () => void;
      onresult: (event: { results: Array<Array<{ transcript: string }>> }) => void;
      start: () => void;
    }
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      alert('Voice recognition is not supported in this browser. Please type your query.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = activeLang === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: { results: Array<Array<{ transcript: string }>> }) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput(input ? input + ' ' + transcript : transcript);
        }
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isStreaming;

  const modeLabels: Record<string, string> = {
    evidence: 'Evidence Mode (Strict)',
    quick: 'Quick Check (Triage)',
    deep: 'Deep Investigation',
  };

  return (
    <div className="fixed-composer-wrapper" id="fixedComposerWrapper">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        multiple
        hidden
        onChange={e => { handleFileUpload(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={screenshotInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={e => { handleFileUpload(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={e => { handleFileUpload(e.target.files); e.target.value = ''; }}
      />

      {/* Modern ChatGPT-style Prompt Input Bar */}
      <form
        className="chatgpt-composer-pill"
        id="composer"
        onSubmit={e => {
          e.preventDefault();
          if (canSend) onSend();
        }}
      >
        {/* Attachment chips above input inside pill */}
        {attachments.length > 0 && (
          <div className="composer-attachments-row" aria-label="Attached files">
            {attachments.map((att, idx) => (
              <div key={idx} className={`composer-attachment-pill ${att.ocrStatus ? `ocr-${att.ocrStatus}` : ''}`}>
                {att.type === 'application/pdf' ? (
                  <FileIcon className="w-3.5 h-3.5 text-blue-400" />
                ) : att.isUrl ? (
                  <LinkIcon className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={att.preview} alt={att.name} className="composer-attachment-thumb" />
                )}
                <span className="composer-attachment-text">{att.name}</span>

                {/* Status Badges */}
                {att.ocrStatus === 'pending' && (
                  <span className="ocr-status-badge pending" title={att.isUrl ? "Ingesting and inspecting link..." : "Extracting text via OCR..."}>
                    <span className="ocr-dot-pulse" /> {att.isUrl ? 'Ingesting…' : 'OCR…'}
                  </span>
                )}
                {att.urlAnalysis && att.urlAnalysis.domainRisk.riskLevel === 'High' && (
                  <span className="doc-tag-pill" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }} title="High domain risk detected">
                    High Risk
                  </span>
                )}
                {att.urlAnalysis && att.urlAnalysis.claims.length > 0 && (
                  <span className="doc-tag-pill" title={`${att.urlAnalysis.claims.length} factual claims extracted`}>
                    {att.urlAnalysis.claims.length} claims
                  </span>
                )}
                {att.ocrStatus === 'success' && att.extractedText && (
                  <button
                    type="button"
                    className="ocr-action-chip"
                    onClick={() => {
                      if (att.extractedText) {
                        setInput(input ? `${input}\n\n${att.extractedText}` : att.extractedText);
                      }
                    }}
                    title={att.isUrl ? "Insert extracted page text into investigation prompt" : "Insert extracted OCR text into investigation inquiry"}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <span>Insert Text</span>
                  </button>
                )}

                <button
                  type="button"
                  className="composer-attachment-close"
                  onClick={() => onRemoveAttachment(idx)}
                  aria-label="Remove"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea Input */}
        <div className="composer-textarea-row">
          <textarea
            ref={textareaRef}
            id="promptInput"
            rows={1}
            placeholder={
              hasCompletedTurn
                ? "Ask a follow-up inquiry or investigate another message…"
                : "Work with UseDAM… (paste a claim, message, or link)"
            }
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
          />
        </div>

        {/* Bottom Toolbar inside the pill */}
        <div className="composer-toolbar-row">
          {/* Left: + (Plus) Attachment Button with Popover */}
          <div className="composer-left-actions" ref={attachMenuRef}>
            <button
              type="button"
              className={`composer-plus-btn ${attachMenuOpen ? 'active' : ''}`}
              title="Add attachment or link"
              aria-label="Add attachment"
              onClick={() => setAttachMenuOpen(prev => !prev)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14m-7-7h14" />
              </svg>
            </button>

            {/* Dropdown Menu for + Button */}
            {attachMenuOpen && (
              <div className="composer-attach-popover">
                <button
                  type="button"
                  className="attach-popover-item"
                  onClick={() => screenshotInputRef.current?.click()}
                >
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <div className="attach-item-text">
                    <strong>Screenshot</strong>
                    <small>PNG, JPEG, WebP</small>
                  </div>
                </button>

                <button
                  type="button"
                  className="attach-popover-item"
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <FileIcon className="w-4 h-4 text-blue-400" />
                  <div className="attach-item-text">
                    <strong>PDF Notice</strong>
                    <small>Official circulars up to 10MB</small>
                  </div>
                </button>

                <button
                  type="button"
                  className="attach-popover-item"
                  onClick={() => {
                    setAttachMenuOpen(false);
                    onOpenUrlModal();
                  }}
                >
                  <LinkIcon className="w-4 h-4 text-green-400" />
                  <div className="attach-item-text">
                    <strong>URL or Tweet</strong>
                    <small>Web page or post</small>
                  </div>
                </button>

                <button
                  type="button"
                  className="attach-popover-item"
                  onClick={handlePasteClipboard}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>
                  </svg>
                  <div className="attach-item-text">
                    <strong>Paste Clipboard</strong>
                    <small>Text from clipboard</small>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Right: Model selector pill, Language pill, Mic, Send */}
          <div className="composer-right-actions">
            {/* Model / Mode Selector Pill */}
            <div className="composer-model-pill" title="Investigation reasoning mode">
              <span>{modeLabels[activeMode] || 'Evidence Mode'}</span>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6"/>
              </svg>
              <select
                value={activeMode}
                onChange={e => setActiveMode(e.target.value)}
                className="composer-pill-select"
                aria-label="Investigation mode"
              >
                <option value="evidence">Evidence Mode (Strict)</option>
                <option value="quick">Quick Check (Triage)</option>
                <option value="deep">Deep Investigation</option>
              </select>
            </div>

            {/* Language Selector Pill */}
            <div className="composer-lang-pill" title="Output language">
              <span>{activeLang === 'auto' ? 'Auto' : activeLang.toUpperCase()}</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6"/>
              </svg>
              <select
                value={activeLang}
                onChange={e => setActiveLang(e.target.value)}
                className="composer-pill-select"
                aria-label="Output language"
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

            {/* Microphone / Voice Input Button */}
            <button
              type="button"
              className={`composer-icon-action-btn ${isListening ? 'listening' : ''}`}
              title={isListening ? 'Listening… click to stop' : 'Voice input (Hindi/English)'}
              aria-label="Voice input"
              onClick={handleToggleVoice}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" x2="12" y1="19" y2="22"/>
              </svg>
            </button>

            {/* Submit / Stop Button */}
            {isStreaming ? (
              <button
                type="button"
                className="composer-circle-submit-btn stop-state"
                onClick={onStop}
                title="Stop investigation"
                aria-label="Stop investigation"
              >
                <StopIcon className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                className={`composer-circle-submit-btn ${canSend ? 'can-send' : 'disabled'}`}
                disabled={!canSend}
                title="Send investigation (Enter)"
                aria-label="Send prompt"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5m-6 6 6-6 6 6"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Disclaimer Subtext */}
      <p className="composer-disclaimer-subtext">
        DAM prioritizes primary Indian gazettes and regulatory feeds. 
        <a href="#how-dam-verifies" onClick={e => { e.preventDefault(); alert("Open Methodology from the topbar or modal."); }}>
          {' '}How DAM verifies evidence &rarr;
        </a>
      </p>
    </div>
  );
};
