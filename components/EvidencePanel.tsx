'use client';

import React, { useState } from 'react';
import { IndexedSource } from '@/lib/investigation/types';
import { CopyIcon, EvidenceIcon, ExternalIcon } from './icons';

interface EvidencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  sources: IndexedSource[];
  allSources?: IndexedSource[];
  highlightIndex?: number | null;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  isOpen,
  onClose,
  sources,
  allSources = [],
  highlightIndex,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'case' | 'all'>('case');
  const [stanceFilter, setStanceFilter] = useState<'all' | 'supports' | 'contradicts' | 'context'>('all');
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

  const dataset = activeTab === 'all' && allSources.length > 0 ? allSources : sources;

  const filtered = dataset.filter(s => {
    if (stanceFilter !== 'all' && s.stance !== stanceFilter) return false;
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
    const text = `"[${src.id}] ${src.passage}" — ${src.title} (${src.domain}, ${src.date})\n${src.url}`;
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
      <aside className="evidence-panel open" aria-label="Evidence Explorer & Repository">
      <div className="evidence-panel-head">
        <div className="evidence-panel-title">
          <EvidenceIcon className="evidence-panel-icon" />
          <div>
            <strong>Evidence Explorer</strong>
            <small>{dataset.length} indexed primary records</small>
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

      {/* Scope Switcher Tabs (Phase 4) */}
      <div className="evidence-scope-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'case'}
          className={`evidence-scope-btn ${activeTab === 'case' ? 'active' : ''}`}
          onClick={() => setActiveTab('case')}
        >
          <span>Active Case ({sources.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          className={`evidence-scope-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <span>All Cases ({allSources.length})</span>
        </button>
      </div>

      {/* Filter and Stance Controls */}
      <div className="evidence-panel-filter">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
        <input
          type="text"
          placeholder="Search by keyword, circular, or domain..."
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

      <div className="evidence-stance-filters">
        <button
          type="button"
          className={`stance-filter-chip ${stanceFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStanceFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`stance-filter-chip supports ${stanceFilter === 'supports' ? 'active' : ''}`}
          onClick={() => setStanceFilter('supports')}
        >
          Supports
        </button>
        <button
          type="button"
          className={`stance-filter-chip contradicts ${stanceFilter === 'contradicts' ? 'active' : ''}`}
          onClick={() => setStanceFilter('contradicts')}
        >
          Contradicts
        </button>
        <button
          type="button"
          className={`stance-filter-chip context ${stanceFilter === 'context' ? 'active' : ''}`}
          onClick={() => setStanceFilter('context')}
        >
          Context
        </button>
      </div>

      <div className="evidence-panel-body">
        {filtered.length === 0 ? (
          <div className="evidence-empty-view">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p>No primary evidence matching filters</p>
            {filterQuery && (
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => { setFilterQuery(''); setStanceFilter('all'); }}
              >
                Reset filters
              </button>
            )}
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
                <span className="evidence-index-badge">[{src.id}]</span>
                <span className="evidence-card-domain">{src.domain}</span>
                <span className={`evidence-stance-badge ${src.stance || 'context'}`}>
                  {src.stance === 'supports' ? 'Supports Claim' : src.stance === 'contradicts' ? 'Contradicts Claim' : 'Context'}
                </span>
              </div>
              <a href={src.url} target="_blank" rel="noopener noreferrer" className="evidence-card-title">
                {src.title} <ExternalIcon className="w-3 h-3 inline-block ml-1" />
              </a>
              <div className="evidence-passage">
                &ldquo;{src.passage}&rdquo;
              </div>
              <div className="evidence-card-foot">
                <div className="evidence-card-meta">
                  <span>Published {src.date}</span>
                  <span>&bull;</span>
                  <span>{src.type}</span>
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
