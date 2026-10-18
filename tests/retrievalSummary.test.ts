import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRetrievalSummary } from '../lib/investigation/retrievalSummary';

const records = {
  searchResultsFound: 5,
  snippetsAvailable: 3,
  pagesInspected: 2,
  pagesUnavailable: 1,
  citedSourceIds: [4, 4, 9],
};

test('labels found results, inspected pages, snippet-only results, failures, and deduplicated citations separately', () => {
  assert.equal(
    formatRetrievalSummary(records, 'en'),
    'Found results 5 · pages inspected 2 · Snippet-only 3 · Unavailable 1 · sources cited 2',
  );
});

test('keeps source accounting labels localized without changing the underlying counts', () => {
  assert.equal(
    formatRetrievalSummary(records, 'hi'),
    'परिणाम 5 · पृष्ठ जाँचे 2 · केवल स्निपेट 3 · अनुपलब्ध 1 · स्रोत उद्धृत 2',
  );
});
