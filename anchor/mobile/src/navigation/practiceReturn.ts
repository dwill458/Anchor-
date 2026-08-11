import type {
  ChartPracticeCompletionHandoff,
  ChartPracticeContext,
  PracticeFlowReturnTarget,
} from '@/types/practice';

/**
 * Where a finished or abandoned practice session sends the user.
 *
 * This is the mirror of `startPractice()`: entry owns route construction, this
 * owns return construction. Keeping it a pure function means the Chart return
 * contract is testable without mounting a navigator, and means every ritual
 * screen resolves the destination the same way instead of growing its own
 * `if (returnTo === …)` chain.
 */
export type PracticeReturnTarget =
  | { kind: 'practice_home' }
  | {
    kind: 'chart_waypoint';
    courseId: string;
    waypointId: string;
    practiceReturn?: ChartPracticeCompletionHandoff;
  }
  | { kind: 'chart_home' }
  | { kind: 'anchor_detail'; anchorId: string }
  | { kind: 'vault' }
  | { kind: 'back' };

export interface ResolvePracticeReturnArgs {
  returnTo?: 'practice' | 'chart' | 'detail' | 'vault' | 'reinforce';
  /** Preferred serializable target for flows crossing independent tab stacks. */
  returnTarget?: PracticeFlowReturnTarget;
  anchorId?: string;
  chartContext?: ChartPracticeContext;
  /**
   * Chart is double-gated (build flag + server flag). If Chart has been turned
   * off while a session was running, the session must not strand the user on an
   * unreachable tab.
   */
  chartEnabled?: boolean;
  /** Present only after a canonical completion has been durably recorded. */
  practiceReturn?: ChartPracticeCompletionHandoff;
}

/**
 * A Chart-launched session returns to the waypoint it was launched from, so the
 * user lands back on the surface that holds the completion action rather than on
 * the Practice tab. `courseVersion` is deliberately not part of the target: the
 * waypoint detail screen re-reads authoritative Course state on focus, and a
 * version carried through a multi-minute session would be stale on arrival.
 */
export function resolvePracticeReturnTarget(
  args: ResolvePracticeReturnArgs,
): PracticeReturnTarget {
  const {
    returnTo,
    returnTarget,
    anchorId,
    chartContext,
    chartEnabled = true,
    practiceReturn,
  } = args;

  if (returnTarget) {
    switch (returnTarget.kind) {
      case 'practice':
        return { kind: 'practice_home' };
      case 'sanctuary':
        return { kind: 'vault' };
      case 'anchorDetail':
        return { kind: 'anchor_detail', anchorId: returnTarget.anchorId };
      case 'chart':
        // A non-Chart source cannot fabricate waypoint context.  Preserve the
        // safe chart-home fallback used by the legacy contract.
        return chartEnabled ? { kind: 'chart_home' } : { kind: 'practice_home' };
    }
  }

  if (returnTo === 'chart') {
    if (!chartEnabled) return { kind: 'practice_home' };
    if (chartContext) {
      return {
        kind: 'chart_waypoint',
        courseId: chartContext.courseId,
        waypointId: chartContext.waypointId,
        ...(practiceReturn ? { practiceReturn } : {}),
      };
    }
    return { kind: 'chart_home' };
  }

  if (returnTo === 'practice') return { kind: 'practice_home' };
  if (returnTo === 'detail') {
    return anchorId ? { kind: 'anchor_detail', anchorId } : { kind: 'back' };
  }
  if (returnTo === 'vault') return { kind: 'vault' };
  return { kind: 'back' };
}

/**
 * Completion-source label for the canonical practice ledger.
 *
 * Chart sessions are still `practice_screen` completions — Chart is an entry
 * surface, not a second completion pipeline — so this keeps the existing
 * `returnTo === 'practice'` mapping intact and only adds the Chart branch.
 */
export function resolvePracticeCompletionSource(
  returnTo?: 'practice' | 'chart' | 'detail' | 'vault' | 'reinforce',
): 'practice_screen' | 'anchor_detail' {
  return returnTo === 'practice' || returnTo === 'chart'
    ? 'practice_screen'
    : 'anchor_detail';
}
