/**
 * Reminder time helpers. The reminder time is stored as local wall-clock
 * zero-padded `HH:mm` (24h) in `dailyPrimeTime`; the wheel works in 12-hour
 * parts. 12 AM is 00, 12 PM is 12.
 */
export type WheelTime = {
  /** 1-12 */
  hour12: number;
  /** 0-59 */
  minute: number;
  meridiem: 'AM' | 'PM';
};

const FALLBACK: WheelTime = { hour12: 9, minute: 0, meridiem: 'PM' };

const pad = (n: number): string => String(n).padStart(2, '0');

export const toHHmm = (t: WheelTime): string => {
  const base = t.hour12 % 12;
  const hour24 = t.meridiem === 'PM' ? base + 12 : base;
  return `${pad(hour24)}:${pad(t.minute)}`;
};

export const fromHHmm = (s: string): WheelTime => {
  const match = typeof s === 'string' ? /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(s) : null;
  if (!match) return { ...FALLBACK };
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  return {
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute,
    meridiem: hour24 >= 12 ? 'PM' : 'AM',
  };
};

/** "8:30 PM" or "20:30". */
export const formatDisplay = (s: string, use24h: boolean): string => {
  const t = fromHHmm(s);
  if (use24h) return toHHmm(t);
  return `${t.hour12}:${pad(t.minute)} ${t.meridiem}`;
};

export const deviceUses24Hour = (): boolean => {
  try {
    return Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 === false;
  } catch {
    return false;
  }
};
