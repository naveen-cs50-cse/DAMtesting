import { IndexedSource, UrlAnalysisResult } from './types';

export type MessageHighlightCategory = 'sensitive' | 'urgency' | 'payment' | 'impersonation' | 'domain';
export type MessageHighlightFinding = 'general_warning' | 'verified_finding';

export interface MessageHighlight {
  id: string;
  start: number;
  end: number;
  text: string;
  category: MessageHighlightCategory;
  finding: MessageHighlightFinding;
  explanation: string;
  evidenceSourceIds: number[];
}

export interface HighlightSegment {
  text: string;
  highlight?: MessageHighlight;
}

interface DetectHighlightOptions {
  sources?: IndexedSource[];
  urlAnalysis?: UrlAnalysisResult;
}

interface Candidate extends Omit<MessageHighlight, 'id' | 'evidenceSourceIds'> {
  priority: number;
}

const CATEGORY_EVIDENCE_TERMS: Record<MessageHighlightCategory, RegExp> = {
  sensitive: /\b(cvv|otp|pin|password|credential|bank(?:ing)? details|card details)\b/i,
  urgency: /\b(urgent|immediately|deadline|within \d+ hours?|blocked|suspended|disconnect|deactivat)\b/i,
  payment: /\b(pay|payment|transfer|deposit|fee|amount|₹|rs\.?|inr)\b/i,
  impersonation: /\b(impersonat|fake sender|verified domain|official communication|authority)\b/i,
  domain: /\b(domain|website|url|link|typosquat|punycode|look-alike)\b/i,
};

const OFFICIAL_DOMAIN_HINTS = [
  { token: 'sbi', official: 'sbi.co.in' },
  { token: 'rbi', official: 'rbi.org.in' },
  { token: 'incometax', official: 'incometax.gov.in' },
  { token: 'uidai', official: 'uidai.gov.in' },
  { token: 'epfo', official: 'epfindia.gov.in' },
  { token: 'pib', official: 'pib.gov.in' },
];

function evidenceIds(category: MessageHighlightCategory, sources: IndexedSource[]): number[] {
  const terms = CATEGORY_EVIDENCE_TERMS[category];
  return sources
    .filter(source => !source.isFixture && terms.test(`${source.title} ${source.passage}`))
    .slice(0, 2)
    .map(source => source.id);
}

function addMatches(
  text: string,
  pattern: RegExp,
  candidate: Omit<Candidate, 'start' | 'end' | 'text'>,
  output: Candidate[],
): void {
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined || !match[0]) continue;
    output.push({
      ...candidate,
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
    });
  }
}

function domainCandidate(rawUrl: string, start: number, analysis?: UrlAnalysisResult): Candidate | null {
  let hostname = '';
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  const completedAnalysis = analysis?.status === 'success' && [analysis.url, analysis.finalUrl, analysis.canonicalUrl]
    .filter(Boolean)
    .some(url => url === rawUrl);
  if (completedAnalysis && analysis && analysis.domainRisk.riskLevel !== 'Low') {
    return {
      start,
      end: start + rawUrl.length,
      text: rawUrl,
      category: 'domain',
      finding: 'verified_finding',
      explanation: analysis.domainRisk.warnings[0] || 'The completed URL analysis identified a domain discrepancy.',
      priority: 5,
    };
  }

  const hintedTarget = OFFICIAL_DOMAIN_HINTS.find(target =>
    hostname.includes(target.token) && hostname !== target.official && !hostname.endsWith(`.${target.official}`)
  );
  const structuralWarning = hostname.includes('xn--') || hintedTarget || /\.apk$/i.test(hostname) || /\.apk(?:\/|$)/i.test(rawUrl);
  if (!structuralWarning) return null;

  return {
    start,
    end: start + rawUrl.length,
    text: rawUrl,
    category: 'domain',
    finding: 'general_warning',
    explanation: hintedTarget
      ? `This URL contains “${hintedTarget.token}” but is not the known ${hintedTarget.official} domain. This is a structural warning only; the site was not inspected.`
      : 'This URL has a suspicious structure. This is a general warning signal; the site was not inspected.',
    priority: 5,
  };
}

export function isValidMessageHighlight(text: string, highlight: MessageHighlight): boolean {
  return Number.isInteger(highlight.start)
    && Number.isInteger(highlight.end)
    && highlight.start >= 0
    && highlight.end > highlight.start
    && highlight.end <= text.length
    && text.slice(highlight.start, highlight.end) === highlight.text;
}

