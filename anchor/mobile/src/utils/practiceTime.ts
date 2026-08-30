export const PRACTICE_SESSION_SCHEMA_VERSION = 2;

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function getCompletionTimeContext(date: Date = new Date()): {
  localDateKey: string;
  timeZone: string;
  utcOffsetMinutesAtCompletion: number;
} {
  let timeZone: string | null = null;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    // Handled by the internally consistent UTC fallback below.
  }
  if (!timeZone) {
    return {
      localDateKey: date.toISOString().slice(0, 10),
      timeZone: 'UTC',
      utcOffsetMinutesAtCompletion: 0,
    };
  }
  return {
    localDateKey: localDateKey(date),
    timeZone,
    // ISO-style offset: Chicago CST is -360, Tokyo JST is +540.
    utcOffsetMinutesAtCompletion: -date.getTimezoneOffset(),
  };
}

export function isValidLocalDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function stablePracticeFingerprint(parts: readonly unknown[]): string {
  const input = JSON.stringify(parts);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
