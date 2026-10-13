import {
  STARTUP_FAULT_ACTIONS,
  STARTUP_FAULT_CONSUMED,
  STARTUP_FAULT_MARKER_KEY,
  consumeStartupFaultMarker,
  startupFaultActionForUrl,
} from './startupFaultDiagnostic';

describe('startup fault fixture', () => {
  it('accepts only the three literal arm URLs and a fixed marker key', () => {
    expect(STARTUP_FAULT_MARKER_KEY).toBe('anchor:perf:startup-fault-v1');
    expect(STARTUP_FAULT_CONSUMED).toBe('consumed');
    expect(startupFaultActionForUrl('anchor-perflab20261012://perf/arm-startup-anchor-12s')).toMatchObject({ marker: 'anchor-12s', delayMs: 12_000, phaseCode: 1 });
    expect(startupFaultActionForUrl('anchor-perflab20261012://perf/arm-startup-auth-16s')).toMatchObject({ marker: 'auth-16s', delayMs: 16_000, phaseCode: 2 });
    expect(startupFaultActionForUrl('anchor-perflab20261012://perf/arm-startup-auth-14s')).toMatchObject({ marker: 'auth-14s', delayMs: 14_000, phaseCode: 3 });
    expect(startupFaultActionForUrl('anchor-perflab20261012://perf/arm-startup-auth-14s?x=1')).toBeNull();
    expect(startupFaultActionForUrl('https://owner.example/')).toBeNull();
    expect(Object.keys(STARTUP_FAULT_ACTIONS)).toHaveLength(3);
  });

  it('checks eligibility, durably consumes before waiting, then emits numeric lifecycle events', async () => {
    const calls: string[] = [];
    const events: Array<[number, number, number]> = [];
    let time = 100;
    const ok = await consumeStartupFaultMarker('anchor-12s', {
      eligible: async () => { calls.push('eligible'); return true; },
      readMarker: async () => { calls.push('read'); return 'anchor-12s'; },
      markConsumed: async () => { calls.push('consume'); return true; },
      wait: async (ms) => { calls.push(`wait-${ms}`); time += ms; },
      onEvent: (phase, elapsed, result) => events.push([phase, elapsed, result]),
      now: () => time,
    });
    expect(ok).toBe(true);
    expect(calls).toEqual(['eligible', 'read', 'consume', 'wait-12000']);
    expect(events).toEqual([[1, 0, 1], [1, 12000, 2]]);
  });

  it('refuses an owner/package precheck before marker reads or mutation', async () => {
    const calls: string[] = [];
    const events: number[] = [];
    const ok = await consumeStartupFaultMarker('auth-16s', {
      eligible: async () => { calls.push('eligible'); return false; },
      readMarker: async () => { calls.push('read'); return 'auth-16s'; },
      markConsumed: async () => { calls.push('consume'); return true; },
      wait: async () => { calls.push('wait'); },
      onEvent: (_phase, _elapsed, result) => events.push(result),
    });
    expect(ok).toBe(false);
    expect(calls).toEqual(['eligible']);
    expect(events).toEqual([3]);
  });

  it('does not consume or delay when the persisted marker belongs to another phase', async () => {
    const calls: string[] = [];
    const ok = await consumeStartupFaultMarker('auth-14s', {
      eligible: async () => true,
      readMarker: async () => 'auth-16s',
      markConsumed: async () => { calls.push('consume'); return true; },
      wait: async () => { calls.push('wait'); },
      onEvent: (_phase, _elapsed, result) => calls.push(`event-${result}`),
    });
    expect(ok).toBe(false);
    expect(calls).toEqual(['event-3']);
  });

  it('does not delay or report consumption when the durable consume write fails', async () => {
    const calls: string[] = [];
    const ok = await consumeStartupFaultMarker('auth-14s', {
      eligible: async () => true,
      readMarker: async () => 'auth-14s',
      markConsumed: async () => false,
      wait: async () => { calls.push('wait'); },
      onEvent: (_phase, _elapsed, result) => calls.push(`event-${result}`),
    });
    expect(ok).toBe(false);
    expect(calls).toEqual(['event-3']);
  });

  it('fails closed for a malformed runtime marker without touching storage', async () => {
    const calls: string[] = [];
    const ok = await consumeStartupFaultMarker('owner-value' as any, {
      eligible: async () => { calls.push('eligible'); return true; },
      readMarker: async () => { calls.push('read'); return null; },
      markConsumed: async () => { calls.push('consume'); return false; },
      wait: async () => { calls.push('wait'); },
      onEvent: (_phase, _elapsed, result) => calls.push(`event-${result}`),
    });
    expect(ok).toBe(false);
    expect(calls).toEqual(['event-3']);
  });
});
