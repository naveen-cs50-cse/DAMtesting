import { coordinateInvestigation, PlanResult } from '@/lib/investigation/coordinator';
import { searchAndReadSources } from '@/lib/investigation/researcher';
import { verifyAndChallenge } from '@/lib/investigation/verifier';
import { performForensicAnalysis } from '@/lib/investigation/forensics';
import { extractEntitiesFromText } from '@/lib/investigation/ocr';
import { generateIncidentReport } from '@/lib/investigation/incidentReport';
import { analyzeManipulationVectors } from '@/lib/investigation/manipulation';
import { evaluateStatutoryContradictions } from '@/lib/investigation/statutes';
import { generateVerificationCertificate } from '@/lib/investigation/certificate';
import {
  Attachment,
  ChatTurn,
  IndexedSource,
  ActivityStage,
  InvestigationMeta,
  InvestigationVerdicts,
  RetrievalStats,
  ResponseLanguage
} from '@/lib/investigation/types';
import { ingestUrlSecurely } from '@/lib/investigation/urlIngestion';
import { evaluateClaimWithAI } from '@/lib/investigation/aiChallenger';
import { extractCitedSourceIds } from '@/lib/investigation/citations';
import { buildInitialAnswer } from '@/lib/investigation/initialAnswer';
import { requireStructuredAssessment } from '@/lib/investigation/assessment';
import { analyzeJobOffer, redactJobOfferPersonalData } from '@/lib/investigation/jobOffer';
import { localizeActivityStage, localizeAssessmentForDisplay, localizedChallengerAudit, localizedSuggestions, resolveResponseLanguage } from '@/lib/investigation/localization';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import fs from 'fs';
import path from 'path';

export const SUPPORTED_INVESTIGATION_MODES = ['evidence', 'quick', 'deep'] as const;
export type SupportedInvestigationMode = typeof SUPPORTED_INVESTIGATION_MODES[number];

export function isSupportedInvestigationMode(mode: string): mode is SupportedInvestigationMode {
  return (SUPPORTED_INVESTIGATION_MODES as readonly string[]).includes(mode);
}

export function getEffectiveOpenAIKey(explicitKey?: string): string {
  let key = explicitKey?.trim() || process.env.OPENAI_API_KEY?.trim() || '';
  if (!key.startsWith('sk-')) {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(/^OPENAI_API_KEY=(.+)$/m);
        if (match && match[1]?.trim().startsWith('sk-')) {
          key = match[1].trim();
        }
      }
    } catch {
      // ignore
    }
  }
  return key;
}

export function getEffectiveTavilyKey(explicitKey?: string): string {
  let key = explicitKey?.trim() || process.env.TAVILY_API_KEY?.trim() || '';
  if (!key || !key.startsWith('tvly-')) {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(/^TAVILY_API_KEY=(.+)$/m);
        if (match && match[1]?.trim()) {
          key = match[1].trim();
        }
      }
    } catch {
      // ignore
    }
  }
  return key;
}

