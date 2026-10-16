'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Conversation, Folder, getQueryVerdictStatus } from '@/lib/investigation/types';
import { ShieldIcon } from './icons';
import { WhatsAppModal } from './modals/WhatsAppModal';
import { ExtensionModal } from './modals/ExtensionModal';

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
  hasQuery?: boolean;
  onOpenEvidence: () => void;
  onOpenMethodology?: () => void;
  onToggleSidebar?: () => void;
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
  hasQuery = false,
  onOpenEvidence,
  onOpenMethodology,
  onToggleSidebar,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [isMac] = useState(() => typeof navigator !== 'undefined' && /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent));

  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bookmarksRef = useRef<HTMLDivElement>(null);
  const bookmarksTriggerRef = useRef<HTMLButtonElement>(null);

  // Close profile menu and bookmarks drawer on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
      if (
        bookmarksOpen &&
        bookmarksRef.current &&
        !bookmarksRef.current.contains(target) &&
        bookmarksTriggerRef.current &&
        !bookmarksTriggerRef.current.contains(target)
      ) {
        setBookmarksOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setBookmarksOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, bookmarksOpen]);

  const filtered = conversations.filter(c => 
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Conversations in bookmarks (marked with isPinned)
  const bookmarkedList = filtered.filter(c => c.isPinned);
  const unfiled = filtered.filter(c => !c.folderId);

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
          <span className="sidebar-dot-slot" aria-hidden="true">
            {status === 'right' ? (
              <span className="sidebar-verdict-dot true" title="Verified: True" />
            ) : status === 'false' ? (
              <span className="sidebar-verdict-dot false" title="Verified: False" />
            ) : (
              <span className="sidebar-verdict-dot other" title={status === 'unverified' ? "Unverified" : "Conversation"} />
            )}
          </span>
          <div className="history-text-col" style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <span className="history-title-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', fontSize: '13px', lineHeight: '1.2' }}>
              {item.title}
            </span>
          </div>
        </button>
        <div className="history-actions" role="toolbar" aria-label="Conversation actions">
          <button
            type="button"
            className={`history-action-btn ${item.isPinned ? 'active' : ''}`}
            title={item.isPinned ? "Remove from Bookmarks" : "Bookmark investigation"}
            aria-label={item.isPinned ? "Remove from Bookmarks" : "Bookmark investigation"}
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

  const renderGroup = (label: string, items: Conversation[]) => {
    if (!items.length) return null;
    return (
      <div className="history-group">
        <div className="history-group-title">
          <span>{label}</span>
        </div>
        {items.map(item => renderConversationItem(item))}
      </div>
    );
  };

  return (
    <aside className="sidebar" id="sidebar" aria-label="Investigation Workspace Sidebar">
      {/* Brand Header */}
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

      {/* New Investigation Button */}
      <div style={{ padding: '12px 12px 6px' }}>
        <button 
          className="new-investigation-btn" 
          onClick={onNewConversation} 
          title={`Start a fresh investigation (${isMac ? 'Cmd+K' : 'Ctrl+K'})`}
          style={{ width: '100%', margin: 0 }}
        >
          <span className="sidebar-btn-icon-slot">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14"/></svg>
          </span>
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>New investigation</span>
        </button>
      </div>

      {/* Bookmarks Access Button */}
      <div style={{ padding: '0 12px 6px' }}>
        <button
          ref={bookmarksTriggerRef}
          type="button"
          className="new-investigation-btn"
          onClick={() => setBookmarksOpen(prev => !prev)}
          title="View Bookmarks"
          style={{
            width: '100%',
            margin: 0,
            background: bookmarksOpen ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.035)',
            borderColor: bookmarksOpen ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <span className="sidebar-btn-icon-slot">
            <svg viewBox="0 0 24 24" width="15" height="15" fill={bookmarksOpen || bookmarkedList.length > 0 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>Bookmarks</span>
          {bookmarkedList.length > 0 && (
            <span className="sidebar-evidence-pill" style={{ fontSize: '10.5px' }}>
              {bookmarkedList.length}
            </span>
          )}
        </button>
      </div>

      {/* WhatsApp Agent Entry Point */}
      <div style={{ padding: '0 12px 6px' }}>
        <button
          type="button"
          className="new-investigation-btn sidebar-tool-btn"
          onClick={() => setWhatsappModalOpen(true)}
          title="WhatsApp Verification Agent — Forward & verify on mobile"
          style={{
            width: '100%',
            margin: 0,
            background: 'rgba(255, 255, 255, 0.035)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <span className="sidebar-btn-icon-slot whatsapp-slot">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.15c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.13.82.84-3.05-.2-.32a8.19 8.19 0 0 1-1.25-4.37c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.01 4.54-3.69 8.24-8.23 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.55c.12.17 1.73 2.65 4.2 3.71.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.3z"/>
            </svg>
          </span>
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>WhatsApp Bot</span>
          <span className="sidebar-pill-tag whatsapp-tag">Live</span>
        </button>
      </div>

      {/* Browser Extension Entry Point */}
      <div style={{ padding: '0 12px 6px' }}>
        <button
          type="button"
          className="new-investigation-btn sidebar-tool-btn"
          onClick={() => setExtensionModalOpen(true)}
          title="DAM Browser Extension — Real-time social & web claims fact-checker"
          style={{
            width: '100%',
            margin: 0,
            background: 'rgba(255, 255, 255, 0.035)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <span className="sidebar-btn-icon-slot extension-slot">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.5 14.5A2.5 2.5 0 0 0 18 12V6a2 2 0 0 0-2-2h-6a2.5 2.5 0 0 0-5 0H3a1 1 0 0 0-1 1v4.5A2.5 2.5 0 0 0 4.5 12 2.5 2.5 0 0 0 2 14.5V19a1 1 0 0 0 1 1h4.5a2.5 2.5 0 0 0 5 0H16a2 2 0 0 0 2-2v-1.5a2.5 2.5 0 0 0 2.5-2.5z" />
            </svg>
          </span>
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>Extension</span>
          <span className="sidebar-pill-tag extension-tag">Chrome</span>
        </button>
      </div>

      {/* Bookmarks Flyout Drawer */}
      {bookmarksOpen && (
        <div
          ref={bookmarksRef}
          className="sidebar-bookmarks-drawer"
          role="region"
          aria-label="Bookmarks Explorer"
        >
          <div className="sidebar-head" style={{ padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              <strong style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>Bookmarks</strong>
              <span className="sidebar-evidence-pill" style={{ fontSize: '10.5px' }}>{bookmarkedList.length}</span>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setBookmarksOpen(false)}
              style={{ color: '#a3a3a3' }}
              title="Close bookmarks"
              aria-label="Close bookmarks"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="history-list custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {bookmarkedList.length === 0 ? (
              <div style={{ padding: '36px 16px', color: '#71717a', fontSize: '13px', textAlign: 'center', lineHeight: '1.5' }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 8px', opacity: 0.5, display: 'block' }}>
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                No bookmarked investigations yet.
                <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
                  Click the bookmark icon on any chat to save it here.
                </div>
              </div>
            ) : (
              bookmarkedList.map(item => renderConversationItem(item))
            )}
          </div>
        </div>
      )}


      {/* Search Input Filter for Past Investigations */}
      {conversations.length > 3 && (
        <div className="sidebar-search-box" style={{ margin: '0 12px 8px' }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" className="sidebar-search-icon" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            className="sidebar-search-input"
            placeholder="Search history..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="sidebar-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>
      )}

      {/* Conversation History List */}
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

      {/* Clean User Profile Foot */}
      <div className="sidebar-foot" style={{ padding: '8px 12px' }}>
        <button
          ref={triggerRef}
          className="history-item"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', border: 'none', background: 'transparent', color: 'var(--dam-text-primary)', cursor: 'pointer', borderRadius: '8px' }}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#ffffff', color: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
            HK
          </div>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#e4e4e7' }}>Hitesh Kumar</span>
        </button>

        {menuOpen && (
          <div className="workspace-menu-popover" ref={menuRef} role="menu" style={{ 
            position: 'absolute', bottom: '60px', left: '12px', width: 'calc(100% - 24px)', 
            backgroundColor: '#111114', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', 
            padding: '4px 0', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.8)' 
          }}>
            <button
              type="button"
              className="menu-item"
              style={{ display: 'flex', width: '100%', padding: '10px 14px', color: '#d4d4d8', background: 'transparent', border: 'none', gap: '10px', fontSize: '13px', cursor: 'pointer', alignItems: 'center' }}
              onClick={() => {
                setMenuOpen(false);
                if (onOpenMethodology) onOpenMethodology();
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span>Methodology</span>
            </button>
            <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />
            <button
              type="button"
              className="menu-item"
              style={{ display: 'flex', width: '100%', padding: '10px 14px', color: '#d4d4d8', background: 'transparent', border: 'none', gap: '10px', fontSize: '13px', cursor: 'pointer', alignItems: 'center' }}
              onClick={() => {
                setMenuOpen(false);
                window.open('https://github.com/DAM-Technologys-Private-Limited/Usedam-Main-Webapp', '_blank');
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
              <span>GitHub Repository</span>
            </button>
          </div>
        )}
      </div>

      {/* WhatsApp Verification Agent Modal */}
      <WhatsAppModal
        isOpen={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
      />

      {/* Browser Extension Modal */}
      <ExtensionModal
        isOpen={extensionModalOpen}
        onClose={() => setExtensionModalOpen(false)}
      />
    </aside>
  );
};
