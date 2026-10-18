import { IndexedSource, InvestigationVerdicts, JobOfferAnalysis, VerdictExplanation } from './types';

interface InitialAnswerInput {
  verdicts: InvestigationVerdicts;
  explanation?: VerdictExplanation;
  sources: IndexedSource[];
  jobOfferAnalysis?: JobOfferAnalysis;
}

function citationsFor(
  sources: IndexedSource[],
  predicate: (source: IndexedSource) => boolean,
): string {
  return sources
    .filter(source => !source.isFixture && predicate(source))
    .slice(0, 3)
    .map(source => `[${source.id}]`)
    .join(' ');
}

function withCitations(text: string, citations: string): string {
  const sentence = text.trim().replace(/\s+/g, ' ');
  if (!citations || /\[\d+\]/.test(sentence)) return sentence;
  return `${sentence.replace(/[.]+$/, '')} ${citations}.`;
}

function assessmentText(verdicts: InvestigationVerdicts): string {
  const factual = {
    Supported: 'The factual claim is supported by the available evidence',
    Contradicted: 'The factual claim is contradicted by the available evidence',
    Mixed: 'The factual evidence is mixed',
    Unverified: 'The factual claim remains unverified',
  }[verdicts.factualCorrectness];

  const authenticity = verdicts.messageAuthenticity && verdicts.messageAuthenticity !== 'Not applicable'
    ? verdicts.messageAuthenticity === 'Authenticated'
      ? ', and the sender was authenticated'
      : ', and the specific sender could not be authenticated'
    : '';

  const risk = verdicts.scamRisk === 'High'
    ? 'The message nevertheless contains high-risk scam warning signs.'
    : verdicts.scamRisk === 'Medium'
      ? 'The message contains warning signs that warrant caution.'
      : 'No material scam warning signs were identified from the submitted material.';

  const evidenceLimit = verdicts.evidenceSufficiency === 'Insufficient'
    ? ' The available evidence is too limited for a firmer conclusion.'
    : verdicts.evidenceSufficiency === 'Partial'
      ? ' Some material uncertainty remains because the evidence is partial.'
      : '';

  return `${factual}${authenticity}. ${risk}${evidenceLimit}`;
}

function uniqueReasons(reasons: string[]): string[] {
  const seen = new Set<string>();
  return reasons.filter(reason => {
    const key = reason.toLowerCase().replace(/\[\d+\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

function buildJobOfferAnswer(verdicts: InvestigationVerdicts, analysis: JobOfferAnalysis): string {
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
    '### Assessment',
    `The specific job offer cannot be authenticated from the submitted material. ${warningSummary} Finding a company or careers page would not, by itself, prove that the recruiter is affiliated or that this offer is genuine.`,
    '',
    '### Main reasons',
    ...reasons.map(reason => `- ${reason}`),
    '',
    '### Next steps',
    ...nextSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n');
}

export function buildInitialAnswer({ verdicts, explanation, sources, jobOfferAnalysis }: InitialAnswerInput): string {
  if (jobOfferAnalysis) return buildJobOfferAnswer(verdicts, jobOfferAnalysis);
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

  const defaultFactualReason = {
    Supported: 'Relevant retrieved evidence directly supports the submitted claim.',
    Contradicted: 'Relevant retrieved evidence directly conflicts with the submitted claim.',
    Mixed: 'The relevant sources do not agree or apply to different parts of the claim.',
    Unverified: 'The available evidence does not confirm or disprove the specific claim.',
  }[verdicts.factualCorrectness];

  const reasons = uniqueReasons([
    withCitations(explanation?.factualRationale || defaultFactualReason, factualCitations),
    verdicts.messageAuthenticity && verdicts.messageAuthenticity !== 'Not applicable'
      ? (explanation?.authenticityRationale || 'The submitted material does not provide enough information to verify the sender.')
      : '',
    verdicts.scamRisk !== 'Low'
      ? withCitations(explanation?.scamRationale || 'The message contains suspicious requests or pressure tactics.', warningCitations)
      : '',
    explanation?.sufficiencyRationale || '',
  ]);

  let nextSteps: string[];
  if (verdicts.scamRisk === 'High') {
    nextSteps = [
      'Do not click links, call supplied numbers, or share passwords, PINs, OTPs, CVVs, or banking details.',
      'Verify the message independently through the organisation’s official website or a trusted contact number.',
      'Keep the message and sender details if you need to report it through the appropriate fraud or cybercrime channel.',
    ];
  } else if (verdicts.factualCorrectness === 'Supported') {
    nextSteps = [
      'Check the cited source and the relevant official channel for the exact scope, date, and any action required.',
      'Use only official contact details or portals before sharing information or completing a transaction.',
    ];
  } else {
    nextSteps = [
      'Do not rely on or forward the claim until it is confirmed by the relevant primary source.',
      'Verify it independently through the organisation or authority concerned.',
      'Keep the original message and sender details if the communication appears suspicious.',
    ];
  }

  return [
    '### Assessment',
    assessmentText(verdicts),
    '',
    '### Main reasons',
    ...reasons.map(reason => `- ${reason}`),
    '',
    '### Next steps',
    ...nextSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n');
}

export function hasInitialAnswerHierarchy(markdown: string): boolean {
  const headings = Array.from(markdown.matchAll(/^###\s+(.+)$/gm)).map(match => match[1].trim());
  if (headings.length !== 3 || headings.join('|') !== 'Assessment|Main reasons|Next steps') return false;

  const reasonsBlock = markdown.split(/^### Main reasons\s*$/m)[1]?.split(/^### Next steps\s*$/m)[0] || '';
  const reasons = reasonsBlock.split('\n').filter(line => /^\s*[-*]\s+\S/.test(line));
  const nextStepsBlock = markdown.split(/^### Next steps\s*$/m)[1] || '';
  const nextSteps = nextStepsBlock.split('\n').filter(line => /^\s*\d+[.)]\s+\S/.test(line));
  return reasons.length >= 1 && reasons.length <= 3 && nextSteps.length >= 2 && nextSteps.length <= 3;
}
