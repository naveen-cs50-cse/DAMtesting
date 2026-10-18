import { Conversation, IndexedSource, InvestigationMeta } from './types';
import { getAssessment } from './assessment';
import { answerCopy, localizeAssessmentForDisplay } from './localization';
import type { ResponseLanguage } from './types';

export interface ShareBriefingPayload {
  text: string;
  sourceLinks: Array<{ id: number; label: string; url: string }>;
  dateChecked: string;
}

function redactIdentifiers(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email omitted]')
    .replace(/(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g, '[phone omitted]')
    .replace(/\b(?:aadhaar|aadhar|pan|passport|ssn|account|application|candidate)\s*(?:no\.?|number|id)?\s*[:#-]\s*[A-Z0-9-]{4,}\b/gi, '[identifier omitted]')
    .replace(/https?:\/\/\S+/gi, '[link omitted]')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeSourceUrl(source: IndexedSource): string | null {
  try {
    const url = new URL(source.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function citedSources(meta: InvestigationMeta): Array<{ id: number; label: string; url: string }> {
  const citedIds = new Set(meta.retrieval?.citedSourceIds || []);
  return (meta.sources || [])
    .filter(source => !source.isFixture && (source.isCited || citedIds.has(source.id)))
    .map(source => {
      const url = safeSourceUrl(source);
      if (!url) return null;
      return {
        id: source.id,
        label: redactIdentifiers(source.title || source.domain) || source.domain,
        url,
      };
    })
    .filter((source): source is { id: number; label: string; url: string } => Boolean(source))
    .slice(0, 3);
}

function assessment(meta: InvestigationMeta): string {
  const validation = getAssessment(meta);
  if (!validation.ok) {
    return `A validated assessment is unavailable because processing failed: ${validation.error}`;
  }
  const language = meta.language || 'en';
  const verdicts = validation.assessment;
  if (language === 'en') {
    const parts = [`Factual support is ${verdicts.factualCorrectness.toLowerCase()}.`];
    if (verdicts.messageAuthenticity !== 'Not applicable') parts.push(`The specific message is ${verdicts.messageAuthenticity.toLowerCase()}.`);
    if (verdicts.scamRisk !== 'Not applicable') parts.push(`Scam indicators were assessed as ${verdicts.scamRisk.toLowerCase()} risk.`);
    return parts.join(' ');
  }
  return localizeAssessmentForDisplay(verdicts, language).explanation?.summary || '';
}

function keyReasons(meta: InvestigationMeta): string[] {
  if (meta.taskType === 'job_offer' && meta.jobOfferAnalysis) {
    const analysis = meta.jobOfferAnalysis;
    const warningSignals = [
      analysis.paymentRequest ? 'a payment request was identified' : 'no explicit payment request was identified',
      analysis.sensitiveDataRequest ? 'a sensitive-data request was identified' : 'no explicit sensitive-data request was identified',
      analysis.domainWarning ? 'the sender domain requires independent verification' : '',
    ].filter(Boolean).join('; ');
    return [
      `Completed — Message warning-sign review: ${warningSignals}.`,
      `${analysis.checks[1]?.status === 'completed' ? 'Completed' : 'Not completed'} — Company and careers information: ${analysis.checks[1]?.status === 'completed' ? 'A public-web search was run; its results do not authenticate the offer.' : 'The available details or retrieval capability did not permit this check.'}`,
      `${analysis.checks[2]?.status === 'completed' ? 'Completed' : 'Not completed'} — Recruiter affiliation and specific offer: ${analysis.checks[2]?.status === 'completed' ? 'A direct check failed.' : 'No direct employer confirmation was available.'}`,
    ];
  }

  const validation = getAssessment(meta);
  if (!validation.ok) return [`Assessment processing failed: ${validation.error}`];
  const verdicts = validation.assessment;
  const explanation = verdicts.explanation;
  return [
    explanation?.factualRationale,
    verdicts.messageAuthenticity !== 'Not applicable' ? explanation?.authenticityRationale : undefined,
    verdicts.scamRisk !== 'Low' && verdicts.scamRisk !== 'Not applicable' ? explanation?.scamRationale : undefined,
  ]
    .filter((reason): reason is string => Boolean(reason?.trim()))
    .map(redactIdentifiers)
    .filter(Boolean)
    .slice(0, 3);
}

function materialUncertainty(meta: InvestigationMeta): string {
  const validation = getAssessment(meta);
  if (!validation.ok) return `The structured assessment could not be validated: ${validation.error}`;
  const verdicts = validation.assessment;
  const language = meta.language || 'en';
  if (language === 'hi') {
    if (verdicts.messageAuthenticity === 'Cannot authenticate') return 'सार्वजनिक साक्ष्य विशिष्ट प्रेषक, लेनदेन या संचार की पुष्टि नहीं कर सकते।';
    if (verdicts.evidenceSufficiency === 'Insufficient') return 'उपलब्ध सार्वजनिक साक्ष्य विशिष्ट दावे की पुष्टि या खंडन के लिए अपर्याप्त हैं।';
    if (verdicts.evidenceSufficiency === 'Partial') return 'उपलब्ध साक्ष्य दावे के केवल एक हिस्से को संबोधित करते हैं, इसलिए एक महत्वपूर्ण कमी बनी हुई है।';
    return 'यह आकलन जाँच की तारीख को उपलब्ध उद्धृत सार्वजनिक साक्ष्य तक सीमित है।';
  }
  if (language === 'ta') {
    if (verdicts.messageAuthenticity === 'Cannot authenticate') return 'பொது ஆதாரங்களால் குறிப்பிட்ட அனுப்புநர், பரிவர்த்தனை அல்லது தகவலை உறுதிப்படுத்த முடியாது.';
    if (verdicts.evidenceSufficiency === 'Insufficient') return 'குறிப்பிட்ட கூற்றை உறுதிப்படுத்தவோ மறுக்கவோ கிடைக்கும் பொது ஆதாரம் போதவில்லை.';
    if (verdicts.evidenceSufficiency === 'Partial') return 'கிடைக்கும் ஆதாரம் கூற்றின் ஒரு பகுதியை மட்டுமே குறிப்பிடுவதால் முக்கிய இடைவெளி உள்ளது.';
    return 'இந்த மதிப்பீடு சரிபார்த்த தேதியில் கிடைத்த மேற்கோள் காட்டப்பட்ட பொது ஆதாரங்களுக்குள் மட்டுப்படுத்தப்பட்டுள்ளது.';
  }
  if (verdicts.messageAuthenticity === 'Cannot authenticate') {
    return 'Public evidence cannot authenticate the specific sender, transaction, or communication.';
  }
  if (verdicts.evidenceSufficiency === 'Insufficient') {
    return 'The available public evidence is insufficient to confirm or disprove the specific claim.';
  }
  if (verdicts.evidenceSufficiency === 'Partial') {
    return 'The available evidence addresses only part of the claim, so a material gap remains.';
  }
  return 'This assessment is limited to the cited public evidence available on the date checked.';
}

function checkedDate(value: string | undefined, fallback: Date): string {
  const parsed = value ? new Date(value) : fallback;
  const valid = Number.isNaN(parsed.getTime()) ? fallback : parsed;
  return valid.toISOString().slice(0, 10);
}

export function buildShareBriefing(conversation: Conversation, fallbackDate = new Date()): ShareBriefingPayload | null {
  const lastAssistant = [...conversation.turns]
    .reverse()
    .find(turn => turn.role === 'assistant' && !turn.isLive && turn.meta && turn.meta.taskType !== 'conversational' && turn.meta.taskType !== 'follow_up');
  const meta = lastAssistant?.meta;
  if (!lastAssistant || !meta) return null;
  // A terminal stream event is not proof that the investigation produced a
  // valid result. Failed/malformed assessments must remain non-shareable.
  if (!getAssessment(meta).ok) return null;
  const language: ResponseLanguage = meta.language || lastAssistant.language || 'en';
  const answer = answerCopy(language);
  const labels = language === 'hi'
    ? { title: 'UseDAM जाँच सार', reasons: 'मुख्य कारण', sources: 'सहायक स्रोत', date: 'जाँच की तारीख', uncertainty: 'महत्वपूर्ण अनिश्चितता', none: 'पूर्ण उत्तर में कोई सहायक स्रोत उद्धृत नहीं किया गया।', noReason: 'कोई अतिरिक्त साक्ष्य-आधारित कारण दर्ज नहीं हुआ।' }
    : language === 'ta'
      ? { title: 'UseDAM ஆய்வுச் சுருக்கம்', reasons: 'முக்கிய காரணங்கள்', sources: 'ஆதரவு ஆதாரங்கள்', date: 'சரிபார்த்த தேதி', uncertainty: 'முக்கிய நிச்சயமின்மை', none: 'முடிக்கப்பட்ட பதிலில் ஆதரவு ஆதாரம் மேற்கோள் காட்டப்படவில்லை.', noReason: 'கூடுதல் ஆதார அடிப்படையிலான காரணம் பதிவு செய்யப்படவில்லை.' }
      : { title: 'UseDAM investigation briefing', reasons: 'Key reasons', sources: 'Supporting sources', date: 'Date checked', uncertainty: 'Material uncertainty', none: 'No supporting source was cited in the completed answer.', noReason: 'No additional evidence-backed reason was recorded.' };

  const sources = citedSources(meta);
  const dateChecked = checkedDate(lastAssistant.createdAt, fallbackDate);
  const reasons = keyReasons(meta);
  const sourceLines = sources.length > 0
    ? sources.map(source => `- [${source.id}] ${source.label}: ${source.url}`)
    : [`- ${labels.none}`];

  const text = [
    labels.title,
    '',
    answer.headings.assessment,
    assessment(meta),
    '',
    labels.reasons,
    ...(reasons.length > 0 ? reasons.map(reason => `- ${reason}`) : [`- ${labels.noReason}`]),
    '',
    labels.sources,
    ...sourceLines,
    '',
    `${labels.date}: ${dateChecked}`,
    `${labels.uncertainty}: ${materialUncertainty({ ...meta, language })}`,
  ].join('\n');

  return { text, sourceLinks: sources, dateChecked };
}
