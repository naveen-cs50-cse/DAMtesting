'use client';

import React, { useState } from 'react';
import { IndexedSource } from '@/lib/investigation/types';
import { EvidenceIcon, ExternalIcon } from './icons';

interface EvidencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  sources: IndexedSource[];
  highlightIndex?: number | null;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  isOpen,
  onClose,
  sources,
  highlightIndex,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  if (!isOpen) return null;

  const filtered = sources.filter(s => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) ||
           s.domain.toLowerCase().includes(q) ||
           s.passage.toLowerCase().includes(q);
  });

  return (
    <aside className={`evidence-panel ${isOpen ? 'open' : ''}`} aria-label="Evidence & Primary Sources Panel">
      <div className="evidence-panel-head">
        <div className="evidence-panel-title">
          <EvidenceIcon className="evidence-panel-icon" />
          <div>
            <strong>Evidence &amp; Sources</strong>
            <small>{sources.length} indexed primary records</small>
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

      <div className="evidence-panel-filter">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
        <input
          type="text"
          placeholder="Filter sources by title, domain, or claim..."
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
        />
      </div>

      <div className="evidence-panel-body">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--dam-text-muted)' }}>
            <p>No sources matching &quot;{filterQuery}&quot;</p>
          </div>
        ) : (
          filtered.map(src => (
            <div
              key={src.id}
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
              <div style={{ fontSize: 11, color: 'var(--dam-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Published {src.date}</span>
                <span>{src.type}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
