/**
 * UseDAM Server-Side Request Validation Schemas and Enforcement Limits
 */

export const LIMITS = {
  MAX_PROMPT_LENGTH: 10000,
  MAX_HISTORY_MESSAGES: 50,
  MAX_MESSAGE_CONTENT_LENGTH: 10000,
  MAX_ATTACHMENTS_COUNT: 5,
  MAX_SINGLE_FILE_SIZE_BYTES: 15 * 1024 * 1024, // 15MB
  MAX_TOTAL_ATTACHMENT_BYTES: 25 * 1024 * 1024, // 25MB
  MAX_URL_LENGTH: 2048,
  MAX_SEARCH_QUERY_LENGTH: 500,
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp'
  ] as const
};

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationErrorDetail[];
}

export interface InvestigateRequestBody {
  prompt?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  attachments?: Array<{
    id?: string;
    name: string;
    type: string;
    size: number;
    url?: string;
    preview?: string;
    previewUrl?: string;
    isUrl?: boolean;
    extractedText?: string;
    [key: string]: unknown;
  }>;
  conversationId?: string;
  language?: string;
}

export interface SearchRequestBody {
  query: string;
  limit?: number;
}

export interface IngestUrlRequestBody {
  url: string;
}

export interface WatchtowerRequestBody {
  query?: string;
  category?: string;
  limit?: number;
}

/**
 * Validates request payload for /api/investigate/stream
 */
export function validateInvestigateRequest(body: unknown): ValidationResult<InvestigateRequestBody> {
  const errors: ValidationErrorDetail[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      success: false,
      errors: [{ field: 'body', message: 'Request body must be a valid JSON object.', code: 'INVALID_BODY' }]
    };
  }

  const payload = body as Record<string, unknown>;

  // Prompt validation
  let prompt: string | undefined;
  if (payload.prompt !== undefined) {
    if (typeof payload.prompt !== 'string') {
      errors.push({ field: 'prompt', message: 'Prompt must be a string.', code: 'INVALID_TYPE' });
    } else {
      prompt = payload.prompt.trim();
      if (prompt.length > LIMITS.MAX_PROMPT_LENGTH) {
        errors.push({
          field: 'prompt',
          message: `Prompt exceeds maximum allowed length of ${LIMITS.MAX_PROMPT_LENGTH} characters (received ${prompt.length}).`,
          code: 'PROMPT_TOO_LONG'
        });
      }
    }
  }

  // Attachments validation
  const attachments: InvestigateRequestBody['attachments'] = [];
  if (payload.attachments !== undefined) {
    if (!Array.isArray(payload.attachments)) {
      errors.push({ field: 'attachments', message: 'Attachments must be an array.', code: 'INVALID_TYPE' });
    } else {
      if (payload.attachments.length > LIMITS.MAX_ATTACHMENTS_COUNT) {
        errors.push({
          field: 'attachments',
          message: `Attachments count exceeds maximum limit of ${LIMITS.MAX_ATTACHMENTS_COUNT} files.`,
          code: 'TOO_MANY_ATTACHMENTS'
        });
      }

      let totalAttachmentBytes = 0;
      payload.attachments.forEach((att, idx) => {
        if (!att || typeof att !== 'object') {
          errors.push({ field: `attachments[${idx}]`, message: 'Attachment item must be an object.', code: 'INVALID_ATTACHMENT' });
          return;
        }
        const a = att as Record<string, unknown>;
        const name = typeof a.name === 'string' ? a.name : `file_${idx}`;
        const type = typeof a.type === 'string' ? a.type : 'application/octet-stream';
        const size = typeof a.size === 'number' ? a.size : 0;

        if (size > LIMITS.MAX_SINGLE_FILE_SIZE_BYTES) {
          errors.push({
            field: `attachments[${idx}].size`,
            message: `Attachment "${name}" (${(size / (1024 * 1024)).toFixed(1)}MB) exceeds 15MB limit.`,
            code: 'FILE_TOO_LARGE'
          });
        }
        totalAttachmentBytes += size;

        attachments.push({
          id: typeof a.id === 'string' ? a.id : undefined,
          name,
          type,
          size,
          url: typeof a.url === 'string' ? a.url : undefined,
          preview: typeof a.preview === 'string' ? a.preview : undefined,
          previewUrl: typeof a.previewUrl === 'string' ? a.previewUrl : undefined,
          isUrl: typeof a.isUrl === 'boolean' ? a.isUrl : false,
          extractedText: typeof a.extractedText === 'string' ? a.extractedText : undefined,
          ...a
        });
      });

      if (totalAttachmentBytes > LIMITS.MAX_TOTAL_ATTACHMENT_BYTES) {
        errors.push({
          field: 'attachments',
          message: `Total attachments payload (${(totalAttachmentBytes / (1024 * 1024)).toFixed(1)}MB) exceeds 25MB maximum limit.`,
          code: 'TOTAL_PAYLOAD_TOO_LARGE'
        });
      }
    }
  }

  // At least one of prompt or attachments must be present
  if ((!prompt || prompt.length === 0) && attachments.length === 0) {
    errors.push({
      field: 'prompt',
      message: 'Either a non-empty prompt or at least one attachment must be provided.',
      code: 'EMPTY_INQUIRY'
    });
  }

  // Conversation history validation
  const history: InvestigateRequestBody['conversationHistory'] = [];
  if (payload.conversationHistory !== undefined) {
    if (!Array.isArray(payload.conversationHistory)) {
      errors.push({ field: 'conversationHistory', message: 'Conversation history must be an array.', code: 'INVALID_TYPE' });
    } else {
      if (payload.conversationHistory.length > LIMITS.MAX_HISTORY_MESSAGES) {
        errors.push({
          field: 'conversationHistory',
          message: `Conversation history exceeds maximum depth of ${LIMITS.MAX_HISTORY_MESSAGES} messages.`,
          code: 'HISTORY_TOO_DEEP'
        });
      }

      payload.conversationHistory.forEach((msg, idx) => {
        if (!msg || typeof msg !== 'object') {
          errors.push({ field: `conversationHistory[${idx}]`, message: 'Message must be an object.', code: 'INVALID_MESSAGE' });
          return;
        }
        const m = msg as Record<string, unknown>;
        const role = m.role;
        if (role !== 'user' && role !== 'assistant' && role !== 'system') {
          errors.push({
            field: `conversationHistory[${idx}].role`,
            message: 'Message role must be "user", "assistant", or "system".',
            code: 'INVALID_ROLE'
          });
          return;
        }
        const content = typeof m.content === 'string' ? m.content : '';
        if (content.length > LIMITS.MAX_MESSAGE_CONTENT_LENGTH) {
          errors.push({
            field: `conversationHistory[${idx}].content`,
            message: `Message content exceeds ${LIMITS.MAX_MESSAGE_CONTENT_LENGTH} character limit.`,
            code: 'MESSAGE_TOO_LONG'
          });
        }
        history.push({ role, content });
      });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      prompt,
      conversationHistory: history,
      attachments,
      conversationId: typeof payload.conversationId === 'string' ? payload.conversationId : undefined,
      language: typeof payload.language === 'string' ? payload.language : undefined
    }
  };
}

