'use client';

import React from 'react';
import Image from 'next/image';

interface LandingBlockProps {
  onSelectPrompt: (prompt: string) => void;
}

export const LandingBlock: React.FC<LandingBlockProps> = ({ onSelectPrompt }) => {
  return (
    <div className="landing-block" id="landingBlock" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '60vh', gap: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--dam-text-primary)' }}>
        What can I help with?
      </h1>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '600px' }}>
        <button 
          className="landing-pill"
          onClick={() => onSelectPrompt("Verify this APK file message: 'Dear Customer, your SBI YONO account is suspended...'")} 
        >
          Check a banking APK threat
        </button>
        <button 
          className="landing-pill"
          onClick={() => onSelectPrompt("Fact-check this call/SMS: 'TRAI notice: Your mobile number will be blocked...'")} 
        >
          Verify a DoT / TRAI caller threat
        </button>
        <button 
          className="landing-pill"
          onClick={() => onSelectPrompt("Review this government notification or gazette order against official ministry portals to verify its authenticity.")} 
        >
          Review official documents
        </button>
      </div>
    </div>
  );
};
