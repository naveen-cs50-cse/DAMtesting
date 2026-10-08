import dns from 'node:dns/promises';
import net from 'node:net';
import { UrlAnalysisResult } from './types';

export interface IngestionOptions {
  timeoutMs?: number;
  maxSizeBytes?: number;
  maxRedirects?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_MAX_REDIRECTS = 5;

// High-profile Indian institutions targeted by phishing / impersonators
const INDIAN_INSTITUTION_TARGETS = [
  { id: 'sbi', name: 'State Bank of India', officialDomain: 'sbi.co.in', keywords: ['sbi', 'yono'] },
  { id: 'rbi', name: 'Reserve Bank of India', officialDomain: 'rbi.org.in', keywords: ['rbi'] },
  { id: 'pib', name: 'Press Information Bureau', officialDomain: 'pib.gov.in', keywords: ['pib'] },
  { id: 'uidai', name: 'UIDAI Aadhaar', officialDomain: 'uidai.gov.in', keywords: ['uidai', 'aadhaar', 'm-aadhaar'] },
  { id: 'incometax', name: 'Income Tax Department', officialDomain: 'incometax.gov.in', keywords: ['incometax', 'itr', 'tax-refund'] },
  { id: 'epfo', name: 'Employees Provident Fund', officialDomain: 'epfindia.gov.in', keywords: ['epfo', 'epfindia', 'uan'] },
  { id: 'parivahan', name: 'Ministry of Road Transport (Parivahan)', officialDomain: 'parivahan.gov.in', keywords: ['parivahan', 'echallan', 'challan'] },
  { id: 'sancharsaathi', name: 'DoT Sanchar Saathi', officialDomain: 'sancharsaathi.gov.in', keywords: ['sancharsaathi', 'chakshu', 'tafcop'] },
  { id: 'cybercrime', name: 'National Cyber Crime Reporting Portal', officialDomain: 'cybercrime.gov.in', keywords: ['cybercrime', '1930'] },
];

/**
 * Validates and normalizes submitted URLs.
 * Strictly permits ONLY http and https protocols.
 */
export function validateAndNormalizeUrl(rawUrl: string): { url: string; domain: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Invalid URL: empty or non-string input provided.');
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    // If user entered "example.com" without scheme, try prefixing https://
    try {
      parsed = new URL(`https://${trimmed}`);
    } catch {
      throw new Error(`Invalid URL format: "${rawUrl}" could not be parsed.`);
    }
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`Disallowed protocol "${protocol}": Only HTTP and HTTPS URLs are permitted.`);
  }

  // Defend against embedded credentials
  if (parsed.username || parsed.password) {
    throw new Error('URL contains embedded user credentials, which are not permitted.');
  }

  // Strip trailing dot from hostname
  let hostname = parsed.hostname.toLowerCase();
  if (hostname.endsWith('.')) {
    hostname = hostname.slice(0, -1);
  }

  // Strip common noisy tracking query parameters while preserving functional parameters
  const trackingParams = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi'
  ]);
  const newParams = new URLSearchParams();
  parsed.searchParams.forEach((val, key) => {
    if (!trackingParams.has(key.toLowerCase())) {
      newParams.append(key, val);
    }
  });

  parsed.search = newParams.toString() ? `?${newParams.toString()}` : '';
  parsed.hash = ''; // Strip fragment

  const normalizedUrl = parsed.toString();
  return {
    url: normalizedUrl,
    domain: hostname
  };
}

