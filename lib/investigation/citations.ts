import { IndexedSource } from './types';

const STOP_WORDS = new Set([
  'about', 'after', 'against', 'also', 'been', 'being', 'from', 'have', 'into',
  'more', 'only', 'such', 'than', 'that', 'their', 'there', 'these', 'they',
  'this', 'through', 'with', 'would', 'your'
]);

function tokens(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9₹\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length >= 4 && !STOP_WORDS.has(token))
  );
}

export function sanitizeGroundedCitations(text: string, sources: IndexedSource[]): string {
  const sourcesById = new Map(sources.map(source => [source.id, source]));
  return text.replace(/\[(\d+)\]/g, (citation, rawId: string, offset: number, fullText: string) => {
    const source = sourcesById.get(Number(rawId));
    if (!source) return '';

    const contextStart = Math.max(0, fullText.lastIndexOf('\n', offset - 1) + 1);
    const nextBreak = fullText.indexOf('\n', offset + citation.length);
    const contextEnd = nextBreak === -1 ? fullText.length : nextBreak;
    const contextTokens = tokens(fullText.slice(contextStart, contextEnd));
    const sourceTokens = tokens(`${source.title} ${source.passage}`);
    const overlap = [...contextTokens].filter(token => sourceTokens.has(token)).length;
    const requiredOverlap = sourceTokens.size <= 1 ? 1 : 2;
    return overlap >= requiredOverlap ? citation : '';
  });
}

export function extractCitedSourceIds(text: string, sources: IndexedSource[]): number[] {
  const validIds = new Set(sources.map(source => source.id));
  return Array.from(text.matchAll(/\[(\d+)\]/g))
    .map(match => Number(match[1]))
    .filter((id, index, all) => validIds.has(id) && all.indexOf(id) === index);
}
