import { ResponseLanguage } from './types';

export interface SeparatedClaim {
  factualClaim: string;
  originalClaim: string;
  isQuestion: boolean;
  requestedLanguage?: ResponseLanguage;
}

// Common conversational / interrogative wrappers in English and Indic languages
const INTERROGATIVE_PREFIXES = [
  // English
  /^(?:fact[- ]check\s+(?:whether|if)?|factcheck\s+(?:whether|if)?|verify\s+(?:whether|if)?|check\s+(?:whether|if)?|is\s+it\s+true\s+(?:that)?|please\s+check\s+(?:if|whether)?|can\s+you\s+check\s+(?:if|whether)?|can\s+you\s+verify\s+(?:if|whether)?|tell\s+me\s+if|tell\s+me\s+whether)\s+/i,
  // Hindi / Devanagari
  /^(?:क्या\s+यह\s+सच\s+है\s+कि|क्या\s+यह\s+सही\s+है\s+कि|क्या\s+यह\s+सत्य\s+है\s+कि|क्या\s+ऐसा\s+है\s+कि|कृपया\s+जाँचें\s+कि|कृपया\s+बताएं\s+कि|जाँच\s+करें\s+कि|सत्यापित\s+करें\s+कि|क्या)\s+/u,
  // Tamil
  /^(?:இது\s+உண்மையா\s+என்று\s+சரிபார்க்கவும்|சரிபார்க்கவும்|உண்மையா)\s+/u,
];

const INTERROGATIVE_SUFFIXES = [
  // English
  /[?,.]*\s*(?:is\s+this\s+true|is\s+that\s+true|is\s+it\s+true|is\s+this\s+correct|is\s+that\s+correct|true\s+or\s+false|right\s+or\s+wrong)\??$/i,
  // Hindi / Devanagari
  /[?,।.]*\s*(?:क्या\s+यह\s+सच\s+है|क्या\s+यह\s+सही\s+है|क्या\s+यह\s+सत्य\s+है|सच\s+है\s+या\s+झूठ|सही\s+है\s+या\s+गलत|क्या\s+ऐसा\s+है)\??$/u,
  // Tamil
  /[?,.]*\s*(?:இது\s+உண்மையா|இது\s+சரியா)\??$/u,
];

const LANGUAGE_INSTRUCTION_PATTERNS: Array<{ pattern: RegExp; lang: ResponseLanguage }> = [
  // English phrasing
  { pattern: /\b(?:please\s+)?(?:answer|reply|respond|write|explain|provide\s+briefing)\s+(?:to\s+me\s+)?in\s+(hindi|english|marathi|tamil|bengali|bangla|telugu)\b/i, lang: 'en' },
  // Hindi / Devanagari phrasing
  { pattern: /(?:कृपया\s+)?(?:हिंदी|हिन्दी)\s+(?:में\s+)?(?:उत्तर|जवाब|बताएं|लिखें|जानकारी)?(?:\s*(?:दीजिए|दें|देना))?/u, lang: 'hi' },
  { pattern: /(?:कृपया\s+)?(?:अंग्रेजी|अंग्रेज़ी|english)\s+(?:में\s+)?(?:उत्तर|जवाब|बताएं|लिखें)?(?:\s*(?:दीजिए|दें|देना))?/u, lang: 'en' },
  { pattern: /(?:कृपया\s+)?(?:मराठी)\s+(?:में\s+)?(?:उत्तर|जवाब|बताएं|लिखें)?(?:\s*(?:दीजिए|दें|देना))?/u, lang: 'mr' },
  { pattern: /(?:कृपया\s+)?(?:तमिल|தமிழ்)\s+(?:में\s+)?(?:उत्तर|जवाब|बताएं|लिखें)?(?:\s*(?:दीजिए|दें|देना))?/u, lang: 'ta' },
  { pattern: /(?:कृपया\s+)?(?:बंगाली|বাংলা)\s+(?:में\s+)?(?:उत्तर|जवाब|बताएं|लिखें)?(?:\s*(?:दीजिए|दें|देना))?/u, lang: 'bn' },
  { pattern: /(?:कृपया\s+)?(?:तेलुगु|తెలుగు)\s+(?:में\s+)?(?:उत्तर|जवाब|बताएं|लिखें)?(?:\s*(?:दीजिए|दें|देना))?/u, lang: 'te' },
  // Tamil phrasing
  { pattern: /(?:தயவுசெய்து\s+)?தமிழில்\s+(?:பதிலளிக்கவும்|விளக்கவும்|எழுதவும்)/u, lang: 'ta' },
];

/**
 * Separates user instructions (e.g. language requests, verification wrappers)
 * from the core factual claim to prevent instructions from polluting queries,
 * stance detection, and relevance scoring.
 */
