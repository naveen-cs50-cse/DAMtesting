import crypto from 'crypto';

export interface VerificationCertificate {
  certificateId: string;
  sha256Fingerprint: string;
  timestampISO: string;
  timestampIST: string;
  issuingAuthority: string;
  status: 'VERIFIED_FRAUD' | 'OFFICIALLY_CONTRADICTED' | 'VERIFIED_AUTHENTIC' | 'EVIDENCE_INSUFFICIENT';
  caseId: string;
  inquiryDigest: string;
  topFindings: string[];
  legalClauses: string[];
  qrPayload: string;
}

export function generateVerificationCertificate(
  caseId: string,
  prompt: string,
  verdicts: { factualCorrectness: string; scamRisk: string; evidenceSufficiency: string },
  statutes: string[] = [],
  sourcesCount: number = 0
): VerificationCertificate {
  const now = new Date();
  const timestampISO = now.toISOString();
  const timestampIST = now.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const rawPayloadToHash = `${caseId}|${prompt}|${verdicts.factualCorrectness}|${verdicts.scamRisk}|${timestampISO}`;
  const sha256Fingerprint = crypto.createHash('sha256').update(rawPayloadToHash).digest('hex');

  const certificateId = `CERT-DAM-${caseId.replace('DAM-', '')}-${sha256Fingerprint.slice(0, 8).toUpperCase()}`;

  let status: VerificationCertificate['status'] = 'EVIDENCE_INSUFFICIENT';
  if (verdicts.evidenceSufficiency === 'Insufficient' || verdicts.factualCorrectness === 'Unverified') {
    status = 'EVIDENCE_INSUFFICIENT';
  } else if (verdicts.factualCorrectness === 'Supported') {
    status = 'VERIFIED_AUTHENTIC';
  } else if (verdicts.factualCorrectness === 'Contradicted') {
    status = 'OFFICIALLY_CONTRADICTED';
  }

  const inquiryDigest = prompt.length > 180 ? prompt.slice(0, 180) + '...' : prompt;

  const topFindings = [
    `Factual Determination: ${verdicts.factualCorrectness}`,
    `Threat & Scam Assessment: ${verdicts.scamRisk === 'Not applicable' ? 'Not applicable' : `${verdicts.scamRisk} Risk`}`,
    `Evidence Base: ${sourcesCount} source${sourcesCount === 1 ? '' : 's'} cited in this briefing`
  ];

  const qrPayload = `https://usedam.in/verify/${certificateId}?sha256=${sha256Fingerprint.slice(0, 16)}`;

  return {
    certificateId,
    sha256Fingerprint,
    timestampISO,
    timestampIST,
    issuingAuthority: 'DAM Intelligence Engine — National Anti-Misinformation Architecture',
    status,
    caseId,
    inquiryDigest,
    topFindings,
    legalClauses: statutes.slice(0, 3),
    qrPayload
  };
}
