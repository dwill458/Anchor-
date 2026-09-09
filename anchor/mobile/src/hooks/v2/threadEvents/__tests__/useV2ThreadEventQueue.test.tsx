import { act, renderHook } from '@testing-library/react-native';
import { useV2ThreadEventQueue } from '../useV2ThreadEventQueue';
import { V2ThreadEventReceiptStore } from '@/adapters/v2/threadEvents';
import type { V2PersistedThreadEvent } from '@/adapters/v2/threadEvents';

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
