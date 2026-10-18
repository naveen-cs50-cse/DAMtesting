import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractCitedSourceIds, sanitizeGroundedCitations } from '../lib/investigation/citations';
import { getSourceAuthority } from '../lib/investigation/knowledge';
import { canonicalSourceUrl } from '../lib/investigation/researcher';
import { IndexedSource } from '../lib/investigation/types';

const sources: IndexedSource[] = [
  {
    id: 1,
    domain: 'incometax.gov.in',
    title: 'Income Tax Department phishing warning',
    date: 'Date not provided',
    type: 'Search result',
    url: 'https://incometax.gov.in/warning',
    passage: 'Never share passwords, PINs, OTPs, or card CVV details in response to refund messages.',
    stance: 'context',
    contentOrigin: 'search_snippet',
    inspectionStatus: 'not_inspected',
  },
  {
    id: 2,
    domain: 'example.com',
    title: 'Unrelated weather report',
    date: 'Date not provided',
    type: 'Search result',
    url: 'https://example.com/weather',
    passage: 'Rain is expected in Mumbai this weekend.',
    stance: 'context',
    contentOrigin: 'search_snippet',
    inspectionStatus: 'not_inspected',
  },
];

describe('Citation integrity and source accounting', () => {
  it('keeps citations supported by their mapped source and removes unknown or unrelated citations', () => {
    const draft = [
      'The warning says never to share passwords, OTPs, or card CVV details. [1]',
      'The sender is officially authenticated by the tax department. [2]',
      'This citation does not exist. [9]',
    ].join('\n');

    const sanitized = sanitizeGroundedCitations(draft, sources);
    assert.match(sanitized, /details\. \[1\]/);
    assert.doesNotMatch(sanitized, /\[2\]|\[9\]/);
    assert.deepEqual(extractCitedSourceIds(sanitized, sources), [1]);
  });

  it('deduplicates equivalent result URLs after removing tracking and fragments', () => {
    const first = canonicalSourceUrl('https://Example.com/advisory/?utm_source=test&id=7#details');
    const second = canonicalSourceUrl('https://example.com/advisory?id=7');
    assert.equal(first, second);
  });

  it('does not grant authority from a government-looking URL without verified source provenance', () => {
    const assessment = getSourceAuthority('incometax.gov.in', 'Search result');
    assert.equal(assessment.tier, 'General');
    assert.ok(assessment.weight < 1);
  });
});
