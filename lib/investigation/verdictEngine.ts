import {
  EvidenceSufficiency,
  FactualCorrectness,
  IndexedSource,
  StructuredAssessment,
  MessageAuthenticity,
  ScamRisk,
  SourceImpact,
  TaskType,
  ThreatEntities,
  VerdictExplanation
} from './types';
import { getSourceAuthority } from './knowledge';
import { requireStructuredAssessment } from './assessment';
import {
  expandTokensWithCrossLingualAliases,
  getEntityAliases,
  getRelationAliases,
  parseIndicClaimStructure,
  separateClaimAndInstructions,
} from './multilingual';

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
  verdicts: StructuredAssessment;
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
    .replace(/[^\p{L}\p{M}\p{N}\s₹$]/gu, ' ')
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
  const cleanClaim = separateClaimAndInstructions(claim).factualClaim;
  const claimTokens = tokenize(cleanClaim);
  if (claimTokens.length === 0) return 0.5;

  const sourceContent = `${source.title} ${source.passage} ${source.domain}`.toLowerCase();
  const rawSourceTokens = tokenize(sourceContent);
  const sourceTokens = new Set(rawSourceTokens);
  const sourceStems = new Set(rawSourceTokens.map(stemToken));

  let matchedTokens = 0;
  for (const token of claimTokens) {
    const stem = stemToken(token);
    const aliases = expandTokensWithCrossLingualAliases([token]);
    const hasMatch =
      sourceTokens.has(token) ||
      sourceStems.has(stem) ||
      sourceContent.includes(token) ||
      sourceContent.includes(stem) ||
      aliases.some(alias => {
        const aLower = alias.toLowerCase();
        const aStem = stemToken(aLower);
        return sourceTokens.has(aLower) ||
          sourceStems.has(aStem) ||
          sourceContent.includes(aLower) ||
          rawSourceTokens.some(st => (st.length >= 4 && aLower.length >= 4 && (st.includes(aLower) || aLower.includes(st))));
      }) ||
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
  const keyEntities = claimTokens.filter(t => /\d+/.test(t) || t.length >= 3);
  let entityOverlap = 0;
  if (keyEntities.length > 0) {
    let matchedEntities = 0;
    for (const k of keyEntities) {
      const stem = stemToken(k);
      const aliases = expandTokensWithCrossLingualAliases([k]);
      if (
        sourceTokens.has(k) ||
        sourceStems.has(stem) ||
        sourceContent.includes(k) ||
        sourceContent.includes(stem) ||
        aliases.some(alias => {
          const aLower = alias.toLowerCase();
          const aStem = stemToken(aLower);
          return sourceTokens.has(aLower) || sourceStems.has(aStem) || sourceContent.includes(aLower);
        }) ||
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

export interface ParsedClaimStructure {
  raw: string;
  normalized: string;
  isNegated: boolean;
  isQuestion: boolean;
  subject?: string;
  relation?: string;
  scope?: string;
  qualifier?: string;
  subjectAliases?: string[];
  scopeAliases?: string[];
  relationAliases?: string[];
}

export function splitIntoSentences(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/(?<!\b[A-Za-z]\.|\b[A-Z][a-z]{1,2}\.|\b[A-Z]\.[A-Z]\.)(?<=[.!?।])\s+(?=[A-Z0-9"'\p{L}])|\n+/u)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export const FUNCTIONAL_ROLES = new Set([
  'capital',
  'national capital',
  'federal capital',
  'state capital',
  'seat of government',
  'president',
  'prime minister',
  'chief executive',
  'ceo',
  'currency',
  'official language',
  'headquarters',
  'राजधानी',
  'राष्ट्रीय राजधानी',
  'प्रधानमंत्री',
  'राष्ट्रपति',
  'मुद्रा',
  'मुख्यालय',
  'தலைநகரம்',
]);

function cleanEntity(str: string): string {
  return str.replace(/^(?:the|a|an)\s+/i, '').replace(/[?!.,।]+$/g, '').trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseClaimStructure(text: string): ParsedClaimStructure {
  const separated = separateClaimAndInstructions(text);
  const trimmed = separated.factualClaim;
  const isQuestion = separated.isQuestion || /^(?:is|are|was|were|did|does|do|can|could|has|have|had|will|would)\s+/i.test(trimmed);

  let cleaned = trimmed
    .replace(/^(?:fact[- ]check (?:whether|if)?|factcheck (?:whether|if)?|verify (?:whether|if)?|check (?:whether|if)?|is it true (?:that)?|please check (?:if|whether)?|can you check (?:if|whether)?)\s+/i, '')
    .replace(/[?!.।]+$/g, '')
    .trim();

  // Pattern A (Question inversion): e.g. "Is Sydney the capital of Australia"
  const qMatch = cleaned.match(/^(?:is|are|was|were)\s+([^,]+?)\s+(?:the\s+|a\s+|an\s+)?(?:(national|state|federal|official|regional|provincial)\s+)?([a-z]+(?:\s+[a-z]+)?)\s+(?:of|for|in)\s+([^,]+)$/i);
  if (qMatch) {
    const [, subj, qual, rel, scp] = qMatch;
    const isNeg = /\b(?:not|never|no longer)\b/i.test(cleaned);
    const cleanSubj = cleanEntity(subj);
    const cleanScp = cleanEntity(scp);
    return {
      raw: text,
      normalized: `${cleanSubj} is ${qual ? `${qual.trim()} ` : ''}${rel.trim()} of ${cleanScp}`,
      isNegated: isNeg,
      isQuestion,
      subject: cleanSubj,
      qualifier: qual?.trim().toLowerCase(),
      relation: rel.trim().toLowerCase(),
      scope: cleanScp,
      subjectAliases: getEntityAliases(cleanSubj),
      scopeAliases: getEntityAliases(cleanScp),
      relationAliases: getRelationAliases(rel),
    };
  }

  // Pattern B (Copula): e.g. "Canberra is the capital of Australia", "Sydney is not the capital of Australia"
  const copulaMatch = cleaned.match(/^([^,]+?)\s+(?:is|are|was|were|became|remains)\s+(not\s+|never\s+)?(?:the\s+|a\s+|an\s+)?(?:(national|state|federal|official|regional|provincial)\s+)?([a-z]+(?:\s+[a-z]+)?)\s+(?:of|for|in)\s+([^,]+)$/i);
  if (copulaMatch) {
    const [, subj, neg, qual, rel, scp] = copulaMatch;
    const cleanSubj = cleanEntity(subj);
    const cleanScp = cleanEntity(scp);
    return {
      raw: text,
      normalized: cleaned,
      isNegated: Boolean(neg),
      isQuestion,
      subject: cleanSubj,
      qualifier: qual?.trim().toLowerCase(),
      relation: rel.trim().toLowerCase(),
      scope: cleanScp,
      subjectAliases: getEntityAliases(cleanSubj),
      scopeAliases: getEntityAliases(cleanScp),
      relationAliases: getRelationAliases(rel),
    };
  }

  // Pattern C (Possessive): e.g. "Canberra is Australia's capital", "Sydney is New South Wales's capital"
  const possMatch = cleaned.match(/^([^,]+?)\s+(?:is|are|was|were)\s+(not\s+|never\s+)?([^,]+?)'s\s+(?:(national|state|federal|official|regional|provincial)\s+)?([a-z]+(?:\s+[a-z]+)?)$/i);
  if (possMatch) {
    const [, subj, neg, scp, qual, rel] = possMatch;
    const cleanSubj = cleanEntity(subj);
    const cleanScp = cleanEntity(scp);
    return {
      raw: text,
      normalized: cleaned,
      isNegated: Boolean(neg),
      isQuestion,
      subject: cleanSubj,
      scope: cleanScp,
      qualifier: qual?.trim().toLowerCase(),
      relation: rel.trim().toLowerCase(),
      subjectAliases: getEntityAliases(cleanSubj),
      scopeAliases: getEntityAliases(cleanScp),
      relationAliases: getRelationAliases(rel),
    };
  }

  // Pattern D (Inverted): e.g. "The capital of Australia is Canberra"
  const invMatch = cleaned.match(/^(?:the\s+)?(?:(national|state|federal|official|regional|provincial)\s+)?([a-z]+(?:\s+[a-z]+)?)\s+(?:of|for|in)\s+([^,]+?)\s+(?:is|are|was|were)\s+(not\s+|never\s+)?([^,]+)$/i);
  if (invMatch) {
    const [, qual, rel, scp, neg, subj] = invMatch;
    const cleanSubj = cleanEntity(subj);
    const cleanScp = cleanEntity(scp);
    return {
      raw: text,
      normalized: cleaned,
      isNegated: Boolean(neg),
      isQuestion,
      subject: cleanSubj,
      scope: cleanScp,
      qualifier: qual?.trim().toLowerCase(),
      relation: rel.trim().toLowerCase(),
      subjectAliases: getEntityAliases(cleanSubj),
      scopeAliases: getEntityAliases(cleanScp),
      relationAliases: getRelationAliases(rel),
    };
  }

  // Pattern E (Indic / Multilingual Grammar: Hindi / Tamil)
  const indicMatch = parseIndicClaimStructure(cleaned);
  if (indicMatch) {
    const cleanSubj = cleanEntity(indicMatch.subject);
    const cleanScp = cleanEntity(indicMatch.scope);
    return {
      raw: text,
      normalized: cleaned,
      isNegated: indicMatch.isNegated,
      isQuestion,
      subject: cleanSubj,
      scope: cleanScp,
      qualifier: indicMatch.qualifier?.trim().toLowerCase(),
      relation: indicMatch.relation.trim().toLowerCase(),
      subjectAliases: getEntityAliases(cleanSubj),
      scopeAliases: getEntityAliases(cleanScp),
      relationAliases: getRelationAliases(indicMatch.relation),
    };
  }

  const isNegated = /\b(?:no|not|never|cannot|can't|didn't|doesn't|isn't|wasn't|hasn't|haven't|नहीं|न|गलत|झूठ)\b/iu.test(cleaned);
  return {
    raw: text,
    normalized: cleaned,
    isNegated,
    isQuestion,
  };
}

/**
 * Analyzes semantic stance of source towards the user's assertion.
 * Evaluates entity, relation, scope, local negation, and misconception framing in context.
 */
export function detectSourceStance(
  claim: string,
  source: { title: string; passage: string; stance?: string }
): { stance: 'supports' | 'contradicts' | 'context'; confidence: number } {
  const combined = `${source.title} ${source.passage}`;
  const lower = combined.toLowerCase();

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
    if (lower.includes(pat)) refuteScore += 1;
  }

  let affirmScore = 0;
  for (const pat of affirmationPatterns) {
    if (lower.includes(pat)) affirmScore += 1;
  }

  if (source.stance === 'contradicts') {
    const conf = Math.min(1.0, 0.6 + 0.15 * refuteScore);
    return { stance: 'contradicts', confidence: parseFloat(conf.toFixed(2)) };
  }

  if (source.stance === 'supports') {
    const conf = Math.min(1.0, 0.6 + 0.15 * affirmScore);
    return { stance: 'supports', confidence: parseFloat(conf.toFixed(2)) };
  }

  const parsedClaim = parseClaimStructure(claim);
  const sentences = splitIntoSentences(`${source.title}. ${source.passage}`);

  let supportiveSentences = 0;
  let contradictorySentences = 0;
  let highestContradictConfidence = 0;
  let highestSupportConfidence = 0;

  for (const sentence of sentences) {
    const sTrim = sentence.trim();
    if (!sTrim) continue;

    // A. Interrogatives: Questions repeating or inquiring about a claim do NOT endorse it
    const isInterrogative = sTrim.endsWith('?') ||
      /^(?:is|are|was|were|did|does|do|can|could|will|would|why|how|what|where|who)\b/i.test(sTrim) ||
      /^(?:question|faq|inquiry)\s*:/i.test(sTrim);
    if (isInterrogative) {
      continue;
    }

    const sLower = sTrim.toLowerCase();

    // B. Misconception / Myth / Rumor / Correction Framing
    const misconceptionMatch = sTrim.match(/(?:common|popular|widespread|frequent)?\s*(?:misconception|myth|fallacy|mistake|error|rumor|rumour)\s*(?:is\s+that|that|is)?\s*([^.?!;]+)/i)
      || sTrim.match(/contrary to\s*(?:popular\s+belief|widespread\s+(?:claims?|belief)|the\s+misconception)\s*[,:]?\s*([^.?!;]+)/i)
      || sTrim.match(/(?:many|some|people|tourists|users)?\s*(?:mistakenly|wrongly|falsely|incorrectly)\s*(?:believe|think|assume|claim|state)\s*(?:that)?\s*([^.?!;]+)/i)
      || sTrim.match(/(?:claims?|reports?)\s+(?:that|suggesting\s+that)?\s*([^.?!;]+?)\s*(?:is|are|were|have been)\s+(?:false|fake|debunked|misleading|untrue|unfounded|baseless|incorrect)/i)
      || sTrim.match(/(?:it is (?:not true|false|incorrect) that)\s+([^.?!;]+)/i)
      || sTrim.match(/(?:fact[- ]check|factcheck|verdict)\s*[:|-]\s*([^.?!;]+?)\s*[:|-]\s*(?:false|fake|debunked|misleading|untrue)/i);

    if (misconceptionMatch) {
      const framedMisconception = misconceptionMatch[1].toLowerCase();
      if (parsedClaim.subject && parsedClaim.scope) {
        const hasSubj = framedMisconception.includes(parsedClaim.subject.toLowerCase());
        const hasScope = framedMisconception.includes(parsedClaim.scope.toLowerCase());
        const hasRel = parsedClaim.relation ? framedMisconception.includes(parsedClaim.relation.toLowerCase()) : true;
        if (hasSubj && (hasScope || hasRel)) {
          contradictorySentences++;
          highestContradictConfidence = Math.max(highestContradictConfidence, 0.92);
          continue;
        }
      } else {
        const claimTokens = tokenize(parsedClaim.normalized);
        const matchCount = claimTokens.filter(t => framedMisconception.includes(t)).length;
        if (matchCount / Math.max(1, claimTokens.length) >= 0.6) {
          contradictorySentences++;
          highestContradictConfidence = Math.max(highestContradictConfidence, 0.90);
          continue;
        }
      }
      // If a sentence describes or introduces a misconception/myth, do not allow its debunked clause
      // to fall through into subsequent blocks as an affirmative statement of fact.
      continue;
    }

    // C. Entity, Relationship, Scope & Functional Role Matching
    if (parsedClaim.subject && parsedClaim.relation && parsedClaim.scope) {
      const claimSubjLower = parsedClaim.subject.toLowerCase();
      const claimRelLower = parsedClaim.relation.toLowerCase();
      const claimScopeLower = parsedClaim.scope.toLowerCase();

      const scopeAliases = parsedClaim.scopeAliases || getEntityAliases(parsedClaim.scope);
      const relationAliases = parsedClaim.relationAliases || getRelationAliases(parsedClaim.relation);
      const subjectAliases = parsedClaim.subjectAliases || getEntityAliases(parsedClaim.subject);

      const mentionsScope = scopeAliases.some(alias => sLower.includes(alias.toLowerCase()));
      const mentionsRelation = relationAliases.some(alias => sLower.includes(alias.toLowerCase()));

      if (mentionsScope && mentionsRelation) {
        // Direct affirmation check across all subject, relation, and scope aliases
        let directAffirmed = false;
        for (const subjAlias of subjectAliases) {
          for (const relAlias of relationAliases) {
            for (const scpAlias of scopeAliases) {
              const escSubj = escapeRegex(subjAlias);
              const escRel = escapeRegex(relAlias);
              const escScp = escapeRegex(scpAlias);

              const engAffirm = new RegExp(`\\b${escSubj}\\s+(?:is|are|was|were|became|serves as|was selected as the site of|was chosen as the site of)\\s+(?:the\\s+|a\\s+|an\\s+)?(?:national\\s+|federal\\s+)?${escRel}\\s+(?:of|for|in)\\s+(?:the\\s+)?${escScp}\\b`, 'i');
              const engPossessive = new RegExp(`\\b${escScp}'s\\s+(?:national\\s+|federal\\s+)?${escRel}\\s+(?:is|are|was|were)\\s+${escSubj}\\b`, 'i');
              const engInverted = new RegExp(`(?:the\\s+)?(?:national\\s+|federal\\s+)?${escRel}\\s+(?:of|for|in)\\s+(?:the\\s+)?${escScp}\\s+(?:is|are|was|were)\\s+${escSubj}\\b`, 'i');

              const indicAffirm1 = new RegExp(`${escSubj}\\s+${escScp}\\s+(?:की|का|के)\\s+(?:(राष्ट्रीय|आधिकारिक)\\s+)?${escRel}\\s*(?:है|थी|था|हैं)?`, 'u');
              const indicAffirm2 = new RegExp(`${escScp}\\s+(?:की|का|के)\\s+(?:(राष्ट्रीय|आधिकारिक)\\s+)?${escRel}\\s+${escSubj}\\s*(?:है|थी|था|हैं)?`, 'u');

              if (engAffirm.test(sTrim) || engPossessive.test(sTrim) || engInverted.test(sTrim) || indicAffirm1.test(sTrim) || indicAffirm2.test(sTrim)) {
                directAffirmed = true;
                break;
              }
            }
            if (directAffirmed) break;
          }
          if (directAffirmed) break;
        }

        if (directAffirmed) {
          const localNeg = subjectAliases.some(alias => {
            const esc = escapeRegex(alias);
            return new RegExp(`\\b${esc}\\s+(?:is|are|was|were)\\s+(?:not|never)\\b|\\bnot\\s+${esc}\\b|\\bनहीं\\s+${esc}\\b|\\b${esc}\\s+नहीं\\b`, 'i').test(sTrim);
          });

          if (localNeg || parsedClaim.isNegated) {
            contradictorySentences++;
            highestContradictConfidence = Math.max(highestContradictConfidence, 0.90);
          } else {
            supportiveSentences++;
            highestSupportConfidence = Math.max(highestSupportConfidence, 0.92);
          }
          continue;
        }

        // Functional attribute resolution: If evidence asserts [OtherEntity] is the [Role] of [Scope]
        // (e.g. "Canberra is the capital of Australia" when checking "Sydney is the capital of Australia")
        const funcMatch = sTrim.match(/([A-Z0-9\p{L}][A-Za-z0-9\p{L}\s,.-]+?)\s+(?:is|are|was|were|became|serves as|has been)\s+(?:the\s+|a\s+|an\s+)?(?:national\s+|federal\s+|state\s+)?([a-z\p{L}]+(?:\s+[a-z\p{L}]+)?)\s+(?:of|for|in)\s+(?:the\s+)?([A-Za-z0-9\p{L}\s.-]+?)(?:[;,.]|\s+(?:serving|which|who|where|and|but)\b|$)/iu)
          || sTrim.match(/(?:the\s+)?(?:national\s+|federal\s+|state\s+)?([a-z\p{L}]+(?:\s+[a-z\p{L}]+)?)\s+(?:of|for|in)\s+(?:the\s+)?([A-Za-z0-9\p{L}\s.-]+?)\s+(?:is|are|was|were)\s+([A-Z0-9\p{L}][A-Za-z0-9\p{L}\s,.-]+?)(?:[;,.]|\s+(?:serving|which|who|where|and|but)\b|$)/iu)
          || sTrim.match(/([A-Z0-9\p{L}][A-Za-z0-9\p{L}\s,.-]+?)'s\s+(?:national\s+|federal\s+|state\s+)?([a-z\p{L}]+(?:\s+[a-z\p{L}]+)?)\s+(?:is|are|was|were)\s+([A-Z0-9\p{L}][A-Za-z0-9\p{L}\s,.-]+?)(?:[;,.]|$)/iu);

        let assertedSubj = '';
        let assertedRel = '';
        let assertedScope = '';

        if (funcMatch) {
          const matchRel1 = relationAliases.some(r => funcMatch[2].toLowerCase().includes(r.toLowerCase()));
          const matchScope1 = scopeAliases.some(sc => funcMatch[3].toLowerCase().includes(sc.toLowerCase()));
          const matchRel2 = relationAliases.some(r => funcMatch[2].toLowerCase().includes(r.toLowerCase()));
          const matchScope2 = scopeAliases.some(sc => funcMatch[1].toLowerCase().includes(sc.toLowerCase()));

          if (matchRel1 && matchScope1) {
            assertedSubj = funcMatch[1].trim();
            assertedRel = funcMatch[2].trim().toLowerCase();
            assertedScope = funcMatch[3].trim();
          } else if (matchRel2 && matchScope2) {
            assertedScope = funcMatch[1].trim();
            assertedRel = funcMatch[2].trim().toLowerCase();
            assertedSubj = funcMatch[3].trim();
          }
        }

        // Indic functional pattern check in Hindi: [Scope] की [Relation] [Subject] है
        if (!assertedSubj) {
          const indicFunc1 = sTrim.match(/([^,]+?)\s+(?:की|का|के)\s+([^\s,]+)\s+([^,]+?)\s*(?:है|था|थी|थे|हैं)?(?:[;,।.]|$)/u);
          if (indicFunc1) {
            const [, scp, rel, subj] = indicFunc1;
            if (relationAliases.some(r => rel.toLowerCase().includes(r.toLowerCase())) &&
                scopeAliases.some(sc => scp.toLowerCase().includes(sc.toLowerCase()))) {
              assertedSubj = subj.trim();
              assertedRel = rel.trim().toLowerCase();
              assertedScope = scp.trim();
            }
          }
        }

        if (assertedSubj) {
          const cleanAsserted = cleanEntity(assertedSubj).toLowerCase();
          const matchesClaimSubj = subjectAliases.some(alias => {
            const aLower = alias.toLowerCase();
            return cleanAsserted.includes(aLower) || aLower.includes(cleanAsserted);
          });

          if (!matchesClaimSubj) {
            if (FUNCTIONAL_ROLES.has(claimRelLower) || claimRelLower.includes('capital') || claimRelLower.includes('राजधानी') || claimRelLower.includes('தலைநகரம்')) {
              // Confirming alternate entity for a functional single-value role refutes the claim subject
              contradictorySentences++;
              highestContradictConfidence = Math.max(highestContradictConfidence, 0.88);
              continue;
            }
          } else {
            // Direct match from functional pattern
            const localNeg = subjectAliases.some(alias => {
              const esc = escapeRegex(alias);
              return new RegExp(`\\b${esc}\\s+(?:is|are|was|were)\\s+(?:not|never)\\b|\\bnot\\s+${esc}\\b|\\bनहीं\\s+${esc}\\b|\\b${esc}\\s+नहीं\\b`, 'i').test(sTrim);
            });
            if (localNeg || parsedClaim.isNegated) {
              contradictorySentences++;
              highestContradictConfidence = Math.max(highestContradictConfidence, 0.90);
            } else {
              supportiveSentences++;
              highestSupportConfidence = Math.max(highestSupportConfidence, 0.92);
            }
            continue;
          }
        }

        // Check for explicit contrastive negation: e.g. "not Sydney", "not in either of those state capitals"
        const contrastNegation = subjectAliases.some(alias =>
          new RegExp(`\\bnot\\s+(?:in\\s+)?(?:${escapeRegex(alias)}|either of those state capitals)\\b`, 'i').test(sTrim)
        );
        if (contrastNegation) {
          contradictorySentences++;
          highestContradictConfidence = Math.max(highestContradictConfidence, 0.92);
          continue;
        }
      }

      // Check for Scope Mismatch (e.g. State capital vs National capital):
      // e.g. "Sydney is the capital of New South Wales"
      const scopeBoundPattern = new RegExp(`\\b${escapeRegex(parsedClaim.subject)}\\s+(?:is|was)\\s+(?:the\\s+|a\\s+)?(?:state\\s+|provincial\\s+)?${escapeRegex(parsedClaim.relation)}\\s+(?:city\\s+)?(?:of|for|in)\\s+([^,.;]+)`, 'i');
      const scopeMatch = sTrim.match(scopeBoundPattern);
      if (scopeMatch) {
        const statedScope = scopeMatch[1].trim().toLowerCase();
        // If the claim was specifically about this stated scope:
        if (scopeAliases.some(sc => statedScope.includes(sc.toLowerCase()) || sc.toLowerCase().includes(statedScope))) {
          supportiveSentences++;
          highestSupportConfidence = Math.max(highestSupportConfidence, 0.90);
          continue;
        } else {
          continue;
        }
      }
    }

    // D. General local clause alignment and negation
    const claimTokens = tokenize(parsedClaim.normalized);
    const expandedClaimTokens = expandTokensWithCrossLingualAliases(claimTokens);
    const sentenceTokens = tokenize(sTrim);
    const matchedTokens = expandedClaimTokens.filter(t => sentenceTokens.includes(t));
    const tokenOverlap = matchedTokens.length / Math.max(1, claimTokens.length);

    if (tokenOverlap >= 0.72) {
      // Check local negation strictly within this sentence
      const localNegated = /\b(?:not|never|no longer|fake|false|untrue|debunked|misleading|refutes?|denied|नहीं|गलत|झूठ)\b/iu.test(sTrim);
      if (localNegated) {
        contradictorySentences++;
        highestContradictConfidence = Math.max(highestContradictConfidence, 0.78);
      } else {
        supportiveSentences++;
        highestSupportConfidence = Math.max(highestSupportConfidence, 0.75);
      }
    }
  }

  // Combine sentence assessments
  if (contradictorySentences > 0 && supportiveSentences === 0) {
    const conf = Math.max(highestContradictConfidence, 0.75);
    return { stance: 'contradicts', confidence: parseFloat(conf.toFixed(2)) };
  }

  if (supportiveSentences > 0 && contradictorySentences === 0) {
    const conf = Math.max(highestSupportConfidence, 0.75);
    return { stance: 'supports', confidence: parseFloat(conf.toFixed(2)) };
  }

  if (contradictorySentences > 0 && supportiveSentences > 0) {
    if (highestContradictConfidence >= 0.88 && highestSupportConfidence < 0.80) {
      return { stance: 'contradicts', confidence: parseFloat(highestContradictConfidence.toFixed(2)) };
    }
    if (highestSupportConfidence >= 0.88 && highestContradictConfidence < 0.80) {
      return { stance: 'supports', confidence: parseFloat(highestSupportConfidence.toFixed(2)) };
    }
  }

  if (refuteScore > affirmScore && refuteScore > 0) {
    const conf = Math.min(1.0, 0.6 + 0.15 * refuteScore);
    return { stance: 'contradicts', confidence: parseFloat(conf.toFixed(2)) };
  }

  if (affirmScore > refuteScore && affirmScore > 0) {
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
  allowFixturesAsEvidence = false,
  prompt = '',
): { sufficiency: EvidenceSufficiency; rationale: string; totalInfoWeight: number } {
  // Only sources passing the relevance threshold (>= 0.25) and not quarantined fixtures count towards sufficiency
  const activeSources = evaluatedSources.filter(s => {
    if (s.isFixture && !allowFixturesAsEvidence) return false;
    return s.relevanceScore >= 0.25;
  });

  if (activeSources.length === 0) {
    return {
      sufficiency: 'Insufficient',
      rationale: 'No relevant authoritative evidence appropriate to this question was identified.',
      totalInfoWeight: 0
    };
  }

  // Calculate cumulative information weight
  const totalInfoWeight = activeSources.reduce((acc, s) => {
    return acc + s.authorityScore * s.relevanceScore * s.recencyScore;
  }, 0);

  const hasPrimaryAuthoritativeSource = activeSources.some(
    s => s.authorityScore >= 0.8 && s.relevanceScore >= 0.55
  );
  const inspectedSources = activeSources.filter(source => source.contentOrigin === 'fetched_page');
  const snippetOnly = activeSources.length > 0 && inspectedSources.length === 0;
  const higherRiskOrTimeSensitive = /\b(today|current|currently|latest|now|this (?:week|month|year)|as of|price|rate|weather|election|outbreak|recall|deadline|legal advice|medical advice|investment|stock|crypto)\b/i.test(prompt);

  if (snippetOnly && higherRiskOrTimeSensitive) {
    return {
      sufficiency: 'Partial',
      rationale: 'Only search-result snippets were available. They provide relevant directional evidence, but page content was not successfully inspected and the claim is time-sensitive or higher-risk.',
      totalInfoWeight: parseFloat(totalInfoWeight.toFixed(3))
    };
  }

  if (totalInfoWeight >= 1.0 || hasPrimaryAuthoritativeSource) {
    return {
      sufficiency: 'Sufficient',
      rationale: snippetOnly
        ? `Found ${activeSources.length} directly relevant search snippet(s), including a verified publisher appropriate to this low-complexity factual claim; no result page was successfully inspected.`
        : `Found ${activeSources.length} relevant source(s), including inspected evidence with authority appropriate to this question.`,
      totalInfoWeight: parseFloat(totalInfoWeight.toFixed(3))
    };
  }

  if (totalInfoWeight >= 0.45 || activeSources.length >= 1) {
    return {
      sufficiency: 'Partial',
      rationale: snippetOnly
        ? `Found ${activeSources.length} relevant search snippet(s), but no result page was successfully inspected and the snippets do not fully resolve the question.`
        : `Found ${activeSources.length} relevant reference(s), but they do not fully resolve every part of the question.`,
      totalInfoWeight: parseFloat(totalInfoWeight.toFixed(3))
    };
  }

  return {
    sufficiency: 'Insufficient',
      rationale: 'The available references are too sparse or weakly relevant for a definitive determination.',
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
      rationale: 'The available evidence does not confirm or refute the assertion. This uncertainty is not evidence that the assertion is false.'
    };
  }

  const activeSources = evaluatedSources.filter(s => {
    if (s.isFixture && !allowFixturesAsEvidence) return false;
    return s.relevanceScore >= 0.25;
  });

  let supportWeight = 0;
  let contradictWeight = 0;

  for (const src of activeSources) {
    if (src.relevanceScore < 0.4) continue;
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
    const supportingSources = activeSources.filter(s => s.stance === 'supports' && s.relevanceScore >= 0.4);
    const contradictingSources = activeSources.filter(s => s.stance === 'contradicts' && s.relevanceScore >= 0.4);
    const maxSupportAuth = supportingSources.length > 0 ? Math.max(...supportingSources.map(s => s.authorityScore)) : 0;
    const maxContradictAuth = contradictingSources.length > 0 ? Math.max(...contradictingSources.map(s => s.authorityScore)) : 0;

    // Direct authoritative evidence should not be diluted by weak/secondary sources into Mixed:
    const isDirectAuthorityImbalance =
      (maxContradictAuth >= 0.85 && maxSupportAuth < 0.70) ||
      (maxSupportAuth >= 0.85 && maxContradictAuth < 0.70);

    const agreementRatio = Math.abs(supportWeight - contradictWeight) / totalDirectionalWeight;
    if (!isDirectAuthorityImbalance && agreementRatio < 0.40) {
      return {
        correctness: 'Mixed',
        rationale: 'Relevant authoritative sources conflict, so neither the supporting nor contradicting account can be stated as conclusive.'
      };
    }
  }

  if (contradictWeight > supportWeight && contradictWeight >= 0.35) {
    return {
      correctness: 'Contradicted',
      rationale: 'Relevant authoritative evidence directly contradicts the assertion.'
    };
  }

  if (supportWeight > contradictWeight && supportWeight >= 0.35) {
    return {
      correctness: 'Supported',
      rationale: 'Relevant authoritative evidence supports the assertion.'
    };
  }

  return {
    correctness: 'Unverified',
    rationale: 'The directional evidence is not strong enough to confirm or contradict the assertion.'
  };
}

function requestsSensitiveCredentials(prompt: string): boolean {
  return /\b(cvv|otp|one[ -]?time password|password|passcode|upi pin|card details|debit card|credit card|banking credentials|bank account details|passport|aadhaar|aadhar|pan card|social security|ssn|routing number|login credentials?)\b/i.test(prompt);
}

function isMessageAuthenticityQuestion(input: VerdictEngineInput): boolean {
  return input.taskType === 'scam_check' || input.taskType === 'job_offer' ||
    /\b(message|sms|email|whatsapp|sender|caller|notification|notice|refund|account suspended|account blocked)\b/i.test(input.prompt);
}

export function evaluateMessageAuthenticity(input: VerdictEngineInput): {
  authenticity: MessageAuthenticity;
  rationale: string;
} {
  if (!isMessageAuthenticityQuestion(input)) {
    return {
      authenticity: 'Not applicable',
      rationale: 'This inquiry does not provide a specific sender or message to authenticate.'
    };
  }

  const hasDirectTechnicalFailure = Boolean(
    input.forensics?.urls?.some(url => url.status === 'critical') ||
    input.forensics?.senders?.some(sender => !sender.isRegisteredDLT) ||
    input.urlAnalysis?.domainRisk.riskLevel === 'High' ||
    input.documentAnalysis?.anomalies?.some(anomaly => anomaly.type === 'unofficial_domain')
  );

  if (hasDirectTechnicalFailure) {
    return {
      authenticity: 'Not authenticated',
      rationale: 'The submitted communication fails a direct sender, domain, or document authenticity check.'
    };
  }

  return {
    authenticity: 'Cannot authenticate',
    rationale: 'The specific sender and transaction cannot be authenticated from the submitted text alone.'
  };
}

/**
 * Evaluates Scam Risk independently from Factual Correctness.
 * NEVER defaults an unknown claim to 'High Risk'.
 */
export function evaluateScamRisk(
  input: VerdictEngineInput,
  _correctness: FactualCorrectness,
  evaluatedSources: EvaluatedSource[] = []
): { scamRisk: ScamRisk; riskTriggers: string[]; rationale: string } {
  const { prompt, threatEntities, forensics, manipulation, statutes } = input;
  const lower = prompt.toLowerCase();
  const riskTriggers: string[] = [];
  const hasCredentialRequest = requestsSensitiveCredentials(prompt);
  const hasJobPaymentRequest = input.taskType === 'job_offer' && /\b(registration fee|application fee|processing fee|training fee|security deposit|background check fee|equipment (?:fee|purchase|payment)|pay(?:ment)? (?:first|upfront|to proceed)|send (?:money|funds)|wire transfer|gift cards?|cryptocurrency|crypto payment)\b/i.test(prompt);
  const hasPublicRecruiterDomain = input.taskType === 'job_offer' && /@[a-z0-9.-]*(?:gmail|googlemail|outlook|hotmail|yahoo|protonmail|proton|icloud)\.[a-z]{2,}/i.test(prompt);
  const claimsAuthority = /\b(income tax|tax department|bank|rbi|government|police|cbi|trai|customs)\b/i.test(prompt);

  if (hasCredentialRequest) {
    riskTriggers.push('Sensitive Credential / Banking Detail Request');
  }

  if (hasJobPaymentRequest) {
    riskTriggers.push('Job Offer Payment Request');
  }

  if (hasPublicRecruiterDomain) {
    riskTriggers.push('Recruiter Uses a Public Email Domain');
  }

  if (hasCredentialRequest && claimsAuthority) {
    riskTriggers.push('Authority Impersonation With Credential Request');
  }

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
    (hasCredentialRequest && claimsAuthority) ||
    (input.taskType === 'job_offer' && hasCredentialRequest && hasJobPaymentRequest) ||
    (hasPersonalPhone && (hasDisconnectionThreat || hasDigitalArrest)) ||
    hasDigitalArrest ||
    manipIndex >= 80 ||
    riskTriggers.length >= 3
  ) {
    return {
      scamRisk: 'High',
      riskTriggers,
      rationale: (() => {
        const warningSources = evaluatedSources.filter(source =>
          source.relevanceScore >= 0.25 &&
          /\b(cvv|otp|password|bank(?:ing)? details|card details|phishing|scam)\b/i.test(`${source.title} ${source.passage}`)
        );
        const citations = warningSources.map(source => `[${source.id}]`).join(', ');
        return `The message contains high-risk phishing indicators: ${riskTriggers.join(', ')}.${citations ? ` Relevant warnings are documented in ${citations}.` : ''}`;
      })()
    };
  }

  // Medium Risk: suspicious message elements without a direct high-risk attack vector.
  if (
    hasPersonalPhone ||
    manipIndex >= 60 ||
    riskTriggers.length >= 1
  ) {
    return {
      scamRisk: 'Medium',
      riskTriggers,
      rationale: `The message contains warning signs that warrant caution: ${riskTriggers.join(', ')}.`
    };
  }

  if (!isMessageAuthenticityQuestion(input)) {
    return {
      scamRisk: 'Not applicable',
      riskTriggers: [],
      rationale: 'Scam-risk assessment is not applicable to this factual question.'
    };
  }

  // Low Risk applies only when a submitted communication was actually assessed.
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
  const sufficiencyResult = evaluateEvidenceSufficiency(evaluatedSources, allowFixtures, input.prompt);

  // 3. Derive Factual Correctness
  let correctnessResult = evaluateFactualCorrectness(
    sufficiencyResult.sufficiency,
    evaluatedSources,
    allowFixtures
  );

  // 4. Assess the specific message independently from its factual assertions.
  const authenticityResult = evaluateMessageAuthenticity(input);

  // Requests for private credentials can be identified as suspicious without claiming
  // that a particular sender or personal transaction has been disproved.
  if (requestsSensitiveCredentials(input.prompt) && authenticityResult.authenticity === 'Cannot authenticate') {
    correctnessResult = {
      correctness: 'Unverified',
      rationale: 'The specific refund, account, or sender claim cannot be confirmed from public evidence. This does not negate the separately supported phishing warning signs.'
    };
  }

  // 5. Derive Scam Risk independently from factual support and authenticity.
  const scamRiskResult = evaluateScamRisk(input, correctnessResult.correctness, evaluatedSources);

  // 6. Build structured source impacts
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

  // 7. Build overall explanation
  const explanation: VerdictExplanation = {
    summary: `Factual support: ${correctnessResult.correctness}. Message authenticity: ${authenticityResult.authenticity}. Scam indicators: ${scamRiskResult.scamRisk === 'Not applicable' ? 'Not applicable' : `${scamRiskResult.scamRisk} risk`}. Evidence: ${sufficiencyResult.sufficiency}.`,
    factualRationale: correctnessResult.rationale,
    authenticityRationale: authenticityResult.rationale,
    scamRationale: scamRiskResult.rationale,
    sufficiencyRationale: sufficiencyResult.rationale,
    sourceImpacts
  };

  const verdicts = requireStructuredAssessment({
    factualCorrectness: correctnessResult.correctness,
    messageAuthenticity: authenticityResult.authenticity,
    scamRisk: scamRiskResult.scamRisk,
    evidenceSufficiency: sufficiencyResult.sufficiency,
    riskTriggers: scamRiskResult.riskTriggers,
    explanation,
    verdictStatus: correctnessResult.correctness === 'Supported'
      ? 'right'
      : correctnessResult.correctness === 'Contradicted'
        ? 'false'
        : 'unverified'
  });

  // 7. Dynamic claim findings linked to evidence
  const supportingSources = evaluatedSources.filter(s => s.stance === 'supports' && s.relevanceScore >= 0.4);
  const contradictingSources = evaluatedSources.filter(s => s.stance === 'contradicts' && s.relevanceScore >= 0.4);

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
    challengerAudit.push('Did not treat missing evidence as proof that the submitted assertion is false.');
    if (verdicts.messageAuthenticity !== 'Not applicable' || verdicts.scamRisk !== 'Not applicable') {
      challengerAudit.push('Separated the sender-specific claim from independently observable scam indicators.');
    }
  } else if (verdicts.factualCorrectness === 'Contradicted') {
    challengerAudit.push('Compared relevant supporting and contradicting sources before assigning a contradiction.');
    challengerAudit.push('Kept contextual sources from being counted as direct refutation.');
  } else if (verdicts.factualCorrectness === 'Supported') {
    challengerAudit.push('Required relevant affirmative evidence rather than inferring support from the absence of contradiction.');
    challengerAudit.push('Kept contextual sources from being counted as direct support.');
  } else {
    challengerAudit.push('Reported the source disagreement instead of selecting one side without sufficient basis.');
  }

  return {
    verdicts,
    evaluatedSources,
    explanation,
    claims,
    challengerAudit
  };
}
