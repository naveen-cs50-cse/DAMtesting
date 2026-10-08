import { IndexedSource } from './types';
import { REGULATORY_FIXTURES } from './knowledge';

interface TavilySearchResult {
  url: string;
  title?: string;
  content?: string;
}

interface TavilySearchResponse {
  results?: TavilySearchResult[];
}

export async function searchAndReadSources(
  queries: string[],
  prompt: string,
  tavilyKey?: string
): Promise<IndexedSource[]> {
  let sources: IndexedSource[] = [];
  const lower = prompt.toLowerCase();
  const apiKey = tavilyKey || process.env.TAVILY_API_KEY;

  if (apiKey && queries.length > 0) {
    try {
      const tavilyRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: queries[0],
          search_depth: 'advanced',
          include_answer: true,
          max_results: 5,
        }),
      });

      if (tavilyRes.ok) {
        const tavilyData = (await tavilyRes.json()) as TavilySearchResponse;
        if (tavilyData.results && tavilyData.results.length > 0) {
          sources = tavilyData.results.map((r, i) => {
            let domain = 'web';
            try {
              domain = new URL(r.url).hostname.replace(/^www\./, '');
            } catch {
              domain = 'web';
            }

            const isGov =
              domain.endsWith('.gov.in') ||
              domain.endsWith('.nic.in') ||
              domain.includes('rbi.org.in') ||
              domain.includes('trai.gov.in') ||
              domain.includes('cybercrime.gov.in');

            const isFactCheck =
              domain.includes('boomlive') ||
              domain.includes('altnews') ||
              domain.includes('factcheck') ||
              domain.includes('thequint');

            return {
              id: i + 1,
              domain,
              title: r.title || 'Official Registry Source',
              date: 'Live Registry',
              type: isGov ? 'Government' : isFactCheck ? 'Fact-checker' : 'News',
              url: r.url,
              passage: r.content || 'Extracted regulatory passage verifying publication date and official notice requirements.',
              stance: 'context' as const,
              isFixture: false, // Explicitly live evidence from search
            };
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Tavily search warning:', msg);
    }
  }

  // Fallback Archive References: Only inject known demonstration fixtures if live search returned nothing,
  // AND mark them strictly as `isFixture: true` so the verdict engine NEVER mistakes them for live evidence.
  if (sources.length === 0) {
    if (lower.includes('500') || lower.includes('rbi')) {
      sources.push({
        id: 1,
        ...REGULATORY_FIXTURES.rbi_500,
        isFixture: true,
      });
      sources.push({
        id: 2,
        domain: 'pib.gov.in',
        title: 'PIB Fact Check: ₹500 Notes Are NOT Banned or Withdrawn by RBI',
        date: 'Aug 2026',
        type: 'Government',
        url: 'https://pib.gov.in/FactCheck/rbi-500-currency',
        passage: 'A viral video claiming that ₹500 banknotes are being withdrawn from circulation is fake. RBI has made no such announcement.',
        stance: 'contradicts',
        isFixture: true,
      });
    } else if (lower.includes('electric') || lower.includes('disconnection')) {
      sources.push({
        id: 1,
        ...REGULATORY_FIXTURES.electricity_scam,
        isFixture: true,
      });
      sources.push({
        id: 2,
        domain: 'pib.gov.in',
        title: 'PIB Fact Check: Urgent Electricity Bill Disconnection SMS Warning',
        date: 'Jul 2026',
        type: 'Government',
        url: 'https://pib.gov.in/FactCheck/electricity-sms-alert',
        passage: 'Beware of fake SMS alerts threatening power cut at 9:30 PM. Power distribution companies never send phone numbers to call for immediate bill payments.',
        stance: 'contradicts',
        isFixture: true,
      });
    } else if (lower.includes('trai') || lower.includes('sim') || lower.includes('block')) {
      sources.push({
        id: 1,
        ...REGULATORY_FIXTURES.trai_scam,
        isFixture: true,
      });
      sources.push({
        id: 2,
        domain: 'cybercrime.gov.in',
        title: 'I4C Advisory: Digital Arrest & TRAI Impersonation Fraud Scheme',
        date: 'Sep 2026',
        type: 'Government',
        url: 'https://cybercrime.gov.in/advisories',
        passage: 'Government agencies do not place citizens under digital arrest via video call, nor do they threaten SIM card suspension to extract money.',
        stance: 'contradicts',
        isFixture: true,
      });
    }
    // For unknown queries with no live search results, do NOT inject fabricated contradicting sources!
    // Returning empty sources (or purely marked general portals if needed) ensures the verdict engine
    // accurately concludes "Unverified" and "Insufficient".
  }

  return sources.map((s, idx) => ({ ...s, id: idx + 1 }));
}
