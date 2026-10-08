export interface IncidentReport {
  recommendedPortal: 'chakshu' | 'cybercrime';
  portalName: string;
  portalUrl: string;
  helpline: string;
  category: string;
  urgency: 'Immediate' | 'High' | 'Standard';
  dossierText: string;
  evidenceItems: {
    suspectNumbers: string[];
    suspectUrls: string[];
    senderHeaders: string[];
    amounts: string[];
  };
}

export function generateIncidentReport(
  caseId: string,
  prompt: string,
  taskType: string,
  verdicts: { scamRisk: string; riskTriggers: string[] },
  forensics?: import('./forensics').EntityForensics,
  extractedOcrText: string = ''
): IncidentReport | null {
  // Only generate incident reports if there is medium/high risk or detected suspect entities
  const hasRisk = verdicts.scamRisk === 'High' || verdicts.scamRisk === 'Medium';
  const hasSuspectUrls = forensics?.urls && forensics.urls.some(u => u.status === 'critical' || u.status === 'suspicious');
  const hasSuspectPhones = forensics?.phones && forensics.phones.length > 0;
  const hasSuspectSenders = forensics?.senders && forensics.senders.length > 0;

  if (!hasRisk && !hasSuspectUrls && !hasSuspectPhones && !hasSuspectSenders) {
    return null;
  }

  const suspectNumbers = (forensics?.phones || []).map(p => p.number);
  const suspectUrls = (forensics?.urls || []).map(u => u.url);
  const senderHeaders = (forensics?.senders || []).map(s => s.id);
  const amounts = forensics?.amounts || [];

  const lowerText = `${prompt} ${extractedOcrText}`.toLowerCase();

  // Determine category and portal
  let category = 'Suspected Fraudulent Communication';
  let recommendedPortal: 'chakshu' | 'cybercrime' = 'chakshu';
  let portalName = 'DoT Chakshu (Sanchar Saathi)';
  let portalUrl = 'https://sancharsaathi.gov.in/sfc/';
  let helpline = '1930 / Sanchar Saathi';
  let urgency: 'Immediate' | 'High' | 'Standard' = 'Standard';

  if (lowerText.includes('arrest') || lowerText.includes('cbi') || lowerText.includes('customs') || lowerText.includes('police') || lowerText.includes('extort')) {
    category = 'Digital Arrest & Law Enforcement Impersonation Extortion';
    recommendedPortal = 'cybercrime';
    portalName = 'National Cyber Crime Reporting Portal (MHA)';
    portalUrl = 'https://cybercrime.gov.in';
    helpline = '1930 (Toll-Free National Helpline)';
    urgency = 'Immediate';
  } else if (lowerText.includes('electricity') || lowerText.includes('bijli') || lowerText.includes('power') || lowerText.includes('disconnection')) {
    category = 'Electricity Disconnection Fraud / Unauthorized Utility Threat';
    recommendedPortal = 'chakshu';
    portalName = 'DoT Chakshu (Department of Telecommunications)';
    portalUrl = 'https://sancharsaathi.gov.in/sfc/';
    helpline = '1930 & Chakshu';
    urgency = 'High';
  } else if (lowerText.includes('apk') || suspectUrls.some(u => u.endsWith('.apk') || u.includes('.apk'))) {
    category = 'Malicious Android APK Distribution / Credential Harvester';
    recommendedPortal = 'cybercrime';
    portalName = 'National Cyber Crime Reporting Portal (MHA)';
    portalUrl = 'https://cybercrime.gov.in';
    helpline = '1930 (Helpline)';
    urgency = 'High';
  } else if (lowerText.includes('kyc') || lowerText.includes('bank') || lowerText.includes('sbi') || lowerText.includes('pan card') || lowerText.includes('reward')) {
    category = 'Banking Impersonation & Phishing / KYC Trap';
    recommendedPortal = 'cybercrime';
    portalName = 'National Cyber Crime Reporting Portal (MHA)';
    portalUrl = 'https://cybercrime.gov.in';
    helpline = '1930 (Toll-Free National Helpline)';
    urgency = 'Immediate';
  } else if (lowerText.includes('trai') || lowerText.includes('sim') || lowerText.includes('block') || lowerText.includes('lottery') || lowerText.includes('job')) {
    category = 'Telecom Impersonation / Spurious SMS & Call Scam';
    recommendedPortal = 'chakshu';
    portalName = 'DoT Chakshu Portal (sancharsaathi.gov.in)';
    portalUrl = 'https://sancharsaathi.gov.in/sfc/';
    helpline = '1930 & 1800-11-0420';
    urgency = 'High';
  }

  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const dossierText = [
    `=========================================`,
    `OFFICIAL CYBER INCIDENT & FRAUD COMPLAINT`,
    `Generated via DAM (Defence Against Misinformation)`,
    `Case Dossier: ${caseId || 'DAM-INCIDENT'}`,
    `Date Generated: ${currentDate}`,
    `=========================================`,
    ``,
    `[1] INCIDENT CLASSIFICATION:`,
    `- Suspected Category: ${category}`,
    `- Urgency Level: ${urgency}`,
    `- Recommended Grievance Redressal: ${portalName} (${portalUrl})`,
    `- Immediate National Helpline: ${helpline}`,
    ``,
    `[2] SUSPECT IDENTIFIERS RECORDED:`,
    `- Suspect Calling/SMS Numbers: ${suspectNumbers.length > 0 ? suspectNumbers.join(', ') : 'Not directly cited / Dispatched via bulk channel'}`,
    `- Suspect Sender Header: ${senderHeaders.length > 0 ? senderHeaders.join(', ') : 'Standard / Masked mobile sender'}`,
    `- Fraudulent Link / Deceptive URL: ${suspectUrls.length > 0 ? suspectUrls.join(', ') : 'None extracted'}`,
    `- Demanded / Mentioned Sums: ${amounts.length > 0 ? amounts.join(', ') : 'N/A'}`,
    ``,
    `[3] REGULATORY AUDIT & EVIDENCE FINDINGS:`,
    `- Statutory Contradictions: Official Indian institutions, statutory electricity boards, and regulatory banks never dispatch disconnection or confiscation threats from personal 10-digit mobile SIMs.`,
    `- Domain Authenticity: Any linked third-party domains do not terminate in authorized government TLDs (.gov.in or .nic.in).`,
    `- Triggers: ${verdicts.riskTriggers.join(', ') || 'High urgency pressure, unverified digital contact'}`,
    ``,
    `[4] CITIZEN COMPLAINT STATEMENT (FOR GRIEVANCE FORM):`,
    `"I received an unsolicited deceptive communication alleging urgent punitive consequences or requiring immediate compliance. The communication provided suspect contact numbers/links demanding payment or application downloads. Upon technical verification against official regulatory registries, this incident was identified as an unauthorized impersonation scheme. I request telecommunication blocking of the offending numbers and domain-level suspension of the associated URL."`,
    ``,
    `[5] RECORDED EVIDENCE / TRANSCRIPTION:`,
    `"${(extractedOcrText || prompt).replace(/\s+/g, ' ').slice(0, 450)}..."`,
    `=========================================`,
  ].join('\n');

  return {
    recommendedPortal,
    portalName,
    portalUrl,
    helpline,
    category,
    urgency,
    dossierText,
    evidenceItems: {
      suspectNumbers,
      suspectUrls,
      senderHeaders,
      amounts
    }
  };
}
