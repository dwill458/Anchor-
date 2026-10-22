/**
 * Canonical notification threshold formatting and normalization utilities.
 *
 * Prevents 0.70 vs 70 ambiguity and ensures consistent 0-100% integer representation.
 */

export const DEFAULT_THREAD_STRENGTH_THRESHOLD = 70;

/**
 * Normalizes any threshold representation (float 0..1 or integer 0..100) into a canonical 0..100 integer.
 *
 * Examples:
 * - 0.7  -> 70
 * - 70   -> 70
 * - 0.5  -> 50
 * - 50   -> 50
 * - 1.0  -> 100
 * - 100  -> 100
 * - 0    -> 0
 */
export function normalizeThresholdValue(value: unknown): number {
  if (value == null || value === '') {
    return DEFAULT_THREAD_STRENGTH_THRESHOLD;
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return DEFAULT_THREAD_STRENGTH_THRESHOLD;
  }

  // Float representation (0 < value <= 1.0)
  if (num > 0 && num <= 1.0) {
    return Math.min(100, Math.max(0, Math.round(num * 100)));
  }

  return Math.min(100, Math.max(0, Math.round(num)));
}

/**
 * Formats a threshold value into a canonical percentage string (e.g. "70%").
 *
 * Guarantees that neither 0.7 nor 70 ever formats to "7000%".
 */
export function formatThresholdPercentage(value: unknown): string {
  const normalized = normalizeThresholdValue(value);
  return `${normalized}%`;
}
