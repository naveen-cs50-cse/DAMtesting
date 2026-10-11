'use client';

import React, { useState } from 'react';
import { ChatTurn } from '@/lib/investigation/types';
import { CopyIcon, EvidenceIcon, FileIcon, GlobeIcon, RetryIcon, ShieldIcon, SpinnerIcon, StopIcon, VolumeIcon } from './icons';
import { VernacularAudioPlayer } from './VernacularAudioPlayer';
import { CertificateModal } from './CertificateModal';
import { WatchtowerDrawer } from './WatchtowerDrawer';

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

function getFollowUpChips(turn: ChatTurn): string[] {
  const meta = turn.meta;
  const scamRisk = meta?.verdicts?.scamRisk;
  const correctness = meta?.verdicts?.factualCorrectness;

  if (scamRisk === 'High' || scamRisk === 'Medium') {
    return [
      'How do I report this number to 1930 / Chakshu portal?',
      'Draft a formal complaint for my bank manager',
      'What should I do if I already clicked the link or shared OTP?',
      'Check official advisory circular on this scam pattern',
    ];
  }

  if (correctness === 'Contradicted' || correctness === 'Mixed') {
    return [
      'Check latest PIB Fact Check clarification',
      'Verify relevant ministry gazette notification',
      'What is the official procedure under this policy?',
      'Draft a WhatsApp warning summary for family',
    ];
  }

  return [
    'Check official government portal advisory',
    'How do I verify the authenticity of this circular?',
    'What are the relevant legal provisions under the IT Act?',
    'Draft a briefing summary for WhatsApp',
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
                    <FileIcon className="w-3.5 h-3.5 text-blue-400" />
                  ) : att.isUrl ? (
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
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
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--dam-green)' }}>
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
  const [showAudio, setShowAudio] = useState(false);

  const isConversational = meta?.taskType === 'conversational';
  const hasSources = Boolean(meta?.sources && meta.sources.length > 0);
  const hasVerdicts = Boolean(meta?.verdicts && !isConversational);
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
      <div className="assistant-turn">

        {/* 1. Investigation Audit Trail (Only for non-conversational queries) */}
        {!isConversational && (
          <details
            className="investigation-activity"
            id={`activity-pane-${turn.id}`}
            open={isAuditOpen}
            onToggle={e => {
              if (!isLive) {
                setUserExpandedAudit((e.currentTarget as HTMLDetailsElement).open);
              }
            }}
          >
            <summary className="activity-summary-bar">
              <div className="activity-summary-left">
                <span className={`activity-pulse-dot ${isLive ? 'running' : ''}`} aria-hidden="true" />
                <span className="activity-summary-title">
                  {isLive ? 'Live Investigation in Progress…' : 'Investigation Audit Trail & Primary Registries'}
                </span>
              </div>
              <div className="activity-summary-meta">
                <span>{stages.length ? `${stages.length} stages` : '5 stages'} &bull; {meta?.sources?.length || 0} sources</span>
                <svg viewBox="0 0 24 24" className="activity-summary-chevron" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </summary>

            <div className="activity-stages-list">
              {stages.length === 0 ? (
                <div className="activity-stage-item">
                  <span className={`activity-stage-icon ${isLive ? 'running' : 'completed'}`}>
                    {isLive ? <SpinnerIcon className="w-3.5 h-3.5" /> : <ShieldIcon className="w-3.5 h-3.5" />}
                  </span>
                  <div className="activity-stage-content">
                    <div className="activity-stage-name">Analysing Request & Scope</div>
                    <div className="activity-stage-desc">Cross-referencing entities against official Indian registries...</div>
                  </div>
                </div>
              ) : (
                stages.map(s => (
                  <div key={s.id} className="activity-stage-item">
                    <span className={`activity-stage-icon ${s.status === 'running' ? 'running' : 'completed'}`}>
                      {s.status === 'running' ? <SpinnerIcon className="w-3.5 h-3.5" /> : <span style={{ color: 'var(--dam-green)', fontWeight: 'bold' }}>✓</span>}
                    </span>
                    <div className="activity-stage-content">
                      <div className="activity-stage-head">
                        <span className="activity-stage-name">{s.title}</span>
                      </div>
                      <div className="activity-stage-desc">{s.summary}</div>
                      {s.details?.queries && (
                        <div className="activity-stage-chips">
                          {s.details.queries.map((q: string, qIdx: number) => (
                            <span key={qIdx} className="query-chip">{q}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </details>
        )}

        {/* 2. GenSpark Top Sources Strip */}
        {hasSources && (
          <div className="genspark-sources-tray" aria-label="Referenced Sources">
            <div className="genspark-sources-header">
              <span className="sources-count-label">
                <GlobeIcon className="w-3.5 h-3.5" />
                <span>Sources ({meta!.sources!.length})</span>
              </span>
              <button
                type="button"
                className="sources-explorer-btn"
                onClick={onOpenEvidence}
                title="Open full Evidence Explorer panel"
              >
                <EvidenceIcon className="w-3 h-3" />
                <span>Evidence Explorer &rarr;</span>
              </button>
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

        {/* 3. Sleek Contextual Verdict Banner (Replaces bulky 3-card grid) */}
        {hasVerdicts && meta?.verdicts && (
          <div className={`sleek-verdict-banner correctness-${meta.verdicts.factualCorrectness.toLowerCase()}`}>
            <div className="verdict-banner-badge">
              {meta.verdicts.factualCorrectness === 'Contradicted' && '❌ Debunked / Contradicted'}
              {meta.verdicts.factualCorrectness === 'Supported' && '✅ Officially Verified'}
              {meta.verdicts.factualCorrectness === 'Mixed' && '⚠️ Mixed / State-Specific'}
              {meta.verdicts.factualCorrectness === 'Unverified' && 'ℹ️ Unverified Claim'}
            </div>
            <div className="verdict-banner-summary">
              {meta.verdicts.explanation?.factualRationale ||
                (meta.verdicts.factualCorrectness === 'Contradicted'
                  ? 'Refuted by official government notices and published gazettes.'
                  : meta.verdicts.factualCorrectness === 'Supported'
                  ? 'Substantiated by active statutory circulars.'
                  : 'Evidence is insufficient to confirm or refute.')}
            </div>
            {meta.verdicts.scamRisk === 'High' && (
              <span className="verdict-scam-tag">🚨 High Scam Threat</span>
            )}
            {meta.verdicts.scamRisk === 'Medium' && meta.verdicts.riskTriggers?.includes('Viral Misinformation Rumor') && (
              <span className="verdict-scam-tag medium">⚠️ Viral Rumor</span>
            )}
          </div>
        )}

        {/* 4. Investigation Briefing Prose */}
        <div className={`answer-prose ${isLive ? 'generating' : ''}`}>
          {renderMarkdown(turn.fullText || '', isLive)}
        </div>

        {/* 5. Vernacular Audio Advisory (Expanded on user click) */}
        {showAudio && turn.fullText && (
          <div className="audio-player-wrapper revealed">
            <VernacularAudioPlayer
              text={turn.fullText}
              verdictSummary={{
                factualCorrectness: meta?.verdicts?.factualCorrectness,
                scamRisk: meta?.verdicts?.scamRisk,
              }}
            />
          </div>
        )}

        {/* 6. Deep Forensic Dossier & Regulatory Tools (Collapsible Inspector) */}
        {!isConversational && (Boolean(meta?.statutes?.applicableStatutes?.length) || Boolean(meta?.forensics) || Boolean(meta?.incidentReport) || Boolean(meta?.documentAnalysis) || Boolean(meta?.manipulationAudit?.overallIndex) || Boolean(meta?.challengerAudit?.length) || Boolean(meta?.verdicts?.explanation)) && (
          <details className="forensic-dossier-accordion">
            <summary className="forensic-dossier-summary">
              <div className="dossier-summary-left">
                <ShieldIcon className="w-3.5 h-3.5" />
                <strong>Forensic Dossier & Regulatory Tools</strong>
              </div>
              <span className="dossier-summary-hint">
                Inspect legal clauses, Chakshu grievance kit & forensics ▾
              </span>
            </summary>
            <div className="forensic-dossier-body">

        {/* 3.6 Structured Evidence Rationale & Source Attribution */}
        {meta?.verdicts?.explanation && (
          <details className="verdict-explanation-box revealed" open>
            <summary className="verdict-explanation-summary">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>Structured Evidence Rationale & Source Attribution</span>
            </summary>
            <div className="verdict-explanation-content">
              {meta.verdicts.explanation.sourceImpacts && meta.verdicts.explanation.sourceImpacts.length > 0 && (
                <div className="source-impacts-list">
                  <span className="source-impacts-heading">Source Attribution Breakdown</span>
                  {meta.verdicts.explanation.sourceImpacts.map(impact => (
                    <div key={impact.sourceId} className={`source-impact-item role-${impact.impactRole}`}>
                      <div className="source-impact-header">
                        <span className="source-impact-domain">[{impact.sourceId}] {impact.domain}</span>
                        <span className={`source-impact-stance-pill stance-${impact.stance}`}>{impact.stance}</span>
                        <span className="source-impact-weight">Auth: {Math.round(impact.authorityWeight * 100)}% &bull; Rel: {Math.round(impact.relevanceScore * 100)}%</span>
                      </div>
                      <p className="source-impact-detail">{impact.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        )}

        {/* 4. Threat & Forensic Analysis Cards (Revealed once investigation completes) */}
        {/* 4.1 PSYCHOLOGICAL MANIPULATION & SOCIAL ENGINEERING RADAR */}
        {meta?.manipulationAudit && meta.manipulationAudit.overallIndex > 0 && (
          <div className="manipulation-card revealed" aria-label="Psychological Manipulation Radar">
            <div className="manipulation-head">
              <div className="manipulation-title">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <strong>Psychological Manipulation Radar</strong>
              </div>
              <div className={`manipulation-badge level-${meta.manipulationAudit.threatLevel.toLowerCase()}`}>
                <span>{meta.manipulationAudit.overallIndex}% {meta.manipulationAudit.threatLevel} Manipulation</span>
              </div>
            </div>

            <div className="manipulation-meter-track">
              <div
                className={`manipulation-meter-fill level-${meta.manipulationAudit.threatLevel.toLowerCase()}`}
                style={{ width: `${meta.manipulationAudit.overallIndex}%` }}
              />
            </div>

            <p className="manipulation-summary-text">{meta.manipulationAudit.summary}</p>

            <div className="manipulation-vectors-grid">
              {meta.manipulationAudit.vectors.map(vec => (
                <div key={vec.id} className={`vector-card ${vec.score > 0 ? 'active' : 'inactive'} level-${vec.level.toLowerCase()}`}>
                  <div className="vector-card-head">
                    <span className="vector-name">{vec.name}</span>
                    <span className="vector-score">{vec.score}%</span>
                  </div>
                  <div className="vector-progress-track">
                    <div className="vector-progress-fill" style={{ width: `${vec.score}%` }} />
                  </div>
                  {vec.detectedTriggers.length > 0 && (
                    <div className="vector-triggers-list">
                      {vec.detectedTriggers.slice(0, 3).map((trig, tIdx) => (
                        <span key={tIdx} className="vector-trigger-tag">&quot;{trig}&quot;</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {meta.manipulationAudit.counterMeasure && (
              <div className="cognitive-pause-banner">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="10" y1="15" x2="10" y2="9" />
                  <line x1="14" y1="15" x2="14" y2="9" />
                </svg>
                <span>{meta.manipulationAudit.counterMeasure}</span>
              </div>
            )}
          </div>
        )}

        {/* 4.2 THREAT ENTITY & URL FORENSICS CARD (Phase 2) */}
        {meta?.forensics && (meta.forensics.urls.length > 0 || meta.forensics.phones.length > 0 || meta.forensics.senders.length > 0) && (
          <div className="forensics-card revealed" aria-label="Digital Entity & Link Forensics">
            <div className="forensics-head">
              <div className="forensics-title">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                <strong>Digital Entity & Link Forensics</strong>
              </div>
              <span className="forensics-badge">Indian Scam Guard</span>
            </div>

            <div className="forensics-body">
              {/* Suspicious or Analyzed URLs */}
              {meta.forensics.urls.length > 0 && (
                <div className="forensic-section">
                  <span className="forensic-section-label">Link & Domain Authenticity</span>
                  <div className="forensic-items-list">
                    {meta.forensics.urls.map((item, uIdx) => (
                      <div key={uIdx} className={`forensic-item status-${item.status}`}>
                        <div className="forensic-item-main">
                          <span className={`forensic-status-pill ${item.status}`}>
                            {item.status === 'safe' ? 'Verified Gov/NIC' : item.status === 'critical' ? 'Phishing / Malware APK' : 'Unverified 3rd-Party'}
                          </span>
                          <span className="forensic-domain-text">{item.domain || item.url}</span>
                        </div>
                        <p className="forensic-reason-text">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Analyzed Phone Numbers */}
              {meta.forensics.phones.length > 0 && (
                <div className="forensic-section">
                  <span className="forensic-section-label">Telephone Number Risk</span>
                  <div className="forensic-items-list">
                    {meta.forensics.phones.map((phone, pIdx) => (
                      <div key={pIdx} className={`forensic-item status-${phone.risk === 'High' ? 'critical' : 'suspicious'}`}>
                        <div className="forensic-item-main">
                          <span className={`forensic-status-pill ${phone.risk === 'High' ? 'critical' : 'suspicious'}`}>
                            {phone.risk} Risk Caller
                          </span>
                          <span className="forensic-domain-text">{phone.number}</span>
                        </div>
                        <p className="forensic-reason-text">{phone.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DLT Sender Headers */}
              {meta.forensics.senders.length > 0 && (
                <div className="forensic-section">
                  <span className="forensic-section-label">TRAI DLT Header Verification</span>
                  <div className="forensic-items-list">
                    {meta.forensics.senders.map((sender, sIdx) => (
                      <div key={sIdx} className={`forensic-item status-${sender.isRegisteredDLT ? 'safe' : 'suspicious'}`}>
                        <div className="forensic-item-main">
                          <span className={`forensic-status-pill ${sender.isRegisteredDLT ? 'safe' : 'suspicious'}`}>
                            {sender.isRegisteredDLT ? 'Registered DLT Header' : 'Unregistered Header'}
                          </span>
                          <span className="forensic-domain-text">{sender.id}</span>
                        </div>
                        <p className="forensic-reason-text">{sender.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4.3 LEGAL & STATUTORY CLAUSE CROSS-EXAMINATION */}
        {meta?.statutes && meta.statutes.applicableStatutes.length > 0 && (
          <div className="statutes-card revealed" aria-label="Legal & Statutory Clause Cross-Examination">
            <div className="statutes-head">
              <div className="statutes-title">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                  <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                  <path d="M7 21h10" />
                  <path d="M12 3v18" />
                  <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
                </svg>
                <strong>Legal & Statutory Cross-Examination</strong>
              </div>
              <span className="statutes-badge">{meta.statutes.statutoryViolationCount} Violations Flagged</span>
            </div>

            <div className="statutes-body">
              <div className="statutes-grid">
                {meta.statutes.applicableStatutes.map((clause, cIdx) => (
                  <div key={cIdx} className="statute-item">
                    <div className="statute-item-top">
                      <span className="statute-act-name">{clause.act}</span>
                      <span className="statute-sec-pill">{clause.section}</span>
                    </div>
                    <h5 className="statute-clause-title">{clause.title}</h5>
                    <p className="statute-rule-desc"><strong>Statutory Standard:</strong> {clause.statutoryRule}</p>
                    <p className="statute-remedy-desc"><strong>Citizen Remedy:</strong> {clause.punishmentOrRemedy}</p>
                  </div>
                ))}
              </div>
              <div className="statutes-rights-note">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{meta.statutes.citizenRightsSummary}</span>
              </div>
            </div>
          </div>
        )}

        {/* 4.4 NATIONAL CYBER CRIME & CHAKSHU INCIDENT KIT (Phase 3) */}
        {meta?.incidentReport && (
          <div className="incident-kit-card revealed" aria-label="National Cyber Crime & Chakshu Incident Kit">
            <div className="incident-kit-head">
              <div className="incident-kit-title">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
                <div>
                  <strong>National Cyber Incident Redressal Kit</strong>
                  <span className="incident-kit-subtitle">Pre-formatted grievance for Chakshu & 1930</span>
                </div>
              </div>
              <div className="incident-channel-badge">
                {meta.incidentReport.urgency === 'Immediate' && <span className="urgency-pulse" />}
                <span>{meta.incidentReport.portalName}</span>
              </div>
            </div>

            <div className="incident-kit-body">
              <div className="incident-kit-meta-row">
                <div className="incident-meta-chip">
                  <span className="incident-chip-label">Classification:</span>
                  <span className="incident-chip-val">{meta.incidentReport.category}</span>
                </div>
                <div className="incident-meta-chip">
                  <span className="incident-chip-label">Immediate Helpline:</span>
                  <a href={`tel:${meta.incidentReport.helpline.split(' ')[0]}`} className="incident-chip-val helpline-link">
                    {meta.incidentReport.helpline}
                  </a>
                </div>
              </div>

              <div className="incident-actions-row">
                <button
                  type="button"
                  className={`btn-incident-primary ${copiedReport ? 'copied' : ''}`}
                  onClick={handleCopyReport}
                  title="Copy pre-formatted grievance to paste into official portal"
                >
                  {copiedReport ? (
                    <>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Copied Dossier for Official Grievance!
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      Copy Pre-formatted Incident Report
                    </>
                  )}
                </button>

                <a
                  href={meta.incidentReport.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-incident-link"
                >
                  Open {meta.incidentReport.recommendedPortal === 'chakshu' ? 'Chakshu Portal' : 'Cybercrime.gov.in'}
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>

                {meta.incidentReport.recommendedPortal === 'chakshu' ? (
                  <a
                    href="https://cybercrime.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-incident-secondary"
                  >
                    Cybercrime.gov.in (1930)
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                ) : (
                  <a
                    href="https://sancharsaathi.gov.in/sfc/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-incident-secondary"
                  >
                    DoT Chakshu (Sanchar Saathi)
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                )}
              </div>

              <details className="incident-dossier-preview">
                <summary className="incident-dossier-summary">
                  <span>View Pre-formatted Grievance Dossier</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </summary>
                <pre className="incident-dossier-text">{meta.incidentReport.dossierText}</pre>
              </details>
            </div>
          </div>
        )}

        {/* 4.5 OFFICIAL DOCUMENT & GAZETTE FORENSICS CARD */}
        {(meta?.documentAnalysis || turn.attachments?.find(a => a.documentAnalysis)?.documentAnalysis) && (() => {
          const docAnalysis = meta?.documentAnalysis || turn.attachments?.find(a => a.documentAnalysis)?.documentAnalysis;
          if (!docAnalysis) return null;
          return (
            <div className="document-forensics-card revealed" aria-label="Official Document & Gazette Scrutiny">
              <div className="document-forensics-head">
                <div className="document-forensics-title">
                  <FileIcon className="w-4 h-4 text-sky-400" />
                  <strong>Official Document & Gazette Scrutiny</strong>
                </div>
                <span className={`document-status-pill ${docAnalysis.status}`}>
                  {docAnalysis.pageCount} Page{docAnalysis.pageCount !== 1 ? 's' : ''} &bull; {docAnalysis.status}
                </span>
              </div>

              <div className="document-forensics-body">
                {/* Safe Failure / Error State Details */}
                {docAnalysis.errorDetails && (
                  <div className="doc-anomaly-item" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span><strong>Processing State:</strong> {docAnalysis.errorDetails}</span>
                  </div>
                )}

                {/* Extracted Identifiers Grid */}
                <div className="doc-identifiers-grid">
                  <div className="doc-identifier-card">
                    <span className="doc-identifier-label">Circular / Order Reference</span>
                    <span className="doc-identifier-val">
                      {docAnalysis.extractedIdentifiers.circularNumbers.length > 0
                        ? docAnalysis.extractedIdentifiers.circularNumbers.join(', ')
                        : 'No standard circular reference found'}
                    </span>
                  </div>

                  <div className="doc-identifier-card">
                    <span className="doc-identifier-label">Issuing Authority</span>
                    <span className="doc-identifier-val">
                      {docAnalysis.extractedIdentifiers.issuingAuthorities.length > 0
                        ? docAnalysis.extractedIdentifiers.issuingAuthorities.join(', ')
                        : 'Unspecified / Non-standard header'}
                    </span>
                  </div>

                  <div className="doc-identifier-card">
                    <span className="doc-identifier-label">Promulgation Dates</span>
                    <span className="doc-identifier-val">
                      {docAnalysis.extractedIdentifiers.dates.length > 0
                        ? docAnalysis.extractedIdentifiers.dates.join(', ')
                        : 'No explicit dates found'}
                    </span>
                  </div>

                  <div className="doc-identifier-card">
                    <span className="doc-identifier-label">Signatories & Seals</span>
                    <span className="doc-identifier-val">
                      {docAnalysis.extractedIdentifiers.signatoryNames.length > 0 || docAnalysis.extractedIdentifiers.stamps.length > 0
                        ? [...docAnalysis.extractedIdentifiers.signatoryNames, ...docAnalysis.extractedIdentifiers.stamps].join(', ')
                        : 'No signatory / seal block detected'}
                    </span>
                  </div>

                  {docAnalysis.extractedIdentifiers.monetaryAmounts.length > 0 && (
                    <div className="doc-identifier-card">
                      <span className="doc-identifier-label">Monetary Sums Declared</span>
                      <span className="doc-identifier-val">
                        {docAnalysis.extractedIdentifiers.monetaryAmounts.join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Regulatory Matches Cross-Reference */}
                {docAnalysis.regulatoryMatches && docAnalysis.regulatoryMatches.length > 0 && (
                  <div className="forensic-section">
                    <span className="forensic-section-label">Regulatory Source Cross-Check</span>
                    <div className="forensic-items-list">
                      {docAnalysis.regulatoryMatches.map((match, mIdx) => (
                        <div key={mIdx} className={`forensic-item status-${match.status === 'corroborated' ? 'safe' : match.status === 'deviant' ? 'critical' : 'suspicious'}`}>
                          <div className="forensic-item-main">
                            <span className={`forensic-status-pill ${match.status === 'corroborated' ? 'safe' : match.status === 'deviant' ? 'critical' : 'suspicious'}`}>
                              {match.status === 'corroborated' ? 'Official Gazette Format' : match.status === 'deviant' ? 'Deviant Format Flagged' : 'Unmatched Pattern'}
                            </span>
                            <span className="forensic-domain-text">{match.authority} ({match.schemePattern})</span>
                          </div>
                          <p className="forensic-reason-text">{match.notes}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Flagged Document Inconsistencies */}
                {docAnalysis.anomalies.length > 0 && (
                  <div className="forensic-section">
                    <span className="forensic-section-label">Flagged Document Inconsistencies ({docAnalysis.anomalies.length})</span>
                    <div className="doc-anomalies-list">
                      {docAnalysis.anomalies.map((anom, aIdx) => (
                        <div key={aIdx} className="doc-anomaly-item">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                          <div>
                            <strong>Page {anom.pageNumber} ({anom.type.replace(/_/g, ' ')}):</strong> {anom.details}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Page-by-Page Forensic Findings Accordion */}
                {docAnalysis.pages && docAnalysis.pages.length > 0 && (
                  <details className="doc-pages-accordion">
                    <summary className="doc-pages-summary">
                      <span>Page-Level Forensic Findings ({docAnalysis.pages.length} Pages Analyzed)</span>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </summary>
                    <div className="doc-pages-list">
                      {docAnalysis.pages.map(page => (
                        <div key={page.pageNumber} className="doc-page-row">
                          <div className="doc-page-head">
                            <span className="doc-page-badge">[Page {page.pageNumber}]</span>
                            <span className="doc-page-method">
                              {page.ocrApplied ? 'Scanned Page / OCR Applied' : 'Embedded PDF Text Stream'}
                            </span>
                          </div>
                          <div className="doc-page-body">
                            {page.circularNumbers.length > 0 && <span><strong>Ref:</strong> {page.circularNumbers.join(', ')} &bull; </span>}
                            {page.dates.length > 0 && <span><strong>Dates:</strong> {page.dates.join(', ')} &bull; </span>}
                            {page.signaturesDetected && <span><strong>Signatures/Stamps:</strong> Detected &bull; </span>}
                            <span><strong>Word Count:</strong> {page.wordCount} words</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Strict Non-Forgery Disclaimer */}
                <div className="doc-disclaimer-banner">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>
                    <strong>Forensic Notice:</strong> Formatting anomalies, domain mismatches, or layout deviations are highlighted for administrative verification. Visual and typographical heuristics alone do not establish document forgery. Authenticity must be confirmed against primary gazettes at <em>egazette.gov.in</em> or official issuing registries.
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 4.6 SECURE WEB INGESTION & LINK FORENSICS CARD */}
        {(meta?.urlAnalysis || turn.attachments?.find(a => a.urlAnalysis)?.urlAnalysis) && (() => {
          const urlAnalysis = meta?.urlAnalysis || turn.attachments?.find(a => a.urlAnalysis)?.urlAnalysis;
          if (!urlAnalysis) return null;
          return (
            <div className="web-forensics-card revealed" aria-label="Web Source & Link Forensics">
              <div className="web-forensics-head">
                <div className="web-forensics-title">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <strong>Web Ingestion & Link Forensics</strong>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className={`forensic-status-pill ${urlAnalysis.domainRisk.riskLevel === 'High' ? 'critical' : urlAnalysis.domainRisk.riskLevel === 'Medium' ? 'suspicious' : 'safe'}`}>
                    {urlAnalysis.domainRisk.riskLevel} Domain Risk
                  </span>
                  <span className={`document-status-pill ${urlAnalysis.status === 'success' ? 'clean' : 'anomalous'}`}>
                    {urlAnalysis.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="document-forensics-body">
                {/* SSRF / Failure / Restriction Notices */}
                {urlAnalysis.errorDetails && (
                  <div className="doc-anomaly-item" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div>
                      <strong>Ingestion Alert:</strong> {urlAnalysis.errorDetails}
                    </div>
                  </div>
                )}

                {/* Domain Warnings */}
                {urlAnalysis.domainRisk.warnings.length > 0 && (
                  <div className="doc-anomalies-list">
                    {urlAnalysis.domainRisk.warnings.map((warn, wIdx) => (
                      <div key={wIdx} className="doc-anomaly-item">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <div>{warn}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Metadata Grid */}
                <div className="doc-identifiers-grid">
                  <div className="doc-identifier-card">
                    <span className="doc-identifier-label">Resolved Domain</span>
                    <span className="doc-identifier-val">{urlAnalysis.domain}</span>
                  </div>

                  <div className="doc-identifier-card">
                    <span className="doc-identifier-label">Page Title</span>
                    <span className="doc-identifier-val">{urlAnalysis.title || 'No Title Declared'}</span>
                  </div>

                  <div className="doc-identifier-card">
                    <span className="doc-identifier-label">Published / Author</span>
                    <span className="doc-identifier-val">
                      {urlAnalysis.publishedDate ? `${urlAnalysis.publishedDate}` : 'Unknown Date'}
                      {urlAnalysis.author ? ` &bull; By ${urlAnalysis.author}` : ''}
                    </span>
                  </div>

                  <div className="doc-identifier-card">
                    <span className="doc-identifier-label">Extracted Content Scope</span>
                    <span className="doc-identifier-val">
                      {urlAnalysis.wordCount} words {urlAnalysis.isSocialPost ? `&bull; ${urlAnalysis.socialPlatform || 'Social'} Post` : ''}
                    </span>
                  </div>
                </div>

                {/* Redirect History Trail */}
                {urlAnalysis.redirectHistory.length > 1 && (
                  <div className="forensic-section">
                    <span className="forensic-section-label">Redirect Traversal History ({urlAnalysis.redirectHistory.length} Hops)</span>
                    <div className="web-redirect-chain">
                      {urlAnalysis.redirectHistory.map((hop, hIdx) => (
                        <div key={hIdx} className="web-redirect-hop">
                          <span className="web-redirect-arrow">{hIdx === 0 ? '▶' : '↳'}</span>
                          <span>{hop}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Flagged Download Links / APK Payloads */}
                {urlAnalysis.downloadLinks.length > 0 && (
                  <div className="forensic-section">
                    <span className="forensic-section-label" style={{ color: '#f87171' }}>Flagged Download Payloads ({urlAnalysis.downloadLinks.length})</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {urlAnalysis.downloadLinks.map((dlink, dIdx) => (
                        <span key={dIdx} className="web-payload-pill">
                          ⚠️ {dlink}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Factual Claims */}
                {urlAnalysis.claims.length > 0 && (
                  <div className="forensic-section">
                    <span className="forensic-section-label">Extracted Factual Claims for Cross-Examination ({urlAnalysis.claims.length})</span>
                    <div className="web-claims-list">
                      {urlAnalysis.claims.map((claim, cIdx) => (
                        <div key={cIdx} className="web-claim-card">
                          &ldquo;{claim}&rdquo;
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* 6. Challenger Agent Audit */}
        {meta?.challengerAudit && meta.challengerAudit.length > 0 && (
          <details className="challenger-box revealed" open>
            <summary className="challenger-summary">
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>What could make this assessment wrong? (Challenger Agent)</span>
            </summary>
            <div className="challenger-content">
              <p>To avoid unwarranted certainty, our adversarial verifier checked the following counter-hypotheses:</p>
              <ul>
                {meta.challengerAudit.map((pt, ptIdx) => (
                  <li key={ptIdx}>{pt}</li>
                ))}
              </ul>
            </div>
          </details>
        )}

            </div>
          </details>
        )}

        {/* 7. Contextual Follow-up Inquiries */}
        {!isLive && (
          <div className="followup-suggestions-section" aria-label="Suggested follow-up inquiries">
            <div className="followup-suggestions-label">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
              <span>SUGGESTED NEXT INQUIRIES</span>
            </div>
            <div className="followup-chips-grid">
              {getFollowUpChips(turn).map((chip, chipIdx) => (
                <button
                  key={chipIdx}
                  type="button"
                  className="followup-chip"
                  onClick={() => onFollowUpClick && onFollowUpClick(chip)}
                  title={`Investigate: "${chip}"`}
                >
                  <span>{chip}</span>
                  <span className="chip-arrow" aria-hidden="true">&rarr;</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 8. Action Controls Bar with animated checkmark feedback */}
        <div className="investigation-controls">
          <div className="controls-left">
            {isLive ? (
              <button className="control-btn stop" onClick={onStop} title="Stop generation">
                <StopIcon className="w-3.5 h-3.5" /> <span>Stop</span>
              </button>
            ) : (
              <>
                <button
                  className={`control-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopy}
                  title={copied ? 'Copied briefing to clipboard!' : 'Copy briefing'}
                >
                  {copied ? (
                    <>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--dam-green)' }}>
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span style={{ color: 'var(--dam-green)', fontWeight: 650 }}>Copied!</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="w-3.5 h-3.5" /> <span>Copy Briefing</span>
                    </>
                  )}
                </button>
                <button className="control-btn" onClick={onRetry} title="Re-evaluate investigation">
                  <RetryIcon className="w-3.5 h-3.5" /> <span>Re-evaluate</span>
                </button>
                {!isLive && turn.fullText && (
                  <button
                    type="button"
                    className={`control-btn ${showAudio ? 'active' : ''}`}
                    onClick={() => setShowAudio(prev => !prev)}
                    title={showAudio ? 'Hide audio advisory' : 'Listen to regional audio advisory'}
                  >
                    <VolumeIcon className="w-3.5 h-3.5" />
                    <span>{showAudio ? 'Hide Audio' : 'Listen'}</span>
                  </button>
                )}
                {meta?.certificate && (
                  <button
                    type="button"
                    className="control-btn cert-trigger-btn"
                    onClick={() => setShowCertModal(true)}
                    title="View Cryptographic SHA-256 Legal Evidence Certificate"
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span>SHA-256 Legal Certificate</span>
                  </button>
                )}
              </>
            )}
          </div>
          <div className="controls-right">
            <button
              className="control-btn"
              onClick={() => {
                const blob = new Blob([turn.fullText || ''], { type: 'text/markdown;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dam_investigation_briefing.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              title="Download Markdown"
            >
              <FileIcon className="w-3.5 h-3.5" /> <span>Markdown</span>
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

  const [isWatchtowerOpen, setIsWatchtowerOpen] = useState(false);

  return (
    <div className="conversation" id="conversation">
      {/* Live Regulatory Watchtower Banner */}
      <div className="feed-watchtower-bar">
        <button
          type="button"
          className="watchtower-trigger-btn"
          onClick={() => setIsWatchtowerOpen(true)}
          title="Open Live National Regulatory Watchtower (PIB, RBI, TRAI, CERT-In)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#38bdf8', flexShrink: 0 }} aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
            <path d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6z" />
            <circle cx="12" cy="12" r="2" fill="#38bdf8" />
          </svg>
          <span className="watchtower-btn-title">Live Regulatory Watchtower</span>
          <span className="watchtower-btn-badge">6 Active Bulletins</span>
        </button>
      </div>

      <WatchtowerDrawer
        isOpen={isWatchtowerOpen}
        onClose={() => setIsWatchtowerOpen(false)}
      />

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
