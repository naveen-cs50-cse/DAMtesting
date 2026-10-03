'use client';

import React from 'react';

interface MethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MethodologyModal: React.FC<MethodologyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="methodology-modal" role="dialog" aria-modal="true" aria-label="How DAM Verifies Evidence">
        <div className="modal-header">
          <div className="methodology-brand">
            <span className="brand-mark">D</span>
            <div>
              <h3>How DAM Verifies Evidence</h3>
              <small>India Regulatory &amp; Scam Detection Protocol v2.4</small>
            </div>
          </div>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>
        <div className="methodology-body">
          <section className="methodology-section">
            <h4>1. Primary Source Registry First</h4>
            <p>DAM indexes official Indian registries including the <strong>Reserve Bank of India (rbi.org.in)</strong>, <strong>Press Information Bureau Fact Check (pib.gov.in)</strong>, <strong>Telecom Regulatory Authority of India (trai.gov.in)</strong>, and <strong>CERT-In (cert-in.org.in)</strong>. It never accepts second-hand rumors without primary confirmation.</p>
          </section>
          <section className="methodology-section">
            <h4>2. Autonomous Challenger Agent</h4>
            <p>Every finding is challenged by a dedicated red-team agent that actively seeks reasons why the verdict could be premature, outdated, or jurisdictionally restricted (e.g. state-specific disconnections vs central notifications).</p>
          </section>
          <section className="methodology-section">
            <h4>3. Three Separate Verdicts &mdash; Never Blended</h4>
            <p>DAM rejects single composite truth scores. We report:
              <br />&bull; <strong>Factual Correctness</strong> (Supported, Contradicted, Mixed, Unverified)
              <br />&bull; <strong>Scam Risk</strong> (Low, Medium, High + specific triggered signals)
              <br />&bull; <strong>Evidence Sufficiency</strong> (Sufficient, Partial, Insufficient)
            </p>
          </section>
          <section className="methodology-section">
            <h4>4. Insufficient Evidence is a First-Class Verdict</h4>
            <p>When authoritative proof is not yet published by the relevant regulatory authority, DAM explicitly concludes <em>&quot;Insufficient Evidence&quot;</em> instead of guessing or hallucinating.</p>
          </section>
        </div>
        <div className="modal-footer">
          <button type="button" className="primary-btn" onClick={onClose}>Understood</button>
        </div>
      </div>
    </div>
  );
};
