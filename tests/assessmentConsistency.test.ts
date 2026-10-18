import assert from 'node:assert/strict';
import test from 'node:test';
import { getAssessment, getQueryVerdictStatus, requireStructuredAssessment } from '../lib/investigation/assessment';
import { buildInitialAnswer } from '../lib/investigation/initialAnswer';
import { buildShareBriefing } from '../lib/investigation/shareBriefing';
import { Conversation, FactualCorrectness, InvestigationMeta, ScamRisk } from '../lib/investigation/types';

function createCase(factualCorrectness: FactualCorrectness, scamRisk: ScamRisk, sufficiency: 'Sufficient' | 'Partial' | 'Insufficient') {
  const assessment = requireStructuredAssessment({
    factualCorrectness,
    messageAuthenticity: scamRisk === 'Not applicable' ? 'Not applicable' : 'Cannot authenticate',
    scamRisk,
    evidenceSufficiency: sufficiency,
    riskTriggers: scamRisk === 'High' ? ['Sensitive Credential / Banking Detail Request'] : [],
    explanation: {
      summary: 'Canonical structured result.',
      factualRationale: factualCorrectness === 'Supported'
        ? 'Relevant evidence supports the claim.'
        : factualCorrectness === 'Contradicted'
          ? 'Relevant evidence contradicts the claim.'
          : 'The available evidence does not resolve the claim.',
      authenticityRationale: scamRisk === 'Not applicable' ? 'Not applicable.' : 'The sender cannot be authenticated.',
      scamRationale: scamRisk === 'Not applicable' ? 'Not applicable.' : 'The message requests sensitive information.',
      sufficiencyRationale: `Evidence is ${sufficiency.toLowerCase()}.`,
      sourceImpacts: [],
    },
  });
  const meta: InvestigationMeta = {
    caseId: `case-${factualCorrectness}`,
    taskType: scamRisk === 'Not applicable' ? 'verification' : 'scam_check',
    verdicts: assessment,
    sources: [],
    retrieval: { searchResultsFound: 0, snippetsAvailable: 0, pagesInspected: 0, pagesUnavailable: 0, citedSourceIds: [] },
  };
  const answer = buildInitialAnswer({ assessment, sources: [] });
  const conversation: Conversation = {
    id: meta.caseId,
    caseId: meta.caseId,
    title: 'Consistency case',
    createdAt: '2026-10-18T00:00:00.000Z',
    turns: [{ id: 'answer', role: 'assistant', fullText: answer, createdAt: '2026-10-18T00:00:00.000Z', meta }],
  };
  return { assessment, meta, answer, share: buildShareBriefing(conversation)! };
}

test('supported, contradicted, insufficient, and suspicious cases stay consistent across surfaces', () => {
  const cases = [
    { value: createCase('Supported', 'Not applicable', 'Sufficient'), status: 'right', phrase: /claim is supported/i, shared: /support is supported/i },
    { value: createCase('Contradicted', 'Not applicable', 'Sufficient'), status: 'false', phrase: /claim is contradicted/i, shared: /support is contradicted/i },
    { value: createCase('Unverified', 'Not applicable', 'Insufficient'), status: 'unverified', phrase: /remains unverified/i, shared: /support is unverified/i },
    { value: createCase('Unverified', 'High', 'Partial'), status: 'unverified', phrase: /remains unverified/i, shared: /support is unverified/i },
  ] as const;

  for (const item of cases) {
    assert.equal(getQueryVerdictStatus(item.value.meta), item.status);
    assert.match(item.value.answer, item.phrase);
    assert.match(item.value.share.text, item.shared);
    assert.equal(getAssessment(item.value.meta).ok, true);
  }
  assert.match(cases[3].value.answer, /high-risk scam warning signs/i);
  assert.match(cases[3].value.share.text, /high risk/i);
  assert.doesNotMatch(cases[0].value.answer, /sender|scam/i);
});

test('malformed assessments do not silently become unverified or low risk', () => {
  const meta = {
    caseId: 'malformed',
    taskType: 'verification',
    verdicts: { factualCorrectness: 'maybe', scamRisk: 'Low' },
  } as unknown as InvestigationMeta;
  assert.equal(getQueryVerdictStatus(meta), null);
  const validation = getAssessment(meta);
  assert.equal(validation.ok, false);
});