export function separateClaimAndInstructions(prompt: string): SeparatedClaim {
  let cleaned = prompt.trim();
  let requestedLanguage: ResponseLanguage | undefined;

  // 1. Detect and strip language instructions
  for (const { pattern, lang } of LANGUAGE_INSTRUCTION_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      if (lang === 'en' && match[1]) {
        const langMap: Record<string, ResponseLanguage> = {
          hindi: 'hi', english: 'en', marathi: 'mr', tamil: 'ta',
          bengali: 'bn', bangla: 'bn', telugu: 'te'
        };
        requestedLanguage = langMap[match[1].toLowerCase()] || 'en';
      } else {
        requestedLanguage = lang;
      }
      cleaned = cleaned.replace(pattern, '').trim();
    }
  }

  // 2. Identify if prompt had question structure
  const isQuestion = cleaned.endsWith('?') ||
    INTERROGATIVE_SUFFIXES.some(pat => pat.test(cleaned)) ||
    INTERROGATIVE_PREFIXES.some(pat => pat.test(cleaned));

  // 3. Strip interrogative wrappers
  for (const pat of INTERROGATIVE_SUFFIXES) {
    cleaned = cleaned.replace(pat, '').trim();
  }

  for (const pat of INTERROGATIVE_PREFIXES) {
    cleaned = cleaned.replace(pat, '').trim();
  }

  // Strip dangling punctuation from boundaries
  cleaned = cleaned.replace(/^[?,!.:;।\s]+|[?,!.:;।\s]+$/gu, '').trim();

  return {
    factualClaim: cleaned || prompt.trim(),
    originalClaim: prompt.trim(),
    isQuestion,
    requestedLanguage,
  };
}

/**
 * Canonical cross-lingual entity registry: maps canonical key to known aliases in
 * English, Hindi (Devanagari), Tamil, etc.
 */
interface EntityRecord {
  canonical: string;
  aliases: string[];
}

const ENTITY_REGISTRY: EntityRecord[] = [
  // Jurisdictions & Countries
  { canonical: 'india', aliases: ['india', 'republic of india', 'भारत', 'इंडिया', 'இந்தியா', 'భారతదేశం', 'ভারত'] },
  { canonical: 'australia', aliases: ['australia', 'commonwealth of australia', 'ऑस्ट्रेलिया', 'ஆஸ்திரேலியா', 'ఆస్ట్రేలియా'] },
  { canonical: 'united states', aliases: ['united states', 'usa', 'united states of america', 'america', 'संयुक्त राज्य अमेरिका', 'अमेरिका', 'அமெரிக்கா'] },
  { canonical: 'united kingdom', aliases: ['united kingdom', 'uk', 'britain', 'great britain', 'यूनाइटेड किंगडम', 'ब्रिटेन', 'பிரிட்டன்'] },
  { canonical: 'france', aliases: ['france', 'french republic', 'फ्रांस', 'பிரான்ஸ்'] },
  { canonical: 'germany', aliases: ['germany', 'federal republic of germany', 'जर्मनी', 'ஜெர்மனி'] },
  { canonical: 'japan', aliases: ['japan', 'जापान', 'ஜப்பான்'] },
  { canonical: 'china', aliases: ['china', 'peoples republic of china', 'चीन', 'சீனா'] },
  { canonical: 'russia', aliases: ['russia', 'russian federation', 'रूस', 'ரஷ்யா'] },

  // Capitals & Cities
  { canonical: 'new delhi', aliases: ['new delhi', 'delhi', 'national capital territory of delhi', 'नई दिल्ली', 'दिल्ली', 'புது தில்லி', 'தில்லி', 'న్యూఢిల్లీ'] },
  { canonical: 'canberra', aliases: ['canberra', 'national capital canberra', 'कैनबरा', 'கான்பெரா', 'కాన్‌బెర్రా'] },
  { canonical: 'sydney', aliases: ['sydney', 'city of sydney', 'सिडनी', 'சிட்னி', 'సిడ్నీ'] },
  { canonical: 'melbourne', aliases: ['melbourne', 'मेलबर्न', 'மெல்போர்ன்'] },
  { canonical: 'washington', aliases: ['washington', 'washington dc', 'washington, d.c.', 'वाशिंगटन', 'वाशिंगटन डीसी', 'வாஷிங்டன்'] },
  { canonical: 'london', aliases: ['london', 'लंदन', 'லண்டன்'] },
  { canonical: 'paris', aliases: ['paris', 'पेरिस', 'பாரிஸ்'] },
  { canonical: 'berlin', aliases: ['berlin', 'बर्लिन', 'பெர்லின்'] },
  { canonical: 'tokyo', aliases: ['tokyo', 'टोक्यो', 'டோக்கியோ'] },
  { canonical: 'beijing', aliases: ['beijing', 'बीजिंग', 'பெய்ஜிங்'] },
  { canonical: 'moscow', aliases: ['moscow', 'मास्को', 'मॉस्को', 'மாஸ்கோ'] },

  // Indian States & Capitals
  { canonical: 'maharashtra', aliases: ['maharashtra', 'महाराष्ट्र', 'மகாராஷ்டிரா'] },
  { canonical: 'mumbai', aliases: ['mumbai', 'bombay', 'मुंबई', 'बॉम्बे', 'மும்பை'] },
  { canonical: 'karnataka', aliases: ['karnataka', 'कर्नाटक', 'கர்நாடகா'] },
  { canonical: 'bengaluru', aliases: ['bengaluru', 'bangalore', 'बेंगलुरु', 'बैंगलोर', 'பெங்களூரு'] },
  { canonical: 'tamil nadu', aliases: ['tamil nadu', 'tamilnadu', 'तमिलनाडु', 'தமிழ்நாடு'] },
  { canonical: 'chennai', aliases: ['chennai', 'madras', 'चेन्नई', 'மद्रास', 'சென்னை'] },
  { canonical: 'west bengal', aliases: ['west bengal', 'पश्चिम बंगाल', 'மேற்கு வங்காளம்'] },
  { canonical: 'kolkata', aliases: ['kolkata', 'calcutta', 'कोलकाता', 'कलकत्ता', 'கொல்கத்தா'] },
  { canonical: 'gujarat', aliases: ['gujarat', 'गुजरात', 'குஜராத்'] },
  { canonical: 'gandhinagar', aliases: ['gandhinagar', 'गांधीनगर', 'காந்திநகர்'] },
  { canonical: 'uttar pradesh', aliases: ['uttar pradesh', 'उत्तर प्रदेश', 'உத்தரப் பிரதேசம்'] },
  { canonical: 'lucknow', aliases: ['lucknow', 'लखनऊ', 'லக்னோ'] },
  { canonical: 'new south wales', aliases: ['new south wales', 'nsw', 'न्यू साउथ वेल्स'] },
];

