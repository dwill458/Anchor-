export interface WeeklyInsightInput {
  totalPrimes: number;
  daysShownUp: number;
  threadGained: number;
  peakDayOfWeek?: string;
  peakTimeOfDay?: string;
  isFirstPrimeEver: boolean;
}

export function generateWeeklyInsight(input: WeeklyInsightInput): {
  line1: string;
  line2: string;
  highlightPhrase: string;
} {
  const {
    daysShownUp,
    threadGained,
    peakDayOfWeek,
    peakTimeOfDay,
    isFirstPrimeEver,
  } = input;

  if (isFirstPrimeEver) {
    return {
      line1: 'Every practitioner started with one prime.',
      line2: 'You just did.',
      highlightPhrase: 'one prime',
    };
  }

  if (daysShownUp === 7) {
    return {
      line1: 'Seven days. Seven primes.',
      line2: "The thread doesn't break when you refuse to let it.",
      highlightPhrase: 'refuse to let it',
    };
  }

  if (daysShownUp === 0) {
    return {
      line1: 'The intention was forged.',
      line2: 'That part holds regardless.',
      highlightPhrase: 'That part holds',
    };
  }

  if (daysShownUp === 1) {
    return {
      line1: 'One prime this week.',
      line2: 'The intention was still forged.',
      highlightPhrase: 'still forged',
    };
  }

  if (threadGained >= 60) {
    return {
      line1: `+${threadGained} thread in 7 days.`,
      line2: 'The anchor is holding.',
      highlightPhrase: 'The anchor is holding',
    };
  }

  if (threadGained < 0 && daysShownUp >= 3) {
    return {
      line1: 'The thread dipped this week.',
      line2: 'You still showed up. That counts.',
      highlightPhrase: 'That counts',
    };
  }

  if (peakDayOfWeek && peakTimeOfDay) {
    const phrase = `${peakDayOfWeek} ${peakTimeOfDay}s`;

    return {
      line1: `You prime most on ${phrase}.`,
      line2: "That's not habit yet — that's identity.",
      highlightPhrase: phrase,
    };
  }

  return {
    line1: 'Another week threaded.',
    line2: 'The practice accumulates.',
    highlightPhrase: 'accumulates',
  };
}
