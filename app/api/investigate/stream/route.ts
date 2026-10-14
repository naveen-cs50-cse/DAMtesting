import { NextRequest } from 'next/server';
import { coordinateInvestigation } from '@/lib/investigation/coordinator';
import { searchAndReadSources } from '@/lib/investigation/researcher';
import { verifyAndChallenge } from '@/lib/investigation/verifier';
import { performForensicAnalysis } from '@/lib/investigation/forensics';
import { extractEntitiesFromText } from '@/lib/investigation/ocr';
import { generateIncidentReport } from '@/lib/investigation/incidentReport';
import { analyzeManipulationVectors } from '@/lib/investigation/manipulation';
import { evaluateStatutoryContradictions } from '@/lib/investigation/statutes';
import { generateVerificationCertificate } from '@/lib/investigation/certificate';
import { Attachment, ChatTurn, IndexedSource } from '@/lib/investigation/types';
import { ingestUrlSecurely } from '@/lib/investigation/urlIngestion';
import { validateInvestigateRequest } from '@/lib/security/schemas';
import { checkRateLimit, checkProviderSpendProtection, recordProviderSpend, getClientIdentity } from '@/lib/security/rateLimiter';
import { createStructuredErrorResponse, ERROR_CODES } from '@/lib/security/errors';
import { createRequestLogger } from '@/lib/security/logger';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { evaluateClaimWithAI } from '@/lib/investigation/aiChallenger';
import fs from 'fs';
import path from 'path';

