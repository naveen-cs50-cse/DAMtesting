import { EventEmitter } from 'events';
import {
  Attachment,
  ChatTurn,
  ActivityStage,
  InvestigationMeta,
  InvestigationVerdicts
} from '@/lib/investigation/types';
import {
  runInvestigation,
  SupportedInvestigationMode,
  generateSmartFollowUpFallback,
  isSupportedInvestigationMode,
  SUPPORTED_INVESTIGATION_MODES
} from '@/lib/investigation/service';

export {
  isSupportedInvestigationMode,
  SUPPORTED_INVESTIGATION_MODES,
  type SupportedInvestigationMode
};
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type InvestigationStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface InvestigationRecord {
  id: string;
  caseId: string;
  ownerId: string;
  status: InvestigationStatus;
  mode: SupportedInvestigationMode;
  lang: string;
  prompt: string;
  attachments: Attachment[];
  history: ChatTurn[];
  stages: ActivityStage[];
  briefing: string;
  meta: InvestigationMeta | null;
  verdicts: InvestigationVerdicts | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  idempotencyKey: string | null;
}

export type InvestigationStreamEvent =
  | { event: 'stage'; data: ActivityStage }
  | { event: 'token'; data: { text: string } }
  | { event: 'meta'; data: InvestigationMeta }
  | { event: 'done'; data: { success: boolean; investigationId: string } }
  | { event: 'error'; data: { error: string } };

// In-memory investigation storage with LRU pruning
const INVESTIGATIONS_MAP = new Map<string, InvestigationRecord>();
const IDEMPOTENCY_MAP = new Map<string, string>(); // `${ownerId}:${key}` -> investigationId
const EVENT_BUS = new EventEmitter();
EVENT_BUS.setMaxListeners(200);

// Keep last 1,000 investigations in memory
const MAX_INVESTIGATIONS_IN_MEMORY = 1000;

function pruneStoreIfNeeded() {
  if (INVESTIGATIONS_MAP.size > MAX_INVESTIGATIONS_IN_MEMORY) {
    const keys = Array.from(INVESTIGATIONS_MAP.keys());
    for (let i = 0; i < 100; i++) {
      INVESTIGATIONS_MAP.delete(keys[i]);
    }
  }
}

export interface CreateInvestigationParams {
  ownerId: string;
  prompt: string;
  attachments?: Attachment[];
  mode?: SupportedInvestigationMode;
  lang?: string;
  history?: ChatTurn[];
  idempotencyKey?: string | null;
  apiKey?: string;
  tavilyKey?: string;
}

/**
 * Creates and registers a new investigation in the store.
 * Handles idempotency checks: if the same key was supplied by the same owner, returns the existing record.
 */
export function createInvestigation(params: CreateInvestigationParams): {
  record: InvestigationRecord;
  isExisting: boolean;
} {
  const {
    ownerId,
    prompt,
    attachments = [],
    mode = 'evidence',
    lang = 'auto',
    history = [],
    idempotencyKey = null,
  } = params;

  // 1. Idempotency Check
  if (idempotencyKey) {
    const cacheKey = `${ownerId}:${idempotencyKey}`;
    const existingId = IDEMPOTENCY_MAP.get(cacheKey);
    if (existingId) {
      const existing = INVESTIGATIONS_MAP.get(existingId);
      if (existing) {
        return { record: existing, isExisting: true };
      }
    }
  }

  pruneStoreIfNeeded();

  const id = 'inv_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const caseId = 'DAM-2026-' + Math.floor(1000 + Math.random() * 9000);
  const now = new Date().toISOString();

  const record: InvestigationRecord = {
    id,
    caseId,
    ownerId,
    status: 'processing',
    mode,
    lang,
    prompt,
    attachments,
    history,
    stages: [],
    briefing: '',
    meta: null,
    verdicts: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    idempotencyKey,
  };

  INVESTIGATIONS_MAP.set(id, record);

  if (idempotencyKey) {
    IDEMPOTENCY_MAP.set(`${ownerId}:${idempotencyKey}`, id);
  }

  // Asynchronous best-effort Supabase sync
  if (isSupabaseConfigured && supabase) {
    const rawUserId = ownerId.startsWith('user:') ? ownerId.slice(5) : null;
    supabase
      .from('investigations')
      .insert({
        id,
        user_id: rawUserId,
        title: prompt.slice(0, 100) || 'Attachment Investigation',
        case_id: caseId,
        mode,
        lang,
      })
      .then(() => {}, () => {});
  }

  // Trigger background execution
  dispatchBackgroundProcessing(record, params.apiKey, params.tavilyKey);

  return { record, isExisting: false };
}

