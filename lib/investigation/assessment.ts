import type {
  EvidenceSufficiency,
  FactualCorrectness,
  InvestigationMeta,
  MessageAuthenticity,
  QueryVerdictStatus,
  ScamRisk,
  StructuredAssessment,
  VerdictExplanation,
} from './types';

const factualValues = new Set<FactualCorrectness>(['Supported', 'Contradicted', 'Mixed', 'Unverified']);
const authenticityValues = new Set<MessageAuthenticity>([
  'Authenticated',
  'Not authenticated',
  'Cannot authenticate',
  'Not applicable',
]);
const scamValues = new Set<ScamRisk>(['Low', 'Medium', 'High', 'Not applicable']);
const sufficiencyValues = new Set<EvidenceSufficiency>(['Sufficient', 'Partial', 'Insufficient']);

export type AssessmentValidation =
  | { ok: true; assessment: StructuredAssessment }
  | { ok: false; error: string };

export function deriveVerdictStatus(factualCorrectness: FactualCorrectness): QueryVerdictStatus {
  if (factualCorrectness === 'Supported') return 'right';
  if (factualCorrectness === 'Contradicted') return 'false';
  return 'unverified';
}

function isExplanation(value: unknown): value is VerdictExplanation {
  if (!value || typeof value !== 'object') return false;
  const explanation = value as Partial<VerdictExplanation>;
  return (
    typeof explanation.summary === 'string' &&
    typeof explanation.factualRationale === 'string' &&
    (explanation.authenticityRationale === undefined || typeof explanation.authenticityRationale === 'string') &&
    typeof explanation.scamRationale === 'string' &&
    typeof explanation.sufficiencyRationale === 'string' &&
    Array.isArray(explanation.sourceImpacts)
  );
}

export function validateStructuredAssessment(value: unknown): AssessmentValidation {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: 'The structured assessment is missing.' };
  }

  const candidate = value as Partial<StructuredAssessment>;
  if (!factualValues.has(candidate.factualCorrectness as FactualCorrectness)) {
    return { ok: false, error: 'The factual-support result is missing or malformed.' };
  }
  if (!authenticityValues.has(candidate.messageAuthenticity as MessageAuthenticity)) {
    return { ok: false, error: 'The sender-authenticity result is missing or malformed.' };
  }
  if (!scamValues.has(candidate.scamRisk as ScamRisk)) {
    return { ok: false, error: 'The scam-risk result is missing or malformed.' };
  }
  if (!sufficiencyValues.has(candidate.evidenceSufficiency as EvidenceSufficiency)) {
    return { ok: false, error: 'The evidence-sufficiency result is missing or malformed.' };
  }
  if (!Array.isArray(candidate.riskTriggers) || candidate.riskTriggers.some((trigger) => typeof trigger !== 'string')) {
    return { ok: false, error: 'The risk indicators are missing or malformed.' };
  }
  if (!isExplanation(candidate.explanation)) {
    return { ok: false, error: 'The assessment explanation is malformed.' };
  }

  const factualCorrectness = candidate.factualCorrectness as FactualCorrectness;
  return {
    ok: true,
    assessment: {
      factualCorrectness,
      messageAuthenticity: candidate.messageAuthenticity as MessageAuthenticity,
      scamRisk: candidate.scamRisk as ScamRisk,
      evidenceSufficiency: candidate.evidenceSufficiency as EvidenceSufficiency,
      riskTriggers: [...candidate.riskTriggers],
      explanation: candidate.explanation,
      verdictStatus: deriveVerdictStatus(factualCorrectness),
    },
  };
}

export function requireStructuredAssessment(value: unknown): StructuredAssessment {
  const validation = validateStructuredAssessment(value);
  if (!validation.ok) throw new Error(validation.error);
  return validation.assessment;
}

export function getAssessment(meta?: InvestigationMeta | null): AssessmentValidation {
  if (!meta) return { ok: false, error: 'The investigation metadata is missing.' };
  return validateStructuredAssessment(meta.assessment ?? meta.verdicts);
}

export function getQueryVerdictStatus(meta?: InvestigationMeta | null): QueryVerdictStatus | null {
  if (!meta || meta.taskType === 'conversational' || meta.taskType === 'follow_up') return null;
  const validation = getAssessment(meta);
  return validation.ok ? validation.assessment.verdictStatus : null;
}
