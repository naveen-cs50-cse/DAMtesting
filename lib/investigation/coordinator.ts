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
  const normalized = prompt.trim().toLowerCase().replace(/[?!.,]/g, '');

  // Conversational Intent Detection (greetings, general chat, pleasantries)
  const CONVERSATIONAL_REGEX = /^(hi|hello|hey|hii|heyy|howdy|hola|greetings|good\s+(morning|afternoon|evening|day|night)|how\s+are\s+you|who\s+are\s+you|what\s+can\s+you\s+do|what\s+is\s+your\s+name|what\s+is\s+this|help|help\s+me|thanks|thank\s+you|cool|ok|okay|bye|goodbye|tell\s+me\s+about\s+yourself)$/i;

  const isConversational = attachments.length === 0 && (
    CONVERSATIONAL_REGEX.test(normalized) ||
    (prompt.trim().length <= 15 && /^(hi|hello|hey|yo|sup)\b/i.test(normalized))
  );

  if (isConversational) {
    return {
      taskType: 'conversational',
      queries: [],
      assertions: []
    };
  }

  let taskType: TaskType = 'verification';
  if (lower.includes('scheme') || lower.includes('policy') || lower.includes('research') || lower.includes('cert-in') || lower.includes('overview') || lower.includes('explain')) {
    taskType = 'research';
  } else if (lower.includes('dear consumer') || lower.includes('power cut') || lower.includes('apk') || lower.includes('yono') || lower.includes('urgent') || lower.includes('blocked') || lower.includes('sim') || lower.includes('cbi') || lower.includes('arrest') || lower.includes('9821') || lower.includes('suspend') || lower.includes('kyc')) {
    taskType = 'scam_check';
  } else if (attachments.some(a => a.type === 'application/pdf' || a.documentAnalysis) || lower.includes('gazette') || lower.includes('circular') || lower.includes('order')) {
    taskType = 'document_analysis';
  }

  const queries: string[] = [];

  // Check for specific circular numbers, authorities, phones, or URLs extracted from documents
  attachments.forEach(a => {
    if (a.documentAnalysis?.extractedIdentifiers) {
      const { circularNumbers, issuingAuthorities } = a.documentAnalysis.extractedIdentifiers;
      if (circularNumbers && circularNumbers.length > 0) {
        queries.push(`${circularNumbers[0]} official circular gazette notification`);
      }
      if (issuingAuthorities && issuingAuthorities.length > 0) {
        queries.push(`${issuingAuthorities[0]} genuine advisory notification verification`);
      }
    }

    if (a.urlAnalysis) {
      const u = a.urlAnalysis;
      if (u.domainRisk?.typosquatTarget) {
        queries.push(`${u.domain} fake phishing website advisory`);
      }
      if (u.downloadLinks && u.downloadLinks.length > 0) {
        queries.push(`${u.domain} malicious apk malware scam alert`);
      }
      if (u.claims && u.claims.length > 0) {
        queries.push(`${u.claims[0].slice(0, 60)} official fact check`);
      }
      if (u.title) {
        queries.push(`${u.title.slice(0, 50)} government circular fact check`);
      }
    }
  });

  const allPhones = attachments.flatMap(a => a.threatEntities?.phones || []);
  const allUrls = attachments.flatMap(a => [
    ...(a.threatEntities?.urls || []),
    ...(a.url ? [a.url] : []),
    ...(a.urlAnalysis?.finalUrl ? [a.urlAnalysis.finalUrl] : [])
  ]);
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

  if ((lower.includes('500') && (lower.includes('note') || lower.includes('banknote') || lower.includes('rbi') || lower.includes('currency'))) || lower.includes('demonetiz')) {
    queries.push('RBI 500 banknote withdrawal circular legal tender clarification');
    queries.push('PIB Fact Check RBI demonetization 500 note');
  } else if (lower.includes('electric') || lower.includes('disconnection') || lower.includes('bill')) {
    queries.push('electricity bill disconnection SMS scam notice PIB fact check');
    queries.push('SERC electricity disconnection 15 days notice rule section 56');
  } else if (lower.includes('trai') || lower.includes('sim') || lower.includes('dot') || lower.includes('block')) {
    queries.push('TRAI public notice fake mobile number blocking robocall');
    queries.push('Sanchar Saathi DoT cyber crime digital arrest advisory');
  } else {
    const rawSubject = prompt.trim() || extractedPieces.slice(0, 70);
    const cleanedSubject = rawSubject.replace(/[?!.]/g, '').trim();
    if (cleanedSubject) {
      queries.push(`${cleanedSubject.slice(0, 60)} India official notification`);
      queries.push(`${cleanedSubject.slice(0, 50)} PIB fact check verification`);
    }
  }

  const assertions = [
    prompt.slice(0, 110) || extractedPieces.slice(0, 110)
  ];

  return { taskType, queries, assertions };
}
