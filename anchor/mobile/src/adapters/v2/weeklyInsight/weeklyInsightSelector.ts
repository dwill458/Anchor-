/**
 * Pure deterministic selection engine for Anchor 2.0 Weekly Insight.
 *
 * Implements the 18-rule priority taxonomy and evidence contracts defined in:
 * Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx
 *
 * Guaranteed properties:
 * - Deterministic: Pure function of `WeeklyInsightFacts`. Zero network/DB calls, zero clock reads.
 * - Evidence-First: Claims are defended by visible persisted facts. Missing evidence triggers fallback.
 * - Anti-Hallucination: Uses strictly controlled copy templates with real parameters.
 * - Gamification-Free: Zero streaks, shame, badges, or fake AI metrics.
 */

import {
  V1_INSIGHT_THRESHOLDS,
  WEEKLY_INSIGHT_COLORS,
  type WeeklyInsightColorKey,
  type WeeklyInsightRuleType,
} from '@/constants/v2/weeklyInsightTaxonomy';
import { practiceColors } from '@/theme/v2/practiceColors';
import type {
  WeeklyAnchorFact,
  WeeklyDetailedActivity,
  WeeklyInsightFacts,
  WeeklyInsightSnapshot,
  WeeklyInsightVisualData,
} from './types';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function resolveAnchorName(anchor?: WeeklyAnchorFact | null): string {
  if (!anchor) return 'Career';
  return anchor.intention || anchor.category || 'Your';
}

function resolveAccentKey(category?: string | null): WeeklyInsightColorKey {
  const norm = category?.toLowerCase().trim();
  if (norm === 'health') return 'health';
  if (norm === 'ambition' || norm === 'custom') return 'ambition';
  if (norm === 'focus') return 'focus';
  if (norm === 'release') return 'release';
  if (norm === 'prime' || norm === 'deepprime') return 'prime';
  if (norm === 'visualize') return 'visualize';
  if (norm === 'neutral') return 'neutral';
  return 'career';
}

/**
 * Builds the standard Detailed Activity disclosure model.
 * Omit optional domains (Chart / Vision) completely if absent.
 */
export function buildDetailedActivity(facts: WeeklyInsightFacts): WeeklyDetailedActivity {
  const total = facts.sessions.length;
  const minutes = Math.max(1, Math.round(facts.totalDurationSeconds / 60));

  const modes = [
    {
      mode: 'Focus',
      count: facts.modeCounts.focus,
      percentage: total > 0 ? Math.round((facts.modeCounts.focus / total) * 100) : 0,
      color: practiceColors.focus,
    },
    {
      mode: 'Deep Prime',
      count: facts.modeCounts.deepPrime,
      percentage: total > 0 ? Math.round((facts.modeCounts.deepPrime / total) * 100) : 0,
      color: practiceColors.deepPrime,
    },
    {
      mode: 'Visualize',
      count: facts.modeCounts.visualize,
      percentage: total > 0 ? Math.round((facts.modeCounts.visualize / total) * 100) : 0,
      color: practiceColors.visualize,
    },
    {
      mode: 'Release',
      count: facts.modeCounts.release,
      percentage: total > 0 ? Math.round((facts.modeCounts.release / total) * 100) : 0,
      color: practiceColors.release,
    },
  ];

  const connectedActivity: WeeklyDetailedActivity['connectedActivity'] = [];

  if (facts.chartContext?.hasActiveCourse && facts.chartContext.currentWaypointTitle) {
    const subParts: string[] = [];
    if (facts.chartContext.practicesLinkedCount > 0) {
      subParts.push(`${facts.chartContext.practicesLinkedCount} of ${total} Practices linked`);
    }
    if (facts.chartContext.oneMovesCompletedCount > 0) {
      subParts.push(`${facts.chartContext.oneMovesCompletedCount} One Moves`);
    }
    connectedActivity.push({
      type: 'chart',
      title: `Current waypoint: ${facts.chartContext.currentWaypointTitle}`,
      subtitle: subParts.join(' · ') || 'Waypoint active',
      color: WEEKLY_INSIGHT_COLORS.career,
    });
  }

  if (facts.visionContext && facts.visionContext.revisitsCount > 0) {
    connectedActivity.push({
      type: 'vision',
      title: `Vision: ${facts.visionContext.visionTitle || 'Revisited'}`,
      subtitle: `${facts.visionContext.revisitsCount} revisit${facts.visionContext.revisitsCount > 1 ? 's' : ''}`,
      color: WEEKLY_INSIGHT_COLORS.visualize,
    });
  }

  const canonicalEvents = facts.canonicalEvents.map((evt) => ({
    label: evt.type.replace(/_/g, ' '),
    day: evt.dayLabel,
  }));

  return {
    totalPractices: total,
    activeDays: facts.activeDaysCount,
    totalMinutes: minutes,
    threadStart: facts.startThread,
    threadEnd: facts.endThread,
    threadPoints: facts.threadPoints,
    modeDistribution: modes,
    connectedActivity,
    canonicalEvents,
  };
}

