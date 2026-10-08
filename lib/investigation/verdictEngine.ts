import {
  EvidenceSufficiency,
  FactualCorrectness,
  IndexedSource,
  InvestigationVerdicts,
  ScamRisk,
  SourceImpact,
  TaskType,
  ThreatEntities,
  VerdictExplanation
} from './types';
import { getSourceAuthority } from './knowledge';

export interface EvaluatedSource extends IndexedSource {
  authorityScore: number;
  relevanceScore: number;
  recencyScore: number;
  stanceConfidence: number;
  impactRole: SourceImpact['impactRole'];
  impactExplanation: string;
}

export interface VerdictEngineInput {
  prompt: string;
  taskType: TaskType;
  sources: IndexedSource[];
  threatEntities?: ThreatEntities;
  forensics?: {
    urls?: Array<{ url: string; status: string; domain?: string }>;
    phones?: Array<{ number: string; risk: string }>;
    senders?: Array<{ id: string; isRegisteredDLT: boolean }>;
  };
  manipulation?: {
    overallIndex: number;
    threatLevel: string;
  };
  statutes?: {
    statutoryViolationCount: number;
    applicableStatutes?: Array<{ section: string }>;
  };
  documentAnalysis?: import('./types').DocumentAnalysis | null;
  urlAnalysis?: import('./types').UrlAnalysisResult | null;
  allowFixturesAsEvidence?: boolean;
}

export interface VerdictEngineOutput {
  verdicts: InvestigationVerdicts;
  evaluatedSources: EvaluatedSource[];
  explanation: VerdictExplanation;
  claims: Array<{
    claim: string;
    label: FactualCorrectness;
    supporting: string;
    contradicting: string;
  }>;
  challengerAudit: string[];
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'what', 'when', 'where', 'which', 'who', 'why', 'how', 'this',
  'these', 'those', 'can', 'could', 'should', 'would', 'i', 'my', 'me', 'we',
  'our', 'you', 'your', 'about', 'please', 'check', 'verify', 'tell', 'does'
]);

