import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanArticleText,
  evaluateExtractionQuality,
  extractHtmlContent,
  countWords,
} from '../lib/investigation/urlIngestion';
import {
  selectReadablePassage,
  searchAndReadSources,
} from '../lib/investigation/researcher';
import { UrlAnalysisResult } from '../lib/investigation/types';

function mockUrlResult(url: string, status: UrlAnalysisResult['status'], text = '', errorDetails?: string): UrlAnalysisResult {
  const quality = evaluateExtractionQuality(text);
  return {
    url,
    finalUrl: url,
    domain: new URL(url).hostname,
    status,
    redirectHistory: [url],
    title: 'Extracted Page Title',
    publishedDate: '2026-10-18',
    extractedText: quality.cleanText,
    wordCount: quality.wordCount,
    outgoingLinks: [],
    downloadLinks: [],
    domainRisk: { isPunycode: false, hasHomoglyphs: false, isDeceptiveSubdomain: false, riskLevel: 'Low', warnings: [] },
    claims: [],
    errorDetails,
    isUsable: quality.isUsable,
    qualityScore: quality.qualityScore,
    extractionLimitation: quality.reason,
  };
}

test('Evidence Extraction: Clean HTML produces readable prose and high quality evaluation', () => {
  const cleanHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Canberra — Australia's Capital City</title>
        <link rel="canonical" href="https://australia.gov.au/canberra">
        <meta name="author" content="Australian Government">
        <meta property="article:published_time" content="2026-01-15T00:00:00Z">
      </head>
      <body>
        <header><nav><a href="/">Home</a> <a href="/about">About</a></nav></header>
        <main>
          <h1>Canberra</h1>
          <p>Canberra is the national capital of Australia. With an estimated population of 456,000, it is Australia's largest inland city.</p>
          <p>The site of Canberra was selected for the location of the nation's capital in 1908 as a compromise between rivals Sydney and Melbourne.</p>
          <p>The city's design was influenced by the garden city movement and incorporates significant areas of natural vegetation.</p>
        </main>
        <footer><p>&copy; 2026 Commonwealth of Australia</p></footer>
      </body>
    </html>
  `;

  const extracted = extractHtmlContent(cleanHtml, 'https://australia.gov.au');
  assert.equal(extracted.isUsable, true);
  assert.ok(extracted.qualityScore >= 0.55);
  assert.ok(extracted.visibleText.includes('Canberra is the national capital of Australia.'));
  assert.ok(extracted.visibleText.includes('selected for the location of the nation\'s capital in 1908'));
  assert.ok(!extracted.visibleText.includes('Home')); // Header/nav stripped
  assert.ok(!extracted.visibleText.includes('Commonwealth of Australia')); // Footer stripped

  // Passage selection picks top relevant block preserving natural order
  const passage = selectReadablePassage('Canberra is the capital of Australia', extracted.visibleText);
  assert.ok(passage.includes('Canberra is the national capital of Australia.'));
  assert.ok(!passage.includes('{{'));
});

test('Evidence Extraction: Template-heavy Wikipedia content strips raw templates and infobox fragments', () => {
  const wikiHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Canberra - Wikipedia</title></head>
      <body>
        <div id="mw-navigation">Navigation menu <a href="/wiki/Main_Page">Main page</a></div>
        <table class="infobox vcard">
          <tr><th colspan="2">Canberra</th></tr>
          <tr><td>Country</td><td>Australia</td></tr>
          <tr><td>Settlement type</td><td>Capital city</td></tr>
        </table>
        <div class="mw-parser-output">
          <div class="hatnote">For other uses, see Canberra (disambiguation).</div>
          <p>
            <b>Canberra</b> is the capital city of Australia. {{cite web |url=https://nca.gov.au/canberra |title={{rcb|#005A9C|Canberra}} National Capital Authority |access-date=2026-01-01}}
            Founded following the federation of the colonies of Australia as the seat of government in 1908, it is Australia's largest inland city. {{coord|35|18|S|149|08|E|display=inline,title}}
          </p>
          <p>
            A common misconception is that Sydney is the capital of Australia.<sup class="reference"><a href="#cite_note-1">[1]</a></sup>
            However, Canberra was chosen explicitly as a compromise between Sydney and Melbourne.<sup class="reference"><a href="#cite_note-2">[2]</a></sup>
          </p>
          <div class="reflist"><ol class="references"><li><span class="mw-cite-backlink">^</span> Australian Bureau of Statistics</li></ol></div>
          <div class="navbox">Navigation box table</div>
        </div>
        <div id="catlinks">Categories: Capital cities in Oceania</div>
      </body>
    </html>
  `;

  const extracted = extractHtmlContent(wikiHtml, 'https://en.wikipedia.org/wiki/Canberra');

  // Verify raw templates, cite web, rcb, coord, and infobox tables were stripped
  assert.ok(!extracted.visibleText.includes('{{cite web'));
  assert.ok(!extracted.visibleText.includes('{{rcb'));
  assert.ok(!extracted.visibleText.includes('{{coord'));
  assert.ok(!extracted.visibleText.includes('Infobox'));
  assert.ok(!extracted.visibleText.includes('mw-navigation'));
  assert.ok(!extracted.visibleText.includes('Navigation menu'));
  assert.ok(!extracted.visibleText.includes('Navigation box'));
  assert.ok(!extracted.visibleText.includes('Categories:'));
  assert.ok(!extracted.visibleText.includes('[1]'));
  assert.ok(!extracted.visibleText.includes('[2]'));

  // Meaningful text is preserved intact
  assert.ok(extracted.visibleText.includes('Canberra is the capital city of Australia.'));
  assert.ok(extracted.visibleText.includes('seat of government in 1908'));
  assert.ok(extracted.visibleText.includes('Canberra was chosen explicitly as a compromise between Sydney and Melbourne.'));
  assert.equal(extracted.isUsable, true);

  // Passage selection preserves readability without markup
  const passage = selectReadablePassage('Is Canberra the capital of Australia?', extracted.visibleText);
  assert.ok(passage.includes('Canberra is the capital city of Australia.'));
  assert.ok(!passage.includes('{{'));
  assert.ok(!passage.includes('|'));
});

