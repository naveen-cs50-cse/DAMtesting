import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAnswerEvidenceSet,
  evidenceDomId,
  getAnswerEvidenceSet,
  resolveCitation,
} from '../lib/investigation/evidenceIsolation';
import { Conversation, IndexedSource, InvestigationMeta } from '../lib/investigation/types';

function source(id: number, title: string, url: string, cited = false): IndexedSource {
  return {
    id,
    domain: new URL(url).hostname,
    title,
    date: '2026-10-18',
    type: 'Government',
    url,
    passage: `${title} source passage.`,
    stance: 'supports',
    isCited: cited,
  };
}

function meta(sources: IndexedSource[], citedSourceIds: number[]): InvestigationMeta {
  return {
    caseId: 'DAM-CAPITALS',
    taskType: 'verification',
    sources,
    retrieval: {
      searchResultsFound: sources.length,
      snippetsAvailable: sources.length,
      pagesInspected: 0,
      pagesUnavailable: 0,
      citedSourceIds,
    },
  };
}

function capitalsConversation(): Conversation {
  const canberraMeta = meta([
    source(5, 'Canberra is Australia’s capital', 'https://australia.example.gov/canberra', true),
    source(6, 'Australian geography background', 'https://australia.example.gov/geography'),
  ], [5]);
  const delhiMeta = meta([
    source(5, 'New Delhi is India’s capital', 'https://india.example.gov/new-delhi', true),
  ], [5]);
  return {
    id: 'investigation-capitals',
    title: 'Capital questions',
    caseId: 'DAM-CAPITALS',
    createdAt: '2026-10-18T00:00:00.000Z',
    turns: [
      { id: 'user-canberra', role: 'user', content: 'Canberra is the capital of Australia.', createdAt: '2026-10-18T00:00:00.000Z' },
      {
        id: 'answer-canberra',
        role: 'assistant',
        fullText: 'यह दावा समर्थित है [5].',
        createdAt: '2026-10-18T00:00:01.000Z',
        meta: canberraMeta,
        evidenceSet: buildAnswerEvidenceSet('investigation-capitals', 'answer-canberra', canberraMeta, 'यह दावा समर्थित है [5].'),
      },
      { id: 'user-delhi', role: 'user', content: 'New Delhi is the capital of India.', createdAt: '2026-10-18T00:00:02.000Z' },
      {
        id: 'answer-delhi',
        role: 'assistant',
        fullText: 'The claim is supported [5].',
        createdAt: '2026-10-18T00:00:03.000Z',
        meta: delhiMeta,
        evidenceSet: buildAnswerEvidenceSet('investigation-capitals', 'answer-delhi', delhiMeta, 'The claim is supported [5].'),
      },
    ],
  };
}

test('isolates identical citation numbers by investigation and answer ID', () => {
  const conversation = capitalsConversation();
  const canberra = resolveCitation(conversation, {
    investigationId: conversation.id,
    answerId: 'answer-canberra',
    evidenceId: 5,
  });
  const delhi = resolveCitation(conversation, {
    investigationId: conversation.id,
    answerId: 'answer-delhi',
    evidenceId: 5,
  });

  assert.equal(canberra.ok && canberra.source.url, 'https://australia.example.gov/canberra');
  assert.equal(delhi.ok && delhi.source.url, 'https://india.example.gov/new-delhi');
  assert.notEqual(
    evidenceDomId({ investigationId: conversation.id, answerId: 'answer-canberra', evidenceId: 5 }),
    evidenceDomId({ investigationId: conversation.id, answerId: 'answer-delhi', evidenceId: 5 }),
  );
  assert.notEqual(
    evidenceDomId({ investigationId: conversation.id, answerId: 'answer:canberra', evidenceId: 5 }),
    evidenceDomId({ investigationId: conversation.id, answerId: 'answer-canberra', evidenceId: 5 }),
  );
});

test('preserves scoped evidence and non-English citations after JSON reload', () => {
  const restored = JSON.parse(JSON.stringify(capitalsConversation())) as Conversation;
  const result = resolveCitation(restored, {
    investigationId: restored.id,
    answerId: 'answer-canberra',
    evidenceId: 5,
  });
  assert.match(restored.turns[1].fullText || '', /\[5\]/);
  assert.equal(result.ok && result.source.url, 'https://australia.example.gov/canberra');
  assert.deepEqual(getAnswerEvidenceSet(restored.id, restored.turns[1])?.citedEvidenceIds, [5]);
});

test('distinguishes retrieved from cited sources and never substitutes latest evidence', () => {
  const conversation = capitalsConversation();
  const retrievedOnly = resolveCitation(conversation, {
    investigationId: conversation.id,
    answerId: 'answer-canberra',
    evidenceId: 6,
  });
  assert.equal(retrievedOnly.ok, false);
  assert.match(retrievedOnly.ok ? '' : retrievedOnly.reason, /retrieved but was not cited/i);

  const missingHistory: Conversation = {
    ...conversation,
    turns: conversation.turns.map(turn => turn.id === 'answer-canberra'
      ? { ...turn, meta: { caseId: 'DAM-CAPITALS', taskType: 'verification' }, evidenceSet: undefined }
      : turn),
  };
  const missing = resolveCitation(missingHistory, {
    investigationId: missingHistory.id,
    answerId: 'answer-canberra',
    evidenceId: 5,
  });
  assert.equal(missing.ok, false);
  assert.match(missing.ok ? '' : missing.reason, /historical evidence.*unavailable/i);
});