function getEffectiveOpenAIKey(explicitKey?: string): string {
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

function getEffectiveTavilyKey(explicitKey?: string): string {
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

function generateSmartFollowUpFallback(prompt: string, history: ChatTurn[]): string {
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
    return `### Official Incident Reporting Guide (India)

Follow these official steps to report this cyber threat and freeze any fraudulent fund transfers:

#### 1. Immediate Financial Freeze — 1930 Helpline (Golden Hour)
- **Dial 1930** immediately from your mobile phone.
- The operator will ask for:
  - Your Bank Name and Account Number
  - Suspect's Phone Number or UPI ID
  - Date, time, and exact amount deducted
- The **Citizen Financial Cyber Fraud Reporting System (CFCFRMS)** will dispatch an automated lien request to the destination bank to freeze the recipient account before money is withdrawn at an ATM.

#### 2. File Official Portal Complaint — cybercrime.gov.in
- Visit **[cybercrime.gov.in](https://cybercrime.gov.in)** and click **"Report Other Cyber Crime"**.
- Register using your mobile OTP.
- Upload screenshots of the SMS, WhatsApp forward, or call log.
- Download the formal **Cyber Complaint PDF acknowledgment** for bank and police records.

#### 3. Report Malicious Sender on DoT Chakshu
- Visit **[sancharsaathi.gov.in/sfc/](https://sancharsaathi.gov.in/sfc/)**.
- Submit the fraud caller's 10-digit number or SMS header.
- The Department of Telecommunications (DoT) will block the caller across all Indian telecom networks.`;
  }

  if (lower.includes('clicked') || lower.includes('otp') || lower.includes('hacked') || lower.includes('downloaded')) {
    return `### 🚨 Urgent Emergency Triage: Immediate Actions Required

If you have already clicked the link, downloaded an APK, or shared OTPs:

1. **Disconnect Internet Access Immediately:**  
   Turn on **Airplane Mode** or disable both Mobile Data and Wi-Fi immediately. This cuts off remote command-and-control servers from transmitting your OTPs and keystrokes.
2. **Block Bank & UPI Access:**  
   Call your bank's 24x7 toll-free helpline from another phone or use your bank's automated IVR to **instantly freeze Netbanking and UPI**.
3. **Remove Malicious APKs:**  
   - Open **Android Settings &rarr; Apps &rarr; See All Apps**.
   - Look for recently installed apps without genuine icons or named *YONO, Update, Rewards, Wedding, Traffic, or System Service*.
   - Tap **Uninstall**. If "Uninstall" is greyed out, go to **Settings &rarr; Security &rarr; Device Admin Apps**, revoke permissions, and restart in **Safe Mode** to remove.
4. **Dial 1930 Cybercrime Helpline:**  
   Report the incident immediately. Under RBI guidelines, reporting unauthorized debits within 3 days grants you complete protection from liability.`;
  }

  return `### Regulatory Guidance & Next Steps

Based on authoritative Indian statutory directives:

- **Do Not Engage:** Never call back 10-digit personal mobile numbers claiming to represent government agencies, power discoms, or banks.
- **Verify Directly:** Access only official portals (**rbi.org.in**, **pib.gov.in**, **sancharsaathi.gov.in**).
- **Report & Warn Others:** Share the debunked facts with family members and forward suspicious numbers to **1930 / Chakshu**.

Would you like me to draft a complaint letter for your bank manager or provide step-by-step instructions for filing an online cyber report?`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const logger = createRequestLogger(req);
  const clientIdentity = getClientIdentity(req.headers);

  // 1. Rate Limiting Check
  const rateLimit = checkRateLimit(clientIdentity.clientId, clientIdentity.tier);
  if (!rateLimit.allowed) {
    logger.warn('Investigation rate limit exceeded', { clientId: clientIdentity.clientId });
    return createStructuredErrorResponse(
      429,
      rateLimit.reason || 'Rate limit exceeded.',
      ERROR_CODES.RATE_LIMITED,
      logger.requestId,
      { retryAfterSeconds: rateLimit.retryAfterSeconds },
      { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) }
    );
  }

  // 2. Provider Spend Protection Check
  const spendCheck = checkProviderSpendProtection(clientIdentity.clientId, clientIdentity.tier, 2500);
  if (!spendCheck.allowed) {
    logger.warn('Provider spend limit exceeded', { clientId: clientIdentity.clientId });
    return createStructuredErrorResponse(
      429,
      spendCheck.reason || 'Provider spend protection active.',
      ERROR_CODES.SPEND_LIMIT_EXCEEDED,
      logger.requestId
    );
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return createStructuredErrorResponse(
        400,
        'Malformed or empty JSON request body.',
        ERROR_CODES.BAD_REQUEST,
        logger.requestId
      );
    }

    // 3. Schema & Limit Enforcement
    const validation = validateInvestigateRequest(rawBody);
    if (!validation.success || !validation.data) {
      logger.warn('Investigation request schema rejected', { errors: validation.errors });
      return createStructuredErrorResponse(
        400,
        validation.errors?.[0]?.message || 'Invalid investigation parameters.',
        ERROR_CODES.VALIDATION_FAILED,
        logger.requestId,
        { validationErrors: validation.errors }
      );
    }

    const data = rawBody as Record<string, unknown>;
    const prompt = validation.data.prompt || '';
    const attachments: Attachment[] = (validation.data.attachments as Attachment[]) || [];
    const lang = (data.lang as string) || 'auto';
    const history: ChatTurn[] = (data.history as ChatTurn[]) || [];
    const openaiKey = getEffectiveOpenAIKey((data.apiKey as string) || undefined);
    const tavilyKey = getEffectiveTavilyKey((data.tavilyKey as string) || undefined);

    // Record estimated token spend
    recordProviderSpend(clientIdentity.clientId, clientIdentity.tier, 2500);
    logger.info('Started streamed investigation', {
      promptLength: prompt.length,
      attachmentsCount: attachments.length,
      lang
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, payload: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          // STAGE 0: Secure Web Ingestion & Link Forensics (for submitted URLs)
          const urlAttachments = attachments.filter(a => a.isUrl || a.type === 'url' || (a.url && a.url.startsWith('http')));
          if (urlAttachments.length > 0) {
            sendEvent('stage', {
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
            sendEvent('stage', {
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

          // Handle Conversational Intent (Greetings, pleasantries, general chat)
          if (plan.taskType === 'conversational') {
            let streamed = false;
            if (openaiKey) {
              try {
                const openai = createOpenAI({ apiKey: openaiKey });
                const systemPrompt = `You are UseDAM, an intelligent and friendly AI verification & intelligence assistant for India.
You specialize in fact-checking viral claims, investigating fake government circulars or gazettes (RBI, TRAI, Ministries), and detecting cyber fraud or scam communications.
The user is having a casual conversation, greeting you, or asking general questions.
Respond warmly, concisely, and helpfully like ChatGPT. Introduce what you can do (fact-check viral news, inspect suspicious SMS/calls, analyze circular PDFs or links), and ask how you can help them today.`;

                const result = streamText({
                  model: openai('gpt-4o-mini'),
                  system: systemPrompt,
                  messages: [
                    ...history.slice(-4).map(h => ({ role: h.role, content: h.content || '' })),
                    { role: 'user', content: prompt }
                  ],
                  temperature: 0.6,
                  abortSignal: req.signal,
                });

                for await (const delta of result.textStream) {
                  streamed = true;
                  sendEvent('token', { text: delta });
                }
              } catch (err) {
                console.warn('Conversational streaming fallback:', err);
              }
            }

            if (!streamed) {
              const fallbackGreeting = `Hello! I'm **UseDAM**, your AI verification and intelligence assistant.

I can help you:
- **Fact-check viral claims** & social media rumors against official Indian registries.
- **Verify government circulars** & gazettes (RBI, TRAI, SERC, Ministries).
- **Inspect suspicious messages, calls, or links** for scams, phishing, and APK malware.
- **Analyze uploaded documents** (PDFs, screenshots) with forensic OCR scrutiny.

How can I assist your investigation today?`;
              for (const chunk of fallbackGreeting.split(' ')) {
                sendEvent('token', { text: chunk + ' ' });
                await new Promise(r => setTimeout(r, 15));
              }
            }

            sendEvent('meta', {
              taskType: 'conversational',
              sources: [],
              verdicts: null
            });

            sendEvent('done', { success: true });
            controller.close();
            return;
          }

          // Handle Follow-Up Questions & Actionable Advisory (Complaint drafting, 1930 reporting, triage steps)
          if (plan.taskType === 'follow_up') {
            sendEvent('stage', {
              id: 'advisory',
              title: 'Consulting Cyber Defense & Regulatory Knowledge',
              status: 'running',
              summary: 'Synthesizing tailored citizen guidance, complaint draft, or reporting instructions...',
            });

            await new Promise(r => setTimeout(r, 120));

            sendEvent('stage', {
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
  Provide clear, numbered step-by-step instructions:
  1. Call 1930 (National Cyber Crime Reporting Helpline) immediately (golden hour).
  2. Visit cybercrime.gov.in -> "Report Other Cyber Crime" -> enter transaction/call details.
  3. Report malicious calls/SMS to Chakshu portal on sancharsaathi.gov.in.
- If they ask what to do if they already clicked a link, downloaded an APK, or shared OTP:
  Give urgent triage steps:
  1. Immediately turn on Airplane Mode or disconnect from Wi-Fi/mobile data.
  2. Call your bank immediately to freeze netbanking, UPI, and debit cards.
  3. Uninstall suspicious APKs from Settings -> Apps, or boot in Safe Mode to remove hidden admin profiles.
  4. File an immediate complaint on 1930.
- If they ask for general advice, explanations, or WhatsApp summaries:
  Provide clear, reassuring, practical advice with bold bullet points.
- Tone: Empathetic, expert, decisive, and reassuring.`;

                const result = streamText({
                  model: openai('gpt-4o-mini'),
                  system: systemPrompt,
                  messages: [
                    ...history.slice(-6).map(h => ({ role: h.role, content: h.content || '' })),
                    { role: 'user', content: prompt }
                  ],
                  temperature: 0.3,
                  abortSignal: req.signal,
                });

                for await (const delta of result.textStream) {
                  streamed = true;
                  sendEvent('token', { text: delta });
                }
              } catch (err) {
                console.warn('Follow-up streaming fallback:', err);
              }
            }

            if (!streamed) {
              const fallbackResponse = generateSmartFollowUpFallback(prompt, history);
              for (const chunk of fallbackResponse.split(' ')) {
                sendEvent('token', { text: chunk + ' ' });
                await new Promise(r => setTimeout(r, 12));
              }
            }

            sendEvent('meta', {
              taskType: 'follow_up',
              sources: [],
              verdicts: null
            });

            sendEvent('done', { success: true });
            controller.close();
            return;
          }

          // STAGE 1: Analysing Request
          sendEvent('stage', {
            id: 'analyze',
            title: 'Analysing Request & Scope',
            status: 'running',
            summary: 'Decomposing assertions, regulatory entities, and jurisdictional scope...',
          });

          await new Promise(r => setTimeout(r, 200));

          sendEvent('stage', {
            id: 'analyze',
            title: 'Analysing Request & Scope',
            status: 'completed',
            summary: `Identified task as ${plan.taskType.replace('_', ' ').toUpperCase()} with ${plan.queries.length} verification queries.`,
            details: { taskType: plan.taskType, queries: plan.queries, attachmentsCount: attachments.length },
          });

          // STAGE 2: Querying Authoritative Registries
          sendEvent('stage', {
            id: 'search',
            title: 'Querying Authoritative Registries',
            status: 'running',
            summary: 'Executing search across primary Indian portals (rbi.org.in, pib.gov.in, trai.gov.in)...',
          });

          const sources: IndexedSource[] = await searchAndReadSources(plan.queries, prompt, tavilyKey);

          sendEvent('stage', {
            id: 'search',
            title: 'Querying Authoritative Registries',
            status: 'completed',
            summary: sources.length > 0
              ? `Indexed ${sources.length} authoritative records across primary domains (${sources.map(s => s.domain).join(', ')})`
              : 'No live records indexed from search; proceeding with evidence-driven evaluation of submitted claim.',
            details: { sources: sources.map(s => ({ id: s.id, domain: s.domain, title: s.title, url: s.url })) },
          });

          // STAGE 3: Extracting & Cross-Referencing Evidence
          sendEvent('stage', {
            id: 'read',
            title: 'Extracting & Cross-Referencing Evidence',
            status: 'running',
            summary: 'Reading source passages, verifying publication dates, and checking claim stances...',
          });

          await new Promise(r => setTimeout(r, 250));

          sendEvent('stage', {
            id: 'read',
            title: 'Extracting & Cross-Referencing Evidence',
            status: 'completed',
            summary: sources.length > 0
              ? `Extracted ${sources.length} verified passages. Evaluated dates and institutional authority.`
              : 'Evaluated baseline evidence sufficiency against primary statutory portals.',
            details: { passages: sources.map(s => `[${s.id}] (${s.domain}): "${s.passage.slice(0, 140)}..."`) },
          });

          // Precompute entities, forensics, manipulation, and statutory context for the verdict engine
          const primaryDocAnalysis = attachments.find(a => a.documentAnalysis)?.documentAnalysis || null;
          const primaryUrlAnalysis = attachments.find(a => a.urlAnalysis)?.urlAnalysis || null;

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

          const promptEntities = extractEntitiesFromText(prompt);
          const allDetectedEntities = {
            phones: Array.from(new Set([...(promptEntities.phones || []), ...attachments.flatMap(a => a.threatEntities?.phones || [])])),
            urls: Array.from(new Set([
              ...(promptEntities.urls || []),
              ...attachments.flatMap(a => [
                ...(a.threatEntities?.urls || []),
                ...(a.url ? [a.url] : []),
                ...(a.urlAnalysis?.finalUrl ? [a.urlAnalysis.finalUrl] : []),
                ...(a.urlAnalysis?.downloadLinks || [])
              ])
            ])),
            senderIds: Array.from(new Set([...(promptEntities.senderIds || []), ...attachments.flatMap(a => a.threatEntities?.senderIds || [])])),
            amounts: Array.from(new Set([...(promptEntities.amounts || []), ...attachments.flatMap(a => a.threatEntities?.amounts || [])]))
          };

          const forensics = performForensicAnalysis(prompt, extractedTextFromAttachments, allDetectedEntities);
          const manipulationAudit = analyzeManipulationVectors(prompt, extractedTextFromAttachments);
          const statutes = evaluateStatutoryContradictions(prompt, extractedTextFromAttachments, allDetectedEntities);

          // STAGE 4: Adversarial Challenger Verification (Evidence-Driven Verdict Engine)
          sendEvent('stage', {
            id: 'challenger',
            title: 'Adversarial Challenger Verification',
            status: 'running',
            summary: 'Evaluating source authority, relevance, recency, stance, and agreement...',
          });

          const {
            verdicts,
            claims,
            challengerAudit,
            evaluatedSources = sources,
            explanation
          } = verifyAndChallenge(prompt, plan.taskType, sources, {
            threatEntities: allDetectedEntities,
            forensics,
            manipulation: manipulationAudit,
            statutes,
            documentAnalysis: primaryDocAnalysis,
            urlAnalysis: primaryUrlAnalysis,
          });

          // AI Adversarial Fact-Checking Challenger using OpenAI API
          if (openaiKey && prompt.trim()) {
            try {
              const aiVerdict = await evaluateClaimWithAI(prompt, openaiKey, {
                extractedAttachmentText: extractedTextFromAttachments,
                existingSourcesCount: evaluatedSources.length,
                sourcesSummary: evaluatedSources.slice(0, 3).map(s => `${s.domain}: ${s.passage.slice(0, 100)}`).join('; ')
              });

              if (aiVerdict) {
                verdicts.verdictStatus = aiVerdict.verdictStatus;
                verdicts.factualCorrectness = aiVerdict.factualCorrectness;

                if (aiVerdict.scamRisk === 'High') {
                  verdicts.scamRisk = 'High';
                  if (!verdicts.riskTriggers.includes('Active Phishing / Extortion Scam')) {
                    verdicts.riskTriggers.push('Active Phishing / Extortion Scam');
                  }
                } else if (aiVerdict.verdictStatus === 'false' && verdicts.scamRisk === 'Low') {
                  verdicts.scamRisk = 'Medium';
                  if (!verdicts.riskTriggers.includes('Viral Misinformation Rumor')) {
                    verdicts.riskTriggers.push('Viral Misinformation Rumor');
                  }
                }

                if (aiVerdict.explanation) {
                  if (explanation) {
                    explanation.factualRationale = aiVerdict.explanation;
                    explanation.summary = `Determination: ${aiVerdict.factualCorrectness} (Threat: ${verdicts.scamRisk} Risk). ${aiVerdict.explanation}`;
                  }
                }

                if (claims && claims.length > 0) {
                  claims[0].label = aiVerdict.factualCorrectness;
                  if (aiVerdict.verdictStatus === 'false') {
                    claims[0].contradicting = aiVerdict.explanation;
                  } else if (aiVerdict.verdictStatus === 'right') {
                    claims[0].supporting = aiVerdict.explanation;
                  }
                }

                challengerAudit.unshift(`AI Fact-Check: ${aiVerdict.explanation}`);
              }
            } catch (aiErr) {
              console.warn('AI Challenger evaluation skipped:', aiErr);
            }
          }

          await new Promise(r => setTimeout(r, 200));

          sendEvent('stage', {
            id: 'challenger',
            title: 'Adversarial Challenger Verification',
            status: 'completed',
            summary: `Audit complete: ${verdicts.factualCorrectness} (${verdicts.verdictStatus === 'right' ? '✔ Verified' : verdicts.verdictStatus === 'false' ? '✖ False' : '⚪ Unverified'}, Threat: ${verdicts.scamRisk} Risk).`,
            details: { challengerAudit, explanation },
          });

          // Early metadata emission: Immediately provides sources and verdict to UI while briefing streams
          sendEvent('meta', {
            taskType: plan.taskType,
            verdicts,
            claims,
            sources: evaluatedSources,
            challengerAudit,
            verdictExplanation: explanation,
            forensics,
            statutes,
            documentAnalysis: primaryDocAnalysis,
            urlAnalysis: primaryUrlAnalysis,
          });

          // STAGE 5: Synthesizing Intelligence Briefing
          sendEvent('stage', {
            id: 'synthesize',
            title: 'Synthesizing Intelligence Briefing',
            status: 'running',
            summary: 'Formulating evidence-backed findings and citizen guidance with citations...',
          });

          let streamedWithSDK = false;

          if (openaiKey) {
            try {
              const openai = createOpenAI({ apiKey: openaiKey });
              const systemPrompt = `You are UseDAM, an evidence-first verification and intelligence assistant for India.
Your goal is to provide a comprehensive, objective, and beautifully synthesized intelligence briefing answering the user's inquiry based on authoritative facts.

CRITICAL DIRECTIVES:
1. Start directly with the core truth, conclusion, or verification status in clear, decisive language:
   - If the claim is factually false or debunked (e.g. death rumors of living leaders like PM Modi, false currency bans, extortion scams), declare decisively in the very first sentence that the claim is **FALSE / A RUMOR / A FRAUDULENT SCAM**. Explain the real facts immediately.
   - If the claim is factually true, confirm decisively in the first sentence that the assertion is **TRUE / OFFICIALLY VERIFIED**.
   - If evidence is genuinely unverified or inconclusive, state "Unverified" and "Pending Official Notice" honestly.
2. Synthesize information naturally and authoritatively. Do NOT force rigid generic boilerplate headers like "Primary Finding".
3. Organize the explanation with natural, topic-appropriate subheadings and bullet points (e.g. "Current Regulatory Status", "Official Facts", "Actionable Guidance").
4. Always cite sources inline using [1], [2], etc., corresponding to indexed sources where available.
5. **Bold** critical conclusions, official regulatory portals (e.g. **rbi.org.in**, **pib.gov.in**, **1930 Cybercrime Helpline**), and key directives.
6. If language is specified (${lang}), respond in that language; otherwise use English.
7. For documents: note page-level circular identifiers neutrally. For web links: evaluate domain credibility and warn against APK/malware payloads.`;

              const sourcesText = evaluatedSources.length > 0
                ? evaluatedSources.map(s => `[${s.id}] Domain: ${s.domain}\nTitle: ${s.title}\nDate: ${s.date}\nPassage: ${s.passage}`).join('\n\n')
                : '(No authoritative records indexed for this inquiry)';

              const docText = primaryDocAnalysis ? `\n\nDocument Forensics & Page Findings:\n- Analyzed Pages: ${primaryDocAnalysis.pageCount}\n- Circular Numbers: ${primaryDocAnalysis.extractedIdentifiers.circularNumbers.join(', ') || 'None'}\n- Authorities: ${primaryDocAnalysis.extractedIdentifiers.issuingAuthorities.join(', ') || 'None'}\n- Page Details:\n${primaryDocAnalysis.pages.map(p => `  * [Page ${p.pageNumber}]: Circulars: ${p.circularNumbers.join(', ') || 'None'}, Dates: ${p.dates.join(', ') || 'None'}, Amounts: ${p.amounts.join(', ') || 'None'}`).join('\n')}\n- Anomalies: ${primaryDocAnalysis.anomalies.map(a => `[Page ${a.pageNumber}] ${a.details}`).join('; ') || 'None'}\n- Forensic Summary: ${primaryDocAnalysis.forensicSummary}` : '';

              const urlText = primaryUrlAnalysis
                ? `\n\nIngested Web Source Analysis:\n- Target URL: ${primaryUrlAnalysis.finalUrl}\n- Domain: ${primaryUrlAnalysis.domain} (Risk: ${primaryUrlAnalysis.domainRisk.riskLevel})\n- Status: ${primaryUrlAnalysis.status}\n- Page Title: ${primaryUrlAnalysis.title || 'N/A'}\n- Published: ${primaryUrlAnalysis.publishedDate || 'Unknown'}\n- Author: ${primaryUrlAnalysis.author || 'Unknown'}\n- Extracted Claims:\n${primaryUrlAnalysis.claims.map(c => `  * ${c}`).join('\n') || '  (No declarative claims)'}\n- Download Links: ${primaryUrlAnalysis.downloadLinks.join(', ') || 'None'}\n- Domain Warnings: ${primaryUrlAnalysis.domainRisk.warnings.join('; ') || 'None'}`
                : '';

              const userContent = [
                `User Inquiry: ${prompt || '(Investigation initiated from uploaded document/image/link)'}`,
                extractedTextFromAttachments ? `\n\nExtracted Attachment Evidence:\n${extractedTextFromAttachments}` : '',
                docText,
                urlText,
                `\nTask Type: ${plan.taskType}`,
                `\nAssessed Factual Correctness: ${verdicts.factualCorrectness}`,
                `\nAssessed Verdict Status: ${verdicts.verdictStatus || 'evaluated'}`,
                `\nAssessed Threat Level: ${verdicts.scamRisk} Risk`,
                `\nCore Truth / Fact-Check Finding: ${explanation?.factualRationale || 'See sources'}`,
                `\n\nIndexed Sources:\n${sourcesText}`,
                `\n\nDraft the comprehensive evidence briefing:`
              ].join('');

              const result = streamText({
                model: openai('gpt-4o-mini'),
                system: systemPrompt,
                messages: [
                  ...history.slice(-4).map(h => ({ role: h.role, content: h.content || '' })),
                  {
                    role: 'user',
                    content: userContent
                  }
                ],
                temperature: 0.15,
                abortSignal: req.signal,
              });

              for await (const delta of result.textStream) {
                streamedWithSDK = true;
                sendEvent('token', { text: delta });
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn('Vercel AI SDK streaming warning:', msg);
            }
          }

          if (!streamedWithSDK) {
            let fallbackMarkdown = '';

            if (verdicts.factualCorrectness === 'Contradicted') {
              const citations = evaluatedSources.length > 0 ? evaluatedSources.map(s => `[${s.id}]`).join('') : '';
              const isExtortion = verdicts.scamRisk === 'High';
              fallbackMarkdown = `This communication is **${isExtortion ? 'a fraudulent scam' : 'factually false and contradicted'}** ${citations}.

${explanation?.factualRationale || (isExtortion ? 'Legitimate utility providers, banks, and government authorities never demand urgent contact via personal 10-digit mobile numbers or issue immediate disconnection threats without formal written notice.' : 'Official regulatory records confirm that no such notification or policy has been issued.')}

**Key Facts:**
- **Statutory Standard**: Official directives contradict the claims in this message.
- **Verification Status**: Direct checks against primary regulatory records refute this assertion ${citations}.

**Actionable Guidance:**
${isExtortion
  ? '⚠️ **Do not call the provided number, click any links, or share OTPs / personal details.** You can report this fraud immediately to the **1930 Cybercrime Helpline** or through the **Chakshu portal (sancharsaathi.gov.in)**.'
  : '⚠️ **Do not forward unverified messages.** Always confirm policy claims directly through official portals such as **pib.gov.in**.'}
              `.trim();
            } else if (verdicts.factualCorrectness === 'Supported') {
              const citations = evaluatedSources.length > 0 ? evaluatedSources.map(s => `[${s.id}]`).join('') : '';
              fallbackMarkdown = `This assertion is **factually verified and officially confirmed** ${citations}.

${explanation?.factualRationale || 'Published primary gazettes and official regulatory circulars substantiate the provisions mentioned.'}

**Key Facts:**
- Official circulars and statutory notifications substantiate this claim ${citations}.
- Directives have been verified against active government records.

**Actionable Guidance:**
Refer directly to official ministry portals or the referenced circular for implementation details.
              `.trim();
            } else if (verdicts.factualCorrectness === 'Mixed') {
              const citations = evaluatedSources.length > 0 ? evaluatedSources.map(s => `[${s.id}]`).join('') : '';
              fallbackMarkdown = `This inquiry reflects **state-specific or mixed regulatory findings** ${citations}.

${explanation?.factualRationale || 'Provisions vary depending on state-level electricity distribution companies (DISCOMs) or local jurisdictions.'}

**Key Facts:**
- Cross-examination shows differing enforcement timelines or local rules across regions ${citations}.
- Certain provisions are subject to local distribution company or department guidelines.

**Actionable Guidance:**
Check with your specific state utility or regional department before relying on general interpretations.
              `.trim();
            } else {
              // UNVERIFIED / INSUFFICIENT EVIDENCE
              fallbackMarkdown = `This claim is currently **unverified (insufficient evidence)**.

No primary government gazette, statutory circular, or official notification was identified to substantiate or refute this claim.

**Key Facts:**
- ${explanation?.sufficiencyRationale || 'No authoritative official notification matching this claim was found in indexed records.'}
- Under strict evidence-first standards, absence of official records prevents declaring certainty.

**Actionable Guidance:**
1. **Do not treat as verified** until an official circular or gazette number is provided.
2. Verify directly through primary portals such as **pib.gov.in** or **india.gov.in**.
              `.trim();
            }

            if (primaryDocAnalysis) {
              const docSummaryLines = [
                `\n\n### Document Forensics & Page Findings`,
                `- **Pages Examined**: ${primaryDocAnalysis.pageCount} page(s) (Status: ${primaryDocAnalysis.status}, Text Stream: ${primaryDocAnalysis.pages.some(p => p.ocrApplied) ? 'OCR fallback applied' : 'Native embedded text'})`,
                `- **Circular / Reference**: ${primaryDocAnalysis.extractedIdentifiers.circularNumbers.length > 0 ? primaryDocAnalysis.extractedIdentifiers.circularNumbers.join(', ') : 'No standard circular reference found'}`,
                `- **Issuing Authority**: ${primaryDocAnalysis.extractedIdentifiers.issuingAuthorities.length > 0 ? primaryDocAnalysis.extractedIdentifiers.issuingAuthorities.join(', ') : 'Unspecified or non-standard authority header'}`,
                ...primaryDocAnalysis.pages.map(p => `- **[Page ${p.pageNumber}]**: ${p.dates.length > 0 ? `Dated ${p.dates.join(', ')}` : 'No explicit date'}. ${p.circularNumbers.length > 0 ? `Ref: ${p.circularNumbers.join(', ')}.` : ''} ${p.signaturesDetected ? 'Signature/Stamp block present.' : 'No signatory block.'}`),
              ];
              if (primaryDocAnalysis.anomalies.length > 0) {
                docSummaryLines.push(`\n**Flagged Inconsistencies**:`);
                primaryDocAnalysis.anomalies.forEach(a => {
                  docSummaryLines.push(`- *[Page ${a.pageNumber}]* ${a.details}`);
                });
                docSummaryLines.push(`\n*Note: Formatting anomalies and domain inconsistencies are flagged for administrative verification; visual heuristics alone do not establish document forgery.*`);
              }
              fallbackMarkdown += docSummaryLines.join('\n');
            }

            if (primaryUrlAnalysis) {
              const urlSummaryLines = [
                `\n\n### Web Source & Domain Forensics`,
                `- **Target Link**: [${primaryUrlAnalysis.finalUrl}](${primaryUrlAnalysis.finalUrl})`,
                `- **Domain Classification**: **${primaryUrlAnalysis.domain}** (${primaryUrlAnalysis.domainRisk.riskLevel} Risk)`,
                `- **Ingestion Status**: ${primaryUrlAnalysis.status.toUpperCase()}${primaryUrlAnalysis.statusCode ? ` (HTTP ${primaryUrlAnalysis.statusCode})` : ''}`,
                primaryUrlAnalysis.title ? `- **Page Title**: ${primaryUrlAnalysis.title}` : '',
                primaryUrlAnalysis.publishedDate ? `- **Published Date**: ${primaryUrlAnalysis.publishedDate}` : '',
                primaryUrlAnalysis.author ? `- **Author**: ${primaryUrlAnalysis.author}` : '',
                primaryUrlAnalysis.downloadLinks.length > 0 ? `- **Download Payloads Detected**: ${primaryUrlAnalysis.downloadLinks.join(', ')}` : '',
                primaryUrlAnalysis.claims.length > 0 ? `- **Extracted Factual Claims**:\n${primaryUrlAnalysis.claims.map(c => `  * "${c}"`).join('\n')}` : '',
              ].filter(Boolean);

              if (primaryUrlAnalysis.domainRisk.warnings.length > 0) {
                urlSummaryLines.push(`\n**Domain Security Flags**:`);
                primaryUrlAnalysis.domainRisk.warnings.forEach(w => {
                  urlSummaryLines.push(`- ⚠️ ${w}`);
                });
              }

              if (primaryUrlAnalysis.errorDetails) {
                urlSummaryLines.push(`\n*Access Status: ${primaryUrlAnalysis.errorDetails}*`);
              }

              fallbackMarkdown += urlSummaryLines.join('\n');
            }

            const chunkSize = 8;
            for (let i = 0; i < fallbackMarkdown.length; i += chunkSize) {
              sendEvent('token', { text: fallbackMarkdown.slice(i, i + chunkSize) });
              await new Promise(r => setTimeout(r, 16));
            }
          }

          sendEvent('stage', {
            id: 'synthesize',
            title: 'Synthesizing Intelligence Briefing',
            status: 'completed',
            summary: `Briefing synthesized with verified citations and actionable citizen guidance (${verdicts.factualCorrectness}).`,
          });

          const caseId = 'DAM-2026-' + Math.floor(1000 + Math.random() * 9000);
          const certificate = generateVerificationCertificate(
            caseId,
            prompt,
            verdicts,
            statutes.applicableStatutes.map(s => s.section),
            evaluatedSources.length
          );
          const incidentReport = generateIncidentReport(
            caseId,
            prompt,
            plan.taskType,
            verdicts,
            forensics,
            extractedTextFromAttachments
          );

          // Send metadata
          sendEvent('meta', {
            caseId,
            taskType: plan.taskType,
            verdicts,
            claims,
            sources: evaluatedSources,
            challengerAudit,
            verdictExplanation: explanation,
            forensics,
            incidentReport,
            manipulationAudit,
            statutes,
            documentAnalysis: primaryDocAnalysis,
            urlAnalysis: primaryUrlAnalysis,
            certificate,
          });

          sendEvent('done', { success: true });
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          sendEvent('error', { error: msg });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'x-request-id': logger.requestId
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Stream controller top-level error', { error: msg });
    return createStructuredErrorResponse(
      500,
      msg,
      ERROR_CODES.INTERNAL_ERROR,
      logger.requestId
    );
  }
}
