import { Attachment, TaskType } from './types';

export interface PlanResult {
  taskType: TaskType;
  queries: string[];
  assertions: string[];
}

export function coordinateInvestigation(prompt: string, attachments: Attachment[] = []): PlanResult {
  // Combine user prompt with any OCR-extracted text from image attachments
  const extractedPieces = attachments
    .filter(a => a.extractedText)
    .map(a => a.extractedText)
    .join(' ');

  const combinedContent = `${prompt} ${extractedPieces}`.trim();
  const lower = combinedContent.toLowerCase();

  let taskType: TaskType = 'verification';
  if (lower.includes('scheme') || lower.includes('policy') || lower.includes('research') || lower.includes('cert-in') || lower.includes('overview') || lower.includes('explain')) {
    taskType = 'research';
  } else if (lower.includes('dear consumer') || lower.includes('power cut') || lower.includes('apk') || lower.includes('yono') || lower.includes('urgent') || lower.includes('blocked') || lower.includes('sim') || lower.includes('cbi') || lower.includes('arrest') || lower.includes('9821') || lower.includes('suspend') || lower.includes('kyc')) {
    taskType = 'scam_check';
  } else if (attachments.some(a => a.type === 'application/pdf') || lower.includes('gazette') || lower.includes('circular') || lower.includes('order')) {
    taskType = 'document_analysis';
  }

  const queries: string[] = [];

  // Check for specific phone numbers or URLs extracted from OCR
  const allPhones = attachments.flatMap(a => a.threatEntities?.phones || []);
  const allUrls = attachments.flatMap(a => a.threatEntities?.urls || []);
  const allSenders = attachments.flatMap(a => a.threatEntities?.senderIds || []);

  if (allPhones.length > 0) {
    queries.push(`${allPhones[0]} fraud scam complaint 1930 Chakshu`);
  }
  if (allUrls.length > 0) {
    queries.push(`${allUrls[0]} phishing scam fact check`);
  }
  if (allSenders.length > 0) {
    queries.push(`${allSenders[0]} DLT sender ID fraud alert`);
  }

  if (lower.includes('500') || lower.includes('rbi') || lower.includes('note') || lower.includes('demonetiz')) {
    queries.push('RBI 500 banknote withdrawal circular legal tender clarification');
    queries.push('PIB Fact Check RBI demonetization 500 note');
  } else if (lower.includes('electric') || lower.includes('disconnection') || lower.includes('bill')) {
    queries.push('electricity bill disconnection SMS scam notice PIB fact check');
    queries.push('SERC electricity disconnection 15 days notice rule section 56');
  } else if (lower.includes('trai') || lower.includes('sim') || lower.includes('dot') || lower.includes('block')) {
    queries.push('TRAI public notice fake mobile number blocking robocall');
    queries.push('Sanchar Saathi DoT cyber crime digital arrest advisory');
  } else {
    const keySubject = prompt.trim() || extractedPieces.slice(0, 70);
    queries.push(`${keySubject.slice(0, 70)} India fact check official circular`);
    queries.push(`${keySubject.slice(0, 50)} PIB fact check government notification`);
  }

  const assertions = [
    prompt.slice(0, 110) || extractedPieces.slice(0, 110)
  ];

  return { taskType, queries, assertions };
}
