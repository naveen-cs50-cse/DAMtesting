'use client';

import React, { useState, useEffect } from 'react';
import { Conversation } from '@/lib/investigation/types';

interface RenameModalProps {
  conversation: Conversation | null;
  onClose: () => void;
  onSave: (id: string, newTitle: string) => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({ conversation, onClose, onSave }) => {
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (conversation) {
      const timer = setTimeout(() => {
        setTitle(conversation.title);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [conversation]);

  if (!conversation) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-header">
          <h3>Rename Investigation</h3>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>
        <div className="modal-body">
          <input
            type="text"
            className="modal-input"
            maxLength={80}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && title.trim()) {
                onSave(conversation.id, title.trim());
                onClose();
              }
            }}
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="quiet-button" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              if (title.trim()) {
                onSave(conversation.id, title.trim());
                onClose();
              }
            }}
          >
            Save Name
          </button>
        </div>
      </div>
    </div>
  );
};