/**
 * Detects whether an IP address is a private, loopback, link-local, multicast,
 * cloud metadata, or reserved IP address (IPv4 and IPv6).
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const cleanIp = ip.trim().toLowerCase();

  // 1. IPv4 Checks
  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split('.').map(n => parseInt(n, 10));
    if (parts.length !== 4 || parts.some(isNaN)) return true;

    const [a, b, c] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;

    // 127.0.0.0/8 (Loopback / Localhost)
    if (a === 127) return true;

    // 10.0.0.0/8 (Private Class A)
    if (a === 10) return true;

    // 172.16.0.0/12 (Private Class B: 172.16.0.0 – 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16 (Private Class C)
    if (a === 192 && b === 168) return true;

    // 169.254.0.0/16 (Link-local & Cloud Metadata: AWS/GCP 169.254.169.254)
    if (a === 169 && b === 254) return true;

    // 100.64.0.0/10 (Carrier-Grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 192.0.0.0/24, 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;

    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100) return true;

    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113) return true;

    // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;

    // 224.0.0.0/4 (Multicast)
    if (a >= 224 && a <= 239) return true;

    // 240.0.0.0/4 (Reserved / Future use)
    if (a >= 240) return true;

    return false;
  }

  // 2. IPv6 Checks
  if (net.isIPv6(cleanIp)) {
    // Loopback ::1
    if (cleanIp === '::1' || cleanIp === '0:0:0:0:0:0:0:1') return true;

    // Unspecified ::
    if (cleanIp === '::' || cleanIp === '0:0:0:0:0:0:0:0') return true;

    // Unique Local fc00::/7 (fc00:: or fd00::)
    if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) return true;

    // Link-local fe80::/10 (fe80:: through febf::)
    if (/^fe[89ab]/i.test(cleanIp)) return true;

    // IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (cleanIp.startsWith('::ffff:')) {
      const v4part = cleanIp.slice(7);
      if (net.isIPv4(v4part)) {
        return isPrivateOrReservedIp(v4part);
      }
    }

    return false;
  }

  // If not recognized as valid IPv4 or IPv6, treat conservatively as unsafe
  return true;
}

/**
 * Defends against SSRF, Decimal/Hex/Octal IP evasions, and DNS rebinding attacks.
 * Resolves all addresses for a hostname and verifies none fall into private/internal ranges.
 */
export async function verifyHostSafety(hostname: string): Promise<string[]> {
  const cleanHost = hostname.trim().toLowerCase();

  // 1. Literal localhost or internal metadata names
  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.localhost') ||
    cleanHost === 'metadata.google.internal' ||
    cleanHost === 'instance-data' ||
    cleanHost === 'metadata.aws'
  ) {
    throw new Error(`SSRF blocked: Access to internal host "${cleanHost}" is strictly prohibited.`);
  }

  // 2. Decimal IP notation check (e.g., http://2130706433/ -> 127.0.0.1)
  if (/^\d+$/.test(cleanHost)) {
    const num = parseInt(cleanHost, 10);
    if (!isNaN(num) && num >= 0 && num <= 4294967295) {
      const a = (num >> 24) & 255;
      const b = (num >> 16) & 255;
      const c = (num >> 8) & 255;
      const d = num & 255;
      const decodedIp = `${a}.${b}.${c}.${d}`;
      if (isPrivateOrReservedIp(decodedIp)) {
        throw new Error(`SSRF blocked: Integer host decoded to private IP ${decodedIp}.`);
      }
    }
  }

  // 3. Hexadecimal / Octal IP notation checks (e.g. 0x7f.0.0.1 or 0177.0.0.1)
  if (/^0x[0-9a-f]+(\.0x[0-9a-f]+)*$/i.test(cleanHost) || /^0[0-7]+(\.0[0-7]+)*$/.test(cleanHost)) {
    throw new Error(`SSRF blocked: Hex/Octal IP address format "${cleanHost}" is prohibited.`);
  }

  // 4. Literal IP check
  if (net.isIP(cleanHost)) {
    if (isPrivateOrReservedIp(cleanHost)) {
      throw new Error(`SSRF blocked: Direct connection to private/reserved IP ${cleanHost} is prohibited.`);
    }
    return [cleanHost];
  }

  // 5. DNS Resolution check (defends against DNS rebinding & local resolution)
  try {
    const addresses = await dns.lookup(cleanHost, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new Error(`DNS lookup failed: Could not resolve hostname "${cleanHost}".`);
    }

    const resolvedIps = addresses.map(a => a.address);

    for (const addr of resolvedIps) {
      if (isPrivateOrReservedIp(addr)) {
        throw new Error(
          `SSRF blocked: Hostname "${cleanHost}" resolves to private/internal network IP (${addr}).`
        );
      }
    }

    return resolvedIps;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('SSRF blocked')) throw err;
    throw new Error(`DNS resolution failed for "${cleanHost}": ${msg}`);
  }
}

