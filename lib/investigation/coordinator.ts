import { Attachment, TaskType } from './types';
import { extractClaimedCompany, extractEmailDomains, isJobOfferContent } from './jobOffer';
import { buildMultilingualQueries, separateClaimAndInstructions } from './multilingual';

export interface PlanResult {
  taskType: TaskType;
  queries: string[];
  assertions: string[];
}

export function coordinateInvestigation(
  prompt: string,
  attachments: Attachment[] = [],
  history: { role: string; content?: string }[] = []
): PlanResult {
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

  // 1. Explicit claim fact-check inquiries always run through full live verification
  const isClaimFactCheck = (
    lower.startsWith('fact-check') ||
    lower.startsWith('fact check') ||
    lower.startsWith('verify') ||
    lower.startsWith('is it true') ||
    lower.startsWith('check if') ||
    lower.startsWith('has the') ||
    lower.startsWith('does the') ||
    lower.startsWith('did the') ||
    lower.includes('is genuine') ||
    lower.includes('is authentic') ||
    lower.includes('is fake') ||
    lower.includes('is real') ||
    lower.includes('legal tender')
  );

  // 2. Only pure template/complaint drafting requests without verification intent are follow_up
  const isDraftingRequest = attachments.length === 0 && !isClaimFactCheck && (
    lower.startsWith('draft a complaint') ||
    lower.startsWith('write a complaint') ||
    lower.startsWith('draft a letter') ||
    lower.startsWith('template for bank') ||
    lower.startsWith('draft a formal dispute')
  );

  if (isDraftingRequest) {
    return {
      taskType: 'follow_up',
      queries: [],
      assertions: [prompt.trim()]
    };
  }

  let taskType: TaskType = 'verification';
  const isJobOffer = isJobOfferContent(combinedContent, attachments.map(attachment => attachment.name));
  if (isJobOffer) {
    taskType = 'job_offer';
  } else if (lower.includes('scheme') || lower.includes('policy') || lower.includes('research') || lower.includes('cert-in') || lower.includes('overview') || lower.includes('explain')) {
    taskType = 'research';
  } else if (lower.includes('dear consumer') || lower.includes('power cut') || lower.includes('apk') || lower.includes('yono') || lower.includes('urgent') || lower.includes('blocked') || lower.includes('sim') || lower.includes('cbi') || lower.includes('arrest') || lower.includes('9821') || lower.includes('suspend') || lower.includes('kyc')) {
    taskType = 'scam_check';
  } else if (attachments.some(a => a.type === 'application/pdf' || a.documentAnalysis) || lower.includes('gazette') || lower.includes('circular') || lower.includes('order')) {
    taskType = 'document_analysis';
  }

  const queries: string[] = [];

  if (isJobOffer) {
    const claimedCompany = extractClaimedCompany(combinedContent);
    const senderDomains = extractEmailDomains(combinedContent);
    if (claimedCompany) {
      queries.push(`${claimedCompany} official company careers`);
      queries.push(`${claimedCompany} recruitment scam official warning`);
    } else if (senderDomains.length > 0) {
      queries.push(`${senderDomains[0]} official company careers`);
      queries.push(`${senderDomains[0]} recruitment scam warning`);
    } else {
      queries.push('job offer recruitment fee scam official guidance');
    }
  }

  // Check for specific circular numbers, authorities, phones, or URLs extracted from documents
  if (!isJobOffer) attachments.forEach(a => {
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

  if (!isJobOffer && allPhones.length > 0) {
    queries.push(`${allPhones[0]} fraud scam complaint 1930 Chakshu`);
  }
  if (!isJobOffer && allUrls.length > 0) {
    queries.push(`${allUrls[0]} phishing scam fact check`);
  }
  if (!isJobOffer && allSenders.length > 0) {
    queries.push(`${allSenders[0]} DLT sender ID fraud alert`);
  }

  if (isJobOffer) {
    // Queries above intentionally contain only employer/domain context, never candidate details.
  } else if ((lower.includes('500') && (lower.includes('note') || lower.includes('banknote') || lower.includes('rbi') || lower.includes('currency'))) || lower.includes('demonetiz')) {
    queries.push('RBI 500 banknote withdrawal circular legal tender clarification');
    queries.push('PIB Fact Check RBI demonetization 500 note');
  } else if (lower.includes('electric') || lower.includes('disconnection') || lower.includes('bill')) {
    queries.push('electricity bill disconnection SMS scam notice PIB fact check');
    queries.push('SERC electricity disconnection 15 days notice rule section 56');
  } else if (lower.includes('trai') || lower.includes('sim') || lower.includes('dot') || lower.includes('block')) {
    queries.push('TRAI public notice fake mobile number blocking robocall');
    queries.push('Sanchar Saathi DoT cyber crime digital arrest advisory');
  } else if (lower.includes('digital arrest') || (lower.includes('arrest') && (lower.includes('video') || lower.includes('skype') || lower.includes('call')))) {
    queries.push('MHA I4C digital arrest video call advisory cybercrime.gov.in');
    queries.push('digital arrest scam police CBI legal procedure clarification');
  } else if (lower.includes('irs')) {
    queries.push('IRS tax refund email phishing scam official advisory');
    queries.push('IRS initiate contact email text refund warning');
  } else if (lower.includes('income tax') || lower.includes('tax refund') || (lower.includes('tax') && lower.includes('phishing'))) {
    queries.push('Income Tax Department phishing email CVV bank details official advisory India');
    queries.push('income tax refund phishing warning site:incometax.gov.in OR site:cybercrime.gov.in');
  } else {
    const rawSubject = prompt.trim() || extractedPieces.slice(0, 70);
    const separated = separateClaimAndInstructions(rawSubject);
    const coreClaim = separated.factualClaim;

    const isGlobalTopic = !lower.includes('india') && !lower.includes('rbi') && !lower.includes('pib') && (
      lower.includes('paris') || lower.includes('texas') || lower.includes('united states') ||
      lower.includes('baloch') || lower.includes('pakistan') || lower.includes('china') ||
      lower.includes('usa') || lower.includes('europe') || lower.includes('russia') ||
      lower.includes('irs') || lower.includes('federal')
    );

    if (coreClaim) {
      const multilingual = buildMultilingualQueries(coreClaim);
      if (multilingual.authoritativeQuery) {
        queries.push(multilingual.nativeQuery.slice(0, 75));
        queries.push(multilingual.authoritativeQuery.slice(0, 75));
      } else if (isGlobalTopic) {
        queries.push(`${coreClaim.slice(0, 75)}`);
        queries.push(`${coreClaim.slice(0, 65)} fact check`);
      } else {
        queries.push(`${coreClaim.slice(0, 65)} official fact check`);
        queries.push(`${coreClaim.slice(0, 55)} notification circular`);
      }
    }
  }

  if (queries.length === 0 && prompt.trim()) {
    const separatedFallback = separateClaimAndInstructions(prompt.trim());
    queries.push(`${(separatedFallback.factualClaim || prompt.trim()).slice(0, 70)} official fact check`);
  }

  const separatedPrompt = separateClaimAndInstructions(prompt);
  const cleanAssertion = separatedPrompt.factualClaim || prompt.trim();

  const assertions = [
    cleanAssertion.slice(0, 110) || prompt.slice(0, 110) || extractedPieces.slice(0, 110)
  ];

  return { taskType, queries, assertions };
}
