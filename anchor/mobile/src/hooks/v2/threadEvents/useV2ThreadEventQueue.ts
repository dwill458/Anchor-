import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bundleV2ThreadEvents, claimV2ThreadEventBundle, fetchV2EligibleThreadEvents, intakeV2ThreadEvents, updateV2ThreadEventReceipt, V2ThreadEventReceiptStore } from '@/adapters/v2/threadEvents';
import type { V2ThreadEventIntake, V2ThreadEventBundle } from '@/adapters/v2/threadEvents';
import type { V2ThreadEventChannel } from '@/constants/v2/threadEvents';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useCelebrationRecordsStore } from '@/stores/v2/celebrationRecordsStore';
import { isAlreadyCelebrated } from './threadEventGate';

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
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Anchor history is unavailable.'); }
    finally { setLoading(false); }
  }, [channel, enabled, enqueue, fetchEligible]);

  useEffect(() => { void refresh(); }, [refresh]);

  // A stage the device has already celebrated is marked presented through the same receipt path and
  // removed from the queue, so it is never shown and never sits at the front of the queue.
  const celebrationRecords = useCelebrationRecordsStore((state) => state.records);
  const alreadyCelebrated = useCallback(
    (item: V2ThreadEventBundle) => isAlreadyCelebrated(item.primary, celebrationRecords),
    [celebrationRecords],
  );
  const suppressed = useRef<Set<string>>(new Set());
  const suppress = useCallback(async (item: V2ThreadEventBundle) => {
    try {
      await updateReceipt(item.primary.eventId, item.channel, 'PRESENTED');
    } catch {
      // Nothing was shown. The local receipt below still stops the event returning to this queue.
    }
    try {
      await receiptStore.write({ eventId: item.primary.eventId, channel: item.channel, status: 'PRESENTED', bundleKey: item.bundleKey, firstPresentedAt: new Date().toISOString() });
    } finally {
      setQueue((current) => current.filter((queued) => queued.bundleKey !== item.bundleKey));
    }
  }, [receiptStore, updateReceipt]);
  useEffect(() => {
    for (const item of queue) {
      if (!alreadyCelebrated(item) || suppressed.current.has(item.bundleKey)) continue;
      suppressed.current.add(item.bundleKey);
      suppress(item).catch(() => undefined);
    }
  }, [alreadyCelebrated, queue, suppress]);

  const active = useMemo(() => queue.find((item) => !alreadyCelebrated(item)) ?? null, [alreadyCelebrated, queue]);

  // The coordinator decides whether a celebration is playing. While one is, nothing is presentable;
  // when it goes idle the same event becomes presentable and the modal shows it.
  const celebrationPlaying = useCelebrationStore((state) => state.active !== null);
  // Presentation also waits for the stored stage records, so a stage the device already celebrated is
  // never shown on a cold start before it has been read.
  const recordsRead = useCelebrationRecordsStore((state) => state.hydrated);
  const held = celebrationPlaying || !recordsRead;
  const presentable = held ? null : active;

  const markPresented = useCallback(async () => {
    if (!active) return;
    await updateReceipt(active.primary.eventId, active.channel, 'PRESENTED');
    await receiptStore.write({ eventId: active.primary.eventId, channel: active.channel, status: 'PRESENTED', bundleKey: active.bundleKey, firstPresentedAt: new Date().toISOString() });
  }, [active, receiptStore, updateReceipt]);

  const settle = useCallback(async (status: 'ACKNOWLEDGED' | 'DISMISSED') => {
    if (!active) return;
    await updateReceipt(active.primary.eventId, active.channel, status);
    await receiptStore.write({ eventId: active.primary.eventId, channel: active.channel, status, bundleKey: active.bundleKey, acknowledgedAt: status === 'ACKNOWLEDGED' ? new Date().toISOString() : null, dismissedAt: status === 'DISMISSED' ? new Date().toISOString() : null });
    setQueue((current) => current.filter((queued) => queued.bundleKey !== active.bundleKey));
  }, [active, receiptStore, updateReceipt]);

  const claimActive = useCallback(async () => { if (active) await claimBundle(active); }, [active, claimBundle]);
  const acknowledge = useCallback(() => settle('ACKNOWLEDGED'), [settle]);
  const dismiss = useCallback(() => settle('DISMISSED'), [settle]);
  return useMemo(() => ({ active, presentable, held, queue, loading, error, enqueue, refresh, claimActive, markPresented, acknowledge, dismiss }), [acknowledge, active, claimActive, dismiss, enqueue, error, held, loading, markPresented, presentable, queue, refresh]);
}