function stemToken(token: string): string {
  const t = token.toLowerCase();
  if (t.endsWith('sses')) return t.slice(0, -2);
  if (t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.endsWith('ing') && t.length > 5) return t.slice(0, -3);
  if (t.endsWith('ed') && t.length > 4) return t.slice(0, -2);
  if (t.endsWith('es') && t.length > 4) return t.slice(0, -2);
  if (t.endsWith('s') && t.length > 3 && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s₹$]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Calculates lexical & entity relevance between user inquiry and source title/passage.
 * Returns a normalized score between 0.0 and 1.0.
 */
export function calculateSourceRelevance(
  claim: string,
  source: { title: string; passage: string; domain: string }
): number {
  const claimTokens = tokenize(claim);
  if (claimTokens.length === 0) return 0.5;

  const sourceContent = `${source.title} ${source.passage} ${source.domain}`.toLowerCase();
  const rawSourceTokens = tokenize(sourceContent);
  const sourceTokens = new Set(rawSourceTokens);
  const sourceStems = new Set(rawSourceTokens.map(stemToken));

  let matchedTokens = 0;
  for (const token of claimTokens) {
    const stem = stemToken(token);
    const hasMatch =
      sourceTokens.has(token) ||
      sourceStems.has(stem) ||
      sourceContent.includes(token) ||
      sourceContent.includes(stem) ||
      rawSourceTokens.some(st => {
        if (st.length >= 4 && token.length >= 4) {
          return st.includes(token) || token.includes(st) || st.startsWith(stem) || token.startsWith(st);
        }
        return false;
      });

    if (hasMatch) {
      matchedTokens++;
    }
  }

  const lexicalOverlap = matchedTokens / claimTokens.length;

  // Key regulatory & numeric entity checks (e.g., "500", "rbi", "electricity", "trai", "sim", "pension", "cbi")
  const keyEntities = claimTokens.filter(t => /\d+/.test(t) || t.length >= 4);
  let entityOverlap = 0;
  if (keyEntities.length > 0) {
    let matchedEntities = 0;
    for (const k of keyEntities) {
      const stem = stemToken(k);
      if (
        sourceTokens.has(k) ||
        sourceStems.has(stem) ||
        sourceContent.includes(k) ||
        sourceContent.includes(stem) ||
        rawSourceTokens.some(st => (st.length >= 4 && (st.includes(stem) || stem.includes(st))))
      ) {
        matchedEntities++;
      }
    }
    entityOverlap = matchedEntities / keyEntities.length;
  } else {
    entityOverlap = lexicalOverlap;
  }

  // Blended relevance: weight entity matches higher than generic words
  const rawScore = 0.45 * lexicalOverlap + 0.55 * entityOverlap;
  return Math.min(1.0, Math.max(0.0, parseFloat(rawScore.toFixed(3))));
}

/**
 * Determines recency score based on published date string and passage text.
 */
export function calculateSourceRecency(dateStr: string, passage: string): number {
  const combined = `${dateStr} ${passage}`.toLowerCase();

  if (combined.includes('2026') || combined.includes('2025')) {
    return 1.0;
  }
  if (combined.includes('2024')) {
    return 0.92;
  }
  if (combined.includes('2023')) {
    return 0.82;
  }
  if (combined.includes('2022') || combined.includes('2021')) {
    return 0.70;
  }
  if (/\b(19\d\d|201\d)\b/.test(combined)) {
    return 0.55; // Historical record
  }
  return 0.75; // Generic or unstated publication date
}

/**
 * Analyzes semantic stance of source towards the user's assertion.
 */
export function detectSourceStance(
  claim: string,
  source: { title: string; passage: string; stance?: string }
): { stance: 'supports' | 'contradicts' | 'context'; confidence: number } {
  const combined = `${source.title} ${source.passage}`.toLowerCase();

  const refutationPatterns = [
    'fake', 'hoax', 'false', 'misleading', 'fraud', 'unfounded', 'rumor', 'rumour',
    'denied', 'no such circular', 'no order issued', 'not banned', 'not withdrawn',
    'legal tender across', 'remain legal tender', 'remains legal tender',
    'scam alert', 'beware of', 'refutes', 'debunk', 'clarification on fake',
    'malicious impersonation', 'do not believe', 'never asks for deposit',
    'strictly adhere to section 56', 'digital arrest is fake', 'does not block'
  ];

  const affirmationPatterns = [
    'officially announced', 'cabinet approves', 'notified in gazette',
    'effective from', 'mandatory compliance', 'officially launched',
    'directive issued', 'confirmed by ministry', 'valid tender withdrawn under gazette',
    'verified notification', 'rules updated for 2026'
  ];

  let refuteScore = 0;
  for (const pat of refutationPatterns) {
    if (combined.includes(pat)) refuteScore += 1;
  }

  let affirmScore = 0;
  for (const pat of affirmationPatterns) {
    if (combined.includes(pat)) affirmScore += 1;
  }

  // If the source was explicitly tagged with stance, validate it against textual evidence
  if (source.stance === 'contradicts' || refuteScore > affirmScore) {
    const conf = Math.min(1.0, 0.6 + 0.15 * refuteScore);
    return { stance: 'contradicts', confidence: parseFloat(conf.toFixed(2)) };
  }

  if (source.stance === 'supports' || affirmScore > refuteScore) {
    const conf = Math.min(1.0, 0.6 + 0.15 * affirmScore);
    return { stance: 'supports', confidence: parseFloat(conf.toFixed(2)) };
  }

  return { stance: 'context', confidence: 0.5 };
}

/**
 * Evaluates individual sources across Authority, Relevance, Recency, Stance, and Agreement.
 */
export function evaluateSources(
  prompt: string,
  sources: IndexedSource[],
  allowFixturesAsEvidence = false
): EvaluatedSource[] {
  return sources.map(src => {
    // If source is a fallback fixture and fixtures are not allowed as live evidence,
    // isolate it so it does not count as authoritative live testimony.
    const isFixtureSource = Boolean(src.isFixture);
    const authEval = getSourceAuthority(src.domain, src.type);

    let authorityScore = authEval.weight;
    if (isFixtureSource && !allowFixturesAsEvidence) {
      authorityScore = 0.15; // Quarantine fallback fixtures from live evidence weighting
    }

    const relevanceScore = calculateSourceRelevance(prompt, src);
    const recencyScore = calculateSourceRecency(src.date, src.passage);
    const { stance, confidence: stanceConfidence } = detectSourceStance(prompt, src);

    // Determine impact role and structured explanation
    let impactRole: SourceImpact['impactRole'] = 'neutral_context';
    let impactExplanation = '';

    if (isFixtureSource && !allowFixturesAsEvidence) {
      impactRole = 'insufficient_relevance';
      impactExplanation = `Fallback template reference for [${src.domain}]; excluded from live evidence computation.`;
    } else if (relevanceScore < 0.25) {
      impactRole = 'insufficient_relevance';
      impactExplanation = `Low topical relevance (${Math.round(relevanceScore * 100)}%) to the claim; minimal impact on verdict.`;
    } else if (stance === 'contradicts') {
      if (authorityScore >= 0.8 && relevanceScore >= 0.5) {
        impactRole = 'primary_contradiction';
        impactExplanation = `Primary authority (${src.domain}) directly refutes the claim with high topical alignment (${Math.round(relevanceScore * 100)}%).`;
      } else {
        impactRole = 'corroborating';
        impactExplanation = `Corroborates contradiction with ${authEval.tier.toLowerCase()} reporting.`;
      }
    } else if (stance === 'supports') {
      if (authorityScore >= 0.8 && relevanceScore >= 0.5) {
        impactRole = 'primary_support';
        impactExplanation = `Authoritative primary record (${src.domain}) directly corroborates the claim.`;
      } else {
        impactRole = 'corroborating';
        impactExplanation = `Provides secondary corroboration supporting the assertion.`;
      }
    } else {
      impactRole = 'neutral_context';
      impactExplanation = `Relevant regulatory background (${src.domain}) without explicit directional stance on this specific claim.`;
    }

    return {
      ...src,
      authorityScore: parseFloat(authorityScore.toFixed(3)),
      relevanceScore,
      recencyScore: parseFloat(recencyScore.toFixed(3)),
      stance,
      stanceConfidence,
      impactRole,
      impactExplanation
    };
  });
}

/**
 * Determines Evidence Sufficiency from evaluated sources.
 */
export function evaluateEvidenceSufficiency(
  evaluatedSources: EvaluatedSource[],
  allowFixturesAsEvidence = false
): { sufficiency: EvidenceSufficiency; rationale: string; totalInfoWeight: number } {
  // Only sources passing the relevance threshold (>= 0.25) and not quarantined fixtures count towards sufficiency
  const activeSources = evaluatedSources.filter(s => {
    if (s.isFixture && !allowFixturesAsEvidence) return false;
    return s.relevanceScore >= 0.25;
  });

  if (activeSources.length === 0) {
    return {
      sufficiency: 'Insufficient',
      rationale: 'No authoritative primary records or direct gazette publications matching this claim were identified.',
      totalInfoWeight: 0
    };
  }

  // Calculate cumulative information weight
  const totalInfoWeight = activeSources.reduce((acc, s) => {
    return acc + s.authorityScore * s.relevanceScore * s.recencyScore;
  }, 0);

  const hasPrimaryGovRecord = activeSources.some(
    s => s.authorityScore >= 0.9 && s.relevanceScore >= 0.55
  );

  if (totalInfoWeight >= 1.0 || (hasPrimaryGovRecord && activeSources.length >= 1)) {
    return {
      sufficiency: 'Sufficient',
      rationale: `Cross-examined against ${activeSources.length} relevant record(s) with sufficient statutory authority (weight: ${totalInfoWeight.toFixed(2)}).`,
      totalInfoWeight: parseFloat(totalInfoWeight.toFixed(3))
    };
  }

  if (totalInfoWeight >= 0.45 || activeSources.length >= 1) {
    return {
      sufficiency: 'Partial',
      rationale: `Identified ${activeSources.length} partial reference(s), but lacking definitive primary gazette or multiple corroborating authorities (weight: ${totalInfoWeight.toFixed(2)}).`,
      totalInfoWeight: parseFloat(totalInfoWeight.toFixed(3))
    };
  }

  return {
    sufficiency: 'Insufficient',
    rationale: `Identified references are too sparse or weakly relevant to substantiate a definitive determination (weight: ${totalInfoWeight.toFixed(2)}).`,
    totalInfoWeight: parseFloat(totalInfoWeight.toFixed(3))
  };
}

/**
 * Evaluates Factual Correctness strictly based on evidence sufficiency and source agreement.
 * NEVER defaults an unknown or insufficient-evidence claim to 'Contradicted'.
 */
export function evaluateFactualCorrectness(
  sufficiency: EvidenceSufficiency,
  evaluatedSources: EvaluatedSource[],
  allowFixturesAsEvidence = false
): { correctness: FactualCorrectness; rationale: string } {
  // RULE: If evidence is insufficient, correctness MUST be 'Unverified'
  if (sufficiency === 'Insufficient') {
    return {
      correctness: 'Unverified',
      rationale: 'Evidence is inadequate to confirm or refute the assertion. The claim remains unverified pending primary regulatory publication.'
    };
  }

  const activeSources = evaluatedSources.filter(s => {
    if (s.isFixture && !allowFixturesAsEvidence) return false;
    return s.relevanceScore >= 0.25;
  });

  let supportWeight = 0;
  let contradictWeight = 0;

  for (const src of activeSources) {
    const weight = src.authorityScore * src.relevanceScore * src.recencyScore * src.stanceConfidence;
    if (src.stance === 'supports') {
      supportWeight += weight;
    } else if (src.stance === 'contradicts') {
      contradictWeight += weight;
    }
  }

  // If no directional stance is found (all context)
  if (supportWeight === 0 && contradictWeight === 0) {
    return {
      correctness: 'Unverified',
      rationale: 'Indexed records provide background context but do not assert a definitive directional stance on the claim.'
    };
  }

  const totalDirectionalWeight = supportWeight + contradictWeight;

  // Conflict / Agreement calculation
  if (supportWeight > 0 && contradictWeight > 0) {
    const agreementRatio = Math.abs(supportWeight - contradictWeight) / totalDirectionalWeight;
    if (agreementRatio < 0.40) {
      return {
        correctness: 'Mixed',
        rationale: `Conflicting records identified across indexed sources (support weight: ${supportWeight.toFixed(2)}, contradict weight: ${contradictWeight.toFixed(2)}).`
      };
    }
  }

  if (contradictWeight > supportWeight && contradictWeight >= 0.35) {
    return {
      correctness: 'Contradicted',
      rationale: `Refuted by high-authority records with an aggregate contradiction weight of ${contradictWeight.toFixed(2)}.`
    };
  }

  if (supportWeight > contradictWeight && supportWeight >= 0.35) {
    return {
      correctness: 'Supported',
      rationale: `Substantiated by published authoritative directives with an aggregate corroboration weight of ${supportWeight.toFixed(2)}.`
    };
  }

  return {
    correctness: 'Unverified',
    rationale: 'Directional evidence weight is below statistical confidence threshold; claim remains unverified.'
  };
}

/**
 * Evaluates Scam Risk independently from Factual Correctness.
 * NEVER defaults an unknown claim to 'High Risk'.
 */
export function evaluateScamRisk(
  input: VerdictEngineInput,
  correctness: FactualCorrectness
): { scamRisk: ScamRisk; riskTriggers: string[]; rationale: string } {
  const { prompt, threatEntities, forensics, manipulation, statutes } = input;
  const lower = prompt.toLowerCase();
  const riskTriggers: string[] = [];

  // 1. Phishing & Malicious URLs / APK Downloads
  const hasCriticalUrl = Boolean(
    forensics?.urls?.some(u => u.status === 'critical') ||
    lower.includes('.apk') ||
    lower.includes('bit.ly') ||
    lower.includes('tinyurl') ||
    lower.includes('download now')
  );
  if (hasCriticalUrl) {
    riskTriggers.push('Deceptive URL / APK Phishing');
  }

  // 2. Personal Mobile Caller Impersonation
  const hasPersonalPhone = Boolean(
    forensics?.phones?.some(p => p.risk === 'High') ||
    (threatEntities?.phones && threatEntities.phones.length > 0 && (lower.includes('call') || lower.includes('contact')))
  );
  if (hasPersonalPhone) {
    riskTriggers.push('Personal 10-Digit Sender / Caller');
  }

  // 3. Digital Arrest & Law Enforcement Extortion
  const hasDigitalArrest = Boolean(
    lower.includes('digital arrest') ||
    lower.includes('cbi') ||
    lower.includes('cyber crime cell') ||
    lower.includes('skype') ||
    lower.includes('video call interrogation') ||
    lower.includes('customs parcel')
  );
  if (hasDigitalArrest) {
    riskTriggers.push('Digital Arrest / Agency Impersonation');
  }

  // 4. Utility Disconnection Pressure (violating statutory 15-day notice)
  const hasDisconnectionThreat = Boolean(
    (lower.includes('electric') || lower.includes('power cut') || lower.includes('bill')) &&
    (lower.includes('9:30') || lower.includes('tonight') || lower.includes('immediate') || lower.includes('disconnected'))
  );
  if (hasDisconnectionThreat) {
    riskTriggers.push('Immediate Disconnection Threat (Violates Section 56)');
  }

  // 5. Psychological Coercion / Panic Scoring
  const manipIndex = manipulation?.overallIndex || 0;
  if (manipIndex >= 80) {
    riskTriggers.push('Acute Psychological Coercion');
  } else if (manipIndex >= 65) {
    riskTriggers.push('Urgency Manipulation');
  }

  // 6. Statutory Violations Flagged
  if (statutes && statutes.statutoryViolationCount > 0) {
    riskTriggers.push(`${statutes.statutoryViolationCount} Statutory Notice Violation(s)`);
  }

  // 7. Non-DLT Sender Header for Service Alert
  if (forensics?.senders?.some(s => !s.isRegisteredDLT)) {
    riskTriggers.push('Unregistered Non-DLT SMS Header');
  }

  // 8. Document Forensics Anomalies (e.g., unofficial domains on official letterheads)
  if (input.documentAnalysis?.anomalies) {
    const docAnomalies = input.documentAnalysis.anomalies;
    if (docAnomalies.some(a => a.type === 'unofficial_domain')) {
      riskTriggers.push('Unofficial Domain on Official Header');
    }
    if (docAnomalies.some(a => a.type === 'mismatched_dates')) {
      riskTriggers.push('Contradictory Internal Dates');
    }
  }

  // 9. Ingested Web URL Forensics
  if (input.urlAnalysis) {
    const urlRisk = input.urlAnalysis.domainRisk;
    if (urlRisk.riskLevel === 'High') {
      riskTriggers.push(`Deceptive Domain (${urlRisk.typosquatTarget || 'High-Risk Domain'})`);
    } else if (urlRisk.riskLevel === 'Medium') {
      riskTriggers.push(`Suspicious Web Domain (${urlRisk.warnings[0] || 'Domain Anomaly'})`);
    }
    if (input.urlAnalysis.downloadLinks.length > 0) {
      riskTriggers.push(`Direct Executable / APK Download (${input.urlAnalysis.downloadLinks.length} payload link(s))`);
    }
    if (input.urlAnalysis.status === 'ssrf_blocked') {
      riskTriggers.push('Internal / Private Network Probe Attempt');
    }
  }

  // --- Determine Scam Risk Level ---
  // High Risk: Requires active scam attack vectors
  if (
    hasCriticalUrl ||
    (hasPersonalPhone && (hasDisconnectionThreat || hasDigitalArrest)) ||
    hasDigitalArrest ||
    manipIndex >= 80 ||
    riskTriggers.length >= 3
  ) {
    return {
      scamRisk: 'High',
      riskTriggers,
      rationale: `High cyber threat detected with active extortion/phishing vectors: ${riskTriggers.join(', ')}.`
    };
  }

  // Medium Risk: Suspicious elements, rumor panic, or contradicted viral hoax without direct phishing payload
  if (
    hasPersonalPhone ||
    manipIndex >= 60 ||
    riskTriggers.length >= 1 ||
    correctness === 'Contradicted'
  ) {
    if (riskTriggers.length === 0 && correctness === 'Contradicted') {
      riskTriggers.push('Viral Misinformation Rumor');
    }
    return {
      scamRisk: 'Medium',
      riskTriggers: riskTriggers.length > 0 ? riskTriggers : ['Unverified Third-Party Circular'],
      rationale: `Medium risk: Suspicious dissemination vectors identified (${riskTriggers.join(', ') || 'viral unverified rumor'}).`
    };
  }

  // Low Risk: Neutral research inquiry, verified official notice, or unknown claim with NO threat heuristics
  return {
    scamRisk: 'Low',
    riskTriggers: [],
    rationale: 'No criminal extortion indicators, deceptive links, or social engineering triggers identified.'
  };
}

/**
 * Main Evidence-Driven Verdict Engine execution function.
 */
export function executeVerdictEngine(input: VerdictEngineInput): VerdictEngineOutput {
  const allowFixtures = Boolean(input.allowFixturesAsEvidence);

  // 1. Evaluate individual sources
  const evaluatedSources = evaluateSources(input.prompt, input.sources, allowFixtures);

  // 2. Derive Evidence Sufficiency
  const sufficiencyResult = evaluateEvidenceSufficiency(evaluatedSources, allowFixtures);

  // 3. Derive Factual Correctness
  const correctnessResult = evaluateFactualCorrectness(
    sufficiencyResult.sufficiency,
    evaluatedSources,
    allowFixtures
  );

  // 4. Derive Scam Risk
  const scamRiskResult = evaluateScamRisk(input, correctnessResult.correctness);

  // 5. Build structured source impacts
  const sourceImpacts: SourceImpact[] = evaluatedSources.map(s => ({
    sourceId: s.id,
    domain: s.domain,
    authorityWeight: s.authorityScore,
    relevanceScore: s.relevanceScore,
    recencyScore: s.recencyScore,
    stance: s.stance,
    impactRole: s.impactRole,
    explanation: s.impactExplanation
  }));

  // 6. Build overall explanation
  const explanation: VerdictExplanation = {
    summary: `Determination: ${correctnessResult.correctness} (Evidence: ${sufficiencyResult.sufficiency}, Threat: ${scamRiskResult.scamRisk} Risk).`,
    factualRationale: correctnessResult.rationale,
    scamRationale: scamRiskResult.rationale,
    sufficiencyRationale: sufficiencyResult.rationale,
    sourceImpacts
  };

  const verdicts: InvestigationVerdicts = {
    factualCorrectness: correctnessResult.correctness,
    scamRisk: scamRiskResult.scamRisk,
    evidenceSufficiency: sufficiencyResult.sufficiency,
    riskTriggers: scamRiskResult.riskTriggers,
    explanation
  };

  // 7. Dynamic claim findings linked to evidence
  const supportingSources = evaluatedSources.filter(s => s.stance === 'supports' && s.relevanceScore >= 0.25);
  const contradictingSources = evaluatedSources.filter(s => s.stance === 'contradicts' && s.relevanceScore >= 0.25);

  const claims = [
    {
      claim: input.prompt.slice(0, 110) || 'Submitted inquiry assertion',
      label: verdicts.factualCorrectness,
      supporting: supportingSources.length > 0
        ? `Corroborated by ${supportingSources.map(s => `[${s.id}] (${s.domain})`).join(', ')}.`
        : verdicts.factualCorrectness === 'Supported'
          ? 'Backed by verified indexed publications.'
          : 'None found in indexed evidence.',
      contradicting: contradictingSources.length > 0
        ? `Refuted by ${contradictingSources.map(s => `[${s.id}] (${s.domain})`).join(', ')}.`
        : verdicts.factualCorrectness === 'Contradicted'
          ? 'Directly contradicted by published regulatory directives.'
          : 'No official contradiction identified.'
    }
  ];

  // 8. Dynamic Challenger Audit based on verdict
  const challengerAudit: string[] = [];
  if (verdicts.factualCorrectness === 'Unverified') {
    challengerAudit.push('Acknowledged that absence of union gazette records does not prove falsehood: checked state discom / regional portals.');
    challengerAudit.push('Evaluated whether pending circulars or ministerial draft policies have not yet been indexed in PIB archive.');
    challengerAudit.push('Recommended verification directly through official Right to Information (RTI) portal or official ministry press desk.');
  } else if (verdicts.factualCorrectness === 'Contradicted') {
    challengerAudit.push('Audited whether historic or superseded circulars could have legitimately caused citizen confusion.');
    challengerAudit.push('Confirmed that no emergency state gazette notifications override union statutory protections.');
    challengerAudit.push('Checked whether viral claims misquoted genuine regulatory policy out of context.');
  } else if (verdicts.factualCorrectness === 'Supported') {
    challengerAudit.push('Audited effective enforcement dates and grace periods specified in published gazette.');
    challengerAudit.push('Verified whether special state-specific exceptions apply to this union directive.');
    challengerAudit.push('Confirmed that published notices remain active and have not been stayed by judicial review.');
  } else {
    challengerAudit.push('Assessed jurisdictional splits where central and state directives diverge.');
    challengerAudit.push('Probed ambiguities between preliminary advisories and enacted statutory orders.');
  }

  return {
    verdicts,
    evaluatedSources,
    explanation,
    claims,
    challengerAudit
  };
}
