import { askChartApi, type AskChartApi, type AskConversation, type AskTurnResult } from '@/services/v2/askChartApi';

export type AskOpening = {
  conversation: AskConversation;
  result: AskTurnResult | null;
  bufferedText: string;
  timing: { conversationMs: number; turnStartedMs: number; firstDeltaMs: number | null; doneMs: number };
};
const TTL_MS = 3 * 60 * 1000;
const openings = new Map<string, { api: AskChartApi; expires: number; promise: Promise<AskOpening | null> }>();

/** The prefetch, normal mount, and retries all address the same server-side opening. */
export const openingKeyFor = (anchorId: string) => `ask-open:${anchorId}`;

/** Buffers an opening, never dispatches it and never reveals it ahead of Ask. Failures use the normal mount path. */
export function startAskOpening(anchorId: string, api: AskChartApi = askChartApi): Promise<AskOpening | null> {
  const now = Date.now();
  for (const [key, entry] of openings) if (entry.expires <= now) openings.delete(key);
  const existing = openings.get(anchorId);
  if (existing?.api === api) return existing.promise;
  const promise = (async (): Promise<AskOpening | null> => {
    try {
      const conversation = await api.getConversation(anchorId);
      const conversationMs = Date.now() - now;
      const turnStartedMs = Date.now() - now;
      let firstDeltaMs: number | null = null;
      let bufferedText = '';
      const result = conversation.messages.length === 0 ? await api.turn(anchorId, { opening: true, idempotencyKey: openingKeyFor(anchorId), conversationId: conversation.conversationId }, {
        onReply: text => {
          bufferedText = text;
          if (firstDeltaMs === null && text.length) firstDeltaMs = Date.now() - now - turnStartedMs;
        },
      }) : null;
      const timing = { conversationMs, turnStartedMs, firstDeltaMs, doneMs: Date.now() - now };
      if (__DEV__) console.info('[AskChart prefetch timing]', JSON.stringify(timing));
      return { conversation, result, bufferedText, timing };
    } catch {
      return null;
    }
  })();
  openings.set(anchorId, { api, expires: now + TTL_MS, promise });
  return promise;
}

/** One consumer joins the same promise, including while it is still running. */
export function takeAskOpening(anchorId: string, api: AskChartApi = askChartApi): Promise<AskOpening | null> | null {
  const entry = openings.get(anchorId);
  if (!entry || entry.api !== api) return null;
  openings.delete(anchorId);
  return entry.expires > Date.now() ? entry.promise : null;
}
