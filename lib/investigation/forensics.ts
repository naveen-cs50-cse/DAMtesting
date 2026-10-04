export interface UrlForensicItem {
  url: string;
  domain: string;
  isGovernment: boolean;
  isPhishingRisk: boolean;
  reason: string;
  status: 'safe' | 'suspicious' | 'critical';
}

export interface EntityForensics {
  phones: Array<{ number: string; risk: 'High' | 'Medium' | 'Low'; notes: string }>;
  urls: UrlForensicItem[];
  senders: Array<{ id: string; isRegisteredDLT: boolean; notes: string }>;
  amounts: string[];
}

const OFFICIAL_INDIAN_GOV_DOMAINS = [
  'gov.in',
  'nic.in',
  'rbi.org.in',
  'trai.gov.in',
  'pib.gov.in',
  'incometax.gov.in',
  'epfindia.gov.in',
  'uidai.gov.in',
  'cybercrime.gov.in',
  'sancharsaathi.gov.in',
  'indiapost.gov.in',
  'sci.gov.in',
  'highcourt.gov.in',
  'eci.gov.in',
  'cbic.gov.in',
  'gst.gov.in'
];

export function analyzeUrlForensics(rawUrl: string): UrlForensicItem {
  let clean = rawUrl.trim().toLowerCase();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }

  let domain = '';
  try {
    const parsed = new URL(clean);
    domain = parsed.hostname.toLowerCase();
  } catch {
    domain = clean.split('/')[0];
  }

  const isGovernment = OFFICIAL_INDIAN_GOV_DOMAINS.some(gov => domain === gov || domain.endsWith('.' + gov));

  let isPhishingRisk = false;
  let reason = 'Domain appears standard.';
  let status: 'safe' | 'suspicious' | 'critical' = 'safe';

  // Suspicious government impersonation (e.g. pmbihar-gov.in, sbi-rewards.apk, yojanaportal.xyz)
  const isTypoSquattingGov = !isGovernment && (domain.includes('gov') || domain.includes('nic') || domain.includes('pm') || domain.includes('yojana') || domain.includes('rbi'));
  const hasMaliciousExtension = clean.endsWith('.apk') || domain.endsWith('.xyz') || domain.endsWith('.top') || domain.endsWith('.live') || domain.endsWith('.app');
  const isBankImpersonation = !isGovernment && (domain.includes('sbi') || domain.includes('hdfc') || domain.includes('icici') || domain.includes('pnb') || domain.includes('kyc'));

  if (hasMaliciousExtension || clean.includes('.apk')) {
    isPhishingRisk = true;
    status = 'critical';
    reason = 'Delivers untrusted APK executable or high-risk scam TLD outside official app stores.';
  } else if (isTypoSquattingGov) {
    isPhishingRisk = true;
    status = 'critical';
    reason = 'Deceptive name mimicking Indian Government portal without an authorized .gov.in or .nic.in domain.';
  } else if (isBankImpersonation) {
    isPhishingRisk = true;
    status = 'critical';
    reason = 'Suspected banking impersonation link harvesting KYC credentials or OTPs.';
  } else if (isGovernment) {
    isPhishingRisk = false;
    status = 'safe';
    reason = 'Verified official Indian statutory/government domain.';
  } else {
    status = 'suspicious';
    reason = 'Third-party non-governmental domain.';
  }

  return {
    url: rawUrl,
    domain,
    isGovernment,
    isPhishingRisk,
    reason,
    status
  };
}

export function performForensicAnalysis(
  prompt: string,
  extractedText: string = '',
  detectedEntities: { phones?: string[]; urls?: string[]; senderIds?: string[]; amounts?: string[] } = {}
): EntityForensics {
  const combined = `${prompt} ${extractedText}`;

  // Analyze Phone Numbers
  const phonesList = detectedEntities.phones || [];
  const phones = phonesList.map(num => {
    const isPersonalMobile = /^[6-9]\d{9}$/.test(num.replace('+91', ''));
    return {
      number: num,
      risk: (isPersonalMobile ? 'High' : 'Medium') as 'High' | 'Medium' | 'Low',
      notes: isPersonalMobile
        ? 'Personal 10-digit mobile used for official claim; statutory utilities and banks never dispatch disconnection or KYC threats from personal SIMs.'
        : 'Phone number cited in communication.'
    };
  });

  // Analyze URLs
  const urlsList = detectedEntities.urls || [];
  const urls = urlsList.map(u => analyzeUrlForensics(u));

  // Analyze Sender IDs
  const sendersList = detectedEntities.senderIds || [];
  const senders = sendersList.map(s => {
    // Official DLT prefixes: First 2 letters indicate telecom circle (e.g., CP, VM, AX, BZ)
    const isRegisteredDLT = /^[A-Z]{2}-[A-Z0-9]{6,8}$/i.test(s);
    return {
      id: s,
      isRegisteredDLT,
      notes: isRegisteredDLT
        ? 'Matches Indian TRAI/DLT alphanumeric bulk header format.'
        : 'Unverified or non-standard sender header.'
    };
  });

  return {
    phones,
    urls,
    senders,
    amounts: detectedEntities.amounts || []
  };
}
