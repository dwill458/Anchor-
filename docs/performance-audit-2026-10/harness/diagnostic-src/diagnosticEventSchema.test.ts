import { sanitizePerfDiagnostic } from './diagnosticEventSchema';

describe('release diagnostic field allowlist', () => {
  it('keeps the required diagnostic events and only their allowlisted finite numeric fields', () => {
    expect(sanitizePerfDiagnostic('auth-emulator-route', { okCode: 1, host: '127.0.0.1', port: 9099 })).toEqual({ okCode: 1 });
    expect(sanitizePerfDiagnostic('startup-recovery', { elapsedMs: 9_000, screen: 'private' })).toEqual({ elapsedMs: 9_000 });
    expect(sanitizePerfDiagnostic('motion-fixture-seed', {
      anchorCount: 72, sceneCount: 3, waypointCount: 5, cacheCount: 2, intention: 'private',
    })).toEqual({ anchorCount: 72, sceneCount: 3, waypointCount: 5, cacheCount: 2 });
    expect(sanitizePerfDiagnostic('startup-fault', { phaseCode: 1, elapsedMs: 12_000, resultCode: 2, marker: 'auth-16s' }))
      .toEqual({ phaseCode: 1, elapsedMs: 12_000, resultCode: 2 });
    expect(sanitizePerfDiagnostic('unregistered-event', { durationMs: 10 })).toBeNull();
    expect(sanitizePerfDiagnostic('motion-fixture-seed', { okCode: Number.NaN, payload: 123 })).toEqual({});
  });
});
