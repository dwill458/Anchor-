import { z } from 'zod';

/** Preferences Ask Chart may retain, per Anchor. Anything else the model proposes is dropped. */
export const MEMORY_KEYS = [
  'availability',
  'hoursPerWeek',
  'constraints',
  'approach',
  'resources',
] as const;
export type MemoryKey = (typeof MEMORY_KEYS)[number];

export const REVISE_REASONS = [
  'SMALLER_STEPS',
  'CHANGE_APPROACH',
  'TOO_MANY_STEPS',
  'TOO_FEW_STEPS',
  'DIFFERENT_MILESTONES',
  'FURTHER_ALONG',
  'CHANGE_DESTINATION',
  'OTHER',
] as const;
export type ReviseReason = (typeof REVISE_REASONS)[number];

/**
 * One conversation turn from the model. `reply` is deliberately the first property so a streaming provider
 * writes it first and the client can show it while the rest is still arriving.
 */
export const ASK_TURN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'reply',
    'suggestions',
    'requestPhoto',
    'readyToPlan',
    'startingPoint',
    'context',
    'action',
    'remember',
  ],
  properties: {
    reply: { type: 'string' },
    suggestions: { type: 'array', items: { type: 'string' } },
    requestPhoto: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['reason'],
      properties: { reason: { type: 'string' } },
    },
    readyToPlan: { type: 'boolean' },
    startingPoint: { type: ['string', 'null'] },
    context: { type: ['string', 'null'] },
    action: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['type', 'waypointId', 'moves', 'reason', 'detail', 'summary'],
      properties: {
        type: { type: 'string', enum: ['ADD_MOVES', 'REVISE_ROUTE'] },
        waypointId: { type: ['string', 'null'] },
        moves: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'detail'],
            properties: { title: { type: 'string' }, detail: { type: ['string', 'null'] } },
          },
        },
        reason: { type: ['string', 'null'], enum: [...REVISE_REASONS, null] },
        detail: { type: ['string', 'null'] },
        summary: { type: 'string' },
      },
    },
    remember: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['key', 'value'],
      properties: { key: { type: 'string', enum: [...MEMORY_KEYS] }, value: { type: 'string' } },
    },
  },
} as const;

const text = (max: number) =>
  z.string().transform(value => value.replace(/\s+/g, ' ').trim().slice(0, max));

const RawTurn = z.object({
  reply: z.string().transform(value => value.trim()),
  suggestions: z.array(z.string()).default([]),
  requestPhoto: z.object({ reason: text(160) }).nullish(),
  readyToPlan: z.boolean().default(false),
  startingPoint: text(500).nullish(),
  context: text(500).nullish(),
  action: z
    .object({
      type: z.enum(['ADD_MOVES', 'REVISE_ROUTE']),
      waypointId: z.string().nullish(),
      moves: z.array(z.object({ title: text(120), detail: text(280).nullish(), rationale: text(280).nullish() })).max(5).default([]),
      reason: z.enum(REVISE_REASONS).nullish(),
      detail: text(500).nullish(),
      summary: text(200),
    })
    .nullish(),
  remember: z.object({ key: z.enum(MEMORY_KEYS), value: text(200) }).nullish(),
});

export type AskTurnAction = {
  type: 'ADD_MOVES' | 'REVISE_ROUTE';
  waypointId: string | null;
  moves: Array<{ title: string; rationale: string | null; detail?: string | null }>;
  reason: ReviseReason | null;
  detail: string | null;
  summary: string;
};

export type AskTurn = {
  reply: string;
  suggestions: string[];
  requestPhoto: { reason: string } | null;
  readyToPlan: boolean;
  startingPoint: string | null;
  context: string | null;
  action: AskTurnAction | null;
  remember: { key: MemoryKey; value: string } | null;
};

export class AskTurnInvalidError extends Error {
  constructor(readonly reason: string) {
    super(`ask_turn_invalid:${reason}`);
    this.name = 'AskTurnInvalidError';
  }
}

const NOT_SURE = /(not sure|unsure|don'?t know|no idea)/i;
const NOT_SURE_REPLY = 'Not sure yet';

/** Validates and cleans a model response. Anything that cannot be made safe is rejected, never patched up. */
export function normalizeAskTurn(raw: unknown): AskTurn {
  const parsed = RawTurn.safeParse(raw);
  if (!parsed.success) throw new AskTurnInvalidError('schema');
  const turn = parsed.data;
  if (!turn.reply) throw new AskTurnInvalidError('empty_reply');
  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const candidate of turn.suggestions) {
    const value = candidate.replace(/\s+/g, ' ').trim();
    const key = value.toLowerCase();
    if (!value || value.length > 48 || seen.has(key)) continue;
    seen.add(key);
    suggestions.push(value);
    if (suggestions.length === 4) break;
  }
  // Every set of quick replies leaves room for "I'm not sure": the person is never forced to pick something untrue.
  if (suggestions.length > 0 && !suggestions.some(value => NOT_SURE.test(value))) {
    if (suggestions.length === 4) suggestions.pop();
    suggestions.push(NOT_SURE_REPLY);
  }
  const action = turn.action
    ? {
        type: turn.action.type,
        waypointId: turn.action.waypointId?.trim() || null,
        moves: turn.action.moves
          .filter(move => move.title)
          .map(move => ({ title: move.title, rationale: move.detail ?? move.rationale ?? null, ...(move.detail !== undefined ? { detail: move.detail ?? null } : {}) })),
        reason: turn.action.reason ?? null,
        detail: turn.action.detail || null,
        summary: turn.action.summary,
      }
    : null;
  return {
    reply: turn.reply.slice(0, 1600),
    suggestions,
    requestPhoto: turn.requestPhoto?.reason ? { reason: turn.requestPhoto.reason } : null,
    readyToPlan: turn.readyToPlan,
    startingPoint: turn.startingPoint || null,
    context: turn.context || null,
    action,
    remember: turn.remember?.value ? { key: turn.remember.key, value: turn.remember.value } : null,
  };
}

/**
 * Decodes the `reply` string out of the JSON text a model has written so far (it may stop mid-escape, mid-string,
 * or before `reply` begins). Used to stream the reply while the rest of the object is still being written.
 */
export function extractStreamingReply(accumulated: string): { text: string; complete: boolean } {
  const match = /"reply"\s*:\s*"/.exec(accumulated);
  if (!match) return { text: '', complete: false };
  let out = '';
  let i = match.index + match[0].length;
  while (i < accumulated.length) {
    const char = accumulated[i];
    if (char === '"') return { text: out, complete: true };
    if (char !== '\\') {
      out += char;
      i += 1;
      continue;
    }
    const next = accumulated[i + 1];
    if (next === undefined) break;
    if (next === 'u') {
      const hex = accumulated.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 6;
      continue;
    }
    const simple: Record<string, string> = {
      n: '\n',
      t: '\t',
      r: '\r',
      b: '\b',
      f: '\f',
      '"': '"',
      '\\': '\\',
      '/': '/',
    };
    out += simple[next] ?? next;
    i += 2;
  }
  return { text: out, complete: false };
}
