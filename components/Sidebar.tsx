'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Conversation, Folder, getQueryVerdictStatus } from '@/lib/investigation/types';
import { EvidenceIcon, ShieldIcon } from './icons';

interface SidebarProps {
  conversations: Conversation[];
  folders: Folder[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (conv: Conversation) => void;
  onDeleteConversation: (id: string) => void;
  onTogglePinConversation: (id: string) => void;
  onOpenCreateFolder: () => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveToFolder: (convId: string, folderId: string | null) => void;
  onOpenMoveToFolderModal: (conv: Conversation) => void;
  evidenceCount: number;
  onOpenEvidence: () => void;
  onOpenApiKeys?: () => void;
  onOpenMethodology?: () => void;
  onToggleSidebar?: () => void;
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
  conversations = [],
  folders = [],
  activeId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onTogglePinConversation,
  onOpenCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onMoveToFolder,
  onOpenMoveToFolderModal,
  evidenceCount,
  onOpenEvidence,
  onOpenApiKeys,
  onOpenMethodology,
  onToggleSidebar,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [isMac] = useState(() => typeof navigator !== 'undefined' && /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent));
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('dam-expanded-folders');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleToggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const updated = { ...prev, [folderId]: prev[folderId] === false ? true : false };
      try {
        localStorage.setItem('dam-expanded-folders', JSON.stringify(updated));
      } catch {
        // Ignored
      }
      return updated;
    });
  };

  // Close profile menu on outside click or Escape key
  useEffect(() => {
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

  // Unfiled conversations (not assigned to any folder)
  const unfiled = filtered.filter(c => !c.folderId);
  const pinnedUnfiled = unfiled.filter(c => c.isPinned);
  const unpinnedUnfiled = unfiled.filter(c => !c.isPinned);

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

  unfiled.forEach(c => {
    const time = new Date(c.createdAt || 0).getTime();
    if (time >= today) groups.today.push(c);
    else if (time >= yesterday) groups.yesterday.push(c);
    else if (time >= last7Days) groups.last7.push(c);
    else groups.older.push(c);
  });

  const renderConversationItem = (item: Conversation) => {
    const latestAssistant = item.turns?.filter(t => t.role === 'assistant').slice(-1)[0];
    const status = getQueryVerdictStatus(latestAssistant?.meta);

    return (
      <div
        key={item.id}
        className={`history-item-wrap ${item.id === activeId ? 'current' : ''}`}
        draggable={true}
        onDragStart={e => e.dataTransfer.setData('text/plain', item.id)}
      >
        <button
          type="button"
          className={`history-item ${item.id === activeId ? 'active' : ''}`}
          onClick={() => onSelectConversation(item.id)}
          title={item.title}
        >
          {status === 'right' && (
            <span className="sidebar-verdict-tag right" title="Verified Correct">✔</span>
          )}
          {status === 'false' && (
            <span className="sidebar-verdict-tag false" title="False / Debunked / Scam">✖</span>
          )}
          {status === 'unverified' && (
            <span className="sidebar-verdict-tag unverified" title="Needs Verification">
              <span className="sidebar-white-dot" />
            </span>
          )}
          {!status && (
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" className="history-item-icon" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
          <div className="history-text-col" style={{ width: '100%', overflow: 'hidden' }}>
            <span className="history-title-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', fontSize: '13px', lineHeight: '1.2' }}>
              {item.title}
            </span>
          </div>
        </button>
        <div className="history-actions" role="toolbar" aria-label="Conversation actions">
          <button
            type="button"
            className={`history-action-btn ${item.isPinned ? 'active' : ''}`}
            title={item.isPinned ? "Remove bookmark" : "Bookmark"}
            aria-label="Bookmark"
            onClick={e => {
              e.stopPropagation();
              onTogglePinConversation(item.id);
            }}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill={item.isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
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
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
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
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    );
  };

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
        {items.map(item => renderConversationItem(item))}
      </div>
    );
  };

  return (
    <aside className="sidebar" id="sidebar" aria-label="Investigation Workspace Sidebar">
      <div className="sidebar-head">
        <Link 
          className="brand" 
          href="/" 
          onClick={e => { 
            e.preventDefault(); 
            onNewConversation();
          }}
          title="New investigation"
          style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}
        >
          <Image 
            src="/assets/dam-mark-transparent.png" 
            alt="DAM" 
            width={28}
            height={28}
            className="brand-mark-img" 
          />
          <span className="brand-copy" style={{ overflow: 'hidden' }}>
            <strong>DAM</strong>
            <small style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>DEFENCE AGAINST MISINFORMATION</small>
          </span>
        </Link>
        <button
          className="icon-button collapse-btn"
          id="collapseSidebar"
          aria-label="Collapse sidebar"
          title="Toggle sidebar (Ctrl+B)"
          onClick={() => {
            if (onToggleSidebar) onToggleSidebar();
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>

      <button className="new-investigation-btn" onClick={onNewConversation} title={`Start a fresh investigation (${isMac ? 'Cmd+K' : 'Ctrl+K'})`}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>
        <span>New investigation</span>
        <kbd aria-label="Keyboard shortcut">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <button className="new-investigation-btn" style={{ margin: '0 12px 6px' }} onClick={() => setBookmarksOpen(!bookmarksOpen)} title="View Bookmarks">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        <span>Bookmarks</span>
      </button>

      {bookmarksOpen && (
        <div style={{
          position: 'absolute',
          left: '100%',
          top: 0,
          width: '260px',
          height: '100%',
          backgroundColor: '#171717',
          borderLeft: '1px solid #333',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
        }}>
          <div className="sidebar-head" style={{ padding: '0 16px' }}>
            <strong style={{ color: '#fff', fontSize: '15px' }}>Bookmarks</strong>
            <button className="icon-button" onClick={() => setBookmarksOpen(false)} style={{ color: '#a3a3a3' }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="history-list" style={{ flex: 1, overflowY: 'auto' }}>
            {pinnedUnfiled.length === 0 ? (
              <div style={{ padding: '24px 16px', color: '#888', fontSize: '13px', textAlign: 'center' }}>No bookmarked chats.</div>
            ) : (
              pinnedUnfiled.map(item => renderConversationItem(item))
            )}
          </div>
        </div>
      )}

      <div className="history-section">

        <div className="history-list" role="region" aria-label="Investigation History">
          {isMounted ? (
            conversations.length === 0 ? (
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
                {renderGroup('Today', groups.today)}
                {renderGroup('Yesterday', groups.yesterday)}
                {renderGroup('Previous 7 Days', groups.last7)}
                {renderGroup('Older', groups.older)}
              </>
            )
          ) : null}
        </div>
      </div>

      <div className="sidebar-foot" style={{ padding: '8px 12px' }}>
        <button
          ref={triggerRef}
          className="history-item"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', border: 'none', background: 'transparent', color: 'var(--dam-text-primary)', cursor: 'pointer', borderRadius: '8px' }}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#fff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
            HK
          </div>
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Hitesh Kumar</span>
        </button>

        {menuOpen && (
          <div className="workspace-menu-popover" ref={menuRef} role="menu" style={{ 
            position: 'absolute', bottom: '60px', left: '12px', width: 'calc(100% - 24px)', 
            backgroundColor: '#202123', borderRadius: '8px', border: '1px solid #333', 
            padding: '4px 0', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' 
          }}>
            <button
              type="button"
              className="menu-item"
              style={{ display: 'flex', width: '100%', padding: '10px 16px', color: '#ececf1', background: 'transparent', border: 'none', gap: '10px', fontSize: '14px', cursor: 'pointer', alignItems: 'center' }}
              onClick={() => {
                setMenuOpen(false);
                if (onOpenApiKeys) onOpenApiKeys();
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              <span>API Settings</span>
            </button>
            <button
              type="button"
              className="menu-item"
              style={{ display: 'flex', width: '100%', padding: '10px 16px', color: '#ececf1', background: 'transparent', border: 'none', gap: '10px', fontSize: '14px', cursor: 'pointer', alignItems: 'center' }}
              onClick={() => {
                setMenuOpen(false);
                if (onOpenMethodology) onOpenMethodology();
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span>Methodology</span>
            </button>
            <div style={{ height: '1px', backgroundColor: '#333', margin: '4px 0' }} />
            <button
              type="button"
              className="menu-item"
              style={{ display: 'flex', width: '100%', padding: '10px 16px', color: '#ececf1', background: 'transparent', border: 'none', gap: '10px', fontSize: '14px', cursor: 'pointer', alignItems: 'center' }}
              onClick={() => {
                setMenuOpen(false);
                window.open('https://github.com/DAM-Technologys-Private-Limited/Usedam-Main-Webapp', '_blank');
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
              <span>GitHub Repository</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
