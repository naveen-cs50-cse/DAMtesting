import { IndexedSource, RetrievalStats } from './types';
import { REGULATORY_FIXTURES } from './knowledge';

interface TavilySearchResult {
  url: string;
  title?: string;
  content?: string;
}

interface TavilySearchResponse {
  results?: TavilySearchResult[];
}

export function canonicalSourceUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/$/, '') || '/';
    return url.toString();
  } catch {
    return rawUrl.trim();
  }
}

export interface SourceRetrievalResult {
  sources: IndexedSource[];
  stats: RetrievalStats;
}

export async function searchAndReadSources(
  queries: string[],
  prompt: string,
  tavilyKey?: string
): Promise<SourceRetrievalResult> {
  let sources: IndexedSource[] = [];
  let searchResultsFound = 0;
  let searchCompleted = false;
  const lower = prompt.toLowerCase();
  const apiKey = tavilyKey || process.env.TAVILY_API_KEY;

  if (apiKey && queries.length > 0) {
    try {
      const searchResponses = await Promise.all(
        queries.slice(0, 2).map(query => fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            search_depth: 'advanced',
            include_answer: false,
            max_results: 4,
          }),
        }))
      );

      const resultGroups = await Promise.all(searchResponses.map(async response => {
        if (!response.ok) return [];
        const data = (await response.json()) as TavilySearchResponse;
        return data.results || [];
      }));
      searchCompleted = true;

      const seenUrls = new Set<string>();
      const uniqueResults = resultGroups.flat().filter(result => {
        const canonicalUrl = result.url ? canonicalSourceUrl(result.url) : '';
        if (!canonicalUrl || seenUrls.has(canonicalUrl)) return false;
        seenUrls.add(canonicalUrl);
        result.url = canonicalUrl;
        return true;
      });
      searchResultsFound = uniqueResults.length;

      if (uniqueResults.length > 0) {
        sources = uniqueResults
          .filter(result => Boolean(result.url && result.content?.trim()))
          .slice(0, 6)
          .map((r, i) => {
            let domain = 'web';
            try {
              domain = new URL(r.url).hostname.replace(/^www\./, '');
            } catch {
              domain = 'web';
            }

            return {
              id: i + 1,
              domain,
              title: r.title || 'Untitled search result',
              date: 'Date not provided',
              // A search result URL alone is not enough to authenticate its publisher.
              type: 'Search result',
              url: r.url,
              passage: r.content!.trim(),
              stance: 'context' as const,
              isFixture: false, // Explicitly live evidence from search
              contentOrigin: 'search_snippet',
              inspectionStatus: 'not_inspected',
              isCited: false,
            };
          });
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
    } else if (lower.includes('yono') || lower.includes('sbi') || (lower.includes('apk') && lower.includes('bank'))) {
      sources.push({
        id: 1,
        ...REGULATORY_FIXTURES.sbi_yono_apk,
        isFixture: true,
      });
      sources.push({
        id: 2,
        domain: 'cert-in.org.in',
        title: 'CERT-In Threat Advisory: Fake Android Banking Trojans Targeting Indian Bank Users',
        date: 'Oct 2026',
        type: 'Government',
        url: 'https://cert-in.org.in/advisories',
        passage: 'Users are strictly cautioned against installing .apk files shared via SMS, WhatsApp, or Telegram. Legitimate banks never distribute application updates outside Google Play Store.',
        stance: 'contradicts',
        isFixture: true,
      });
    } else if (lower.includes('wedding') || (lower.includes('invitation') && lower.includes('apk'))) {
      sources.push({
        id: 1,
        ...REGULATORY_FIXTURES.wedding_card_apk,
        isFixture: true,
      });
      sources.push({
        id: 2,
        domain: 'sancharsaathi.gov.in',
        title: 'Chakshu Cyber Security Alert: Malicious Wedding Card APK Malware',
        date: 'Oct 2026',
        type: 'Government',
        url: 'https://sancharsaathi.gov.in/sfc/',
        passage: 'Fake wedding cards packaged as .apk files are high-risk malware. Do not click or install. Report the sender number on Chakshu immediately.',
        stance: 'contradicts',
        isFixture: true,
      });
    } else if (lower.includes('digital arrest') || lower.includes('cbi') || lower.includes('skype') || lower.includes('police video')) {
      sources.push({
        id: 1,
        ...REGULATORY_FIXTURES.digital_arrest,
        isFixture: true,
      });
      sources.push({
        id: 2,
        domain: 'cybercrime.gov.in',
        title: 'MHA National Police Portal: Digital Arrest Is a Fraud Scheme — Disconnect Immediately',
        date: 'Oct 2026',
        type: 'Government',
        url: 'https://cybercrime.gov.in',
        passage: 'No legal authority in India conducts digital arrests over phone or video call. Any demand to transfer money to a "safety account" is extortion.',
        stance: 'contradicts',
        isFixture: true,
      });
    } else if (lower.includes('tax') && (lower.includes('refund') || lower.includes('itax') || lower.includes('pan'))) {
      sources.push({
        id: 1,
        ...REGULATORY_FIXTURES.income_tax_phishing,
        isFixture: true,
      });
      sources.push({
        id: 2,
        domain: 'pib.gov.in',
        title: 'PIB Fact Check: Income Tax Department Warning on Fake Refund SMS',
        date: 'Sep 2026',
        type: 'Government',
        url: 'https://pib.gov.in/FactCheck/income-tax-refund',
        passage: 'Income Tax Department does not ask for card details or banking passwords over SMS to release refunds. Official portal is eportal.incometax.gov.in.',
        stance: 'contradicts',
        isFixture: true,
      });
    }

    // Baseline primary statutory and verification registry fallback
    if (sources.length === 0) {
      sources.push({
        id: 1,
        domain: 'pib.gov.in',
        title: 'PIB Fact Check & Verification Unit — Government of India',
        date: '2026',
        type: 'Government',
        url: 'https://factcheck.pib.gov.in',
        passage: 'Official institutional fact-checking desk monitoring viral social media claims, gazette notifications, and cyber advisories against primary ministry orders.',
        stance: 'context',
        isFixture: true,
      });
      sources.push({
        id: 2,
        domain: 'cybercrime.gov.in',
        title: 'National Cyber Crime Reporting Portal (I4C, MHA)',
        date: '2026',
        type: 'Registry',
        url: 'https://cybercrime.gov.in',
        passage: 'Official statutory portal under the Ministry of Home Affairs providing citizen guidance, statutory warnings, and evidence registry for digital scams and cyber threats.',
        stance: 'context',
        isFixture: true,
      });
    }
  }

  const normalizedSources = sources.map((source, index) => ({ ...source, id: index + 1 }));
  return {
    sources: normalizedSources,
    stats: {
      searchAttempted: Boolean(apiKey && queries.length > 0),
      searchCompleted,
      searchResultsFound,
      snippetsAvailable: normalizedSources.filter(source => !source.isFixture && source.contentOrigin === 'search_snippet').length,
      pagesInspected: 0,
      pagesUnavailable: 0,
      citedSourceIds: [],
    },
  };
}

