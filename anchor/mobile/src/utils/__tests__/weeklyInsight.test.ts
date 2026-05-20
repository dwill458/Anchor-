import { generateWeeklyInsight, WeeklyInsightInput } from '../weeklyInsight';

describe('generateWeeklyInsight', () => {
  const baseInput: WeeklyInsightInput = {
    totalPrimes: 10,
    daysShownUp: 4,
    threadGained: 20,
    isFirstPrimeEver: false,
  };

  it('returns insight for first prime ever', () => {
    const input: WeeklyInsightInput = {
      ...baseInput,
      isFirstPrimeEver: true,
    };
    const result = generateWeeklyInsight(input);
    expect(result.line1).toBe('Every practitioner started with one prime.');
    expect(result.line2).toBe('You just did.');
    expect(result.highlightPhrase).toBe('one prime');
  });

  it('returns insight for 7 days shown up', () => {
    const input: WeeklyInsightInput = {
      ...baseInput,
      daysShownUp: 7,
    };
    const result = generateWeeklyInsight(input);
    expect(result.line1).toBe('Seven days. Seven primes.');
    expect(result.line2).toBe("The thread doesn't break when you refuse to let it.");
    expect(result.highlightPhrase).toBe('refuse to let it');
  });

  it('returns insight for 0 days shown up', () => {
    const input: WeeklyInsightInput = {
      ...baseInput,
      daysShownUp: 0,
    };
    const result = generateWeeklyInsight(input);
    expect(result.line1).toBe('The intention was forged.');
    expect(result.line2).toBe('That part holds regardless.');
    expect(result.highlightPhrase).toBe('That part holds');
  });

  it('returns insight for 1 day shown up', () => {
    const input: WeeklyInsightInput = {
      ...baseInput,
      daysShownUp: 1,
    };
    const result = generateWeeklyInsight(input);
    expect(result.line1).toBe('One prime this week.');
    expect(result.line2).toBe('The intention was still forged.');
    expect(result.highlightPhrase).toBe('still forged');
  });

  it('returns insight for high thread gained (>= 60)', () => {
    const input: WeeklyInsightInput = {
      ...baseInput,
      threadGained: 65,
    };
    const result = generateWeeklyInsight(input);
    expect(result.line1).toBe('+65 thread in 7 days.');
    expect(result.line2).toBe('The anchor is holding.');
    expect(result.highlightPhrase).toBe('The anchor is holding');
  });

  it('returns insight for negative thread and >= 3 days shown up', () => {
    const input: WeeklyInsightInput = {
      ...baseInput,
      threadGained: -10,
      daysShownUp: 3,
    };
    const result = generateWeeklyInsight(input);
    expect(result.line1).toBe('The thread dipped this week.');
    expect(result.line2).toBe('You still showed up. That counts.');
    expect(result.highlightPhrase).toBe('That counts');
  });

  it('returns insight for peak day and time when provided', () => {
    const input: WeeklyInsightInput = {
      ...baseInput,
      peakDayOfWeek: 'Tuesday',
      peakTimeOfDay: 'morning',
    };
    const result = generateWeeklyInsight(input);
    expect(result.line1).toBe('You prime most on Tuesday mornings.');
    expect(result.line2).toBe("That's not habit yet — that's identity.");
    expect(result.highlightPhrase).toBe('Tuesday mornings');
  });

  it('returns fallback insight when no other rules match', () => {
    const input: WeeklyInsightInput = {
      ...baseInput,
      daysShownUp: 2,
      threadGained: 10,
      peakDayOfWeek: undefined,
      peakTimeOfDay: undefined,
    };
    const result = generateWeeklyInsight(input);
    expect(result.line1).toBe('Another week threaded.');
    expect(result.line2).toBe('The practice accumulates.');
    expect(result.highlightPhrase).toBe('accumulates');
  });
});
