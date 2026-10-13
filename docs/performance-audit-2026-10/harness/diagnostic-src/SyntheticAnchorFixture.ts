/** Canonical synthetic storage shape shared by the release adapter and motion probes. */
export const SYNTHETIC_ANCHOR_COUNT = 72;
export const SYNTHETIC_ANCHOR_OWNER_A = 'synthetic-account';
const TARGET_LARGE_CHARS = 719_217;

export function makeSyntheticAnchor(index: number) {
  const serial = String(index + 1).padStart(3, '0');
  return {
    id: `synthetic-anchor-${serial}`,
    localId: `synthetic-local-${serial}`,
    userId: SYNTHETIC_ANCHOR_OWNER_A,
    intentionText: `Synthetic intention fixture ${serial}; no real user writing.`,
    category: ['desire', 'health', 'career', 'creativity'][index % 4],
    distilledLetters: ['A', 'N', 'C'],
    baseSigilSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M${index % 40},10 L50,90 L${(index % 40) + 10},10 Z"/></svg>`,
    structureVariant: 'balanced',
    isCharged: index % 2 === 0,
    activationCount: index % 7,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
}

export function makePersistedFixture(count: 1 | 72): { value: string; payloadChars: number } {
  const anchors = Array.from({ length: count }, (_, index) => makeSyntheticAnchor(index));
  const persisted = {
    state: {
      anchors,
      totalPrimes: anchors.reduce((sum, anchor) => sum + anchor.activationCount, 0),
      primeStreak: 0,
      lastPrimedDate: null as string | null,
      lastSyncedAt: null as string | null,
      currentAnchorId: anchors[0]?.id,
    },
    version: 0,
  };
  let value = JSON.stringify(persisted);
  const targetChars = count === 1 ? 10_000 : TARGET_LARGE_CHARS;
  const delta = targetChars - value.length;
  if (delta < 0) throw new Error('synthetic fixture exceeds calibrated payload size');
  const base = Math.floor(delta / count);
  let remainder = delta % count;
  for (const anchor of anchors) {
    const amount = base + (remainder-- > 0 ? 1 : 0);
    const closePath = anchor.baseSigilSvg.lastIndexOf('"/>');
    const syntheticGeometry = ' M50 50 L51 51'.repeat(Math.floor(amount / 14));
    const geometryRemainder = ' '.repeat(amount % 14);
    anchor.baseSigilSvg = `${anchor.baseSigilSvg.slice(0, closePath)}${syntheticGeometry}${geometryRemainder}${anchor.baseSigilSvg.slice(closePath)}`;
  }
  value = JSON.stringify(persisted);
  if (value.length !== targetChars) throw new Error('synthetic fixture size calibration failed');
  return { value, payloadChars: value.length };
}

export interface CanonicalSynthetic72Result {
  ok: boolean;
  anchorCount: number;
  selectedSynthetic: boolean;
  primeState?: {
    totalPrimes: number;
    primeStreak: number;
    lastPrimedDate: string | null;
    lastSyncedAt: string | null;
  };
  currentAnchorId?: string;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

/**
 * Full, read-only validation for the 72-record fixture. It accepts only the
 * known runtime prime/sync counters and current selection to vary; all Anchor
 * fields, order, IDs, SVG bytes, and Account A ownership remain canonical.
 */
export function validateCanonicalSynthetic72(raw: string | null): CanonicalSynthetic72Result {
  const invalid: CanonicalSynthetic72Result = { ok: false, anchorCount: 0, selectedSynthetic: false };
  if (typeof raw !== 'string') return invalid;
  let actual: any;
  let expected: any;
  try {
    actual = JSON.parse(raw);
    expected = JSON.parse(makePersistedFixture(72).value);
  } catch {
    return invalid;
  }
  if (!actual || !sameKeys(actual, ['state', 'version']) || actual.version !== 0 || !actual.state || typeof actual.state !== 'object') return invalid;
  const state = actual.state;
  const expectedState = expected.state;
  const allowedStateKeys = ['anchors', 'totalPrimes', 'primeStreak', 'lastPrimedDate', 'lastSyncedAt', 'currentAnchorId'];
  if (!sameKeys(state, allowedStateKeys) || !Array.isArray(state.anchors) || state.anchors.length !== SYNTHETIC_ANCHOR_COUNT) return invalid;
  if (!Number.isSafeInteger(state.primeStreak) || state.primeStreak < 0 || state.primeStreak > 36500) return invalid;
  if (state.lastPrimedDate !== null && (typeof state.lastPrimedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(state.lastPrimedDate) || !Number.isFinite(Date.parse(`${state.lastPrimedDate}T00:00:00.000Z`)))) return invalid;
  if (state.lastSyncedAt !== null && !isIsoDate(state.lastSyncedAt)) return invalid;
  if (typeof state.currentAnchorId !== 'string' || !/^synthetic-anchor-\d{3}$/.test(state.currentAnchorId)) return invalid;

  for (let i = 0; i < SYNTHETIC_ANCHOR_COUNT; i++) {
    const anchor = state.anchors[i];
    const canonical = expectedState.anchors[i];
    if (!anchor || anchor.userId !== SYNTHETIC_ANCHOR_OWNER_A || !sameKeys(anchor, Object.keys(canonical))) return invalid;
    // Keep all fields byte-for-byte/primitive-for-primitive canonical. Focus
    // may update the prime counters above; it must not mutate Anchor records.
    if (JSON.stringify(anchor) !== JSON.stringify(canonical)) return invalid;
  }
  const totalPrimes = state.anchors.reduce((sum: number, anchor: any) => sum + anchor.activationCount, 0);
  if (!Number.isSafeInteger(state.totalPrimes) || state.totalPrimes !== totalPrimes) return invalid;
  return {
    ok: true,
    anchorCount: SYNTHETIC_ANCHOR_COUNT,
    selectedSynthetic: state.anchors.some((anchor: any) => anchor.id === state.currentAnchorId),
    primeState: {
      totalPrimes: state.totalPrimes,
      primeStreak: state.primeStreak,
      lastPrimedDate: state.lastPrimedDate,
      lastSyncedAt: state.lastSyncedAt,
    },
    currentAnchorId: state.currentAnchorId,
  };
}

function sameKeys(value: Record<string, unknown>, expectedKeys: string[]): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === expectedKeys.length && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key)));
}