/**
 * Analyzes domains for punycode, Cyrillic/Greek homoglyphs, deceptive subdomains,
 * and typosquatting of Indian institutions.
 */
export function analyzeDomainRisk(domain: string): UrlAnalysisResult['domainRisk'] {
  const warnings: string[] = [];
  const cleanDomain = domain.toLowerCase();

  // 1. Punycode check (xn--)
  const isPunycode = cleanDomain.startsWith('xn--') || cleanDomain.includes('.xn--');
  if (isPunycode) {
    warnings.push('Domain utilizes Punycode (IDN) representation, often used in homograph phishing.');
  }

  // 2. Homoglyph detection (Cyrillic, Greek, or mixed scripts)
  // Cyrillic characters that look like Latin: а (0430), с (0441), е (0435), о (043e), р (0440), ѕ (0455), і (0456), ј (0458), у (0443), х (0445)
  const cyrillicHomoglyphs = /[\u0400-\u04FF]/;
  const greekHomoglyphs = /[\u0370-\u03FF]/;
  const latinChars = /[a-z]/;

  const hasCyrillic = cyrillicHomoglyphs.test(cleanDomain);
  const hasGreek = greekHomoglyphs.test(cleanDomain);
  const hasLatin = latinChars.test(cleanDomain);

  const hasHomoglyphs = (hasCyrillic || hasGreek) && hasLatin;
  if (hasHomoglyphs) {
    warnings.push('Mixed-script homoglyphs detected: Cyrillic/Greek characters combined with Latin alphabet.');
  }

  // 3. Deceptive Subdomain Analysis (e.g. "sbi.co.in.attacker.com" or "gov.in.fraud.net")
  let isDeceptiveSubdomain = false;
  const officialSubdomainPatterns = [
    /(?:^|\.)gov\.in\./i,
    /(?:^|\.)nic\.in\./i,
    /(?:^|\.)rbi\.org\.in\./i,
    /(?:^|\.)sbi\.co\.in\./i
  ];
  if (officialSubdomainPatterns.some(p => p.test(cleanDomain))) {
    isDeceptiveSubdomain = true;
    warnings.push('Official government / banking domain used deceptively inside a third-party subdomain.');
  }

  // 4. Typosquatting / Impersonation of Indian Institutions
  let typosquatTarget: string | undefined;
  for (const inst of INDIAN_INSTITUTION_TARGETS) {
    if (cleanDomain !== inst.officialDomain && !cleanDomain.endsWith(`.${inst.officialDomain}`)) {
      for (const kw of inst.keywords) {
        // Look for keywords combined with suspicious separators (e.g. sbi-kyc, rbi-verification, epfo-claim)
        const regex = new RegExp(`(^|[-._])${kw}[-._]`, 'i');
        if (regex.test(cleanDomain)) {
          typosquatTarget = `${inst.name} (Official: ${inst.officialDomain})`;
          warnings.push(`Domain mimics official institution "${inst.name}" but does not originate from ${inst.officialDomain}.`);
          break;
        }
      }
      if (typosquatTarget) break;
    }
  }

  // Calculate Risk Level
  let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
  if (isDeceptiveSubdomain || hasHomoglyphs || (typosquatTarget && (isPunycode || warnings.length >= 2))) {
    riskLevel = 'High';
  } else if (isPunycode || typosquatTarget || warnings.length > 0) {
    riskLevel = 'Medium';
  }

  return {
    isPunycode,
    hasHomoglyphs,
    isDeceptiveSubdomain,
    typosquatTarget,
    riskLevel,
    warnings
  };
}

/**
 * Extracts visible clean text, title, author, date, and links from raw HTML.
 */