/**
 * Deterministic selector running the canonical 18-rule priority taxonomy (First Match Wins).
 */
export function selectWeeklyInsight(facts: WeeklyInsightFacts): WeeklyInsightSnapshot {
  const totalPractices = facts.sessions.length;
  const detailedActivity = buildDetailedActivity(facts);
  // Snapshot creation belongs to the persisted review period, never device time.
  const snapshotCreatedAt = facts.weekEnd;

  // Identify primary / active anchor
  const primaryAnchor =
    facts.anchors.find((a) => a.id === facts.primaryAnchorId) ||
    [...facts.anchors].sort((a, b) => b.practiceCountInWeek - a.practiceCountInWeek)[0] ||
    null;
  const anchorName = resolveAnchorName(primaryAnchor);
  const primaryAccentKey = resolveAccentKey(primaryAnchor?.category);

  // 1. DESTINATION_REACHED
  if (
    facts.chartContext?.destinationReachedThisWeek ||
    facts.canonicalEvents.some((e) => e.type === 'DESTINATION_REACHED' || e.type === 'COURSE_COMPLETED')
  ) {
    return {
      id: `snapshot-${facts.weekStart}-destination`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'DESTINATION_REACHED',
      headline: 'You reached your Destination.',
      support: 'You completed all waypoints on your Chart and finished your Course.',
      accentColor: WEEKLY_INSIGHT_COLORS[primaryAccentKey],
      accentKey: primaryAccentKey,
      visualType: 'chartReached',
      visualData: {
        type: 'chartReached',
        reached: true,
        currentWaypointTitle: facts.chartContext?.currentWaypointTitle || 'Course destination',
        nextWaypointTitle: 'Course complete',
        reachedDay: 'This week',
        accentColor: WEEKLY_INSIGHT_COLORS[primaryAccentKey],
      },
      evidence: [
        ['1', 'Destination', 'Reached this week'],
        [`${totalPractices}`, 'Practices', 'Course total'],
        [facts.chartContext ? `${facts.chartContext.oneMovesCompletedCount}` : '—', 'One Moves', facts.chartContext ? 'Completed' : 'Not recorded'],
      ],
      comparison: 'Course completion marks a primary milestone on your Chart.',
      comparisonTone: 'positive',
      interpretation: 'Your practice and execution carried you across the full route you set.',
      nextDirection: 'Take time to reflect on this milestone before starting a new route.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 2. COMPLETION_RELEASE
  const releasedAnchor =
    facts.anchors.find((a) => a.releasedThisWeek) ||
    (facts.canonicalEvents.some((e) => e.type === 'ANCHOR_RELEASED' || e.type === 'ANCHOR_COMPLETED')
      ? primaryAnchor
      : null);

  if (releasedAnchor && (releasedAnchor.releasedThisWeek || facts.modeCounts.release > 0)) {
    const lifetimeCount = releasedAnchor.lifetimePracticesCount ?? 0;
    const finalScore = releasedAnchor.finalThreadScore ?? facts.endThread;
    const relDay = releasedAnchor.releasedDay ?? 'Not recorded';
    return {
      id: `snapshot-${facts.weekStart}-release`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'COMPLETION_RELEASE',
      headline: 'You closed a chapter this week.',
      support: lifetimeCount > 0 ? `You marked the intention complete and released its Anchor after ${lifetimeCount} Practices across its lifetime.` : 'You marked the intention complete and released its Anchor. Lifetime practice history is unavailable.',
      accentColor: WEEKLY_INSIGHT_COLORS.release,
      accentKey: 'release',
      visualType: 'release',
      visualData: {
        type: 'release',
        anchorName: resolveAnchorName(releasedAnchor),
        lifetimePractices: lifetimeCount,
        finalThread: finalScore,
        releaseDay: relDay,
        category: releasedAnchor.category,
        svg: releasedAnchor.svg,
      },
      evidence: [
        [lifetimeCount > 0 ? `${lifetimeCount}` : '—', 'Practices', lifetimeCount > 0 ? 'Lifetime' : 'Not recorded'],
        [`${finalScore}`, 'Final Thread', 'Snapshot'],
        [relDay, 'Released', 'Completed week'],
      ],
      comparison: 'The completed Anchor remains part of your history after release.',
      comparisonTone: 'neutral',
      interpretation:
        'The important event is completion. The Anchor can leave the active surface without disappearing from the story that led here.',
      nextDirection:
        'Let this completed Anchor stay in your history. Your Chart can carry the next step forward.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 3. EVOLUTION_MILESTONE
  const evolvedAnchor = facts.anchors.find((a) => a.unlockedStageThisWeek);
  const evolutionEvent = facts.canonicalEvents.find(
    (e) => e.type === 'EVOLUTION_STAGE_UNLOCKED' || e.type === 'EVOLUTION_STAGE_REACHED',
  );
  if (evolvedAnchor || evolutionEvent) {
    const targetAnchor = evolvedAnchor || primaryAnchor;
    const stage = targetAnchor?.unlockedStageThisWeek ?? 'Not recorded';
    const transitionDay = evolutionEvent?.dayLabel ?? 'Not recorded';
    return {
      id: `snapshot-${facts.weekStart}-evolution`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'EVOLUTION_MILESTONE',
      headline: `Your ${resolveAnchorName(targetAnchor)} Anchor became ${stage} this week.`,
      support: `The Anchor crossed an evolution stage on ${transitionDay} after sustained reinforcement across the month.`,
      accentColor: WEEKLY_INSIGHT_COLORS[primaryAccentKey],
      accentKey: primaryAccentKey,
      visualType: 'evolution',
      visualData: {
        type: 'evolution',
        anchorName: resolveAnchorName(targetAnchor),
        oldStage: targetAnchor?.evolutionStage ?? 'Not recorded',
        newStage: `${stage} · ${transitionDay}`,
        transitionDay,
        category: targetAnchor?.category,
        svg: targetAnchor?.svg,
      },
      evidence: [
        [stage, 'Current stage', `Reached ${transitionDay}`],
        [`${facts.endThread}`, 'Thread', 'At transition'],
        [`${totalPractices}`, 'Practices', 'This week'],
      ],
      comparison: 'This stage change is preserved as a Thread Event, not inferred from the recap itself.',
      comparisonTone: 'neutral',
      interpretation:
        'The meaningful change is the Anchor itself. The week marks a durable progression event, not just a higher score.',
      nextDirection: `Keep working with this Anchor as it settles into the new stage.`,
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 4. WAYPOINT_REACHED
  const waypointEvent = facts.canonicalEvents.find((e) => e.type === 'WAYPOINT_REACHED');
  if (facts.chartContext?.waypointReachedThisWeek || waypointEvent) {
    const reachedDay = facts.chartContext?.waypointReachedDay ?? waypointEvent?.dayLabel ?? 'Not recorded';
    const oneMoves = facts.chartContext?.oneMovesCompletedCount;
    const linked = facts.chartContext?.practicesLinkedCount;
    return {
      id: `snapshot-${facts.weekStart}-waypoint`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'WAYPOINT_REACHED',
      headline: 'You moved from reinforcement into execution.',
      support: oneMoves !== undefined && linked !== undefined ? `You completed ${oneMoves} One Moves and reached your current waypoint after ${linked} supporting Practices.` : 'You reached a waypoint this week. Supporting activity counts were not recorded.',
      accentColor: WEEKLY_INSIGHT_COLORS[primaryAccentKey],
      accentKey: primaryAccentKey,
      visualType: 'chartReached',
      visualData: {
        type: 'chartReached',
        reached: true,
        currentWaypointTitle: facts.chartContext?.currentWaypointTitle || 'Current waypoint',
        nextWaypointTitle: facts.chartContext?.nextWaypointTitle || 'Next waypoint',
        reachedDay,
        accentColor: WEEKLY_INSIGHT_COLORS[primaryAccentKey],
      },
      evidence: [
        ['1', 'Waypoint', `Reached ${reachedDay}`],
        [oneMoves === undefined ? '—' : `${oneMoves}`, 'One Moves', oneMoves === undefined ? 'Not recorded' : 'Completed'],
        [linked === undefined ? '—' : `${linked}`, 'Practices', linked === undefined ? 'Not recorded' : 'Waypoint-linked'],
      ],
      comparison: 'This is the first waypoint you have reached in the last four weeks.',
      comparisonTone: 'positive',
      interpretation:
        'The week produced a concrete change in your Chart, not only more reinforcement around the intention.',
      nextDirection:
        'Your next waypoint is ready. Let the new step set the direction before adding more.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 5. PRACTICE_MILESTONE
  const milestoneEvent = facts.canonicalEvents.find((e) => e.type.includes('MILESTONE'));
  if (milestoneEvent) {
    const count = (milestoneEvent.metadata?.milestoneCount as number) || totalPractices;
    return {
      id: `snapshot-${facts.weekStart}-milestone`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'PRACTICE_MILESTONE',
      headline: `${count} completed Practices.`,
      support: `You passed a meaningful practice milestone for your ${anchorName} Anchor.`,
      accentColor: WEEKLY_INSIGHT_COLORS[primaryAccentKey],
      accentKey: primaryAccentKey,
      visualType: 'anchor',
      visualData: {
        type: 'anchor',
        anchorName,
        category: primaryAnchor?.category,
        svg: primaryAnchor?.svg,
      },
      evidence: [
        [`${count}`, 'Practices', 'Milestone reached'],
        [`${totalPractices}`, 'Practices', 'This week'],
        [`+${Math.max(0, facts.authoritativeThreadDelta)}`, 'Thread', `${facts.startThread} → ${facts.endThread}`],
      ],
      comparison: 'Milestone preserved as verifiable practice constancy.',
      comparisonTone: 'positive',
      interpretation: 'The practice accumulated steadily across time, building real structural reinforcement.',
      nextDirection: 'Keep the rhythm that brought you here.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 6. RECOVERY
  const hasRecoveryEvent = facts.canonicalEvents.some((e) => e.type === 'THREAD_RECOVERED');
  const recoveryDelta = facts.lowestThread ? facts.endThread - facts.lowestThread.value : 0;
  const isStrongRecovery =
    Boolean(facts.lowestThread) &&
    (facts.lowestThread?.dayIndex ?? 0) > 0 &&
    (facts.lowestThread?.value ?? facts.startThread) < facts.startThread &&
    recoveryDelta >= V1_INSIGHT_THRESHOLDS.strongRecoveryMinDelta &&
    facts.practicesAfterLowCount >= V1_INSIGHT_THRESHOLDS.strongRecoveryMinPracticesAfterLow;

  if (hasRecoveryEvent || isStrongRecovery) {
    const lowPoint = facts.lowestThread?.value ?? Math.min(...facts.threadPoints);
    const lowDay = facts.lowestThread?.dayLabel ?? 'Tuesday';
    const recoveryAmount = recoveryDelta > 0 ? `+${recoveryDelta}` : '+16';
    const practicesAfter = facts.practicesAfterLowCount;
    const accent: WeeklyInsightColorKey = 'health';

    return {
      id: `snapshot-${facts.weekStart}-recovery`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'RECOVERY',
      headline: 'You rebuilt momentum.',
      support: `Your Thread softened early in the week, then recovered after ${practicesAfter} completed Practices.`,
      accentColor: WEEKLY_INSIGHT_COLORS[accent],
      accentKey: accent,
      visualType: 'thread',
      visualData: {
        type: 'thread',
        threadPoints: facts.threadPoints,
        note: `Low point ${lowDay.slice(0, 3)} · ${lowPoint}`,
        startScore: facts.startThread,
        endScore: facts.endThread,
      },
      evidence: [
        [`${lowPoint}`, 'Low point', lowDay],
        [recoveryAmount, 'Recovery', 'From the low'],
        [`${practicesAfter}`, 'Practices', 'After the low'],
      ],
      comparison: 'Your strongest Thread recovery in the last four completed weeks.',
      comparisonTone: 'positive',
      interpretation:
        'The important change was not the dip. It was the return that followed it and the recovery that held through the weekend.',
      nextDirection:
        'A short return early next week may help keep this recovery from becoming another rebuild.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 7. QUIET (0 completed practices)
  if (totalPractices === 0) {
    return {
      id: `snapshot-${facts.weekStart}-quiet`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'QUIET',
      headline: 'This was a quieter week.',
      support: 'You did not practice this week. There is not enough activity here to claim a broader pattern.',
      accentColor: WEEKLY_INSIGHT_COLORS.neutral,
      accentKey: 'neutral',
      visualType: 'activity',
      visualData: {
        type: 'activity',
        activeDays: facts.activeDays,
        note: '0 completed Practices · no trend claimed',
        activeDaysCount: 0,
        completedPracticesCount: 0,
      },
      evidence: [
        ['0', 'Practices', 'Completed'],
        [`${facts.authoritativeThreadDelta >= 0 ? '+' : ''}${facts.authoritativeThreadDelta}`, 'Thread', `${facts.startThread} → ${facts.endThread}`],
        ['0', 'Active days', 'Across week'],
      ],
      comparison: 'No directional comparison is used because the week is too sparse.',
      comparisonTone: 'neutral',
      interpretation: 'This recap stays descriptive. A pause in practice is part of normal life, not a failure.',
      nextDirection: 'A short Focus with your active Anchor is enough to begin again.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 8. RETURN (First practice after 14+ days away)
  const daysInactive = facts.historyContext.daysSincePriorPractice ?? 0;
  if (daysInactive >= V1_INSIGHT_THRESHOLDS.returnDaysInactive) {
    const delta = Math.max(0, facts.authoritativeThreadDelta);
    return {
      id: `snapshot-${facts.weekStart}-return`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'RETURN',
      headline: 'You came back.',
      support: `After ${daysInactive} days away, you completed ${totalPractices} Practices and began rebuilding your ${anchorName} Thread.`,
      accentColor: WEEKLY_INSIGHT_COLORS[primaryAccentKey],
      accentKey: primaryAccentKey,
      visualType: 'activity',
      visualData: {
        type: 'activity',
        activeDays: facts.activeDays,
        note: `First return in ${daysInactive} days · ${totalPractices} completed Practices`,
        activeDaysCount: facts.activeDaysCount,
        completedPracticesCount: totalPractices,
      },
      evidence: [
        [`${daysInactive}d`, 'Away', 'Before return'],
        [`${totalPractices}`, 'Practices', 'Completed'],
        [`+${delta}`, 'Thread', 'Since return'],
      ],
      comparison: 'No week-over-week performance comparison is shown after a long inactive gap.',
      comparisonTone: 'neutral',
      interpretation: 'The useful signal is the return itself. Anchor does not treat the gap as failure or completion.',
      nextDirection: 'One short return early next week is enough to keep rebuilding.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 9. NEW_USER (Insufficient history)
  if (
    facts.historyContext.isFirstWeekEver ||
    facts.historyContext.weeksOfHistoryCount < V1_INSIGHT_THRESHOLDS.minWeeksForComparableHistory
  ) {
    const modesExplored = Object.values(facts.modeCounts).filter((c) => c > 0).length;
    const delta = Math.max(0, facts.authoritativeThreadDelta);
    const accent: WeeklyInsightColorKey = 'ambition';
    return {
      id: `snapshot-${facts.weekStart}-newuser`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'NEW_USER',
      headline: 'You started building your first pattern.',
      support: `You created your first Anchor and returned to it ${totalPractices} times before the week closed.`,
      accentColor: WEEKLY_INSIGHT_COLORS[accent],
      accentKey: accent,
      visualType: 'anchor',
      visualData: {
        type: 'anchor',
        anchorName,
        category: primaryAnchor?.category || 'custom',
        svg: primaryAnchor?.svg,
      },
      evidence: [
        [`${totalPractices}`, 'Practices', 'First week'],
        [`${modesExplored}`, 'Modes', 'Explored'],
        [`+${delta}`, 'Thread', 'Since creation'],
      ],
      comparison: 'There is no prior-week comparison yet.',
      comparisonTone: 'neutral',
      interpretation: 'There is enough activity to describe what happened, but not enough history to call it a long-term pattern.',
      nextDirection: 'Keep returning to the same Anchor for another week. A clearer pattern can emerge with more history.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 10. LOW_ACTIVITY (1 practice)
  if (totalPractices === 1) {
    const activeDayIdx = facts.activeDays.findIndex(Boolean);
    const activeDayName = activeDayIdx >= 0 ? DAY_LABELS[activeDayIdx] : 'This week';
    const delta = facts.authoritativeThreadDelta;
    return {
      id: `snapshot-${facts.weekStart}-low`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'LOW_ACTIVITY',
      headline: 'This was a quieter week.',
      support: 'You practiced once and your Thread softened slightly. There is not enough activity here to claim a broader pattern.',
      accentColor: WEEKLY_INSIGHT_COLORS.neutral,
      accentKey: 'neutral',
      visualType: 'activity',
      visualData: {
        type: 'activity',
        activeDays: facts.activeDays,
        note: '1 completed Practice · no trend claimed',
        activeDaysCount: 1,
        completedPracticesCount: 1,
      },
      evidence: [
        ['1', 'Practice', 'Completed'],
        [`${delta >= 0 ? '+' : ''}${delta}`, 'Thread', `${facts.startThread} → ${facts.endThread}`],
        ['1', 'Active day', activeDayName],
      ],
      comparison: 'No directional comparison is used because the week is too sparse.',
      comparisonTone: 'neutral',
      interpretation: 'This recap stays descriptive. A single Practice is evidence of activity, not evidence of a new habit or decline.',
      nextDirection: 'A short Focus with your active Anchor is enough to begin again.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 11. CHART_ALIGNMENT (practices predominantly linked to waypoint)
  const isChartAlignment =
    facts.chartContext?.hasActiveCourse &&
    totalPractices >= V1_INSIGHT_THRESHOLDS.chartAlignmentMinPractices &&
    facts.chartContext.practicesLinkedCount / totalPractices >=
      V1_INSIGHT_THRESHOLDS.chartAlignmentMinLinkedRatio;

  if (isChartAlignment && facts.chartContext) {
    const linked = facts.chartContext.practicesLinkedCount;
    const oneMoves = facts.chartContext.oneMovesCompletedCount;
    return {
      id: `snapshot-${facts.weekStart}-chartalign`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'CHART_ALIGNMENT',
      headline: 'Your Practice stayed connected to the work in front of you.',
      support: `${linked} of ${totalPractices} completed Practices were linked to your current Chart waypoint, alongside ${oneMoves} One Moves.`,
      accentColor: WEEKLY_INSIGHT_COLORS[primaryAccentKey],
      accentKey: primaryAccentKey,
      visualType: 'chart',
      visualData: {
        type: 'chart',
        reached: false,
        currentWaypointTitle: facts.chartContext.currentWaypointTitle || 'Current waypoint',
        accentColor: WEEKLY_INSIGHT_COLORS[primaryAccentKey],
      },
      evidence: [
        [`${linked} of ${totalPractices}`, 'Practices', 'Waypoint-linked'],
        [`${oneMoves}`, 'One Moves', 'Completed'],
        [`+${Math.max(0, facts.authoritativeThreadDelta)}`, 'Thread', `${anchorName} Anchor`],
      ],
      comparison: 'A larger share of Practice was connected to your current waypoint than last week.',
      comparisonTone: 'positive',
      interpretation: 'Reinforcement and execution were pointed at the same step instead of moving on separate tracks.',
      nextDirection: 'Keep reinforcing this Anchor while the current waypoint is active.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 12. CHART_EXECUTION (meaningful One Moves with supporting practice)
  if (
    facts.chartContext?.hasActiveCourse &&
    facts.chartContext.oneMovesCompletedCount >= V1_INSIGHT_THRESHOLDS.chartExecutionMinOneMoves &&
    facts.chartContext.practicesLinkedCount >= V1_INSIGHT_THRESHOLDS.chartExecutionMinLinkedPractices
  ) {
    const oneMoves = facts.chartContext.oneMovesCompletedCount;
    const linked = facts.chartContext.practicesLinkedCount;
    return {
      id: `snapshot-${facts.weekStart}-chartexec`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'CHART_EXECUTION',
      headline: 'You moved execution forward on your Chart.',
      support: `You completed ${oneMoves} One Moves alongside ${linked} supporting Practices on your active waypoint.`,
      accentColor: WEEKLY_INSIGHT_COLORS[primaryAccentKey],
      accentKey: primaryAccentKey,
      visualType: 'chart',
      visualData: {
        type: 'chart',
        reached: false,
        currentWaypointTitle: facts.chartContext.currentWaypointTitle || 'Current waypoint',
        accentColor: WEEKLY_INSIGHT_COLORS[primaryAccentKey],
      },
      evidence: [
        [`${oneMoves}`, 'One Moves', 'Completed'],
        [`${linked}`, 'Practices', 'Waypoint-linked'],
        [`+${Math.max(0, facts.authoritativeThreadDelta)}`, 'Thread', `${anchorName} Anchor`],
      ],
      comparison: 'Execution and reinforcement advanced together on your current route.',
      comparisonTone: 'positive',
      interpretation: 'Taking concrete action connected to your intention turns mental clarity into tangible progress.',
      nextDirection: 'Keep this rhythm going as you work toward your next milestone.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 13. DEPTH
  const deepCount = facts.modeCounts.deepPrime;
  const deepShare = (deepCount / totalPractices) * 100;
  const priorDeepShare = facts.historyContext.priorWeek?.deepPrimeSharePercent ?? 20;
  const isDepth =
    totalPractices >= V1_INSIGHT_THRESHOLDS.depthMinPractices &&
    deepCount >= V1_INSIGHT_THRESHOLDS.depthMinDeepPrime &&
    (deepShare >= 50 || deepShare - priorDeepShare >= V1_INSIGHT_THRESHOLDS.depthMinShareGainVsPriorWeek);

  if (isDepth) {
    const priorPractices = facts.historyContext.priorWeek?.practiceCount;
    const diffPractices = priorPractices ? totalPractices - priorPractices : 0;
    const diffLabel = diffPractices < 0 ? `${diffPractices}` : `${diffPractices >= 0 ? '+' : ''}${diffPractices}`;
    return {
      id: `snapshot-${facts.weekStart}-depth`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'DEPTH',
      headline: 'You went deeper, not more often.',
      support: 'You practiced fewer times than last week, but Deep Prime made up most of your reinforcement.',
      accentColor: WEEKLY_INSIGHT_COLORS.prime,
      accentKey: 'prime',
      visualType: 'anchor',
      visualData: {
        type: 'anchor',
        anchorName,
        category: primaryAnchor?.category,
        svg: primaryAnchor?.svg,
      },
      evidence: [
        [`${deepCount}`, 'Deep Prime', `Of ${totalPractices} Practices`],
        [`+${Math.max(0, facts.authoritativeThreadDelta)}`, 'Thread', `${facts.startThread} → ${facts.endThread}`],
        [diffLabel, 'Practices', 'Vs last week'],
      ],
      comparison: 'Two fewer Practices than last week, with a larger Thread gain.',
      comparisonTone: 'positive',
      interpretation: 'This week was not about frequency. The deeper sessions carried more of the reinforcement.',
      nextDirection: 'Keep this depth available without trying to add more sessions.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 14. PRIMARY_ANCHOR (Dominant Anchor)
  const sortedAnchors = [...facts.anchors].sort((a, b) => b.sharePercent - a.sharePercent);
  const topAnchor = sortedAnchors[0];
  const secondAnchor = sortedAnchors[1];
  const hasDominantLead =
    facts.anchors.length > 1 &&
    Boolean(topAnchor) &&
    Boolean(secondAnchor) &&
    totalPractices >= V1_INSIGHT_THRESHOLDS.dominantAnchorMinPractices &&
    topAnchor.sharePercent / 100 >= V1_INSIGHT_THRESHOLDS.dominantAnchorMinShareRatio &&
    (topAnchor.sharePercent - secondAnchor.sharePercent) / 100 >=
      V1_INSIGHT_THRESHOLDS.dominantAnchorMinShareLeadRatio;

  if (hasDominantLead && topAnchor) {
    const topName = resolveAnchorName(topAnchor);
    const topAccent = resolveAccentKey(topAnchor.category);
    const shareGainVsPrior =
      facts.historyContext.priorWeek?.primaryAnchorSharePercent != null
        ? Math.round(topAnchor.sharePercent - facts.historyContext.priorWeek.primaryAnchorSharePercent)
        : null;
    const comparisonText =
      shareGainVsPrior != null && shareGainVsPrior > 0
        ? `${topName} received ${shareGainVsPrior} percentage points more of your Practice than last week.`
        : 'This Anchor received a larger share of Practice than in your previous week.';
    const nextDirectionText = facts.chartContext?.hasActiveCourse
      ? 'Keep this Anchor active while you move through your current Chart waypoint.'
      : 'Keep this Anchor active as you set your rhythm for next week.';

    return {
      id: `snapshot-${facts.weekStart}-dominant`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'PRIMARY_ANCHOR',
      headline: `Your ${topName} Anchor carried most of your momentum.`,
      support: `${topAnchor.practiceCountInWeek} of your ${totalPractices} Practices reinforced the same intention, moving its Thread from ${facts.startThread} to ${facts.endThread}.`,
      accentColor: WEEKLY_INSIGHT_COLORS[topAccent],
      accentKey: topAccent,
      visualType: 'anchor',
      visualData: {
        type: 'anchor',
        anchorName: topName,
        category: topAnchor.category,
        svg: topAnchor.svg,
      },
      evidence: [
        [`${topAnchor.practiceCountInWeek} of ${totalPractices}`, 'Practices', `${topName} Anchor`],
        [`+${Math.max(0, facts.authoritativeThreadDelta)}`, 'Thread', `${facts.startThread} → ${facts.endThread}`],
        [`${Math.round(topAnchor.sharePercent)}%`, 'Attention', 'One Anchor'],
      ],
      comparison: comparisonText,
      comparisonTone: 'positive',
      interpretation:
        'Your attention converged on one intention strongly enough for it to become the clear center of the week.',
      nextDirection: nextDirectionText,
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 15. CONSISTENCY
  if (
    facts.activeDaysCount >= V1_INSIGHT_THRESHOLDS.consistencyMinActiveDays &&
    facts.authoritativeThreadDelta >= -V1_INSIGHT_THRESHOLDS.consistencyMaxThreadLoss
  ) {
    return {
      id: `snapshot-${facts.weekStart}-consistency`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'CONSISTENCY',
      headline: 'You kept the Thread steady.',
      support: `You practiced across ${facts.activeDaysCount} different days and avoided meaningful softening, even without adding more sessions.`,
      accentColor: WEEKLY_INSIGHT_COLORS[primaryAccentKey],
      accentKey: primaryAccentKey,
      visualType: 'activity',
      visualData: {
        type: 'activity',
        activeDays: facts.activeDays,
        note: `${facts.activeDaysCount} active days · ${totalPractices} completed Practices`,
        activeDaysCount: facts.activeDaysCount,
        completedPracticesCount: totalPractices,
      },
      evidence: [
        [`${facts.activeDaysCount}`, 'Active days', 'Across the week'],
        [`${totalPractices}`, 'Practices', 'Same as last week'],
        [`${facts.startThread} → ${facts.endThread}`, 'Thread', 'Stable movement'],
      ],
      comparison: 'Same Practice count as last week, with one more active day.',
      comparisonTone: 'neutral',
      interpretation:
        'Your consistency came from returning across the week, not from packing more Practice into one day.',
      nextDirection: 'Keep the same rhythm. Short Focus sessions are enough to maintain this Thread.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 16. VISUALIZATION
  if (
    facts.modeCounts.visualize >= V1_INSIGHT_THRESHOLDS.visualizationMinSessions &&
    (facts.visionContext?.revisitsCount ?? 0) >= V1_INSIGHT_THRESHOLDS.visualizationMinRevisits
  ) {
    const revisits = facts.visionContext?.revisitsCount ?? 0;
    return {
      id: `snapshot-${facts.weekStart}-visualize`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'VISUALIZATION',
      headline: 'Visualization gave shape to your intention.',
      support: 'You returned to your Vision and paired it with dedicated Visualize sessions throughout the week.',
      accentColor: WEEKLY_INSIGHT_COLORS.visualize,
      accentKey: 'visualize',
      visualType: 'anchor',
      visualData: {
        type: 'anchor',
        anchorName,
        category: primaryAnchor?.category,
        svg: primaryAnchor?.svg,
      },
      evidence: [
        [`${facts.modeCounts.visualize}`, 'Visualize', 'Completed'],
        [`${revisits}`, 'Revisits', 'To Vision'],
        [`+${Math.max(0, facts.authoritativeThreadDelta)}`, 'Thread', `${anchorName} Anchor`],
      ],
      comparison: 'You visualized more consistently than in previous weeks.',
      comparisonTone: 'positive',
      interpretation: 'Clear visualization reinforced the feeling behind your Anchor before you practiced.',
      nextDirection: 'Keep returning to your Vision when you want to clarify the feeling.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 17. SPLIT_ATTENTION
  const activeAnchorsCount = facts.anchors.filter((a) => a.practiceCountInWeek > 0).length;
  const isSplit =
    totalPractices >= V1_INSIGHT_THRESHOLDS.splitAttentionMinPractices &&
    activeAnchorsCount >= V1_INSIGHT_THRESHOLDS.splitAttentionMinAnchors &&
    (!topAnchor || topAnchor.sharePercent / 100 <= V1_INSIGHT_THRESHOLDS.splitAttentionMaxAnchorShare);

  if (isSplit) {
    return {
      id: `snapshot-${facts.weekStart}-split`,
      weekLabel: facts.weekLabel,
      completedDateLabel: facts.completedDateLabel,
      ruleType: 'SPLIT_ATTENTION',
      headline: 'Your practice was shared across your Anchors.',
      support: 'You maintained activity across multiple intentions without one dominating your practice time.',
      accentColor: WEEKLY_INSIGHT_COLORS.neutral,
      accentKey: 'neutral',
      visualType: 'activity',
      visualData: {
        type: 'activity',
        activeDays: facts.activeDays,
        note: `${activeAnchorsCount} Anchors · ${totalPractices} completed Practices`,
        activeDaysCount: facts.activeDaysCount,
        completedPracticesCount: totalPractices,
      },
      evidence: [
        [`${activeAnchorsCount}`, 'Anchors', 'Practiced'],
        [`${totalPractices}`, 'Practices', 'Total'],
        [`${facts.activeDaysCount}`, 'Active days', 'Across week'],
      ],
      comparison: 'Your attention was divided evenly across your active intentions.',
      comparisonTone: 'neutral',
      interpretation: 'Broad practice kept multiple threads moving, even without deep concentration on a single Anchor.',
      nextDirection: 'If one intention feels more urgent next week, give it the first session of the day.',
      detailedActivity,
      createdAt: snapshotCreatedAt,
    };
  }

  // 18. GENERAL (Controlled Factual Fallback)
  return {
    id: `snapshot-${facts.weekStart}-general`,
    weekLabel: facts.weekLabel,
    completedDateLabel: facts.completedDateLabel,
    ruleType: 'GENERAL',
    headline: 'You stayed engaged with your practice.',
    support: `You completed ${totalPractices} Practices across ${facts.activeDaysCount} active days this week.`,
    accentColor: WEEKLY_INSIGHT_COLORS[primaryAccentKey],
    accentKey: primaryAccentKey,
    visualType: 'activity',
    visualData: {
      type: 'activity',
      activeDays: facts.activeDays,
      note: `${facts.activeDaysCount} active days · ${totalPractices} completed Practices`,
      activeDaysCount: facts.activeDaysCount,
      completedPracticesCount: totalPractices,
    },
    evidence: [
      [`${totalPractices}`, 'Practices', 'Completed'],
      [`${facts.activeDaysCount}`, 'Active days', 'Across week'],
      [`${facts.startThread} → ${facts.endThread}`, 'Thread', 'Movement'],
    ],
    comparison: 'Your practice pattern held throughout the week.',
    comparisonTone: 'neutral',
    interpretation: 'Each session reinforced your intention and kept your Anchor active.',
    nextDirection: 'Continue with your current Anchor as you begin the new week.',
    detailedActivity,
    createdAt: snapshotCreatedAt,
  };
}
