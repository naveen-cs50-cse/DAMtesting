import { NextRequest } from 'next/server';
import { getInvestigation, subscribeToInvestigation, InvestigationStreamEvent } from '@/lib/investigation/store';
import { resolveCallerIdentity, enforceInvestigationOwnership } from '@/lib/security/auth';
import { createStructuredErrorResponse, ERROR_CODES } from '@/lib/security/errors';
import { createRequestLogger } from '@/lib/security/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const logger = createRequestLogger(req);
  const { id } = await params;

  if (!id) {
    return createStructuredErrorResponse(
      400,
      'Investigation ID is required.',
      ERROR_CODES.BAD_REQUEST,
      logger.requestId
    );
  }

  const record = getInvestigation(id);
  if (!record) {
    return createStructuredErrorResponse(
      404,
      `Investigation with ID "${id}" was not found.`,
      'INVESTIGATION_NOT_FOUND',
      logger.requestId
    );
  }

  const caller = resolveCallerIdentity(req.headers);
  const ownership = enforceInvestigationOwnership(record.ownerId, caller);
  if (!ownership.allowed) {
    logger.warn('Forbidden stream access attempt', {
      investigationId: id,
      ownerId: record.ownerId,
      callerId: caller.id
    });
    return createStructuredErrorResponse(
      403,
      ownership.reason || 'You do not have access to stream this investigation.',
      'FORBIDDEN_INVESTIGATION_ACCESS',
      logger.requestId
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const safeClose = () => {
        if (!isClosed) {
          isClosed = true;
          try {
            controller.close();
          } catch {
            // ignore
          }
        }
      };

      const sendEvent = (event: string, payload: unknown) => {
        if (isClosed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          safeClose();
        }
      };

      // 1. Replay stages already reached
      for (const stg of record.stages) {
        sendEvent('stage', stg);
      }

      // 2. Replay metadata if available
      if (record.meta) {
        sendEvent('meta', record.meta);
      }

      // 3. Replay briefing text already generated
      if (record.briefing) {
        sendEvent('token', { text: record.briefing });
      }

      // 4. Handle already finished investigations
      if (record.status === 'completed') {
        sendEvent('done', { success: true, investigationId: record.id });
        safeClose();
        return;
      }

      if (record.status === 'failed') {
        sendEvent('error', { error: record.error || 'Investigation failed.' });
        safeClose();
        return;
      }

      // 5. Subscribe to live ongoing events
      const unsubscribe = subscribeToInvestigation(id, (evt: InvestigationStreamEvent) => {
        if (isClosed) return;
        sendEvent(evt.event, evt.data);
        if (evt.event === 'done' || evt.event === 'error') {
          unsubscribe();
          safeClose();
        }
      });

      // 6. Handle client disconnect / abort signal
      req.signal.addEventListener('abort', () => {
        unsubscribe();
        safeClose();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'x-request-id': logger.requestId
    }
  });
}
