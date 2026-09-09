import {
  resolveEvolutionStage,
  aggregatePracticeSessions,
  deriveThreadEvents,
  toV2ProgressModel,
} from '../progressAdapter';
import type { Anchor } from '@/types';
import type { CourseLogEntry } from '@/types/chart';
import type { SessionLogEntry } from '@/stores/sessionStore';

describe('V2 Progress Adapter', () => {
  const mockAnchor: Anchor = {
    id: 'anchor-100',
    userId: 'user-1',
    intentionText: 'Launch Anchor 2.0 with excellence',
    category: 'creativity',
    threadStrength: 65,
    isCharged: true,
    activationCount: 5,
    baseSigilSvg: '<svg></svg>',
    distilledLetters: ['L', 'N', 'C', 'H'],
    structureVariant: 'balanced',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-15T12:00:00.000Z'),
  };

  const mockSessions: SessionLogEntry[] = [
    {
      id: 'sess-1',
      anchorId: 'anchor-100',
      type: 'activate',
      mode: 'silent',
      durationSeconds: 300,
      completedAt: '2026-08-02T10:00:00.000Z',
    },
    {
      id: 'sess-2',
      anchorId: 'anchor-100',
      type: 'reinforce',
      mode: 'ambient',
      durationSeconds: 180,
      completedAt: '2026-08-03T10:00:00.000Z',
    },
    {
      id: 'sess-3',
      anchorId: 'anchor-100',
      type: 'visualize',
      mode: 'mantra',
      durationSeconds: 120,
      completedAt: '2026-08-04T10:00:00.000Z',
    },
    {
      id: 'sess-other',
      anchorId: 'other-anchor',
      type: 'activate',
      mode: 'silent',
      durationSeconds: 900,
      completedAt: '2026-08-05T10:00:00.000Z',
    },
  ];

  const mockLogs: CourseLogEntry[] = [
    {
      id: 'log-1',
      eventType: 'WAYPOINT_REACHED',
      message: 'Design system frozen',
      waypointId: 'wp-1',
      snapshot: { waypointTitle: 'Design System Complete' },
      reflection: null,
      practiceSession: null,
      anchorLink: null,
      occurredAt: '2026-08-10T14:00:00.000Z',
      recordedAt: '2026-08-10T14:00:00.000Z',
    },
    {
      id: 'log-2',
      eventType: 'COURSE_COMPLETED',
      message: 'Shipped to app store',
      waypointId: null,
      snapshot: {},
      reflection: null,
      practiceSession: null,
      anchorLink: null,
      occurredAt: '2026-08-20T18:00:00.000Z',
      recordedAt: '2026-08-20T18:00:00.000Z',
    },
  ];

  describe('resolveEvolutionStage', () => {
    it('maps strength to locked evolution stages correctly', () => {
      expect(resolveEvolutionStage(0)).toBe('Forming');
      expect(resolveEvolutionStage(24)).toBe('Forming');
      expect(resolveEvolutionStage(25)).toBe('Grounded');
      expect(resolveEvolutionStage(49)).toBe('Grounded');
      expect(resolveEvolutionStage(50)).toBe('Rooted');
      expect(resolveEvolutionStage(74)).toBe('Rooted');
      expect(resolveEvolutionStage(75)).toBe('Embedded');
      expect(resolveEvolutionStage(89)).toBe('Embedded');
      expect(resolveEvolutionStage(90)).toBe('Sovereign');
      expect(resolveEvolutionStage(100)).toBe('Sovereign');
    });
  });

  describe('aggregatePracticeSessions', () => {
    it('aggregates practice modes strictly for the target anchor', () => {
      const summary = aggregatePracticeSessions(mockSessions, 'anchor-100');
      expect(summary.totalSessions).toBe(3);
      expect(summary.totalDurationSeconds).toBe(600);
      expect(summary.focusCount).toBe(1);
      expect(summary.focusSeconds).toBe(300);
      expect(summary.deepPrimeCount).toBe(1);
      expect(summary.deepPrimeSeconds).toBe(180);
      expect(summary.visualizeCount).toBe(1);
      expect(summary.visualizeSeconds).toBe(120);
      expect(summary.releaseCount).toBe(0);
    });
  });

  describe('deriveThreadEvents', () => {
    it('derives chronological events without fabricating client delta', () => {
      const events = deriveThreadEvents(mockAnchor, mockLogs, mockSessions);
      expect(events.length).toBeGreaterThan(0);

      // Verify no client fabricated delta
      for (const event of events) {
        expect(event.authoritativeDelta).toBeNull();
      }

      // Check event types present
      const types = events.map((e) => e.type);
      expect(types).toContain('ANCHOR_CREATED');
      expect(types).toContain('EVOLUTION_STAGE_REACHED');
      expect(types).toContain('WAYPOINT_REACHED');
      expect(types).toContain('DESTINATION_REACHED');

      // Verify sorting descending by occurredAt
      for (let i = 0; i < events.length - 1; i++) {
        const t1 = new Date(events[i].occurredAt).getTime();
        const t2 = new Date(events[i + 1].occurredAt).getTime();
        expect(t1).toBeGreaterThanOrEqual(t2);
      }
    });

    it('generates milestone event when 10 or more sessions exist', () => {
      const tenSessions: SessionLogEntry[] = Array.from({ length: 10 }).map((_, i) => ({
        id: `sess-ten-${i}`,
        anchorId: 'anchor-100',
        type: 'activate',
        mode: 'silent',
        durationSeconds: 60,
        completedAt: `2026-08-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
      }));

      const events = deriveThreadEvents(mockAnchor, [], tenSessions);
      const milestone = events.find((e) => e.type === 'PRACTICE_MILESTONE_REACHED');
      expect(milestone).toBeDefined();
      expect(milestone?.milestoneCount).toBe(10);
    });
  });

  describe('toV2ProgressModel', () => {
    it('returns null if anchor is null or undefined', () => {
      expect(toV2ProgressModel(null)).toBeNull();
      expect(toV2ProgressModel(undefined)).toBeNull();
    });

    it('builds full progress model with honest evidence', () => {
      const model = toV2ProgressModel(mockAnchor, mockLogs, mockSessions);
      expect(model).not.toBeNull();
      expect(model?.anchorId).toBe('anchor-100');
      expect(model?.threadStrength).toBe(65);
      expect(model?.highestEvolutionStage).toBe('Rooted');
      expect(model?.practiceSummary.totalSessions).toBe(3);
      expect(model?.waypointsReachedCount).toBe(2);
      expect(model?.events.length).toBeGreaterThan(0);
    });

    it('handles unmeasured thread strength gracefully', () => {
      const unmeasuredAnchor = { ...mockAnchor, threadStrength: undefined };
      const model = toV2ProgressModel(unmeasuredAnchor, [], []);
      expect(model?.threadStrength).toBe(0);
      expect(model?.unmeasured).toBe(true);
      expect(model?.highestEvolutionStage).toBe('Forming');
    });
  });
});
