import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLegacyConversation, findLocalLegacyCase, parseLegacyCaseReference } from '../lib/investigation/legacyCase';
import type { Conversation } from '../lib/investigation/types';

test('classifies supported local and remote legacy case references', () => {
  assert.deepEqual(parseLegacyCaseReference('DAM-2026-IND-1234'), { kind: 'local', value: 'DAM-2026-IND-1234' });
  assert.deepEqual(parseLegacyCaseReference('inv_abcdefgh1234'), { kind: 'remote', value: 'inv_abcdefgh1234' });
  assert.equal(parseLegacyCaseReference(null), null);
  assert.equal(parseLegacyCaseReference('../private')?.kind, 'invalid');
});

test('loads only a matching local case and leaves missing cases unavailable', () => {
  const cases: Conversation[] = [{ id: 'conv_abcdefgh', caseId: 'DAM-2026-1234', title: 'Case', createdAt: '2026-10-18T00:00:00.000Z', turns: [] }];
  assert.equal(findLocalLegacyCase(cases, 'DAM-2026-1234')?.id, 'conv_abcdefgh');
  assert.equal(findLocalLegacyCase(cases, 'DAM-2026-9999'), null);
});

test('restores an authorized API payload with its scoped evidence', () => {
  const conversation = buildLegacyConversation({ investigationId: 'inv_abcdefgh1234', caseId: 'DAM-2026-1234', status: 'completed', prompt: 'Canberra is the capital of Australia', briefing: 'Supported [1].', meta: { caseId: 'DAM-2026-1234', taskType: 'verification', sources: [{ id: 1, domain: 'aph.gov.au', title: 'Canberra', date: '2026-10-18', type: 'Government', url: 'https://aph.gov.au/canberra', passage: 'Canberra is the capital.', stance: 'supports', isCited: true }], retrieval: { searchResultsFound: 1, snippetsAvailable: 0, pagesInspected: 1, pagesUnavailable: 0, citedSourceIds: [1] } } });
  const answer = conversation.turns[1];
  assert.equal(answer.evidenceSet?.investigationId, conversation.id);
  assert.equal(answer.evidenceSet?.citedEvidenceIds[0], 1);
});
