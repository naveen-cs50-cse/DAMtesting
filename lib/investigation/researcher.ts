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

  return sources.map((s, idx) => ({ ...s, id: idx + 1 }));
}

