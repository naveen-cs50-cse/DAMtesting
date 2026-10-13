'use client';

import React, { useState } from 'react';
import { Conversation } from '@/lib/investigation/types';
import { CopyIcon } from '../icons';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  conversation,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen || !conversation) return null;

  const lastAssistant = [...conversation.turns].reverse().find(t => t.role === 'assistant');
  const meta = lastAssistant?.meta;
  const caseId = conversation.caseId || meta?.caseId || 'DAM-2026-IND';
  const correctness = meta?.verdicts?.factualCorrectness || 'Unverified';
  const risk = meta?.verdicts?.scamRisk || 'Medium';

  // Format WhatsApp Citizen Alert
  const whatsappText = `🚨 *DAM VERIFICATION BRIEFING* — Case #${caseId}
━━━━━━━━━━━━━━━━━━━
📌 *Investigation:* ${conversation.title}
⚖️ *Factual Verdict:* ${correctness.toUpperCase()}
⚠️ *Scam Threat Level:* ${risk.toUpperCase()} RISK
${meta?.verdicts?.riskTriggers?.length ? `🚩 *Key Indicators:* ${meta.verdicts.riskTriggers.join(', ')}\n` : ''}
${lastAssistant?.fullText ? `📝 *Summary:*\n${lastAssistant.fullText.slice(0, 260)}…\n` : ''}
🔍 *Verify official Indian gazettes & advisories with DAM AI:*
https://usedam.ai/verify?case=${encodeURIComponent(caseId)}
━━━━━━━━━━━━━━━━━━━
_Zero-hallucination verification by UseDAM India Desk_`.trim();

  // Format Public Link
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?case=${encodeURIComponent(caseId)}`
    : `https://usedam.ai/?case=${encodeURIComponent(caseId)}`;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2200);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Share Investigation Briefing">
      <div className="modal-panel share-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="modal-icon text-red">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <div>
              <h3>Share Investigation Briefing</h3>
              <p className="modal-sub">Export or distribute Case #{caseId} with primary citations</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="modal-body share-modal-body">
          {/* Card 1: WhatsApp Citizen Alert Format */}
          <div className="share-option-card">
            <div className="share-option-header">
              <span className="share-icon green">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              </span>
              <div>
                <strong>WhatsApp Citizen Alert</strong>
                <small>Formatted for forward-busting in family and community groups</small>
              </div>
            </div>
            <pre className="share-preview-box">{whatsappText}</pre>
            <button
              type="button"
              className={`primary-btn share-action-btn ${copiedType === 'whatsapp' ? 'copied' : ''}`}
              onClick={() => handleCopy(whatsappText, 'whatsapp')}
            >
              {copiedType === 'whatsapp' ? (
                <>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  <span>Copied Alert to Clipboard!</span>
                </>
              ) : (
                <>
                  <CopyIcon className="w-3.5 h-3.5" />
                  <span>Copy WhatsApp Forward</span>
                </>
              )}
            </button>
          </div>

          {/* Card 2: Direct Share Link */}
          <div className="share-option-card">
            <div className="share-option-header">
              <span className="share-icon blue">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </span>
              <div>
                <strong>Case Briefing Link</strong>
                <small>Direct access link referencing this investigation</small>
              </div>
            </div>
            <div className="share-link-row">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="modal-input share-link-input"
                onFocus={e => e.target.select()}
              />
              <button
                type="button"
                className={`secondary-button ${copiedType === 'link' ? 'copied' : ''}`}
                onClick={() => handleCopy(shareUrl, 'link')}
              >
                {copiedType === 'link' ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
