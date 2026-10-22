import type { V2PracticeMode } from '@/constants/v2/practice';
import { getNextPractice, type NextPractice } from './nextPractice';
import type { V2HomeTodayState } from './useV2HomeModel';

const PRACTICE_ACTION_BY_MODE = {
  focus: 'Focus',
  deep_prime: 'Deep Prime',
  visualize: 'Visualize',
  release: 'Release',
} as const;

/** One session completed today for the selected Anchor. */
export type TodayCompletion = {
  id?: string;
  practiceMode: V2PracticeMode;
  completedDurationSeconds?: number;
};

export type TodayForDisplayInput = {
  /** The server-owned recommendation for the selected Anchor. */
  today: V2HomeTodayState;
  /** Today's completed sessions for that Anchor, newest first. */
  completed: readonly TodayCompletion[];
  hasVision: boolean;
  chartArcComplete: boolean;
  /** The saved session length for each mode, used when the card points at the next practice. */
  durationByMode: Record<'focus' | 'deep_prime' | 'visualize', number>;
};

/**
 * What Home's Today card shows: the server recommendation until something is completed today, then
 * the "done today" card pointing at the next practice (`getNextPractice`). Lifted out of the Home
 * screen unchanged so the card before and after a completion come from the same rules.
 */
export function buildTodayForDisplay(input: TodayForDisplayInput): V2HomeTodayState {
  const { today, completed, hasVision, chartArcComplete, durationByMode } = input;
  const completedMode = completed[0]?.practiceMode;
  const completedModes = new Set(completed.map((session) => session.practiceMode));
  const nextPractice: NextPractice | null = completedMode
    ? getNextPractice({ completedModes, hasVision, chartArcComplete })
    : null;
  const nextMode = nextPractice && nextPractice !== 'all_practices' ? nextPractice : null;
  const doneDuration = nextMode === 'release'
    ? undefined
    : nextMode
      ? today.state === 'ready' && today.mode === nextMode
        ? today.durationSeconds ?? durationByMode[nextMode]
        : durationByMode[nextMode]
      : undefined;
  if (!(completedMode && (today.state === 'ready' || nextMode || nextPractice === 'all_practices'))) return today;
  return {
    ...(today.state === 'ready' ? today : {
      state: 'ready' as const,
      mode: nextMode ?? 'focus',
      action: nextMode ? PRACTICE_ACTION_BY_MODE[nextMode] : 'Focus',
      reason: '',
      completionSignal: null,
      threadStrength: null,
      threadDelta: null,
      threadDeltaStatus: 'UNAVAILABLE' as const,
      durationSeconds: doneDuration,
    }),
    doneToday: {
      completedMode,
      nextMode,
      durationSeconds: doneDuration,
      completedDurationSeconds: completed[0]?.completedDurationSeconds,
    },
  };
}

/** The practice a Today card illustrates, or null when it shows no practice (loading, error, none). */
export function todayCardMode(card: V2HomeTodayState): V2PracticeMode | null {
  if (card.state !== 'ready') return null;
  return card.doneToday?.nextMode ?? card.mode;
}

export type TodaySwapPlan =
  | { changed: false }
  | { changed: true; fromMode: V2PracticeMode; toMode: V2PracticeMode; from: V2HomeTodayState };

/**
 * Whether finishing `sessionId` changed what Today recommends, and the card it showed before.
 * The card before is built by the same rules from the sessions completed today without this one.
 * A swap needs both cards to point at a practice and the two practices to differ; when either is
 * unknown, or the recommendation did not move, there is no swap and the new card simply stands.
 */
export function planTodaySwap(input: TodayForDisplayInput & { sessionId: string | null }): TodaySwapPlan {
  const { sessionId, ...rest } = input;
  if (sessionId === null) return { changed: false };
  const prior = rest.completed.filter((session) => session.id !== sessionId);
  // The session must actually be among today's completions, or it changed nothing on this card.
  if (prior.length === rest.completed.length) return { changed: false };
  const fromCard = buildTodayForDisplay({ ...rest, completed: prior });
  const toCard = buildTodayForDisplay(rest);
  const fromMode = todayCardMode(fromCard);
  const toMode = todayCardMode(toCard);
  if (!fromMode || !toMode || fromMode === toMode) return { changed: false };
  return { changed: true, fromMode, toMode, from: fromCard };
}
