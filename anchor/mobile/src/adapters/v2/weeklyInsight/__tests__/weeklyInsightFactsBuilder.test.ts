/**
 * Tests for Weekly Insight Facts Builder.
 */

import type { Anchor } from '@/types';
import type { SessionLogEntry } from '@/stores/sessionStore';
import type { CourseLogEntry } from '@/types/chart';
import { buildWeeklyInsightFacts } from '../weeklyInsightFactsBuilder';

describe('weeklyInsightFactsBuilder', () => {
  const mockAnchor: Anchor = {
    id: 'a1',
    intentionText: 'Forge clarity',
    category: 'career',
    threadStrength: 75,
    createdAt: new Date('2026-08-01T00:00:00Z'),
  } as any;

  it('aggregates sessions, active days, and mode breakdown correctly', () => {
    // Reference date: Tuesday Sep 8, 2026. Completed week: Aug 31 (Mon) to Sep 6 (Sun)
    const refDate = new Date(2026, 8, 8, 10, 0, 0);

    const sessions: SessionLogEntry[] = [
      // Within completed week:
      {
        id: 's1',
        anchorId: 'a1',
        type: 'activate', // Focus
        durationSeconds: 180,
        mode: 'silent',
        completedAt: '2026-08-31T10:00:00.000Z', // Monday
      },
      {
        id: 's2',
        anchorId: 'a1',
        type: 'reinforce', // Deep Prime
        durationSeconds: 600,
        mode: 'ambient',
        completedAt: '2026-09-02T10:00:00.000Z', // Wednesday
      },
      {
        id: 's3',
        anchorId: 'a1',
        type: 'visualize',
        durationSeconds: 300,
        mode: 'silent',
        completedAt: '2026-09-04T10:00:00.000Z', // Friday
      },
      // Outside completed week (ignored):
      {
        id: 's4',
        anchorId: 'a1',
        type: 'activate',
        durationSeconds: 180,
        mode: 'silent',
        completedAt: '2026-08-25T10:00:00.000Z',
      },
    ];

    const facts = buildWeeklyInsightFacts({
      sessions,
      anchors: [mockAnchor],
      currentAnchorId: 'a1',
      referenceDate: refDate,
      hasActiveCourse: false,
    });

    expect(facts.sessions).toHaveLength(3);
    expect(facts.activeDaysCount).toBe(3);
    expect(facts.modeCounts.focus).toBe(1);
    expect(facts.modeCounts.deepPrime).toBe(1);
    expect(facts.modeCounts.visualize).toBe(1);
    expect(facts.modeCounts.release).toBe(0);
    expect(facts.totalDurationSeconds).toBe(1080);
    expect(facts.threadPoints).toHaveLength(7);
  });

  it('correctly captures waypoint and course events', () => {
    const refDate = new Date(2026, 8, 8, 10, 0, 0);
    const sessions: SessionLogEntry[] = [
      {
        id: 's1',
        anchorId: 'a1',
        type: 'activate',
        durationSeconds: 120,
        mode: 'silent',
        completedAt: '2026-09-03T10:00:00.000Z',
      },
    ];

    const courseLogs: CourseLogEntry[] = [
      {
        id: 'log1',
        eventType: 'WAYPOINT_REACHED',
        message: 'Waypoint reached',
        waypointId: 'wp1',
        occurredAt: '2026-09-03T14:00:00.000Z',
        recordedAt: '2026-09-03T14:00:00.000Z',
        snapshot: { waypointTitle: 'Launch Beta' } as any,
        reflection: null,
        practiceSession: null,
        anchorLink: null,
      },
      {
        id: 'log2',
        eventType: 'ONE_MOVE_COMPLETED' as any,
        message: 'One move completed',
        waypointId: 'wp1',
        occurredAt: '2026-09-03T15:00:00.000Z',
        recordedAt: '2026-09-03T15:00:00.000Z',
        snapshot: null,
        reflection: null,
        practiceSession: null,
        anchorLink: null,
      },
    ];

    const facts = buildWeeklyInsightFacts({
      sessions,
      anchors: [mockAnchor],
      courseLogs,
      hasActiveCourse: true,
      currentWaypointTitle: 'Launch Beta',
      referenceDate: refDate,
    });

    expect(facts.chartContext?.waypointReachedThisWeek).toBe(true);
    expect(facts.chartContext?.oneMovesCompletedCount).toBe(1);
    expect(facts.canonicalEvents.some((e) => e.type === 'WAYPOINT_REACHED')).toBe(true);
  });
});
