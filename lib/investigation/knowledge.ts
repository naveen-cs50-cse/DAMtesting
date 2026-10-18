import { InvestigationVerdicts } from './types';

export interface RegulatoryFixture {
  domain: string;
  title: string;
  date: string;
  type: 'Government' | 'Fact-checker' | 'News';
  url: string;
  passage: string;
  stance: 'supports' | 'contradicts' | 'context';
  isFixture?: boolean;
  verdict: InvestigationVerdicts;
  challenger: string[];
}

export interface AuthorityEvaluation {
  weight: number;
  tier: 'Government' | 'Fact-checker' | 'Registry' | 'News' | 'General';
  description: string;
}

const VERIFIED_PUBLISHERS: Array<{
  domain: string;
  tier: AuthorityEvaluation['tier'];
  type: 'Government' | 'Fact-checker' | 'News' | 'Registry';
  description: string;
  weight: number;
}> = [
  { domain: 'aph.gov.au', tier: 'Government', type: 'Government', description: 'Parliament of Australia', weight: 1 },
  { domain: 'australia.gov.au', tier: 'Government', type: 'Government', description: 'Australian Government', weight: 1 },
  { domain: 'nca.gov.au', tier: 'Government', type: 'Government', description: 'National Capital Authority', weight: 1 },
  { domain: 'nsw.gov.au', tier: 'Government', type: 'Government', description: 'New South Wales Government', weight: 1 },
  { domain: 'cityofsydney.nsw.gov.au', tier: 'Government', type: 'Government', description: 'City of Sydney', weight: 1 },
  { domain: 'loc.gov', tier: 'Government', type: 'Government', description: 'Library of Congress', weight: 1 },
  { domain: 'abs.gov.au', tier: 'Government', type: 'Government', description: 'Australian Bureau of Statistics', weight: 1 },
  { domain: 'rba.gov.au', tier: 'Government', type: 'Government', description: 'Reserve Bank of Australia', weight: 1 },
  { domain: 'rbi.org.in', tier: 'Government', type: 'Government', description: 'Reserve Bank of India', weight: 1 },
  { domain: 'sbi.co.in', tier: 'Government', type: 'Government', description: 'State Bank of India', weight: 1 },
  { domain: 'trai.gov.in', tier: 'Government', type: 'Government', description: 'Telecom Regulatory Authority of India', weight: 1 },
  { domain: 'cert-in.org.in', tier: 'Government', type: 'Government', description: 'Indian Computer Emergency Response Team', weight: 1 },
  { domain: 'sancharsaathi.gov.in', tier: 'Government', type: 'Government', description: 'Sanchar Saathi', weight: 1 },
  { domain: 'cybercrime.gov.in', tier: 'Government', type: 'Government', description: 'National Cyber Crime Reporting Portal', weight: 1 },
  { domain: 'sebi.gov.in', tier: 'Government', type: 'Government', description: 'Securities and Exchange Board of India', weight: 1 },
  { domain: 'incometax.gov.in', tier: 'Government', type: 'Government', description: 'Income Tax Department', weight: 1 },
  { domain: 'epfindia.gov.in', tier: 'Government', type: 'Government', description: 'Employees Provident Fund Organisation', weight: 1 },
  { domain: 'uidai.gov.in', tier: 'Government', type: 'Government', description: 'Unique Identification Authority of India', weight: 1 },
  { domain: 'ceir.gov.in', tier: 'Government', type: 'Government', description: 'Central Equipment Identity Register', weight: 1 },
  { domain: 'pib.gov.in', tier: 'Government', type: 'Government', description: 'Press Information Bureau', weight: 1 },
  { domain: 'india.gov.in', tier: 'Government', type: 'Government', description: 'National Portal of India', weight: 1 },
  { domain: 'knowindia.india.gov.in', tier: 'Government', type: 'Government', description: 'Know India National Portal', weight: 1 },
  { domain: 'nic.in', tier: 'Government', type: 'Government', description: 'National Informatics Centre', weight: 1 },
  { domain: 'delhi.gov.in', tier: 'Government', type: 'Government', description: 'Government of NCT of Delhi', weight: 1 },
  { domain: 'parliamentofindia.nic.in', tier: 'Government', type: 'Government', description: 'Parliament of India', weight: 1 },
  { domain: 'tnerc.gov.in', tier: 'Government', type: 'Government', description: 'Tamil Nadu Electricity Regulatory Commission', weight: 1 },
  { domain: 'kserc.org.in', tier: 'Registry', type: 'Registry', description: 'Kerala State Electricity Regulatory Commission', weight: 0.8 },
  { domain: 'abr.business.gov.au', tier: 'Registry', type: 'Registry', description: 'Australian Business Register', weight: 0.8 },
  { domain: 'regulator-north.gov.in', tier: 'Registry', type: 'Registry', description: 'Regional Regulatory Commission North', weight: 0.85 },
  { domain: 'regulator-south.gov.in', tier: 'Government', type: 'Government', description: 'Regional Regulatory Commission South', weight: 0.95 },
  { domain: 'boomlive.in', tier: 'Fact-checker', type: 'Fact-checker', description: 'Independent fact-checking organisation', weight: 0.85 },
  { domain: 'altnews.in', tier: 'Fact-checker', type: 'Fact-checker', description: 'Independent fact-checking organisation', weight: 0.85 },
  { domain: 'factly.in', tier: 'Fact-checker', type: 'Fact-checker', description: 'Independent fact-checking organisation', weight: 0.85 },
  { domain: 'vishvasnews.com', tier: 'Fact-checker', type: 'Fact-checker', description: 'Independent fact-checking organisation', weight: 0.85 },
  { domain: 'newsmobile.in', tier: 'Fact-checker', type: 'Fact-checker', description: 'Independent fact-checking organisation', weight: 0.85 },
  { domain: 'thip.media', tier: 'Fact-checker', type: 'Fact-checker', description: 'Independent fact-checking organisation', weight: 0.85 },
  { domain: 'thequint.com', tier: 'Fact-checker', type: 'Fact-checker', description: 'Independent fact-checking organisation', weight: 0.85 },
  { domain: 'thehindu.com', tier: 'News', type: 'News', description: 'Established news publication', weight: 0.65 },
  { domain: 'indianexpress.com', tier: 'News', type: 'News', description: 'Established news publication', weight: 0.65 },
  { domain: 'timesofindia.indiatimes.com', tier: 'News', type: 'News', description: 'Established news publication', weight: 0.65 },
  { domain: 'hindustantimes.com', tier: 'News', type: 'News', description: 'Established news publication', weight: 0.65 },
  { domain: 'livemint.com', tier: 'News', type: 'News', description: 'Established news publication', weight: 0.65 },
  { domain: 'ndtv.com', tier: 'News', type: 'News', description: 'Established news publication', weight: 0.65 },
  { domain: 'business-standard.com', tier: 'News', type: 'News', description: 'Established news publication', weight: 0.65 },
  { domain: 'abc.net.au', tier: 'News', type: 'News', description: 'Australian public broadcaster', weight: 0.7 },
];

