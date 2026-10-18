'use client';

import React, { useState } from 'react';
import { IndexedSource } from '@/lib/investigation/types';
import { CopyIcon, EvidenceIcon, ExternalIcon } from './icons';

interface EvidencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  sources: IndexedSource[];
  highlightIndex?: number | null;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  isOpen,
  onClose,
  sources = [],
  highlightIndex,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = sources.filter(s => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.domain.toLowerCase().includes(q) ||
      s.passage.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q)
    );
  });

  const handleCopyPassage = (src: IndexedSource) => {
    const origin = src.contentOrigin === 'fetched_page' ? 'Fetched page content' : 'Search-result snippet';
    const text = `[${src.id}] ${origin}: "${src.passage}" — ${src.title} (${src.domain}, ${src.date})\n${src.url}`;
    navigator.clipboard.writeText(text);
    setCopiedId(src.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      <div 
        className="evidence-panel-backdrop show"
        aria-hidden="true" 
        onClick={onClose} 
      />
      <aside className="evidence-panel open" aria-label="Evidence Explorer">
        <div className="evidence-panel-head">
          <div className="evidence-panel-title">
            <EvidenceIcon className="evidence-panel-icon" />
            <div>
              <strong>Evidence</strong>
              <small>{sources.length} deduplicated {sources.length === 1 ? 'record' : 'records'}</small>
            </div>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close evidence panel"
            title="Close panel (Esc)"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Clean minimal Search Filter (only when sources exist) */}
        {sources.length > 2 && (
          <div className="evidence-panel-filter">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
            <input
              type="text"
              placeholder="Filter evidence by keyword or domain..."
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
            />
            {filterQuery && (
              <button
                type="button"
                className="sidebar-search-clear"
                onClick={() => setFilterQuery('')}
                title="Clear filter"
              >
                &times;
              </button>
            )}
          </div>
        )}

        <div className="evidence-panel-body">
          {sources.length === 0 ? (
            <div className="evidence-empty-view">
              <div className="evidence-empty-icon-wrap">
                <EvidenceIcon className="w-8 h-8 text-muted" />
              </div>
              <strong>No Evidence Required Yet</strong>
              <p>Submit a claim or query to search, cross-reference, and verify primary records.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="evidence-empty-view">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <p>No retrieved evidence matching &ldquo;{filterQuery}&rdquo;</p>
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => setFilterQuery('')}
              >
                Reset search
              </button>
            </div>
          ) : (
            filtered.map(src => (
              <div
                key={`${src.id}-${src.url}`}
                className={`evidence-card ${src.id === highlightIndex ? 'highlight-target' : ''}`}
                id={`evidence-card-${src.id}`}
                data-index={src.id}
              >
                <div className="evidence-card-header">
                  <div className="evidence-card-source-row">
                    <span className="evidence-index-badge">[{src.id}]</span>
                    <span className="evidence-card-domain">{src.domain}</span>
                  </div>
                  {src.stance && (
                    <span className="evidence-stance-badge">
                      {src.stance === 'supports' ? 'Supports' : src.stance === 'contradicts' ? 'Contradicts' : 'Context'}
                    </span>
                  )}
                </div>

                <a href={src.url} target="_blank" rel="noopener noreferrer" className="evidence-card-title">
                  <span>{src.title}</span>
                  <ExternalIcon className="w-3.5 h-3.5 flex-shrink-0" />
                </a>

                <div className="evidence-passage">
                  &ldquo;{src.passage}&rdquo;
                </div>

                <div className="evidence-card-foot">
                  <div className="evidence-card-meta">
                    <span>{src.contentOrigin === 'fetched_page' ? 'Fetched page content' : 'Search snippet'}</span>
                    <span>&bull;</span>
                    <span>{src.inspectionStatus === 'inspected' ? 'Page inspected' : src.inspectionStatus === 'unavailable' ? 'Page unavailable' : 'Page not inspected'}</span>
                    {src.isCited && <><span>&bull;</span><span>Cited</span></>}
                  </div>
                  <button
                    type="button"
                    className={`evidence-copy-btn ${copiedId === src.id ? 'copied' : ''}`}
                    title="Copy citation & passage"
                    onClick={() => handleCopyPassage(src)}
                  >
                    {copiedId === src.id ? (
                      <>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon className="w-3 h-3" />
                        <span>Cite</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
};
