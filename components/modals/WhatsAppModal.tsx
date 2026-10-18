'use client';

import React, { useEffect, useState } from 'react';
import type { PublicIntegrationStatus } from '@/lib/integrations/destinations';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [integration, setIntegration] = useState<PublicIntegrationStatus['whatsapp'] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch('/api/integrations/status', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Status unavailable')))
      .then((data: PublicIntegrationStatus) => { if (active) setIntegration(data.whatsapp); })
      .catch(() => { if (active) setIntegration({ status: 'not_configured', destination: null, displayNumber: null }); });
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!integration?.destination) return;
    navigator.clipboard.writeText(integration.destination);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="DAM WhatsApp Agent">
      <div className="methodology-modal whatsapp-agent-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="methodology-brand">
            <div className="channel-modal-icon-badge whatsapp-badge">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.15c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.13.82.84-3.05-.2-.32a8.19 8.19 0 0 1-1.25-4.37c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.01 4.54-3.69 8.24-8.23 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.55c.12.17 1.73 2.65 4.2 3.71.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.3z"/>
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0 }}>DAM WhatsApp Agent</h3>
                <span className="live-status-pill">{integration?.status === 'configured' ? 'Configured' : 'Coming soon'}</span>
              </div>
              <small>Forward &amp; verify viral claims directly on your mobile device</small>
            </div>
          </div>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        <div className="methodology-body" style={{ gap: '16px' }}>
          <div className="channel-connect-card">
            <div className="channel-qr-frame">
              <div className="qr-code-box">
                <svg viewBox="0 0 24 24" width="54" height="54" fill="#25D366"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2z"/></svg>
              </div>
              <span className="qr-scan-label">{integration?.destination ? integration.displayNumber : 'Not configured'}</span>
            </div>

            <div className="channel-info-col">
              <h4>How Mobile Verification Works</h4>
              <ul className="channel-features-list">
                <li>
                  <span className="channel-step-dot">1</span>
                  <div>
                    <strong>Forward any suspicious forward or SMS</strong>
                    <p>Simply forward suspicious WhatsApp forwards, APK download notices, or power cut SMS alerts directly to the chat.</p>
                  </div>
                </li>
                <li>
                  <span className="channel-step-dot">2</span>
                  <div>
                    <strong>Upload screenshots &amp; voice notes</strong>
                    <p>Our agent analyzes Hindi, English, and regional dialect claims against official regulatory gazettes.</p>
                  </div>
                </li>
                <li>
                  <span className="channel-step-dot">3</span>
                  <div>
                    <strong>Receive instant verified debunks</strong>
                    <p>Get a concise factual verdict with verified references to RBI, PIB Fact Check, TRAI, and CERT-In advisories.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleCopyLink}
            disabled={!integration?.destination}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {copied ? (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#22c55e" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy Invite Link</span>
              </>
            )}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="secondary-btn" onClick={onClose}>Close</button>
            <a
              href={integration?.destination || undefined}
              target={integration?.destination ? '_blank' : undefined}
              rel={integration?.destination ? 'noopener noreferrer' : undefined}
              aria-disabled={!integration?.destination}
              onClick={event => { if (!integration?.destination) event.preventDefault(); }}
              className={`primary-btn${integration?.destination ? '' : ' disabled'}`}
              style={{ background: '#25D366', borderColor: '#22c55e', color: '#000000', fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>{integration?.destination ? 'Open in WhatsApp' : 'Not configured'}</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
