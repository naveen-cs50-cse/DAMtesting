import { NextRequest, NextResponse } from 'next/server';
import { validateSearchRequest } from '@/lib/security/schemas';
import { checkRateLimit, getClientIdentity } from '@/lib/security/rateLimiter';
import { createStructuredErrorResponse, ERROR_CODES, withTimeout } from '@/lib/security/errors';
import { createRequestLogger } from '@/lib/security/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const logger = createRequestLogger(req);
  const clientIdentity = getClientIdentity(req.headers);

  // Rate Limiting
  const rateLimit = checkRateLimit(clientIdentity.clientId, clientIdentity.tier);
  if (!rateLimit.allowed) {
    logger.warn('Search rate limit exceeded', { clientId: clientIdentity.clientId });
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

    const validation = validateSearchRequest(body);
    if (!validation.success || !validation.data) {
      return createStructuredErrorResponse(
        400,
        validation.errors?.[0]?.message || 'Invalid search query.',
        ERROR_CODES.VALIDATION_FAILED,
        logger.requestId,
        { validationErrors: validation.errors }
      );
    }

    const { query, limit } = validation.data;
    const bodyRecord = body as Record<string, unknown>;
    const tavilyKey = typeof bodyRecord.apiKey === 'string' && bodyRecord.apiKey
      ? bodyRecord.apiKey
      : process.env.TAVILY_API_KEY;

    if (!tavilyKey) {
      return createStructuredErrorResponse(
        400,
        'TAVILY_API_KEY is not configured on server or in client request headers.',
        ERROR_CODES.BAD_REQUEST,
        logger.requestId
      );
    }

    logger.info('Executing search request', { queryLength: query.length, limit });

    const searchFetch = fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: typeof bodyRecord.search_depth === 'string' ? bodyRecord.search_depth : 'advanced',
        include_answer: true,
        max_results: limit,
      }),
      signal: req.signal
    });

    const tavilyRes = await withTimeout(searchFetch, 10000, 'Tavily search provider timed out after 10s.');
    if (!tavilyRes.ok) {
      const errText = await tavilyRes.text();
      logger.error('Upstream search provider error', { status: tavilyRes.status, errText });
      return createStructuredErrorResponse(
        tavilyRes.status >= 500 ? 502 : 400,
        `Search provider responded with status ${tavilyRes.status}.`,
        ERROR_CODES.SERVICE_UNAVAILABLE,
        logger.requestId,
        { upstreamStatus: tavilyRes.status }
      );
    }

    const result = await tavilyRes.json();
    return NextResponse.json(result, {
      headers: {
        'x-request-id': logger.requestId
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    logger.error('Search request failed', { message, isTimeout });

    return createStructuredErrorResponse(
      isTimeout ? 504 : 500,
      message,
      isTimeout ? ERROR_CODES.TIMEOUT : ERROR_CODES.INTERNAL_ERROR,
      logger.requestId
    );
  }
}
