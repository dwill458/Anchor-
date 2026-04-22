/**
 * Returns the "adjusted calendar date string" for a given timestamp.
 * Days run from 02:00 to 01:59 the following morning.
 * Sessions between midnight and 01:59 count toward the previous day.
 */
export function getAdjustedDateString(date: Date = new Date()): string {
  const adjusted = new Date(date.getTime() - 2 * 60 * 60 * 1000);
  return adjusted.toISOString().split('T')[0];
}
