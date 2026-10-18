import { IndexedSource, JobOfferAnalysis, ResponseLanguage, StructuredAssessment, VerdictExplanation } from './types';
import { requireStructuredAssessment } from './assessment';
import { RESPONSE_LANGUAGES, answerCopy } from './localization';

interface InitialAnswerInput {
  assessment: StructuredAssessment;
  sources: IndexedSource[];
  jobOfferAnalysis?: JobOfferAnalysis;
  language?: ResponseLanguage;
}

function citationsFor(
  sources: IndexedSource[],
  predicate: (source: IndexedSource) => boolean,
): string {
  return sources
    .filter(source =>
      !source.isFixture &&
      (source.relevanceScore ?? 1) >= 0.4 &&
      source.impactRole !== 'insufficient_relevance' &&
      predicate(source)
    )
    .slice(0, 3)
    .map(source => `[${source.id}]`)
    .join(' ');
}

function withCitations(text: string, citations: string): string {
  const sentence = text.trim().replace(/\s+/g, ' ');
  if (!citations || /\[\d+\]/.test(sentence)) return sentence;
  return `${sentence.replace(/[.]+$/, '')} ${citations}.`;
}

function assessmentText(verdicts: StructuredAssessment, language: ResponseLanguage): string {
  const copy = answerCopy(language);
  return [
    copy.factual[verdicts.factualCorrectness],
    copy.authenticity[verdicts.messageAuthenticity],
    copy.scam[verdicts.scamRisk],
    copy.sufficiency[verdicts.evidenceSufficiency],
  ].filter(Boolean).join('. ').replace(/\.\s*\./g, '.');
}

