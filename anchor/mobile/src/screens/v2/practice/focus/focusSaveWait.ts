export type FocusSaveWaitResult = 'saved' | 'failed' | 'unknown';

/**
 * Bound the UI wait without canceling or replacing the underlying durable write.
 * The original receipt remains observable and can settle after this returns.
 */
export async function waitForFocusSave(
  receipt: Promise<unknown>,
  timeoutMs = 5_000,
): Promise<FocusSaveWaitResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      receipt.then(
        (): FocusSaveWaitResult => 'saved',
        (): FocusSaveWaitResult => 'failed',
      ),
      new Promise<FocusSaveWaitResult>((resolve) => {
        timer = setTimeout(() => resolve('unknown'), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
