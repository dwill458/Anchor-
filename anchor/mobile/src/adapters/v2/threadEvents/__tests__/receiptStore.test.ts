import { V2ThreadEventReceiptStore } from '../receiptStore';

describe('V2ThreadEventReceiptStore', () => {
  it('does not replay an acknowledged event after a new store instance loads the persistent cache', async () => {
    const values = new Map<string, string>();
    const storage = { getItem: jest.fn(async (key: string) => values.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }) };
    const first = new V2ThreadEventReceiptStore(storage);
    await first.write({ eventId: 'te-ack', channel: 'PRIMARY_IMMEDIATE', status: 'ACKNOWLEDGED', acknowledgedAt: '2026-09-08T12:00:00.000Z' });
    const reloaded = new V2ThreadEventReceiptStore(storage);
    await expect(reloaded.isTerminal('te-ack', 'PRIMARY_IMMEDIATE')).resolves.toBe(true);
  });
});
