import type { ResponseLanguage, RetrievalStats } from './types';

const labels = {
  en: { found: 'Found results', inspected: 'pages inspected', snippets: 'Snippet-only', unavailable: 'Unavailable', cited: 'sources cited' },
  hi: { found: 'परिणाम', inspected: 'पृष्ठ जाँचे', snippets: 'केवल स्निपेट', unavailable: 'अनुपलब्ध', cited: 'स्रोत उद्धृत' },
  ta: { found: 'முடிவுகள்', inspected: 'பக்கங்கள் ஆய்வு', snippets: 'துணுக்குகள் மட்டும்', unavailable: 'கிடைக்கவில்லை', cited: 'ஆதாரங்கள் மேற்கோள்' },
} as const;

export function formatRetrievalSummary(stats: RetrievalStats, language: ResponseLanguage = 'en'): string {
  const copy = language === 'hi' ? labels.hi : language === 'ta' ? labels.ta : labels.en;
  return [
    `${copy.found} ${stats.searchResultsFound}`,
    `${copy.inspected} ${stats.pagesInspected}`,
    `${copy.snippets} ${stats.snippetsAvailable}`,
    ...(stats.pagesUnavailable > 0 ? [`${copy.unavailable} ${stats.pagesUnavailable}`] : []),
    `${copy.cited} ${new Set(stats.citedSourceIds).size}`,
  ].join(' · ');
}
