'use client';

import React, { useState, useEffect } from 'react';

interface PromptScenario {
  label: string;
  prompt: string;
  category?: string;
}

const ALL_PROMPT_SCENARIOS: PromptScenario[] = [
  {
    label: 'Check a banking APK threat',
    prompt: "Verify this APK message: 'Dear Customer, your SBI YONO account is suspended. Update your PAN card immediately by downloading the support APK at http://sbi-kyc-update.apk to avoid permanent deactivation.'",
    category: 'Banking / Malware'
  },
  {
    label: 'Verify a DoT / TRAI caller threat',
    prompt: "Fact-check this robocall message: 'This is an urgent notice from Telecom Regulatory Authority of India (TRAI). Your mobile number will be blocked within 2 hours due to illegal cyber activity. Press 9 to connect with police.'",
    category: 'Telecom / Extortion'
  },
  {
    label: 'Review official documents',
    prompt: "Review this purported government notification or gazette order against official ministry portals to verify its circular number and authenticity.",
    category: 'Official Gazette'
  },
  {
    label: 'Inspect a Digital Arrest threat',
    prompt: "Investigate this WhatsApp video call claiming to be from Mumbai Cyber Police and CBI, showing an officer in uniform and threatening an immediate digital arrest warrant for money laundering.",
    category: 'Digital Arrest'
  },
  {
    label: 'Verify electricity bill power cut SMS',
    prompt: "Verify this SMS alert: 'Dear Consumer, your electricity power will be disconnected tonight at 9:30 PM by electricity office because previous month bill was not updated. Please immediately call power officer at 9821456789.'",
    category: 'Utility Scam'
  },
  {
    label: 'Check WhatsApp wedding card APK',
    prompt: "Analyze this WhatsApp forward containing a file named 'Wedding_Invitation_Card.apk'. The sender claims it is a digital marriage invitation that needs to be installed to view the wedding venue.",
    category: 'Android Malware'
  },
  {
    label: 'Fact-check ₹500 currency note rumor',
    prompt: "Fact-check this viral video claiming that the Reserve Bank of India (RBI) has announced the withdrawal of ₹500 currency notes and that they will become invalid next month.",
    category: 'Currency Rumor'
  },
  {
    label: 'Verify fake traffic e-challan link',
    prompt: "Check this SMS: 'Traffic Police Notice: Vehicle number DL01AB1234 has an overdue speeding fine of ₹1,000. Pay within 24 hours at http://echallan-parivahan-vahan.apk to avoid court warrant.'",
    category: 'Traffic Phishing'
  },
  {
    label: 'Inspect part-time job Telegram scam',
    prompt: "Investigate this message offering ₹3,000 to ₹8,000 per day working from home by liking YouTube videos and rating hotels on Google Maps, requiring a ₹1,000 security deposit on Telegram.",
    category: 'Employment Fraud'
  },
  {
    label: 'Verify Income Tax refund notification',
    prompt: "Fact-check this email: 'Income Tax Department has approved your tax refund of ₹15,480. Confirm your bank account and debit card CVV to receive the credit directly into your account.'",
    category: 'Tax Phishing'
  },
  {
    label: 'Check fake Supreme Court summons',
    prompt: "Review this PDF document claiming to be an urgent summon issued by the Chief Justice of India / Cyber Crime Cell for viewing restricted material, demanding ₹50,000 fine settlement.",
    category: 'Legal Extortion'
  },
  {
    label: 'Verify free PM laptop / solar scheme',
    prompt: "Fact-check this viral forward: 'Prime Minister Free Laptop Scheme 2026: All college students can get a free 5G laptop by registering on this portal before the deadline.'",
    category: 'Government Scheme'
  },
  {
    label: 'Inspect Aadhaar biometric lock SMS',
    prompt: "Verify this SMS: 'Your Aadhaar card has been suspended by UIDAI due to suspicious biometric activity. Click here to verify your Aadhaar and biometric data immediately.'",
    category: 'Identity Fraud'
  },
  {
    label: 'Check credit card reward points scam',
    prompt: "Investigate this message: 'Your credit card reward points worth ₹8,950 are expiring today. Redeem into cash directly to your bank account at http://credit-reward-claim.net.'",
    category: 'Financial Phishing'
  },
  {
    label: 'Review fake job offer letter',
    prompt: "Verify this employment appointment letter purporting to be from a major IT company, requiring the candidate to deposit ₹4,500 for company laptop shipping and insurance.",
    category: 'Job Fraud'
  },
  {
    label: 'Fact-check train / flight cancellation alert',
    prompt: "Fact-check this viral social media notice claiming that Indian Railways has cancelled all express trains across the northern zone due to emergency track upgrades next week.",
    category: 'Public Transport'
  },
  {
    label: 'Verify India Post customs parcel SMS',
    prompt: "Verify this SMS alert: 'India Post: Your package IN94821034 has arrived at the sorting hub but cannot be delivered due to incomplete address. Update details within 24 hours at http://indiapost-delivery-update.in.'",
    category: 'Postal Phishing'
  },
  {
    label: 'Check Fastag blacklisted KYC warning',
    prompt: "Analyze this urgent alert: 'Dear Customer, your NHAI Fastag wallet is blocked due to pending RBI KYC. Update your Fastag KYC now at http://fastag-kyc-verify.com to avoid toll penalties.'",
    category: 'Automotive Phishing'
  },
  {
    label: 'Inspect WhatsApp Pink update APK',
    prompt: "Check this message claiming WhatsApp has released an official 'Pink Theme' with exclusive features, attaching an APK file named 'WhatsAppPink.apk' to install.",
    category: 'Android Spyware'
  },
  {
    label: 'Verify EPFO / PF claim settlement link',
    prompt: "Fact-check this SMS: 'Your EPFO claim of ₹48,200 is approved. Click here to verify your Aadhaar-linked bank details to receive immediate NEFT transfer.'",
    category: 'Social Security Fraud'
  },
  {
    label: 'Check instant loan blackmail app',
    prompt: "Investigate this emergency alert regarding an instant micro-loan app that obtained contacts and gallery permissions and is threatening to distribute morphed photos unless ₹12,000 is transferred immediately.",
    category: 'Extortion / Loan App'
  },
  {
    label: 'Verify LPG subsidy expiration notice',
    prompt: "Review this viral WhatsApp forward claiming that government LPG cylinder subsidies will be discontinued from next Monday unless consumers register on a third-party portal.",
    category: 'Utility Rumor'
  },
  {
    label: 'Check cyber cell extortion FIR notice',
    prompt: "Fact-check this WhatsApp notice bearing Delhi Police Cyber Crime Cell insignia stating that an FIR has been registered against this mobile number for illegal file downloads and demanding settlement.",
    category: 'Legal Extortion'
  },
  {
    label: 'Verify college exam paper leak alert',
    prompt: "Investigate this viral social media claim alleging that the university final semester examination question paper has been leaked on Telegram and exams are cancelled nationwide.",
    category: 'Academic Misinformation'
  }
];

