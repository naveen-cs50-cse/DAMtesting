import type {
  AnswerEvidenceSet,
  ChatTurn,
  CitationTarget,
  Conversation,
  IndexedSource,
  InvestigationMeta,
} from './types';

export type CitationResolution =
  | { ok: true; evidenceSet: AnswerEvidenceSet; source: IndexedSource }
  | { ok: false; reason: string; evidenceSet?: AnswerEvidenceSet };

function canonicalSourceKey(source: IndexedSource): string {
  return source.url.trim().toLowerCase().replace(/#.*$/, '').replace(/\/$/, '') || `${source.id}:${source.title}`;
}

export function buildAnswerEvidenceSet(
  investigationId: string,
  answerId: string,
  meta?: InvestigationMeta | null,
  answerText = '',
): AnswerEvidenceSet {
  const seen = new Set<string>();
  const retrievedSources = (meta?.sources || []).filter(source => {
    const key = canonicalSourceKey(source);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const availableIds = new Set(retrievedSources.map(source => source.id));
  const inlineCitationIds = Array.from(answerText.matchAll(/\[(\d+)\]/g), match => Number(match[1]));
  const recordedCitationIds = [
    ...(meta?.retrieval?.citedSourceIds || []),
    ...retrievedSources.filter(source => source.isCited).map(source => source.id),
  ];
  const citedEvidenceIds = Array.from(new Set(
    answerText.trim() ? inlineCitationIds : recordedCitationIds,
  )).filter(id => availableIds.has(id));

  return { investigationId, answerId, retrievedSources, citedEvidenceIds };
}

export function getAnswerEvidenceSet(
  investigationId: string,
  turn?: ChatTurn,
): AnswerEvidenceSet | null {
  if (!turn || turn.role !== 'assistant') return null;
  if (
    turn.evidenceSet?.investigationId === investigationId &&
    turn.evidenceSet.answerId === turn.id
  ) {
    return turn.evidenceSet;
  }
  if (!turn.meta) return null;
  return buildAnswerEvidenceSet(investigationId, turn.id, turn.meta, turn.fullText || '');
}

export function resolveCitation(
  conversation: Conversation | null | undefined,
  target: CitationTarget,
): CitationResolution {
  if (!conversation || conversation.id !== target.investigationId) {
    return { ok: false, reason: 'This citation belongs to a different investigation.' };
  }
  const answer = conversation.turns.find(turn => turn.role === 'assistant' && turn.id === target.answerId);
  if (!answer) {
    return { ok: false, reason: 'The answer associated with this citation is no longer available.' };
  }
  const evidenceSet = getAnswerEvidenceSet(conversation.id, answer);
  if (!evidenceSet || evidenceSet.retrievedSources.length === 0) {
    return { ok: false, reason: 'Historical evidence for this answer is unavailable.' };
  }
  const source = evidenceSet.retrievedSources.find(item => item.id === target.evidenceId);
  if (!source) {
    return { ok: false, reason: `Source [${target.evidenceId}] is unavailable for this answer.`, evidenceSet };
  }
  if (!evidenceSet.citedEvidenceIds.includes(target.evidenceId)) {
    return { ok: false, reason: `Source [${target.evidenceId}] was retrieved but was not cited by this answer.`, evidenceSet };
  }
  return { ok: true, evidenceSet, source };
}

function safeDomPart(value: string): string {
  return encodeURIComponent(value);
}

export function evidenceDomId(target: CitationTarget): string {
  return `evidence-card-${safeDomPart(target.investigationId)}-${safeDomPart(target.answerId)}-${target.evidenceId}`;
}
