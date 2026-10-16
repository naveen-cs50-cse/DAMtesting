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


  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isStreaming;

  const modeOptions = [
    { value: 'evidence', label: 'Evidence' },
    { value: 'quick', label: 'Quick Check' },
    { value: 'deep', label: 'Deep Investigation' },
  ];

  const modeValues = ['evidence', 'quick', 'deep'];
  const modeIndex = Math.max(0, modeValues.indexOf(activeMode));

  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState<number | null>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);

  const currentPercent = isDragging && dragPercent !== null ? dragPercent : (modeIndex / 2) * 100;
  const previewIndex = isDragging && dragPercent !== null
    ? (dragPercent >= 66.6 ? 2 : dragPercent >= 33.3 ? 1 : 0)
    : modeIndex;

  const lastWheelTimeRef = useRef(0);
  const handleSliderWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastWheelTimeRef.current < 160) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta > 8) {
      if (modeIndex < 2) {
        setActiveMode(modeValues[modeIndex + 1]);
        lastWheelTimeRef.current = now;
      }
    } else if (delta < -8) {
      if (modeIndex > 0) {
        setActiveMode(modeValues[modeIndex - 1]);
        lastWheelTimeRef.current = now;
      }
    }
  };

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const track = sliderTrackRef.current || e.currentTarget;
    const rect = track.getBoundingClientRect();

    const calcPercent = (clientX: number) => {
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      return rect.width > 0 ? (x / rect.width) * 100 : 0;
    };

    const initialPercent = calcPercent(e.clientX);
    setIsDragging(true);
    setDragPercent(initialPercent);

    const onPointerMove = (ev: PointerEvent) => {
      setDragPercent(calcPercent(ev.clientX));
    };

    const onPointerUp = (ev: PointerEvent) => {
      const finalPct = calcPercent(ev.clientX);
      let snapIdx = 0;
      if (finalPct >= 66.6) snapIdx = 2;
      else if (finalPct >= 33.3) snapIdx = 1;
      else snapIdx = 0;

      setIsDragging(false);
      setDragPercent(null);
      setActiveMode(modeValues[snapIdx]);

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const languageOptions = [
    { value: 'auto', label: 'Auto-detect' },
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'हिन्दी' },
    { value: 'mr', label: 'मराठी' },
    { value: 'ta', label: 'தமிழ்' },
    { value: 'bn', label: 'বাংলা' },
    { value: 'te', label: 'తెలుగు' },
  ];

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
                  <ImageIcon className="w-4 h-4 text-zinc-300" />
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
                  <FileIcon className="w-4 h-4 text-zinc-300" />
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
                  <LinkIcon className="w-4 h-4 text-zinc-300" />
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
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-300">
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
            {/* Reasoning Mode Pill (Press to open horizontal 3-point scrollable/movable slider) */}
            <div className="composer-menu-wrapper" ref={modeMenuRef}>
              <button
                type="button"
                className={`composer-lang-pill ${modeMenuOpen ? 'open' : ''}`}
                title="Reasoning mode"
                onClick={() => {
                  setModeMenuOpen(prev => !prev);
                  setLangMenuOpen(false);
                  setAttachMenuOpen(false);
                }}
              >
                <span>{modeOptions.find(m => m.value === activeMode)?.label || 'Evidence'}</span>
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
                <div className="simple-slider-popover" onWheel={handleSliderWheel}>
                  <div className="simple-slider-header">
                    <div className="simple-slider-title-tag">
                      <span>Reasoning Mode</span>
                    </div>
                    <span className="simple-slider-active-badge">
                      {modeOptions[previewIndex]?.label}
                    </span>
                  </div>

                  <div className="simple-slider-body">
                    {/* Interactive Horizontal Track with real-time cursor dragging */}
                    <div
                      ref={sliderTrackRef}
                      className={`simple-slider-track-area ${isDragging ? 'dragging' : ''}`}
                      onPointerDown={handleTrackPointerDown}
                    >
                      <div className="simple-slider-track">
                        <div
                          className="simple-slider-fill"
                          style={{
                            width: `${currentPercent}%`,
                            transition: isDragging ? 'none' : undefined,
                          }}
                        />
                      </div>

                      {/* 3 Tick notches along the track */}
                      <div className="simple-slider-ticks">
                        <span className={`slider-tick ${currentPercent >= 0 ? 'active' : ''}`} style={{ left: '0%' }} />
                        <span className={`slider-tick ${currentPercent >= 48 ? 'active' : ''}`} style={{ left: '50%' }} />
                        <span className={`slider-tick ${currentPercent >= 98 ? 'active' : ''}`} style={{ left: '100%' }} />
                      </div>

                      {/* Movable Slider Thumb that moves with cursor */}
                      <div
                        className={`simple-slider-thumb ${isDragging ? 'dragging' : ''}`}
                        style={{
                          left: `${currentPercent}%`,
                          transition: isDragging ? 'none' : undefined,
                        }}
                      >
                        <span className="slider-thumb-inner" />
                      </div>
                    </div>

                    {/* 3 Clickable point labels below the track - spaced far apart with no overlap */}
                    <div className="simple-slider-labels-row">
                      {modeOptions.map((opt, i) => {
                        const isSelected = previewIndex === i;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`slider-label-item pos-${i} ${isSelected ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMode(opt.value);
                            }}
                          >
                            <span className="slider-label-text">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Beside Language Selector: Simple UI, No Colors, Clean Heading, Just Language Names */}
            <div className="composer-menu-wrapper" ref={langMenuRef}>
              <button
                type="button"
                className={`composer-lang-pill ${langMenuOpen ? 'open' : ''}`}
                title="Output language"
                onClick={() => {
                  setLangMenuOpen(prev => !prev);
                  setAttachMenuOpen(false);
                }}
              >
                <span>{languageOptions.find(l => l.value === activeLang)?.label || 'Auto-detect'}</span>
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
                <div className="simple-lang-popover">
                  <div className="simple-lang-header">
                    <span>Languages</span>
                  </div>
                  <div className="simple-lang-list">
                    {languageOptions.map(l => {
                      const isSelected = activeLang === l.value;
                      return (
                        <button
                          key={l.value}
                          type="button"
                          className={`simple-lang-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setActiveLang(l.value);
                            setLangMenuOpen(false);
                          }}
                        >
                          <span className="simple-lang-name">{l.label}</span>
                          {isSelected && (
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" className="simple-lang-check">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>



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
      </p>
    </div>
  );
};
