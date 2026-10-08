import { NextRequest, NextResponse } from 'next/server';
import { ingestUrlSecurely } from '@/lib/investigation/urlIngestion';
import { validateIngestUrlRequest } from '@/lib/security/schemas';
import { checkRateLimit, getClientIdentity } from '@/lib/security/rateLimiter';
import { createStructuredErrorResponse, ERROR_CODES } from '@/lib/security/errors';
import { createRequestLogger } from '@/lib/security/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const logger = createRequestLogger(req);
  const clientIdentity = getClientIdentity(req.headers);

  // Rate Limiting
  const rateLimit = checkRateLimit(clientIdentity.clientId, clientIdentity.tier);
  if (!rateLimit.allowed) {
    logger.warn('URL ingestion rate limit exceeded', { clientId: clientIdentity.clientId });
    return createStructuredErrorResponse(
      429,
      rateLimit.reason || 'Rate limit exceeded.',
      ERROR_CODES.RATE_LIMITED,
      logger.requestId,
      { retryAfterSeconds: rateLimit.retryAfterSeconds },
      { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) }
    );
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createStructuredErrorResponse(
        400,
        'Invalid JSON request body.',
        ERROR_CODES.BAD_REQUEST,
        logger.requestId
      );
    }

    const validation = validateIngestUrlRequest(body);
    if (!validation.success || !validation.data) {
      return createStructuredErrorResponse(
        400,
        validation.errors?.[0]?.message || 'Invalid URL parameters.',
        ERROR_CODES.VALIDATION_FAILED,
        logger.requestId,
        { validationErrors: validation.errors }
      );
    }

    const { url } = validation.data;
    logger.info('Starting secure URL ingestion', { urlLength: url.length });

    const result = await ingestUrlSecurely(url);

    // If SSRF was blocked, return 403 Forbidden with diagnostic explanation
    if (result.status === 'ssrf_blocked') {
      logger.warn('SSRF defense blocked request', { domain: result.domain, details: result.errorDetails });
      return createStructuredErrorResponse(
        403,
        result.errorDetails || 'SSRF protection triggered: Target resolves to a prohibited private network.',
        ERROR_CODES.SSRF_BLOCKED,
        logger.requestId,
        { result }
      );
    }

    return NextResponse.json({ success: true, result }, {
      headers: {
        'x-request-id': logger.requestId
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('URL ingestion failed', { error: msg });
    return createStructuredErrorResponse(
      500,
      msg,
      ERROR_CODES.INTERNAL_ERROR,
      logger.requestId
    );
  }
}
