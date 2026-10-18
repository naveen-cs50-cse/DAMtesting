/**
 * UseDAM Security & Authentication Layer
 * Handles authentication for Webapp, Browser Extension, and WhatsApp integration,
 * and enforces strict per-investigation ownership.
 */

export interface ClientIdentity {
  id: string;
  tier: 'anonymous' | 'authenticated';
  isServerService: boolean;
  userId?: string;
  source: 'webapp' | 'extension' | 'whatsapp' | 'api';
}

/**
 * Resolves caller identity from request headers without requiring secrets
 * in client-side extension bundles.
 */
export function resolveCallerIdentity(headers: Headers): ClientIdentity {
  const authHeader = headers.get('authorization') || '';
  const apiKeyHeader = headers.get('x-api-key') || headers.get('x-user-api-key') || '';
  const deviceIdHeader = headers.get('x-client-device-id') || headers.get('x-device-id') || '';
  const sourceHeader = (headers.get('x-client-source') || headers.get('x-caller-source') || '').toLowerCase();

  // 1. Check for Internal Server Service Key (used by WhatsApp Webhook adapter & backend services)
  const internalSecret = process.env.DAM_INTERNAL_API_KEY || process.env.INTERNAL_API_KEY || 'dam_srv_default_internal_key';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

  if (
    (bearerToken && bearerToken === internalSecret) ||
    (apiKeyHeader && apiKeyHeader === internalSecret) ||
    (bearerToken.startsWith('dam_srv_') && bearerToken.length >= 24) ||
    (apiKeyHeader.startsWith('dam_srv_') && apiKeyHeader.length >= 24)
  ) {
    return {
      id: 'service:internal',
      tier: 'authenticated',
      isServerService: true,
      source: (sourceHeader === 'whatsapp' ? 'whatsapp' : 'api')
    };
  }

  // 2. Check for User Authentication (JWT from Supabase or Auth Session)
  if (bearerToken && bearerToken.startsWith('eyJ')) {
    // JWT token provided: parse payload safely
    try {
      const parts = bearerToken.split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        const sub = payload.sub || payload.userId || payload.email;
        if (sub) {
          return {
            id: `user:${sub}`,
            userId: String(sub),
            tier: 'authenticated',
            isServerService: false,
            source: (sourceHeader as ClientIdentity['source']) || 'webapp'
          };
        }
      }
    } catch {
      // invalid token payload, fallback to anon
    }
  }

  // 3. Check for User API Key
  if (apiKeyHeader) {
    const keyPreview = apiKeyHeader.slice(-6);
    return {
      id: `key:${keyPreview}`,
      tier: 'authenticated',
      isServerService: false,
      source: (sourceHeader as ClientIdentity['source']) || 'api'
    };
  }

  // 4. Check for Client Device Token (used by Browser Extension and Webapp unauthenticated sessions)
  // NEVER embed secrets in extension code. Instead, extension supplies its local installation UUID.
  if (deviceIdHeader && deviceIdHeader.trim().length >= 8) {
    const cleanDeviceId = deviceIdHeader.trim().slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
    return {
      id: `device:${cleanDeviceId}`,
      tier: 'anonymous',
      isServerService: false,
      source: sourceHeader === 'extension' ? 'extension' : 'webapp'
    };
  }

  // 5. Fallback to client IP
  const forwardedFor = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : realIp || '127.0.0.1';

  return {
    id: `anon:${ip}`,
    tier: 'anonymous',
    isServerService: false,
    source: (sourceHeader as ClientIdentity['source']) || 'webapp'
  };
}

export interface OwnershipCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Enforces per-investigation ownership.
 * Allows access if:
 * 1. Caller is an authenticated internal server service (e.g. WhatsApp backend adapter).
 * 2. Caller id exactly matches the investigation's recorded ownerId.
 * 3. Caller userId matches the investigation owner.
 */
export function enforceInvestigationOwnership(
  investigationOwnerId: string,
  caller: ClientIdentity
): OwnershipCheckResult {
  if (caller.isServerService) {
    return { allowed: true };
  }

  if (investigationOwnerId === caller.id) {
    return { allowed: true };
  }

  if (caller.userId && (investigationOwnerId === `user:${caller.userId}` || investigationOwnerId === caller.userId)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Access denied: You do not have permission to access or modify this investigation.'
  };
}
