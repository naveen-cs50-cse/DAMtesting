import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectMessageHighlights,
  isValidMessageHighlight,
  MessageHighlight,
  segmentHighlightedText,
} from '../lib/investigation/messageHighlights';
import { IndexedSource, UrlAnalysisResult } from '../lib/investigation/types';

describe('Submitted-message contextual highlights', () => {
  it('returns only exact spans from the original submitted text', () => {
    const text = 'URGENT: Income Tax Department says pay ₹5,000 immediately and confirm your debit card CVV.';
    const highlights = detectMessageHighlights(text);

    assert.ok(highlights.length > 0);
    assert.ok(highlights.every(highlight => isValidMessageHighlight(text, highlight)));
    assert.ok(highlights.some(highlight => highlight.text === 'debit card CVV'));
    assert.ok(highlights.some(highlight => highlight.category === 'payment'));
    assert.ok(highlights.some(highlight => highlight.category === 'impersonation'));
    assert.ok(highlights.every(highlight => highlight.finding === 'general_warning'));
  });

  it('highlights repeated phrases as separate exact occurrences', () => {
    const text = 'Confirm OTP and OTP now.';
    const highlights = detectMessageHighlights(text).filter(highlight => highlight.text.toLowerCase() === 'otp');

    assert.equal(highlights.length, 2);
    assert.notEqual(highlights[0].start, highlights[1].start);
  });

  it('links a warning to relevant retrieved evidence when it is available', () => {
    const source: IndexedSource = {
      id: 4,
      domain: 'example.org',
      title: 'Credential phishing warning',
      date: 'Date not provided',
      type: 'Search result',
      url: 'https://example.org/warning',
      passage: 'Never share an OTP, password, PIN, or card CVV in response to an unsolicited message.',
      stance: 'context',
    };
    const highlight = detectMessageHighlights('Confirm your OTP now.', { sources: [source] })
      .find(item => item.category === 'sensitive');

    assert.deepEqual(highlight?.evidenceSourceIds, [4]);
  });

  it('skips invalid returned spans safely', () => {
    const text = 'Do not share an OTP.';
    const invalid: MessageHighlight = {
      id: 'invalid',
      start: 16,
      end: 19,
      text: 'PIN',
      category: 'sensitive',
      finding: 'general_warning',
      explanation: 'Invalid test span',
      evidenceSourceIds: [],
    };

    assert.deepEqual(segmentHighlightedText(text, [invalid]), [{ text }]);
  });

  it('preserves malicious-looking input as inert text without creating executable markup', () => {
    const text = '<img src=x onerror="steal(password)"> <script>alert(1)</script>';
    const segments = segmentHighlightedText(text, detectMessageHighlights(text));

    assert.equal(segments.map(segment => segment.text).join(''), text);
  });

  it('distinguishes a structural domain warning from an existing completed URL finding', () => {
    const url = 'https://sbi.co.in.attacker.example/pay';
    const general = detectMessageHighlights(`Pay here: ${url}`);
    const generalDomain = general.find(highlight => highlight.category === 'domain');
    assert.equal(generalDomain?.finding, 'general_warning');
    assert.match(generalDomain?.explanation || '', /not inspected/i);

    const urlAnalysis: UrlAnalysisResult = {
      url,
      finalUrl: url,
      domain: 'sbi.co.in.attacker.example',
      status: 'success',
      redirectHistory: [],
      extractedText: '',
      wordCount: 0,
      outgoingLinks: [],
      downloadLinks: [],
      domainRisk: {
        isPunycode: false,
        hasHomoglyphs: false,
        isDeceptiveSubdomain: true,
        riskLevel: 'High',
        warnings: ['Deceptive subdomain resembles State Bank of India.'],
      },
      claims: [],
    };
    const verified = detectMessageHighlights(`Pay here: ${url}`, { urlAnalysis });
    assert.equal(verified.find(highlight => highlight.category === 'domain')?.finding, 'verified_finding');
  });

  it('preserves the original appearance when there are no supported signals', () => {
    const text = 'Please send the meeting notes when convenient.';
    assert.deepEqual(detectMessageHighlights(text), []);
    assert.deepEqual(segmentHighlightedText(text, []), [{ text }]);
    assert.deepEqual(detectMessageHighlights('Safety advice: never share an OTP with anyone.'), []);
  });
});
