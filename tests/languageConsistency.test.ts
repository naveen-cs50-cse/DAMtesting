import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInitialAnswer, hasInitialAnswerHierarchy } from '../lib/investigation/initialAnswer';
import { coordinateInvestigation } from '../lib/investigation/coordinator';
import { separateClaimAndInstructions } from '../lib/investigation/multilingual';
import { localizeAssessmentForDisplay, processingFailureMessage, resolveResponseLanguage } from '../lib/investigation/localization';
import { buildShareBriefing } from '../lib/investigation/shareBriefing';
import { calculateSourceRelevance, detectSourceStance } from '../lib/investigation/verdictEngine';
import { verifyAndChallenge } from '../lib/investigation/verifier';
import type { Conversation, IndexedSource, StructuredAssessment } from '../lib/investigation/types';

const assessment: StructuredAssessment = {
  factualCorrectness: 'Supported', messageAuthenticity: 'Not applicable', scamRisk: 'Not applicable',
  evidenceSufficiency: 'Sufficient', riskTriggers: [], verdictStatus: 'right',
  explanation: { summary: 'Supported.', factualRationale: 'The source directly supports the claim.', scamRationale: '', sufficiencyRationale: 'Direct evidence.', sourceImpacts: [] },
};
const source: IndexedSource = { id: 7, domain: 'example.gov.au', title: 'Parliament of Australia — Canberra', date: '2026-10-18', type: 'Government', url: 'https://example.gov.au/canberra', passage: 'Canberra is the capital of Australia.', stance: 'supports', relevanceScore: 1, impactRole: 'primary_support', isCited: true };

test('resolves selector language and auto-detects supported scripts', () => {
  assert.equal(resolveResponseLanguage('hi', 'Answer in English'), 'hi');
  assert.equal(resolveResponseLanguage('auto', 'कैनबरा ऑस्ट्रेलिया की राजधानी है'), 'hi');
  assert.equal(resolveResponseLanguage('auto', 'கான்பெரா ஆஸ்திரேலியாவின் தலைநகரம்'), 'ta');
  assert.equal(resolveResponseLanguage('auto', 'Canberra is the capital of Australia'), 'en');
});

for (const [language, headings] of [['en', ['Assessment', 'Main reasons', 'Next steps']], ['hi', ['आकलन', 'मुख्य कारण', 'अगले कदम']], ['ta', ['மதிப்பீடு', 'முக்கிய காரணங்கள்', 'அடுத்த படிகள்']]] as const) {
  test(`keeps the ${language} answer hierarchy and working citation`, () => {
    const localized = localizeAssessmentForDisplay(assessment, language);
    const answer = buildInitialAnswer({ assessment: localized, sources: [source], language });
    assert.equal(localized.factualCorrectness, 'Supported');
    assert.equal(localized.verdictStatus, 'right');
    assert.equal(hasInitialAnswerHierarchy(answer), true);
    headings.forEach(heading => assert.match(answer, new RegExp(`### ${heading}`)));
    assert.match(answer, /\[7\]/);
  });
}

