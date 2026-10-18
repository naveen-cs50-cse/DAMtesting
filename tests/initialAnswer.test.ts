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
    };

    const answer = buildInitialAnswer({ verdicts, explanation, sources });
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
    };

    const answer = buildInitialAnswer({ verdicts, explanation, sources });
    const reasonsBlock = answer.split('### Main reasons')[1].split('### Next steps')[0];
    assert.ok(reasonsBlock.split('\n').filter(line => line.startsWith('- ')).length <= 3);
    assert.doesNotMatch(answer, /confidence|\b\d+%/i);
  });

  it('rejects generated briefings that add or reorder sections', () => {
    assert.equal(hasInitialAnswerHierarchy('### Assessment\nA\n### Next steps\n1. B\n### Main reasons\n- C'), false);
    assert.equal(hasInitialAnswerHierarchy('### Assessment\nA\n### Main reasons\n- B\n### Extra\nC\n### Next steps\n1. D'), false);
    assert.equal(hasInitialAnswerHierarchy('### Assessment\nA\n### Main reasons\n- B\n### Next steps\n1. C'), false);
  });
});
