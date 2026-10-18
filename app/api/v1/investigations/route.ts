import { NextRequest, NextResponse } from 'next/server';
import { validateInvestigateRequest } from '@/lib/security/schemas';
import {
  checkRateLimit,
  checkProviderSpendProtection,
  recordProviderSpend
} from '@/lib/security/rateLimiter';
import { createStructuredErrorResponse, ERROR_CODES } from '@/lib/security/errors';
import { createRequestLogger } from '@/lib/security/logger';
import { resolveCallerIdentity } from '@/lib/security/auth';
import {
  createInvestigation,
  isSupportedInvestigationMode,
  SUPPORTED_INVESTIGATION_MODES,
  SupportedInvestigationMode
} from '@/lib/investigation/store';
import { Attachment, ChatTurn } from '@/lib/investigation/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const logger = createRequestLogger(req);
  const caller = resolveCallerIdentity(req.headers);

  // 1. Rate Limiting Check
  const rateLimit = checkRateLimit(caller.id, caller.tier);
  if (!rateLimit.allowed) {
    logger.warn('Rate limit exceeded', { callerId: caller.id });
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
  const spendCheck = checkProviderSpendProtection(caller.id, caller.tier, 2500);
  if (!spendCheck.allowed) {
    logger.warn('Spend limit exceeded', { callerId: caller.id });
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
      logger.warn('Investigation validation failed', { errors: validation.errors });
      return createStructuredErrorResponse(
        400,
        validation.errors?.[0]?.message || 'Invalid investigation parameters.',
        ERROR_CODES.VALIDATION_FAILED,
        logger.requestId,
        { validationErrors: validation.errors }
      );
    }

    const data = rawBody as Record<string, unknown>;
    const requestedMode = typeof data.mode === 'string' ? data.mode.trim().toLowerCase() : 'evidence';

    // 4. Validate Investigation Mode (Reject unsupported modes, e.g. job_check)
    if (!isSupportedInvestigationMode(requestedMode)) {
      return createStructuredErrorResponse(
        400,
        `Investigation mode '${requestedMode}' is not supported. Supported modes: ${SUPPORTED_INVESTIGATION_MODES.map(m => `'${m}'`).join(', ')}.`,
        'INVALID_MODE',
        logger.requestId,
        {
          receivedMode: requestedMode,
          supportedModes: SUPPORTED_INVESTIGATION_MODES
        }
      );
    }

    // 5. Idempotency Key Handling
    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      (typeof data.idempotencyKey === 'string' ? data.idempotencyKey : null);

    const prompt = validation.data.prompt || '';
    const attachments = (validation.data.attachments as Attachment[]) || [];
    const lang = (data.lang as string) || (validation.data.language as string) || 'auto';
    const history = (data.history as ChatTurn[]) || (validation.data.conversationHistory as unknown as ChatTurn[]) || [];

    // Record spend budget
    recordProviderSpend(caller.id, caller.tier, 2500);

    // 6. Create & Dispatch Investigation
    const { record, isExisting } = createInvestigation({
      ownerId: caller.id,
      prompt,
      attachments,
      mode: requestedMode as SupportedInvestigationMode,
      lang,
      history,
      idempotencyKey,
      apiKey: (data.apiKey as string) || undefined,
      tavilyKey: (data.tavilyKey as string) || undefined,
    });

    logger.info('Investigation queued/dispatched', {
      investigationId: record.id,
      caseId: record.caseId,
      ownerId: caller.id,
      isExisting,
      mode: record.mode
    });

    const responseStatus = isExisting ? 200 : 202;
    const links = {
      self: `/api/v1/investigations/${record.id}`,
      stream: `/api/v1/investigations/${record.id}/stream`,
      followUp: `/api/v1/investigations/${record.id}/follow-up`
    };

    return NextResponse.json(
      {
        investigationId: record.id,
        caseId: record.caseId,
        status: record.status,
        mode: record.mode,
        isIdempotentReplay: isExisting,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        links
      },
      {
        status: responseStatus,
        headers: {
          'x-request-id': logger.requestId,
          Location: `/api/v1/investigations/${record.id}`
        }
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to create investigation', { error: msg });
    return createStructuredErrorResponse(
      500,
      'Internal server error creating investigation.',
      ERROR_CODES.INTERNAL_ERROR,
      logger.requestId
    );
  }
}