function uniqueReasons(reasons: string[]): string[] {
  const seen = new Set<string>();
  return reasons.filter(reason => {
    const key = reason.toLocaleLowerCase().replace(/\[\d+\]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

function buildJobOfferAnswer(analysis: JobOfferAnalysis, language: ResponseLanguage): string {
  const copy = answerCopy(language);
  if (language === 'hi' || language === 'ta') {
    const hindi = language === 'hi';
    const assessment = hindi
      ? 'प्रस्तुत सामग्री से इस विशिष्ट नौकरी प्रस्ताव की प्रामाणिकता की पुष्टि नहीं की जा सकती। कंपनी का अस्तित्व अपने आप में भर्तीकर्ता की संबद्धता या इस प्रस्ताव की प्रामाणिकता सिद्ध नहीं करता।'
      : 'சமர்ப்பிக்கப்பட்ட தகவலால் இந்த குறிப்பிட்ட வேலை வாய்ப்பின் நம்பகத்தன்மையை உறுதிப்படுத்த முடியாது. நிறுவனம் இருப்பது மட்டும் ஆட்சேர்ப்பாளரின் தொடர்பையோ இந்த வாய்ப்பின் உண்மைத்தன்மையையோ நிரூபிக்காது.';
    const reasons = hindi
      ? [analysis.paymentRequest ? 'संदेश में भुगतान का अनुरोध मिला।' : 'कोई स्पष्ट भुगतान अनुरोध नहीं मिला।', analysis.sensitiveDataRequest ? 'संदेश में संवेदनशील व्यक्तिगत जानकारी का अनुरोध मिला।' : 'संवेदनशील जानकारी का कोई स्पष्ट अनुरोध नहीं मिला।', analysis.domainWarning ? 'प्रेषक डोमेन की स्वतंत्र पुष्टि आवश्यक है।' : 'उपलब्ध सामग्री से भर्तीकर्ता की संबद्धता की पुष्टि नहीं हुई।']
      : [analysis.paymentRequest ? 'செய்தியில் பணம் கோரப்பட்டுள்ளது.' : 'வெளிப்படையான பணக் கோரிக்கை இல்லை.', analysis.sensitiveDataRequest ? 'செய்தியில் முக்கிய தனிப்பட்ட தகவல் கோரப்பட்டுள்ளது.' : 'முக்கிய தகவலுக்கான வெளிப்படையான கோரிக்கை இல்லை.', analysis.domainWarning ? 'அனுப்புநர் களத்தைத் தனியாகச் சரிபார்க்க வேண்டும்.' : 'கிடைக்கும் தகவலால் ஆட்சேர்ப்பாளர் தொடர்பு உறுதிப்படுத்தப்படவில்லை.'];
    return [`### ${copy.headings.assessment}`, assessment, '', `### ${copy.headings.reasons}`, ...reasons.map(reason => `- ${reason}`), '', `### ${copy.headings.nextSteps}`, ...copy.nextSteps.suspicious.map((step, index) => `${index + 1}. ${step}`)].join('\n');
  }
  const warningSummary = analysis.paymentRequest && analysis.sensitiveDataRequest
    ? 'The message requests both payment and sensitive personal information.'
    : analysis.paymentRequest
      ? 'The message includes a payment request, which is a material warning sign.'
      : analysis.sensitiveDataRequest
        ? 'The message requests sensitive personal information, which warrants caution.'
        : 'No explicit payment or sensitive-data request was found in the supplied text.';

  const reasons = analysis.checks.slice(0, 3).map(check => {
    const citations = (check.sourceIds || []).map(id => `[${id}]`).join(' ');
    return `${check.status === 'completed' ? 'Completed' : 'Not completed'} — ${check.label}: ${withCitations(check.finding, citations)}`;
  });
  const nextSteps = [
    analysis.followUpQuestion || 'Confirm the recruiter through contact details published on the employer’s official careers website, not through details in the offer.',
    'Do not pay fees or send identity, banking, password, or one-time-code details until the employer independently confirms the recruiter and offer.',
    'Keep the original message and document metadata for the employer’s security team or the appropriate fraud-reporting channel.',
  ];

  return [
    `### ${copy.headings.assessment}`,
    `The specific job offer cannot be authenticated from the submitted material. ${warningSummary} Finding a company or careers page would not, by itself, prove that the recruiter is affiliated or that this offer is genuine.`,
    '',
    `### ${copy.headings.reasons}`,
    ...reasons.map(reason => `- ${reason}`),
    '',
    `### ${copy.headings.nextSteps}`,
    ...nextSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n');
}

export function buildInitialAnswer({ assessment, sources, jobOfferAnalysis, language = 'en' }: InitialAnswerInput): string {
  const verdicts = requireStructuredAssessment(assessment);
  const copy = answerCopy(language);
  const explanation: VerdictExplanation = verdicts.explanation!;
  if (jobOfferAnalysis) return buildJobOfferAnswer(jobOfferAnalysis, language);
  const factualCitations = citationsFor(sources, source =>
    verdicts.factualCorrectness === 'Supported'
      ? source.stance === 'supports'
      : verdicts.factualCorrectness === 'Contradicted'
        ? source.stance === 'contradicts'
        : source.stance !== 'context'
  );
  const warningCitations = citationsFor(sources, source =>
    /\b(cvv|otp|password|pin|bank(?:ing)? details|card details|phishing|scam|fraud)\b/i.test(`${source.title} ${source.passage}`)
  );

  const defaultFactualReason = copy.factualReason[verdicts.factualCorrectness];

  const reasons = uniqueReasons([
    withCitations(explanation?.factualRationale || defaultFactualReason, factualCitations),
    verdicts.messageAuthenticity && verdicts.messageAuthenticity !== 'Not applicable'
      ? (explanation?.authenticityRationale || copy.authenticityReason[verdicts.messageAuthenticity])
      : '',
    verdicts.scamRisk !== 'Low' && verdicts.scamRisk !== 'Not applicable'
      ? withCitations(explanation?.scamRationale || copy.scamReason[verdicts.scamRisk], warningCitations)
      : '',
    explanation?.sufficiencyRationale || '',
  ]);

  const nextSteps = verdicts.scamRisk === 'High' || verdicts.scamRisk === 'Medium'
    ? copy.nextSteps.suspicious
    : copy.nextSteps[verdicts.factualCorrectness];

  return [
    `### ${copy.headings.assessment}`,
    assessmentText(verdicts, language),
    '',
    `### ${copy.headings.reasons}`,
    ...reasons.map(reason => `- ${reason}`),
    '',
    `### ${copy.headings.nextSteps}`,
    ...nextSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n');
}

export function hasInitialAnswerHierarchy(markdown: string): boolean {
  const headings = Array.from(markdown.matchAll(/^###\s+(.+)$/gm)).map(match => match[1].trim());
  const matchingCopy = RESPONSE_LANGUAGES.map(answerCopy).find(copy => headings.join('|') === Object.values(copy.headings).join('|'));
  if (headings.length !== 3 || !matchingCopy) return false;

  const reasonsBlock = markdown.split(new RegExp(`^### ${matchingCopy.headings.reasons}\\s*$`, 'm'))[1]?.split(new RegExp(`^### ${matchingCopy.headings.nextSteps}\\s*$`, 'm'))[0] || '';
  const reasons = reasonsBlock.split('\n').filter(line => /^\s*[-*]\s+\S/.test(line));
  const nextStepsBlock = markdown.split(new RegExp(`^### ${matchingCopy.headings.nextSteps}\\s*$`, 'm'))[1] || '';
  const nextSteps = nextStepsBlock.split('\n').filter(line => /^\s*\d+[.)]\s+\S/.test(line));
  return reasons.length >= 1 && reasons.length <= 3 && nextSteps.length >= 2 && nextSteps.length <= 3;
}