export function generateSmartFollowUpFallback(prompt: string, _history: ChatTurn[], language: ResponseLanguage = 'en'): string {
  if (language === 'hi') return `### मार्गदर्शन और अगले कदम

- केवल संगठन की आधिकारिक वेबसाइट या विश्वसनीय नंबर से स्वतंत्र रूप से पुष्टि करें।
- पासवर्ड, PIN, OTP, CVV या बैंक विवरण साझा न करें और संदिग्ध लिंक न खोलें।
- वित्तीय धोखाधड़ी हुई हो तो तुरंत अपने बैंक और 1930 से संपर्क करें।`;
  if (language === 'ta') return `### வழிகாட்டலும் அடுத்த படிகளும்

- அமைப்பின் அதிகாரப்பூர்வ இணையதளம் அல்லது நம்பகமான எண்ணின் மூலம் தனியாகச் சரிபார்க்கவும்.
- கடவுச்சொல், PIN, OTP, CVV அல்லது வங்கி விவரங்களைப் பகிராதீர்கள்; சந்தேகமான இணைப்புகளைத் திறக்காதீர்கள்.
- நிதி மோசடி நடந்திருந்தால் உடனடியாக உங்கள் வங்கியையும் 1930 எண்ணையும் தொடர்புகொள்ளவும்.`;
  const lower = prompt.toLowerCase();
  
  if (lower.includes('draft') || lower.includes('complaint') || lower.includes('letter')) {
    return `### Formal Dispute & Fraud Complaint Letter
*(Ready to copy, personalize, and submit to your Bank Branch Manager & Cyber Police)*

---

**Date:** ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}  
**To:**  
The Branch Manager,  
[Name of Your Bank, e.g., State Bank of India / HDFC Bank],  
[Branch Name / City]  

**Subject:** Urgent Notice: Unauthorized Scam Communication & Request for Customer Account Protection under RBI Directions

**Respected Sir / Madam,**

I, **[Your Name]**, holding Savings Account No. **[Your Account Number]** at your branch, am submitting this formal complaint regarding a fraudulent cyber threat communication received on my registered mobile number.

1. **Incident Details:**  
   On **[Date & Time]**, I received a deceptive message/call alleging [suspension of banking services / urgent electricity cut / KYC deactivation] with instructions to [download an unverified APK / call an unauthorized number / transfer funds].
2. **Statutory Reference:**  
   In terms of the **RBI Master Direction on Limiting Liability of Customers in Unauthorised Electronic Banking Transactions (Ref: DBR.No.Leg.BC.78/09.07.005/2017-18)**, I am promptly intimating the bank within the mandatory reporting window (Golden Hour) to ensure zero customer liability.
3. **Action Requested:**  
   - Immediately place a precautionary monitor/freeze on unauthorized netbanking/UPI transaction attempts on my account.
   - Re-issue a fresh UPI ID and invalidate compromised session tokens if applicable.
   - Acknowledge receipt of this letter with an official bank grievance acknowledgment number.

I have also registered an official complaint with the **National Cyber Crime Helpline (1930 / cybercrime.gov.in)** under Acknowledgment Reference: **[1930 Ref Number if available]**.

Yours faithfully,  
**[Your Signature]**  
**[Your Name]**  
Mobile: **[Your Mobile Number]**  
Email: **[Your Email ID]**`;
  }

  if (lower.includes('1930') || lower.includes('chakshu') || lower.includes('report')) {
    return `### Official Incident Reporting Channels (India)

If you have encountered an extortion call, fraudulent SMS, or cyber financial threat:

1. **National Cyber Crime Reporting Portal (1930 Helpline):**
   - **Emergency Number:** Call **1930** immediately.
   - **Online Portal:** [cybercrime.gov.in](https://cybercrime.gov.in)
   - **Golden Hour Rule:** Reporting financial fraud within 2 to 3 hours increases the likelihood that state police and banks can intercept and freeze funds in the mule accounts.

2. **Chakshu Portal (DoT / Sanchar Saathi):**
   - **URL:** [sancharsaathi.gov.in/sfc/](https://sancharsaathi.gov.in/sfc/)
   - Report suspicious callers, fake TRAI disconnection robocalls, and WhatsApp scam numbers for nationwide telecom IMEI/SIM blacklisting.

3. **Bank Grievance Redressal:**
   - Call the customer care number printed directly on the back of your debit card.
   - Request an immediate block on netbanking and UPI credentials if any remote access application (e.g., AnyDesk, RustDesk) was installed.`;
  }

  if (lower.includes('click') || lower.includes('apk') || lower.includes('installed') || lower.includes('download')) {
    return `### Immediate Cyber Triage & Emergency Actions

If you have already downloaded an unverified APK or clicked a suspicious link:

1. **Sever Network Connectivity Immediately:**
   - Enable **Airplane Mode** immediately or disconnect from both Wi-Fi and mobile data.
   - Do not open mobile banking or UPI apps while the device is in an untrusted state.

2. **Revoke Accessibility & Device Admin Permissions:**
   - Navigate to **Settings → Apps → Special app access → Device admin apps**.
   - Check if the malicious application has granted itself admin privileges and deactivate it.
   - Uninstall the APK from **Settings → Apps → Installed Apps**. If it does not uninstall, boot your phone into **Safe Mode** to remove it.

3. **Notify Your Bank:**
   - Report the incident immediately. Under RBI guidelines, reporting unauthorized debits within 3 days grants you complete protection from liability.`;
  }

  return `### Regulatory Guidance & Next Steps

Based on authoritative Indian statutory directives:

- **Do Not Engage:** Never call back 10-digit personal mobile numbers claiming to represent government agencies, power discoms, or banks.
- **Verify Directly:** Access only official portals (**rbi.org.in**, **pib.gov.in**, **sancharsaathi.gov.in**).
- **Report & Warn Others:** Share the debunked facts with family members and forward suspicious numbers to **1930 / Chakshu**.

Would you like me to draft a complaint letter for your bank manager or provide step-by-step instructions for filing an online cyber report?`;
}

