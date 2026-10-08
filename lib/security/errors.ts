/**
 * UseDAM Structured Error Responses, Timeout Helpers, and Abort Handling
 */

import { NextResponse } from 'next/server';

export interface StructuredErrorPayload {
  error: string;
  code: string;
  requestId: string;
  timestamp: string;
  details?: unknown;
}

export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  SPEND_LIMIT_EXCEEDED: 'SPEND_LIMIT_EXCEEDED',
  TIMEOUT: 'PROVIDER_TIMEOUT',
  CLIENT_ABORTED: 'CLIENT_ABORTED',
  SSRF_BLOCKED: 'SSRF_BLOCKED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
} as const;

export function createStructuredErrorResponse(
  status: number,
  message: string,
  code: string,
  requestId: string,
  details?: unknown,
  headers?: Record<string, string>
): NextResponse<StructuredErrorPayload> {
  const payload: StructuredErrorPayload = {
    error: message,
    code,
    requestId,
    timestamp: new Date().toISOString(),
    ...(details !== undefined ? { details } : {})
  };

  return NextResponse.json(payload, {
    status,
    headers: {
      'x-request-id': requestId,
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Wraps an asynchronous operation with an enforceable timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Upstream provider operation timed out.'
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(errorMessage);
      err.name = 'TimeoutError';
      reject(err);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

/**
 * Checks if an error is an AbortError or client disconnection.
 */
export function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.name === 'AbortError' ||
      err.message.includes('aborted') ||
      err.message.includes('canceled')
    );
  }
  return false;
}