/**
 * Executes the core investigation pipeline in the background.
 */
function dispatchBackgroundProcessing(
  record: InvestigationRecord,
  openaiKey?: string,
  tavilyKey?: string
) {
  // Run asynchronously without blocking the response
  queueMicrotask(async () => {
    try {
      const result = await runInvestigation({
        prompt: record.prompt,
        attachments: record.attachments,
        mode: record.mode,
        lang: record.lang,
        history: record.history,
        caseId: record.caseId,
        openaiKey,
        tavilyKey,
        onStage: stage => {
          const idx = record.stages.findIndex(s => s.id === stage.id);
          if (idx >= 0) {
            record.stages[idx] = { ...record.stages[idx], ...stage };
          } else {
            record.stages.push(stage);
          }
          record.updatedAt = new Date().toISOString();
          EVENT_BUS.emit(`inv:${record.id}`, { event: 'stage', data: stage });
        },
        onToken: delta => {
          record.briefing += delta;
          record.updatedAt = new Date().toISOString();
          EVENT_BUS.emit(`inv:${record.id}`, { event: 'token', data: { text: delta } });
        },
        onMeta: meta => {
          record.meta = meta;
          record.verdicts = meta.verdicts || null;
          record.updatedAt = new Date().toISOString();
          EVENT_BUS.emit(`inv:${record.id}`, { event: 'meta', data: meta });
        },
      });

      record.status = 'completed';
      record.briefing = result.briefing;
      record.verdicts = result.verdicts;
      record.meta = result.meta;
      record.stages = result.stages;
      record.completedAt = new Date().toISOString();
      record.updatedAt = record.completedAt;

      EVENT_BUS.emit(`inv:${record.id}`, {
        event: 'done',
        data: { success: true, investigationId: record.id }
      });

      // Best effort Supabase turn recording
      if (isSupabaseConfigured && supabase) {
        supabase
          .from('investigation_turns')
          .insert({
            id: 'turn_' + record.id,
            investigation_id: record.id,
            role: 'assistant',
            content: record.briefing,
            meta: record.meta,
          })
          .then(() => {}, () => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      record.status = 'failed';
      record.error = msg;
      record.updatedAt = new Date().toISOString();

      EVENT_BUS.emit(`inv:${record.id}`, {
        event: 'error',
        data: { error: msg }
      });
    }
  });
}

/**
 * Retrieves an investigation from the store.
 * Supports lookup by investigation ID (inv_...) or case ID (DAM-2026-...).
 */
export function getInvestigation(id: string): InvestigationRecord | null {
  const direct = INVESTIGATIONS_MAP.get(id);
  if (direct) return direct;
  for (const record of INVESTIGATIONS_MAP.values()) {
    if (record.caseId === id || record.caseId.toLowerCase() === id.toLowerCase()) {
      return record;
    }
  }
  return null;
}

/**
 * Appends a follow-up query to an investigation.
 */
export async function addFollowUpInput(
  investigationId: string,
  prompt: string
): Promise<{ reply: string; turnId: string }> {
  const inv = INVESTIGATIONS_MAP.get(investigationId);
  if (!inv) {
    throw new Error('Investigation not found.');
  }

  const turnId = 'turn_' + Math.random().toString(36).substring(2, 9);
  
  // Update in-memory history
  inv.history.push({
    id: 'turn_user_' + turnId,
    role: 'user',
    content: prompt,
    createdAt: new Date().toISOString()
  });

  const reply = generateSmartFollowUpFallback(prompt, inv.history);
  inv.history.push({
    id: 'turn_asst_' + turnId,
    role: 'assistant',
    content: reply,
    createdAt: new Date().toISOString()
  });
  inv.updatedAt = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    supabase
      .from('investigation_turns')
      .insert([
        { id: 'turn_user_' + turnId, investigation_id: investigationId, role: 'user', content: prompt },
        { id: 'turn_asst_' + turnId, investigation_id: investigationId, role: 'assistant', content: reply }
      ])
      .then(() => {}, () => {});
  }

  return { reply, turnId };
}

/**
 * Subscribes to SSE stream events for an ongoing or completed investigation.
 * Returns an unsubscription function.
 */
export function subscribeToInvestigation(
  id: string,
  handler: (evt: InvestigationStreamEvent) => void
): () => void {
  const eventName = `inv:${id}`;
  EVENT_BUS.on(eventName, handler);
  return () => {
    EVENT_BUS.off(eventName, handler);
  };
}

/**
 * Resets memory store (for testing)
 */
export function resetInvestigationStore(): void {
  INVESTIGATIONS_MAP.clear();
  IDEMPOTENCY_MAP.clear();
  EVENT_BUS.removeAllListeners();
}
