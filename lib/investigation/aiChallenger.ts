import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { FactualCorrectness, QueryVerdictStatus, ScamRisk } from './types';

export interface AICallVerdictResult {
  verdictStatus: QueryVerdictStatus;
  factualCorrectness: FactualCorrectness;
  scamRisk: ScamRisk;
  explanation: string;
  keyFindings: string[];
  suggestedAction?: string;
  isConfirmedFact: boolean;
  suggestedInquiries?: string[];
}

/**
 * AI Adversarial Challenger & Fact-Checking Evaluator.
 * Uses OpenAI API to determine if a claim is right (✔), false/debunked (✖), or unverified (⚪).
 */
export async function evaluateClaimWithAI(
  prompt: string,
  apiKey: string,
  context?: {
    extractedAttachmentText?: string;
    existingSourcesCount?: number;
    sourcesSummary?: string;
  }
): Promise<AICallVerdictResult | null> {
  if (!apiKey || !prompt.trim()) return null;

  try {
    const openai = createOpenAI({ apiKey });
    const systemPrompt = `You are UseDAM's Lead Fact-Checking and Regulatory Intelligence AI for India.
Your mission is to evaluate the user's query, claim, or forwarded message, determine its factual truth, identify scams, and decide the definitive verdict.

DECISION CRITERIA:
1. "right" (Supported): The claim is factually true, authentic, or verified by public records, laws, history, science, or official announcements (e.g., "RBI withdrew 2000 notes under Clean Note Policy", "Chandrayaan-3 landed on Moon").
2. "false" (Contradicted): The claim is factually false, misleading, a debunked rumor, fake circular, or an extortion/phishing scam (e.g., "Modi is dead", "2000 note is banned/demonetized", "electricity disconnected tonight call X", "earth is flat", fake KYC/digital arrest, fake Supreme Court cancellations).
3. "unverified" (Unverified): Genuinely unverified claims with inadequate verifiable evidence, obscure personal allegations, or unannounced future events where truth cannot be confirmed.

IMPORTANT DOMAIN RULES FOR INDIA:
- Currency Notes: The RBI withdrew ₹2000 notes from circulation on May 19, 2023 under the Clean Note Policy, but they were NEVER banned or demonetized and remain legal tender. Claiming "2000 notes are banned" or "2000 notes are illegal" is FALSE (Contradicted).
- Living Leaders & Celebrities: Claims of death for living public figures (e.g., Prime Minister Narendra Modi, President, Ministers) are malicious FALSE rumors (Contradicted).
- Urgent Disconnection Threats: "Electricity/power will be disconnected tonight at 9:30 call X" is a fraudulent extortion scam. Under Section 56 of the Electricity Act, a mandatory 15-day written notice is required -> FALSE (Contradicted) + High Scam Risk.
- Digital Arrest / CBI / Police Video Call: "Digital arrest by police/CBI over phone/Skype" is an extortion scam. Indian law has no provision for digital arrest -> FALSE + High Scam Risk.

You MUST respond strictly with a valid JSON object (no markdown formatting, no code fences):
{
  "verdictStatus": "right" | "false" | "unverified",
  "factualCorrectness": "Supported" | "Contradicted" | "Unverified" | "Mixed",
  "scamRisk": "High" | "Medium" | "Low",
  "explanation": "Clear, direct 1-2 sentence explanation of the factual truth and reason for verdict",
  "keyFindings": ["Point 1", "Point 2"],
  "suggestedAction": "Practical advice for the citizen",
  "isConfirmedFact": boolean,
  "suggestedInquiries": [
    "[Concrete factual claim assertion 1 derived directly from this topic, e.g. 'The IRS initiates taxpayer refund notifications via unsolicited emails']",
    "[Concrete factual claim assertion 2, e.g. 'Reserve Bank of India has banned ₹500 currency banknotes']",
    "[Concrete factual claim assertion 3, e.g. 'Indian law permits police officers to execute digital arrests over Skype']"
  ]
}

CRITICAL RULES FOR suggestedInquiries:
- Present each item strictly as a CONCRETE FACTUAL CLAIM / ASSERTION STATEMENT (e.g. 'Electricity distribution companies can disconnect power at night without 15-day notice', 'Central Government announced free laptop distribution under PM Yojana').
- DO NOT start with 'Fact-check whether...', 'Verify whether...', 'Check if...', 'Is it true that...', or 'Fact-check claim that...'. State the declarative assertion itself directly.
- DO NOT provide how-to questions, customer-support steps, or complaint-drafting templates.
- Each claim must be an actionable, testable statement for the verification pipeline.`;

    const userContent = [
      `User Inquiry / Claim: "${prompt.trim()}"`,
      context?.extractedAttachmentText ? `\nAttachment Content:\n${context.extractedAttachmentText.slice(0, 1500)}` : '',
      context?.sourcesSummary ? `\nIndexed Sources Summary:\n${context.sourcesSummary}` : '',
    ].filter(Boolean).join('\n');

    const response = await generateText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      prompt: userContent,
      temperature: 0.1,
    });

    const raw = response.text.trim();
    const cleaned = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);

    const verdictStatus: QueryVerdictStatus =
      parsed.verdictStatus === 'right' || parsed.verdictStatus === 'false'
        ? parsed.verdictStatus
        : 'unverified';

    const factualCorrectness: FactualCorrectness =
      ['Supported', 'Contradicted', 'Unverified', 'Mixed'].includes(parsed.factualCorrectness)
        ? parsed.factualCorrectness
        : verdictStatus === 'right'
          ? 'Supported'
          : verdictStatus === 'false'
            ? 'Contradicted'
            : 'Unverified';

    const scamRisk: ScamRisk =
      ['High', 'Medium', 'Low'].includes(parsed.scamRisk)
        ? parsed.scamRisk
        : 'Low';

    const sanitizeClaimStatement = (str: string): string => {
      let c = str.trim()
        .replace(/^(fact-check whether|fact check whether|fact-check if|fact check if|fact-check claim that|fact-check that|fact-check|fact check|verify whether|verify if|verify that|verify|is it true that|is it true|check if|check whether|investigate whether|investigate if|investigate)\s+/i, '')
        .replace(/[?]+$/, '')
        .trim();
      if (c.length > 0) {
        c = c.charAt(0).toUpperCase() + c.slice(1);
      }
      return c;
    };

    const suggestedInquiries: string[] = Array.isArray(parsed.suggestedInquiries)
      ? parsed.suggestedInquiries
          .filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 5)
          .map((q: string) => sanitizeClaimStatement(q))
          .filter((q: string) => q.length > 5)
          .slice(0, 4)
      : [];

    return {
      verdictStatus,
      factualCorrectness,
      scamRisk,
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
      suggestedAction: typeof parsed.suggestedAction === 'string' ? parsed.suggestedAction : '',
      isConfirmedFact: Boolean(parsed.isConfirmedFact),
      suggestedInquiries,
    };
  } catch (err) {
    console.warn('AI verdict evaluation warning:', err);
    return null;
  }
}
