/**
 * Anchor App - Practice Completion Coordinator
 *
 * Single source of truth for calculating post-practice Thread Strength results,
 * stage transitions, and view-model parameters for the Practice Complete finale.
 */

import type {
  ChartPracticeContext,
  PracticeCompleteResult,
  PracticeEntrySource,
  PracticeFlowReturnTarget,
  PracticeMode,
  PracticeSessionRecord,
} from '@/types/practice';
import {
  calculateThreadStrengthScore,
  selectCanonicalPracticeEvents,
  type ThreadStrengthSensitivity,
} from '@/utils/practiceMetrics';
import { getThreadStrengthState } from '@/utils/threadStrength';
import { eventMatchesAnchor } from '@/screens/weave/weaveData';
import { localDateKey } from '@/utils/practiceTime';

export interface CalculatePracticeCompleteResultParams {
  anchorId: string;
  anchorLocalId?: string | null;
  practiceMode: PracticeMode;
  practiceHistory: readonly PracticeSessionRecord[];
  accountId: string | null | undefined;
  completedSessionId: string;
  newRecord?: PracticeSessionRecord | null;
  sensitivity?: ThreadStrengthSensitivity;
  restDays?: readonly number[];
  now?: Date;
  returnTo?: 'vault' | 'practice' | 'detail' | 'chart' | 'reinforce';
  returnTarget?: PracticeFlowReturnTarget;
  source?: PracticeEntrySource;
  chartContext?: ChartPracticeContext;
}

/**
 * Authoritatively calculates previous & new Thread Strength, stage changes,
 * and first-practice flags for a specific Anchor after a completed session.
 */
export function calculatePracticeCompleteResult(
  params: CalculatePracticeCompleteResultParams,
): PracticeCompleteResult {
  const now = params.now ?? new Date();
  const today = localDateKey(now);
  const sensitivity = params.sensitivity ?? 'balanced';
  const restDays = params.restDays ?? [];

  const canonicalEvents = selectCanonicalPracticeEvents(
    params.practiceHistory,
    params.accountId,
    now,
  );

  const anchorAliases = [params.anchorId, params.anchorLocalId].filter(
    (id): id is string => Boolean(id),
  );

  // Events for this anchor strictly before the newly completed session
  const anchorEventsBefore = canonicalEvents.filter(
    (event) =>
      eventMatchesAnchor(event, anchorAliases) &&
      event.id !== params.completedSessionId,
  );

  const isFirstPractice = anchorEventsBefore.length === 0;

  const previousThreadStrength = isFirstPractice
    ? 0
    : calculateThreadStrengthScore(
        anchorEventsBefore,
        today,
        sensitivity,
        restDays,
      );

  // All events for this anchor including the newly completed session
  let anchorEventsAfter: PracticeSessionRecord[];
  if (
    params.newRecord &&
    !canonicalEvents.some((event) => event.id === params.newRecord?.id)
  ) {
    anchorEventsAfter = [...anchorEventsBefore, params.newRecord];
  } else {
    anchorEventsAfter = canonicalEvents.filter((event) =>
      eventMatchesAnchor(event, anchorAliases),
    );
  }

  const newThreadStrength = calculateThreadStrengthScore(
    anchorEventsAfter,
    today,
    sensitivity,
    restDays,
  );

  const previousStage = getThreadStrengthState(previousThreadStrength).label;
  const newStage = getThreadStrengthState(newThreadStrength).label;
  const didCrossStage = previousStage !== newStage;

  return {
    anchorId: params.anchorId,
    practiceMode: params.practiceMode,
    previousThreadStrength,
    newThreadStrength,
    previousStage,
    newStage,
    didCrossStage,
    isFirstPractice,
    returnTo: params.returnTo,
    returnTarget: params.returnTarget,
    source: params.source,
    chartContext: params.chartContext,
  };
}
