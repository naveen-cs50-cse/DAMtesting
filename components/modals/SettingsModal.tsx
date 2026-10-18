'use client';

import React, { useState, useEffect } from 'react';
import { SettingsIcon, CopyIcon, CheckIcon, GlobeIcon, ShareIcon } from '../icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: string;
  setActiveMode: (mode: string) => void;
  activeLang: string;
  setActiveLang: (lang: string) => void;
  onOpenWhatsApp?: () => void;
  onOpenExtension?: () => void;
  onClearHistory?: () => void;
  onExportHistory?: () => void;
  investigationCount?: number;
  showToast: (msg: string) => void;
}

type SettingsTab = 'engine' | 'integrations' | 'preferences' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeMode,
  setActiveMode,
  activeLang,
  setActiveLang,
  onOpenWhatsApp,
  onOpenExtension,
  onClearHistory,
  onExportHistory,
  investigationCount = 0,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('engine');

  // Client Device Identity
  const [deviceId, setDeviceId] = useState('');
  const [copiedDeviceId, setCopiedDeviceId] = useState(false);

  // Preference Toggles
  const [strictStatutes, setStrictStatutes] = useState(true);
  const [aiChallenger, setAiChallenger] = useState(true);
  const [ambientGlow, setAmbientGlow] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        // Device ID initialization
        let currentDevice = localStorage.getItem('dam-device-id');
        if (!currentDevice) {
          currentDevice = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
          localStorage.setItem('dam-device-id', currentDevice);
        }
        setDeviceId(currentDevice);

        setStrictStatutes(localStorage.getItem('dam-strict-statutes') !== 'false');
        setAiChallenger(localStorage.getItem('dam-ai-challenger') !== 'false');
        setAmbientGlow(localStorage.getItem('dam-ambient-glow') !== 'false');
        setSoundAlerts(localStorage.getItem('dam-sound-alerts') === 'true');
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyDeviceId = () => {
    navigator.clipboard.writeText(deviceId);
    setCopiedDeviceId(true);
    showToast('Device Identifier copied to clipboard');
    setTimeout(() => setCopiedDeviceId(false), 2000);
  };

  const handleRegenerateDeviceId = () => {
    const newId = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem('dam-device-id', newId);
    setDeviceId(newId);
    showToast('Client Device Session regenerated');
  };

  const handleToggleStrictStatutes = () => {
    const nextVal = !strictStatutes;
    setStrictStatutes(nextVal);
    localStorage.setItem('dam-strict-statutes', String(nextVal));
    showToast(nextVal ? 'Strict statutory alerts enabled' : 'Strict statutory alerts relaxed');
  };

  const handleToggleAiChallenger = () => {
    const nextVal = !aiChallenger;
    setAiChallenger(nextVal);
    localStorage.setItem('dam-ai-challenger', String(nextVal));
    showToast(nextVal ? 'Adversarial Challenger Agent enabled' : 'Adversarial Challenger disabled');
  };

  const handleToggleAmbientGlow = () => {
    const nextVal = !ambientGlow;
    setAmbientGlow(nextVal);
    localStorage.setItem('dam-ambient-glow', String(nextVal));
    showToast(nextVal ? 'Ambient verdict backlighting active' : 'Ambient backlighting disabled');
  };

  const handleToggleSoundAlerts = () => {
    const nextVal = !soundAlerts;
    setSoundAlerts(nextVal);
    localStorage.setItem('dam-sound-alerts', String(nextVal));
    showToast(nextVal ? 'High-threat audio alerts enabled' : 'Audio alerts muted');
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="System Settings">
      <div
        className="methodology-modal"
        style={{
          width: 'min(780px, 96vw)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          background: '#0d0e12',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.75)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 650, color: '#ffffff' }}>
                System &amp; Verification Settings
              </h3>
              <small style={{ color: '#888888', fontSize: '12px' }}>
                Manage verification calibration, client integrations, and display preferences
              </small>
            </div>
          </div>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '10px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(0, 0, 0, 0.2)',
            overflowX: 'auto'
          }}
        >
          <button
            type="button"
            className="settings-tab-btn"
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 550,
              cursor: 'pointer',
              border: activeTab === 'engine' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',
              background: activeTab === 'engine' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: activeTab === 'engine' ? '#ffffff' : '#888888',
              transition: 'all 0.15s ease'
            }}
            onClick={() => setActiveTab('engine')}
          >
            Verification Engine
          </button>

          <button
            type="button"
            className="settings-tab-btn"
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 550,
              cursor: 'pointer',
              border: activeTab === 'integrations' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',
              background: activeTab === 'integrations' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: activeTab === 'integrations' ? '#ffffff' : '#888888',
              transition: 'all 0.15s ease'
            }}
            onClick={() => setActiveTab('integrations')}
          >
            Devices &amp; Integrations
          </button>

          <button
            type="button"
            className="settings-tab-btn"
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 550,
              cursor: 'pointer',
              border: activeTab === 'preferences' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',
              background: activeTab === 'preferences' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: activeTab === 'preferences' ? '#ffffff' : '#888888',
              transition: 'all 0.15s ease'
            }}
            onClick={() => setActiveTab('preferences')}
          >
            Interface &amp; Audio
          </button>

          <button
            type="button"
            className="settings-tab-btn"
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 550,
              cursor: 'pointer',
              border: activeTab === 'data' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',
              background: activeTab === 'data' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: activeTab === 'data' ? '#ffffff' : '#888888',
              transition: 'all 0.15s ease'
            }}
            onClick={() => setActiveTab('data')}
          >
            Data &amp; Privacy
          </button>
        </div>

        {/* Modal Body / Tab Contents */}
        <div className="methodology-body" style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* TAB 1: VERIFICATION ENGINE */}
          {activeTab === 'engine' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Default Investigation Mode
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {[
                    { id: 'evidence', title: 'Evidence First', desc: 'Standard statutory cross-examination & primary circular matching.' },
                    { id: 'quick', title: 'Quick Check', desc: 'Low-latency triage check optimized for social media feeds.' },
                    { id: 'deep', title: 'Deep Forensic', desc: 'Comprehensive multi-page PDF & cross-jurisdictional review.' },
                  ].map(modeOpt => (
                    <div
                      key={modeOpt.id}
                      onClick={() => {
                        setActiveMode(modeOpt.id);
                        localStorage.setItem('dam-mode', modeOpt.id);
                        showToast(`Active investigation mode set to ${modeOpt.title}`);
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        border: activeMode === modeOpt.id ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: activeMode === modeOpt.id ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '13.5px', color: activeMode === modeOpt.id ? '#ffffff' : '#e4e4e7' }}>
                          {modeOpt.title}
                        </strong>
                        {activeMode === modeOpt.id && (
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '11.5px', color: '#71717a', lineHeight: 1.4 }}>
                        {modeOpt.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Language Alignment
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'auto', label: 'Auto-Detect' },
                    { id: 'en', label: 'English' },
                    { id: 'hi', label: 'Hindi (हिन्दी)' },
                    { id: 'ta', label: 'Tamil (தமிழ்)' },
                    { id: 'te', label: 'Telugu (తెలుగు)' },
                    { id: 'bn', label: 'Bengali (বাংলা)' },
                    { id: 'mr', label: 'Marathi (मराठी)' },
                  ].map(langOpt => (
                    <button
                      key={langOpt.id}
                      type="button"
                      onClick={() => {
                        setActiveLang(langOpt.id);
                        localStorage.setItem('dam-lang', langOpt.id);
                        showToast(`Language set to ${langOpt.label}`);
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        border: activeLang === langOpt.id ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: activeLang === langOpt.id ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        color: activeLang === langOpt.id ? '#ffffff' : '#888888'
                      }}
                    >
                      {langOpt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#ffffff', display: 'block' }}>
                      Strict Statutory Thresholds
                    </strong>
                    <small style={{ color: '#71717a', fontSize: '12px' }}>
                      Enforce Electricity Act Sec 56 notice violations and BNS Sec 204 Digital Arrest extortion flags.
                    </small>
                  </div>
                  <input
                    type="checkbox"
                    checked={strictStatutes}
                    onChange={handleToggleStrictStatutes}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3b82f6' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#ffffff', display: 'block' }}>
                      Adversarial Challenger Agent
                    </strong>
                    <small style={{ color: '#71717a', fontSize: '12px' }}>
                      Autonomous red-team agent that aggressively checks for reasons why a verdict could be premature.
                    </small>
                  </div>
                  <input
                    type="checkbox"
                    checked={aiChallenger}
                    onChange={handleToggleAiChallenger}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3b82f6' }}
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 2: DEVICES & INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <>
              {/* Client Device ID Box */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                  Local Client Device Identifier
                </label>
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#71717a' }}>
                  UseDAM enforces per-investigation ownership isolation. This UUID identifies this browser session across the Shared API.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    className="modal-input"
                    value={deviceId}
                    style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12.5px' }}
                  />
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleCopyDeviceId}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    {copiedDeviceId ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                    <span>{copiedDeviceId ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    className="quiet-button"
                    style={{ fontSize: '11.5px', color: '#a1a1aa' }}
                    onClick={handleRegenerateDeviceId}
                  >
                    Regenerate Device Token
                  </button>
                </div>
              </div>

              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />

              {/* Connected Client Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <GlobeIcon className="w-4 h-4" />
                    <strong style={{ fontSize: '13px', color: '#ffffff' }}>Browser Extension</strong>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: '#71717a', lineHeight: 1.4 }}>
                    Real-time fact check badges across X (Twitter), Reddit, and news feeds.
                  </p>
                  <button
                    type="button"
                    className="secondary-btn"
                    style={{ fontSize: '12px', padding: '5px 12px' }}
                    onClick={() => {
                      onClose();
                      onOpenExtension?.();
                    }}
                  >
                    Extension Setup
                  </button>
                </div>

                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <ShareIcon className="w-4 h-4" />
                    <strong style={{ fontSize: '13px', color: '#ffffff' }}>WhatsApp Verification</strong>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: '#71717a', lineHeight: 1.4 }}>
                    Forward suspicious viral claims, SMS alerts, and APK notices directly.
                  </p>
                  <button
                    type="button"
                    className="secondary-btn"
                    style={{ fontSize: '12px', padding: '5px 12px' }}
                    onClick={() => {
                      onClose();
                      onOpenWhatsApp?.();
                    }}
                  >
                    WhatsApp Connection
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 4: INTERFACE & PREFERENCES */}
          {activeTab === 'preferences' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#ffffff', display: 'block' }}>
                      Ambient Backlight Edge Glow
                    </strong>
                    <small style={{ color: '#71717a', fontSize: '12px' }}>
                      Flashes a subtle green (Verified) or red (Scam/False) illumination across screen borders upon determination.
                    </small>
                  </div>
                  <input
                    type="checkbox"
                    checked={ambientGlow}
                    onChange={handleToggleAmbientGlow}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3b82f6' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#ffffff', display: 'block' }}>
                      High-Threat Scam Audio Chime
                    </strong>
                    <small style={{ color: '#71717a', fontSize: '12px' }}>
                      Plays an audible alert chime when a critical extortion threat or active phishing campaign is detected.
                    </small>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundAlerts}
                    onChange={handleToggleSoundAlerts}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3b82f6' }}
                  />
                </div>
              </div>

              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Keyboard Shortcuts
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '12.5px' }}>
                  {[
                    { key: 'Enter', action: 'Send verification inquiry' },
                    { key: 'Shift + Enter', action: 'Insert new line in composer' },
                    { key: 'Ctrl / Cmd + K', action: 'Quick focus composer' },
                    { key: 'Esc', action: 'Close active modal / overlay' },
                  ].map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.06)'
                      }}
                    >
                      <span style={{ color: '#a1a1aa' }}>{s.action}</span>
                      <kbd style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px', color: '#ffffff', fontFamily: 'monospace', fontSize: '11px' }}>
                        {s.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TAB 5: DATA & STORAGE */}
          {activeTab === 'data' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Local Workstation Storage
                </label>
                <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: '#a1a1aa', lineHeight: 1.5 }}>
                  You currently have <strong>{investigationCount}</strong> investigation cases recorded in this workstation. All session records are stored client-side in your browser.
                </p>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {onExportHistory && (
                    <button
                      type="button"
                      className="secondary-btn"
                      style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={onExportHistory}
                    >
                      <span>Export Cases (.JSON)</span>
                    </button>
                  )}

                  {onClearHistory && (
                    <button
                      type="button"
                      className="quiet-button"
                      style={{ color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
                      onClick={() => {
                        if (confirm('Are you sure you want to delete all local investigation history? This action cannot be undone.')) {
                          onClearHistory();
                          onClose();
                        }
                      }}
                    >
                      Delete All History
                    </button>
                  )}
                </div>
              </div>

              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />

              <div style={{ fontSize: '12px', color: '#71717a', lineHeight: 1.5 }}>
                <strong>Privacy Policy Commitment:</strong> UseDAM does not resell user inquiries or biometric document data. Uploaded documents are stripped of PII and verified strictly against public Indian gazettes.
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px'
          }}
        >
          <button type="button" className="primary-btn" onClick={onClose} style={{ padding: '8px 20px', fontSize: '13px' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
