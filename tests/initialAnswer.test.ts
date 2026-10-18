import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialAnswer, hasInitialAnswerHierarchy } from '../lib/investigation/initialAnswer';
import { IndexedSource, InvestigationVerdicts, VerdictExplanation } from '../lib/investigation/types';

const sources: IndexedSource[] = [
  {
    id: 1,
    domain: 'example.org',
    title: 'Credential safety warning',
    date: 'Date not provided',
    type: 'Search result',
    url: 'https://example.org/warning',
    passage: 'Never share passwords, OTPs, PINs, or card CVV details in response to a message.',
    stance: 'contradicts',
  },
];

const explanation: VerdictExplanation = {
  summary: 'Structured result',
  factualRationale: 'The specific refund claim cannot be confirmed from the available material.',
  authenticityRationale: 'The submitted text does not establish who sent the message.',
  scamRationale: 'The request for a CVV and password is a phishing warning sign.',
  sufficiencyRationale: 'The evidence supports the warning signs but not the sender-specific claim.',
  sourceImpacts: [],
};

describe('Initial answer hierarchy', () => {
  it('uses the required order and keeps truth, authenticity, and scam risk distinct', () => {
    const verdicts: InvestigationVerdicts = {
      factualCorrectness: 'Unverified',
      messageAuthenticity: 'Cannot authenticate',
      scamRisk: 'High',
      evidenceSufficiency: 'Partial',
      riskTriggers: ['Sensitive credential request'],
      verdictStatus: 'unverified',
      explanation,
    };

    const answer = buildInitialAnswer({ assessment: verdicts as import('../lib/investigation/types').StructuredAssessment, sources });
    assert.equal(hasInitialAnswerHierarchy(answer), true);
    assert.ok(answer.indexOf('### Assessment') < answer.indexOf('### Main reasons'));
    assert.ok(answer.indexOf('### Main reasons') < answer.indexOf('### Next steps'));
    assert.match(answer, /factual claim remains unverified/i);
    assert.match(answer, /sender could not be authenticated/i);
    assert.match(answer, /high-risk scam warning signs/i);
    assert.match(answer, /\[1\]/);
  });

  it('limits the main reasons to three and adds no confidence percentage', () => {
    const verdicts: InvestigationVerdicts = {
      factualCorrectness: 'Contradicted',
      messageAuthenticity: 'Not authenticated',
      scamRisk: 'High',
      evidenceSufficiency: 'Insufficient',
      riskTriggers: ['Authority impersonation'],
      verdictStatus: 'false',
      explanation,
    };

    const answer = buildInitialAnswer({ assessment: verdicts as import('../lib/investigation/types').StructuredAssessment, sources });
    const reasonsBlock = answer.split('### Main reasons')[1].split('### Next steps')[0];
    assert.ok(reasonsBlock.split('\n').filter(line => line.startsWith('- ')).length <= 3);
    assert.doesNotMatch(answer, /confidence|\b\d+%/i);
  });

  it('rejects generated briefings that add or reorder sections', () => {
    assert.equal(hasInitialAnswerHierarchy('### Assessment\nA\n### Next steps\n1. B\n### Main reasons\n- C'), false);
    assert.equal(hasInitialAnswerHierarchy('### Assessment\nA\n### Main reasons\n- B\n### Extra\nC\n### Next steps\n1. D'), false);
    assert.equal(hasInitialAnswerHierarchy('### Assessment\nA\n### Main reasons\n- B\n### Next steps\n1. C'), false);
  });

  it('Supported case: provides concrete grounded reasons naming the entity and fact, with citations and no boilerplate', () => {
    const supportedSources: IndexedSource[] = [
      {
        id: 1,
        domain: 'aph.gov.au',
        title: 'Capital of Australia - Parliament of Australia',
        date: 'Aug 2026',
        type: 'Government',
        url: 'https://aph.gov.au/canberra',
        passage: 'Canberra was chosen as the site of Australia\'s national capital in 1908 as a compromise between Sydney and Melbourne.',
        stance: 'supports',
        relevanceScore: 0.95,
      },
      {
        id: 2,
        domain: 'nca.gov.au',
        title: 'National Capital Authority',
        date: 'Jul 2026',
        type: 'Government',
        url: 'https://nca.gov.au/about',
        passage: 'Canberra is the federal capital and seat of government of the Commonwealth of Australia.',
        stance: 'supports',
        relevanceScore: 0.90,
      },
    ];

    const supportedVerdicts: InvestigationVerdicts = {
      factualCorrectness: 'Supported',
      messageAuthenticity: 'Not applicable',
      scamRisk: 'Not applicable',
      evidenceSufficiency: 'Sufficient',
      riskTriggers: [],
      verdictStatus: 'right',
      explanation: {
        summary: 'Supported by official records.',
        factualRationale: 'Authoritative evidence supports the claim.',
        scamRationale: '',
        sufficiencyRationale: 'Sufficient evidence.',
        sourceImpacts: [],
      },
    };

    const answer = buildInitialAnswer({
      assessment: supportedVerdicts as import('../lib/investigation/types').StructuredAssessment,
      sources: supportedSources,
      prompt: 'Canberra is the capital of Australia',
    });

    assert.equal(hasInitialAnswerHierarchy(answer), true);
    // Verifies finding names entity and fact
    assert.match(answer, /aph\.gov\.au/i);
    assert.match(answer, /Canberra/);
    assert.match(answer, /capital/i);
    assert.match(answer, /\[1\]/);
    assert.match(answer, /\[2\]/);

    // Avoids repeating the assessment as a reason
    const reasonsBlock = answer.split('### Main reasons')[1].split('### Next steps')[0];
    assert.doesNotMatch(reasonsBlock, /Relevant evidence directly supports the submitted claim/);

    // Verifies next steps omit unnecessary time-sensitive filler for static facts
    const nextStepsBlock = answer.split('### Next steps')[1];
    assert.doesNotMatch(nextStepsBlock, /time-sensitive/i);
    assert.match(nextStepsBlock, /aph\.gov\.au/);
  });

  it('Contradicted case: explains actual scope difference between national and state capital with citations', () => {
    const scopeSources: IndexedSource[] = [
      {
        id: 1,
        domain: 'aph.gov.au',
        title: 'Parliament of Australia - Canberra',
        date: 'Aug 2026',
        type: 'Government',
        url: 'https://aph.gov.au/canberra-capital',
        passage: 'Canberra is the national capital of Australia. Sydney is the state capital of New South Wales.',
        stance: 'contradicts',
        relevanceScore: 0.95,
      },
    ];

    const contradictedVerdicts: InvestigationVerdicts = {
      factualCorrectness: 'Contradicted',
      messageAuthenticity: 'Not applicable',
      scamRisk: 'Not applicable',
      evidenceSufficiency: 'Sufficient',
      riskTriggers: [],
      verdictStatus: 'false',
      explanation: {
        summary: 'Contradicted by official records.',
        factualRationale: 'Directly contradicts the assertion.',
        scamRationale: '',
        sufficiencyRationale: 'Sufficient evidence.',
        sourceImpacts: [],
      },
    };

    const answer = buildInitialAnswer({
      assessment: contradictedVerdicts as import('../lib/investigation/types').StructuredAssessment,
      sources: scopeSources,
      prompt: 'Sydney is the capital of Australia',
    });

    assert.equal(hasInitialAnswerHierarchy(answer), true);
    // Names the true national capital
    assert.match(answer, /Canberra is the national capital/i);
    // Explains the scope difference
    assert.match(answer, /Sydney serves as the state capital of New South Wales/i);
    assert.match(answer, /\[1\]/);

    // Avoids repeating assessment boilerplate
    const reasonsBlock = answer.split('### Main reasons')[1].split('### Next steps')[0];
    assert.doesNotMatch(reasonsBlock, /Relevant evidence directly conflicts with the submitted claim/);
  });

  it('Mixed case: explains conflicting authorities and jurisdiction differences with citations to both', () => {
    const mixedSources: IndexedSource[] = [
      {
        id: 1,
        domain: 'kserc.org.in',
        title: 'KSERC Solar Tariff Order',
        date: 'Sep 2026',
        type: 'Registry',
        url: 'https://kserc.org.in/solar',
        passage: 'Commission officially approves reduced net metering tariff rates for all grid-connected rooftop solar installations.',
        stance: 'supports',
        relevanceScore: 0.9,
      },
      {
        id: 2,
        domain: 'tnerc.gov.in',
        title: 'TNERC Clarification on Solar Tariffs',
        date: 'Aug 2026',
        type: 'Government',
        url: 'https://tnerc.gov.in/solar',
        passage: 'Commission refutes reports of tariff cuts: full net metering compensation continues without reduction under existing state consumer protection regulations.',
        stance: 'contradicts',
        relevanceScore: 0.9,
      },
    ];

    const mixedVerdicts: InvestigationVerdicts = {
      factualCorrectness: 'Mixed',
      messageAuthenticity: 'Not applicable',
      scamRisk: 'Not applicable',
      evidenceSufficiency: 'Sufficient',
      riskTriggers: [],
      verdictStatus: 'unverified',
      explanation: {
        summary: 'Conflicting state regulatory orders.',
        factualRationale: 'Relevant authoritative sources conflict.',
        scamRationale: '',
        sufficiencyRationale: 'Sufficient evidence.',
        sourceImpacts: [],
      },
    };

    const answer = buildInitialAnswer({
      assessment: mixedVerdicts as import('../lib/investigation/types').StructuredAssessment,
      sources: mixedSources,
      prompt: 'Rooftop solar net metering tariff reduction mandatory across all states',
    });

    assert.equal(hasInitialAnswerHierarchy(answer), true);
    // Explains both sides with citations
    assert.match(answer, /kserc\.org\.in/);
    assert.match(answer, /tnerc\.gov\.in/);
    assert.match(answer, /\[1\]/);
    assert.match(answer, /\[2\]/);
    // Explains jurisdictional divergence
    assert.match(answer, /jurisdiction/i);
  });

  it('Insufficient evidence case: identifies what is missing and explains uncertainty without false declaration', () => {
    const insufficientVerdicts: InvestigationVerdicts = {
      factualCorrectness: 'Unverified',
      messageAuthenticity: 'Not applicable',
      scamRisk: 'Not applicable',
      evidenceSufficiency: 'Insufficient',
      riskTriggers: [],
      verdictStatus: 'unverified',
      explanation: {
        summary: 'Insufficient evidence.',
        factualRationale: 'The available evidence does not confirm or refute the assertion.',
        scamRationale: '',
        sufficiencyRationale: 'No relevant authoritative evidence was identified.',
        sourceImpacts: [],
      },
    };

    const answer = buildInitialAnswer({
      assessment: insufficientVerdicts as import('../lib/investigation/types').StructuredAssessment,
      sources: [],
      prompt: 'Village youth panchayat committee in Rampur approved 500 rupee stipend for all cyclists',
    });

    assert.equal(hasInitialAnswerHierarchy(answer), true);
    // Identifies what is missing
    assert.match(answer, /gazette notification|circular|registry record/i);
    // Explains uncertainty explicitly without asserting falsehood
    assert.match(answer, /absence of public documentation is not proof that the assertion is false/i);
    // Tailored next steps
    assert.match(answer, /gazette repository|department portal/i);
  });
});

