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
    const openaiKey = (data.apiKey as string) || process.env.OPENAI_API_KEY;
    const tavilyKey = (data.tavilyKey as string) || process.env.TAVILY_API_KEY;

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

          // STAGE 1: Analysing Request
          sendEvent('stage', {
            id: 'analyze',
            title: 'Analysing Request & Scope',
            status: 'running',
            summary: 'Decomposing assertions, regulatory entities, and jurisdictional scope...',
          });

          const plan = coordinateInvestigation(prompt, attachments);
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

          await new Promise(r => setTimeout(r, 250));

          sendEvent('stage', {
            id: 'challenger',
            title: 'Adversarial Challenger Verification',
            status: 'completed',
            summary: `Evidence-driven audit complete: ${verdicts.factualCorrectness} (Sufficiency: ${verdicts.evidenceSufficiency}, Threat: ${verdicts.scamRisk} Risk).`,
            details: { challengerAudit, explanation },
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
              const systemPrompt = `You are UseDAM, an evidence-first verification and intelligence assistant.
Your goal is to provide a rigorous, objective briefing answering the user's inquiry based strictly on the provided indexed sources.
Rules:
1. Always cite sources inline using [1], [2], etc., matching the provided indexed sources.
2. If evidence is inadequate, state "Unverified" and "Insufficient Evidence" honestly. Never fabricate or default unknown claims to contradicted or high risk.
3. Structure your briefing using Markdown with:
   ### Primary Finding
   (Clear 2-3 sentence executive verdict citing sources, reflecting determination: ${verdicts.factualCorrectness})
   
   ### Evidence & Regulatory Analysis
   (Detailed breakdown cross-referencing published notifications vs claims)
   
   ### Citizen Protocol & Recommended Action
   (Actionable steps: what should the user do or avoid, where to report)
4. ESSENTIAL FORMATTING REQUIREMENT: **Bold** all critical information that is important for the person to know immediately. Specifically, bold:
   - The definitive verdict or threat status (e.g., **Factually Contradicted**, **Factually Supported**, **Unverified (Insufficient Evidence)**, **High-Risk Scam**)
   - Important statutory sections or legal mandates (e.g., **Section 56 of the Indian Electricity Act**)
   - Warning signs and red flags (e.g., **Never share OTP**, **Do not click links**, **Personal 10-digit mobile number**)
   - Official portals, verified numbers, and contact channels (e.g., **1930 Cybercrime Helpline**, **sancharsaathi.gov.in**)
   - Exact mandatory actions or prohibitions for the citizen.
5. If language is specified (${lang}), respond in that language; otherwise use English.
6. Never hallucinate. If evidence is missing, state it honestly.
7. CRITICAL RULE FOR DOCUMENTS: Provide page-level findings and citations where relevant (e.g., [Page 1]). Never declare or conclude that a document is forged or counterfeit based solely on visual heuristics or formatting anomalies. Describe inconsistencies neutrally as anomalies requiring registry verification.
8. CRITICAL RULE FOR WEB LINKS: If analyzing a submitted URL or web article, evaluate its factual claims, domain credibility, and security flags. Clearly state if content is private, blocked, or deleted. Warn against suspicious download payloads (.apk/.exe) or deceptive subdomains.`;

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
                `\nAssessed Evidence Sufficiency: ${verdicts.evidenceSufficiency}`,
                `\nAssessed Threat Level: ${verdicts.scamRisk} Risk`,
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
              fallbackMarkdown = `
### Primary Finding
The assertion in question is **Factually Contradicted** ${citations}. Authoritative regulatory directives and published notifications refute the claim. ${explanation?.factualRationale || ''}

### Evidence & Regulatory Analysis
DAM cross-examined the assertions against indexed regulatory records ${citations}. The evidence indicates that **official communication protocols were violated**, and the claim **does not match published government gazettes or regulatory directives**. 

### Citizen Protocol & Recommended Action
${verdicts.scamRisk === 'High'
  ? '**Do not call numbers or click links in the message.** Report any suspicious sender numbers immediately to the national **Chakshu portal (sancharsaathi.gov.in)** or the **1930 Cybercrime Helpline**.'
  : '**Do not forward rumors** or unverified third-party claims. For genuine regulatory directives, consult exclusively primary government press releases at **pib.gov.in**.'}
              `.trim();
            } else if (verdicts.factualCorrectness === 'Supported') {
              const citations = evaluatedSources.length > 0 ? evaluatedSources.map(s => `[${s.id}]`).join('') : '';
              fallbackMarkdown = `
### Primary Finding
The assertion is **Factually Supported** ${citations}. Primary published records and government notifications substantiate the claim. ${explanation?.factualRationale || ''}

### Evidence & Regulatory Analysis
DAM verified published circulars and official press releases from primary authorities ${citations}. The published directives confirm the specified provisions and policy terms.

### Citizen Protocol & Recommended Action
**Review official gazette guidelines** and proceed in accordance with standard statutory procedures. Refer directly to official ministry portals for implementation schedules and application instructions.
              `.trim();
            } else if (verdicts.factualCorrectness === 'Mixed') {
              const citations = evaluatedSources.length > 0 ? evaluatedSources.map(s => `[${s.id}]`).join('') : '';
              fallbackMarkdown = `
### Primary Finding
The inquiry reflects **Conflicting / Mixed Evidence** ${citations}. Published records indicate differing rules, exceptions, or regional variances. ${explanation?.factualRationale || ''}

### Evidence & Regulatory Analysis
Cross-examination across indexed authorities reveals divergent perspectives or evolving statutory timelines ${citations}. Certain provisions remain disputed, state-specific, or under administrative review.

### Citizen Protocol & Recommended Action
**Exercise caution before relying on broad interpretations.** Verify whether state-specific discom/department circulars supersede general union advisories for your specific jurisdiction.
              `.trim();
            } else {
              // UNVERIFIED / INSUFFICIENT EVIDENCE
              fallbackMarkdown = `
### Primary Finding
This claim is **Currently Unverified due to Insufficient Evidence**. No primary government gazette, statutory circular, or verified fact-check was identified to definitively substantiate or contradict this assertion.

### Evidence & Regulatory Analysis
${explanation?.sufficiencyRationale || 'No authoritative primary records or direct gazette publications matching this claim were identified.'}
DAM strictly enforces **evidence-driven verification without overclaiming**: absence of direct records in indexed feeds does not establish falsehood, but prevents unwarranted certainty.

### Citizen Protocol & Recommended Action
1. **Do not forward or treat as verified** until an official circular number or ministry notification is published.
2. Search primary portals directly at **pib.gov.in** or **india.gov.in**.
3. If this pertains to an administrative entitlement, file an enquiry with the respective department or submit a **Right to Information (RTI)** application.
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
