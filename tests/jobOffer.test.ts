import assert from 'node:assert/strict';
import test from 'node:test';
import { coordinateInvestigation } from '../lib/investigation/coordinator';
import { analyzeJobOffer, redactJobOfferPersonalData } from '../lib/investigation/jobOffer';
import { buildInitialAnswer, hasInitialAnswerHierarchy } from '../lib/investigation/initialAnswer';
import { InvestigationVerdicts } from '../lib/investigation/types';

const verdicts: InvestigationVerdicts = {
  factualCorrectness: 'Unverified',
  messageAuthenticity: 'Cannot authenticate',
  scamRisk: 'High',
  evidenceSufficiency: 'Insufficient',
  riskTriggers: ['Job Offer Payment Request'],
  verdictStatus: 'unverified',
  explanation: {
    summary: 'Job offer assessment.',
    factualRationale: 'The offer cannot be confirmed.',
    authenticityRationale: 'The recruiter cannot be authenticated.',
    scamRationale: 'The message requests payment.',
    sufficiencyRationale: 'Direct employer confirmation is unavailable.',
    sourceImpacts: [],
  },
};

test('classifies job offers and creates privacy-safe company/careers queries', () => {
  const plan = coordinateInvestigation(
    'Is this job offer real?',
    [{
      name: 'offer-letter.pdf',
      type: 'application/pdf',
      size: 10,
      extractedText: 'Employment offer from Acme Systems. Contact jane.doe@gmail.com or +91 98765 43210. Pay a registration fee.',
    }],
  );

  assert.equal(plan.taskType, 'job_offer');
  assert.ok(plan.queries.some(query => /Acme Systems official company careers/i.test(query)));
  assert.ok(plan.queries.every(query => !query.includes('jane.doe') && !query.includes('98765')));
});

test('separates offer warning signs from recruiter and offer authentication', () => {
  const analysis = analyzeJobOffer(
    'Job offer from Acme Systems. Email recruiter@gmail.com. Pay a training fee and send passport details.',
    [],
    { searchAttempted: true, searchCompleted: true, searchResultsFound: 0, snippetsAvailable: 0, pagesInspected: 0, pagesUnavailable: 0, citedSourceIds: [] },
  );

  assert.equal(analysis.paymentRequest, true);
  assert.equal(analysis.sensitiveDataRequest, true);
  assert.match(analysis.domainWarning || '', /does not establish affiliation/i);
  assert.equal(analysis.checks[1].status, 'completed');
  assert.equal(analysis.checks[2].status, 'not_completed');

  const answer = buildInitialAnswer({ assessment: verdicts as import('../lib/investigation/types').StructuredAssessment, sources: [], jobOfferAnalysis: analysis });
  assert.ok(hasInitialAnswerHierarchy(answer));
  assert.match(answer, /company or careers page would not.*prove/i);
  assert.match(answer, /Not completed — Recruiter affiliation and specific offer/i);
});

test('asks for the minimum missing employer detail and redacts attachment PII', () => {
  const analysis = analyzeJobOffer('Can you check this recruiter message?');
  assert.match(analysis.followUpQuestion || '', /What employer is named/i);

  const redacted = redactJobOfferPersonalData(
    'Dear Priya Sharma, email priya.sharma@example.com, phone +91 98765 43210, Passport No: A1234567.',
  );
  assert.ok(!redacted.includes('Priya Sharma'));
  assert.ok(!redacted.includes('priya.sharma'));
  assert.ok(!redacted.includes('98765'));
  assert.ok(!redacted.includes('A1234567'));
  assert.match(redacted, /\[redacted\]@example\.com/);
});
