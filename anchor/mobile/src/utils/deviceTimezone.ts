/** Human-friendly summary of the device time zone, e.g. "Chicago (UTC−5)". */
export function deviceTimezoneSummary(now: Date = new Date()): string {
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    zone = '';
  }
  const city = zone.split('/').pop()?.replace(/_/g, ' ') ?? '';

  const offsetMinutes = -now.getTimezoneOffset();
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  const sign = offsetMinutes >= 0 ? '+' : '−';
  const offset = `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;

  return city ? `${city} (${offset})` : offset;
}
