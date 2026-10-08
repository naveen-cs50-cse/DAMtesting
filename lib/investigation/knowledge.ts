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

export function getSourceAuthority(domain: string, type?: string): AuthorityEvaluation {
  const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

  // Primary Indian Government & Statutory Regulators
  if (
    cleanDomain.endsWith('.gov.in') ||
    cleanDomain.endsWith('.nic.in') ||
    cleanDomain.includes('rbi.org.in') ||
    cleanDomain.includes('trai.gov.in') ||
    cleanDomain.includes('cert-in.org.in') ||
    cleanDomain.includes('sancharsaathi.gov.in') ||
    cleanDomain.includes('cybercrime.gov.in') ||
    cleanDomain.includes('sebi.gov.in') ||
    cleanDomain.includes('incometax.gov.in') ||
    cleanDomain.includes('epfindia.gov.in') ||
    cleanDomain.includes('uidai.gov.in') ||
    cleanDomain.includes('ceir.gov.in')
  ) {
    return {
      weight: 1.0,
      tier: 'Government',
      description: 'Primary Indian Government / Statutory Regulatory Authority'
    };
  }

  // Recognized Fact-checking organizations (IFCN / Indian verified debunks)
  if (
    cleanDomain.includes('boomlive') ||
    cleanDomain.includes('altnews') ||
    cleanDomain.includes('factly') ||
    cleanDomain.includes('vishvasnews') ||
    cleanDomain.includes('newsmobile') ||
    cleanDomain.includes('thip.media') ||
    cleanDomain.includes('webqoof') ||
    (cleanDomain.includes('thequint') && type === 'Fact-checker')
  ) {
    return {
      weight: 0.85,
      tier: 'Fact-checker',
      description: 'Verified Independent Fact-Checking Organization'
    };
  }

  // Official public registries / state discoms
  if (
    type === 'Registry' ||
    cleanDomain.includes('bescom') ||
    cleanDomain.includes('msedcl') ||
    cleanDomain.includes('tpddl') ||
    cleanDomain.includes('barcouncil') ||
    cleanDomain.includes('mca.gov.in')
  ) {
    return {
      weight: 0.80,
      tier: 'Registry',
      description: 'Statutory Registry / State Utility Entity'
    };
  }

  // Mainstream Indian news publications
  if (
    cleanDomain.includes('thehindu') ||
    cleanDomain.includes('indianexpress') ||
    cleanDomain.includes('timesofindia') ||
    cleanDomain.includes('hindustantimes') ||
    cleanDomain.includes('livemint') ||
    cleanDomain.includes('ndtv') ||
    cleanDomain.includes('business-standard') ||
    cleanDomain.includes('ptinews') ||
    cleanDomain.includes('aniin') ||
    type === 'News'
  ) {
    return {
      weight: 0.65,
      tier: 'News',
      description: 'Established Press / Mainstream Media'
    };
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
  }
};
