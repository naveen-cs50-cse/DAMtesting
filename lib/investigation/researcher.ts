import { IndexedSource, RetrievalStats, UrlAnalysisResult } from './types';
import { REGULATORY_FIXTURES } from './knowledge';
import { getSourceAuthority, getVerifiedPublisherType } from './knowledge';
import { calculateSourceRecency, calculateSourceRelevance } from './verdictEngine';
import { ingestUrlSecurely } from './urlIngestion';

interface TavilySearchResult {
  url: string;
  title?: string;
  content?: string;
  published_date?: string;
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

interface RetrievalDependencies {
  search?: (query: string, apiKey: string) => Promise<TavilySearchResult[]>;
  extract?: (url: string, timeoutMs: number) => Promise<UrlAnalysisResult>;
  maxPages?: number;
  extractionTimeoutMs?: number;
  extractionRetries?: number;
}

const SOCIAL_DOMAINS = new Set([
  'facebook.com', 'instagram.com', 'threads.net', 'x.com', 'twitter.com',
  'tiktok.com', 'youtube.com', 'youtu.be', 'reddit.com', 'linkedin.com',
]);

function hostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'web';
  }
}

function isSocialDomain(domain: string): boolean {
  return [...SOCIAL_DOMAINS].some(candidate => domain === candidate || domain.endsWith(`.${candidate}`));
}

function contentFingerprint(value: string): string {
  return value.toLowerCase().replace(/https?:\/\/\S+/g, '').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 320);
}

function sourceType(domain: string): IndexedSource['type'] {
  return getVerifiedPublisherType(domain) || 'Search result';
}

function evidenceRank(prompt: string, source: IndexedSource): number {
  const relevance = calculateSourceRelevance(prompt, source);
  const authority = getSourceAuthority(source.domain, source.type).weight;
  const recency = calculateSourceRecency(source.date, source.passage);
  const directness = relevance >= 0.72 ? 1 : relevance >= 0.45 ? 0.65 : 0.25;
  const origin = source.contentOrigin === 'fetched_page' ? 1 : 0.72;
  const socialPenalty = isSocialDomain(source.domain) ? 0.18 : 1;
  return (relevance * 0.42 + authority * 0.3 + directness * 0.18 + recency * 0.1) * origin * socialPenalty;
}

export function rankEvidenceForClaim(prompt: string, sources: IndexedSource[]): IndexedSource[] {
  return [...sources].sort((left, right) => {
    const scoreDifference = evidenceRank(prompt, right) - evidenceRank(prompt, left);
    return scoreDifference || left.id - right.id;
  });
}

function deduplicateReposts(prompt: string, sources: IndexedSource[]): IndexedSource[] {
  const byUrl = new Map<string, IndexedSource>();
  const byContent = new Map<string, IndexedSource>();
  for (const source of rankEvidenceForClaim(prompt, sources)) {
    const urlKey = canonicalSourceUrl(source.url);
    const contentKey = contentFingerprint(source.passage);
    if (byUrl.has(urlKey) || (contentKey.length >= 40 && byContent.has(contentKey))) continue;
    byUrl.set(urlKey, source);
    if (contentKey.length >= 40) byContent.set(contentKey, source);
  }
  return [...byUrl.values()];
}

function bestPassage(prompt: string, text: string): string {
  const blocks = text.split(/(?<=[.!?])\s+|\n+/).map(part => part.trim()).filter(part => part.length >= 35);
  if (blocks.length === 0) return text.trim().slice(0, 1200);
  return blocks
    .map(part => ({ part, score: calculateSourceRelevance(prompt, { title: '', passage: part, domain: '' }) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.part)
    .join(' ')
    .slice(0, 1600);
}

async function defaultSearch(query: string, apiKey: string): Promise<TavilySearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: 'advanced', include_answer: false, max_results: 5 }),
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const data = (await response.json()) as TavilySearchResponse;
    return data.results || [];
  } finally {
    clearTimeout(timer);
  }
}

