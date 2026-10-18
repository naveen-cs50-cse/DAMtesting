import assert from 'node:assert/strict';
import test from 'node:test';
import { buildShareBriefing } from '../lib/investigation/shareBriefing';
import { Conversation, InvestigationMeta } from '../lib/investigation/types';

const meta: InvestigationMeta = {
  caseId: 'DAM-PRIVATE-123',
  taskType: 'scam_check',
  verdicts: {
    factualCorrectness: 'Unverified',
    messageAuthenticity: 'Cannot authenticate',
    scamRisk: 'High',
    evidenceSufficiency: 'Partial',
    riskTriggers: ['Sensitive Credential Request'],
    verdictStatus: 'unverified',
    explanation: {
      summary: 'Unverified message.',
      factualRationale: 'The public evidence does not confirm the sender claim.',
      authenticityRationale: 'Contact priya.sharma@example.com or +91 98765 43210 could not be authenticated.',
      scamRationale: 'The message requests a password and payment.',
      sufficiencyRationale: 'Only partial evidence was available.',
      sourceImpacts: [],
    },
  },
  claims: [],
  sources: [
    {
      id: 1,
      domain: 'example.gov',
      title: 'Official phishing warning',
      date: '2026-10-15',
      type: 'Search result',
      url: 'https://example.gov/advisory?candidate=Priya#private',
      passage: 'Do not share passwords.',
      stance: 'context',
      isCited: true,
    },
    {
      id: 2,
      domain: 'uncited.example',
      title: 'Uncited result',
      date: '2026-10-15',
      type: 'Search result',
      url: 'https://uncited.example/result',
      passage: 'Context only.',
      stance: 'context',
    },
  ],
  retrieval: {
    searchResultsFound: 2,
    snippetsAvailable: 2,
    pagesInspected: 0,
    pagesUnavailable: 0,
    citedSourceIds: [1],
  },
  challengerAudit: [],
  verdictExplanation: {
    summary: 'Unverified message.',
    factualRationale: 'The public evidence does not confirm the sender claim.',
    authenticityRationale: 'Contact priya.sharma@example.com or +91 98765 43210 could not be authenticated.',
    scamRationale: 'The message requests a password and payment.',
    sufficiencyRationale: 'Only partial evidence was available.',
    sourceImpacts: [],
  },
};

const conversation: Conversation = {
  id: 'conversation-private',
  title: 'Priya Sharma passport A1234567',
  caseId: 'DAM-PRIVATE-123',
  createdAt: '2026-10-17T08:00:00.000Z',
  turns: [
    {
      id: 'user-1',
      role: 'user',
      content: 'Private history with priya.sharma@example.com',
      attachments: [{ name: 'passport.pdf', type: 'application/pdf', size: 10, extractedText: 'Passport A1234567' }],
      createdAt: '2026-10-17T08:00:00.000Z',
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      fullText: 'Generated private answer that should not be copied wholesale.',
      createdAt: '2026-10-17T08:05:00.000Z',
      meta,
    },
  ],
};

test('builds an exact concise briefing from structured metadata only', () => {
  const payload = buildShareBriefing(conversation);
  assert.ok(payload);
  assert.match(payload.text, /Assessment/);
  assert.match(payload.text, /Key reasons/);
  assert.match(payload.text, /Supporting sources/);
  assert.match(payload.text, /Date checked: 2026-10-17/);
  assert.match(payload.text, /Material uncertainty:/);
  assert.ok((payload.text.match(/^-/gm) || []).length <= 4); // up to 3 reasons plus one source
});

test('excludes private inputs and redacts identifiers while retaining cited links', () => {
  const payload = buildShareBriefing(conversation)!;
  assert.ok(!payload.text.includes('passport.pdf'));
  assert.ok(!payload.text.includes('A1234567'));
  assert.ok(!payload.text.includes('priya.sharma'));
  assert.ok(!payload.text.includes('98765'));
  assert.ok(!payload.text.includes('conversation-private'));
  assert.ok(!payload.text.includes('DAM-PRIVATE-123'));
  assert.match(payload.text, /https:\/\/example\.gov\/advisory/);
  assert.ok(!payload.text.includes('candidate=Priya'));
  assert.ok(!payload.text.includes('uncited.example'));
  assert.ok(!payload.text.includes('?case='));
});

test('does not create a share payload before an investigation is complete', () => {
  const incomplete: Conversation = {
    ...conversation,
    turns: [{ ...conversation.turns[1], isLive: true }],
  };
  assert.equal(buildShareBriefing(incomplete), null);
});

test('does not present a processing failure as a shareable successful investigation', () => {
  const failed: Conversation = {
    ...conversation,
    turns: [{
      ...conversation.turns[1],
      isLive: false,
      meta: {
        ...meta,
        verdicts: undefined,
        assessment: undefined,
        assessmentError: 'The structured assessment was missing from the provider response.',
      },
    }],
  };

  assert.equal(buildShareBriefing(failed), null);
});
