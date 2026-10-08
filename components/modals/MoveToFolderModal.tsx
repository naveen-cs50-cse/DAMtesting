'use client';

import React from 'react';
import { Conversation, Folder } from '@/lib/investigation/types';

interface MoveToFolderModalProps {
  conversation: Conversation | null;
  folders: Folder[];
  isOpen: boolean;
  onClose: () => void;
  onMoveToFolder: (conversationId: string, folderId: string | null) => void;
  onCreateNewFolder: () => void;
}

export const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({
  conversation,
  folders,
  isOpen,
  onClose,
  onMoveToFolder,
  onCreateNewFolder,
}) => {
  if (!isOpen || !conversation) return null;

  const currentFolderId = conversation.folderId || null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog move-folder-modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="move-folder-title-box">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <div>
              <h3>Move to Folder</h3>
              <p className="move-folder-subtitle">
                Organizing: &ldquo;{conversation.title.length > 40 ? `${conversation.title.slice(0, 40)}…` : conversation.title}&rdquo;
              </p>
            </div>
          </div>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        <div className="modal-body move-folder-modal-body">
          <div className="move-folder-options-list">
            {/* Unfiled option */}
            <button
              type="button"
              className={`move-folder-row ${!currentFolderId ? 'active' : ''}`}
              onClick={() => {
                onMoveToFolder(conversation.id, null);
                onClose();
              }}
            >
              <div className="move-folder-row-left">
                <span className="move-folder-icon-circle unfiled">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
                <div className="move-folder-info">
                  <span className="move-folder-name">Unfiled / No Folder</span>
                  <span className="move-folder-desc">Show in general recent history</span>
                </div>
              </div>
              {!currentFolderId && (
                <span className="move-folder-current-tag">Current</span>
              )}
            </button>

            {/* Existing folders */}
            {folders.map(folder => {
              const isSelected = currentFolderId === folder.id;
              const folderColor = folder.color || '#3b82f6';
              return (
                <button
                  key={folder.id}
                  type="button"
                  className={`move-folder-row ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    onMoveToFolder(conversation.id, folder.id);
                    onClose();
                  }}
                >
                  <div className="move-folder-row-left">
                    <span className="move-folder-icon-circle" style={{ backgroundColor: `${folderColor}20`, color: folderColor }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    </span>
                    <div className="move-folder-info">
                      <span className="move-folder-name">{folder.name}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="move-folder-current-tag">Current</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="move-folder-create-shortcut">
            <button
              type="button"
              className="move-folder-create-btn"
              onClick={() => {
                onClose();
                onCreateNewFolder();
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Create a new folder</span>
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="quiet-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