export interface RunInvestigationOptions {
  prompt: string;
  attachments?: Attachment[];
  mode?: SupportedInvestigationMode;
  lang?: string;
  history?: ChatTurn[];
  caseId?: string;
  openaiKey?: string;
  tavilyKey?: string;
  abortSignal?: AbortSignal;
  onStage?: (stage: ActivityStage) => void;
  onToken?: (token: string) => void;
  onMeta?: (meta: InvestigationMeta) => void;
}

export interface InvestigationExecutionResult {
  caseId: string;
  plan: PlanResult;
  briefing: string;
  stages: ActivityStage[];
  verdicts: InvestigationVerdicts | null;
  sources: IndexedSource[];
  meta: InvestigationMeta;
  certificate?: unknown;
  incidentReport?: unknown;
}

/**
 * Core shared investigation runner reusing all UseDAM engine modules.
 * Can be invoked by versioned API routes, background workers, or legacy streaming endpoints.
 */
export async function runInvestigation(
  options: RunInvestigationOptions
): Promise<InvestigationExecutionResult> {
  const {
    prompt,
    attachments = [],
    mode = 'evidence',
    lang = 'auto',
    history = [],
    abortSignal,
    onStage,
    onToken,
    onMeta,
  } = options;

  const caseId = options.caseId || 'DAM-2026-' + Math.floor(1000 + Math.random() * 9000);
  const responseLanguage = resolveResponseLanguage(lang, prompt);
  const responseLanguageName = ({ en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali', te: 'Telugu' } as const)[responseLanguage];
  const openaiKey = getEffectiveOpenAIKey(options.openaiKey);
  const tavilyKey = getEffectiveTavilyKey(options.tavilyKey);

  const stages: ActivityStage[] = [];
  const emitStage = (stg: ActivityStage) => {
    stg = localizeActivityStage(stg, responseLanguage);
    const idx = stages.findIndex(s => s.id === stg.id);
    if (idx >= 0) {
      stages[idx] = { ...stages[idx], ...stg };
    } else {
      stages.push(stg);
    }
    onStage?.(stg);
  };

  let accumulatedText = '';
  const emitToken = (delta: string) => {
    accumulatedText += delta;
    onToken?.(delta);
  };

  // STAGE 0: Secure Web Ingestion & Link Forensics (for submitted URLs)
  const urlAttachments = attachments.filter(
    a => a.isUrl || a.type === 'url' || (a.url && a.url.startsWith('http'))
  );
  if (urlAttachments.length > 0) {
    emitStage({
      id: 'url_ingestion',
      title: 'Secure Web Ingestion & Link Forensics',
      status: 'running',
      summary: `Ingesting ${urlAttachments.length} submitted URL(s) with SSRF defense and claim extraction...`,
    });

    for (const att of urlAttachments) {
      if (!att.urlAnalysis && att.url) {
        const ingested = await ingestUrlSecurely(att.url);
        att.urlAnalysis = ingested;
        if (ingested.extractedText) {
          att.extractedText = ingested.extractedText;
        }
      }
    }

    const primaryUrl = urlAttachments[0]?.urlAnalysis;
    emitStage({
      id: 'url_ingestion',
      title: 'Secure Web Ingestion & Link Forensics',
      status: 'completed',
      summary: primaryUrl?.status === 'success'
        ? `Ingested "${primaryUrl.title || primaryUrl.domain}" (${primaryUrl.wordCount} words, ${primaryUrl.claims.length} claims extracted).`
        : `URL ingestion complete: status ${primaryUrl?.status || 'finished'}${primaryUrl?.errorDetails ? ` (${primaryUrl.errorDetails})` : ''}.`,
      details: { urlAnalysis: primaryUrl },
    });
  }

  const plan = coordinateInvestigation(prompt, attachments, history);

  // Handle Conversational Intent
  if (plan.taskType === 'conversational') {
    let streamed = false;
    if (openaiKey) {
      try {
        const openai = createOpenAI({ apiKey: openaiKey });
        const systemPrompt = `You are UseDAM, an intelligent and friendly AI verification & intelligence assistant for India.
You specialize in fact-checking viral claims, investigating fake government circulars or gazettes (RBI, TRAI, Ministries), and detecting cyber fraud or scam communications.
The user is having a casual conversation, greeting you, or asking general questions.
Respond warmly, concisely, and helpfully like ChatGPT. Introduce what you can do (fact-check viral news, inspect suspicious SMS/calls, analyze circular PDFs or links), and ask how you can help them today.
Write the complete response in ${responseLanguageName}; preserve URLs, names, evidence identifiers, and quoted source text unchanged.`;

        const result = streamText({
          model: openai('gpt-4o-mini'),
          system: systemPrompt,
          messages: [
            ...history.slice(-4).map(h => ({ role: h.role, content: h.content || '' })),
            { role: 'user', content: prompt }
          ],
          temperature: 0.6,
          abortSignal,
        });

        for await (const delta of result.textStream) {
          streamed = true;
          emitToken(delta);
        }
      } catch (err) {
        console.warn('Conversational streaming fallback:', err);
      }
    }

    if (!streamed) {
      const fallbackGreeting = responseLanguage === 'hi'
        ? `नमस्ते! मैं **UseDAM**, आपका सत्यापन और जानकारी सहायक हूँ। मैं वायरल दावों की तथ्य-जाँच, संदिग्ध संदेशों की समीक्षा और दस्तावेज़ों या लिंक का विश्लेषण कर सकता हूँ। आज मैं आपकी किस जाँच में मदद करूँ?`
        : responseLanguage === 'ta'
          ? `வணக்கம்! நான் **UseDAM**, உங்கள் சரிபார்ப்பு மற்றும் தகவல் உதவியாளர். வைரல் கூற்றுகளைச் சரிபார்க்கவும், சந்தேகமான செய்திகளை ஆய்வு செய்யவும், ஆவணங்கள் அல்லது இணைப்புகளைப் பகுப்பாய்வு செய்யவும் உதவ முடியும். இன்று எதை ஆய்வு செய்யலாம்?`
          : `Hello! I'm **UseDAM**, your AI verification and intelligence assistant.

I can help you:
- **Fact-check viral claims** & social media rumors against official Indian registries.
- **Verify government circulars** & gazettes (RBI, TRAI, SERC, Ministries).
- **Inspect suspicious messages, calls, or links** for scams, phishing, and APK malware.
- **Analyze uploaded documents** (PDFs, screenshots) with forensic OCR scrutiny.

How can I assist your investigation today?`;
      for (const chunk of fallbackGreeting.split(' ')) {
        emitToken(chunk + ' ');
        await new Promise(r => setTimeout(r, 10));
      }
    }

    const meta: InvestigationMeta = {
      caseId,
      taskType: 'conversational',
      sources: [],
      verdicts: null,
      language: responseLanguage,
    };
    onMeta?.(meta);

    return {
      caseId,
      plan,
      briefing: accumulatedText.trim(),
      stages,
      verdicts: null,
      sources: [],
      meta
    };
  }

  // Handle Follow-Up Questions
  if (plan.taskType === 'follow_up') {
    emitStage({
      id: 'advisory',
      title: 'Consulting Cyber Defense & Regulatory Knowledge',
      status: 'running',
      summary: 'Synthesizing tailored citizen guidance, complaint draft, or reporting instructions...',
    });

    await new Promise(r => setTimeout(r, 50));

    emitStage({
      id: 'advisory',
      title: 'Consulting Cyber Defense & Regulatory Knowledge',
      status: 'completed',
      summary: 'Ready. Streaming actionable intelligence...',
    });

    let streamed = false;
    if (openaiKey) {
      try {
        const openai = createOpenAI({ apiKey: openaiKey });
        const systemPrompt = `You are UseDAM, an intelligent and authoritative cybersecurity, legal, and regulatory advisor for citizens in India.
You are assisting a citizen in an ongoing case investigation.

CRITICAL DIRECTIVES:
- Directly answer the user's specific request without repeating generic boilerplate or declaring rigid verification verdicts.
- If they ask for a complaint letter (to bank manager, police, or cyber cell):
  Provide a formal, highly professional, ready-to-copy letter. Include clear [Placeholders] for Date, Account Number, Branch Name, Disputed Transaction Details, and cite relevant Indian regulations:
  * RBI Master Direction on Limiting Liability of Customers in Unauthorised Electronic Banking Transactions (Ref: DBR.No.Leg.BC.78/09.07.005/2017-18)
  * Section 43A and Section 66D of the Information Technology Act 2000
- If they ask how to report to 1930 / Chakshu / Cybercrime portal:
  Provide clear, numbered step-by-step instructions.
- If they ask what to do if they already clicked a link, downloaded an APK, or shared OTP:
  Give urgent triage steps.
- Tone: Empathetic, expert, decisive, and reassuring.
- Write the complete response in ${responseLanguageName}; preserve URLs, names, evidence identifiers, and quoted source text unchanged.`;

        const result = streamText({
          model: openai('gpt-4o-mini'),
          system: systemPrompt,
          messages: [
            ...history.slice(-6).map(h => ({ role: h.role, content: h.content || '' })),
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          abortSignal,
        });

        for await (const delta of result.textStream) {
          streamed = true;
          emitToken(delta);
        }
      } catch (err) {
        console.warn('Follow-up streaming fallback:', err);
      }
    }

    if (!streamed) {
      const fallbackResponse = generateSmartFollowUpFallback(prompt, history, responseLanguage);
      for (const chunk of fallbackResponse.split(' ')) {
        emitToken(chunk + ' ');
        await new Promise(r => setTimeout(r, 10));
      }
    }

    const meta: InvestigationMeta = {
      caseId,
      taskType: 'follow_up',
      sources: [],
      verdicts: null,
      language: responseLanguage,
    };
    onMeta?.(meta);

    return {
      caseId,
      plan,
      briefing: accumulatedText.trim(),
      stages,
      verdicts: null,
      sources: [],
      meta
    };
  }

  // STAGE 1: Analysing Request
  emitStage({
    id: 'analyze',
    title: 'Analysing Request & Scope',
    status: 'running',
    summary: 'Decomposing assertions, regulatory entities, and jurisdictional scope...',
  });

  await new Promise(r => setTimeout(r, 60));

  emitStage({
    id: 'analyze',
    title: 'Analysing Request & Scope',
    status: 'completed',
    summary: `Identified task as ${plan.taskType.replace('_', ' ').toUpperCase()} with ${plan.queries.length} verification queries. Mode: ${mode}.`,
    details: { taskType: plan.taskType, queries: plan.queries, attachmentsCount: attachments.length, mode },
  });

  // STAGE 2: Searching relevant sources. A web search is not a registry lookup.
  emitStage({
    id: 'search',
    title: 'Searching Relevant Sources',
    status: 'running',
    summary: 'Searching relevant web and fact-checking sources for this question...',
  });

  // Respect mode budget: quick mode runs fewer queries
  const queriesToRun = mode === 'quick' ? plan.queries.slice(0, 2) : plan.queries;
  const retrievalResult = await searchAndReadSources(queriesToRun, prompt, tavilyKey);
  const sources: IndexedSource[] = retrievalResult.sources;
  const liveSources = sources.filter(source => !source.isFixture);

  emitStage({
    id: 'search',
    title: 'Searching Relevant Sources',
    status: 'completed',
    summary: retrievalResult.stats.searchResultsFound > 0
      ? `Found ${retrievalResult.stats.searchResultsFound} deduplicated result${retrievalResult.stats.searchResultsFound === 1 ? '' : 's'}; ${retrievalResult.stats.pagesInspected} page${retrievalResult.stats.pagesInspected === 1 ? '' : 's'} inspected and ${retrievalResult.stats.snippetsAvailable} snippet-only result${retrievalResult.stats.snippetsAvailable === 1 ? '' : 's'} retained.`
      : 'No live records indexed from search; proceeding with evidence-driven evaluation of submitted claim.',
    details: { sources: liveSources.map(s => ({ id: s.id, domain: s.domain, title: s.title, url: s.url })) },
  });

  // STAGE 3: Extracting & Cross-Referencing Evidence
  emitStage({
    id: 'read',
    title: 'Extracting & Cross-Referencing Evidence',
    status: 'running',
    summary: 'Classifying retrieved text by provenance and checking relevance and claim stance...',
  });

  await new Promise(r => setTimeout(r, 60));

  emitStage({
    id: 'read',
    title: 'Extracting & Cross-Referencing Evidence',
    status: 'completed',
    summary: liveSources.length > 0
      ? `Inspected ${retrievalResult.stats.pagesInspected} result page${retrievalResult.stats.pagesInspected === 1 ? '' : 's'} successfully; evaluated ${retrievalResult.stats.snippetsAvailable} search snippet${retrievalResult.stats.snippetsAvailable === 1 ? '' : 's'} separately${retrievalResult.stats.pagesUnavailable > 0 ? `; ${retrievalResult.stats.pagesUnavailable} extraction attempt${retrievalResult.stats.pagesUnavailable === 1 ? '' : 's'} failed` : ''}.`
      : 'No live source passages were available; evidence remains limited to the submitted material.',
    details: { passages: liveSources.map(s => `[${s.id}] (${s.domain}): "${s.passage.slice(0, 140)}..."`) },
  });

  // Precompute entities, forensics, manipulation, and statutory context
  const primaryDocAnalysis = attachments.find(a => a.documentAnalysis)?.documentAnalysis || null;
  const primaryUrlAnalysis = attachments.find(a => a.urlAnalysis)?.urlAnalysis || null;
  const isPrimaryUsable = primaryUrlAnalysis?.status === 'success' && (primaryUrlAnalysis.isUsable ?? true);
  const initialRetrievalStats: RetrievalStats = {
    ...retrievalResult.stats,
    pagesInspected: retrievalResult.stats.pagesInspected + (isPrimaryUsable ? 1 : 0),
    pagesUnavailable: retrievalResult.stats.pagesUnavailable + (primaryUrlAnalysis && !isPrimaryUsable ? 1 : 0),
    pagesAttempted: (retrievalResult.stats.pagesAttempted ?? retrievalResult.stats.pagesInspected) + (primaryUrlAnalysis ? 1 : 0),
    pagesSuccessful: (retrievalResult.stats.pagesSuccessful ?? retrievalResult.stats.pagesInspected) + (primaryUrlAnalysis?.status === 'success' ? 1 : 0),
    pagesUsable: (retrievalResult.stats.pagesUsable ?? retrievalResult.stats.pagesInspected) + (isPrimaryUsable ? 1 : 0),
    pagesFailed: (retrievalResult.stats.pagesFailed ?? retrievalResult.stats.pagesUnavailable) + (primaryUrlAnalysis && !isPrimaryUsable ? 1 : 0),
  };

  const extractedTextFromAttachments = attachments
    .map(a => {
      if (a.urlAnalysis?.extractedText) {
        return `[Ingested Web Source: ${a.urlAnalysis.title || a.urlAnalysis.domain} (${a.urlAnalysis.finalUrl})]:\n${a.urlAnalysis.extractedText.slice(0, 4000)}\n\nExtracted Factual Claims:\n${a.urlAnalysis.claims.map(c => `- ${c}`).join('\n')}`;
      }
      if (a.extractedText) {
        return `[Attachment: ${a.name} (Transcribed Text)]:\n${a.extractedText}`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
  const safeExtractedTextFromAttachments = plan.taskType === 'job_offer'
    ? redactJobOfferPersonalData(extractedTextFromAttachments)
    : extractedTextFromAttachments;
  const jobOfferContent = plan.taskType === 'job_offer'
    ? `${prompt}\n${extractedTextFromAttachments}`.trim()
    : '';
  const evaluationPrompt = plan.taskType === 'job_offer'
    ? `${prompt}\n${safeExtractedTextFromAttachments}`.trim()
    : prompt;

  const promptEntities = extractEntitiesFromText(evaluationPrompt);
  const allDetectedEntities = {
    phones: Array.from(new Set([...(promptEntities.phones || []), ...(plan.taskType === 'job_offer' ? [] : attachments.flatMap(a => a.threatEntities?.phones || []))])),
    urls: Array.from(new Set([
      ...(promptEntities.urls || []),
      ...(plan.taskType === 'job_offer' ? [] : attachments.flatMap(a => [
        ...(a.threatEntities?.urls || []),
        ...(a.url ? [a.url] : []),
        ...(a.urlAnalysis?.finalUrl ? [a.urlAnalysis.finalUrl] : []),
        ...(a.urlAnalysis?.downloadLinks || [])
      ]))
    ])),
    senderIds: Array.from(new Set([...(promptEntities.senderIds || []), ...(plan.taskType === 'job_offer' ? [] : attachments.flatMap(a => a.threatEntities?.senderIds || []))])),
    amounts: Array.from(new Set([...(promptEntities.amounts || []), ...(plan.taskType === 'job_offer' ? [] : attachments.flatMap(a => a.threatEntities?.amounts || []))]))
  };

  const forensics = performForensicAnalysis(prompt, safeExtractedTextFromAttachments, allDetectedEntities);
  const manipulationAudit = analyzeManipulationVectors(prompt, safeExtractedTextFromAttachments);
  const statutes = evaluateStatutoryContradictions(prompt, safeExtractedTextFromAttachments, allDetectedEntities);

  // STAGE 4: Adversarial Challenger Verification
  emitStage({
    id: 'challenger',
    title: 'Adversarial Challenger Verification',
    status: 'running',
    summary: 'Evaluating source authority, relevance, recency, stance, and agreement...',
  });

  const {
    verdicts: rawVerdicts,
    claims,
    challengerAudit,
    evaluatedSources = sources
  } = verifyAndChallenge(evaluationPrompt, plan.taskType, sources, {
    threatEntities: allDetectedEntities,
    forensics,
    manipulation: manipulationAudit,
    statutes,
    documentAnalysis: primaryDocAnalysis,
    urlAnalysis: primaryUrlAnalysis,
  });
  const verdicts = requireStructuredAssessment(rawVerdicts);
  const displayAssessment = localizeAssessmentForDisplay(verdicts, responseLanguage);
  const displayChallengerAudit = localizedChallengerAudit(displayAssessment, challengerAudit, responseLanguage);
  const displaySources = evaluatedSources.filter(source => !source.isFixture);
  const jobOfferAnalysis = plan.taskType === 'job_offer'
    ? analyzeJobOffer(jobOfferContent, displaySources, initialRetrievalStats, verdicts.messageAuthenticity)
    : undefined;

  let aiSuggestedInquiries: string[] = [];
  if (openaiKey && prompt.trim() && plan.taskType !== 'job_offer') {
    try {
      const aiVerdict = await evaluateClaimWithAI(prompt, openaiKey, {
        extractedAttachmentText: safeExtractedTextFromAttachments,
        existingSourcesCount: displaySources.length,
        sourcesSummary: displaySources.slice(0, 3).map(s => `${s.domain}: ${s.passage.slice(0, 100)}`).join('; '),
        responseLanguage,
      });

      if (aiVerdict) {
        if (aiVerdict.suggestedInquiries && aiVerdict.suggestedInquiries.length > 0) {
          aiSuggestedInquiries = aiVerdict.suggestedInquiries;
        }
      }
    } catch (aiErr) {
      console.warn('AI Challenger evaluation skipped:', aiErr);
    }
  }

  await new Promise(r => setTimeout(r, 60));

  emitStage({
    id: 'challenger',
    title: 'Adversarial Challenger Verification',
    status: 'completed',
    summary: `Audit complete: ${verdicts.factualCorrectness} (${verdicts.verdictStatus === 'right' ? '✔ Verified' : verdicts.verdictStatus === 'false' ? '✖ False' : '⚪ Unverified'}${verdicts.scamRisk === 'Not applicable' ? '' : `, Threat: ${verdicts.scamRisk} Risk`}).`,
    details: { challengerAudit: displayChallengerAudit, explanation: displayAssessment.explanation },
  });

  // Early metadata emission
  onMeta?.({
    caseId,
    taskType: plan.taskType,
    verdicts: displayAssessment,
    claims,
    sources: displaySources,
    retrieval: initialRetrievalStats,
    challengerAudit: displayChallengerAudit,
    verdictExplanation: displayAssessment.explanation,
    forensics,
    statutes,
    documentAnalysis: primaryDocAnalysis,
    urlAnalysis: primaryUrlAnalysis,
    suggestedInquiries: aiSuggestedInquiries.length > 0 ? aiSuggestedInquiries : localizedSuggestions(displayAssessment, responseLanguage),
    jobOfferAnalysis,
    language: responseLanguage,
  });

  // STAGE 5: Synthesizing Intelligence Briefing
  emitStage({
    id: 'synthesize',
    title: 'Synthesizing Intelligence Briefing',
    status: 'running',
    summary: 'Formulating evidence-backed findings and citizen guidance with citations...',
  });

  // Render every visible conclusion from the validated assessment. Free-text model
  // output is deliberately not used here because section-shape validation cannot
  // prove that a generated conclusion agrees with the structured result.
  const answerMarkdown = buildInitialAnswer({ assessment: displayAssessment, sources: displaySources, jobOfferAnalysis, language: responseLanguage, prompt });
  const chunkSize = 16;
  for (let i = 0; i < answerMarkdown.length; i += chunkSize) {
    emitToken(answerMarkdown.slice(i, i + chunkSize));
    await new Promise(r => setTimeout(r, 6));
  }

  const citedSourceIds = extractCitedSourceIds(accumulatedText, displaySources);
  const finalDisplaySources = displaySources.map(source => ({
    ...source,
    isCited: citedSourceIds.includes(source.id),
  }));
  const finalRetrievalStats: RetrievalStats = {
    ...initialRetrievalStats,
    citedSourceIds,
  };

  emitStage({
    id: 'synthesize',
    title: 'Synthesizing Intelligence Briefing',
    status: 'completed',
    summary: `Found ${finalRetrievalStats.searchResultsFound} result${finalRetrievalStats.searchResultsFound === 1 ? '' : 's'} · Inspected ${finalRetrievalStats.pagesInspected} page${finalRetrievalStats.pagesInspected === 1 ? '' : 's'}${finalRetrievalStats.pagesUnavailable > 0 ? ` · Unavailable ${finalRetrievalStats.pagesUnavailable} page${finalRetrievalStats.pagesUnavailable === 1 ? '' : 's'}` : ''} · Cited ${citedSourceIds.length} source${citedSourceIds.length === 1 ? '' : 's'}.`,
  });

  const certificate = generateVerificationCertificate(
    caseId,
    prompt,
    verdicts,
    statutes.applicableStatutes.map(s => s.section),
    citedSourceIds.length
  );
  const incidentReport = generateIncidentReport(
    caseId,
    prompt,
    plan.taskType,
    verdicts,
    forensics,
    safeExtractedTextFromAttachments
  );

  const finalMeta: InvestigationMeta = {
    caseId,
    taskType: plan.taskType,
    verdicts: displayAssessment,
    claims,
    sources: finalDisplaySources,
    retrieval: finalRetrievalStats,
    challengerAudit: displayChallengerAudit,
    verdictExplanation: displayAssessment.explanation,
    forensics,
    incidentReport,
    manipulationAudit,
    statutes,
    documentAnalysis: primaryDocAnalysis,
    urlAnalysis: primaryUrlAnalysis,
    certificate,
    suggestedInquiries: aiSuggestedInquiries.length > 0 ? aiSuggestedInquiries : localizedSuggestions(displayAssessment, responseLanguage),
    jobOfferAnalysis,
    language: responseLanguage,
  };

  onMeta?.(finalMeta);

  return {
    caseId,
    plan,
    briefing: accumulatedText.trim(),
    stages,
    verdicts: displayAssessment,
    sources: finalDisplaySources,
    meta: finalMeta,
    certificate,
    incidentReport,
  };
}
