'use client';

import React from 'react';
import Image from 'next/image';

interface LandingBlockProps {
  onSelectPrompt: (prompt: string) => void;
}

export const LandingBlock: React.FC<LandingBlockProps> = ({ onSelectPrompt }) => {
  return (
    <div className="landing-block" id="landingBlock">
      <div className="welcome" id="welcome">
        <div className="landing-brand-header">
          <Image 
            src="/assets/dam-lockup-transparent.png" 
            alt="DAM | Defence Against Misinformation" 
            width={180}
            height={42}
            className="landing-brand-logo"
            priority
          />
          <span className="landing-live-badge">
            <span className="live-dot" />
            LIVE PRIVATE BETA
          </span>
        </div>
        <h1 className="landing-heading">
          What should we investigate?
        </h1>
        <p className="landing-subtext">
          Verify suspicious WhatsApp forwards, fake government circulars, APK files, and banking alerts. DAM separates primary source facts from unverified claims.
        </p>

        {/* Indian Scam Trends Strip */}
        <div className="scam-trends-strip" aria-label="Recent Indian scam trends">
          <div className="trends-label">
            <span className="live-blink" aria-hidden="true" />
            <span>TRENDING THREATS (INDIA)</span>
          </div>
          <div className="trends-carousel" id="scamTrendsCarousel">
            <button
              className="trend-pill"
              onClick={() => onSelectPrompt("Check this message: 'Dear consumer, your electricity power will be disconnected at 9:30 PM tonight by officer because your previous month bill was not updated. Immediately call 9821xxxxxx.'")}
            >
              <span className="trend-tag alert">DISCONNECTION SMS</span>
              <span className="trend-text">Electricity disconnection threat with 10-digit mobile number</span>
            </button>
            <button
              className="trend-pill"
              onClick={() => onSelectPrompt("Verify this APK file message: 'Dear Customer, your SBI YONO account is suspended due to pending KYC. Download this SBI_Rewards.apk to update PAN.'")}
            >
              <span className="trend-tag warning">FAKE BANK APK</span>
              <span className="trend-text">SBI/HDFC KYC suspension notice delivering malware APK</span>
            </button>
            <button
              className="trend-pill"
              onClick={() => onSelectPrompt("Fact-check this call/SMS: 'TRAI notice: Your mobile number will be blocked within 2 hours due to illegal advertising complaints. Press 9 for verification.'")}
            >
              <span className="trend-tag info">TRAI THREAT</span>
              <span className="trend-text">TRAI / DoT mobile number deactivation threat</span>
            </button>
            <button
              className="trend-pill"
              onClick={() => onSelectPrompt("Verify government scheme message: 'PM Kisan 17th installment of ₹2000 released today. Check beneficiary name list and claim bonus ₹5000 at pmbihar-gov.in'")}
            >
              <span className="trend-tag alert">FAKE SCHEME</span>
              <span className="trend-text">PM Kisan fake subsidy link claiming ₹5,000 extra bonus</span>
            </button>
          </div>
        </div>

        {/* Starter Cards 1-4 */}
        <div className="starter-grid" role="group" aria-label="Investigation types">
          <button
            className="starter starter-claim"
            data-key="1"
            onClick={() => onSelectPrompt("Fact-check this claim: RBI has announced demonetization or withdrawal of ₹500 banknotes from circulation.")}
          >
            <div className="starter-header">
              <span className="starter-icon red" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6"/></svg>
              </span>
              <span className="starter-badge">1</span>
            </div>
            <div className="starter-text">
              <strong>Check a claim</strong>
              <small>Verify dates, circulars, and official statements</small>
            </div>
          </button>

          <button
            className="starter starter-scam"
            data-key="2"
            onClick={() => onSelectPrompt("Assess this message for scam, impersonation, or phishing risk: 'Dear consumer, electricity supply will be disconnected tonight at 9:30 PM due to unpaid bill. Call electric officer immediately.'")}
          >
            <div className="starter-header">
              <span className="starter-icon amber" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 3 19h18L12 3zm0 6v4m0 3h.01"/></svg>
              </span>
              <span className="starter-badge">2</span>
            </div>
            <div className="starter-text">
              <strong>Assess a message</strong>
              <small>Detect phishing, fake sender IDs, and extortion alerts</small>
            </div>
          </button>

          <button
            className="starter starter-docs"
            data-key="3"
            onClick={() => onSelectPrompt("Review this government notification or gazette order against official ministry portals to verify its authenticity.")}
          >
            <div className="starter-header">
              <span className="starter-icon blue" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 4h10v16H7zM10 8h4m-4 4h4m-4 4h3"/></svg>
              </span>
              <span className="starter-badge">3</span>
            </div>
            <div className="starter-text">
              <strong>Review documents</strong>
              <small>Cross-examine notifications against official gazettes</small>
            </div>
          </button>

          <button
            className="starter starter-research"
            data-key="4"
            onClick={() => onSelectPrompt("Investigate recent CERT-In cyber security advisories regarding malicious Android banking trojans targeting Indian users.")}
          >
            <div className="starter-header">
              <span className="starter-icon green" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
              </span>
              <span className="starter-badge">4</span>
            </div>
            <div className="starter-text">
              <strong>Research a topic</strong>
              <small>Generate an evidence-backed intelligence briefing</small>
            </div>
          </button>
        </div>

        {/* Popular Verification Requests */}
        <div className="examples-section">
          <span className="examples-heading">POPULAR VERIFICATION REQUESTS:</span>
          <div className="examples-pills">
            <button
              className="example-chip"
              onClick={() => onSelectPrompt("Is this KYC update SMS real? 'Dear Customer, your bank account will be blocked today. Click link to complete KYC immediately.'")}
            >
              Is this KYC update SMS real?
            </button>
            <button
              className="example-chip"
              onClick={() => onSelectPrompt("Check this TRAI / RBI notice claiming all 5G SIM cards require mandatory re-verification or security deposit.")}
            >
              Check this TRAI / RBI notice
            </button>
            <button
              className="example-chip"
              onClick={() => onSelectPrompt("Verify this electricity bill disconnection message threatening power cut tonight at 9:30 PM.")}
            >
              Verify electricity bill disconnection message
            </button>
            <button
              className="example-chip"
              onClick={() => onSelectPrompt("Is this government scheme forward genuine offering free ₹50,000 under PM Kanya Ayush Yojana?")}
            >
              Is this government scheme forward genuine?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
