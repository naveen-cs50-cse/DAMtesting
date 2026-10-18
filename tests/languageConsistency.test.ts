import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInitialAnswer, hasInitialAnswerHierarchy } from '../lib/investigation/initialAnswer';
import { localizeAssessmentForDisplay, processingFailureMessage, resolveResponseLanguage } from '../lib/investigation/localization';
import { buildShareBriefing } from '../lib/investigation/shareBriefing';
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
