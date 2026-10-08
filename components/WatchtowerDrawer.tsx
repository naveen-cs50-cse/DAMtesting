'use client';

import React, { useState, useEffect } from 'react';
import { WATCHTOWER_FEED } from '@/lib/investigation/watchtower';

interface WatchtowerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WatchtowerDrawer: React.FC<WatchtowerDrawerProps> = ({ isOpen, onClose }) => {
  const [category, setCategory] = useState<string>('All');
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = ['All', 'Banking', 'Telecom', 'Government Scheme', 'Cyber Security'];

  const filteredItems = WATCHTOWER_FEED.filter(item => {
    const matchesCat = category === 'All' || item.category === category;
    const matchesSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.summary.toLowerCase().includes(search.toLowerCase()) ||
      item.source.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="watchtower-backdrop" onClick={onClose}>
      <aside
        className="watchtower-drawer"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="National Regulatory Watchtower Feed"
      >
        <div className="watchtower-header">
          <div className="watchtower-title-group">
            <div className="watchtower-beacon">
              <span className="beacon-ping" />
              <span className="beacon-dot" />
            </div>
            <div>
              <h3 className="watchtower-title">National Regulatory Watchtower</h3>
              <p className="watchtower-subtitle">Live verified repository from PIB, RBI, TRAI & CERT-In</p>
            </div>
          </div>
          <button
            type="button"
            className="watchtower-close-btn"
            onClick={onClose}
            aria-label="Close Watchtower"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="watchtower-filter-bar">
          <div className="watchtower-search-box">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search debunks & circulars..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="watchtower-search-input"
            />
          </div>

          <div className="watchtower-categories">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                className={`watchtower-cat-pill ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Advisories Feed List */}
        <div className="watchtower-feed-list">
          {filteredItems.map(item => (
            <article key={item.id} className={`watchtower-card verdict-${item.verdict.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="watchtower-card-top">
                <span className="watchtower-source-badge">{item.source}</span>
                <span className={`watchtower-verdict-pill ${item.verdict.toLowerCase().replace(/\s+/g, '-')}`}>
                  {item.verdict}
                </span>
              </div>
              <h4 className="watchtower-item-title">{item.title}</h4>
              <p className="watchtower-item-summary">{item.summary}</p>
              <div className="watchtower-card-bottom">
                <span className="watchtower-date">{item.date} &bull; {item.bulletinId}</span>
                <a
                  href={item.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="watchtower-verify-link"
                >
                  Verify at Source
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
};
