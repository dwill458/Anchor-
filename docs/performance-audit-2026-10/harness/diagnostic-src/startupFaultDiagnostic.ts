/** Fixed, one-shot release-only startup-fault markers; never contain user data. */
export const STARTUP_FAULT_MARKER_KEY = 'anchor:perf:startup-fault-v1';
export const STARTUP_FAULT_CONSUMED = 'consumed';
export const STARTUP_FAULT_ACTIONS = {
  'anchor-perflab20261012://perf/arm-startup-anchor-12s': {
    marker: 'anchor-12s',
    phaseCode: 1,
    delayMs: 12_000,
  },
  'anchor-perflab20261012://perf/arm-startup-auth-16s': {
    marker: 'auth-16s',
    phaseCode: 2,
    delayMs: 16_000,
  },
  'anchor-perflab20261012://perf/arm-startup-auth-14s': {
    marker: 'auth-14s',
    phaseCode: 3,
    delayMs: 14_000,
  },
} as const;

export type StartupFaultAction = (typeof STARTUP_FAULT_ACTIONS)[keyof typeof STARTUP_FAULT_ACTIONS];
export type StartupFaultMarker = StartupFaultAction['marker'];

export function startupFaultActionForUrl(url: string | null): StartupFaultAction | null {
  if (url === null) return null;
  return Object.prototype.hasOwnProperty.call(STARTUP_FAULT_ACTIONS, url)
    ? STARTUP_FAULT_ACTIONS[url as keyof typeof STARTUP_FAULT_ACTIONS]
    : null;
}

export function startupFaultActionForMarker(marker: StartupFaultMarker): StartupFaultAction {
  return Object.values(STARTUP_FAULT_ACTIONS).find((action) => action.marker === marker)!;
}

export function isStartupFaultMarker(value: unknown): value is StartupFaultMarker {
  return value === 'anchor-12s' || value === 'auth-16s' || value === 'auth-14s';
}

export interface StartupFaultConsumptionOptions {
  eligible(): Promise<boolean>;
  readMarker(): Promise<string | null>;
  markConsumed(): Promise<boolean>;
  wait(ms: number): Promise<void>;
  onEvent(phaseCode: number, elapsedMs: number, resultCode: 1 | 2 | 3): void;
  now?(): number;
}

/** Eligibility is checked before marker access; durable consume always precedes the injected delay. */
export async function consumeStartupFaultMarker(
  expectedMarkerOrAction: StartupFaultMarker | StartupFaultAction,
  options: StartupFaultConsumptionOptions,
): Promise<boolean> {
  const expected = typeof expectedMarkerOrAction === 'string'
    ? (isStartupFaultMarker(expectedMarkerOrAction) ? startupFaultActionForMarker(expectedMarkerOrAction) : null)
    : Object.values(STARTUP_FAULT_ACTIONS).find((action) =>
      action.marker === expectedMarkerOrAction.marker && action.phaseCode === expectedMarkerOrAction.phaseCode &&
      action.delayMs === expectedMarkerOrAction.delayMs) ?? null;
  if (!expected) {
    options.onEvent(typeof expectedMarkerOrAction === 'string' ? 0 : expectedMarkerOrAction.phaseCode, 0, 3);
    return false;
  }
  const now = options.now ?? Date.now;
  const startedAt = now();
  const elapsed = () => Math.max(0, Math.round(now() - startedAt));
  if (!await options.eligible()) {
    options.onEvent(expected.phaseCode, elapsed(), 3);
    return false;
  }
  if (await options.readMarker() !== expected.marker || !await options.markConsumed()) {
    options.onEvent(expected.phaseCode, elapsed(), 3);
    return false;
  }
  options.onEvent(expected.phaseCode, elapsed(), 1);
  await options.wait(expected.delayMs);
  options.onEvent(expected.phaseCode, elapsed(), 2);
  return true;
}
