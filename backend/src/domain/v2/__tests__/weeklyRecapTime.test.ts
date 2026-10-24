import {
  addDaysToKey, finalizesAt, isMondayKey, latestRecapWeek, localDateKeyOf, localToUtc, mondayOfKey, phaseOfWeek,
  previewOpensAt, weekBounds, weekRangeLabel,
} from '../weeklyRecapTime';

const NY = 'America/New_York';

describe('week identity', () => {
  it('accepts only real Mondays', () => {
    expect(isMondayKey('2026-10-12')).toBe(true);
    expect(isMondayKey('2026-10-13')).toBe(false);
    expect(isMondayKey('2026-02-30')).toBe(false);
    expect(isMondayKey('not-a-date')).toBe(false);
  });
  it('finds the Monday across a year boundary', () => {
    expect(mondayOfKey('2027-01-01')).toBe('2026-12-28');
    expect(addDaysToKey('2026-12-28', 7)).toBe('2027-01-04');
  });
  it('labels ranges across months', () => {
    expect(weekRangeLabel('2026-10-12')).toBe('Oct 12 – 18');
    expect(weekRangeLabel('2026-10-26')).toBe('Oct 26 – Nov 1');
  });
});

describe('week bounds are half-open and DST-safe', () => {
  it('is 7*24h in a normal week', () => {
    const b = weekBounds('2026-10-12', NY);
    expect(b.endUtc.getTime() - b.startUtc.getTime()).toBe(7 * 86_400_000);
    expect(b.startUtc.toISOString()).toBe('2026-10-12T04:00:00.000Z'); // EDT
  });
  it('is 7*24h+1h when clocks go back (Nov 1 2026)', () => {
    const b = weekBounds('2026-10-26', NY);
    expect(b.endUtc.getTime() - b.startUtc.getTime()).toBe(7 * 86_400_000 + 3_600_000);
    expect(b.endUtc.toISOString()).toBe('2026-11-02T05:00:00.000Z'); // EST
    expect(localDateKeyOf(new Date(b.endUtc.getTime() - 1), NY)).toBe('2026-11-01');
    expect(localDateKeyOf(b.endUtc, NY)).toBe('2026-11-02');
  });
  it('is 7*24h-1h when clocks go forward (Mar 8 2026)', () => {
    const b = weekBounds('2026-03-02', NY);
    expect(b.endUtc.getTime() - b.startUtc.getTime()).toBe(7 * 86_400_000 - 3_600_000);
  });
  it('handles a nonexistent local time by moving past the gap', () => {
    const t = localToUtc('2026-03-08', 2, 30, NY);
    expect(localDateKeyOf(t, NY)).toBe('2026-03-08');
    expect(t.toISOString()).toBe('2026-03-08T07:30:00.000Z');
  });
  it('picks the earlier instant for an ambiguous local time', () => {
    expect(localToUtc('2026-11-01', 1, 30, NY).toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });
  it('supports half-hour and date-line zones', () => {
    expect(weekBounds('2026-10-12', 'Asia/Kolkata').startUtc.toISOString()).toBe('2026-10-11T18:30:00.000Z');
    expect(weekBounds('2026-10-12', 'Pacific/Auckland').startUtc.toISOString()).toBe('2026-10-11T11:00:00.000Z');
  });
  it('gives the same week different instants in different zones but the same keys', () => {
    expect(weekBounds('2026-10-12', NY).keys).toEqual(weekBounds('2026-10-12', 'Asia/Tokyo').keys);
    expect(weekBounds('2026-10-12', NY).startUtc.getTime()).not.toBe(weekBounds('2026-10-12', 'Asia/Tokyo').startUtc.getTime());
  });
});

describe('lifecycle: Sunday preview, Monday syncing, Tuesday noon final', () => {
  const week = '2026-10-12'; // Mon Oct 12 – Sun Oct 18
  const at = (iso: string) => new Date(iso);
  it('opens Sunday 19:00 local', () => {
    expect(previewOpensAt(week, NY).toISOString()).toBe('2026-10-18T23:00:00.000Z');
    expect(phaseOfWeek(week, at('2026-10-18T22:59:00Z'), NY)).toBe('NOT_YET');
    expect(phaseOfWeek(week, at('2026-10-18T23:00:00Z'), NY)).toBe('PREVIEW');
  });
  it('is syncing from Monday 00:00 until Tuesday 12:00 local', () => {
    expect(phaseOfWeek(week, at('2026-10-19T03:59:59Z'), NY)).toBe('PREVIEW');
    expect(phaseOfWeek(week, at('2026-10-19T04:00:00Z'), NY)).toBe('SYNCING');
    expect(finalizesAt(week, NY).toISOString()).toBe('2026-10-20T16:00:00.000Z');
    expect(phaseOfWeek(week, at('2026-10-20T15:59:59Z'), NY)).toBe('SYNCING');
    expect(phaseOfWeek(week, at('2026-10-20T16:00:00Z'), NY)).toBe('FINAL');
  });
  it('resolves "latest" at each stage', () => {
    expect(latestRecapWeek(at('2026-10-18T22:00:00Z'), NY)).toEqual({ weekKey: '2026-10-05', phase: 'FINAL' });
    expect(latestRecapWeek(at('2026-10-19T02:00:00Z'), NY)).toEqual({ weekKey: '2026-10-12', phase: 'PREVIEW' });
    expect(latestRecapWeek(at('2026-10-19T12:00:00Z'), NY)).toEqual({ weekKey: '2026-10-12', phase: 'SYNCING' });
    expect(latestRecapWeek(at('2026-10-21T12:00:00Z'), NY)).toEqual({ weekKey: '2026-10-12', phase: 'FINAL' });
  });
  it('uses the supplied zone, not UTC, to decide the stage', () => {
    // 2026-10-19T03:00Z is still Sunday evening in New York but already Monday in Tokyo.
    expect(latestRecapWeek(at('2026-10-19T03:00:00Z'), NY).phase).toBe('PREVIEW');
    expect(latestRecapWeek(at('2026-10-19T03:00:00Z'), 'Asia/Tokyo')).toEqual({ weekKey: '2026-10-12', phase: 'SYNCING' });
  });
  it('finalizes on the local Tuesday across a DST change', () => {
    expect(finalizesAt('2026-10-26', NY).toISOString()).toBe('2026-11-03T17:00:00.000Z'); // EST
  });
});
