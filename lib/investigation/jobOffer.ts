import { IndexedSource, JobOfferAnalysis, MessageAuthenticity, RetrievalStats } from './types';

const JOB_CONTEXT = /\b(job offer|offer letter|employment offer|recruiter|recruitment|hiring manager|interview invitation|joining letter|onboarding|vacancy|position at|role at|candidate)\b/i;
const PAYMENT_REQUEST = /\b(registration fee|application fee|processing fee|training fee|security deposit|background check fee|equipment (?:fee|purchase|payment)|pay(?:ment)? (?:first|upfront|to proceed)|send (?:money|funds)|wire transfer|gift cards?|cryptocurrency|crypto payment)\b/i;
const SENSITIVE_DATA_REQUEST = /\b(passport|aadhaar|aadhar|pan card|social security|ssn|bank account|account number|routing number|credit card|debit card|cvv|otp|password|login credentials?)\b/i;
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'yahoo.com', 'yahoo.co.in', 'proton.me', 'protonmail.com', 'icloud.com',
]);

function cleanCompany(value: string): string | undefined {
  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/\b(?:for|as|with|and|but|starting|located|salary|package|position|role)\b.*$/i, '')
    .replace(/^[\s:,-]+|[\s:,.!-]+$/g, '')
    .trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 80) return undefined;
  return cleaned.split(' ').slice(0, 6).join(' ');
}

export function isJobOfferContent(text: string, attachmentNames: string[] = []): boolean {
  return JOB_CONTEXT.test(`${text} ${attachmentNames.join(' ')}`);
}

export function extractClaimedCompany(text: string): string | undefined {
  const patterns = [
    /\b(?:company|employer|organisation|organization)\s*:\s*([^\n\r.;]+)/i,
    /\b(?:job offer|offer letter|employment offer)\s+(?:from|at|with)\s+([^\n\r.;]+)/i,
    /\b(?:position|role|job)\s+at\s+([^\n\r.;]+)/i,
    /\b(?:join|joining)\s+([^\n\r.;]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const company = match?.[1] ? cleanCompany(match[1]) : undefined;
    if (company) return company;
  }
  return undefined;
}

export function extractEmailDomains(text: string): string[] {
  const domains = Array.from(text.matchAll(/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi))
    .map(match => match[1].toLowerCase().replace(/[),.;:]+$/, ''));
  return Array.from(new Set(domains));
}

export function redactJobOfferPersonalData(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi, '[redacted]@$1')
    .replace(/(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g, '[redacted phone]')
    .replace(/\b(?:aadhaar|aadhar|pan|passport|ssn|candidate|application)\s*(?:no\.?|number|id)?\s*[:#-]\s*[A-Z0-9-]{4,}\b/gi, match => `${match.split(/[:#-]/)[0].trim()}: [redacted]`)
    .replace(/\b(dear|hello)\s+([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,2})(?=[,\n])/gi, '$1 [redacted candidate]');
}

function matchingSourceIds(company: string | undefined, domains: string[], sources: IndexedSource[]): number[] {
  const companyTokens = (company?.toLowerCase().match(/[a-z0-9]{3,}/g) || [])
    .filter(token => !['company', 'limited', 'private', 'technologies'].includes(token));
  return sources.filter(source => {
    const haystack = `${source.domain} ${source.title} ${source.passage}`.toLowerCase();
    return domains.some(domain => haystack.includes(domain)) || companyTokens.some(token => haystack.includes(token));
  }).slice(0, 2).map(source => source.id);
}

export function analyzeJobOffer(
  text: string,
  sources: IndexedSource[] = [],
  retrieval?: RetrievalStats,
  authenticity: MessageAuthenticity = 'Cannot authenticate',
): JobOfferAnalysis {
  const claimedCompany = extractClaimedCompany(text);
  const senderDomains = extractEmailDomains(text);
  const publicEmailDomain = senderDomains.find(domain => FREE_EMAIL_DOMAINS.has(domain));
  const sourceIds = matchingSourceIds(claimedCompany, senderDomains, sources);
  const hasSearchIdentifier = Boolean(claimedCompany || senderDomains.length > 0);
  const searchCompleted = Boolean(retrieval?.searchCompleted && hasSearchIdentifier);
  const pagesInspected = retrieval?.pagesInspected || 0;

  const companyTokens = (claimedCompany?.toLowerCase().match(/[a-z0-9]{3,}/g) || [])
    .filter(token => !['company', 'limited', 'private', 'technologies', 'systems'].includes(token));
  const mismatchedDomain = !publicEmailDomain && claimedCompany
    ? senderDomains.find(domain => companyTokens.length > 0 && !companyTokens.some(token => domain.includes(token)))
    : undefined;
  const domainWarning = publicEmailDomain
    ? `The sender uses the public email domain ${publicEmailDomain}; that does not establish affiliation with the claimed employer.`
    : mismatchedDomain
      ? `The sender domain ${mismatchedDomain} does not visibly match the claimed employer name. A staffing agency is possible, so this is a warning to verify rather than proof of fraud.`
      : undefined;

  const checks: JobOfferAnalysis['checks'] = [
    {
      label: 'Message warning-sign review',
      status: 'completed',
      finding: `${PAYMENT_REQUEST.test(text) ? 'A payment request was found.' : 'No explicit payment request was found.'} ${SENSITIVE_DATA_REQUEST.test(text) ? 'A sensitive-data request was found.' : 'No explicit sensitive-data request was found.'}${domainWarning ? ` ${domainWarning}` : ''}`,
    },
    {
      label: 'Company and careers information',
      status: searchCompleted ? 'completed' : 'not_completed',
      finding: searchCompleted
        ? `The public-web search returned ${retrieval?.searchResultsFound || 0} deduplicated result(s); ${pagesInspected} page(s) were inspected. Search results alone do not authenticate the offer.`
        : !hasSearchIdentifier
          ? 'This check could not be completed because no employer name or recruiter email domain was available.'
          : 'This check could not be completed because live retrieval was unavailable or did not finish.',
      sourceIds,
    },
    {
      label: 'Recruiter affiliation and specific offer',
      status: authenticity === 'Not authenticated' ? 'completed' : 'not_completed',
      finding: authenticity === 'Not authenticated'
        ? 'A direct sender, domain, or document check failed; the specific offer was not authenticated.'
        : 'No direct employer confirmation was available, so recruiter affiliation and the specific offer could not be authenticated.',
    },
  ];

  return {
    claimedCompany,
    senderDomains,
    paymentRequest: PAYMENT_REQUEST.test(text),
    sensitiveDataRequest: SENSITIVE_DATA_REQUEST.test(text),
    domainWarning,
    checks,
    followUpQuestion: !claimedCompany && senderDomains.length === 0
      ? "What employer is named, and what domain appears after @ in the recruiter's email address?"
      : undefined,
  };
}
