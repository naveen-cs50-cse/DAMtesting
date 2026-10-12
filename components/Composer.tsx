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
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Auto-resize textarea to fit text (min 28px, max 160px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.max(28, Math.min(scrollH, 160)) + 'px';
    }
  }, [input]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (attachMenuRef.current && !attachMenuRef.current.contains(target)) {
        setAttachMenuOpen(false);
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(target)) {
        setModeMenuOpen(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(target)) {
        setLangMenuOpen(false);
      }
    };
    if (attachMenuOpen || modeMenuOpen || langMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [attachMenuOpen, modeMenuOpen, langMenuOpen]);

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

  const modeOptions = [
    {
      value: 'evidence',
      title: 'Evidence Mode (Strict)',
      badge: 'Strict',
      badgeColor: '#3b82f6',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
      description: 'Gazettes, official circulars & primary Indian registries only'
    },
    {
      value: 'quick',
      title: 'Quick Check (Triage)',
      badge: 'Fast',
      badgeColor: '#eab308',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
      description: 'Rapid threat classification & immediate scam triage'
    },
    {
      value: 'deep',
      title: 'Deep Investigation',
      badge: 'Forensic',
      badgeColor: '#a855f7',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      ),
      description: 'Multi-source forensic audit with legal certificate & dossier'
    }
  ];

  const languageOptions = [
    { value: 'auto', label: 'Auto-detect', native: 'Default / Match Input', icon: '🌐' },
    { value: 'en', label: 'English', native: 'Official English Briefing', icon: '🇬🇧' },
    { value: 'hi', label: 'हिन्दी', native: 'हिंदी में विस्तृत जांच ब्रीफिंग', icon: '🇮🇳' },
    { value: 'mr', label: 'मराठी', native: 'मराठीत कायदेशीर स्पष्टीकरण', icon: '🇮🇳' },
    { value: 'ta', label: 'தமிழ்', native: 'தமிழில் சரிபார்ப்பு அறிக்கை', icon: '🇮🇳' },
    { value: 'bn', label: 'বাংলা', native: 'বাংলায় সত্যতা যাচাই ও বিশ্লেষণ', icon: '🇮🇳' },
    { value: 'te', label: 'తెలుగు', native: 'తెలుగులో అధికారిక నివేదిక', icon: '🇮🇳' },
  ];

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
            {/* Custom Animated Model / Mode Selector Pill */}
            <div className="composer-menu-wrapper" ref={modeMenuRef}>
              <button
                type="button"
                className={`composer-model-pill ${modeMenuOpen ? 'open' : ''}`}
                title="Investigation reasoning mode"
                onClick={() => {
                  setModeMenuOpen(prev => !prev);
                  setLangMenuOpen(false);
                  setAttachMenuOpen(false);
                }}
              >
                <span className="pill-dot" />
                <span>{modeLabels[activeMode] || 'Evidence Mode'}</span>
                <svg
                  viewBox="0 0 24 24"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`pill-chevron ${modeMenuOpen ? 'chevron-rotated' : ''}`}
                >
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>

              {modeMenuOpen && (
                <div className="custom-dropdown-popover mode-dropdown-popover">
                  <div className="dropdown-popover-header">
                    <span>REASONING MODE</span>
                    <span className="dropdown-popover-tag">AI CORE</span>
                  </div>
                  <div className="dropdown-options-list">
                    {modeOptions.map(opt => {
                      const isSelected = activeMode === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={`custom-dropdown-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setActiveMode(opt.value);
                            setModeMenuOpen(false);
                          }}
                        >
                          <div className="dropdown-item-icon-wrap">
                            {opt.icon}
                          </div>
                          <div className="dropdown-item-text">
                            <div className="dropdown-item-title-row">
                              <span className="dropdown-item-title">{opt.title}</span>
                              <span
                                className="dropdown-item-badge"
                                style={{
                                  borderColor: `${opt.badgeColor}40`,
                                  color: opt.badgeColor,
                                  backgroundColor: `${opt.badgeColor}15`
                                }}
                              >
                                {opt.badge}
                              </span>
                            </div>
                            <span className="dropdown-item-desc">{opt.description}</span>
                          </div>
                          {isSelected && (
                            <div className="dropdown-item-check">
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Animated Language Selector Pill */}
            <div className="composer-menu-wrapper" ref={langMenuRef}>
              <button
                type="button"
                className={`composer-lang-pill ${langMenuOpen ? 'open' : ''}`}
                title="Output language"
                onClick={() => {
                  setLangMenuOpen(prev => !prev);
                  setModeMenuOpen(false);
                  setAttachMenuOpen(false);
                }}
              >
                <span>{languageOptions.find(l => l.value === activeLang)?.label || 'Auto'}</span>
                <svg
                  viewBox="0 0 24 24"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`pill-chevron ${langMenuOpen ? 'chevron-rotated' : ''}`}
                >
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>

              {langMenuOpen && (
                <div className="custom-dropdown-popover lang-dropdown-popover">
                  <div className="dropdown-popover-header">
                    <span>OUTPUT VERNACULAR</span>
                    <span className="dropdown-popover-tag">MULTI-LINGUAL</span>
                  </div>
                  <div className="dropdown-options-list">
                    {languageOptions.map(l => {
                      const isSelected = activeLang === l.value;
                      return (
                        <button
                          key={l.value}
                          type="button"
                          className={`custom-dropdown-item lang-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setActiveLang(l.value);
                            setLangMenuOpen(false);
                          }}
                        >
                          <span className="lang-flag">{l.icon}</span>
                          <div className="dropdown-item-text">
                            <span className="dropdown-item-title">{l.label}</span>
                            <span className="dropdown-item-desc">{l.native}</span>
                          </div>
                          {isSelected && (
                            <div className="dropdown-item-check">
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
