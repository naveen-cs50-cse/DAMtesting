import { NextRequest } from 'next/server';
import { Attachment, ChatTurn } from '@/lib/investigation/types';
import { validateInvestigateRequest } from '@/lib/security/schemas';
import {
  checkRateLimit,
  checkProviderSpendProtection,
  recordProviderSpend,
  getClientIdentity
} from '@/lib/security/rateLimiter';
import { createStructuredErrorResponse, ERROR_CODES } from '@/lib/security/errors';
import { createRequestLogger } from '@/lib/security/logger';
import {
  runInvestigation,
  getEffectiveOpenAIKey,
  getEffectiveTavilyKey,
  SupportedInvestigationMode
} from '@/lib/investigation/service';

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
    const lang = (data.lang as string) || (validation.data.language as string) || 'auto';
    const history: ChatTurn[] = (data.history as ChatTurn[]) || (validation.data.conversationHistory as unknown as ChatTurn[]) || [];
    const mode = (data.mode as SupportedInvestigationMode) || 'evidence';
    const caseId = typeof data.caseId === 'string' ? data.caseId : undefined;
    const openaiKey = getEffectiveOpenAIKey((data.apiKey as string) || undefined);
    const tavilyKey = getEffectiveTavilyKey((data.tavilyKey as string) || undefined);

    // Record estimated token spend
    recordProviderSpend(clientIdentity.clientId, clientIdentity.tier, 2500);
    logger.info('Started streamed investigation', {
      promptLength: prompt.length,
      attachmentsCount: attachments.length,
      lang,
      mode
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, payload: unknown) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
          } catch {
            // controller may be closed if client disconnected
          }
        };

        try {
          await runInvestigation({
            prompt,
            attachments,
            mode,
            lang,
            history,
            caseId,
            openaiKey,
            tavilyKey,
            abortSignal: req.signal,
            onStage: stage => sendEvent('stage', stage),
            onToken: token => sendEvent('token', { text: token }),
            onMeta: meta => sendEvent('meta', meta),
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
