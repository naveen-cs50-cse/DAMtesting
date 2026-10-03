'use client';

import React, { useState } from 'react';
import { Conversation } from '@/lib/investigation/types';
import { EvidenceIcon, ShieldIcon } from './icons';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (conv: Conversation) => void;
  onDeleteConversation: (id: string) => void;
  onTogglePinConversation: (id: string) => void;
  evidenceCount: number;
  onOpenEvidence: () => void;
  onOpenApiKeys?: () => void;
  onOpenMethodology?: () => void;
}

function formatRelativeTime(dateInput?: string | number | Date): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0 || isNaN(diffMs)) return '';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onTogglePinConversation,
  evidenceCount,
  onOpenEvidence,
  onOpenApiKeys,
  onOpenMethodology,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    setIsMac(typeof navigator !== 'undefined' && /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent));
  }, []);

  // Close profile menu on outside click or Escape key
  React.useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const filtered = conversations.filter(c => 
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinned = filtered.filter(c => c.isPinned);
  const unpinned = filtered.filter(c => !c.isPinned);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const last7Days = today - 6 * 86400000;

  const groups: { today: Conversation[]; yesterday: Conversation[]; last7: Conversation[]; older: Conversation[] } = {
    today: [],
    yesterday: [],
    last7: [],
    older: [],
  };

  unpinned.forEach(c => {
    const time = new Date(c.createdAt || Date.now()).getTime();
    if (time >= today) groups.today.push(c);
    else if (time >= yesterday) groups.yesterday.push(c);
    else if (time >= last7Days) groups.last7.push(c);
    else groups.older.push(c);
  });

  const renderGroup = (label: string, items: Conversation[], isPinnedGroup: boolean = false) => {
    if (!items.length) return null;
    return (
      <div className={`history-group ${isPinnedGroup ? 'pinned-history-group' : ''}`}>
        <div className="history-group-title">
          {isPinnedGroup && (
            <svg viewBox="0 0 24 24" width="12" height="12" fill="var(--dam-amber)" stroke="none" className="mr-1">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          )}
          <span>{label}</span>
        </div>
        {items.map(item => (
          <div
            key={item.id}
            className={`history-item-wrap ${item.id === activeId ? 'current' : ''}`}
          >
            <button
              type="button"
              className={`history-item ${item.id === activeId ? 'active' : ''}`}
              onClick={() => onSelectConversation(item.id)}
              title={item.title}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" className="history-item-icon" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <div className="history-text-col">
                <span className="history-title-text">
                  {item.title}
                </span>
                <div className="history-meta-subline">
                  {item.isPinned && <span className="history-pin-star" title="Pinned case">★</span>}
                  {item.createdAt && (
                    <span className="history-time-hint">{formatRelativeTime(item.createdAt)}</span>
                  )}
                </div>
              </div>
            </button>
            <div className="history-actions" role="toolbar" aria-label="Conversation actions">
              <button
                type="button"
                className={`history-action-btn pin-btn ${item.isPinned ? 'pinned active' : ''}`}
                title={item.isPinned ? 'Unpin case' : 'Pin case to top'}
                aria-label={item.isPinned ? 'Unpin' : 'Pin'}
                onClick={e => {
                  e.stopPropagation();
                  onTogglePinConversation(item.id);
                }}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill={item.isPinned ? 'var(--dam-amber)' : 'none'} stroke={item.isPinned ? 'var(--dam-amber)' : 'currentColor'} strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
              <button
                type="button"
                className="history-action-btn"
                title="Rename investigation"
                aria-label="Rename"
                onClick={e => {
                  e.stopPropagation();
                  onRenameConversation(item);
                }}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button
                type="button"
                className="history-action-btn delete"
                title="Delete investigation"
                aria-label="Delete"
                onClick={e => {
                  e.stopPropagation();
                  onDeleteConversation(item.id);
                }}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <aside className="sidebar" id="sidebar" aria-label="Investigation Workspace Sidebar">
      <div className="sidebar-head">
        <a 
          className="brand" 
          href="/" 
          onClick={e => { 
            e.preventDefault(); 
            if (typeof document !== 'undefined' && document.body.classList.contains('sidebar-collapsed')) {
              document.body.classList.remove('sidebar-collapsed');
            } else {
              onNewConversation();
            }
          }}
          title={typeof document !== 'undefined' && document.body.classList.contains('sidebar-collapsed') ? "Click to expand sidebar" : "New investigation"}
        >
          <img 
            src="/assets/dam-mark-transparent.png" 
            alt="DAM" 
            className="brand-mark-img" 
          />
          <span className="brand-copy">
            <strong>DAM</strong>
            <small>DEFENCE AGAINST MISINFORMATION</small>
          </span>
        </a>
        <button
          className="icon-button collapse-btn"
          id="collapseSidebar"
          aria-label="Collapse sidebar"
          title="Toggle sidebar (Ctrl+B)"
          onClick={() => document.body.classList.toggle('sidebar-collapsed')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>

      <button className="new-investigation-btn" onClick={onNewConversation} title={`Start a fresh investigation (${isMac ? 'Cmd+K' : 'Ctrl+K'})`}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
        <span>New investigation</span>
        <kbd aria-label="Keyboard shortcut">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <nav className="primary-nav" aria-label="Primary views">
        <button className="nav-item nav-item-evidence" onClick={onOpenEvidence} title="Open Evidence Explorer (Alt+E)">
          <EvidenceIcon className="w-4 h-4 evidence-folder-icon" />
          <span>Evidence library</span>
          {evidenceCount > 0 && <span className="nav-badge evidence-count-badge">{evidenceCount}</span>}
        </button>
      </nav>

      <div className="history-section">
        <div className="history-label">
          <span>Recent</span>
        </div>

        <div className="sidebar-search-box">
          <svg className="sidebar-search-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="sidebar-search-input"
            placeholder="Search recent..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search investigations"
          />
          {searchQuery && (
            <button
              type="button"
              className="sidebar-search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        <div className="history-list" role="region" aria-label="Investigation History">
          {conversations.length === 0 ? (
            <div className="history-empty">
              <div className="history-empty-radar">
                <span className="radar-ring" />
                <div className="history-empty-icon"><ShieldIcon /></div>
              </div>
              <p>No recent investigations on this workstation.</p>
              <button
                type="button"
                className="history-empty-start-btn"
                onClick={onNewConversation}
              >
                <span>Start verification</span>
                <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="history-empty">
              <p>No matches for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : (
            <>
              {renderGroup('Pinned Cases', pinned, true)}
              {renderGroup('Today', groups.today)}
              {renderGroup('Yesterday', groups.yesterday)}
              {renderGroup('Previous 7 Days', groups.last7)}
              {renderGroup('Older', groups.older)}
            </>
          )}
        </div>
      </div>

      <div className="sidebar-foot">
        <button
          ref={triggerRef}
          className={`workspace-chip ${menuOpen ? 'menu-active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
          title="Hitesh's workspace (Pro)"
        >
          <span className="avatar">HK</span>
          <span className="workspace-copy">
            <strong>Hitesh&apos;s workspace</strong>
            <small>India Regulatory &amp; Scam Desk</small>
          </span>
          <svg viewBox="0 0 24 24" className="chevron-up" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 15l6-6 6 6"/></svg>
        </button>

        {menuOpen && (
          <div className="workspace-menu-popover" ref={menuRef} role="menu">
            <div className="menu-header">
              <div className="menu-user-row">
                <div className="menu-user-details">
                  <span className="menu-user-name">Hitesh Kumar</span>
                  <span className="menu-user-email">hitesh@usedam.ai</span>
                </div>
                <span className="plan-tag">Pro</span>
              </div>
            </div>

            <div className="menu-quota-box">
              <div className="menu-quota-label">
                <span>Monthly Quota</span>
                <strong>84 / 500 used</strong>
              </div>
              <div className="menu-quota-bar">
                <div className="menu-quota-fill" style={{ width: '16.8%' }} />
              </div>
            </div>

            <div className="menu-divider" />

            <button
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                onOpenMethodology?.();
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
              <span>Verification Settings</span>
            </button>

            <button
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                onOpenApiKeys?.();
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              <span>API Keys &amp; Integrations</span>
            </button>

            <button
              className="menu-item"
              onClick={() => {
                document.body.classList.toggle('sidebar-collapsed');
                setMenuOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              <span>Toggle Sidebar</span>
              <kbd>{isMac ? '⌘B' : 'Ctrl B'}</kbd>
            </button>

            <div className="menu-divider" />

            <button
              className="menu-item danger"
              onClick={() => {
                setMenuOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
