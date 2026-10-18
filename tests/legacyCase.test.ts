import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLegacyConversation,
  findLocalLegacyCase,
  parseLegacyCaseReference,
  getLegacyLinkNotice,
} from '../lib/investigation/legacyCase';
import { createInvestigation, getInvestigation, resetInvestigationStore } from '../lib/investigation/store';
import type { Conversation } from '../lib/investigation/types';

test('classifies supported local and remote legacy case references', () => {
  // Reproduced issue case ID
  assert.deepEqual(parseLegacyCaseReference('DAM-2026-IND-9157'), { kind: 'local', value: 'DAM-2026-IND-9157' });
  assert.deepEqual(parseLegacyCaseReference('DAM-2026-IND-1234'), { kind: 'local', value: 'DAM-2026-IND-1234' });
  assert.deepEqual(parseLegacyCaseReference('inv_abcdefgh1234'), { kind: 'remote', value: 'inv_abcdefgh1234' });
  assert.deepEqual(parseLegacyCaseReference('conv_abcdefgh1234'), { kind: 'local', value: 'conv_abcdefgh1234' });
});

test('preserves normal homepage behavior when case parameter is absent', () => {
  assert.equal(parseLegacyCaseReference(null), null);
});

test('distinguishes malformed vs unsupported case link references', () => {
  // Malformed links (path traversal, special characters, whitespace, control characters, empty)
  assert.deepEqual(parseLegacyCaseReference('../private'), { kind: 'invalid', value: '../private', reason: 'malformed' });
  assert.deepEqual(parseLegacyCaseReference('DAM/2026/IND'), { kind: 'invalid', value: 'DAM/2026/IND', reason: 'malformed' });
  assert.deepEqual(parseLegacyCaseReference('DAM-2026 IND'), { kind: 'invalid', value: 'DAM-2026 IND', reason: 'malformed' });
  assert.deepEqual(parseLegacyCaseReference('DAM@2026!'), { kind: 'invalid', value: 'DAM@2026!', reason: 'malformed' });
  assert.deepEqual(parseLegacyCaseReference(''), { kind: 'invalid', value: '', reason: 'malformed' });
  assert.deepEqual(parseLegacyCaseReference('   '), { kind: 'invalid', value: '', reason: 'malformed' });

  // Unsupported formats (clean string, but unrecognized identifier format)
  assert.deepEqual(parseLegacyCaseReference('CASE-UNKNOWN-123'), { kind: 'invalid', value: 'CASE-UNKNOWN-123', reason: 'unsupported' });
  assert.deepEqual(parseLegacyCaseReference('report_2026_finance'), { kind: 'invalid', value: 'report_2026_finance', reason: 'unsupported' });
  assert.deepEqual(parseLegacyCaseReference('unknown-id'), { kind: 'invalid', value: 'unknown-id', reason: 'unsupported' });
});

test('provides distinct, user-friendly notice content without leaking private data', () => {
  const malformedNotice = getLegacyLinkNotice('malformed', '../private');
  assert.equal(malformedNotice.type, 'malformed');
  assert.equal(malformedNotice.title, 'Malformed Case Reference');
  assert.ok(malformedNotice.description.includes('invalid characters or a malformed identifier'));

  const unsupportedNotice = getLegacyLinkNotice('unsupported', 'UNKNOWN-123');
  assert.equal(unsupportedNotice.type, 'unsupported');
  assert.equal(unsupportedNotice.title, 'Unsupported Case Link');
  assert.ok(unsupportedNotice.description.includes('not supported'));

  const unavailableNotice = getLegacyLinkNotice('unavailable', 'DAM-2026-IND-9157');
  assert.equal(unavailableNotice.type, 'unavailable');
  assert.equal(unavailableNotice.title, 'Investigation Unavailable');
  // Crucial requirement: does not expose whether another user's private investigation exists
  assert.ok(!unavailableNotice.description.toLowerCase().includes('another user'));
  assert.ok(!unavailableNotice.description.toLowerCase().includes('forbidden'));
  assert.ok(unavailableNotice.description.includes('unavailable, no longer exists, or access is restricted'));
});

test('loads only a matching local case and leaves missing cases unavailable', () => {
  const cases: Conversation[] = [{ id: 'conv_abcdefgh', caseId: 'DAM-2026-1234', title: 'Case', createdAt: '2026-10-18T00:00:00.000Z', turns: [] }];
  assert.equal(findLocalLegacyCase(cases, 'DAM-2026-1234')?.id, 'conv_abcdefgh');
  assert.equal(findLocalLegacyCase(cases, 'DAM-2026-9999'), null);
});

test('resolves stored investigations by caseId or investigationId in store', () => {
  resetInvestigationStore();
  const { record } = createInvestigation({
    ownerId: 'device:owner_device_1',
    prompt: 'Verify Canberra capital claim',
  });

  // Lookup by internal ID
  const byId = getInvestigation(record.id);
  assert.ok(byId);
  assert.equal(byId.id, record.id);

  // Lookup by caseId (DAM-2026-...)
  const byCaseId = getInvestigation(record.caseId);
  assert.ok(byCaseId);
  assert.equal(byCaseId.id, record.id);
  assert.equal(byCaseId.caseId, record.caseId);

  // Missing or nonexistent case ID returns null safely
  assert.equal(getInvestigation('DAM-2026-NONEXISTENT'), null);
});

test('restores an authorized API payload with its scoped evidence', () => {
  const conversation = buildLegacyConversation({ investigationId: 'inv_abcdefgh1234', caseId: 'DAM-2026-1234', status: 'completed', prompt: 'Canberra is the capital of Australia', briefing: 'Supported [1].', meta: { caseId: 'DAM-2026-1234', taskType: 'verification', sources: [{ id: 1, domain: 'aph.gov.au', title: 'Canberra', date: '2026-10-18', type: 'Government', url: 'https://aph.gov.au/canberra', passage: 'Canberra is the capital.', stance: 'supports', isCited: true }], retrieval: { searchResultsFound: 1, snippetsAvailable: 0, pagesInspected: 1, pagesUnavailable: 0, citedSourceIds: [1] } } });
  const answer = conversation.turns[1];
  assert.equal(answer.evidenceSet?.investigationId, conversation.id);
  assert.equal(answer.evidenceSet?.citedEvidenceIds[0], 1);
});