async function extractWithRetry(
  prompt: string,
  source: IndexedSource,
  extract: NonNullable<RetrievalDependencies['extract']>,
  timeoutMs: number,
  retries: number,
): Promise<IndexedSource> {
  let lastResult: UrlAnalysisResult | null = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      lastResult = await extract(source.url, timeoutMs);
    } catch {
      lastResult = null;
      if (attempt < retries) continue;
      break;
    }
    if (lastResult.status === 'success' && lastResult.extractedText.trim()) {
      const finalDomain = hostname(lastResult.finalUrl);
      return {
        ...source,
        domain: finalDomain,
        title: lastResult.title || source.title,
        date: lastResult.publishedDate || source.date,
        type: sourceType(finalDomain),
        url: canonicalSourceUrl(lastResult.canonicalUrl || lastResult.finalUrl),
        passage: bestPassage(prompt, lastResult.extractedText),
        contentOrigin: 'fetched_page',
        inspectionStatus: 'inspected',
      };
    }
    if (lastResult.status !== 'timeout' && lastResult.status !== 'error') break;
  }
  return { ...source, inspectionStatus: 'unavailable' };
}

export async function searchAndReadSources(
  queries: string[],
  prompt: string,
  tavilyKey?: string,
  dependencies: RetrievalDependencies = {},
): Promise<SourceRetrievalResult> {
  let sources: IndexedSource[] = [];
  let searchResultsFound = 0;
  let searchCompleted = false;
  const lower = prompt.toLowerCase();
  const apiKey = tavilyKey || process.env.TAVILY_API_KEY;

  if (apiKey && queries.length > 0) {
    try {
      const search = dependencies.search || defaultSearch;
      const settled = await Promise.allSettled(queries.slice(0, 2).map(query => search(query, apiKey)));
      searchCompleted = settled.some(result => result.status === 'fulfilled');
      const rawSources = settled.flatMap(result => result.status === 'fulfilled' ? result.value : [])
        .filter(result => Boolean(result.url))
        .map((result, index): IndexedSource => {
          const url = canonicalSourceUrl(result.url);
          const domain = hostname(url);
          return {
            id: index + 1,
            domain,
            title: result.title || 'Untitled search result',
            date: result.published_date || 'Date not provided',
            type: sourceType(domain),
            url,
            passage: result.content?.trim() || '',
            stance: 'context',
            isFixture: false,
            contentOrigin: result.content?.trim() ? 'search_snippet' : 'search_metadata',
            inspectionStatus: 'not_inspected',
            isCited: false,
          };
        });
      const deduplicatedResults = deduplicateReposts(prompt, rawSources);
      searchResultsFound = deduplicatedResults.length;
      sources = deduplicatedResults.slice(0, 8);

      const maxPages = Math.max(0, Math.min(dependencies.maxPages ?? 3, 4));
      const timeoutMs = Math.max(1000, Math.min(dependencies.extractionTimeoutMs ?? 5000, 8000));
      const retries = Math.max(0, Math.min(dependencies.extractionRetries ?? 1, 1));
      const extract = dependencies.extract || ((url: string, timeout: number) => ingestUrlSecurely(url, {
        timeoutMs: timeout,
        maxSizeBytes: 2 * 1024 * 1024,
        maxRedirects: 3,
      }));
      const ranked = rankEvidenceForClaim(prompt, sources);
      const selectedUrls = new Set(ranked.slice(0, maxPages).map(source => source.url));
      sources = await Promise.all(ranked.map(source => selectedUrls.has(source.url)
        ? extractWithRetry(prompt, source, extract, timeoutMs, retries)
        : Promise.resolve(source)));
      sources = deduplicateReposts(prompt, rankEvidenceForClaim(prompt, sources));
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

  const normalizedSources = rankEvidenceForClaim(prompt, sources).map((source, index) => ({ ...source, id: index + 1 }));
  return {
    sources: normalizedSources,
    stats: {
      searchAttempted: Boolean(apiKey && queries.length > 0),
      searchCompleted,
      searchResultsFound,
      snippetsAvailable: normalizedSources.filter(source => !source.isFixture && source.contentOrigin === 'search_snippet').length,
      pagesInspected: normalizedSources.filter(source => !source.isFixture && source.inspectionStatus === 'inspected').length,
      pagesUnavailable: normalizedSources.filter(source => !source.isFixture && source.inspectionStatus === 'unavailable').length,
      citedSourceIds: [],
    },
  };
}

