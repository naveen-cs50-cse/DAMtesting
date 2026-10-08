/**
 * UseDAM Authentication-Aware Rate Limiting & Provider Spend Protection
 */

interface RateBucket {
  count: number;
  firstRequestTime: number;
  lastRequestTime: number;
}

interface SpendBucket {
  estimatedTokens: number;
  investigationCalls: number;
  firstCallTime: number;
}

// In-memory buckets with sliding windows
const RATE_LIMIT_STORE = new Map<string, RateBucket>();
const SPEND_PROTECTION_STORE = new Map<string, SpendBucket>();

// Configuration Tiers
export const RATE_LIMIT_CONFIG = {
  // Default public unauthenticated tier
  anonymous: {
    maxRequestsPerWindow: 30,
    windowMs: 60 * 1000, // 1 minute
    maxInvestigationsPerHour: 20,
    maxTokensPerHour: 150000 // Provider spend ceiling
  },
  // Authenticated user with session or custom provider key
  authenticated: {
    maxRequestsPerWindow: 120,
    windowMs: 60 * 1000,
    maxInvestigationsPerHour: 100,
    maxTokensPerHour: 1000000
  }
};

const ONE_HOUR_MS = 60 * 60 * 1000;

// Cleanup stale entries periodically
function pruneStores() {
  const now = Date.now();
  for (const [key, bucket] of RATE_LIMIT_STORE.entries()) {
    if (now - bucket.lastRequestTime > 5 * 60 * 1000) {
      RATE_LIMIT_STORE.delete(key);
    }
  }
  for (const [key, bucket] of SPEND_PROTECTION_STORE.entries()) {
    if (now - bucket.firstCallTime > 2 * ONE_HOUR_MS) {
      SPEND_PROTECTION_STORE.delete(key);
    }
  }
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfterSeconds?: number;
  reason?: string;
}

/**
 * Checks request rate limit against client identifier (IP or user ID).
 */
export function checkRateLimit(
  clientId: string,
  tier: 'anonymous' | 'authenticated' = 'anonymous'
): RateLimitCheckResult {
  pruneStores();
  const config = RATE_LIMIT_CONFIG[tier] || RATE_LIMIT_CONFIG.anonymous;
  const now = Date.now();
  const bucketKey = `${tier}:${clientId}`;

  let bucket = RATE_LIMIT_STORE.get(bucketKey);
  if (!bucket || now - bucket.firstRequestTime > config.windowMs) {
    bucket = { count: 1, firstRequestTime: now, lastRequestTime: now };
    RATE_LIMIT_STORE.set(bucketKey, bucket);
    return {
      allowed: true,
      limit: config.maxRequestsPerWindow,
      remaining: config.maxRequestsPerWindow - 1,
      resetMs: config.windowMs
    };
  }

  bucket.lastRequestTime = now;
  if (bucket.count >= config.maxRequestsPerWindow) {
    const timePassed = now - bucket.firstRequestTime;
    const resetMs = Math.max(0, config.windowMs - timePassed);
    const retryAfterSeconds = Math.ceil(resetMs / 1000);
    return {
      allowed: false,
      limit: config.maxRequestsPerWindow,
      remaining: 0,
      resetMs,
      retryAfterSeconds,
      reason: `Rate limit exceeded. Maximum ${config.maxRequestsPerWindow} requests per minute allowed.`
    };
  }

  bucket.count++;
  const remaining = config.maxRequestsPerWindow - bucket.count;
  const resetMs = Math.max(0, config.windowMs - (now - bucket.firstRequestTime));
  return {
    allowed: true,
    limit: config.maxRequestsPerWindow,
    remaining,
    resetMs
  };
}

/**
 * Checks and guards against runaway provider API spend per client/IP.
 */
export function checkProviderSpendProtection(
  clientId: string,
  tier: 'anonymous' | 'authenticated' = 'anonymous',
  estimatedTokens: number = 2000
): { allowed: boolean; reason?: string; currentHourlyTokens: number } {
  pruneStores();
  const config = RATE_LIMIT_CONFIG[tier] || RATE_LIMIT_CONFIG.anonymous;
  const now = Date.now();
  const spendKey = `spend:${tier}:${clientId}`;

  let bucket = SPEND_PROTECTION_STORE.get(spendKey);
  if (!bucket || now - bucket.firstCallTime > ONE_HOUR_MS) {
    bucket = { estimatedTokens: 0, investigationCalls: 0, firstCallTime: now };
    SPEND_PROTECTION_STORE.set(spendKey, bucket);
  }

  if (bucket.investigationCalls >= config.maxInvestigationsPerHour) {
    return {
      allowed: false,
      reason: `Hourly investigation quota reached (${config.maxInvestigationsPerHour}/hour). Spend protection active.`,
      currentHourlyTokens: bucket.estimatedTokens
    };
  }

  if (bucket.estimatedTokens + estimatedTokens > config.maxTokensPerHour) {
    return {
      allowed: false,
      reason: `Provider token spend budget reached for current hour window. Try again in a few minutes.`,
      currentHourlyTokens: bucket.estimatedTokens
    };
  }

  return {
    allowed: true,
    currentHourlyTokens: bucket.estimatedTokens
  };
}

/**
 * Records actual or estimated provider spend.
 */
export function recordProviderSpend(
  clientId: string,
  tier: 'anonymous' | 'authenticated' = 'anonymous',
  tokensUsed: number = 2000
): void {
  const now = Date.now();
  const spendKey = `spend:${tier}:${clientId}`;
  let bucket = SPEND_PROTECTION_STORE.get(spendKey);
  if (!bucket || now - bucket.firstCallTime > ONE_HOUR_MS) {
    bucket = { estimatedTokens: 0, investigationCalls: 0, firstCallTime: now };
    SPEND_PROTECTION_STORE.set(spendKey, bucket);
  }
  bucket.investigationCalls += 1;
  bucket.estimatedTokens += Math.max(1, tokensUsed);
}

/**
 * Helper to extract client identifier and tier from Request headers.
 */
export function getClientIdentity(headers: Headers): { clientId: string; tier: 'anonymous' | 'authenticated' } {
  const customApiKey = headers.get('x-user-api-key') || headers.get('x-api-key');
  const authHeader = headers.get('authorization');

  // Forwarded-For or Real-IP
  const forwardedFor = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : realIp || '127.0.0.1';

  if (customApiKey || authHeader) {
    const keyPreview = customApiKey ? customApiKey.slice(-6) : 'auth';
    return {
      clientId: `auth-${keyPreview}-${ip}`,
      tier: 'authenticated'
    };
  }

  return {
    clientId: `anon-${ip}`,
    tier: 'anonymous'
  };
}

/**
 * Resets stores (primarily for tests)
 */
export function resetRateLimitStores(): void {
  RATE_LIMIT_STORE.clear();
  SPEND_PROTECTION_STORE.clear();
}
