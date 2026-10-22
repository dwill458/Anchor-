import type { V2ProgressInsight, V2ProgressRouteSummary, V2ProgressWeek } from './types';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export interface V2ProgressInsightInput {
  week: V2ProgressWeek;
  /** Real-world Moves completed this ISO week. */
  moves: number;
  route?: V2ProgressRouteSummary | null;
}

/** The longest run of practiced days this week, as "Tuesday–Thursday". Null under two days. */
export function strongestRunLabel(days: boolean[]): string | null {
  let best = { start: 0, length: 0 };
  let run = { start: 0, length: 0 };
  days.forEach((done, index) => {
    if (!done) {
      run = { start: index + 1, length: 0 };
      return;
    }
    run = { start: run.length === 0 ? index : run.start, length: run.length + 1 };
    if (run.length > best.length) best = { ...run };
  });
  if (best.length < 2) return null;
  return `${DAY_NAMES[best.start]}–${DAY_NAMES[best.start + best.length - 1]}`;
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * A deterministic read of the week, from practice days, Moves and the current
 * waypoint only. No service, no model: the same inputs give the same words.
 */
export function buildProgressInsight({ week, moves, route }: V2ProgressInsightInput): V2ProgressInsight {
  const activeDays = week.days.filter(Boolean).length;
  const moveText = plural(moves, 'real-world move');
  const progress = route && !route.isFinished ? route.currentMetric?.percentLabel : null;
  const hasRoute = Boolean(route && !route.isFinished);

  if (activeDays >= 4 && moves >= 1) {
    const run = strongestRunLabel(week.days);
    return {
      headline: 'Your rhythm strengthened this week.',
      support: `You practiced on ${activeDays} days and completed ${moveText}.${run ? ` Your strongest rhythm was ${run}.` : ''}`,
    };
  }

  if (activeDays >= 3 && moves === 0 && hasRoute) {
    return {
      headline: "You're practicing consistently, but movement slowed this week.",
      support: progress
        ? `Your next waypoint is still ${progress} complete. One Move can get things moving again.`
        : 'Your next waypoint is still ahead. One Move can get things moving again.',
    };
  }

  if (activeDays >= 3) {
    const run = strongestRunLabel(week.days);
    return {
      headline: 'Your practice rhythm held this week.',
      support: `You practiced on ${activeDays} days${moves > 0 ? ` and completed ${moveText}` : ''}.${run ? ` Your strongest rhythm was ${run}.` : ''}`,
    };
  }

  if (moves >= 1 && hasRoute) {
    return {
      headline: 'You moved toward your destination.',
      support: `You completed ${moveText}${progress ? ` and your next waypoint is ${progress} complete` : ''}. A few more practice days would steady the thread.`,
    };
  }

  if (activeDays >= 1) {
    return {
      headline: 'Your rhythm is still finding its shape.',
      support: `You practiced on ${plural(activeDays, 'day')} this week. One more day starts to make it a pattern.`,
    };
  }

  return {
    headline: 'This week is still open.',
    support: 'No practice yet. One short session starts the thread moving again.',
  };
}
