import { ClaimFinding, IndexedSource, StructuredAssessment, TaskType, ThreatEntities, VerdictExplanation } from './types';
import { executeVerdictEngine, EvaluatedSource, VerdictEngineInput } from './verdictEngine';

export interface VerificationResult {
  verdicts: StructuredAssessment;
  claims: ClaimFinding[];
  challengerAudit: string[];
  evaluatedSources?: EvaluatedSource[];
  explanation?: VerdictExplanation;
}

export interface VerificationContext {
  threatEntities?: ThreatEntities;
  forensics?: VerdictEngineInput['forensics'];
  manipulation?: VerdictEngineInput['manipulation'];
  statutes?: VerdictEngineInput['statutes'];
  documentAnalysis?: import('./types').DocumentAnalysis | null;
  urlAnalysis?: import('./types').UrlAnalysisResult | null;
  allowFixturesAsEvidence?: boolean;
}

export function verifyAndChallenge(
  prompt: string,
  taskType: TaskType,
  sources: IndexedSource[],
  context: VerificationContext = {}
): VerificationResult {
  const result = executeVerdictEngine({
    prompt,
    taskType,
    sources,
    threatEntities: context.threatEntities,
    forensics: context.forensics,
    manipulation: context.manipulation,
    statutes: context.statutes,
    documentAnalysis: context.documentAnalysis,
    urlAnalysis: context.urlAnalysis,
    allowFixturesAsEvidence: context.allowFixturesAsEvidence
  });

  return {
    verdicts: result.verdicts,
    claims: result.claims,
    challengerAudit: result.challengerAudit,
    evaluatedSources: result.evaluatedSources,
    explanation: result.explanation
  };
}
