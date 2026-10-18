import { NextRequest, NextResponse } from 'next/server';
import { getInvestigation, addFollowUpInput } from '@/lib/investigation/store';
import { resolveCallerIdentity, enforceInvestigationOwnership } from '@/lib/security/auth';
import { createStructuredErrorResponse, ERROR_CODES } from '@/lib/security/errors';
import { createRequestLogger } from '@/lib/security/logger';
import { LIMITS } from '@/lib/security/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
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
    logger.warn('Forbidden follow-up access attempt', {
      investigationId: id,
      ownerId: record.ownerId,
      callerId: caller.id
    });
    return createStructuredErrorResponse(
      403,
      ownership.reason || 'You do not have access to this investigation.',
      'FORBIDDEN_INVESTIGATION_ACCESS',
      logger.requestId
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createStructuredErrorResponse(
      400,
      'Malformed JSON request body.',
      ERROR_CODES.BAD_REQUEST,
      logger.requestId
    );
  }

  const data = body as Record<string, unknown>;
  const prompt = typeof data.prompt === 'string' ? data.prompt.trim() : '';

  if (!prompt) {
    return createStructuredErrorResponse(
      400,
      'Follow-up prompt cannot be empty.',
      'EMPTY_PROMPT',
      logger.requestId
    );
  }

  if (prompt.length > LIMITS.MAX_PROMPT_LENGTH) {
    return createStructuredErrorResponse(
      400,
      `Prompt exceeds maximum limit of ${LIMITS.MAX_PROMPT_LENGTH} characters.`,
      'PROMPT_TOO_LONG',
      logger.requestId
    );
  }

  try {
    const { reply, turnId } = await addFollowUpInput(id, prompt);

    return NextResponse.json(
      {
        investigationId: id,
        turn: {
          id: turnId,
          role: 'assistant',
          content: reply,
          taskType: 'follow_up'
        },
        updatedAt: record.updatedAt
      },
      {
        status: 200,
        headers: {
          'x-request-id': logger.requestId
        }
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return createStructuredErrorResponse(
      500,
      msg,
      ERROR_CODES.INTERNAL_ERROR,
      logger.requestId
    );
  }
}
