'use client';

import React from 'react';
import { EvidenceIcon } from './icons';

interface TopbarProps {
  title: string;
  caseId?: string;
  isLive?: boolean;
  onOpenApiKeys: () => void;
  onOpenMethodology: () => void;
  onToggleEvidence: () => void;
  evidenceCount: number;
  onMobileMenuToggle: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  caseId,
  isLive = false,
  onOpenApiKeys,
  onOpenMethodology,
  onToggleEvidence,
  evidenceCount,
  onMobileMenuToggle,
}) => {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="icon-button mobile-menu"
          id="mobileMenu"
          aria-label="Open sidebar menu"
          onClick={onMobileMenuToggle}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <div className="page-title">
          <span className={`status-pulse ${isLive ? 'live' : ''}`} aria-hidden="true" />
          <strong>{title}</strong>
          {caseId && <span className="case-id-badge">CASE #{caseId}</span>}
        </div>
      </div>

      <div className="topbar-actions">
        <button
          className="quiet-button"
          onClick={onOpenApiKeys}
          title="Configure API Keys & LLM Provider"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>API Keys</span>
        </button>

        <button
          className="quiet-button"
          onClick={onToggleEvidence}
          title="Toggle Evidence Explorer (Alt+E)"
        >
          <EvidenceIcon className="w-3.5 h-3.5" />
          <span>Evidence</span>
          {evidenceCount > 0 && <span className="nav-badge">{evidenceCount}</span>}
        </button>

        <button
          className="quiet-button"
          onClick={() => window.print()}
          title="Print or Export PDF Report"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>
          <span>Report (PDF)</span>
        </button>

        <button
          className="quiet-button text-link"
          onClick={onOpenMethodology}
          title="How DAM verifies evidence"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>Methodology</span>
        </button>
      </div>
    </header>
  );
};