test('localizes failures and share text without changing citation identity or source title', () => {
  const localized = localizeAssessmentForDisplay(assessment, 'hi');
  const conversation: Conversation = { id: 'c', title: 'claim', caseId: 'case', createdAt: '2026-10-18T00:00:00.000Z', turns: [{ id: 'a', role: 'assistant', createdAt: '2026-10-18T00:00:00.000Z', language: 'hi', fullText: 'answer [7]', meta: { caseId: 'case', taskType: 'verification', language: 'hi', verdicts: localized, sources: [source], retrieval: { searchResultsFound: 1, snippetsAvailable: 0, pagesInspected: 1, pagesUnavailable: 0, citedSourceIds: [7] } } }] };
  const shared = buildShareBriefing(conversation)!;
  assert.match(processingFailureMessage('hi'), /### आकलन/);
  assert.match(shared.text, /जाँच की तारीख/);
  assert.match(shared.text, /\[7\] Parliament of Australia — Canberra: https:\/\/example\.gov\.au\/canberra/);
});

test('separates factual claim from language instructions and interrogative phrasing', () => {
  const test1 = separateClaimAndInstructions('भारत की राजधानी नई दिल्ली है। क्या यह सही है?');
  assert.equal(test1.factualClaim, 'भारत की राजधानी नई दिल्ली है');
  assert.equal(test1.isQuestion, true);

  const test2 = separateClaimAndInstructions('New Delhi is the capital of India. Please answer in Hindi');
  assert.equal(test2.factualClaim, 'New Delhi is the capital of India');
  assert.equal(test2.requestedLanguage, 'hi');

  const test3 = separateClaimAndInstructions('सिडनी ऑस्ट्रेलिया की राजधानी है। कृपया हिंदी में उत्तर दें');
  assert.equal(test3.factualClaim, 'सिडनी ऑस्ट्रेलिया की राजधानी है');
  assert.equal(test3.requestedLanguage, 'hi');
});

test('generates clean native and authoritative cross-lingual search queries', () => {
  const plan = coordinateInvestigation('भारत की राजधानी नई दिल्ली है। क्या यह सही है?');
  assert.equal(plan.taskType, 'verification');
  // Check that queries contain native and English search queries
  assert.ok(plan.queries.some(q => q.includes('भारत की राजधानी नई दिल्ली')));
  assert.ok(plan.queries.some(q => /new delhi/i.test(q) && /capital/i.test(q) && /india/i.test(q)));
  // Assertions should not contain the interrogative suffix
  assert.equal(plan.assertions[0], 'भारत की राजधानी नई दिल्ली है');
});

test('multilingual verification: Hindi prompt with authoritative English evidence produces Supported with citations', () => {
  const englishEvidence: IndexedSource = {
    id: 1,
    domain: 'india.gov.in',
    title: 'National Portal of India — New Delhi',
    date: '2026-10-18',
    type: 'Government',
    url: 'https://india.gov.in/my-india/my-national-symbols',
    passage: 'New Delhi is the capital of India and the seat of all three branches of the Government of India.',
    stance: 'context',
    isFixture: false,
    contentOrigin: 'fetched_page',
    inspectionStatus: 'inspected',
    isCited: false,
  };

  const hindiPrompt = 'भारत की राजधानी नई दिल्ली है। क्या यह सही है?';
  const relevance = calculateSourceRelevance(hindiPrompt, englishEvidence);
  assert.ok(relevance >= 0.75, `Expected cross-lingual relevance >= 0.75, got ${relevance}`);

  const stanceEval = detectSourceStance(hindiPrompt, englishEvidence);
  assert.equal(stanceEval.stance, 'supports');

  const output = verifyAndChallenge(hindiPrompt, 'verification', [englishEvidence]);
  assert.equal(output.verdicts.factualCorrectness, 'Supported');
  assert.equal(output.verdicts.verdictStatus, 'right');
  assert.equal(output.verdicts.evidenceSufficiency, 'Sufficient');

  const displayAssessment = localizeAssessmentForDisplay(output.verdicts, 'hi');
  const answer = buildInitialAnswer({ assessment: displayAssessment, sources: output.evaluatedSources || [], language: 'hi' });
  assert.match(answer, /### आकलन/);
  assert.match(answer, /उपलब्ध साक्ष्य तथ्यात्मक दावे का समर्थन करते हैं/);
  assert.match(answer, /\[1\]/);
});

test('cross-lingual consistency: equivalent English and Hindi claims produce consistent assessments under identical evidence', () => {
  const evidence: IndexedSource = {
    id: 1,
    domain: 'india.gov.in',
    title: 'National Portal of India',
    date: '2026-10-18',
    type: 'Government',
    url: 'https://india.gov.in/profile',
    passage: 'New Delhi is the capital of India and the principal seat of government.',
    stance: 'context',
    isFixture: false,
    contentOrigin: 'fetched_page',
    inspectionStatus: 'inspected',
    isCited: false,
  };

  const englishPrompt = 'New Delhi is the capital of India.';
  const hindiPrompt = 'भारत की राजधानी नई दिल्ली है।';

  const outputEn = verifyAndChallenge(englishPrompt, 'verification', [evidence]);
  const outputHi = verifyAndChallenge(hindiPrompt, 'verification', [evidence]);

  assert.equal(outputHi.verdicts.factualCorrectness, outputEn.verdicts.factualCorrectness);
  assert.equal(outputHi.verdicts.verdictStatus, outputEn.verdicts.verdictStatus);
  assert.equal(outputHi.verdicts.evidenceSufficiency, outputEn.verdicts.evidenceSufficiency);
  assert.equal(outputHi.verdicts.factualCorrectness, 'Supported');
  assert.equal(outputHi.verdicts.verdictStatus, 'right');
});

test('evidence-driven contradiction: false claim in Hindi refuted by authoritative evidence without hardcoded bias', () => {
  const canberraEvidence: IndexedSource = {
    id: 1,
    domain: 'aph.gov.au',
    title: 'Parliament of Australia — Canberra',
    date: '2026-10-18',
    type: 'Government',
    url: 'https://aph.gov.au/About_Parliament/Canberra',
    passage: 'Canberra is the capital of Australia, serving as the seat of government while Sydney is the capital of New South Wales.',
    stance: 'context',
    isFixture: false,
    contentOrigin: 'fetched_page',
    inspectionStatus: 'inspected',
    isCited: false,
  };

  // False claim: "Sydney is the capital of Australia" in Hindi
  const falseHindiPrompt = 'सिडनी ऑस्ट्रेलिया की राजधानी है';
  const stanceEval = detectSourceStance(falseHindiPrompt, canberraEvidence);
  assert.equal(stanceEval.stance, 'contradicts');

  const output = verifyAndChallenge(falseHindiPrompt, 'verification', [canberraEvidence]);
  assert.equal(output.verdicts.factualCorrectness, 'Contradicted');
  assert.equal(output.verdicts.verdictStatus, 'false');

  const displayAssessment = localizeAssessmentForDisplay(output.verdicts, 'hi');
  const answer = buildInitialAnswer({ assessment: displayAssessment, sources: output.evaluatedSources || [], language: 'hi' });
  assert.match(answer, /उपलब्ध साक्ष्य तथ्यात्मक दावे का खंडन करते हैं/);
  assert.match(answer, /\[1\]/);
});

test('localizes specific evidence limitations when only search snippets are available', () => {
  const snippetAssessment: StructuredAssessment = {
    factualCorrectness: 'Supported',
    messageAuthenticity: 'Not applicable',
    scamRisk: 'Not applicable',
    evidenceSufficiency: 'Partial',
    verdictStatus: 'right',
    riskTriggers: [],
    explanation: {
      summary: 'Supported with partial evidence.',
      factualRationale: 'Sources corroborate the statement.',
      scamRationale: '',
      sufficiencyRationale: 'Only search-result snippets were available; no result page was successfully inspected.',
      sourceImpacts: [],
    },
  };

  const localizedHi = localizeAssessmentForDisplay(snippetAssessment, 'hi');
  assert.match(localizedHi.explanation?.sufficiencyRationale || '', /केवल खोज परिणाम स्निपेट उपलब्ध थे/);
});
