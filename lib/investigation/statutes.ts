export interface StatuteClause {
  act: string;
  section: string;
  title: string;
  violationSummary: string;
  statutoryRule: string;
  punishmentOrRemedy: string;
  officialReference: string;
}

export interface StatutoryAudit {
  applicableStatutes: StatuteClause[];
  citizenRightsSummary: string;
  statutoryViolationCount: number;
}

const STATUTORY_REGISTRY: Array<{
  keywords: string[];
  clause: StatuteClause;
}> = [
  {
    keywords: ['electricity', 'bijli', 'power', 'disconnection', 'bill', 'discom', 'cut the power'],
    clause: {
      act: 'Indian Electricity Act, 2003',
      section: 'Section 56 (Disconnection of Supply in Default of Payment)',
      title: 'Mandatory 15-Day Written Notice Requirement',
      violationSummary: 'Immediate or overnight disconnection via SMS or phone call violates statutory due process.',
      statutoryRule: 'No electricity distribution licensee can disconnect supply without giving not less than 15 clear days notice in writing to the consumer.',
      punishmentOrRemedy: 'Immediate disconnection threats are void; consumer can seek damages before the Electricity Consumer Grievance Redressal Forum (CGRF).',
      officialReference: 'Ministry of Power / Central Electricity Authority Regulations'
    }
  },
  {
    keywords: ['arrest', 'digital arrest', 'cbi', 'customs', 'police', 'extort', 'summons', 'court', 'warrant'],
    clause: {
      act: 'Bharatiya Nyaya Sanhita (BNS), 2023 & IPC',
      section: 'Section 204 BNS (Impersonating a Public Servant) & Section 318 (Cheating)',
      title: 'Prohibition of Public Servant Personation & Coercive Extortion',
      violationSummary: 'Impersonating law enforcement or judicial officers via video call or telephone is a severe non-bailable offense.',
      statutoryRule: 'No Indian law enforcement agency (CBI, Police, ED) is legally empowered to place citizens under "Digital Arrest" via Skype, WhatsApp, or video calls.',
      punishmentOrRemedy: 'Punishable with rigorous imprisonment up to 7 years. Citizens are entitled to immediate police protection upon calling 1930.',
      officialReference: 'Ministry of Home Affairs (MHA) Indian Cybercrime Coordination Centre (I4C)'
    }
  },
  {
    keywords: ['sim', 'trai', 'telecom', 'block', 'kyc', 'dot', 'sms', 'sender', 'cp-', 'vm-'],
    clause: {
      act: 'TRAI Telecom Commercial Communications Customer Preference Regulations (TCCCPR), 2018',
      section: 'Regulation 13 & 14 (DLT Header & Distributed Ledger Enforcement)',
      title: 'Prohibition of Unregistered Bulk Communication from 10-Digit Mobile SIMs',
      violationSummary: 'Commercial or statutory notices sent from 10-digit personal mobile numbers violate TRAI regulations.',
      statutoryRule: 'All entities sending commercial or service communications must register pre-approved alpha headers (e.g. CP-SBIINB) on the telecom DLT blockchain.',
      punishmentOrRemedy: 'Violation leads to blacklisting of the SIM IMSI and IMEI equipment across all Indian telecom service providers via Chakshu.',
      officialReference: 'Telecom Regulatory Authority of India (trai.gov.in)'
    }
  },
  {
    keywords: ['bank', 'sbi', 'hdfc', 'icici', 'otp', 'cvv', 'kyc', 'pan', 'card block', 'apk'],
    clause: {
      act: 'Reserve Bank of India (RBI) Master Directions',
      section: 'Master Direction on Digital Payment Security Controls & KYC',
      title: 'Prohibition of Credential Solicitation & Third-Party APK Installations',
      violationSummary: 'Soliciting OTP, passwords, or directing users to sideload APKs violates RBI core banking security directives.',
      statutoryRule: 'Banks and regulated financial intermediaries are strictly forbidden from demanding OTPs, PINs, or APK installations for KYC compliance.',
      punishmentOrRemedy: 'Victims of unauthorized electronic banking transactions have zero liability if reported within 3 days under RBI Circular DBR.No.Leg.BC.78/09.07.005.',
      officialReference: 'Reserve Bank of India (rbi.org.in)'
    }
  },
  {
    keywords: ['apk', 'link', 'download', 'phishing', 'fake site', 'yojana', 'lottery'],
    clause: {
      act: 'Information Technology Act, 2000 (amended 2008)',
      section: 'Section 66D (Cheating by Personation by Using Computer Resource)',
      title: 'Criminalization of Digital Phishing and Malware Distribution',
      violationSummary: 'Operating deceptive portals or distributing trojan APKs is a cognizable cyber crime.',
      statutoryRule: 'Whoever, by means for any communication device or computer resource cheats by personation, shall be punished.',
      punishmentOrRemedy: 'Imprisonment up to 3 years and fine up to ₹1,00,000. CERT-In is authorized under Section 69A to issue emergency blocking orders.',
      officialReference: 'Ministry of Electronics and Information Technology (MeitY)'
    }
  }
];

export function evaluateStatutoryContradictions(
  prompt: string = '',
  extractedOcrText: string = '',
  detectedEntities: { urls?: string[]; phones?: string[] } = {}
): StatutoryAudit {
  const combined = `${prompt} ${extractedOcrText}`.toLowerCase();
  const matchedStatutes: StatuteClause[] = [];

  for (const item of STATUTORY_REGISTRY) {
    const isMatched = item.keywords.some(kw => combined.includes(kw));
    if (isMatched) {
      matchedStatutes.push(item.clause);
    }
  }

  // If phone numbers present and message claims to be official, add TRAI regulation if not already added
  if (detectedEntities.phones && detectedEntities.phones.length > 0) {
    const hasTrai = matchedStatutes.some(s => s.act.includes('TRAI'));
    if (!hasTrai && (combined.includes('urgent') || combined.includes('notice') || combined.includes('call') || combined.includes('bill'))) {
      const traiClause = STATUTORY_REGISTRY.find(r => r.clause.act.includes('TRAI'));
      if (traiClause) matchedStatutes.push(traiClause.clause);
    }
  }

  const citizenRightsSummary = matchedStatutes.length > 0
    ? `Under Indian jurisprudence, statutory authorities must adhere to published due-process timelines. Unsolicited threats conveyed via non-governmental channels possess zero legal validity.`
    : 'All citizen communications are safeguarded under Section 66D of the IT Act and standard due process norms.';

  return {
    applicableStatutes: matchedStatutes,
    citizenRightsSummary,
    statutoryViolationCount: matchedStatutes.length
  };
}