export function extractHtmlContent(html: string, baseUrl: string): {
  title?: string;
  author?: string;
  publishedDate?: string;
  canonicalUrl?: string;
  visibleText: string;
  wordCount: number;
  outgoingLinks: string[];
  downloadLinks: string[];
} {
  // Title extraction: <title>, <meta property="og:title">, <meta name="twitter:title">
  let title: string | undefined;
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) title = decodeHtmlEntities(titleMatch[1].trim());

  if (!title) {
    const ogTitle = html.match(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitle) title = decodeHtmlEntities(ogTitle[1].trim());
  }

  // Canonical URL extraction: <link rel="canonical" href="...">
  let canonicalUrl: string | undefined;
  const canonicalMatch = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
                         html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  if (canonicalMatch) {
    try {
      canonicalUrl = new URL(canonicalMatch[1].trim(), baseUrl).toString();
    } catch {}
  }

  // Author extraction
  let author: string | undefined;
  const authorMatch = html.match(/<meta\s+[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+[^>]*property=["']article:author["'][^>]*content=["']([^"']+)["']/i);
  if (authorMatch) author = decodeHtmlEntities(authorMatch[1].trim());

  // Published Date extraction
  let publishedDate: string | undefined;
  const dateMatch = html.match(/<meta\s+[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta\s+[^>]*name=["'](?:publish-date|date|pubdate)["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<time\s+[^>]*datetime=["']([^"']+)["']/i);
  if (dateMatch) publishedDate = dateMatch[1].trim().slice(0, 25);

  // Outgoing and Download Links extraction
  const outgoingLinks: string[] = [];
  const downloadLinks: string[] = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"'#]+)["']/gi;
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const rawHref = linkMatch[1].trim();
    if (rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) continue;

    try {
      const resolved = new URL(rawHref, baseUrl).toString();
      const lowerHref = resolved.toLowerCase();

      // Detect executable or mobile APK downloads
      if (
        lowerHref.endsWith('.apk') ||
        lowerHref.endsWith('.exe') ||
        lowerHref.endsWith('.dmg') ||
        lowerHref.endsWith('.msi') ||
        lowerHref.endsWith('.bat') ||
        lowerHref.endsWith('.zip')
      ) {
        if (!downloadLinks.includes(resolved)) downloadLinks.push(resolved);
      }

      if (!outgoingLinks.includes(resolved) && outgoingLinks.length < 50) {
        outgoingLinks.push(resolved);
      }
    } catch {}
  }

  // Strip non-visible elements from HTML for clean text extraction
  let cleanHtml = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ');

  // Convert block elements to newlines
  cleanHtml = cleanHtml
    .replace(/<(?:p|div|br|li|h1|h2|h3|h4|h5|h6|tr|blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  // Decode entities and collapse multiple spaces/newlines
  const visibleText = decodeHtmlEntities(cleanHtml)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  const words = visibleText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  return {
    title,
    author,
    publishedDate,
    canonicalUrl,
    visibleText,
    wordCount,
    outgoingLinks: outgoingLinks.slice(0, 20),
    downloadLinks
  };
}

/**
 * Extracts factual assertions from ingested text for cross-examination.
 */
export function extractFactualClaims(text: string): string[] {
  if (!text || text.length < 40) return [];

  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 30 && s.length <= 300);

  const claims: string[] = [];
  const claimTriggers = [
    'notification', 'circular', 'gazette', 'section', 'order', 'effective from',
    'deadline', 'rupees', 'rs.', '₹', 'penalty', 'disconnection', 'mandatory',
    'clarified', 'announced', 'prohibited', 'banned', 'decision', 'rule'
  ];

  for (const s of sentences) {
    const lower = s.toLowerCase();
    const hasTrigger = claimTriggers.some(t => lower.includes(t));
    if (hasTrigger && !claims.includes(s)) {
      claims.push(s);
      if (claims.length >= 5) break;
    }
  }

  // If no trigger sentences were found, pick the first 2 substantive sentences
  if (claims.length === 0 && sentences.length > 0) {
    claims.push(...sentences.slice(0, 2));
  }

  return claims;
}

/**
 * Decodes standard HTML entities.
 */
export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8377;/g, '₹')
    .replace(/&#x20b9;/g, '₹')
    .replace(/&#(\d+);/g, (_, code) => {
      try {
        return String.fromCharCode(parseInt(code, 10));
      } catch {
        return '';
      }
    });
}

/**
 * Detects whether the URL is a public social media post.
 */
export function detectSocialPlatform(hostname: string): { isSocialPost: boolean; platform?: UrlAnalysisResult['socialPlatform'] } {
  const lower = hostname.toLowerCase();
  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    return { isSocialPost: true, platform: 'twitter' };
  }
  if (lower.includes('reddit.com')) {
    return { isSocialPost: true, platform: 'reddit' };
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return { isSocialPost: true, platform: 'youtube' };
  }
  if (lower.includes('t.me') || lower.includes('telegram.me')) {
    return { isSocialPost: true, platform: 'telegram' };
  }
  return { isSocialPost: false };
}

/**
 * Secure Server-Side Ingestion Service.
 * Follows redirects securely, defends against SSRF & oversized downloads,
 * records redirect history, extracts text, metadata, and claims.
 */
export async function ingestUrlSecurely(
  targetUrl: string,
  options: IngestionOptions = {}
): Promise<UrlAnalysisResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  // 1. Validation & Initial Normalization
  let currentUrlObj: { url: string; domain: string };
  try {
    currentUrlObj = validateAndNormalizeUrl(targetUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      url: targetUrl,
      finalUrl: targetUrl,
      domain: 'invalid',
      status: 'error',
      redirectHistory: [],
      extractedText: '',
      wordCount: 0,
      outgoingLinks: [],
      downloadLinks: [],
      domainRisk: { isPunycode: false, hasHomoglyphs: false, isDeceptiveSubdomain: false, riskLevel: 'Low', warnings: [] },
      claims: [],
      errorDetails: msg
    };
  }

  const initialUrl = currentUrlObj.url;
  let currentUrl = initialUrl;
  const redirectHistory: string[] = [initialUrl];

  const socialCheck = detectSocialPlatform(currentUrlObj.domain);
  const domainRisk = analyzeDomainRisk(currentUrlObj.domain);

  // 2. Multi-hop Secure Fetch Loop
  let redirectCount = 0;
  let responseStatusCode: number | undefined;
  let htmlContent = '';
  let finalUrl = currentUrl;

  while (redirectCount <= maxRedirects) {
    const urlObj = new URL(currentUrl);

    // Defend against SSRF at every single hop!
    try {
      await verifyHostSafety(urlObj.hostname);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        url: initialUrl,
        finalUrl: currentUrl,
        domain: urlObj.hostname,
        status: 'ssrf_blocked',
        redirectHistory,
        extractedText: '',
        wordCount: 0,
        outgoingLinks: [],
        downloadLinks: [],
        domainRisk,
        claims: [],
        errorDetails: msg
      };
    }

    // Set up AbortController with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual', // Enforce manual redirects so we re-verify SSRF on every hop!
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 UseDAM-Verifier/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8'
        },
        signal: controller.signal
      });

      clearTimeout(timer);
      responseStatusCode = res.status;

      // Handle Redirects
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        if (!location) {
          throw new Error(`Received redirect status ${res.status} with no Location header.`);
        }

        const nextUrl = new URL(location, currentUrl).toString();
        const nextNormalized = validateAndNormalizeUrl(nextUrl);

        currentUrl = nextNormalized.url;
        redirectHistory.push(currentUrl);
        redirectCount++;

        if (redirectCount > maxRedirects) {
          throw new Error(`Exceeded maximum allowed redirects (${maxRedirects}).`);
        }
        continue;
      }

      finalUrl = currentUrl;

      // Handle Safe Failure States
      if (res.status === 404 || res.status === 410) {
        return {
          url: initialUrl,
          finalUrl,
          domain: new URL(finalUrl).hostname,
          status: 'deleted',
          statusCode: res.status,
          redirectHistory,
          extractedText: '',
          wordCount: 0,
          outgoingLinks: [],
          downloadLinks: [],
          domainRisk,
          claims: [],
          errorDetails: `Resource is unavailable (HTTP ${res.status}: Not Found / Gone). The linked page may have been deleted.`
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          url: initialUrl,
          finalUrl,
          domain: new URL(finalUrl).hostname,
          status: 'private',
          statusCode: res.status,
          redirectHistory,
          extractedText: '',
          wordCount: 0,
          outgoingLinks: [],
          downloadLinks: [],
          domainRisk,
          claims: [],
          errorDetails: `Access restricted (HTTP ${res.status}: Forbidden / Unauthorized). The target content requires authentication or is private.`
        };
      }

      if (!res.ok) {
        return {
          url: initialUrl,
          finalUrl,
          domain: new URL(finalUrl).hostname,
          status: 'blocked',
          statusCode: res.status,
          redirectHistory,
          extractedText: '',
          wordCount: 0,
          outgoingLinks: [],
          downloadLinks: [],
          domainRisk,
          claims: [],
          errorDetails: `Server returned error status HTTP ${res.status} (${res.statusText}).`
        };
      }

      // Check Content-Length upfront
      const contentLengthHeader = res.headers.get('content-length');
      if (contentLengthHeader) {
        const declaredSize = parseInt(contentLengthHeader, 10);
        if (!isNaN(declaredSize) && declaredSize > maxSizeBytes) {
          throw new Error(`Content length (${declaredSize} bytes) exceeds maximum limit (${maxSizeBytes} bytes).`);
        }
      }

      // Stream body with strict size ceiling
      if (res.body) {
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.length;
            if (totalBytes > maxSizeBytes) {
              await reader.cancel();
              throw new Error(`Download aborted: Content size exceeded maximum allowed limit of ${maxSizeBytes} bytes.`);
            }
            chunks.push(value);
          }
        }

        const buffer = Buffer.concat(chunks);
        htmlContent = buffer.toString('utf-8');
      } else {
        htmlContent = await res.text();
      }

      break;
    } catch (fetchErr) {
      clearTimeout(timer);
      const isAbort = (fetchErr as Error)?.name === 'AbortError';
      const msg = isAbort ? `Connection timed out after ${timeoutMs}ms.` : (fetchErr instanceof Error ? fetchErr.message : String(fetchErr));

      return {
        url: initialUrl,
        finalUrl: currentUrl,
        domain: new URL(currentUrl).hostname,
        status: isAbort ? 'timeout' : 'error',
        statusCode: responseStatusCode,
        redirectHistory,
        extractedText: '',
        wordCount: 0,
        outgoingLinks: [],
        downloadLinks: [],
        domainRisk,
        claims: [],
        errorDetails: msg
      };
    }
  }

  // 3. Extract content & claims from HTML
  const extracted = extractHtmlContent(htmlContent, finalUrl);
  const claims = extractFactualClaims(extracted.visibleText);

  // Re-evaluate domain risk on final resolved URL if it differed
  const finalDomain = new URL(finalUrl).hostname;
  const finalDomainRisk = finalDomain !== currentUrlObj.domain ? analyzeDomainRisk(finalDomain) : domainRisk;

  return {
    url: initialUrl,
    finalUrl,
    canonicalUrl: extracted.canonicalUrl,
    domain: finalDomain,
    status: 'success',
    statusCode: responseStatusCode,
    redirectHistory,
    title: extracted.title,
    author: extracted.author,
    publishedDate: extracted.publishedDate,
    extractedText: extracted.visibleText,
    wordCount: extracted.wordCount,
    isSocialPost: socialCheck.isSocialPost,
    socialPlatform: socialCheck.platform,
    outgoingLinks: extracted.outgoingLinks,
    downloadLinks: extracted.downloadLinks,
    domainRisk: finalDomainRisk,
    claims
  };
}