const HEADINGS: string[] = [
  "What would you like to investigate today?",
  "Verify a suspicious claim, call, or circular",
  "What threat or rumor should we inspect?",
  "Fact-check a claim or forwarded message",
  "How can I assist your investigation today?",
  "Have a forwarded threat or circular to verify?",
  "What would you like to fact-check today?",
  "Check a suspicious APK, SMS, or caller",
  "Verify official gazettes, orders & viral news",
  "What needs verification today?",
  "Investigate a viral claim or cyber fraud",
  "Encountered a suspicious banking alert or caller?",
  "Verify TRAI notices, court orders, or power-cut alerts",
  "Track down primary evidence for any viral forward",
  "What suspicious message or link should we review?",
  "Cross-examine an official order against primary gazettes",
  "Inspect a digital arrest threat or extortion call",
  "Verify an employment offer, subsidy, or scheme notice",
  "What forwarded rumor arrived on your feed today?",
  "Check any viral advisory against government records",
  "Verify a suspicious UPI or banking transaction alert",
  "Have a forwarded PDF, circular, or audio clip to inspect?",
  "Dissect viral misinformation with primary evidence",
  "What cyber alert or official order should we authenticate?"
];

interface LandingBlockProps {
  onSelectPrompt: (prompt: string) => void;
}

