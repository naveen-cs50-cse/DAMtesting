'use client';

import React, { useState, useRef } from 'react';
import { IndexedSource } from '@/lib/investigation/types';
import { GlobeIcon, ExternalIcon } from './icons';

interface FloatingEvidenceButtonProps {
  sources: IndexedSource[];
  onOpenFullEvidence: () => void;
  onCitationClick?: (index: number) => void;
}

export const FloatingEvidenceButton: React.FC<FloatingEvidenceButtonProps> = ({
  sources = [],
  onOpenFullEvidence,
  onCitationClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 220); // Smooth debounce so cursor can travel freely into popover
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenFullEvidence();
  };

  const count = sources.length;

  return (
    <div
      className="floating-evidence-anchor"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label="Evidence & Primary Sources"
    >
      {/* Evidence Popover on Hover */}
      <div
        className={`floating-evidence-popover ${isHovered ? 'visible' : ''}`}
        role="region"
        aria-label="Evidence preview"
      >
        {/* Header */}
        <div className="fep-header">
          <div className="fep-header-title">
            <GlobeIcon className="fep-globe-icon" />
            <span>Retrieved Sources</span>
            <span className="fep-count-pill">{count}</span>
          </div>
          <button
            type="button"
            className="fep-expand-btn"
            onClick={onOpenFullEvidence}
            title="Open full evidence explorer drawer (Alt+E)"
          >
            <span>Open Explorer</span>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        </div>

        {/* Content List */}
        <div className="fep-body custom-scrollbar">
          {count > 0 ? (
            <div className="fep-sources-list">
              {sources.map((src, idx) => (
                <div
                  key={`${src.id}-${idx}`}
                  className="fep-source-item"
                  onClick={() => {
                    if (onCitationClick) onCitationClick(src.id);
                    else onOpenFullEvidence();
                  }}
                >
                  <div className="fep-item-top">
                    <span className="fep-cite-badge">[{src.id}]</span>
                    <span className="fep-domain" title={src.domain}>{src.domain}</span>
                    <span className="fep-type-tag">
                      {src.contentOrigin === 'fetched_page' ? src.type : src.contentOrigin === 'search_snippet' ? 'Search snippet' : 'Search metadata'}
                    </span>
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="fep-ext-link"
                        onClick={e => e.stopPropagation()}
                        title={`Visit ${src.domain}`}
                      >
                        <ExternalIcon className="fep-ext-icon" />
                      </a>
                    )}
                  </div>
                  <div className="fep-item-title">{src.title}</div>
                  {src.passage && (
                    <div className="fep-item-passage">
                      &ldquo;{src.passage.length > 130 ? src.passage.slice(0, 130) + '...' : src.passage}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="fep-empty-state">
              <div className="fep-empty-icon">
                <GlobeIcon />
              </div>
              <div className="fep-empty-title">No evidence retrieved yet</div>
              <div className="fep-empty-desc">
                Submit an inquiry or claim to retrieve source records for evaluation.
              </div>
              <div className="fep-registries-hint">
                <div className="fep-reg-label">Only completed lookups appear in this evidence view.</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="fep-footer">
          <span>Click globe icon to open full Evidence Drawer</span>
          <kbd className="fep-kbd">Alt+E</kbd>
        </div>
      </div>

      {/* World Icon Button with Number on Top Little */}
      <button
        type="button"
        className={`floating-evidence-btn ${isHovered ? 'active-hover' : ''}`}
        onClick={handleButtonClick}
        title="View Evidence & Primary Sources (Alt+E)"
        aria-label={`Evidence Sources: ${count} retrieved`}
      >
        <span className="world-icon-wrapper">
          <GlobeIcon className="evidence-world-icon" />
        </span>
        
        {/* Number on Top Little Badge */}
        <span className="evidence-badge-counter">
          {count}
        </span>
      </button>
    </div>
  );
};