test('Evidence Extraction: Plain text normalization strips unresolved templates and serialized infobox lines', () => {
  const rawSnippet = '{{Infobox settlement\n| name = Canberra\n| settlement_type = Capital of Australia\n| coordinates = {{coord|35|18|S|149|08|E}}\n}}\nCanberra is the capital of Australia. {{cite web |url=https://example.com |title=Facts}} It was founded in 1913.';
  const cleaned = cleanArticleText(rawSnippet);

  assert.ok(!cleaned.includes('{{Infobox'));
  assert.ok(!cleaned.includes('{{coord'));
  assert.ok(!cleaned.includes('{{cite web'));
  assert.ok(!cleaned.includes('| settlement_type'));
  assert.ok(!cleaned.includes('| coordinates'));
  assert.ok(cleaned.includes('Canberra is the capital of Australia.'));
  assert.ok(cleaned.includes('It was founded in 1913.'));
});

test('Evidence Extraction: Pure boilerplate and cookie banners are flagged as unusable', () => {
  const boilerplateHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Cookie Consent & Privacy Notice</title></head>
      <body>
        <div class="cookie-banner">
          <h2>We value your privacy</h2>
          <p>We use cookies and similar technologies to enhance your browsing experience and analyze site traffic. Accept all cookies or manage cookie preferences.</p>
          <button>Accept all cookies</button>
          <button>Cookie settings</button>
          <a href="/privacy-policy">Privacy Policy</a>
          <a href="/terms-of-use">Terms of Service</a>
        </div>
      </body>
    </html>
  `;

  const extracted = extractHtmlContent(boilerplateHtml, 'https://example.com/blocked');
  assert.equal(extracted.isUsable, false);
  assert.ok(extracted.extractionLimitation?.includes('boilerplate') || extracted.extractionLimitation?.includes('Insufficient') || extracted.extractionLimitation?.includes('Empty') || extracted.extractionLimitation?.includes('cookie'));
});

test('Evidence Extraction: Empty or near-empty extraction is flagged as unusable with reason recorded', () => {
  const emptyHtml = '<!DOCTYPE html><html><head><title>Empty</title></head><body>   </body></html>';
  const extracted = extractHtmlContent(emptyHtml, 'https://example.com/empty');
  assert.equal(extracted.isUsable, false);
  assert.equal(extracted.wordCount, 0);
  assert.ok(extracted.extractionLimitation?.includes('Empty') || extracted.extractionLimitation?.includes('No readable prose') || extracted.extractionLimitation?.includes('Insufficient'));
});

test('Evidence Extraction: Multilingual Hindi text preserves Devanagari script, punctuation, dates, and negation', () => {
  const hindiHtml = `
    <!DOCTYPE html>
    <html lang="hi">
      <head><title>कैनबरा - ऑस्ट्रेलिया की राजधानी</title></head>
      <body>
        <main>
          <h1>कैनबरा</h1>
          <p>कैनबरा ऑस्ट्रेलिया की राष्ट्रीय राजधानी है। यह देश का आठवां सबसे बड़ा शहर है।</p>
          <p>1908 में सिडनी और मेलबर्न के बीच समझौते के रूप में कैनबरा को राष्ट्रीय राजधानी के रूप में चुना गया था।</p>
          <p>कैनबरा न्यू साउथ वेल्स राज्य का हिस्सा नहीं है, बल्कि यह ऑस्ट्रेलियाई राजधानी क्षेत्र में स्थित है।</p>
        </main>
      </body>
    </html>
  `;

  const extracted = extractHtmlContent(hindiHtml, 'https://hi.wikipedia.org/wiki/कैनबरा');
  assert.equal(extracted.isUsable, true);
  assert.ok(extracted.wordCount >= 25);
  // Preserves Devanagari words, negation (नहीं), and dates (1908)
  assert.ok(extracted.visibleText.includes('कैनबरा ऑस्ट्रेलिया की राष्ट्रीय राजधानी है।'));
  assert.ok(extracted.visibleText.includes('1908'));
  assert.ok(extracted.visibleText.includes('नहीं'));
  assert.ok(extracted.visibleText.includes('न्यू साउथ वेल्स'));

  // Readable passage selection accurately finds Hindi sentences
  const passage = selectReadablePassage('कैनबरा ऑस्ट्रेलिया की राजधानी', extracted.visibleText);
  assert.ok(passage.includes('कैनबरा ऑस्ट्रेलिया की राष्ट्रीय राजधानी है।'));
  assert.ok(passage.includes('1908'));
});

test('Evidence Extraction: searchAndReadSources retains search snippet and updates granular counts when page extraction is unusable', async () => {
  const garbagePageText = '{{Infobox settlement\n| name = Test\n| population = 0\n}}\n{{coord|0|0|N|0|0|E}}\n{{cite web |url=http://junk}}';
  const validSnippet = 'Canberra is the national capital of Australia, established in 1913 as the seat of government.';

  const result = await searchAndReadSources(
    ['Canberra national capital of Australia'],
    'Canberra is the capital of Australia.',
    'test-key',
    {
      maxPages: 1,
      extractionRetries: 0,
      search: async () => [{
        url: 'https://en.wikipedia.org/wiki/Canberra',
        title: 'Canberra - Wikipedia',
        content: validSnippet,
      }],
      // extract returns HTTP 200 success, but the extracted content is pure unusable template junk
      extract: async url => mockUrlResult(url, 'success', garbagePageText),
    }
  );

  assert.equal(result.sources.length, 1);
  const source = result.sources[0];

  // 1. Unusable page extraction is discarded, and the clean search snippet is retained
  assert.equal(source.contentOrigin, 'search_snippet');
  assert.equal(source.inspectionStatus, 'unavailable');
  assert.ok(source.passage.includes('Canberra is the national capital of Australia'));
  assert.ok(!source.passage.includes('{{'));

  // 2. Limitation is explicitly recorded on the source
  assert.ok(source.extractionLimitation?.includes('Extracted page unusable'));

  // 3. Granular stats distinguish attempted, successful, usable, and failed
  assert.equal(result.stats.pagesAttempted, 1);
  assert.equal(result.stats.pagesSuccessful, 1); // HTTP fetch succeeded
  assert.equal(result.stats.pagesUsable, 0);     // Extraction was unusable
  assert.equal(result.stats.pagesFailed, 1);     // Marked failed
  assert.equal(result.stats.pagesInspected, 0);  // Usable page count is 0
  assert.equal(result.stats.pagesUnavailable, 1);
  assert.equal(result.stats.snippetsAvailable, 1);
});

test('Evidence Extraction: searchAndReadSources promotes to fetched_page and inspected when extraction is usable', async () => {
  const cleanArticle = 'Canberra was founded following the federation of the colonies of Australia as the seat of government in 1908. It is Australia\'s largest inland city and the eighth-largest city overall.';
  const snippet = 'Canberra is the capital of Australia.';

  const result = await searchAndReadSources(
    ['Canberra capital of Australia'],
    'Canberra is the capital of Australia.',
    'test-key',
    {
      maxPages: 1,
      extractionRetries: 0,
      search: async () => [{
        url: 'https://australia.gov.au/canberra',
        title: 'Canberra Official Page',
        content: snippet,
      }],
      extract: async url => mockUrlResult(url, 'success', cleanArticle),
    }
  );

  assert.equal(result.sources.length, 1);
  const source = result.sources[0];

  assert.equal(source.contentOrigin, 'fetched_page');
  assert.equal(source.inspectionStatus, 'inspected');
  assert.ok(source.passage.includes('Canberra was founded following the federation of the colonies of Australia'));

  assert.equal(result.stats.pagesAttempted, 1);
  assert.equal(result.stats.pagesSuccessful, 1);
  assert.equal(result.stats.pagesUsable, 1);
  assert.equal(result.stats.pagesFailed, 0);
  assert.equal(result.stats.pagesInspected, 1);
  assert.equal(result.stats.pagesUnavailable, 0);
});
