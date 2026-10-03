'use client';

import React from 'react';
import { ChatTurn } from '@/lib/investigation/types';
import { CopyIcon, EvidenceIcon, FileIcon, ImageIcon, RetryIcon, ShieldIcon, SpinnerIcon, StopIcon } from './icons';

interface ConversationFeedProps {
  turns: ChatTurn[];
  isStreaming: boolean;
  onCitationClick: (citeIndex: number) => void;
  onOpenEvidence: () => void;
  onCopyBriefing: (text: string) => void;
  onRetry: () => void;
  onStop: () => void;
}

export const ConversationFeed: React.FC<ConversationFeedProps> = ({
  turns,
  isStreaming,
  onCitationClick,
  onOpenEvidence,
  onCopyBriefing,
  onRetry,
  onStop,
}) => {
  const renderMarkdown = (text: string = '', isLive: boolean = false) => {
    let cleaned = text
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
                  return <h3 key={lineIdx}>{line.slice(4)}</h3>;
                }
                if (line.startsWith('## ')) {
                  return <h2 key={lineIdx}>{line.slice(3)}</h2>;
                }
                return (
                  <React.Fragment key={lineIdx}>
                    {lineIdx > 0 && <br />}
                    {line.replace(/\*\*(.*?)\*\*/g, '$1')}
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
            <div key={turn.id} className="chat-turn user-row">
              <div className="user-turn">
                {turn.attachments && turn.attachments.length > 0 && (
                  <div className="user-turn-attachments">
                    {turn.attachments.map((att, idx) => (
                      <span key={idx} className="attachment-pill">
                        {att.type === 'application/pdf' ? (
                          <FileIcon className="w-3.5 h-3.5 text-blue-400" />
                        ) : att.isUrl ? (
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={att.preview} alt={att.name} className="user-attachment-thumb" />
                        )}
                        <span>{att.name}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="user-turn-text">{turn.content}</div>
              </div>
              <div className="user-turn-actions">
                <button
                  type="button"
                  className="user-turn-copy-btn"
                  title="Copy prompt"
                  onClick={() => onCopyBriefing(turn.content || '')}
                >
                  <CopyIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        }

        if (turn.role === 'assistant') {
          const meta = turn.meta;
          const stages = turn.stages || [];
          const isLive = turn.isLive && isStreaming;

          return (
            <div key={turn.id} className="chat-turn">
              <div className="assistant-turn">
                {/* 1. Genspark-Style Research Activity Accordion */}
                <details className="investigation-activity" open={isLive || stages.length > 0}>
                  <summary className="activity-summary-bar">
                    <div className="activity-summary-left">
                      <span className={`activity-pulse-dot ${isLive ? 'running' : ''}`} aria-hidden="true" />
                      <span className="activity-summary-title">
                        {isLive ? 'Live Investigation in Progress...' : 'Investigation Audit Trail & Primary Registries'}
                      </span>
                    </div>
                    <div className="activity-summary-meta">
                      <span>{stages.length ? `${stages.length} stages` : '5 stages'} &bull; {meta?.sources?.length || 0} sources</span>
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

                {/* 2. Streaming Briefing Prose */}
                <div className={`answer-prose ${isLive ? 'generating' : ''}`}>
                  {renderMarkdown(turn.fullText || '', isLive)}
                </div>

                {/* 3. Three Separate Verdict Cards */}
                {meta?.verdicts && (
                  <div className="verdicts-grid revealed">
                    <div className="verdict-card">
                      <span className="verdict-header">Factual Correctness</span>
                      <div className={`verdict-badge verdict-${meta.verdicts.factualCorrectness.toLowerCase()}`}>
                        <span>{meta.verdicts.factualCorrectness}</span>
                      </div>
                      <p className="verdict-notes">Based on published Indian gazettes, RBI, PIB, and official portals.</p>
                    </div>

                    <div className="verdict-card">
                      <span className="verdict-header">Scam Risk</span>
                      <div className={`verdict-badge risk-${meta.verdicts.scamRisk.toLowerCase()}`}>
                        <span>{meta.verdicts.scamRisk} Risk</span>
                      </div>
                      <div className="verdict-triggers">
                        {meta.verdicts.riskTriggers.map((t, tIdx) => (
                          <span key={tIdx} className="trigger-tag">{t}</span>
                        ))}
                      </div>
                    </div>

                    <div className="verdict-card">
                      <span className="verdict-header">Evidence Sufficiency</span>
                      <div className={`verdict-badge suff-${meta.verdicts.evidenceSufficiency.toLowerCase()}`}>
                        <span>{meta.verdicts.evidenceSufficiency}</span>
                      </div>
                      <p className="verdict-notes">Zero-hallucination standard. Honest disclosure when facts are scarce.</p>
                    </div>
                  </div>
                )}

                {/* 4. Claim-by-Claim Breakdown Table */}
                {meta?.claims && meta.claims.length > 0 && (
                  <div className="claim-breakdown revealed">
                    <h4>Claim-by-Claim Breakdown</h4>
                    <div className="claims-table-wrapper">
                      <table className="claims-table">
                        <thead>
                          <tr>
                            <th style={{ width: '30%' }}>Claim Assertion</th>
                            <th style={{ width: '18%' }}>Verdict</th>
                            <th style={{ width: '26%' }}>Supporting Evidence</th>
                            <th style={{ width: '26%' }}>Contradicting Evidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {meta.claims.map((c, cIdx) => (
                            <tr key={cIdx}>
                              <td><strong>{c.claim}</strong></td>
                              <td><span className={`verdict-badge verdict-${c.label.toLowerCase()}`}>{c.label}</span></td>
                              <td>{c.supporting}</td>
                              <td>{c.contradicting}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5. Primary Sources Strip */}
                {meta?.sources && meta.sources.length > 0 && (
                  <div className="sources-section revealed">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4>Indexed Primary Sources ({meta.sources.length})</h4>
                      <button
                        type="button"
                        className="quiet-button text-link"
                        onClick={onOpenEvidence}
                      >
                        <EvidenceIcon className="w-3.5 h-3.5" />
                        <span>Open Evidence Explorer &rarr;</span>
                      </button>
                    </div>

                    <div className="sources-grid">
                      {meta.sources.map(src => (
                        <div key={src.id} className="source-card">
                          <div className="source-card-head">
                            <span className="source-domain">[{src.id}] {src.domain}</span>
                            <span className={`source-badge ${src.type.toLowerCase().replace(/[^a-z]/g, '')}`}>{src.type}</span>
                          </div>
                          <a href={src.url} target="_blank" rel="noopener noreferrer" className="source-title">
                            {src.title}
                          </a>
                          <div className="source-date">Published {src.date} &bull; Direct Link ↗</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Challenger Agent */}
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

                {/* 7. Action Bar */}
                <div className="investigation-controls">
                  <div className="controls-left">
                    {isLive ? (
                      <button className="control-btn stop" onClick={onStop} title="Stop generation">
                        <StopIcon className="w-3.5 h-3.5" /> <span>Stop</span>
                      </button>
                    ) : (
                      <>
                        <button
                          className="control-btn"
                          onClick={() => onCopyBriefing(turn.fullText || '')}
                          title="Copy briefing"
                        >
                          <CopyIcon className="w-3.5 h-3.5" /> <span>Copy Briefing</span>
                        </button>
                        <button className="control-btn" onClick={onRetry} title="Re-evaluate investigation">
                          <RetryIcon className="w-3.5 h-3.5" /> <span>Re-evaluate</span>
                        </button>
                      </>
                    )}
                  </div>
                  <div className="controls-right">
                    <button className="control-btn" onClick={() => window.print()} title="Print or Export PDF">
                      <FileIcon className="w-3.5 h-3.5" /> <span>Export PDF</span>
                    </button>
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
              </div>
            </div>
          );
        }

        return null;
      })}
      <div id="conversationBottomAnchor" style={{ height: 1, minHeight: 1, pointerEvents: 'none' }} />
    </div>
  );
};
