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
  evidenceCount: number;
  onOpenEvidence: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  evidenceCount,
  onOpenEvidence,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const filtered = conversations.filter(c => 
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  filtered.forEach(c => {
    const time = new Date(c.createdAt || Date.now()).getTime();
    if (time >= today) groups.today.push(c);
    else if (time >= yesterday) groups.yesterday.push(c);
    else if (time >= last7Days) groups.last7.push(c);
    else groups.older.push(c);
  });

  const renderGroup = (label: string, items: Conversation[]) => {
    if (!items.length) return null;
    return (
      <div className="history-group">
        <div className="history-group-title">{label}</div>
        {items.map(item => (
          <div
            key={item.id}
            className={`history-item ${item.id === activeId ? 'active' : ''}`}
            onClick={() => onSelectConversation(item.id)}
          >
            <span className="history-title">{item.title}</span>
            <div className="history-item-actions">
              <button
                type="button"
                className="history-action-btn"
                title="Rename"
                onClick={e => {
                  e.stopPropagation();
                  onRenameConversation(item);
                }}
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button
                type="button"
                className="history-action-btn"
                title="Delete"
                onClick={e => {
                  e.stopPropagation();
                  onDeleteConversation(item.id);
                }}
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
        <a className="brand" href="/" onClick={e => { e.preventDefault(); onNewConversation(); }}>
          <span className="brand-mark" aria-hidden="true">D</span>
          <span className="brand-copy">
            <strong>DAM</strong>
            <small>AI workspace</small>
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

      <button className="new-investigation-btn" onClick={onNewConversation} title="Start a fresh investigation (Cmd/Ctrl+K)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
        <span>New investigation</span>
        <kbd aria-label="Keyboard shortcut">⌘K</kbd>
      </button>

      <nav className="primary-nav" aria-label="Primary views">
        <button className="nav-item active" onClick={onNewConversation}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5M11 8v6M8 11h6"/></svg>
          <span>Investigate</span>
        </button>
        <button className="nav-item" onClick={onOpenEvidence}>
          <EvidenceIcon className="w-4 h-4" />
          <span>Evidence library</span>
          {evidenceCount > 0 && <span className="nav-badge">{evidenceCount}</span>}
        </button>
        <button className="nav-item" onClick={() => window.print()}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 17v-2m4 2v-5m4 5v-3"/></svg>
          <span>Reports</span>
        </button>
      </nav>

      <div className="history-section">
        <div className="history-label">
          <span>Recent</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: 100,
                fontSize: 11,
                padding: '2px 6px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--dam-border-subtle)',
                borderRadius: 4,
                color: 'var(--dam-text-secondary)',
              }}
            />
          </div>
        </div>

        <div className="history-list" role="region" aria-label="Investigation History">
          {conversations.length === 0 ? (
            <div className="history-empty">
              <div className="history-empty-icon"><ShieldIcon /></div>
              <p>No recent investigations recorded on this workstation.</p>
            </div>
          ) : (
            <>
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
          className="workspace-chip"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <span className="avatar">HK</span>
          <span className="workspace-copy">
            <strong>Hitesh&apos;s workspace</strong>
            <small>India Regulatory &amp; Scam Desk</small>
          </span>
          <svg viewBox="0 0 24 24" className="chevron-up" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 15l6-6 6 6"/></svg>
        </button>

        {menuOpen && (
          <div className="workspace-menu-popover" role="menu">
            <div className="menu-header">
              <span className="menu-user-email">hitesh@usedam.ai</span>
              <span className="plan-tag">Pro Workspace</span>
            </div>
            <div className="menu-divider" />
            <button className="menu-item" onClick={() => setMenuOpen(false)}>
              <span>Verification Settings</span>
            </button>
            <button className="menu-item" onClick={() => setMenuOpen(false)}>
              <div className="menu-item-text">
                <span>Usage &amp; API Quota</span>
                <small>84 / 500 verifications used</small>
              </div>
            </button>
            <div className="menu-divider" />
            <button className="menu-item danger" onClick={() => setMenuOpen(false)}>
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
