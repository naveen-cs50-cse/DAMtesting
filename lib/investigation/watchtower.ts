export interface WatchtowerAdvisory {
  id: string;
  source: 'PIB Fact Check' | 'RBI Circular' | 'TRAI Public Notice' | 'CERT-In Advisory' | 'I4C MHA';
  category: 'Banking' | 'Telecom' | 'Government Scheme' | 'Cyber Security' | 'Judiciary';
  title: string;
  verdict: 'FAKE' | 'SCAM ALERT' | 'REGULATORY WARNING' | 'ADVISORY';
  summary: string;
  officialUrl: string;
  date: string;
  bulletinId: string;
}

export const WATCHTOWER_FEED: WatchtowerAdvisory[] = [
  {
    id: 'wt-01',
    source: 'RBI Circular',
    category: 'Banking',
    title: 'Discontinuation Rumor of ₹500 Legal Tender Notes',
    verdict: 'FAKE',
    summary: 'The Reserve Bank of India confirms that ₹500 notes of Mahatma Gandhi (New) Series continue to remain legal tender. No demonetization order has been issued.',
    officialUrl: 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx',
    date: 'Oct 2024',
    bulletinId: 'RBI/2024-25/PR-114'
  },
  {
    id: 'wt-02',
    source: 'I4C MHA',
    category: 'Cyber Security',
    title: 'Spurious "Digital Arrest" Summons via Video Calls',
    verdict: 'SCAM ALERT',
    summary: 'Cyber criminals impersonating Police, CBI, and Customs officers are placing citizens under fake video calls demanding bail deposits. No law allows digital arrests.',
    officialUrl: 'https://cybercrime.gov.in',
    date: 'Nov 2024',
    bulletinId: 'I4C-ADVISORY-2024-09'
  },
  {
    id: 'wt-03',
    source: 'TRAI Public Notice',
    category: 'Telecom',
    title: 'Deceptive SMS Disconnection Warnings from 10-Digit SIMs',
    verdict: 'SCAM ALERT',
    summary: 'State electricity utilities do not issue urgent power disconnection notices from personal 10-digit mobile SIMs. All genuine notifications use registered DLT alpha headers.',
    officialUrl: 'https://trai.gov.in',
    date: 'Sep 2024',
    bulletinId: 'TRAI/PR/2024/72'
  },
  {
    id: 'wt-04',
    source: 'PIB Fact Check',
    category: 'Government Scheme',
    title: 'Viral "PM Kanya Sumangala ₹60,000 Direct Cash" Claim',
    verdict: 'FAKE',
    summary: 'A viral message claiming the Central Government is depositing ₹60,000 in bank accounts of all daughters under a new scheme is completely fabricated.',
    officialUrl: 'https://factcheck.pib.gov.in',
    date: 'Dec 2024',
    bulletinId: 'PIB-FC-2024-883'
  },
  {
    id: 'wt-05',
    source: 'CERT-In Advisory',
    category: 'Cyber Security',
    title: 'Trojanized APKs Mimicking State Electricity DISCOM Apps',
    verdict: 'REGULATORY WARNING',
    summary: 'CERT-In identifies malicious Android APK executables distributed via WhatsApp links harvesting SMS OTPs and banking credentials outside Google Play.',
    officialUrl: 'https://www.cert-in.org.in',
    date: 'Nov 2024',
    bulletinId: 'CIAD-2024-0048'
  },
  {
    id: 'wt-06',
    source: 'RBI Circular',
    category: 'Banking',
    title: 'Customer Protection: Limiting Liability in Unauthorized Electronic Transactions',
    verdict: 'ADVISORY',
    summary: 'Zero liability applies to consumers if unauthorized electronic financial transactions are notified to the respective bank within 3 working days.',
    officialUrl: 'https://rbi.org.in',
    date: 'Aug 2024',
    bulletinId: 'RBI/DBR/2024-25/78'
  }
];

export function getWatchtowerFeed(query?: string, category?: string): WatchtowerAdvisory[] {
  let feed = [...WATCHTOWER_FEED];
  if (category && category !== 'All') {
    feed = feed.filter(item => item.category.toLowerCase() === category.toLowerCase());
  }
  if (query) {
    const q = query.toLowerCase();
    feed = feed.filter(
      item =>
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }
  return feed;
}
