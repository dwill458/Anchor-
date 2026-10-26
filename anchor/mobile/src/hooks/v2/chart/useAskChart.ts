import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { askChartApi, type AskChartApi, type AskSkill } from '@/services/v2/askChartApi';
import { classifyChartError, freshKey } from '@/services/v2/chartV2Api';
import { trackChart } from '@/hooks/v2/chart/useAnchorChart';
import { askReducer, affordances, initialAskState, type AskUiMessage } from './askChartState';
import { openingKeyFor, takeAskOpening } from './askOpeningPrefetch';

type Options = {
  anchorId: string;
  api?: AskChartApi;
  reducedMotion?: boolean;
  /** Greets the person on an empty conversation. Turn off for surfaces that restore only. */
  greet?: boolean;
};

type Pending = {
  /** Null for the opening greeting, which has no user message. */
  messageKey: string | null;
  body: { idempotencyKey: string; text?: string; attachments?: string[]; skill?: AskSkill; opening?: boolean; targetMoveId?: string | null };
};

let localCounter = 0;

/**
 * One Ask Chart conversation. Messages are sent strictly one at a time and in order; a message shows (and the
 * composer clears) the moment it is accepted for sending, and a failed one keeps its idempotency key so retrying it can
 * never produce a second message or a second answer.
 */
