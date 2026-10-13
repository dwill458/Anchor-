/** Strict release-only perf event/field allowlist; values are numbers only. */
export const DIAGNOSTIC_EVENTS = new Set([
  'secure-read', 'secure-write', 'storage-fallback', 'fixture-seed',
  'fixture-roundtrip', 'auth-adapter-control', 'benchmark-skip',
  'benchmark-complete', 'benchmark-error', 'app-ready', 'anchor-hydration', 'focus-await',
  'auth-adapter-write', 'js-loop-histogram', 'motion-fixture-seed', 'startup-fault',
  'auth-emulator-route', 'startup-recovery',
]);

export const DIAGNOSTIC_NUMERIC_FIELDS = new Set([
  'durationMs', 'elapsedMs', 'payloadChars', 'chunkCount', 'previousChunkCount',
  'nativeCallCount', 'nativeFailureCount', 'fallbackCode', 'phaseCode', 'resultCode',
  'anchorCount', 'hydratedCount', 'sceneCount', 'waypointCount', 'cacheCount',
  'readParseDurationMs', 'verifyDurationMs', 'writeDurationMs', 'combinedDurationMs',
  'secureVerifyDurationMs', 'authAdapterWriteDurationMs', 'authHelperSettlementDurationMs',
  'authControlMaxDurationMs', 'authControlMinDurationMs', 'authWriteControlDeltaMs',
  'authControlSettlementMaxDurationMs', 'trial', 'trials', 'maxDurationMs', 'minDurationMs',
  'reasonCode', 'okCode', 'fixtureCount', 'payloadCharCount', 'p50Ms', 'p95Ms', 'maxMs',
  'sampleCount', 'over50Count', 'appComponentMountElapsedMs', 'secureReadEventCount',
  'secureWriteEventCount', 'fallbackCount',
]);

export function sanitizePerfDiagnostic(event: string, fields: Record<string, unknown>): Record<string, number> | null {
  if (!DIAGNOSTIC_EVENTS.has(event)) return null;
  const sanitized: Record<string, number> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (DIAGNOSTIC_NUMERIC_FIELDS.has(key) && typeof value === 'number' && Number.isFinite(value)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