interface RelationRecord {
  canonical: string;
  aliases: string[];
}

const RELATION_REGISTRY: RelationRecord[] = [
  { canonical: 'capital', aliases: ['capital', 'national capital', 'federal capital', 'state capital', 'seat of government', 'राजधानी', 'राष्ट्रीय राजधानी', 'தலைநகரம்', 'రాజధాని'] },
  { canonical: 'prime minister', aliases: ['prime minister', 'pm', 'प्रधानमंत्री', 'प्रधान मंत्री', 'பிரதமர்'] },
  { canonical: 'president', aliases: ['president', 'राष्ट्रपति', 'ஜனாதிபதி'] },
  { canonical: 'currency', aliases: ['currency', 'legal tender', 'banknote', 'मुद्रा', 'நாணயம்', 'కరెన్సీ'] },
  { canonical: 'headquarters', aliases: ['headquarters', 'hq', 'head office', 'मुख्यालय', 'प्रधान कार्यालय', 'தலைமையகம்'] },
  { canonical: 'chief minister', aliases: ['chief minister', 'cm', 'मुख्यमंत्री', 'முதலமைச்சர்'] },
  { canonical: 'official language', aliases: ['official language', 'राजभाषा', 'आधिकारिक भाषा', 'அதிகாரப்பூர்வ மொழி'] },
];

/**
 * Returns all cross-lingual aliases for a named entity.
 */
export function getEntityAliases(rawEntity: string): string[] {
  const norm = rawEntity.trim().toLowerCase();
  const found = ENTITY_REGISTRY.find(entry =>
    entry.aliases.some(alias => alias.toLowerCase() === norm || norm.includes(alias.toLowerCase()))
  );
  if (found) {
    return Array.from(new Set([norm, ...found.aliases]));
  }
  return [norm];
}

/**
 * Returns all cross-lingual aliases for a relation/role.
 */
export function getRelationAliases(rawRelation: string): string[] {
  const norm = rawRelation.trim().toLowerCase();
  const found = RELATION_REGISTRY.find(entry =>
    entry.aliases.some(alias => alias.toLowerCase() === norm || norm.includes(alias.toLowerCase()))
  );
  if (found) {
    return Array.from(new Set([norm, ...found.aliases]));
  }
  return [norm];
}

/**
 * Expands a set of tokens with known cross-lingual aliases.
 */
