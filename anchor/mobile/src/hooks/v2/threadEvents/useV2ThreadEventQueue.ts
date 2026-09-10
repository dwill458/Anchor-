import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bundleV2ThreadEvents, claimV2ThreadEventBundle, fetchV2EligibleThreadEvents, intakeV2ThreadEvents, updateV2ThreadEventReceipt, V2ThreadEventReceiptStore } from '@/adapters/v2/threadEvents';
import type { V2ThreadEventIntake, V2ThreadEventBundle } from '@/adapters/v2/threadEvents';
import type { V2ThreadEventChannel } from '@/constants/v2/threadEvents';

type QueueOptions = {
  /** Home arrival asks for contextual events rather than interrupting an active Practice. */
  channel?: V2ThreadEventChannel;
  enabled?: boolean;
  receiptStore?: V2ThreadEventReceiptStore;
  fetchEligible?: typeof fetchV2EligibleThreadEvents;
  claimBundle?: typeof claimV2ThreadEventBundle;
  updateReceipt?: typeof updateV2ThreadEventReceipt;
};

/**
 * Presentation policy over canonical facts. The hook never detects events or calculates Thread deltas.
 * Claims are advisory. The receipt is authoritative: PRESENTED is persisted
 * before local storage, so a crash/reload never replays a visible ceremony.
 */
export function useV2ThreadEventQueue(options: QueueOptions = {}) {
  const channel = options.channel ?? 'HOME_CONTEXT';
  const enabled = options.enabled ?? true;
  const defaultReceiptStore = useRef<V2ThreadEventReceiptStore | null>(null);
  if (!defaultReceiptStore.current) defaultReceiptStore.current = new V2ThreadEventReceiptStore();
  const receiptStore = options.receiptStore ?? defaultReceiptStore.current;
  const fetchEligible = options.fetchEligible ?? fetchV2EligibleThreadEvents;
  const claimBundle = options.claimBundle ?? claimV2ThreadEventBundle;
  const updateReceipt = options.updateReceipt ?? updateV2ThreadEventReceipt;
  const [queue, setQueue] = useState<V2ThreadEventBundle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enqueue = useCallback(async (intake: V2ThreadEventIntake) => {
    const bundles = bundleV2ThreadEvents(intakeV2ThreadEvents(intake));
    const eligible: V2ThreadEventBundle[] = [];
    for (const bundle of bundles) {
      if (bundle.channel !== channel) continue;
      if (!(await receiptStore.isTerminal(bundle.primary.eventId, bundle.channel))) eligible.push(bundle);
    }
    setQueue((current) => {
      const known = new Set(current.map((item) => item.bundleKey));
      return [...current, ...eligible.filter((item) => !known.has(item.bundleKey))];
    });
  }, [channel, receiptStore]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true); setError(null);
    try { await enqueue({ events: await fetchEligible(channel) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Thread Events are unavailable.'); }
    finally { setLoading(false); }
  }, [channel, enabled, enqueue, fetchEligible]);

  useEffect(() => { void refresh(); }, [refresh]);

  const active = queue[0] ?? null;
  const markPresented = useCallback(async () => {
    if (!active) return;
    await updateReceipt(active.primary.eventId, active.channel, 'PRESENTED');
    await receiptStore.write({ eventId: active.primary.eventId, channel: active.channel, status: 'PRESENTED', bundleKey: active.bundleKey, firstPresentedAt: new Date().toISOString() });
  }, [active, receiptStore, updateReceipt]);

  const settle = useCallback(async (status: 'ACKNOWLEDGED' | 'DISMISSED') => {
    if (!active) return;
    await updateReceipt(active.primary.eventId, active.channel, status);
    await receiptStore.write({ eventId: active.primary.eventId, channel: active.channel, status, bundleKey: active.bundleKey, acknowledgedAt: status === 'ACKNOWLEDGED' ? new Date().toISOString() : null, dismissedAt: status === 'DISMISSED' ? new Date().toISOString() : null });
    setQueue((current) => current.slice(1));
  }, [active, receiptStore, updateReceipt]);

  const claimActive = useCallback(async () => { if (active) await claimBundle(active); }, [active, claimBundle]);
  const acknowledge = useCallback(() => settle('ACKNOWLEDGED'), [settle]);
  const dismiss = useCallback(() => settle('DISMISSED'), [settle]);
  return useMemo(() => ({ active, queue, loading, error, enqueue, refresh, claimActive, markPresented, acknowledge, dismiss }), [acknowledge, active, claimActive, dismiss, enqueue, error, loading, markPresented, queue, refresh]);
}
