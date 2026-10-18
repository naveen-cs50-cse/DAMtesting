import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeVerdictEngine } from '../lib/investigation/verdictEngine';
import { IndexedSource } from '../lib/investigation/types';

describe('Evidence-Driven Verdict Engine', () => {

  describe('1. Supported Case', () => {
    it('should determine Supported when authoritative sources agree and corroborate the claim', () => {
      const claim = 'RBI updates sovereign green bond issuance framework for scheduled commercial banks';
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'rbi.org.in',
          title: 'Reserve Bank of India: Sovereign Green Bonds Framework and Issuance Guidelines',
          date: 'Feb 2026',
          type: 'Government',
          url: 'https://rbi.org.in/scripts/green-bonds',
          passage: 'The Reserve Bank of India has officially announced and notified the updated sovereign green bonds framework for commercial banks.',
          stance: 'supports'
        },
        {
          id: 2,
          domain: 'pib.gov.in',
          title: 'Ministry of Finance: Cabinet Approves Sovereign Green Bond Framework Guidelines',
          date: 'Jan 2026',
          type: 'Government',
          url: 'https://pib.gov.in/PressRelease/green-bonds',
          passage: 'Cabinet approves sovereign green bond guidelines with mandatory compliance for eligible scheduled banks starting 2026.',
          stance: 'supports'
        }
      ];

      const result = executeVerdictEngine({
        prompt: claim,
        taskType: 'research',
        sources
      });

      assert.equal(result.verdicts.factualCorrectness, 'Supported');
      assert.equal(result.verdicts.evidenceSufficiency, 'Sufficient');
      assert.equal(result.verdicts.scamRisk, 'Not applicable');
      assert.equal(result.verdicts.messageAuthenticity, 'Not applicable');
      assert.equal(result.explanation.sourceImpacts.length, 2);
      assert.equal(result.explanation.sourceImpacts[0].impactRole, 'primary_support');
      assert.ok(result.explanation.factualRationale.includes('supports the assertion'));
      assert.ok(result.explanation.summary.includes('Factual support: Supported'));
    });
  });

  describe('2. Contradicted Case', () => {
    it('should determine Contradicted when high-authority sources refute the assertion', () => {
      const claim = 'RBI has banned ₹500 currency notes and ordered complete withdrawal by tonight';
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'rbi.org.in',
          title: 'RBI Clarification: ₹500 Banknotes Continue as Valid Legal Tender',
          date: 'Aug 2026',
          type: 'Government',
          url: 'https://rbi.org.in/press/500-clarification',
          passage: 'The Reserve Bank of India clarifies that ₹500 denomination banknotes continue to remain legal tender across India. Reports of withdrawal or ban are completely unfounded fake rumors.',
          stance: 'contradicts'
        },
        {
          id: 2,
          domain: 'pib.gov.in',
          title: 'PIB Fact Check: Viral Notice Claiming ₹500 Currency Ban Is Fake',
          date: 'Aug 2026',
          type: 'Government',
          url: 'https://pib.gov.in/FactCheck/500-fake',
          passage: 'PIB Fact Check: A viral message claiming ₹500 notes are being withdrawn from circulation is fake and misleading. RBI has issued no such order.',
          stance: 'contradicts'
        }
      ];

      const result = executeVerdictEngine({
        prompt: claim,
        taskType: 'verification',
        sources
      });

      assert.equal(result.verdicts.factualCorrectness, 'Contradicted');
      assert.equal(result.verdicts.evidenceSufficiency, 'Sufficient');
      assert.equal(result.explanation.sourceImpacts[0].impactRole, 'primary_contradiction');
      assert.ok(result.explanation.factualRationale.includes('directly contradicts'));
      assert.ok(result.explanation.summary.includes('Factual support: Contradicted'));
    });
  });

  describe('3. Mixed / Conflicting Case', () => {
    it('should determine Mixed when authoritative sources disagree or have conflicting stances', () => {
      const claim = 'SERC electricity rooftop solar net metering tariff reduction mandatory across all states';
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'kserc.org.in',
          title: 'State Electricity Regulatory Commission: Rooftop Solar Net Metering Tariff Revision Order',
          date: 'Sep 2026',
          type: 'Registry',
          url: 'https://kserc.org.in/orders/solar',
          passage: 'Commission officially approves reduced net metering tariff rates for all grid-connected rooftop solar installations.',
          stance: 'supports'
        },
        {
          id: 2,
          domain: 'tnerc.gov.in',
          title: 'State Commission Clarification: No Reduction in Solar Net Metering Tariffs',
          date: 'Aug 2026',
          type: 'Government',
          url: 'https://tnerc.gov.in/press/solar-clarification',
          passage: 'Commission refutes reports of tariff cuts: full net metering compensation continues without reduction under existing state consumer protection regulations.',
          stance: 'contradicts'
        }
      ];

      const result = executeVerdictEngine({
        prompt: claim,
        taskType: 'verification',
        sources
      });

      assert.equal(result.verdicts.factualCorrectness, 'Mixed');
      assert.ok(result.verdicts.evidenceSufficiency === 'Sufficient' || result.verdicts.evidenceSufficiency === 'Partial');
      assert.ok(result.explanation.factualRationale.includes('sources conflict'));
    });
  });

  describe('4. Insufficient-Evidence / Unknown Claim Case', () => {
    it('should return Unverified and Insufficient when no relevant evidence exists', () => {
      const claim = 'Village youth panchayat committee in Rampur approved 500 rupee stipend for all cyclists';
      const sources: IndexedSource[] = []; // No records found in search

      const result = executeVerdictEngine({
        prompt: claim,
        taskType: 'verification',
        sources
      });

      // Strict requirements: Never default to Contradicted or High Risk!
      assert.equal(result.verdicts.factualCorrectness, 'Unverified');
      assert.equal(result.verdicts.evidenceSufficiency, 'Insufficient');
      assert.equal(result.verdicts.scamRisk, 'Not applicable');
      assert.equal(result.verdicts.riskTriggers.length, 0);
      assert.ok(result.explanation.sufficiencyRationale.includes('No relevant authoritative evidence'));
      assert.ok(result.explanation.factualRationale.includes('not evidence that the assertion is false'));
    });

    it('should return Unverified and Insufficient when sources are off-topic or low-relevance', () => {
      const claim = 'Ministry of Heavy Industries introduces 50% discount on electric bicycles for university students';
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'pib.gov.in',
          title: 'Press Information Bureau Daily Media Digest',
          date: '2026',
          type: 'Government',
          url: 'https://pib.gov.in/digest',
          passage: 'General press repository archive providing daily summaries of ministerial press meets and administrative announcements.',
          stance: 'context'
        }
      ];

      const result = executeVerdictEngine({
        prompt: claim,
        taskType: 'verification',
        sources
      });

      assert.equal(result.verdicts.factualCorrectness, 'Unverified');
      assert.equal(result.verdicts.evidenceSufficiency, 'Insufficient');
      assert.equal(result.verdicts.scamRisk, 'Not applicable');
    });
  });

  describe('5. Decoupling Scam Risk from Factual Correctness', () => {
    it('should keep sender authenticity unverified while identifying supported tax-refund phishing indicators', () => {
      const message = "Income Tax Department approved a refund of ₹15,480. Confirm your bank account and debit card CVV to receive it.";
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'incometax.gov.in',
          title: 'Income Tax Department phishing scam warning',
          date: '2026',
          type: 'Government',
          url: 'https://www.incometax.gov.in/iec/foportal/help/how-to-avoid-phishing',
          passage: 'The Income Tax Department does not ask taxpayers to provide a debit card CVV, password, or banking credentials by email or SMS.',
          stance: 'context'
        }
      ];

      const result = executeVerdictEngine({
        prompt: message,
        taskType: 'scam_check',
        sources
      });

      assert.equal(result.verdicts.factualCorrectness, 'Unverified');
      assert.equal(result.verdicts.messageAuthenticity, 'Cannot authenticate');
      assert.equal(result.verdicts.scamRisk, 'High');
      assert.notEqual(result.verdicts.evidenceSufficiency, 'Insufficient');
      assert.ok(result.verdicts.riskTriggers.includes('Sensitive Credential / Banking Detail Request'));
      assert.ok(result.explanation.scamRationale.includes('[1]'));
      assert.ok(result.explanation.summary.includes('Message authenticity: Cannot authenticate'));
      assert.ok(result.explanation.factualRationale.includes('cannot be confirmed'));
    });

    it('should assign High Scam Risk to a message containing cyber threat vectors even if the factual text is genuine', () => {
      const message = 'Official Electricity Discom Notice: Dear consumer, your power will be disconnected at 9:30 PM tonight. Download the QuickPay APK immediately from http://192.168.1.5/discom.apk and contact officer at 9821456789.';
      const sources: IndexedSource[] = [];

      const result = executeVerdictEngine({
        prompt: message,
        taskType: 'scam_check',
        sources,
        threatEntities: {
          phones: ['9821456789'],
          urls: ['http://192.168.1.5/discom.apk']
        },
        forensics: {
          urls: [{ url: 'http://192.168.1.5/discom.apk', status: 'critical', domain: '192.168.1.5' }],
          phones: [{ number: '9821456789', risk: 'High' }]
        },
        manipulation: {
          overallIndex: 85,
          threatLevel: 'Critical'
        },
        statutes: {
          statutoryViolationCount: 1,
          applicableStatutes: [{ section: 'Section 56(1)' }]
        }
      });

      // Scam risk is independently High due to critical APK + 10-digit caller + urgency
      assert.equal(result.verdicts.scamRisk, 'High');
      assert.ok(result.verdicts.riskTriggers.includes('Deceptive URL / APK Phishing'));
      assert.ok(result.verdicts.riskTriggers.includes('Personal 10-Digit Sender / Caller'));
      assert.ok(result.verdicts.riskTriggers.includes('Acute Psychological Coercion'));

      // Factual correctness remains Unverified without defaulting to an arbitrary assumption
      assert.equal(result.verdicts.evidenceSufficiency, 'Insufficient');
      assert.equal(result.verdicts.factualCorrectness, 'Unverified');
    });

    it('should mark Scam Risk not applicable for an ordinary factual query', () => {
      const query = 'What are the application steps for the National Overseas Scholarship 2026?';
      const result = executeVerdictEngine({
        prompt: query,
        taskType: 'research',
        sources: []
      });

      assert.equal(result.verdicts.scamRisk, 'Not applicable');
      assert.equal(result.verdicts.messageAuthenticity, 'Not applicable');
      assert.equal(result.verdicts.factualCorrectness, 'Unverified');
      assert.equal(result.verdicts.evidenceSufficiency, 'Insufficient');
    });
  });

  describe('6. Fallback Fixture Isolation', () => {
    it('should quarantine fallback fixtures from live evidence weighting', () => {
      const claim = 'Some arbitrary unknown claim about state transport corporation buses';
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'rbi.org.in',
          title: 'Reserve Bank of India: Clarification on Legal Tender Status of ₹500 Banknotes',
          date: 'Aug 2026',
          type: 'Government',
          url: 'https://rbi.org.in/scripts/BS_PressReleaseDisplay.aspx',
          passage: 'The Reserve Bank of India clarifies that ₹500 denomination banknotes continue to be legal tender.',
          stance: 'contradicts',
          isFixture: true // Mark as template fixture
        }
      ];

      // Default execution: allowFixturesAsEvidence is false
      const result = executeVerdictEngine({
        prompt: claim,
        taskType: 'verification',
        sources,
        allowFixturesAsEvidence: false
      });

      // The fixture must NOT bias this unrelated claim into Contradicted or Sufficient!
      assert.equal(result.verdicts.factualCorrectness, 'Unverified');
      assert.equal(result.verdicts.evidenceSufficiency, 'Insufficient');
      assert.equal(result.evaluatedSources[0].impactRole, 'insufficient_relevance');
    });
  });

  describe('7. Structured Explanation & Source Impacts', () => {
    it('should produce detailed source impacts with authority, relevance, recency, and impact roles', () => {
      const claim = 'TRAI deactivates mobile numbers via 2-hour robocall warnings';
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'trai.gov.in',
          title: 'TRAI Public Notice: Mobile Disconnection Robocall Extortion Scheme Warning',
          date: 'Sep 2026',
          type: 'Government',
          url: 'https://trai.gov.in/notifications/press-release',
          passage: 'TRAI does not block or deactivate individual mobile connections via automated robocalls, nor does it conduct digital arrests or demand money.',
          stance: 'contradicts'
        }
      ];

      const result = executeVerdictEngine({
        prompt: claim,
        taskType: 'scam_check',
        sources
      });

      const impact = result.explanation.sourceImpacts[0];
      assert.equal(impact.sourceId, 1);
      assert.equal(impact.domain, 'trai.gov.in');
      assert.equal(impact.authorityWeight, 1.0);
      assert.ok(impact.relevanceScore >= 0.5);
      assert.equal(impact.recencyScore, 1.0);
      assert.equal(impact.stance, 'contradicts');
      assert.equal(impact.impactRole, 'primary_contradiction');
      assert.ok(impact.explanation.includes('Primary authority'));
    });
  });

  describe('8. Contextual Evidence Interpretation & Stance Classification (Regression)', () => {
    it('should determine Supported for Canberra as Australia’s capital with supporting passage', () => {
      const claim = 'Canberra is the capital of Australia';
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'nca.gov.au',
          title: 'National Capital Authority - Canberra',
          date: '2026',
          type: 'Government',
          url: 'https://www.nca.gov.au/planning/canberra-plan',
          passage: 'Canberra is the capital of Australia. The site for the national capital was selected as a compromise between Sydney and Melbourne, not in either of those state capitals.',
          stance: 'context' // dynamic classification
        }
      ];

      const result = executeVerdictEngine({
        prompt: claim,
        taskType: 'verification',
        sources
      });

      assert.equal(result.evaluatedSources[0].stance, 'supports');
      assert.equal(result.verdicts.factualCorrectness, 'Supported');
      assert.equal(result.verdicts.verdictStatus, 'right');
      assert.ok(result.explanation.factualRationale.includes('supports the assertion'));
    });

    it('should determine Contradicted for Sydney as Australia’s capital when evidence explains Canberra is the capital and Sydney is state capital', () => {
      const claim = 'Sydney is the capital of Australia';
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'australia.gov.au',
          title: "About Australia's Government and Capital",
          date: '2026',
          type: 'Government',
          url: 'https://www.australia.gov.au/about-government/capital',
          passage: 'Canberra is the capital city of Australia, serving as the seat of government since 1927.',
          stance: 'context' // dynamic classification
        },
        {
          id: 2,
          domain: 'cityofsydney.nsw.gov.au',
          title: 'City of Sydney Overview',
          date: '2026',
          type: 'Government',
          url: 'https://www.cityofsydney.nsw.gov.au/about-sydney',
          passage: "Sydney is the capital of New South Wales, and Australia's most populous city.",
          stance: 'context' // dynamic classification
        }
      ];

      const result = executeVerdictEngine({
        prompt: claim,
        taskType: 'verification',
        sources
      });

      // Source 1 asserts Canberra is Australia's capital -> refutes Sydney being national capital
      assert.equal(result.evaluatedSources[0].stance, 'contradicts');
      // Source 2 asserts Sydney is capital of NSW -> state scope, NOT supporting Australia's national capital
      assert.equal(result.evaluatedSources[1].stance, 'context');
      // Decisively Contradicted, NOT Mixed!
      assert.equal(result.verdicts.factualCorrectness, 'Contradicted');
      assert.equal(result.verdicts.verdictStatus, 'false');
      assert.ok(result.explanation.factualRationale.includes('directly contradicts'));
    });

    it('should determine Supported for Sydney as New South Wales’s capital with supporting passage', () => {
      const claim = 'Sydney is the capital of New South Wales';
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'nsw.gov.au',
          title: 'About New South Wales',
          date: '2026',
          type: 'Government',
          url: 'https://www.nsw.gov.au/about-nsw',
          passage: 'Sydney is the capital city of the state of New South Wales, Australia.',
          stance: 'context' // dynamic classification
        }
      ];

      const result = executeVerdictEngine({
        prompt: claim,
        taskType: 'verification',
        sources
      });

      assert.equal(result.evaluatedSources[0].stance, 'supports');
      assert.equal(result.verdicts.factualCorrectness, 'Supported');
      assert.equal(result.verdicts.verdictStatus, 'right');
    });

    it('should NOT treat a question repeating a false claim as automatic support', () => {
      const claim = 'Sydney is the capital of Australia';
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'travel-faq.example.org',
          title: 'Frequently Asked Questions: Australia',
          date: '2026',
          type: 'News',
          url: 'https://travel-faq.example.org/australia',
          passage: "Is Sydney the capital of Australia? Many tourists ask this question about Australia's most famous city.",
          stance: 'context' // dynamic classification
        }
      ];

      const result = executeVerdictEngine({
        prompt: claim,
        taskType: 'verification',
        sources
      });

      // A question must not be interpreted as an endorsement or declarative support
      assert.equal(result.evaluatedSources[0].stance, 'context');
      assert.notEqual(result.verdicts.factualCorrectness, 'Supported');
      assert.equal(result.verdicts.factualCorrectness, 'Unverified');
      assert.equal(result.verdicts.verdictStatus, 'unverified');
    });

    it('should correctly interpret a passage correcting a misconception', () => {
      const misconceptionPassage = 'A common misconception is that Sydney is the capital of Australia. In fact, Canberra is the capital of Australia.';

      // Evaluation A: against the false misconception (Sydney)
      const resultSydney = executeVerdictEngine({
        prompt: 'Sydney is the capital of Australia',
        taskType: 'verification',
        sources: [
          {
            id: 1,
            domain: 'australia.gov.au',
            title: 'Common Geographical Misconceptions',
            date: '2026',
            type: 'Government',
            url: 'https://australia.gov.au/about-australia/misconceptions',
            passage: misconceptionPassage,
            stance: 'context'
          }
        ]
      });
      assert.equal(resultSydney.evaluatedSources[0].stance, 'contradicts');
      assert.equal(resultSydney.verdicts.factualCorrectness, 'Contradicted');
      assert.equal(resultSydney.verdicts.verdictStatus, 'false');

      // Evaluation B: against the true correction (Canberra)
      const resultCanberra = executeVerdictEngine({
        prompt: 'Canberra is the capital of Australia',
        taskType: 'verification',
        sources: [
          {
            id: 1,
            domain: 'australia.gov.au',
            title: 'Common Geographical Misconceptions',
            date: '2026',
            type: 'Government',
            url: 'https://australia.gov.au/about-australia/misconceptions',
            passage: misconceptionPassage,
            stance: 'context'
          }
        ]
      });
      assert.equal(resultCanberra.evaluatedSources[0].stance, 'supports');
      assert.equal(resultCanberra.verdicts.factualCorrectness, 'Supported');
      assert.equal(resultCanberra.verdicts.verdictStatus, 'right');
    });

    it('should determine Mixed only when credible, authoritative evidence genuinely conflicts', () => {
      const claim = 'Regional electricity regulatory authority rooftop solar net metering tariff reduction mandatory';
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'kserc.org.in',
          title: 'State Electricity Regulatory Commission Solar Net Metering Tariff Revision Order',
          date: 'Sep 2026',
          type: 'Registry',
          url: 'https://kserc.org.in/orders/solar',
          passage: 'Commission officially approves reduced net metering tariff rates for all grid-connected rooftop solar installations.',
          stance: 'supports'
        },
        {
          id: 2,
          domain: 'tnerc.gov.in',
          title: 'State Commission Clarification: No Reduction in Solar Net Metering Tariffs',
          date: 'Aug 2026',
          type: 'Government',
          url: 'https://tnerc.gov.in/press/solar-clarification',
          passage: 'Commission refutes reports of tariff cuts: full net metering compensation continues without reduction under existing state consumer protection regulations.',
          stance: 'contradicts'
        }
      ];

      const result = executeVerdictEngine({
        prompt: claim,
        taskType: 'verification',
        sources
      });

      // Both sources are high-authority regulatory bodies with opposing positions
      assert.equal(result.verdicts.factualCorrectness, 'Mixed');
      assert.equal(result.verdicts.verdictStatus, 'unverified');
      assert.ok(result.explanation.factualRationale.includes('conflict'));
    });

    it('should not let weak or unverified social sources override direct authoritative evidence into Mixed', () => {
      const claim = 'Official currency notes denomination withdrawal notice issued';
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'rbi.org.in',
          title: 'RBI Official Clarification: Banknotes Continue as Valid Legal Tender',
          date: '2026',
          type: 'Government', // authority weight 1.0
          url: 'https://rbi.org.in/press/clarification',
          passage: 'The Reserve Bank of India clarifies that banknotes remain legal tender. Reports of withdrawal are completely unfounded fake rumors.',
          stance: 'contradicts'
        },
        {
          id: 2,
          domain: 'random-social-blog.example.xyz',
          title: 'Viral chatter',
          date: '2026',
          type: 'News', // low authority tier
          url: 'https://random-social-blog.example.xyz/post/1',
          passage: 'Viral posts claim a directive was issued for withdrawal.',
          stance: 'supports'
        }
      ];

      const result = executeVerdictEngine({
        prompt: claim,
        taskType: 'verification',
        sources
      });

      // Direct authoritative evidence from RBI (1.0) must not be diluted into Mixed by a weak blog
      assert.equal(result.verdicts.factualCorrectness, 'Contradicted');
      assert.equal(result.verdicts.verdictStatus, 'false');
    });

    it('should correctly evaluate generic entity-relation claims without hardcoded rules', () => {
      // Testing generic entity / country: e.g. Washington / USA / New York
      const resultUSA = executeVerdictEngine({
        prompt: 'New York is the capital of the United States',
        taskType: 'verification',
        sources: [
          {
            id: 1,
            domain: 'loc.gov',
            title: 'Library of Congress: United States Capital History',
            date: '2026',
            type: 'Government',
            url: 'https://www.loc.gov/capitol',
            passage: 'Washington, D.C. is the capital of the United States, serving as the permanent seat of the federal government since 1800.',
            stance: 'context'
          }
        ]
      });

      assert.equal(resultUSA.evaluatedSources[0].stance, 'contradicts');
      assert.equal(resultUSA.verdicts.factualCorrectness, 'Contradicted');
      assert.equal(resultUSA.verdicts.verdictStatus, 'false');
    });
  });
});

