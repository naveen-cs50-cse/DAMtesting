'use client';

import React, { useState, useEffect } from 'react';
import { Folder } from '@/lib/investigation/types';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderToEdit?: Folder | null;
  onSave: (name: string, color: string) => void;
}

const PRESET_COLORS = [
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Cyan', value: '#06b6d4' },
];

export const FolderModal: React.FC<FolderModalProps> = ({
  isOpen,
  onClose,
  folderToEdit,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (folderToEdit) {
        setName(folderToEdit.name);
        setColor(folderToEdit.color || '#3b82f6');
      } else {
        setName('');
        setColor('#3b82f6');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [folderToEdit, isOpen]);

  if (!isOpen) return null;

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), color);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog folder-modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="folder-modal-title-row">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" style={{ color }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <h3>{folderToEdit ? 'Rename Folder' : 'Create New Folder'}</h3>
          </div>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        <form onSubmit={handleFormSubmit}>
          <div className="modal-body">
            <div className="folder-field-group">
              <label htmlFor="folderNameInput" className="folder-field-label">Folder Name</label>
              <input
                id="folderNameInput"
                type="text"
                className="modal-input"
                placeholder="e.g. Electricity Bill Scams, KYC Frauds, FIR Dossiers"
                maxLength={50}
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="folder-field-group">
              <span className="folder-field-label">Accent Color</span>
              <div className="folder-color-picker">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    className={`folder-color-swatch ${color === c.value ? 'selected' : ''}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setColor(c.value)}
                    title={c.label}
                    aria-label={`Select ${c.label} color`}
                  >
                    {color === c.value && (
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="quiet-button" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="primary-btn"
              disabled={!name.trim()}
            >
              {folderToEdit ? 'Save Changes' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