function verifiedPublisher(domain: string) {
  const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  return VERIFIED_PUBLISHERS.find(publisher =>
    cleanDomain === publisher.domain || cleanDomain.endsWith(`.${publisher.domain}`)
  );
}

export function getVerifiedPublisherType(domain: string): 'Government' | 'Fact-checker' | 'News' | 'Registry' | null {
  return verifiedPublisher(domain)?.type || null;
}

export function getSourceAuthority(domain: string, type?: string): AuthorityEvaluation {
  const publisher = verifiedPublisher(domain);
  if (publisher && publisher.type === type) {
    return { weight: publisher.weight, tier: publisher.tier, description: publisher.description };
  }

  return {
    weight: 0.35,
    tier: 'General',
    description: 'General Web / Unindexed Third-Party Source'
  };
}

export const REGULATORY_FIXTURES: Record<string, RegulatoryFixture> = {
  rbi_500: {
    domain: 'rbi.org.in',
    title: 'Reserve Bank of India: Clarification on Legal Tender Status of ₹500 Banknotes',
    date: 'Aug 2026',
    type: 'Government',
    url: 'https://rbi.org.in/scripts/BS_PressReleaseDisplay.aspx',
    passage: 'The Reserve Bank of India clarifies that ₹500 denomination banknotes of the Mahatma Gandhi (New) Series continue to be legal tender across India. Reports of withdrawal or demonetization are completely unfounded.',
    stance: 'contradicts',
    isFixture: true,
    verdict: {
      factualCorrectness: 'Contradicted',
      scamRisk: 'Medium',
      evidenceSufficiency: 'Sufficient',
      riskTriggers: ['Currency Panic Rumor', 'Fabricated Circular', 'Unverified Exchange Link']
    },
    challenger: [
      'Verified whether any clean note policy withdrawal targets ₹500 notes — RBI officially denied any such measure.',
      'Evaluated whether soiled/mutilated note disposal rules were misquoted as currency bans.',
      'Confirmed that all commercial banks and RBI branches accept both star-panel and standard ₹500 notes.'
    ]
  },
  electricity_scam: {
    domain: 'sancharsaathi.gov.in',
    title: 'Department of Telecommunications & SERC: Advisory on Disconnection Extortion SMS',
    date: 'Sep 2026',
    type: 'Government',
    url: 'https://sancharsaathi.gov.in/sfc/',
    passage: 'State electricity discoms strictly adhere to Section 56(1) of the Indian Electricity Act, requiring a mandatory 15-day written notice before disconnecting power. Power cut threats with 10-digit mobile numbers are malicious impersonation scams.',
    stance: 'contradicts',
    isFixture: true,
    verdict: {
      factualCorrectness: 'Contradicted',
      scamRisk: 'High',
      evidenceSufficiency: 'Sufficient',
      riskTriggers: ['Urgency Threat', 'Personal 10-Digit Sender', 'Violates SERC 15-Day Rule', 'Remote-Access APK Risk']
    },
    challenger: [
      'Checked whether any regional power discom revised automated meter reading rules for emergency disconnections — none found.',
      'Industrial disputes still require written gazette compliance under the Indian Electricity Act 2003.',
      'Verified that official discom SMS headers always use registered 6-character alpha headers (e.g. BESCOM, MSEDCL).'
    ]
  },
  trai_scam: {
    domain: 'trai.gov.in',
    title: 'Telecom Regulatory Authority of India: Public Notice on Mobile Disconnection Scams',
    date: 'Sep 2026',
    type: 'Government',
    url: 'https://trai.gov.in/notifications/press-release',
    passage: 'TRAI does not block or deactivate individual mobile connections, nor does it conduct digital arrests or demand security deposits via WhatsApp or Skype calls. Any such call or message is fraudulent.',
    stance: 'contradicts',
    isFixture: true,
    verdict: {
      factualCorrectness: 'Contradicted',
      scamRisk: 'High',
      evidenceSufficiency: 'Sufficient',
      riskTriggers: ['Authority Impersonation', 'Digital Arrest Threat', 'Deposit Extortion Demand', '2-Hour Disconnect Robocall']
    },
    challenger: [
      'Examined DoT reverification guidelines for bulk connections — individual retail SIMs have no 2-hour disconnection rule.',
      'Telecom operators notify customers through official billing channels, never via robocalls demanding bank transfers.',
      'Confirmed that Cybercrime Helpline 1930 is the designated response channel for reporting digital arrest extortion.'
    ]
  },
  sbi_yono_apk: {
    domain: 'sbi.co.in',
    title: 'State Bank of India & CERT-In: Security Advisory on Malicious Banking APK Phishing',
    date: 'Oct 2026',
    type: 'Government',
    url: 'https://sbi.co.in/web/customer-care/security-tips',
    passage: 'State Bank of India (SBI) never sends APK files, direct download links, or SMS asking customers to update PAN or unblock YONO via third-party websites. Legitimate YONO updates are exclusively distributed through Google Play Store and Apple App Store.',
    stance: 'contradicts',
    isFixture: true,
    verdict: {
      factualCorrectness: 'Contradicted',
      scamRisk: 'High',
      evidenceSufficiency: 'Sufficient',
      riskTriggers: ['Sideloaded Malicious APK', 'Credential & OTP Stealer', 'Fake Suspension Threat', 'Typosquatted Banking Domain']
    },
    challenger: [
      'Verified RBI Master Directions on Customer Protection — banks are prohibited from mandating APK downloads over SMS/WhatsApp.',
      'Confirmed that banking apps require Google Play Protect signing and are never delivered as bare .apk files over text.',
      'Evaluated permissions requested by fake YONO APKs: SMS sniffing (RECEIVE_SMS), screen mirroring, and accessibility abuse.'
    ]
  },
  digital_arrest: {
    domain: 'cybercrime.gov.in',
    title: 'Indian Cyber Crime Coordination Centre (I4C) & MHA: Nationwide Advisory on Digital Arrest Extortion',
    date: 'Oct 2026',
    type: 'Government',
    url: 'https://cybercrime.gov.in/advisories/digital-arrest-warning',
    passage: 'Indian Law, Criminal Procedure Code (CrPC / BNSS), and statutory police protocol have NO PROVISION for Digital Arrest. Neither the CBI, Enforcement Directorate (ED), nor state police departments conduct interrogations or issue arrest warrants over Skype, WhatsApp, or video calls.',
    stance: 'contradicts',
    isFixture: true,
    verdict: {
      factualCorrectness: 'Contradicted',
      scamRisk: 'High',
      evidenceSufficiency: 'Sufficient',
      riskTriggers: ['Fabricated Legal Authority', 'Extortion Video Call', 'Fake Police Uniform/Studio', 'Demands Immediate RTGS Transfer']
    },
    challenger: [
      'Section 41A CrPC / Bharatiya Nagarik Suraksha Sanhita requires formal written summon served in person or via registered post, never over video call.',
      'No law enforcement agency ever asks citizens to transfer money to "RBI verification accounts" to prove innocence.',
      'Citizen directive: Disconnect immediately, do not pay, and report to 1930 and local police station.'
    ]
  },
  wedding_card_apk: {
    domain: 'cert-in.org.in',
    title: 'CERT-In Vulnerability & Threat Note: Trojanized WhatsApp Wedding Invitation APKs',
    date: 'Oct 2026',
    type: 'Government',
    url: 'https://www.cert-in.org.in/advisories',
    passage: 'Cyber criminals are circulating malicious Android APK files disguised as wedding invitation cards (.apk extension, e.g. Wedding_Card.apk, Invitation.apk). Once installed, the malware captures SMS OTPs, contacts, and banking keystrokes.',
    stance: 'contradicts',
    isFixture: true,
    verdict: {
      factualCorrectness: 'Contradicted',
      scamRisk: 'High',
      evidenceSufficiency: 'Sufficient',
      riskTriggers: ['Social Engineering Camouflage', 'Stealth Trojan Dropper', 'Steals SMS OTPs & Contacts', 'Forwards Itself Automatically']
    },
    challenger: [
      'Digital invitation cards are always standard image (JPEG/PNG) or PDF files, never executable application packages (.apk).',
      'The payload requests Accessibility Service permissions to read on-screen text and intercept two-factor SMS authentication.',
      'Urgent guidance: Do not install, uninstall if opened, reboot into Safe Mode, and inform bank if credentials entered.'
    ]
  },
  income_tax_phishing: {
    domain: 'incometax.gov.in',
    title: 'Income Tax Department: Public Warning Regarding Phishing SMS & Fake Refund Approval Notices',
    date: 'Sep 2026',
    type: 'Government',
    url: 'https://incometax.gov.in/iec/foportal/taxpayer-advisory',
    passage: 'The Income Tax Department never requests taxpayers to confirm credit card numbers, CVVs, or internet banking passwords over SMS or third-party links to process refunds. Legitimate refunds are credited directly via bank account validation on e-Filing portal.',
    stance: 'contradicts',
    isFixture: true,
    verdict: {
      factualCorrectness: 'Contradicted',
      scamRisk: 'High',
      evidenceSufficiency: 'Sufficient',
      riskTriggers: ['Financial Bait Scam', 'CVV/PIN Harvesting', 'Phishing Landing Page', 'Impersonating Tax Directorate']
    },
    challenger: [
      'Verified refund processing workflow: Income Tax refunds are transferred via ECS/NEFT through SBI NECS, never requiring card numbers.',
      'Official communications are exclusively transmitted through verified shortcode headers (e.g. IT-ITAX, VK-ITAX).'
    ]
  }
};

