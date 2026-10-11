import { waitForExportAssets } from '../useShareExportRenderer';

describe('Vision export readiness timeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('rejects Vision exports after timeout so an incomplete board cannot be captured', async () => {
    const pending = waitForExportAssets('vision', () => false, () => () => {}, 10);
    const rejection = expect(pending).rejects.toThrow('Vision board assets did not finish loading.');
    jest.advanceTimersByTime(10);
    await rejection;
  });

  it('keeps the existing timeout fallback for other layouts and resolves true when ready', async () => {
    const fallback = waitForExportAssets('minimal', () => false, () => () => {}, 10);
    jest.advanceTimersByTime(10);
    await expect(fallback).resolves.toBe(false);
    await expect(waitForExportAssets('vision', () => true, () => () => {}, 10)).resolves.toBe(true);
  });

  it('resolves the registered waiter as ready and unsubscribes', async () => {
    let ready: (() => void) | undefined;
    const unsubscribe = jest.fn();
    const pending = waitForExportAssets('vision', () => false, (resolve) => {
      ready = resolve;
      return unsubscribe;
    }, 100);
    ready?.();
    await expect(pending).resolves.toBe(true);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
