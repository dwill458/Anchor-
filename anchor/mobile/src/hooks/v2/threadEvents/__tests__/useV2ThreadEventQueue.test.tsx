import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useV2ThreadEventQueue } from '../useV2ThreadEventQueue';
import { V2ThreadEventReceiptStore } from '@/adapters/v2/threadEvents';
import type { V2PersistedThreadEvent } from '@/adapters/v2/threadEvents';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useCelebrationRecordsStore } from '@/stores/v2/celebrationRecordsStore';

const event = (id: string, sequence: string): V2PersistedThreadEvent => ({
  eventId: id, ledgerSequence: sequence, eventType: 'EVOLUTION_STAGE_REACHED', significance: 'HIGH', occurredAt: '2026-09-08T12:00:00.000Z', sourceKind: 'THREAD_ENGINE', correlationId: id, correlationSequence: 1, eventVersion: 1, detectorVersion: 'v1', metadata: { thresholdValue: 10, stageName: 'Grounded' }, createdAt: '2026-09-08T12:00:00.000Z',
});

describe('useV2ThreadEventQueue', () => {
  it('preserves ledger order and presents only one bundle at a time', async () => {
    const values = new Map<string, string>();
    const receiptStore = new V2ThreadEventReceiptStore({ getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } });
    const updateReceipt = jest.fn(async () => undefined);
    const { result } = renderHook(() => useV2ThreadEventQueue({ channel: 'PRIMARY_IMMEDIATE', enabled: false, receiptStore, updateReceipt }));
    await act(async () => { await result.current.enqueue({ events: [event('second', '2'), event('first', '1')] }); });
    expect(result.current.active?.primary.eventId).toBe('first');
    expect(result.current.queue).toHaveLength(2);
    await act(async () => { await result.current.acknowledge(); });
    expect(result.current.active?.primary.eventId).toBe('second');
    expect(updateReceipt).toHaveBeenCalledWith('first', 'PRIMARY_IMMEDIATE', 'ACKNOWLEDGED');
  });
});

const stageEvent = (id: string, sequence: string, threadValue: number, anchorId = 'anchor-1'): V2PersistedThreadEvent => ({
  ...event(id, sequence),
  anchorId,
  metadata: { thresholdValue: 25, stageName: 'Rooted', threadValue },
});

const waypointEvent = (id: string, sequence: string): V2PersistedThreadEvent => ({
  ...event(id, sequence),
  eventType: 'WAYPOINT_REACHED',
  metadata: { waypointTitle: 'Publish your work' },
});

const memoryReceipts = () => {
  const values = new Map<string, string>();
  return new V2ThreadEventReceiptStore({ getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } });
};

describe('useV2ThreadEventQueue celebration gate', () => {
  beforeEach(() => {
    useCelebrationStore.getState().reset();
    useCelebrationRecordsStore.setState({ records: {}, hydrated: true });
  });

  it('holds the modal while a celebration plays and presents it once the coordinator is idle', async () => {
    const updateReceipt = jest.fn(async () => undefined);
    const { result } = renderHook(() => useV2ThreadEventQueue({ channel: 'PRIMARY_IMMEDIATE', enabled: false, receiptStore: memoryReceipts(), updateReceipt }));
    await act(async () => { await result.current.enqueue({ events: [event('first', '1')] }); });
    expect(result.current.presentable?.primary.eventId).toBe('first');

    act(() => { useCelebrationStore.getState().request(3, 'practice-scene'); });
    expect(result.current.held).toBe(true);
    expect(result.current.presentable).toBeNull();
    expect(result.current.active?.primary.eventId).toBe('first');

    act(() => { useCelebrationStore.getState().finish('practice-scene'); });
    expect(result.current.held).toBe(false);
    expect(result.current.presentable?.primary.eventId).toBe('first');
  });

  it('holds presentation until the stored stage records have been read', async () => {
    useCelebrationRecordsStore.setState({ hydrated: false });
    const { result } = renderHook(() => useV2ThreadEventQueue({ channel: 'PRIMARY_IMMEDIATE', enabled: false, receiptStore: memoryReceipts(), updateReceipt: jest.fn(async () => undefined) }));
    await act(async () => { await result.current.enqueue({ events: [event('first', '1')] }); });
    expect(result.current.held).toBe(true);
    expect(result.current.presentable).toBeNull();
    act(() => { useCelebrationRecordsStore.setState({ hydrated: true }); });
    expect(result.current.presentable?.primary.eventId).toBe('first');
  });

  it('holds a waypoint event the same way while a scene is busy', async () => {
    const { result } = renderHook(() => useV2ThreadEventQueue({ channel: 'PRIMARY_IMMEDIATE', enabled: false, receiptStore: memoryReceipts(), updateReceipt: jest.fn(async () => undefined) }));
    await act(async () => { await result.current.enqueue({ events: [waypointEvent('waypoint', '1')] }); });
    act(() => { useCelebrationStore.getState().request(3, 'practice-scene'); });
    expect(result.current.presentable).toBeNull();
    act(() => { useCelebrationStore.getState().finish('practice-scene'); });
    expect(result.current.presentable?.primary.eventId).toBe('waypoint');
  });

  it('marks a stage the device already celebrated as presented and removes it, so the next event shows', async () => {
    useCelebrationRecordsStore.setState({ records: { 'anchor-1': { stages: { building: '2026-08-05T09:00:00.000Z' } } }, hydrated: true });
    const receiptStore = memoryReceipts();
    const updateReceipt = jest.fn(async () => undefined);
    const { result } = renderHook(() => useV2ThreadEventQueue({ channel: 'PRIMARY_IMMEDIATE', enabled: false, receiptStore, updateReceipt }));
    await act(async () => {
      await result.current.enqueue({ events: [stageEvent('celebrated', '1', 25), stageEvent('fresh', '2', 50)] });
    });
    await waitFor(() => expect(result.current.queue.map((item) => item.primary.eventId)).toEqual(['fresh']));
    expect(result.current.active?.primary.eventId).toBe('fresh');
    expect(result.current.presentable?.primary.eventId).toBe('fresh');
    expect(updateReceipt).toHaveBeenCalledWith('celebrated', 'PRIMARY_IMMEDIATE', 'PRESENTED');
    expect(updateReceipt).not.toHaveBeenCalledWith('fresh', 'PRIMARY_IMMEDIATE', 'PRESENTED');
    expect(await receiptStore.isTerminal('celebrated', 'PRIMARY_IMMEDIATE')).toBe(true);
  });

  it('shows a stage event whose stage has no local record, and one with no Thread value', async () => {
    useCelebrationRecordsStore.setState({ records: { 'anchor-1': { stages: { building: '2026-08-05T09:00:00.000Z' } } }, hydrated: true });
    const { result } = renderHook(() => useV2ThreadEventQueue({ channel: 'PRIMARY_IMMEDIATE', enabled: false, receiptStore: memoryReceipts(), updateReceipt: jest.fn(async () => undefined) }));
    const noValue: V2PersistedThreadEvent = { ...event('no-value', '1'), anchorId: 'anchor-1' };
    await act(async () => { await result.current.enqueue({ events: [noValue, stageEvent('new-stage', '2', 75)] }); });
    expect(result.current.queue.map((item) => item.primary.eventId)).toEqual(['no-value', 'new-stage']);
    expect(result.current.active?.primary.eventId).toBe('no-value');
  });
});
