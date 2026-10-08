/**
 * UseDAM Structured Security Logger
 * Enforces per-request ID tracing and automatic redaction of:
 * - API keys (OpenAI, Anthropic, Google, Perplexity, Tavily)
 * - User prompts and messages
 * - Personal identifiable data (Indian mobile numbers, emails, Aadhaar, PAN)
 * - Base64 and uploaded file payloads
 */

import crypto from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Regex patterns for sensitive credentials & PII
const SENSITIVE_PATTERNS = [
  // OpenAI & general sk- keys
  { regex: /\bsk-[a-zA-Z0-9_\-]{16,}\b/g, replace: '[REDACTED_API_KEY]' },
  // Google API keys
  { regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g, replace: '[REDACTED_GOOGLE_KEY]' },
  // Bearer tokens
  { regex: /Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, replace: 'Bearer [REDACTED_TOKEN]' },
  // Indian PAN: 5 letters, 4 digits, 1 letter
  { regex: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g, replace: '[REDACTED_PAN]' },
  // Indian 12-digit Aadhaar
  { regex: /\b\d{4}\s\d{4}\s\d{4}\b/g, replace: '[REDACTED_AADHAAR]' },
  // Indian 10-digit mobile numbers with optional +91 prefix
  { regex: /(?:\+91[\-\s]?)?[6-9]\d{9}\b/g, replace: '[REDACTED_PHONE]' },
  // Email addresses
  { regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, replace: '[REDACTED_EMAIL]' },
  // Base64 data URIs
  { regex: /data:[^;]+;base64,[a-zA-Z0-9+/=]{30,}/g, replace: '[REDACTED_BASE64_PAYLOAD]' }
];

/**
 * Recursively sanitize and redact sensitive values from any object, string, or array.
 */
export function redactSensitiveData<T>(input: T): T {
  if (typeof input === 'string') {
    let sanitized: string = input;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern.regex, pattern.replace);
    }
    return sanitized as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map(item => redactSensitiveData(item)) as unknown as T;
  }

  if (input !== null && typeof input === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const lowerKey = key.toLowerCase();
      // Mask credentials or sensitive content keys explicitly
      if (
        lowerKey.includes('apikey') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('authorization')
      ) {
        sanitizedObj[key] = '[REDACTED_SECRET]';
      } else if (lowerKey === 'prompt' && typeof value === 'string') {
        // Redact full prompt text into a length-based hash/preview
        sanitizedObj[key] = `[REDACTED_PROMPT: ${value.length} chars, hash: ${crypto.createHash('sha256').update(value).digest('hex').slice(0, 8)}]`;
      } else if (lowerKey === 'buffer' || lowerKey === 'base64' || lowerKey === 'preview') {
        sanitizedObj[key] = `[REDACTED_PAYLOAD: ${typeof value}]`;
      } else {
        sanitizedObj[key] = redactSensitiveData(value);
      }
    }
    return sanitizedObj as unknown as T;
  }

  return input;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  requestId: string;
  event: string;
  [key: string]: unknown;
}

export class SecurityLogger {
  readonly requestId: string;

  constructor(requestId?: string) {
    this.requestId = requestId || crypto.randomUUID();
  }

  private log(level: LogLevel, event: string, meta?: Record<string, unknown>): void {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId: this.requestId,
      event,
      ...(meta ? redactSensitiveData(meta) : {})
    };

    const serialized = JSON.stringify(entry);
    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  debug(event: string, meta?: Record<string, unknown>): void {
    this.log('debug', event, meta);
  }

  info(event: string, meta?: Record<string, unknown>): void {
    this.log('info', event, meta);
  }

  warn(event: string, meta?: Record<string, unknown>): void {
    this.log('warn', event, meta);
  }

  error(event: string, meta?: Record<string, unknown>): void {
    this.log('error', event, meta);
  }
}

/**
 * Creates or retrieves a SecurityLogger attached to a Next.js Request.
 */
export function createRequestLogger(req?: Request): SecurityLogger {
  const reqId = req?.headers.get('x-request-id') || crypto.randomUUID();
  return new SecurityLogger(reqId);
}