export function detectMessageHighlights(text: string, options: DetectHighlightOptions = {}): MessageHighlight[] {
  if (!text) return [];
  const candidates: Candidate[] = [];
  const sensitiveCandidates: Candidate[] = [];

  addMatches(
    text,
    /\b(?:debit|credit)\s+card\s+(?:number|details|cvv)\b|\b(?:internet\s+banking|banking)\s+(?:password|details|credentials)\b|\bbank\s+account\s+(?:number|details)\b|\b(?:cvv|otp|one[- ]time password|pin|password)\b/gi,
    {
      category: 'sensitive',
      finding: 'general_warning',
      explanation: 'Requests for credentials or card-security details are sensitive. Their presence is a warning signal, not proof that the sender is fraudulent.',
      priority: 4,
    },
    sensitiveCandidates,
  );
  candidates.push(...sensitiveCandidates.filter(candidate => {
    const context = text.slice(Math.max(0, candidate.start - 64), Math.min(text.length, candidate.end + 24));
    const hasRequest = /\b(?:ask(?:ing)?\s+(?:for|you to)|share|send|provide|enter|confirm|verify|update|submit|give|reply with|request(?:ing)?)\b/i.test(context);
    const isSafetyAdvice = /\b(?:never|do not|don't|avoid)\s+(?:share|send|provide|enter|confirm|submit|give)\b/i.test(context);
    return hasRequest && !isSafetyAdvice;
  }));

  addMatches(
    text,
    /\b(?:urgent(?:ly)?|immediately|within\s+\d+\s+(?:minutes?|hours?|days?)|tonight|before midnight|last chance|act now|without delay|expires today)\b/gi,
    {
      category: 'urgency',
      finding: 'general_warning',
      explanation: 'A forced deadline can pressure someone to act before independently checking the message.',
      priority: 2,
    },
    candidates,
  );

  addMatches(
    text,
    /\b(?:pay|transfer|deposit|send)\s+(?:now\s+|immediately\s+)?(?:₹|rs\.?|inr)?\s*[\d,]+(?:\.\d{1,2})?\b|\b(?:payment|deposit)\s+(?:is\s+)?(?:required|due)\b/gi,
    {
      category: 'payment',
      finding: 'general_warning',
      explanation: 'A direct payment demand deserves independent verification, especially when paired with urgency or threats.',
      priority: 3,
    },
    candidates,
  );

  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    if (match.index === undefined) continue;
    const rawUrl = match[0].replace(/[),.;!?]+$/, '');
    const candidate = domainCandidate(rawUrl, match.index, options.urlAnalysis);
    if (candidate) candidates.push(candidate);
  }

  const hasBehavioralWarning = candidates.some(candidate => candidate.category !== 'impersonation');
  if (hasBehavioralWarning) {
    addMatches(
      text,
      /\b(?:Income Tax Department|Reserve Bank of India|RBI|TRAI|CBI|police|customs|electricity board|telecom department|State Bank of India|SBI)\b/gi,
      {
        category: 'impersonation',
        finding: 'general_warning',
        explanation: 'The message invokes a trusted institution. The name alone does not verify the sender’s identity.',
        priority: 1,
      },
      candidates,
    );
  }

  const accepted: Candidate[] = [];
  for (const candidate of candidates.sort((a, b) => b.priority - a.priority || a.start - b.start || b.end - a.end)) {
    if (accepted.some(existing => candidate.start < existing.end && candidate.end > existing.start)) continue;
    accepted.push(candidate);
  }

  return accepted
    .sort((a, b) => a.start - b.start)
    .slice(0, 8)
    .map((candidate, index) => ({
      id: `${candidate.category}-${candidate.start}-${candidate.end}-${index}`,
      start: candidate.start,
      end: candidate.end,
      text: candidate.text,
      category: candidate.category,
      finding: candidate.finding,
      explanation: candidate.explanation,
      evidenceSourceIds: evidenceIds(candidate.category, options.sources || []),
    }))
    .filter(highlight => isValidMessageHighlight(text, highlight));
}

export function segmentHighlightedText(text: string, highlights: MessageHighlight[]): HighlightSegment[] {
  const valid = highlights
    .filter(highlight => isValidMessageHighlight(text, highlight))
    .sort((a, b) => a.start - b.start)
    .filter((highlight, index, all) => index === 0 || highlight.start >= all[index - 1].end);
  if (valid.length === 0) return [{ text }];

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const highlight of valid) {
    if (highlight.start > cursor) segments.push({ text: text.slice(cursor, highlight.start) });
    segments.push({ text: highlight.text, highlight });
    cursor = highlight.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
