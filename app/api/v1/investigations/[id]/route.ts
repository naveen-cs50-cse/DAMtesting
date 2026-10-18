import { NextRequest, NextResponse } from 'next/server';
import { getInvestigation } from '@/lib/investigation/store';
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
    logger.warn('Forbidden investigation access attempt', {
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

  return NextResponse.json(
    {
      investigationId: record.id,
      caseId: record.caseId,
      status: record.status,
      mode: record.mode,
      lang: record.lang,
      prompt: record.prompt,
      briefing: record.briefing,
      stages: record.stages,
      verdicts: record.verdicts,
      sources: record.meta?.sources || [],
      meta: record.meta,
      certificate: record.meta?.certificate || null,
      incidentReport: record.meta?.incidentReport || null,
      error: record.error,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      completedAt: record.completedAt,
      links: {
        self: `/api/v1/investigations/${record.id}`,
        stream: `/api/v1/investigations/${record.id}/stream`,
        followUp: `/api/v1/investigations/${record.id}/follow-up`
      }
    },
    {
      headers: {
        'x-request-id': logger.requestId,
        'Cache-Control': 'no-cache'
      }
    }
  );
}