export function expandTokensWithCrossLingualAliases(tokens: string[]): string[] {
  const result = new Set<string>(tokens);
  for (const token of tokens) {
    const tLower = token.toLowerCase();
    for (const record of ENTITY_REGISTRY) {
      if (record.aliases.some(a => a.toLowerCase() === tLower)) {
        for (const alias of record.aliases) {
          alias.toLowerCase().split(/\s+/).forEach(piece => result.add(piece));
        }
      }
    }
    for (const record of RELATION_REGISTRY) {
      if (record.aliases.some(a => a.toLowerCase() === tLower)) {
        for (const alias of record.aliases) {
          alias.toLowerCase().split(/\s+/).forEach(piece => result.add(piece));
        }
      }
    }
  }
  return Array.from(result);
}

export interface IndicClaimParse {
  subject: string;
  scope: string;
  relation: string;
  qualifier?: string;
  isNegated: boolean;
}

/**
 * Parses Indic (Hindi / Tamil) subject-object-verb grammar structures into
 * Subject, Relation, and Scope.
 */
export function parseIndicClaimStructure(text: string): IndicClaimParse | null {
  const trimmed = text.trim();
  const isNegated = /\b(?:नहीं|न|गलत|झूठ|இல்லை)\b/u.test(trimmed);

  // Pattern H1: [Scope] की/का/के [Qualifier?] [Relation] [Subject] है
  // e.g. "भारत की राजधानी नई दिल्ली है"
  const h1Match = trimmed.match(/^([^,]+?)\s+(?:की|का|के)\s+(?:(राष्ट्रीय|राज्यीय|आधिकारिक|प्रांतीय)\s+)?([^\s,]+)\s+([^,]+?)\s*(?:है|था|थी|थे|हैं)?$/u);
  if (h1Match) {
    const [, scp, qual, rel, subj] = h1Match;
    return {
      subject: subj.trim(),
      scope: scp.trim(),
      relation: rel.trim(),
      qualifier: qual?.trim(),
      isNegated,
    };
  }

  // Pattern H2: [Subject] [Scope] की/का/के [Qualifier?] [Relation] है
  // e.g. "नई दिल्ली भारत की राजधानी है"
  const h2Match = trimmed.match(/^([^,]+?)\s+([^,]+?)\s+(?:की|का|के)\s+(?:(राष्ट्रीय|राज्यीय|आधिकारिक|प्रांतीय)\s+)?([^\s,]+)\s*(?:है|था|थी|थे|हैं)?$/u);
  if (h2Match) {
    const [, subj, scp, qual, rel] = h2Match;
    return {
      subject: subj.trim(),
      scope: scp.trim(),
      relation: rel.trim(),
      qualifier: qual?.trim(),
      isNegated,
    };
  }

  // Pattern T1 (Tamil): [Subject] [Scope](யின்/வின்/ன்) [Relation]
  // e.g. "புது தில்லி இந்தியாவின் தலைநகரம்"
  const t1Match = trimmed.match(/^([^,]+?)\s+([^,]+?)(?:யின்|வின்|இன்|ன்)\s+(?:(தேசிய|மாநில|அதிகாரப்பூர்வ)\s+)?([^\s,]+)\s*(?:ஆகும்|ஆக\s+இருந்தது|இருக்கும்)?$/u);
  if (t1Match) {
    const [, subj, scp, qual, rel] = t1Match;
    return {
      subject: subj.trim(),
      scope: scp.trim(),
      relation: rel.trim(),
      qualifier: qual?.trim(),
      isNegated,
    };
  }

  return null;
}

/**
 * Builds authoritative cross-lingual search queries for an Indic claim.
 * Produces queries in the native language AND in English for authoritative records.
 */
export function buildMultilingualQueries(factualClaim: string): { nativeQuery: string; authoritativeQuery?: string } {
  const isIndic = /[\p{Script=Devanagari}\p{Script=Tamil}\p{Script=Bengali}\p{Script=Telugu}]/u.test(factualClaim);
  if (!isIndic) {
    return { nativeQuery: factualClaim };
  }

  const parsed = parseIndicClaimStructure(factualClaim);
  if (parsed) {
    // Find English equivalents of Subject, Scope, Relation
    const subjEnglish = getEntityAliases(parsed.subject).find(a => /^[a-z\s]+$/i.test(a)) || parsed.subject;
    const scopeEnglish = getEntityAliases(parsed.scope).find(a => /^[a-z\s]+$/i.test(a)) || parsed.scope;
    const relEnglish = getRelationAliases(parsed.relation).find(a => /^[a-z\s]+$/i.test(a)) || parsed.relation;

    return {
      nativeQuery: factualClaim,
      authoritativeQuery: `${subjEnglish} ${relEnglish} of ${scopeEnglish} official records`,
    };
  }

  return {
    nativeQuery: factualClaim,
  };
}
