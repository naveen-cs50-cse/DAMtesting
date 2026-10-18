import assert from 'node:assert/strict';
import test from 'node:test';
import { getSourceAuthority } from '../lib/investigation/knowledge';
import { searchAndReadSources } from '../lib/investigation/researcher';
import { IndexedSource, UrlAnalysisResult } from '../lib/investigation/types';
import { executeVerdictEngine } from '../lib/investigation/verdictEngine';

function extraction(url: string, status: UrlAnalysisResult['status'], text = ''): UrlAnalysisResult {
  return {
    url,
    finalUrl: url,
    domain: new URL(url).hostname,
    status,
    redirectHistory: [url],
    title: 'Official record',
    publishedDate: '2026-10-18',
    extractedText: text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    outgoingLinks: [],
    downloadLinks: [],
    domainRisk: { isPunycode: false, hasHomoglyphs: false, isDeceptiveSubdomain: false, riskLevel: 'Low', warnings: [] },
    claims: [],
    errorDetails: status === 'success' ? undefined : 'Fixture extraction failure',
  };
}

test('ranks a directly relevant official page ahead of social reposts and deduplicates copied reposts', async () => {
  const result = await searchAndReadSources(
    ['Canberra capital of Australia'],
    'Canberra is the capital of Australia.',
    'test-key',
    {
      maxPages: 1,
      search: async () => [
        { url: 'https://facebook.com/post/1', title: 'Canberra fact', content: 'Canberra is the capital of Australia and the seat of government.' },
        { url: 'https://instagram.com/p/2', title: 'Canberra fact repost', content: 'Canberra is the capital of Australia and the seat of government.' },
        { url: 'https://www.aph.gov.au/About_Parliament/House_of_Representatives/Powers_practice_n_procedure/Canberra', title: 'Canberra — Australia’s national capital', content: 'Canberra is Australia’s national capital and the seat of the Parliament of Australia.' },
      ],
      extract: async url => extraction(url, 'success', 'Canberra is Australia’s national capital. The Parliament House is located in Canberra.'),
    },
  );

  assert.equal(result.sources[0].domain, 'aph.gov.au');
  assert.equal(result.sources[0].contentOrigin, 'fetched_page');
  assert.equal(result.sources[0].inspectionStatus, 'inspected');
  assert.equal(result.stats.pagesInspected, 1);
  assert.equal(result.stats.searchResultsFound, 2);
  assert.equal(result.sources.filter(source => /facebook|instagram/.test(source.domain)).length, 1);
  const verdict = executeVerdictEngine({ prompt: 'Canberra is the capital of Australia.', taskType: 'verification', sources: result.sources });
  assert.equal(verdict.verdicts.factualCorrectness, 'Supported');
});

test('treats time-sensitive snippet-only evidence as partial without forcing an unverified verdict', async () => {
  let attempts = 0;
  const result = await searchAndReadSources(
    ['current Reserve Bank of Australia cash rate'],
    'The current Reserve Bank of Australia cash rate is 4.10% as of today.',
    'test-key',
    {
      maxPages: 1,
      extractionRetries: 1,
      search: async () => [{
        url: 'https://www.rba.gov.au/statistics/cash-rate/',
        title: 'Cash Rate Target',
        content: 'The current Reserve Bank of Australia cash rate target is 4.10 per cent.',
        published_date: '2026-10-18',
      }],
      extract: async url => {
        attempts += 1;
        return extraction(url, 'timeout');
      },
    },
  );
  const verdict = executeVerdictEngine({ prompt: 'The current Reserve Bank of Australia cash rate is 4.10% as of today.', taskType: 'verification', sources: result.sources });

  assert.equal(attempts, 2);
  assert.equal(result.stats.pagesInspected, 0);
  assert.equal(result.stats.pagesUnavailable, 1);
  assert.equal(result.stats.snippetsAvailable, 1);
  assert.equal(verdict.verdicts.evidenceSufficiency, 'Partial');
  assert.equal(verdict.verdicts.factualCorrectness, 'Supported');
  assert.match(verdict.explanation.sufficiencyRationale, /only search-result snippets/i);
});

test('reports genuinely conflicting direct evidence as mixed', () => {
  const sources: IndexedSource[] = [
    {
      id: 1, domain: 'aph.gov.au', title: 'Official proposition', date: '2026-10-18', type: 'Government',
      url: 'https://aph.gov.au/record-a', passage: 'The proposed measure took effect on 18 October 2026.', stance: 'supports',
      contentOrigin: 'fetched_page', inspectionStatus: 'inspected',
    },
    {
      id: 2, domain: 'australia.gov.au', title: 'Official correction', date: '2026-10-18', type: 'Government',
      url: 'https://australia.gov.au/record-b', passage: 'The proposed measure did not take effect on 18 October 2026.', stance: 'contradicts',
      contentOrigin: 'fetched_page', inspectionStatus: 'inspected',
    },
  ];
  const verdict = executeVerdictEngine({ prompt: 'The proposed measure took effect on 18 October 2026.', taskType: 'verification', sources });
  assert.equal(verdict.verdicts.factualCorrectness, 'Mixed');
});

test('does not infer authority from a government-looking suffix and records failed extraction honestly', async () => {
  const authority = getSourceAuthority('department.gov.au.attacker.example', 'Government');
  assert.equal(authority.tier, 'General');

  const result = await searchAndReadSources(
    ['ordinary claim'],
    'An ordinary claim.',
    'test-key',
    {
      maxPages: 1,
      extractionRetries: 0,
      search: async () => [{ url: 'https://example.test/claim', title: 'Claim report', content: 'An ordinary claim is described here.' }],
      extract: async url => extraction(url, 'error'),
    },
  );
  assert.equal(result.sources[0].contentOrigin, 'search_snippet');
  assert.equal(result.sources[0].inspectionStatus, 'unavailable');
  assert.equal(result.stats.pagesInspected, 0);
  assert.equal(result.stats.pagesUnavailable, 1);
});
