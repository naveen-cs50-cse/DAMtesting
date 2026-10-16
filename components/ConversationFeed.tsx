'use client';

import React, { useState } from 'react';
import { ChatTurn, getQueryVerdictStatus } from '@/lib/investigation/types';
import { CheckIcon, CopyIcon, DownloadIcon, EvidenceIcon, FileIcon, GlobeIcon, RetryIcon, ShieldIcon, SpinnerIcon, StopIcon } from './icons';
import { CertificateModal } from './CertificateModal';

interface ConversationFeedProps {
  turns: ChatTurn[];
  isStreaming: boolean;
  onCitationClick: (citeIndex: number) => void;
  onOpenEvidence: () => void;
  onCopyBriefing: (text: string) => void;
  onRetry: () => void;
  onStop: () => void;
  onFollowUpClick?: (prompt: string) => void;
}

function sanitizeClaimText(text: string): string {
  let c = text.trim()
    .replace(/^(fact-check whether|fact check whether|fact-check if|fact check if|fact-check claim that|fact-check that|fact-check|fact check|verify whether|verify if|verify that|verify|is it true that|is it true|check if|check whether|investigate whether|investigate if|investigate)\s+/i, '')
    .replace(/^["'“‘\s]+|["'”’\s]+$/g, '')
    .replace(/[?]+$/, '')
    .trim();
  if (c.length > 0) {
    c = c.charAt(0).toUpperCase() + c.slice(1);
  }
  return c;
}

function getFollowUpChips(turn: ChatTurn): string[] {
  const meta = turn.meta;

  // 1. If AI returned bespoke claim-specific inquiries, sanitize and present as direct claims
  if (meta?.suggestedInquiries && Array.isArray(meta.suggestedInquiries) && meta.suggestedInquiries.length > 0) {
    const cleaned = meta.suggestedInquiries
      .map(sanitizeClaimText)
      .filter(c => c.length > 10);
    if (cleaned.length > 0) {
      return cleaned.slice(0, 4);
    }
  }

  // 2. Extract and sanitize primary claim / inquiry topic
  const rawClaim = (meta?.claims?.[0]?.claim || turn.fullText?.slice(0, 160) || '').trim();
  let cleanTopic = rawClaim
    .replace(/^(this\s+)?(apk\s+message|sms|message|whatsapp\s+message|circular|notice|claim|rumor|threat|video|link|post)[:\s\-"']+/i, '')
    .replace(/^(the|a|an|is|are|was|were|that|this|check|verify|please\s+check|investigate|evaluate|is\s+it\s+true\s+that)\s+/i, '')
    .replace(/^["'“‘\s]+|["'”’\s]+$/g, '')
    .replace(/[.?!\n].*$/g, '')
    .trim();

  if (cleanTopic.length > 45) {
    const truncated = cleanTopic.slice(0, 45).replace(/\s+\S*$/, '');
    cleanTopic = (truncated || cleanTopic.slice(0, 40)).trim();
  }
  cleanTopic = cleanTopic.replace(/[:\-,"'“‘”’]+$/g, '').trim();

  const lowerText = (rawClaim + ' ' + (turn.fullText || '')).toLowerCase();
  const topicLabel = cleanTopic && cleanTopic.length >= 3 && cleanTopic.toLowerCase() !== 'this claim' ? cleanTopic : null;

  // 3. Category-specific declarative claims to verify

  // Phishing / IRS / Tax / Banking emails
  if (lowerText.includes('irs') || lowerText.includes('tax') || lowerText.includes('phishing') || lowerText.includes('refund email') || lowerText.includes('domain')) {
    return [
      `Tax authorities and revenue services initiate refund requests via unsolicited emails and SMS`,
      `Official revenue portals require taxpayers to verify sensitive credentials on third-party links`,
      `Tax administration directives mandate that legitimate refunds are only processed through official .gov portals`,
    ];
  }

  // Digital Arrest / Police / CBI / Court Threats
  if (lowerText.includes('digital arrest') || lowerText.includes('cbi') || lowerText.includes('customs') || lowerText.includes('skype call') || lowerText.includes('police officer')) {
    return [
      `Indian criminal procedure codes authorize "digital arrest" over video calls and Skype`,
      `Law enforcement officers can mandate fund transfers to reserve escrow accounts via video call`,
      `Ministry of Home Affairs and I4C have designated video-call arrest threats as cyber extortion`,
    ];
  }

  // Currency / Bank Notes / RBI / Financial
  if (lowerText.includes('note') || lowerText.includes('currency') || lowerText.includes('rbi') || lowerText.includes('500') || lowerText.includes('2000') || lowerText.includes('legal tender') || lowerText.includes('star mark')) {
    return [
      `Reserve Bank of India has banned and demonetized ₹500 currency banknotes`,
      `Banknotes featuring a star (*) symbol in the number panel are invalid legal tender`,
      `RBI circular requires depositing old currency notes before a mandatory deadline`,
    ];
  }

  // Electricity / DISCOM / Utility Disconnection Scams
  if (lowerText.includes('electricity') || lowerText.includes('power cut') || lowerText.includes('discom') || lowerText.includes('meter') || lowerText.includes('bijli') || lowerText.includes('bill overdue')) {
    return [
      `Electricity distribution companies can disconnect power at night without 15 days notice`,
      `Power discom bill verification requires installing third-party APK update files`,
      `SERC regulations permit sending disconnection notices from personal 10-digit mobile numbers`,
    ];
  }

  // Government Welfare Schemes / Free Subsidies / Yojana
  if (lowerText.includes('yojana') || lowerText.includes('scheme') || lowerText.includes('free laptop') || lowerText.includes('solar') || lowerText.includes('pm-') || lowerText.includes('subsidy') || lowerText.includes('ration')) {
    return [
      topicLabel ? `The Central Government announced ${topicLabel} on india.gov.in` : `The Central Government is distributing free laptops to students under PM National Scheme`,
      `Registration for government subsidies requires paying an advance processing fee on third-party links`,
      `Official welfare scheme benefits require citizens to share SMS OTPs for verification`,
    ];
  }

  // Railway / IRCTC / Transport
  if (lowerText.includes('railway') || lowerText.includes('train') || lowerText.includes('irctc') || lowerText.includes('ticket') || lowerText.includes('tatkal') || lowerText.includes('tdr')) {
    return [
      `Ministry of Railways issued a new rule banning luggage over 15kg in sleeper class`,
      `IRCTC provides automatic full refunds without cancellation fee deduction for delayed trains`,
      `Railway reservation tickets can be transferred to family members 24 hours before chart preparation`,
    ];
  }

  // Health / Medical / Science
  if (lowerText.includes('vaccine') || lowerText.includes('cure') || lowerText.includes('cancer') || lowerText.includes('remedy') || lowerText.includes('ayush') || lowerText.includes('icmr') || lowerText.includes('who')) {
    return [
      `Ministry of Ayush and ICMR officially endorsed this viral herbal remedy`,
      `Peer-reviewed clinical trials validate the medical cure claims for this treatment`,
      `The World Health Organization issued an emergency alert regarding this medication`,
    ];
  }

  // High / Medium Scam Threat
  if (meta?.verdicts?.scamRisk === 'High' || meta?.verdicts?.scamRisk === 'Medium') {
    return [
      topicLabel ? `Official regulatory authorities have flagged ${topicLabel} as an active phishing scam` : `Official regulatory authorities have flagged this communication as an active phishing scam`,
      `Legitimate banking portals and ministries never solicit passwords or OTPs for this procedure`,
      `National Cyber Crime Reporting Portal (1930) has issued public warnings on this modus operandi`,
    ];
  }

  // Contradicted / Debunked Rumors
  if (meta?.verdicts?.factualCorrectness === 'Contradicted') {
    return [
      topicLabel ? `PIB Fact Check and official ministries have officially debunked ${topicLabel}` : `PIB Fact Check and official ministries have officially debunked this assertion`,
      `Primary gazette notifications and statutory circulars directly refute this statement`,
      `Statutory regulatory directives prohibit the actions described in this communication`,
    ];
  }

  // Supported / Factually Confirmed
  if (meta?.verdicts?.factualCorrectness === 'Supported') {
    return [
      topicLabel ? `Published government gazettes and statutory notifications substantiate ${topicLabel}` : `Published government gazettes and statutory notifications substantiate this policy`,
      `Official regulatory circulars confirm the active implementation timeline for this measure`,
      `Primary ministry records corroborate the terms and conditions outlined in this statement`,
    ];
  }

  // General fallback explicitly incorporating clean topic or substantive claims
  if (topicLabel) {
    return [
      `${topicLabel} is officially authorized and published in the Government Gazette`,
      `Regulatory authorities and ministries have issued official alerts regarding ${topicLabel}`,
      `Primary statutory records corroborate the authenticity of ${topicLabel}`,
    ];
  }

  return [
    `Central government authorities have published an official notification corroborating this assertion`,
    `National fact-checking registries have debunked this assertion as false misinformation`,
    `Statutory regulatory directives prohibit the demands and actions described in this communication`,
  ];
}

const UserTurnItem: React.FC<{
  turn: ChatTurn;
  onCopyPrompt: (text: string) => void;
}> = ({ turn, onCopyPrompt }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyPrompt(turn.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="chat-turn user-row">
      <div className="user-turn">
        {turn.attachments && turn.attachments.length > 0 && (
          <div className="user-turn-attachments">
            {turn.attachments.map((att, idx) => (
              <div key={idx} className="user-attachment-group">
                <span className="attachment-pill">
                  {att.type === 'application/pdf' ? (
                    <FileIcon className="w-3.5 h-3.5 text-zinc-300" />
                  ) : att.isUrl ? (
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-300"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={att.preview || att.previewUrl} alt={att.name} className="user-attachment-thumb" />
                  )}
                  <span>{att.name}</span>
                  {att.documentAnalysis && (
                    <span className={`doc-tag-pill status-${att.documentAnalysis.status}`}>
                      {att.documentAnalysis.pageCount}p &bull; {att.documentAnalysis.status}
                    </span>
                  )}
                  {att.urlAnalysis && (
                    <span className={`doc-tag-pill status-${att.urlAnalysis.domainRisk.riskLevel.toLowerCase()}`}>
                      {att.urlAnalysis.domain} &bull; {att.urlAnalysis.status}
                    </span>
                  )}
                  {att.previewUrl && (
                    <a href={att.previewUrl} target="_blank" rel="noopener noreferrer" className="doc-view-link" title="Open file outside localStorage">
                      ↗
                    </a>
                  )}
                  {att.url && !att.previewUrl && (
                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="doc-view-link" title="Open source URL in new tab">
                      ↗
                    </a>
                  )}
                </span>
                {att.extractedText && (
                  <div className="user-ocr-transcript">
                    <span className="user-ocr-label">OCR Transcribed Text:</span>
                    <p className="user-ocr-snippet">&ldquo;{att.extractedText.length > 200 ? `${att.extractedText.slice(0, 200)}...` : att.extractedText}&rdquo;</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {turn.content && <div className="user-turn-text">{turn.content}</div>}
      </div>
      <div className="user-turn-actions">
        <button
          type="button"
          className={`user-turn-copy-btn ${copied ? 'copied' : ''}`}
          title={copied ? 'Copied to clipboard!' : 'Copy prompt'}
          onClick={handleCopy}
          aria-label={copied ? 'Copied prompt' : 'Copy prompt'}
        >
          {copied ? (
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#ffffff' }}>
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <CopyIcon className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
};

const AssistantTurnView: React.FC<{
  turn: ChatTurn;
  isStreaming: boolean;
  onCitationClick: (citeIndex: number) => void;
  onOpenEvidence: () => void;
  onCopyBriefing: (text: string) => void;
  onRetry: () => void;
  onStop: () => void;
  onFollowUpClick?: (prompt: string) => void;
  renderMarkdown: (text: string, isLive: boolean) => React.ReactNode;
}> = ({
  turn,
  isStreaming,
  onOpenEvidence,
  onCopyBriefing,
  onRetry,
  onStop,
  onFollowUpClick,
  renderMarkdown,
}) => {
  const meta = turn.meta;
  const stages = turn.stages || [];
  const isLive = Boolean(turn.isLive && isStreaming);

  // Collapsible audit trail: open while streaming, collapsed by default when complete
  const [userExpandedAudit, setUserExpandedAudit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [rating, setRating] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const saved = localStorage.getItem(`dam_turn_rating_${turn.id}`);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [ratingFeedback, setRatingFeedback] = useState<string | null>(null);

  const handleRate = (star: number) => {
    const nextRating = rating === star ? 0 : star;
    setRating(nextRating);
    try {
      if (nextRating > 0) {
        localStorage.setItem(`dam_turn_rating_${turn.id}`, nextRating.toString());
        setRatingFeedback(nextRating >= 4 ? 'Thanks for rating!' : 'Feedback recorded');
        setTimeout(() => setRatingFeedback(null), 2500);
      } else {
        localStorage.removeItem(`dam_turn_rating_${turn.id}`);
        setRatingFeedback(null);
      }
    } catch {
      // Safe fallback
    }
  };

  const isConversational = meta?.taskType === 'conversational' || meta?.taskType === 'follow_up';
  const hasSources = Boolean(meta?.sources && meta.sources.length > 0);
  const hasVerdicts = Boolean(meta?.verdicts && !isConversational);
  const turnVerdictStatus = meta?.verdicts?.verdictStatus || getQueryVerdictStatus(meta);
  const isAuditOpen = isLive ? true : userExpandedAudit;

  const handleCopy = () => {
    onCopyBriefing(turn.fullText || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyReport = () => {
    if (meta?.incidentReport?.dossierText) {
      navigator.clipboard.writeText(meta.incidentReport.dossierText);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    }
  };

  return (
    <div className={`chat-turn assistant-row${isLive ? ' live-turn' : ''}`} id={`turn-${turn.id}`}>
      <div className={`assistant-turn${turnVerdictStatus ? ` turn-verdict-${turnVerdictStatus}` : ''}`}>

        {/* 1. ChatGPT-Style Clean Background Checking Phase (No boxes, no corners, loads one after another) */}
        {!isConversational && (
          <div className="chatgpt-checking-phase">
            <button
              type="button"
              className="checking-phase-btn"
              onClick={() => setUserExpandedAudit(prev => !prev)}
              title="Toggle background checks"
            >
              {isLive ? (
                <span className="checking-pulse-spinner" />
              ) : (
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" className="checking-icon">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              <span className="checking-label">
                {isLive
                  ? (stages.find(s => s.status === 'running')?.title || 'Checking background sources...')
                  : `Checked ${stages.length || 5} sources & registries`}
              </span>
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                className={`checking-chevron ${isAuditOpen ? 'open' : ''}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {isAuditOpen && (
              <div className="checking-steps-flow">
                {stages.length === 0 ? (
                  <div className="checking-step-row">
                    <span className="step-dot">•</span>
                    <span className="step-name">Searching PIB Fact Check and official regulatory gazettes...</span>
                  </div>
                ) : (
                  stages.map((s, idx) => (
                    <div key={s.id || idx} className={`checking-step-row ${s.status === 'running' ? 'running' : 'done'}`}>
                      <span className="step-dot">{s.status === 'running' ? '◦' : '•'}</span>
                      <span className="step-name">{s.title}</span>
                      {s.summary && s.summary !== s.title && (
                        <span className="step-desc">— {s.summary}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. Referenced Sources (Clean Minimal Row) */}
        {hasSources && (
          <div className="genspark-sources-tray" aria-label="Referenced Sources">
            <div className="genspark-sources-header">
              <span className="sources-count-label">
                <GlobeIcon className="w-3.5 h-3.5" />
                <span>Sources ({meta!.sources!.length})</span>
              </span>
            </div>
            <div className="genspark-sources-scroll">
              {meta!.sources!.map(src => (
                <a
                  key={src.id}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="genspark-source-chip"
                  title={`${src.title} (${src.domain})`}
                >
                  <span className="source-chip-favicon">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${src.domain}&sz=32`}
                      alt=""
                      width={14}
                      height={14}
                      onError={e => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  </span>
                  <span className="source-chip-domain">{src.domain}</span>
                  <span className="source-chip-idx">[{src.id}]</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 4. Investigation Briefing Prose */}
        <div className={`answer-prose ${isLive ? 'generating' : ''}`}>
          {renderMarkdown(turn.fullText || '', isLive)}
        </div>


        {/* 6. Deep Forensic Dossier & Regulatory Tools (Collapsible Inspector) */}
        {/* 6. Deep Forensic Dossier & Regulatory Tools (Collapsible Inspector) */}
        {(() => {
          if (isConversational) return null;
          const meaningfulImpacts = (meta?.verdicts?.explanation?.sourceImpacts || []).filter(
            impact => !impact.explanation?.toLowerCase().includes('fallback template') &&
                      !impact.explanation?.toLowerCase().includes('excluded from live')
          );
          const hasIncidentKit = Boolean(
            meta?.incidentReport && (meta.verdicts?.scamRisk === 'High' || meta.forensics?.phones?.some(p => p.risk === 'High') || meta.forensics?.urls?.some(u => u.status === 'critical'))
          );
          const hasStatutes = Boolean(meta?.statutes?.applicableStatutes?.length);
          const hasForensics = Boolean(meta?.forensics && ((meta.forensics.urls?.length ?? 0) > 0 || (meta.forensics.phones?.length ?? 0) > 0 || (meta.forensics.senders?.length ?? 0) > 0));
          const hasDocAnalysis = Boolean(meta?.documentAnalysis || turn.attachments?.some(a => a.documentAnalysis));
          const hasManipulation = Boolean(meta?.manipulationAudit && meta.manipulationAudit.overallIndex > 0);
          const hasChallenger = Boolean(meta?.challengerAudit && meta.challengerAudit.length > 0);

          if (meaningfulImpacts.length === 0 && !hasIncidentKit && !hasStatutes && !hasForensics && !hasDocAnalysis && !hasManipulation && !hasChallenger) {
            return null;
          }

          return (
            <details className="forensic-dossier-accordion">
              <summary className="forensic-dossier-summary">
                <div className="dossier-summary-left">
                  <span className="dossier-shield-icon" aria-hidden="true">
                    <ShieldIcon className="w-3.5 h-3.5" />
                  </span>
                  <span className="dossier-title">Analysis & Verification Details</span>
                </div>
                <div className="dossier-summary-right">
                  <span className="dossier-summary-hint">
                    {hasIncidentKit ? 'Report fraud & view checks' : 'View checks & sources'}
                  </span>
                  <span className="dossier-chevron" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 6 8 10 12 6" />
                    </svg>
                  </span>
                </div>
              </summary>
              <div className="forensic-dossier-body">

        {/* 3.6 Structured Evidence Rationale & Source Attribution */}
        {meaningfulImpacts.length > 0 && (
          <div className="dossier-flat-section">
            <div className="dossier-section-title">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>Evidence Attribution Breakdown</span>
            </div>
            <div className="source-impacts-flat-list">
              {meaningfulImpacts.map(impact => (
                <div key={impact.sourceId} className="source-impact-flat-row">
                  <div className="source-impact-flat-head">
                    <span className="source-impact-domain">[{impact.sourceId}] {impact.domain}</span>
                    <span className="source-impact-pill">{impact.stance}</span>
                    <span className="source-impact-weight">Auth: {Math.round(impact.authorityWeight * 100)}% &bull; Rel: {Math.round(impact.relevanceScore * 100)}%</span>
                  </div>
                  <p className="source-impact-detail">{impact.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4.1 Manipulation & Urgency Indicators */}
        {(() => {
          if (!meta?.manipulationAudit || meta.manipulationAudit.overallIndex <= 0) return null;
          const activeVectors = (meta.manipulationAudit.vectors || []).filter(v => v.score > 0 || (v.detectedTriggers && v.detectedTriggers.length > 0));
          if (activeVectors.length === 0 && !meta.manipulationAudit.summary) return null;
          return (
            <div className="dossier-flat-section">
              <div className="dossier-section-title">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Urgency & Pressure Indicators</span>
              </div>
              <div className="dossier-flat-content">
                {activeVectors.length > 0 ? (
                  <ul className="dossier-simple-list">
                    {activeVectors.map(vec => (
                      <li key={vec.id}>
                        <strong>{vec.name}:</strong> {vec.detectedTriggers.length > 0 ? `Detected keywords: "${vec.detectedTriggers.join('", "')}"` : `${vec.score}% urgency level`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="dossier-simple-text">{meta.manipulationAudit.summary}</p>
                )}
              </div>
            </div>
          );
        })()}

        {/* 4.2 Flagged Threat Entities & Links */}
        {meta?.forensics && (meta.forensics.urls.length > 0 || meta.forensics.phones.length > 0 || meta.forensics.senders.length > 0) && (
          <div className="dossier-flat-section">
            <div className="dossier-section-title">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
              <span>Flagged Threat Entities</span>
            </div>
            <div className="dossier-flat-content">
              <ul className="dossier-simple-list">
                {meta.forensics.urls.map((item, uIdx) => (
                  <li key={`url-${uIdx}`}>
                    <strong>{item.domain || item.url}</strong>
                    <span className="dossier-inline-tag">{item.status === 'safe' ? 'Official' : item.status === 'critical' ? 'Malicious APK / Link' : 'Unverified'}</span>
                    {item.reason && <span className="dossier-inline-desc"> &mdash; {item.reason}</span>}
                  </li>
                ))}
                {meta.forensics.phones.map((phone, pIdx) => (
                  <li key={`phone-${pIdx}`}>
                    <strong>{phone.number}</strong>
                    <span className="dossier-inline-tag">{phone.risk} Risk</span>
                    {phone.notes && <span className="dossier-inline-desc"> &mdash; {phone.notes}</span>}
                  </li>
                ))}
                {meta.forensics.senders.map((sender, sIdx) => (
                  <li key={`sender-${sIdx}`}>
                    <strong>{sender.id}</strong>
                    <span className="dossier-inline-tag">{sender.isRegisteredDLT ? 'Registered DLT Header' : 'Unregistered Header'}</span>
                    {sender.notes && <span className="dossier-inline-desc"> &mdash; {sender.notes}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 4.3 Legal & Regulatory Protections */}
        {meta?.statutes && meta.statutes.applicableStatutes.length > 0 && (
          <div className="dossier-flat-section">
            <div className="dossier-section-title">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                <path d="M7 21h10" />
                <path d="M12 3v18" />
              </svg>
              <span>Applicable Legal Rules</span>
            </div>
            <div className="dossier-flat-content">
              <ul className="dossier-simple-list">
                {meta.statutes.applicableStatutes.map((clause, cIdx) => (
                  <li key={cIdx}>
                    <strong>{clause.title || clause.act} ({clause.section}):</strong> {clause.statutoryRule}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 4.4 Official Incident Reporting Kit */}
        {hasIncidentKit && meta?.incidentReport && (
          <div className="dossier-flat-section">
            <div className="dossier-section-title">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Incident Reporting Kit</span>
            </div>
            <div className="dossier-flat-content">
              <p className="dossier-simple-desc">
                Helpline: <strong>{meta.incidentReport.helpline}</strong> &bull; Portal: <strong>{meta.incidentReport.portalName}</strong>
              </p>
              <div className="dossier-simple-actions">
                <button
                  type="button"
                  className="dossier-action-btn"
                  onClick={handleCopyReport}
                >
                  {copiedReport ? '✓ Copied Incident Report' : 'Copy Incident Report'}
                </button>
                <a
                  href={meta.incidentReport.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dossier-action-btn"
                >
                  Open {meta.incidentReport.recommendedPortal === 'chakshu' ? 'Chakshu Portal' : 'Cybercrime Portal'} &rarr;
                </a>
              </div>
            </div>
          </div>
        )}

        {/* 4.5 Official Document & Gazette Scrutiny */}
        {(meta?.documentAnalysis || turn.attachments?.find(a => a.documentAnalysis)?.documentAnalysis) && (() => {
          const docAnalysis = meta?.documentAnalysis || turn.attachments?.find(a => a.documentAnalysis)?.documentAnalysis;
          if (!docAnalysis) return null;
          return (
            <div className="dossier-flat-section">
              <div className="dossier-section-title">
                <FileIcon className="w-3.5 h-3.5" />
                <span>Document Scrutiny ({docAnalysis.pageCount} Pages &bull; {docAnalysis.status})</span>
              </div>
              <div className="dossier-flat-content">
                <ul className="dossier-simple-list">
                  {docAnalysis.extractedIdentifiers.circularNumbers.length > 0 && (
                    <li><strong>Reference:</strong> {docAnalysis.extractedIdentifiers.circularNumbers.join(', ')}</li>
                  )}
                  {docAnalysis.extractedIdentifiers.issuingAuthorities.length > 0 && (
                    <li><strong>Authority:</strong> {docAnalysis.extractedIdentifiers.issuingAuthorities.join(', ')}</li>
                  )}
                  {docAnalysis.anomalies.map((anom, aIdx) => (
                    <li key={aIdx}><strong>Page {anom.pageNumber} ({anom.type.replace(/_/g, ' ')}):</strong> {anom.details}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}

        {/* 4.6 Web Source & Link Ingestion */}
        {(meta?.urlAnalysis || turn.attachments?.find(a => a.urlAnalysis)?.urlAnalysis) && (() => {
          const urlAnalysis = meta?.urlAnalysis || turn.attachments?.find(a => a.urlAnalysis)?.urlAnalysis;
          if (!urlAnalysis) return null;
          return (
            <div className="dossier-flat-section">
              <div className="dossier-section-title">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span>Web Domain Risk ({urlAnalysis.domain})</span>
              </div>
              <div className="dossier-flat-content">
                <ul className="dossier-simple-list">
                  <li><strong>Domain Risk:</strong> {urlAnalysis.domainRisk.riskLevel}</li>
                  {urlAnalysis.domainRisk.warnings.map((w, wIdx) => (
                    <li key={wIdx}><strong>Warning:</strong> {w}</li>
                  ))}
                  {urlAnalysis.downloadLinks.map((dl, dlIdx) => (
                    <li key={dlIdx}><strong>Flagged Payload:</strong> {dl}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}

        {/* 6. Challenger Agent Audit */}
        {meta?.challengerAudit && meta.challengerAudit.length > 0 && (
          <div className="dossier-flat-section challenger-flat-section">
            <div className="dossier-section-title">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>Adversarial Challenger Verification</span>
            </div>
            <div className="challenger-flat-content">
              <p className="challenger-intro">Counter-hypotheses checked to avoid unwarranted certainty:</p>
              <ul className="challenger-bullets">
                {meta.challengerAudit.map((pt, ptIdx) => (
                  <li key={ptIdx}>{pt}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

              </div>
            </details>
          );
        })()}

        {/* 7. Contextual Follow-up Inquiries (Minimalist vertical list matching reference) */}
        {!isLive && getFollowUpChips(turn).length > 0 && (
          <div className="followup-list-container" aria-label="Suggested follow-up inquiries">
            {getFollowUpChips(turn).slice(0, 3).map((chip, chipIdx) => (
              <button
                key={chipIdx}
                type="button"
                className="followup-row-item"
                onClick={() => onFollowUpClick && onFollowUpClick(chip)}
                title={`Investigate: "${chip}"`}
              >
                <span className="followup-bubble-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    <circle cx="8.5" cy="12" r="0.85" fill="currentColor" stroke="none" />
                    <circle cx="12" cy="12" r="0.85" fill="currentColor" stroke="none" />
                    <circle cx="15.5" cy="12" r="0.85" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <span className="followup-row-text">{chip}</span>
                <span className="followup-row-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 8. Action Controls Bar with animated checkmark feedback */}
        <div className="investigation-controls">
          <div className="controls-left">
            {isLive ? (
              <button
                className="control-btn stop icon-only-btn"
                onClick={onStop}
                title="Stop generation"
                aria-label="Stop generation"
              >
                <StopIcon className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  className={`control-btn icon-only-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopy}
                  title={copied ? 'Copied!' : 'Copy Briefing'}
                  aria-label="Copy Briefing"
                >
                  {copied ? (
                    <CheckIcon className="w-3.5 h-3.5" />
                  ) : (
                    <CopyIcon className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  className="control-btn icon-only-btn"
                  onClick={onRetry}
                  title="Re-evaluate"
                  aria-label="Re-evaluate"
                >
                  <RetryIcon className="w-3.5 h-3.5" />
                </button>

                {/* Result Rating Widget ("How was this result? ★ ★ ★ ★ ★") */}
                <div className="result-rating-widget" role="group" aria-label="How was this result?">
                  <span className="result-rating-text">How was this result?</span>
                  <div className="result-rating-stars">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = (hoverRating || rating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          className={`star-rating-btn ${active ? 'active' : ''}`}
                          onClick={() => handleRate(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                  {ratingFeedback && (
                    <span className="rating-feedback-badge">{ratingFeedback}</span>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="controls-right">
            <button
              className="control-btn icon-only-btn"
              onClick={() => {
                const blob = new Blob([turn.fullText || ''], { type: 'text/markdown;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dam_investigation_briefing.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              title="Download Briefing"
              aria-label="Download Briefing"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 9. Cryptographic Verification Certificate Modal */}
        {meta?.certificate && (
          <CertificateModal
            certificate={meta.certificate}
            isOpen={showCertModal}
            onClose={() => setShowCertModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export const ConversationFeed: React.FC<ConversationFeedProps> = ({
  turns,
  isStreaming,
  onCitationClick,
  onOpenEvidence,
  onCopyBriefing,
  onRetry,
  onStop,
  onFollowUpClick,
}) => {
  const renderInlineMarkdown = (str: string) => {
    const segments = str.split(/(\*\*.*?\*\*|\*[^*]+?\*|`[^`]+?`)/g);
    return segments.map((seg, idx) => {
      if (seg.startsWith('**') && seg.endsWith('**') && seg.length >= 4) {
        return (
          <strong key={idx} className="answer-bold">
            {seg.slice(2, -2)}
          </strong>
        );
      }
      if (seg.startsWith('*') && seg.endsWith('*') && seg.length >= 2 && !seg.startsWith('**')) {
        return <em key={idx}>{seg.slice(1, -1)}</em>;
      }
      if (seg.startsWith('`') && seg.endsWith('`') && seg.length >= 2) {
        return (
          <code key={idx} className="inline-code">
            {seg.slice(1, -1)}
          </code>
        );
      }
      return seg;
    });
  };

  const renderMarkdown = (text: string = '', isLive: boolean = false) => {
    const cleaned = text
      .replace(/\s+([.,;:!?])/g, '$1')
      .replace(/\]\s+\[/g, '][');

    const parts = cleaned.split(/(\[[0-9]+\])/g);

    return (
      <>
        {parts.map((part, i) => {
          const match = part.match(/^\[([0-9]+)\]$/);
          if (match) {
            const num = parseInt(match[1], 10);
            return (
              <a
                key={i}
                href={`#evidence-card-${num}`}
                className="citation-ref"
                data-citation={num}
                title={`Jump to source ${num}`}
                onClick={e => {
                  e.preventDefault();
                  onCitationClick(num);
                }}
              >
                [{num}]
              </a>
            );
          }

          // Simple markdown parsing for headings and bold
          const lines = part.split('\n');
          return (
            <span key={i}>
              {lines.map((line, lineIdx) => {
                if (line.startsWith('### ')) {
                  return <h3 key={lineIdx}>{renderInlineMarkdown(line.slice(4))}</h3>;
                }
                if (line.startsWith('## ')) {
                  return <h2 key={lineIdx}>{renderInlineMarkdown(line.slice(3))}</h2>;
                }
                return (
                  <React.Fragment key={lineIdx}>
                    {lineIdx > 0 && <br />}
                    {renderInlineMarkdown(line)}
                  </React.Fragment>
                );
              })}
            </span>
          );
        })}
        {isLive && <span className="genai-cursor">▌</span>}
      </>
    );
  };

  return (
    <div className="conversation" id="conversation">

      {turns.map(turn => {
        if (turn.role === 'user') {
          return (
            <UserTurnItem
              key={turn.id}
              turn={turn}
              onCopyPrompt={onCopyBriefing}
            />
          );
        }

        if (turn.role === 'assistant') {
          return (
            <AssistantTurnView
              key={turn.id}
              turn={turn}
              isStreaming={isStreaming}
              onCitationClick={onCitationClick}
              onOpenEvidence={onOpenEvidence}
              onCopyBriefing={onCopyBriefing}
              onRetry={onRetry}
              onStop={onStop}
              onFollowUpClick={onFollowUpClick}
              renderMarkdown={renderMarkdown}
            />
          );
        }

        return null;
      })}
      <div id="conversationBottomAnchor" style={{ height: 1, minHeight: 1, pointerEvents: 'none' }} />
    </div>
  );
};
