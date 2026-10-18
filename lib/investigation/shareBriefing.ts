import { Conversation, IndexedSource, InvestigationMeta } from './types';

export interface ShareBriefingPayload {
  text: string;
  sourceLinks: Array<{ id: number; label: string; url: string }>;
  dateChecked: string;
}

function redactIdentifiers(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email omitted]')
    .replace(/(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g, '[phone omitted]')
    .replace(/\b(?:aadhaar|aadhar|pan|passport|ssn|account|application|candidate)\s*(?:no\.?|number|id)?\s*[:#-]\s*[A-Z0-9-]{4,}\b/gi, '[identifier omitted]')
    .replace(/https?:\/\/\S+/gi, '[link omitted]')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeSourceUrl(source: IndexedSource): string | null {
  try {
    const url = new URL(source.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function citedSources(meta: InvestigationMeta): Array<{ id: number; label: string; url: string }> {
  const citedIds = new Set(meta.retrieval?.citedSourceIds || []);
  return (meta.sources || [])
    .filter(source => !source.isFixture && (source.isCited || citedIds.has(source.id)))
    .map(source => {
      const url = safeSourceUrl(source);
      if (!url) return null;
      return {
        id: source.id,
        label: redactIdentifiers(source.title || source.domain) || source.domain,
        url,
      };
    })
    .filter((source): source is { id: number; label: string; url: string } => Boolean(source))
    .slice(0, 3);
}

function assessment(meta: InvestigationMeta): string {
  const verdicts = meta.verdicts;
  if (!verdicts) {
    return 'Investigation briefing completed without automated verdict scores.';
  }
  const parts = [`Factual support is ${verdicts.factualCorrectness.toLowerCase()}.`];
  if (verdicts.messageAuthenticity && verdicts.messageAuthenticity !== 'Not applicable') {
    parts.push(`The specific message is ${verdicts.messageAuthenticity.toLowerCase()}.`);
  }
  parts.push(`Scam indicators were assessed as ${verdicts.scamRisk.toLowerCase()} risk.`);
  return parts.join(' ');
}

function keyReasons(meta: InvestigationMeta): string[] {
  if (meta.taskType === 'job_offer' && meta.jobOfferAnalysis) {
    const analysis = meta.jobOfferAnalysis;
    const warningSignals = [
      analysis.paymentRequest ? 'a payment request was identified' : 'no explicit payment request was identified',
      analysis.sensitiveDataRequest ? 'a sensitive-data request was identified' : 'no explicit sensitive-data request was identified',
      analysis.domainWarning ? 'the sender domain requires independent verification' : '',
    ].filter(Boolean).join('; ');
    return [
      `Completed — Message warning-sign review: ${warningSignals}.`,
      `${analysis.checks[1]?.status === 'completed' ? 'Completed' : 'Not completed'} — Company and careers information: ${analysis.checks[1]?.status === 'completed' ? 'A public-web search was run; its results do not authenticate the offer.' : 'The available details or retrieval capability did not permit this check.'}`,
      `${analysis.checks[2]?.status === 'completed' ? 'Completed' : 'Not completed'} — Recruiter affiliation and specific offer: ${analysis.checks[2]?.status === 'completed' ? 'A direct check failed.' : 'No direct employer confirmation was available.'}`,
    ];
  }

  const explanation = meta.verdictExplanation || meta.verdicts?.explanation;
  return [
    explanation?.factualRationale,
    explanation?.authenticityRationale,
    meta.verdicts && meta.verdicts.scamRisk !== 'Low' ? explanation?.scamRationale : undefined,
  ]
    .filter((reason): reason is string => Boolean(reason?.trim()))
    .map(redactIdentifiers)
    .filter(Boolean)
    .slice(0, 3);
}

function materialUncertainty(meta: InvestigationMeta): string {
  if (meta.verdicts?.messageAuthenticity === 'Cannot authenticate') {
    return 'Public evidence cannot authenticate the specific sender, transaction, or communication.';
  }
  if (meta.verdicts?.evidenceSufficiency === 'Insufficient') {
    return 'The available public evidence is insufficient to confirm or disprove the specific claim.';
  }
  if (meta.verdicts?.evidenceSufficiency === 'Partial') {
    return 'The available evidence addresses only part of the claim, so a material gap remains.';
  }
  return 'This assessment is limited to the cited public evidence available on the date checked.';
}

function checkedDate(value: string | undefined, fallback: Date): string {
  const parsed = value ? new Date(value) : fallback;
  const valid = Number.isNaN(parsed.getTime()) ? fallback : parsed;
  return valid.toISOString().slice(0, 10);
}

export function buildShareBriefing(conversation: Conversation, fallbackDate = new Date()): ShareBriefingPayload | null {
  const lastAssistant = [...conversation.turns]
    .reverse()
    .find(turn => turn.role === 'assistant' && !turn.isLive && turn.meta?.verdicts);
  const meta = lastAssistant?.meta;
  if (!lastAssistant || !meta) return null;

  const sources = citedSources(meta);
  const dateChecked = checkedDate(lastAssistant.createdAt, fallbackDate);
  const reasons = keyReasons(meta);
  const sourceLines = sources.length > 0
    ? sources.map(source => `- [${source.id}] ${source.label}: ${source.url}`)
    : ['- No supporting source was cited in the completed answer.'];

  const text = [
    'UseDAM investigation briefing',
    '',
    'Assessment',
    assessment(meta),
    '',
    'Key reasons',
    ...(reasons.length > 0 ? reasons.map(reason => `- ${reason}`) : ['- No additional evidence-backed reason was recorded.']),
    '',
    'Supporting sources',
    ...sourceLines,
    '',
    `Date checked: ${dateChecked}`,
    `Material uncertainty: ${materialUncertainty(meta)}`,
  ].join('\n');

  return { text, sourceLinks: sources, dateChecked };
}