/**
 * Validates request payload for /api/search
 */
export function validateSearchRequest(body: unknown): ValidationResult<SearchRequestBody> {
  const errors: ValidationErrorDetail[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      success: false,
      errors: [{ field: 'body', message: 'Request body must be a JSON object.', code: 'INVALID_BODY' }]
    };
  }

  const payload = body as Record<string, unknown>;
  const query = typeof payload.query === 'string' ? payload.query.trim() : '';

  if (!query) {
    errors.push({ field: 'query', message: 'Search query parameter cannot be empty.', code: 'EMPTY_QUERY' });
  } else if (query.length > LIMITS.MAX_SEARCH_QUERY_LENGTH) {
    errors.push({
      field: 'query',
      message: `Search query exceeds ${LIMITS.MAX_SEARCH_QUERY_LENGTH} character limit.`,
      code: 'QUERY_TOO_LONG'
    });
  }

  let limit = 5;
  if (payload.limit !== undefined) {
    if (typeof payload.limit !== 'number' || payload.limit < 1 || payload.limit > 20) {
      errors.push({ field: 'limit', message: 'Limit must be an integer between 1 and 20.', code: 'INVALID_LIMIT' });
    } else {
      limit = Math.floor(payload.limit);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { query, limit }
  };
}

/**
 * Validates request payload for /api/ingest-url
 */
export function validateIngestUrlRequest(body: unknown): ValidationResult<IngestUrlRequestBody> {
  const errors: ValidationErrorDetail[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      success: false,
      errors: [{ field: 'body', message: 'Request body must be a JSON object.', code: 'INVALID_BODY' }]
    };
  }

  const payload = body as Record<string, unknown>;
  const url = typeof payload.url === 'string' ? payload.url.trim() : '';

  if (!url) {
    errors.push({ field: 'url', message: 'URL cannot be empty.', code: 'EMPTY_URL' });
  } else if (url.length > LIMITS.MAX_URL_LENGTH) {
    errors.push({
      field: 'url',
      message: `URL length exceeds maximum limit of ${LIMITS.MAX_URL_LENGTH} characters.`,
      code: 'URL_TOO_LONG'
    });
  } else {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.push({
          field: 'url',
          message: `Only HTTP and HTTPS URLs are permitted. Received protocol: "${parsed.protocol}"`,
          code: 'DISALLOWED_PROTOCOL'
        });
      }
    } catch {
      errors.push({ field: 'url', message: 'Invalid URL format.', code: 'MALFORMED_URL' });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { url }
  };
}
