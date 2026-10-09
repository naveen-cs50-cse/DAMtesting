'use client';

import React from 'react';
import Image from 'next/image';
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
  onOpenShare?: () => void;
  sidebarOpen?: boolean;
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
  onOpenShare,
  sidebarOpen = true,
}) => {
  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Mobile Hamburger */}
        <button
          className="icon-button mobile-menu"
          id="mobileMenu"
          aria-label="Open sidebar menu"
          onClick={onMobileMenuToggle}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>

        {/* Desktop Sidebar Toggle (Only visible when sidebar is closed) */}
        {!sidebarOpen && (
          <button
            className="brand desktop-sidebar-toggle"
            title="Open sidebar"
            onClick={onMobileMenuToggle}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              marginRight: '24px', 
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              paddingLeft: '0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', color: '#a3a3a3' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </div>
            <Image 
              src="/assets/dam-mark-transparent.png" 
              alt="DAM" 
              width={28}
              height={28}
              className="brand-mark-img" 
            />
            <span className="brand-copy" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <strong style={{ fontSize: '15px', color: '#fff', letterSpacing: '0.5px', lineHeight: '1' }}>DAM</strong>
              <small style={{ fontSize: '10px', color: '#a3a3a3', letterSpacing: '0.2px', lineHeight: '1' }}>DEFENCE AGAINST MISINFORMATION</small>
            </span>
          </button>
        )}

        <div className="page-title">
          <span className={`status-pulse ${isLive ? 'live' : ''}`} aria-hidden="true" />
          {title !== 'New investigation' && <strong>{title}</strong>}
          {caseId && (
            <>
              <span className="case-id-badge">CASE #{caseId}</span>
              <span className="case-id-mini" title={`Case #${caseId}`} aria-label={`Case ${caseId}`}>
                #{caseId.split('-').pop() || caseId}
              </span>
            </>
          )}
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

        {onOpenShare && (
          <button
            className="quiet-button"
            onClick={onOpenShare}
            title="Share or Export Investigation Briefing"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>Share</span>
          </button>
        )}


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