export const LandingBlock: React.FC<LandingBlockProps> = ({ onSelectPrompt }) => {
  // Deterministic initial state for SSR, rotated immediately on client mount (every refresh)
  const [heading, setHeading] = useState<string>(HEADINGS[0]);
  const [pills, setPills] = useState<PromptScenario[]>([
    ALL_PROMPT_SCENARIOS[0],
    ALL_PROMPT_SCENARIOS[1],
    ALL_PROMPT_SCENARIOS[2],
  ]);
  const [isFading, setIsFading] = useState<boolean>(false);

  useEffect(() => {
    // Guaranteed fresh heading and fresh 3 pills on EVERY single page refresh
    try {
      const storedHeadingIdx = localStorage.getItem('dam_heading_idx');
      let nextHeadingIdx: number;
      if (storedHeadingIdx !== null) {
        nextHeadingIdx = (parseInt(storedHeadingIdx, 10) + 1) % HEADINGS.length;
      } else {
        nextHeadingIdx = Math.floor(Math.random() * HEADINGS.length);
      }
      localStorage.setItem('dam_heading_idx', String(nextHeadingIdx));
      setHeading(HEADINGS[nextHeadingIdx]);

      const storedPillIdx = localStorage.getItem('dam_pill_idx');
      let nextPillIdx: number;
      if (storedPillIdx !== null) {
        nextPillIdx = (parseInt(storedPillIdx, 10) + 3) % ALL_PROMPT_SCENARIOS.length;
      } else {
        nextPillIdx = (nextHeadingIdx * 3) % ALL_PROMPT_SCENARIOS.length;
      }
      localStorage.setItem('dam_pill_idx', String(nextPillIdx));

      const freshPills: PromptScenario[] = [];
      for (let i = 0; i < 3; i++) {
        freshPills.push(ALL_PROMPT_SCENARIOS[(nextPillIdx + i) % ALL_PROMPT_SCENARIOS.length]);
      }
      setPills(freshPills);
    } catch {
      const randHeading = HEADINGS[Math.floor(Math.random() * HEADINGS.length)];
      setHeading(randHeading);
      const shuffled = [...ALL_PROMPT_SCENARIOS].sort(() => 0.5 - Math.random());
      setPills(shuffled.slice(0, 3));
    }
  }, []);

  const handleShuffle = () => {
    setIsFading(true);
    setTimeout(() => {
      try {
        const storedHeadingIdx = localStorage.getItem('dam_heading_idx');
        const nextHeadingIdx = ((storedHeadingIdx !== null ? parseInt(storedHeadingIdx, 10) : 0) + 1) % HEADINGS.length;
        localStorage.setItem('dam_heading_idx', String(nextHeadingIdx));
        setHeading(HEADINGS[nextHeadingIdx]);

        const storedPillIdx = localStorage.getItem('dam_pill_idx');
        const nextPillIdx = ((storedPillIdx !== null ? parseInt(storedPillIdx, 10) : 0) + 3) % ALL_PROMPT_SCENARIOS.length;
        localStorage.setItem('dam_pill_idx', String(nextPillIdx));

        const freshPills: PromptScenario[] = [];
        for (let i = 0; i < 3; i++) {
          freshPills.push(ALL_PROMPT_SCENARIOS[(nextPillIdx + i) % ALL_PROMPT_SCENARIOS.length]);
        }
        setPills(freshPills);
      } catch {
        const randHeading = HEADINGS[Math.floor(Math.random() * HEADINGS.length)];
        setHeading(randHeading);
        const shuffled = [...ALL_PROMPT_SCENARIOS].sort(() => 0.5 - Math.random());
        setPills(shuffled.slice(0, 3));
      }
      setIsFading(false);
    }, 150);
  };

  return (
    <div
      className="landing-block"
      id="landingBlock"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '60vh',
        gap: '1.75rem',
      }}
    >
      <h1
        suppressHydrationWarning
        style={{
          fontSize: '2rem',
          fontWeight: 600,
          color: 'var(--dam-text-primary)',
          textAlign: 'center',
          maxWidth: '780px',
          lineHeight: '1.25',
          opacity: isFading ? 0.35 : 1,
          transform: isFading ? 'translateY(2px)' : 'translateY(0)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        {heading}
      </h1>

      <div
        suppressHydrationWarning
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: '680px',
          opacity: isFading ? 0.35 : 1,
          transition: 'opacity 0.2s ease',
        }}
      >
        {pills.map((item, idx) => (
          <button
            key={`${item.label}-${idx}`}
            className="landing-pill"
            onClick={() => onSelectPrompt(item.prompt)}
            title={item.prompt}
          >
            {item.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleShuffle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'transparent',
          border: 'none',
          color: '#737373',
          fontSize: '12px',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '6px',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#e5e5e5')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#737373')}
        title="Show more scenario suggestions"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        Shuffle suggestions
      </button>
    </div>
  );
};

