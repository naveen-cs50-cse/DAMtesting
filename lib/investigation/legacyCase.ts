import { buildAnswerEvidenceSet } from './evidenceIsolation';
import { generateSmartTitle } from './naming';
import type { ActivityStage, Conversation, InvestigationMeta, InvestigationVerdicts } from './types';

export type LegacyCaseErrorType = 'malformed' | 'unsupported' | 'unavailable';

export type LegacyCaseReference =
  | { kind: 'local'; value: string }
  | { kind: 'remote'; value: string }
  | { kind: 'invalid'; value: string; reason: 'malformed' | 'unsupported' };

export interface LegacyLinkNotice {
  type: LegacyCaseErrorType;
  title: string;
  description: string;
}

export function parseLegacyCaseReference(raw: string | null): LegacyCaseReference | null {
  if (raw === null) return null;
  const value = raw.trim();

  // Malformed: empty string, excessive length, directory traversal, control characters, special/dangerous symbols, internal whitespace
  if (
    value.length === 0 ||
    value.length > 100 ||
    value.includes('..') ||
    value.includes('/') ||
    value.includes('\\') ||
    /%2f|%5c|%00/i.test(value) ||
    /[\x00-\x1f\x7f<>"'`;$|&!@#^*?()]/.test(value) ||
    /\s/.test(value)
  ) {
    return { kind: 'invalid', value, reason: 'malformed' };
  }

  // Supported remote investigation format
  if (/^inv_[a-z0-9]{8,80}$/i.test(value)) {
    return { kind: 'remote', value };
  }

  // Supported local/case format
  if (/^(?:DAM-[A-Z0-9-]{4,80}|conv_[a-z0-9-]{8,80})$/i.test(value)) {
    return { kind: 'local', value };
  }

  // Unrecognized but syntactically clean identifier
  return { kind: 'invalid', value, reason: 'unsupported' };
}

export function getLegacyLinkNotice(type: LegacyCaseErrorType, _caseRef?: string): LegacyLinkNotice {
  switch (type) {
    case 'malformed':
      return {
        type: 'malformed',
        title: 'Malformed Case Reference',
        description: 'The requested case link contains invalid characters or a malformed identifier. Please check the link and try again.',
      };
    case 'unsupported':
      return {
        type: 'unsupported',
        title: 'Unsupported Case Link',
        description: 'The legacy case link format is not supported by the investigation workspace.',
      };
    case 'unavailable':
      return {
        type: 'unavailable',
        title: 'Investigation Unavailable',
        description: 'This investigation is unavailable, no longer exists, or access is restricted on this workstation.',
      };
  }
}

export function findLocalLegacyCase(conversations: Conversation[], reference: string): Conversation | null {
  return conversations.find(conversation => conversation.id === reference || conversation.caseId === reference) || null;
}

export interface LegacyInvestigationPayload {
  investigationId: string;
  caseId: string;
  prompt: string;
  briefing: string;
  stages?: ActivityStage[];
  verdicts?: InvestigationVerdicts | null;
  meta?: InvestigationMeta | null;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt?: string;
  updatedAt?: string;
}

export function buildLegacyConversation(payload: LegacyInvestigationPayload): Conversation {
  const createdAt = payload.createdAt || new Date().toISOString();
  const answerId = `legacy_answer_${payload.investigationId}`;
  const meta = payload.meta ? { ...payload.meta, verdicts: payload.meta.verdicts || payload.verdicts || null } : null;
  const assistant = {
    id: answerId,
    role: 'assistant' as const,
    fullText: payload.briefing || (payload.status === 'failed' ? 'This investigation is unavailable because processing failed.' : 'This investigation is still processing.'),
    stages: payload.stages || [],
    meta,
    createdAt: payload.updatedAt || createdAt,
    isLive: payload.status === 'queued' || payload.status === 'processing',
  };
  return {
    id: `legacy_${payload.investigationId}`,
    title: generateSmartTitle(payload.prompt),
    caseId: payload.caseId,
    createdAt,
    turns: [
      { id: `legacy_prompt_${payload.investigationId}`, role: 'user', content: payload.prompt, createdAt },
      { ...assistant, evidenceSet: buildAnswerEvidenceSet(`legacy_${payload.investigationId}`, answerId, meta, assistant.fullText) },
    ],
  };
}
