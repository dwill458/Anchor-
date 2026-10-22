import { waitForFocusSave } from '../focusSaveWait';

describe('waitForFocusSave', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reports a normal durable receipt', async () => {
    await expect(waitForFocusSave(Promise.resolve())).resolves.toBe('saved');
  });

  it('reports a rejected durable receipt as failed', async () => {
    await expect(waitForFocusSave(Promise.reject(new Error('disk unavailable')))).resolves.toBe('failed');
  });

  it('returns unknown at the UI threshold without canceling a delayed receipt', async () => {
    let resolveReceipt!: () => void;
    const receipt = new Promise<void>((resolve) => { resolveReceipt = resolve; });
    const waiting = waitForFocusSave(receipt, 5_000);
    await jest.advanceTimersByTimeAsync(5_000);
    await expect(waiting).resolves.toBe('unknown');
    resolveReceipt();
    await expect(receipt).resolves.toBeUndefined();
  });

  it('observes a receipt that resolves before the UI threshold', async () => {
    let resolveReceipt!: () => void;
    const receipt = new Promise<void>((resolve) => { resolveReceipt = resolve; });
    const waiting = waitForFocusSave(receipt, 5_000);
    resolveReceipt();
    await expect(waiting).resolves.toBe('saved');
  });
});
