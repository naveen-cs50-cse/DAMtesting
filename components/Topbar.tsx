'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { EvidenceIcon } from './icons';
import { QueryVerdictStatus } from '@/lib/investigation/types';

interface TopbarProps {
  title: string;
  caseId?: string;
  isLive?: boolean;
  hasQuery?: boolean;
  onOpenMethodology: () => void;
  onToggleEvidence: () => void;
  evidenceCount: number;
  onMobileMenuToggle: () => void;
  onOpenShare?: () => void;
  sidebarOpen?: boolean;
  verdictStatus?: QueryVerdictStatus | null;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  caseId,
  isLive = false,
  hasQuery = false,
  onOpenMethodology,
  onToggleEvidence,
  evidenceCount,
  onMobileMenuToggle,
  onOpenShare,
  sidebarOpen = true,
  verdictStatus,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
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
          {isLive && <span className="status-pulse live" aria-hidden="true" />}
          {hasQuery && title !== 'New investigation' && <strong>{title}</strong>}
          {/* Simple basic text verdict indicator: True / False in light green / red */}
          {hasQuery && verdictStatus === 'right' && (
            <span className="topbar-verdict-text true" title="Verified: True">
              True
            </span>
          )}
          {hasQuery && verdictStatus === 'false' && (
            <span className="topbar-verdict-text false" title="Verified: False">
              False
            </span>
          )}
          {hasQuery && verdictStatus === 'unverified' && (
            <span className="topbar-verdict-text unverified" title="Unverified">
              Unverified
            </span>
          )}
        </div>
      </div>

      <div className="topbar-actions">
        {/* Evidence button: Only displayed when an active query exists with verified evidence */}
        {hasQuery && mounted && evidenceCount > 0 && (
          <button
            className="quiet-button"
            onClick={onToggleEvidence}
            title="Toggle Evidence Explorer (Alt+E)"
            suppressHydrationWarning
          >
            <EvidenceIcon className="w-3.5 h-3.5" />
            <span>Evidence</span>
            <span className="nav-badge">{evidenceCount}</span>
          </button>
        )}

        {hasQuery && onOpenShare && (
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
