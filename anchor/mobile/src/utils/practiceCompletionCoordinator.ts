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
  previousPracticeHistory?: readonly PracticeSessionRecord[];
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

  const rawHistoryBefore = params.previousPracticeHistory ?? params.practiceHistory;
  const canonicalEventsBefore = selectCanonicalPracticeEvents(
    rawHistoryBefore,
    params.accountId,
    now,
  );

  const anchorAliases = [params.anchorId, params.anchorLocalId].filter(
    (id): id is string => Boolean(id),
  );

  const excludedIds = new Set(
    [params.completedSessionId, params.newRecord?.id].filter(
      (id): id is string => Boolean(id),
    ),
  );

  // Events for this anchor strictly before the newly completed session
  const anchorEventsBefore = canonicalEventsBefore.filter(
    (event) =>
      eventMatchesAnchor(event, anchorAliases) &&
      !excludedIds.has(event.id),
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
    !anchorEventsBefore.some((event) => event.id === params.newRecord?.id)
  ) {
    anchorEventsAfter = [...anchorEventsBefore, params.newRecord];
  } else {
    const canonicalEventsAfter = selectCanonicalPracticeEvents(
      params.practiceHistory,
      params.accountId,
      now,
    );
    anchorEventsAfter = canonicalEventsAfter.filter((event) =>
      eventMatchesAnchor(event, anchorAliases),
    );
    if (anchorEventsAfter.length === 0 && params.newRecord) {
      anchorEventsAfter = [params.newRecord];
    }
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

  const sameDaySessionsBefore = anchorEventsBefore.filter(
    (event) => event.localDateKey === today,
  ).length;
  const sameDayGainReduced = sameDaySessionsBefore > 0;

  return {
    anchorId: params.anchorId,
    practiceMode: params.practiceMode,
    previousThreadStrength,
    newThreadStrength,
    previousStage,
    newStage,
    didCrossStage,
    isFirstPractice,
    sameDayGainReduced,
    returnTo: params.returnTo,
    returnTarget: params.returnTarget,
    source: params.source,
    chartContext: params.chartContext,
  };
}
