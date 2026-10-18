'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { HelpCircleIcon, ShareIcon, SettingsIcon } from './icons';
import { QueryVerdictStatus, ResponseLanguage } from '@/lib/investigation/types';

interface TopbarProps {
  title: string;
  caseId?: string;
  isLive?: boolean;
  hasQuery?: boolean;
  onOpenMethodology: () => void;
  onOpenSettings?: () => void;
  onToggleEvidence: () => void;
  evidenceCount: number;
  onMobileMenuToggle: () => void;
  onOpenShare?: () => void;
  sidebarOpen?: boolean;
  verdictStatus?: QueryVerdictStatus | null;
  language?: ResponseLanguage;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  caseId,
  isLive = false,
  hasQuery = false,
  onOpenMethodology,
  onOpenSettings,
  onToggleEvidence,
  evidenceCount,
  onMobileMenuToggle,
  onOpenShare,
  sidebarOpen = true,
  verdictStatus,
  language = 'en',
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const verdictLabels = language === 'hi'
    ? { right: 'सत्य', false: 'असत्य', unverified: 'अप्रमाणित' }
    : language === 'ta'
      ? { right: 'உண்மை', false: 'தவறு', unverified: 'சரிபார்க்கப்படவில்லை' }
      : { right: 'True', false: 'False', unverified: 'Unverified' };
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
            <span className="topbar-verdict-text true" title={verdictLabels.right}>
              {verdictLabels.right}
            </span>
          )}
          {hasQuery && verdictStatus === 'false' && (
            <span className="topbar-verdict-text false" title={verdictLabels.false}>
              {verdictLabels.false}
            </span>
          )}
          {hasQuery && verdictStatus === 'unverified' && (
            <span className="topbar-verdict-text unverified" title={verdictLabels.unverified}>
              {verdictLabels.unverified}
            </span>
          )}
        </div>
      </div>

      <div className="topbar-actions">
        {hasQuery && onOpenShare && (
          <button
            className="quiet-button icon-only-btn"
            onClick={onOpenShare}
            title="Share or Export Investigation Briefing"
            aria-label="Share Briefing"
          >
            <ShareIcon className="w-4 h-4" />
          </button>
        )}

        <button
          className="quiet-button icon-only-btn"
          onClick={onOpenMethodology}
          title="Methodology: How DAM verifies evidence"
          aria-label="Methodology"
        >
          <HelpCircleIcon className="w-4 h-4" />
        </button>

        {onOpenSettings && (
          <button
            className="quiet-button icon-only-btn"
            onClick={onOpenSettings}
            title="Verification & System Settings"
            aria-label="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