export function useAskChart({ anchorId, api = askChartApi, reducedMotion = false, greet = true }: Options) {
  const [state, dispatch] = useReducer(askReducer, initialAskState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const queue = useRef<Pending[]>([]);
  const running = useRef<AbortController | null>(null);
  // After a failure nothing further is sent until the person retries: a later message must not be answered before it.
  const paused = useRef(false);
  // DEFERRED: a mount-local freshKey was replaced by the shared opening key (Oct 2026).
  const openingKey = useRef(openingKeyFor(anchorId));
  const mounted = useRef(true);
  const autoRetried = useRef<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const mountedAt = useRef(Date.now());
  const timingMark = useCallback((mark: string) => {
    if (__DEV__) console.info('[AskChart timing]', mark, { anchorId, mountMs: Date.now() - mountedAt.current });
  }, [anchorId]);

  const pump = useCallback(async () => {
    if (running.current || paused.current) return;
    const next = queue.current.shift();
    if (!next) return;
    const controller = new AbortController();
    running.current = controller;
    const draftKey = `reply-${++localCounter}`;
    dispatch({ type: 'turn_started', messageKey: next.messageKey, draftKey });
    const started = Date.now();
    let firstDeltaMs: number | null = null;
    timingMark('turn_started');
    try {
      const result = await api.turn(
        anchorId,
        { ...next.body, conversationId: stateRef.current.conversationId },
        {
          onReply: text => {
            if (firstDeltaMs === null && text.length > 0) {
              firstDeltaMs = Date.now() - started;
              timingMark('first_delta');
            }
            if (mounted.current) dispatch({ type: 'delta', text });
          },
          onStage: stage => mounted.current && dispatch({ type: 'stage', stage }),
        },
        controller.signal
      );
      if (!mounted.current) return;
      dispatch({ type: 'turn_done', messageKey: next.messageKey, draftKey, result, animate: !reducedMotion && !result.replayed });
      timingMark('turn_done');
      trackChart('ask_chart_turn', { mode: result.mode, opening: Boolean(next.body.opening), replayed: result.replayed, fallbackUsed: result.generation.fallbackUsed, latencyMs: Date.now() - started, firstDeltaMs });
    } catch (caught) {
      if (!mounted.current) return;
      const kind = controller.signal.aborted ? 'cancelled' : classifyChartError(caught).kind;
      dispatch({ type: 'turn_failed', messageKey: next.messageKey, kind });
      trackChart('ask_chart_turn_failed', { kind, opening: Boolean(next.body.opening) });
      // Whatever is queued behind a failed message waits, in order, until the person retries.
      paused.current = true;
      return;
    } finally {
      running.current = null;
    }
    void pump();
  }, [anchorId, api, reducedMotion, timingMark]);

  // Restore the conversation, then greet if it is empty.
  useEffect(() => {
    mounted.current = true;
    mountedAt.current = Date.now();
    timingMark('mount');
    const controller = new AbortController();
    (async () => {
      try {
        const prefetched = greet ? takeAskOpening(anchorId, api) : null;
        if (prefetched) {
          const opening = await prefetched;
          if (controller.signal.aborted || !mounted.current) return;
          if (opening) {
            const { conversation, result, timing } = opening;
            dispatch({ type: 'loaded', conversationId: conversation.conversationId, mode: conversation.mode, messages: conversation.messages });
            timingMark('prefetch_joined');
            if (result) {
              dispatch({ type: 'turn_done', messageKey: null, draftKey: `reply-${++localCounter}`, result, animate: !reducedMotion });
              trackChart('ask_chart_turn', { mode: result.mode, opening: true, replayed: result.replayed, fallbackUsed: result.generation.fallbackUsed, latencyMs: timing.doneMs - timing.turnStartedMs, firstDeltaMs: timing.firstDeltaMs });
            }
            return;
          }
        }
        const conversation = await api.getConversation(anchorId, controller.signal);
        timingMark('conversation_resolved');
        if (controller.signal.aborted || !mounted.current) return;
        dispatch({ type: 'loaded', conversationId: conversation.conversationId, mode: conversation.mode, messages: conversation.messages });
        if (greet && conversation.messages.length === 0) {
          queue.current.push({ messageKey: null, body: { idempotencyKey: openingKey.current, opening: true } });
          void pump();
        }
      } catch {
        if (mounted.current && !controller.signal.aborted) dispatch({ type: 'load_failed' });
      }
    })();
    return () => {
      mounted.current = false;
      controller.abort();
      running.current?.abort();
      queue.current = [];
    };
    // pump is stable for the life of an Anchor; restoring must not re-run when it changes identity mid-turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorId, reloadKey]);

  const reload = useCallback(() => {
    if (running.current) return;
    queue.current = [];
    paused.current = false;
    dispatch({ type: 'reset' });
    setReloadKey(key => key + 1);
  }, []);

  const send = useCallback(
    (text: string, options: { attachments?: string[]; skill?: AskSkill; targetMoveId?: string | null; previewUris?: string[] } = {}) => {
      // A joined opening restores the conversation atomically; accepting a send before it settles would be overwritten.
      if (stateRef.current.status === 'loading') return false;
      const clean = text.trim();
      const attachments = options.attachments ?? [];
      if (!clean && attachments.length === 0) return false;
      const key = `local-${++localCounter}`;
      const sendKey = freshKey(`ask-msg:${anchorId}`);
      const message: AskUiMessage = {
        id: key,
        key,
        role: 'USER',
        text: clean,
        createdAt: new Date().toISOString(),
        attachments: attachments.map(assetId => ({ assetId })),
        suggestions: [],
        requestPhoto: null,
        readyToPlan: false,
        planInput: null,
        action: null,
        actionUnavailable: false,
        skill: options.skill && options.skill !== 'FREE' ? options.skill : null,
        status: 'queued',
        animate: !reducedMotion,
        sendKey,
        previewUris: options.previewUris?.length ? options.previewUris : undefined,
      };
      if (paused.current && stateRef.current.openingFailed) {
        // The person is talking now, so the greeting that failed is no longer needed.
        paused.current = false;
        queue.current = queue.current.filter(item => item.messageKey !== null);
      }
      dispatch({ type: 'queued', message });
      queue.current.push({
        messageKey: key,
        body: { idempotencyKey: sendKey, text: clean, attachments, skill: options.skill ?? 'FREE', targetMoveId: options.targetMoveId ?? null },
      });
      void pump();
      return true;
    },
    [anchorId, pump, reducedMotion]
  );

  const retry = useCallback(() => {
    const current = stateRef.current;
    if (!current.error || running.current) return;
    if (current.openingFailed) {
      queue.current.unshift({ messageKey: null, body: { idempotencyKey: openingKey.current, opening: true } });
    } else {
      const failed = current.messages.find(message => message.key === current.error?.messageKey);
      if (!failed?.sendKey) return;
      queue.current.unshift({
        messageKey: failed.key,
        body: { idempotencyKey: failed.sendKey, text: failed.text, attachments: failed.attachments.map(item => item.assetId), skill: (failed.skill as AskSkill | null) ?? 'FREE' },
      });
    }
    paused.current = false;
    void pump();
  }, [pump]);

  const cancel = useCallback(() => running.current?.abort(), []);

  const markAction = useCallback((messageId: string, status: 'PENDING' | 'APPLIED' | 'DISMISSED') => dispatch({ type: 'action_status', messageId, status }), []);

  /** Pick up proposals applied elsewhere (a route revision approved on the review screen). Never disturbs a running turn. */
  const syncActions = useCallback(async () => {
    if (running.current) return;
    try {
      const conversation = await api.getConversation(anchorId);
      if (mounted.current) dispatch({ type: 'sync_actions', messages: conversation.messages });
    } catch {
      /* the next visit tries again */
    }
  }, [anchorId, api]);

  // Coming back to the app after a dropped connection: try the failed message once more, automatically.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      const { error } = stateRef.current;
      if (next !== 'active' || !error || running.current) return;
      if (error.kind !== 'offline' && error.kind !== 'unavailable') return;
      const id = `${error.messageKey ?? 'opening'}:${error.kind}`;
      if (autoRetried.current === id) return;
      autoRetried.current = id;
      retry();
    });
    return () => subscription?.remove?.();
  }, [retry]);

  const offered = useMemo(() => affordances(state), [state]);
  const busy = state.turn !== 'idle' || state.messages.some(message => message.status === 'queued' || message.status === 'sending');
  return { state, send, retry, cancel, reload, markAction, syncActions, ...offered, busy };
}
