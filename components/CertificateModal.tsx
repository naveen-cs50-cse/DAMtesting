'use client';

import React, { useState } from 'react';
import { VerificationCertificate } from '@/lib/investigation/certificate';

interface CertificateModalProps {
  certificate: VerificationCertificate;
  isOpen: boolean;
  onClose: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  certificate,
  isOpen,
  onClose,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);

  if (!isOpen) return null;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(certificate.sha256Fingerprint);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="cert-backdrop" onClick={onClose}>
      <div
        className="cert-modal-dialog"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Tamper-Evident Verification Certificate"
      >
        <div className="cert-print-container">
          {/* Certificate Header with Seal */}
          <div className="cert-head">
            <div className="cert-seal-badge">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div className="cert-title-block">
              <span className="cert-org-label">DEFENCE AGAINST MISINFORMATION (DAM)</span>
              <h2 className="cert-heading">Tamper-Evident Evidence Certificate</h2>
              <span className="cert-authority-text">{certificate.issuingAuthority}</span>
            </div>
            <button
              type="button"
              className="cert-close-btn no-print"
              onClick={onClose}
              aria-label="Close Certificate"
            >
              &times;
            </button>
          </div>

          <div className="cert-body">
            {/* Status & ID Ribbon */}
            <div className="cert-ribbon-row">
              <div className="cert-id-tag">
                <span className="cert-field-lbl">CERTIFICATE ID:</span>
                <span className="cert-mono-bold">{certificate.certificateId}</span>
              </div>
              <div className={`cert-status-badge status-${certificate.status.toLowerCase()}`}>
                {certificate.status.replace(/_/g, ' ')}
              </div>
            </div>

            {/* Cryptographic SHA-256 Fingerprint */}
            <div className="cert-hash-box">
              <div className="cert-hash-head">
                <span className="cert-field-lbl">CRYPTOGRAPHIC SHA-256 EVIDENCE FINGERPRINT</span>
                <button
                  type="button"
                  className="cert-copy-btn no-print"
                  onClick={handleCopyHash}
                  title="Copy SHA-256 hash"
                >
                  {copiedHash ? '✓ Copied' : 'Copy Hash'}
                </button>
              </div>
              <div className="cert-hash-code">{certificate.sha256Fingerprint}</div>
              <span className="cert-hash-hint">
                Cryptographically computed across raw citizen input, forensic indicators, and timestamped gazette registry match.
              </span>
            </div>

            {/* Metadata Grid */}
            <div className="cert-meta-grid">
              <div className="cert-meta-cell">
                <span className="cert-field-lbl">TIMESTAMP (IST):</span>
                <span className="cert-meta-val">{certificate.timestampIST}</span>
              </div>
              <div className="cert-meta-cell">
                <span className="cert-field-lbl">CASE DOSSIER REF:</span>
                <span className="cert-meta-val">{certificate.caseId}</span>
              </div>
            </div>

            {/* Inquiry Digest */}
            <div className="cert-section-block">
              <span className="cert-field-lbl">SUBJECT INQUIRY DIGEST</span>
              <div className="cert-digest-box">"{certificate.inquiryDigest}"</div>
            </div>

            {/* Core Verification Findings */}
            <div className="cert-section-block">
              <span className="cert-field-lbl">VERIFIED REGULATORY FINDINGS</span>
              <ul className="cert-findings-list">
                {certificate.topFindings.map((finding, fIdx) => (
                  <li key={fIdx}>{finding}</li>
                ))}
              </ul>
            </div>

            {/* Cited Statutory Provisions */}
            {certificate.legalClauses && certificate.legalClauses.length > 0 && (
              <div className="cert-section-block">
                <span className="cert-field-lbl">STATUTORY PROVISIONS CROSS-EXAMINED</span>
                <div className="cert-clauses-list">
                  {certificate.legalClauses.map((clause, cIdx) => (
                    <span key={cIdx} className="cert-clause-chip">{clause}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Footer / Validity Notice */}
            <div className="cert-foot">
              <div className="cert-foot-legal">
                <strong>Admissibility Notice:</strong> This document constitutes an automated, immutable digital evidence record generated under Section 65B of the Indian Evidence Act, 1872 / Section 63 of Bharatiya Sakshya Adhiniyam, 2023 for reporting to Law Enforcement (1930 / cybercrime.gov.in) and banking grievance redressal.
              </div>
            </div>
          </div>

          {/* Action Bar (Hidden during print) */}
          <div className="cert-actions-bar no-print">
            <button
              type="button"
              className="cert-btn-primary"
              onClick={handlePrint}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print / Save Official Certificate (PDF)
            </button>
            <button
              type="button"
              className="cert-btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
