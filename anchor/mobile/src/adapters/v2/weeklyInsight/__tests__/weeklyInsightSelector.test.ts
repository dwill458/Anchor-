/**
 * Tests for Anchor 2.0 Weekly Insight Deterministic Selector.
 *
 * Verifies:
 * 1. All 18 taxonomy rules in canonical priority order (First Match Wins).
 * 2. Exact match of all 13 prototype scenarios.
 * 3. Graceful omission of missing optional domains (No Chart, No Vision).
 * 4. Deterministic evidence contracts and absence of gamification / streak metrics.
 */

import { selectWeeklyInsight } from '../weeklyInsightSelector';
import { PROTOTYPE_WEEKLY_INSIGHT_FIXTURES } from '../weeklyInsightFactsBuilder';
import type { WeeklyInsightFacts } from '../types';

describe('WeeklyInsightSelector', () => {
  describe('Canonical Prototype Scenarios', () => {
    it('1. matches prototype state "consistency"', () => {
      const snapshot = selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.consistency);
      expect(snapshot.ruleType).toBe('CONSISTENCY');
      expect(snapshot.headline).toBe('You kept the Thread steady.');
      expect(snapshot.visualType).toBe('activity');
      expect(snapshot.evidence).toHaveLength(3);
      expect(snapshot.evidence[0]).toEqual(['4', 'Active days', 'Across the week']);
      expect(snapshot.evidence[1]).toEqual(['5', 'Practices', 'Same as last week']);
      expect(snapshot.evidence[2]).toEqual(['68 → 71', 'Thread', 'Stable movement']);
      expect(snapshot.comparisonTone).toBe('neutral');
    });

    it('2. matches prototype state "depth"', () => {
      const snapshot = selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.depth);
      expect(snapshot.ruleType).toBe('DEPTH');
      expect(snapshot.headline).toBe('You went deeper, not more often.');
      expect(snapshot.visualType).toBe('anchor');
      expect(snapshot.accentKey).toBe('prime');
      expect(snapshot.evidence[0]).toEqual(['3', 'Deep Prime', 'Of 4 Practices']);
      expect(snapshot.evidence[1]).toEqual(['+14', 'Thread', '62 → 76']);
    });

    it('3. matches prototype state "recovery"', () => {
      const snapshot = selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.recovery);
      expect(snapshot.ruleType).toBe('RECOVERY');
      expect(snapshot.headline).toBe('You rebuilt momentum.');
      expect(snapshot.visualType).toBe('thread');
      expect(snapshot.evidence[0]).toEqual(['52', 'Low point', 'Tuesday']);
      expect(snapshot.evidence[1]).toEqual(['+16', 'Recovery', 'From the low']);
      expect(snapshot.evidence[2]).toEqual(['3', 'Practices', 'After the low']);
    });

    it('4. matches prototype state "dominant"', () => {
      const snapshot = selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.dominant);
      expect(snapshot.ruleType).toBe('PRIMARY_ANCHOR');
      expect(snapshot.headline).toBe('Your Career Anchor carried most of your momentum.');
      expect(snapshot.visualType).toBe('anchor');
      expect(snapshot.evidence[0]).toEqual(['4 of 6', 'Practices', 'Career Anchor']);
      expect(snapshot.evidence[1]).toEqual(['+14', 'Thread', '62 → 76']);
      expect(snapshot.evidence[2]).toEqual(['67%', 'Attention', 'One Anchor']);
    });

    it('5. matches prototype state "chartAlignment"', () => {
      const snapshot = selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.chartAlignment);
      expect(snapshot.ruleType).toBe('CHART_ALIGNMENT');
      expect(snapshot.headline).toBe('Your Practice stayed connected to the work in front of you.');
      expect(snapshot.visualType).toBe('chart');
      expect(snapshot.evidence[0]).toEqual(['5 of 6', 'Practices', 'Waypoint-linked']);
      expect(snapshot.evidence[1]).toEqual(['3', 'One Moves', 'Completed']);
    });

    it('6. matches prototype state "waypoint"', () => {
      const snapshot = selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.waypoint);
      expect(snapshot.ruleType).toBe('WAYPOINT_REACHED');
      expect(snapshot.headline).toBe('You moved from reinforcement into execution.');
      expect(snapshot.visualType).toBe('chartReached');
      expect(snapshot.evidence[0]).toEqual(['1', 'Waypoint', 'Reached Thu']);
      expect(snapshot.evidence[1]).toEqual(['4', 'One Moves', 'Completed']);
      expect(snapshot.evidence[2]).toEqual(['3', 'Practices', 'Waypoint-linked']);
    });

    it('7. matches prototype state "evolution"', () => {
      const snapshot = selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.evolution);
      expect(snapshot.ruleType).toBe('EVOLUTION_MILESTONE');
      expect(snapshot.headline).toBe('Your Career Anchor became Rooted this week.');
      expect(snapshot.visualType).toBe('evolution');
      expect(snapshot.evidence[0]).toEqual(['Rooted', 'Current stage', 'Reached Thu']);
      expect(snapshot.evidence[1]).toEqual(['76', 'Thread', 'At transition']);
    });

    it('8. matches prototype state "release"', () => {
      const snapshot = selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.release);
      expect(snapshot.ruleType).toBe('COMPLETION_RELEASE');
      expect(snapshot.headline).toBe('You closed a chapter this week.');
      expect(snapshot.visualType).toBe('release');
      expect(snapshot.accentKey).toBe('release');
      expect(snapshot.evidence[0]).toEqual(['22', 'Practices', 'Lifetime']);
      expect(snapshot.evidence[1]).toEqual(['76', 'Final Thread', 'Snapshot']);
      expect(snapshot.evidence[2]).toEqual(['Sat', 'Released', 'Completed week']);
    });

    it('9. matches prototype state "return"', () => {
      const snapshot = selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.return);
      expect(snapshot.ruleType).toBe('RETURN');
      expect(snapshot.headline).toBe('You came back.');
      expect(snapshot.visualType).toBe('activity');
      expect(snapshot.evidence[0]).toEqual(['18d', 'Away', 'Before return']);
      expect(snapshot.evidence[1]).toEqual(['2', 'Practices', 'Completed']);
    });

    it('10. matches prototype state "quiet"', () => {
      const snapshot = selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.quiet);
      expect(snapshot.ruleType).toBe('LOW_ACTIVITY');
      expect(snapshot.headline).toBe('This was a quieter week.');
      expect(snapshot.visualType).toBe('activity');
      expect(snapshot.evidence[0]).toEqual(['1', 'Practice', 'Completed']);
    });

    it('11. matches prototype state "newUser"', () => {
      const snapshot = selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.newUser);
      expect(snapshot.ruleType).toBe('NEW_USER');
      expect(snapshot.headline).toBe('You started building your first pattern.');
      expect(snapshot.visualType).toBe('anchor');
      expect(snapshot.evidence[0]).toEqual(['3', 'Practices', 'First week']);
      expect(snapshot.evidence[1]).toEqual(['2', 'Modes', 'Explored']);
    });

    it('12. matches prototype state "noChart"', () => {
      const snapshot = selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.noChart);
      expect(snapshot.ruleType).toBe('PRIMARY_ANCHOR');
      expect(snapshot.detailedActivity.connectedActivity.every((c) => c.type !== 'chart')).toBe(true);
      expect(snapshot.detailedActivity.connectedActivity.some((c) => c.type === 'vision')).toBe(true);
    });

    it('13. matches prototype state "noVision"', () => {
      const snapshot = selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.noVision);
      expect(snapshot.ruleType).toBe('CONSISTENCY');
      expect(snapshot.detailedActivity.connectedActivity.every((c) => c.type !== 'vision')).toBe(true);
      expect(snapshot.detailedActivity.connectedActivity.some((c) => c.type === 'chart')).toBe(true);
    });
  });

  describe('Taxonomy Priority Rules (First Match Wins)', () => {
    it('prioritizes DESTINATION_REACHED over all other events', () => {
      const base = PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.consistency;
      const destinationFacts: WeeklyInsightFacts = {
        ...base,
        chartContext: {
          hasActiveCourse: true,
          currentWaypointTitle: 'Final waypoint',
          waypointReachedThisWeek: true,
          oneMovesCompletedCount: 5,
          destinationReachedThisWeek: true,
          practicesLinkedCount: 5,
        },
      };

      const snapshot = selectWeeklyInsight(destinationFacts);
      expect(snapshot.ruleType).toBe('DESTINATION_REACHED');
      expect(snapshot.headline).toBe('You reached your Destination.');
    });

    it('selects QUIET when 0 completed practices exist', () => {
      const quietFacts: WeeklyInsightFacts = {
        ...PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.quiet,
        sessions: [],
        activeDaysCount: 0,
        activeDays: [false, false, false, false, false, false, false],
        authoritativeThreadDelta: -4,
      };

      const snapshot = selectWeeklyInsight(quietFacts);
      expect(snapshot.ruleType).toBe('QUIET');
      expect(snapshot.headline).toBe('This was a quieter week.');
      expect(snapshot.evidence[0]).toEqual(['0', 'Practices', 'Completed']);
    });

    it('selects SPLIT_ATTENTION when practice is evenly divided across 3+ anchors', () => {
      const splitFacts: WeeklyInsightFacts = {
        ...PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.consistency,
        sessions: [
          { id: '1', anchorId: 'a1', mode: 'Focus', durationSeconds: 120, completedAt: '2026-09-01T10:00:00Z', dayOfWeekIndex: 1 },
          { id: '2', anchorId: 'a2', mode: 'Focus', durationSeconds: 120, completedAt: '2026-09-02T10:00:00Z', dayOfWeekIndex: 2 },
          { id: '3', anchorId: 'a3', mode: 'Focus', durationSeconds: 120, completedAt: '2026-09-03T10:00:00Z', dayOfWeekIndex: 3 },
          { id: '4', anchorId: 'a1', mode: 'Focus', durationSeconds: 120, completedAt: '2026-09-04T10:00:00Z', dayOfWeekIndex: 4 },
        ],
        activeDaysCount: 4,
        anchors: [
          { id: 'a1', intention: 'Anchor 1', practiceCountInWeek: 2, sharePercent: 50 },
          { id: 'a2', intention: 'Anchor 2', practiceCountInWeek: 1, sharePercent: 25 },
          { id: 'a3', intention: 'Anchor 3', practiceCountInWeek: 1, sharePercent: 25 },
        ],
        chartContext: null,
        visionContext: null,
        authoritativeThreadDelta: -3, // prevents consistency (loss > 2)
      };

      const snapshot = selectWeeklyInsight(splitFacts);
      expect(snapshot.ruleType).toBe('SPLIT_ATTENTION');
      expect(snapshot.headline).toBe('Your practice was shared across your Anchors.');
    });

    it('selects GENERAL as deterministic fallback without fabricating metrics', () => {
      const generalFacts: WeeklyInsightFacts = {
        ...PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.consistency,
        activeDaysCount: 2, // < 4, so not consistency
        sessions: [
          { id: '1', anchorId: 'a1', mode: 'Focus', durationSeconds: 60, completedAt: '2026-09-01T10:00:00Z', dayOfWeekIndex: 1 },
          { id: '2', anchorId: 'a1', mode: 'Focus', durationSeconds: 60, completedAt: '2026-09-02T10:00:00Z', dayOfWeekIndex: 2 },
        ], // 2 practices, so not low activity (1), not depth (>=3), not dominant (>=4)
        chartContext: null,
        visionContext: null,
        canonicalEvents: [],
        historyContext: {
          weeksOfHistoryCount: 5,
          daysSincePriorPractice: 3, // not return (>=14)
        },
      };

      const snapshot = selectWeeklyInsight(generalFacts);
      expect(snapshot.ruleType).toBe('GENERAL');
      expect(snapshot.headline).toBe('You stayed engaged with your practice.');
      expect(snapshot.evidence[0]).toEqual(['2', 'Practices', 'Completed']);
    });
  });
});
