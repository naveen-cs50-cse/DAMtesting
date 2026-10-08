import { NextRequest, NextResponse } from 'next/server';
import { getWatchtowerFeed } from '@/lib/investigation/watchtower';
import { createStructuredErrorResponse, ERROR_CODES } from '@/lib/security/errors';
import { createRequestLogger } from '@/lib/security/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const logger = createRequestLogger(req);
  try {
    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get('q') || '';
    const rawCategory = searchParams.get('category') || 'All';

    // Query sanitization and bounds check
    const query = rawQuery.slice(0, 300).trim();
    const category = rawCategory.slice(0, 50).trim();

    logger.debug('Watchtower feed requested', { queryLength: query.length, category });

    const items = getWatchtowerFeed(query, category);

    return NextResponse.json({
      success: true,
      count: items.length,
      timestamp: new Date().toISOString(),
      feed: items
    }, {
      headers: {
        'x-request-id': logger.requestId,
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Watchtower feed generation error', { message });
    return createStructuredErrorResponse(
      500,
      'Failed to generate Watchtower feed.',
      ERROR_CODES.INTERNAL_ERROR,
      logger.requestId,
      { details: message }
    );
  }
}
