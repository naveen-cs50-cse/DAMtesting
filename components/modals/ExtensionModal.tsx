'use client';

import React from 'react';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="DAM Browser Extension">
      <div className="methodology-modal extension-agent-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="methodology-brand">
            <div className="channel-modal-icon-badge extension-badge">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.5 14.5A2.5 2.5 0 0 0 18 12V6a2 2 0 0 0-2-2h-6a2.5 2.5 0 0 0-5 0H3a1 1 0 0 0-1 1v4.5A2.5 2.5 0 0 0 4.5 12 2.5 2.5 0 0 0 2 14.5V19a1 1 0 0 0 1 1h4.5a2.5 2.5 0 0 0 5 0H16a2 2 0 0 0 2-2v-1.5a2.5 2.5 0 0 0 2.5-2.5z" />
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0 }}>DAM Browser Extension</h3>
                <span className="live-status-pill blue">Chrome &amp; Edge</span>
              </div>
              <small>Real-time fact-checking across news, social feeds, and web pages</small>
            </div>
          </div>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        <div className="methodology-body" style={{ gap: '16px' }}>
          <div className="channel-connect-card">
            <div className="extension-hero-frame">
              <div className="extension-browser-mockup">
                <div className="mockup-header">
                  <span className="mockup-dot red" />
                  <span className="mockup-dot yellow" />
                  <span className="mockup-dot green" />
                  <span className="mockup-url-bar">x.com / post / 184920...</span>
                </div>
                <div className="mockup-body">
                  <div className="mockup-claim-badge">
                    <span className="mockup-shield-dot" />
                    <strong>DAM Shield Active</strong>
                  </div>
                  <p className="mockup-claim-text">&quot;RBI has banned ₹500 notes starting next week...&quot;</p>
                  <div className="mockup-verdict-tag refuted">Refuted &bull; RBI Circular #84</div>
                </div>
              </div>
            </div>

            <div className="channel-info-col">
              <h4>Key Extension Capabilities</h4>
              <ul className="channel-features-list">
                <li>
                  <span className="channel-step-dot blue">⚡</span>
                  <div>
                    <strong>Social Media Feed Overlay</strong>
                    <p>Detects viral disinformation on X (Twitter), YouTube, and Reddit with verified fact-check badges in your feed.</p>
                  </div>
                </li>
                <li>
                  <span className="channel-step-dot blue">🛡️</span>
                  <div>
                    <strong>Phishing &amp; Clone Site Interceptor</strong>
                    <p>Immediately blocks deceptive banking APK downloads and fake electricity disconnection payment portals.</p>
                  </div>
                </li>
                <li>
                  <span className="channel-step-dot blue">🔍</span>
                  <div>
                    <strong>Right-Click Instant Fact-Check</strong>
                    <p>Highlight any claim on any webpage and right-click &quot;Verify with DAM&quot; to inspect against Indian gazettes.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#71717a' }}>
            <span>Compatible with: Chrome &bull; Brave &bull; Edge &bull; Arc</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="secondary-btn" onClick={onClose}>Close</button>
            <a
              href="https://chromewebstore.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="primary-btn"
              style={{ background: '#3b82f6', borderColor: '#60a5fa', color: '#ffffff', fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>Add to Chrome</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
