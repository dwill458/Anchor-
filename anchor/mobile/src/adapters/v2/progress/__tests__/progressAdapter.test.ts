import {
  resolveEvolutionStage,
  aggregatePracticeSessions,
  deriveThreadEvents,
  toV2ProgressModel,
  buildWeek,
  buildStreak,
  buildHeatmap,
  buildRhythm,
  buildSpark,
  buildRouteSummary,
  buildProgressReflections,
  formatRelativeDay,
  getProgressVerdict,
  groupThreadEventsByDay,
  formatProgressDate,
} from '../progressAdapter';
import type { V2ThreadEventItem } from '../types';
import type { PracticeSessionRecord } from '@/types/practice';
import type { CourseDetail } from '@/types/chart';
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
      expect(resolveEvolutionStage(25)).toBe('Building');
      expect(resolveEvolutionStage(49)).toBe('Building');
      expect(resolveEvolutionStage(50)).toBe('Established');
      expect(resolveEvolutionStage(74)).toBe('Established');
      expect(resolveEvolutionStage(75)).toBe('Integrated');
      expect(resolveEvolutionStage(89)).toBe('Integrated');
      expect(resolveEvolutionStage(90)).toBe('Reinforced');
      expect(resolveEvolutionStage(100)).toBe('Reinforced');
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

  describe('celebration dates (Progress timeline)', () => {
    // mockAnchor is at 65 Thread, so its current stage is Established.
    const recorded = {
      stages: { building: '2026-08-05T09:00:00.000Z', established: '2026-08-06T09:30:00.000Z' },
      fullStrengthAt: '2026-08-07T08:00:00.000Z',
    };
    const stageEvent = (events: V2ThreadEventItem[]) => events.find((e) => e.type === 'EVOLUTION_STAGE_REACHED')!;
    const fullStrengthEvent = (events: V2ThreadEventItem[]) => events.find((e) => e.type === 'FULL_STRENGTH_REACHED');
    const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    it('dates a stage event from the record for that stage', () => {
      const event = stageEvent(deriveThreadEvents(mockAnchor, mockLogs, mockSessions, recorded));
      expect(event.stageName).toBe('Established');
      expect(event.occurredAt).toBe(recorded.stages.established);
      expect(event.formattedDate).toBe(shortDate(recorded.stages.established));
    });

    it('shows no date for a stage with no record, and never the anchor updatedAt', () => {
      const event = stageEvent(deriveThreadEvents(mockAnchor, mockLogs, mockSessions));
      expect(event.occurredAt).toBe('');
      expect(event.formattedDate).toBe('');
      expect(event.formattedTime).toBeUndefined();
      expect(event.occurredAt).not.toBe(new Date(mockAnchor.updatedAt as Date).toISOString());
    });

    it('does not borrow the date of another stage', () => {
      const onlyBuilding = { stages: { building: recorded.stages.building } };
      const event = stageEvent(deriveThreadEvents(mockAnchor, mockLogs, mockSessions, onlyBuilding));
      expect(event.occurredAt).toBe('');
      expect(event.formattedDate).toBe('');
    });

    it('ignores an unreadable stored date rather than displaying it', () => {
      const events = deriveThreadEvents(mockAnchor, [], [], { stages: { established: 'not-a-date' }, fullStrengthAt: 'nope' });
      expect(stageEvent(events).occurredAt).toBe('');
      expect(fullStrengthEvent(events)).toBeUndefined();
    });

    it('adds Full Strength reached only when a record exists, dated by that record', () => {
      const event = fullStrengthEvent(deriveThreadEvents(mockAnchor, mockLogs, mockSessions, recorded));
      expect(event?.title).toBe('Full Strength reached');
      expect(event?.type).toBe('FULL_STRENGTH_REACHED');
      expect(event?.occurredAt).toBe(recorded.fullStrengthAt);
      expect(event?.formattedDate).toBe(shortDate(recorded.fullStrengthAt));
      expect(fullStrengthEvent(deriveThreadEvents(mockAnchor, mockLogs, mockSessions))).toBeUndefined();
    });

    it('never stamps any event with the anchor updatedAt', () => {
      const updated = new Date(mockAnchor.updatedAt as Date).toISOString();
      const events = deriveThreadEvents(mockAnchor, mockLogs, mockSessions);
      expect(events.some((e) => e.occurredAt === updated)).toBe(false);
    });

    it('groups undated events under Earlier, after every dated day', () => {
      const events = deriveThreadEvents(mockAnchor, mockLogs, mockSessions);
      const groups = groupThreadEventsByDay(events, new Date('2026-08-21T12:00:00.000Z'));
      const last = groups[groups.length - 1];
      expect(last.label).toBe('Earlier');
      expect(last.events.map((e) => e.type)).toEqual(['EVOLUTION_STAGE_REACHED']);
    });

    it('carries Full Strength onto the model only from the record', () => {
      expect(toV2ProgressModel(mockAnchor, mockLogs, mockSessions, { celebrations: recorded })?.fullStrengthAt).toBe(
        recorded.fullStrengthAt,
      );
      expect(toV2ProgressModel(mockAnchor, mockLogs, mockSessions, {})?.fullStrengthAt).toBeNull();
      expect(toV2ProgressModel(mockAnchor, mockLogs, mockSessions)?.fullStrengthAt).toBeNull();
    });

    it('stays pure: the same inputs give the same events and the records are not changed', () => {
      const records = JSON.parse(JSON.stringify(recorded));
      const first = deriveThreadEvents(mockAnchor, mockLogs, mockSessions, records);
      const second = deriveThreadEvents(mockAnchor, mockLogs, mockSessions, records);
      expect(second).toEqual(first);
      expect(records).toEqual(recorded);
      expect(mockAnchor.threadStrength).toBe(65);
    });

    it('formats a real date with the progress date format and returns null for no date', () => {
      expect(formatProgressDate(recorded.fullStrengthAt)).toBe(shortDate(recorded.fullStrengthAt));
      expect(formatProgressDate(undefined)).toBeNull();
      expect(formatProgressDate('not-a-date')).toBeNull();
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

      // Verify sorting descending by occurredAt; events with no known date come after the dated ones.
      const dated = events.filter((e) => e.occurredAt !== '');
      for (let i = 0; i < dated.length - 1; i++) {
        const t1 = new Date(dated[i].occurredAt).getTime();
        const t2 = new Date(dated[i + 1].occurredAt).getTime();
        expect(t1).toBeGreaterThanOrEqual(t2);
      }
      expect(events.slice(dated.length).every((e) => e.occurredAt === '')).toBe(true);
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
      expect(model?.highestEvolutionStage).toBe('Established');
      expect(model?.practiceSummary.totalSessions).toBe(3);
      expect(model?.waypointsReachedCount).toBe(2);
      expect(model?.events.length).toBeGreaterThan(0);
    });

    it('handles unmeasured thread strength gracefully', () => {
      const unmeasuredAnchor = { ...mockAnchor, threadStrength: undefined };
      const model = toV2ProgressModel(unmeasuredAnchor, [], []);
      expect(model?.threadStrength).toBeNull();
      expect(model?.unmeasured).toBe(true);
      expect(model?.highestEvolutionStage).toBe('Unestablished');
    });
  });

  // ─── Progress 2.0 evidence builders ────────────────────────────────────────
  // `now` and every local date are built with the local-time Date constructor so
  // the suite passes in any timezone.
  describe('evidence builders', () => {
    const NOW = new Date(2026, 9, 5, 12, 0, 0); // Monday, Oct 5 2026, local noon

    const practice = (
      id: string,
      localDateKey: string,
      extra: Partial<PracticeSessionRecord> = {},
    ): PracticeSessionRecord =>
      ({
        id,
        accountId: 'acct',
        anchorId: 'a1',
        anchorLocalId: null,
        anchorServerId: null,
        practiceMode: 'focus',
        plannedDurationSeconds: 600,
        completedDurationSeconds: 120,
        completionStatus: 'completed',
        startedAt: `${localDateKey}T12:00:00.000Z`,
        completedAt: `${localDateKey}T12:00:00.000Z`,
        localDateKey,
        timeZone: 'UTC',
        utcOffsetMinutesAtCompletion: 0,
        completionSource: 'practice_screen',
        schemaVersion: 1,
        legacyType: null,
        guidanceVoice: 'none',
        backgroundAudio: 'off',
        sceneSnapshot: null,
        nextAction: null,
        clientVersion: null,
        syncState: 'synced',
        ...extra,
      }) as PracticeSessionRecord;

    describe('buildWeek', () => {
      it('mirrors weekHistory and marks today', () => {
        const week = buildWeek([true, false, true, false, false, false, false], NOW, '2026-W41');
        expect(week.days).toEqual([true, false, true, false, false, false, false]);
        expect(week.todayIndex).toBe(0); // Monday
      });

      it('reads a stale week as empty and pads short arrays', () => {
        expect(buildWeek([true, true, true, true, true, true, true], NOW, '2026-W40').days.every((d) => !d)).toBe(true);
        expect(buildWeek(undefined, NOW).days).toEqual([false, false, false, false, false, false, false]);
        expect(buildWeek([true], NOW).days).toHaveLength(7);
      });
    });

    describe('buildStreak', () => {
      it('counts consecutive days ending today or yesterday', () => {
        const sessions = [
          { completedAt: new Date(2026, 9, 5, 9).toISOString() },
          { completedAt: new Date(2026, 9, 4, 9).toISOString() },
          { completedAt: new Date(2026, 9, 3, 9).toISOString() },
        ];
        const streak = buildStreak(sessions, null, NOW);
        expect(streak.current).toBe(3);
        expect(streak.best).toBeGreaterThanOrEqual(3);
        expect(streak.isProtected).toBe(false);
        expect(streak.graceAvailable).toBe(true);
      });

      it('bridges one missed day with an unused grace day', () => {
        const sessions = [
          { completedAt: new Date(2026, 9, 3, 12).toISOString() },
          { completedAt: new Date(2026, 9, 2, 12).toISOString() },
        ];
        const streak = buildStreak(sessions, null, NOW);
        expect(streak.isProtected).toBe(true);
        expect(streak.current).toBeGreaterThan(0);
      });

      it('does not protect the run once the grace day was used this week', () => {
        const sessions = [{ completedAt: new Date(2026, 9, 3, 12).toISOString() }];
        const streak = buildStreak(sessions, new Date(2026, 9, 1, 12).toISOString(), NOW);
        expect(streak.isProtected).toBe(false);
        expect(streak.graceAvailable).toBe(false);
        expect(streak.current).toBe(0);
      });
    });

    describe('buildHeatmap', () => {
      it('draws Monday-first windows of 7, 35 and 182 days', () => {
        expect(buildHeatmap([], 'a1', 'Week', NOW)).toHaveLength(7);
        expect(buildHeatmap([], 'a1', 'Month', NOW)).toHaveLength(35);
        expect(buildHeatmap([], 'a1', 'Year', NOW)).toHaveLength(182);
        const week = buildHeatmap([], 'a1', 'Week', NOW);
        expect(week[0].dateKey).toBe('2026-10-05');
        expect(week[0].isToday).toBe(true);
        expect(week[1].isFuture).toBe(true);
      });

      it('levels cells by sessions per local day, 3+ capped', () => {
        const sessions = [
          practice('s1', '2026-10-05'),
          practice('s2', '2026-10-04'),
          practice('s3', '2026-10-04'),
          practice('s4', '2026-10-03'),
          practice('s5', '2026-10-03'),
          practice('s6', '2026-10-03'),
          practice('s7', '2026-10-03'),
          practice('other', '2026-10-02', { anchorId: 'a2' }),
        ];
        const cells = buildHeatmap(sessions, 'a1', 'Month', NOW);
        const byKey = Object.fromEntries(cells.map((c) => [c.dateKey, c]));
        expect(byKey['2026-10-05'].level).toBe(1);
        expect(byKey['2026-10-04'].level).toBe(2);
        expect(byKey['2026-10-03'].level).toBe(3);
        expect(byKey['2026-10-03'].sessionCount).toBe(4);
        expect(byKey['2026-10-02'].level).toBe(0); // another Anchor's session
      });

      it('keys a late-night session on its persisted localDateKey, not completedAt', () => {
        // 11:50 PM on Oct 4 in a UTC-7 zone is already Oct 5 in UTC.
        const lateNight = practice('late', '2026-10-04', { completedAt: '2026-10-05T06:50:00.000Z' });
        const cells = buildHeatmap([lateNight], 'a1', 'Month', new Date(2026, 9, 6, 12));
        const byKey = Object.fromEntries(cells.map((c) => [c.dateKey, c]));
        expect(byKey['2026-10-04'].level).toBe(1);
        expect(byKey['2026-10-05'].level).toBe(0);
      });

      it('falls back to the local day of completedAt for legacy log entries', () => {
        const legacy: SessionLogEntry = {
          id: 'legacy',
          anchorId: 'a1',
          type: 'activate',
          mode: 'silent',
          durationSeconds: 60,
          completedAt: new Date(2026, 9, 5, 23, 50).toISOString(),
        };
        const today = buildHeatmap([legacy], 'a1', 'Week', NOW)[0];
        expect(today.level).toBe(1);
      });

      it('leaves future cells empty even for a future-dated session', () => {
        const cells = buildHeatmap([practice('f', '2026-10-07')], 'a1', 'Week', NOW);
        const future = cells.find((c) => c.dateKey === '2026-10-07');
        expect(future?.isFuture).toBe(true);
        expect(future?.level).toBe(0);
      });
    });

    describe('buildRhythm', () => {
      it('sums completed (not planned) minutes and counts distinct active days', () => {
        const sessions = [
          practice('s1', '2026-10-05', { completedDurationSeconds: 90, plannedDurationSeconds: 3600 }),
          practice('s2', '2026-10-05', { completedDurationSeconds: 90 }),
          practice('s3', '2026-10-04', { completedDurationSeconds: 120 }),
          practice('s4', '2026-10-02', { completedDurationSeconds: 60 }),
          practice('old', '2026-06-01', { completedDurationSeconds: 600 }),
        ];
        const rhythm = buildRhythm(sessions, 'a1', NOW);
        expect(rhythm.Week.practices).toBe(2);
        expect(rhythm.Week.minutes).toBe(3);
        expect(rhythm.Week.activeDays).toBe(1);
        expect(rhythm.Month.practices).toBe(4);
        expect(rhythm.Month.minutes).toBe(6);
        expect(rhythm.Month.activeDays).toBe(3);
        expect(rhythm.Month.bestRun).toBe(2); // Oct 4–5
        expect(rhythm.Year.practices).toBe(5);
        expect(rhythm.Year.minutes).toBe(16);
      });

      it('counts a month-end run across the month boundary', () => {
        const sessions = ['2026-09-29', '2026-09-30', '2026-10-01'].map((k, i) => practice(`s${i}`, k));
        expect(buildRhythm(sessions, 'a1', NOW).Month.bestRun).toBe(3);
      });
    });

    describe('buildSpark', () => {
      it('uses only persisted threadStrengthAfter and skips records without it', () => {
        const sessions = [
          practice('s1', '2026-10-01', { threadStrengthAfter: 40 }),
          practice('s2', '2026-10-03', { threadStrengthAfter: 52 }),
          practice('s3', '2026-10-04'), // no persisted value: skipped, not estimated
          practice('s4', '2026-10-05', { threadStrengthAfter: 61 }),
          practice('x', '2026-10-05', { threadStrengthAfter: 99, anchorId: 'a2' }),
        ];
        const spark = buildSpark(sessions, 'a1', 30, NOW);
        expect(spark).toEqual([
          { dateKey: '2026-10-01', value: 40 },
          { dateKey: '2026-10-03', value: 52 },
          { dateKey: '2026-10-05', value: 61 },
        ]);
      });

      it('takes the last practice of a day and drops anything older than the window', () => {
        const sessions = [
          practice('early', '2026-10-05', {
            completedAt: new Date(2026, 9, 5, 8).toISOString(),
            threadStrengthAfter: 50,
          }),
          practice('late', '2026-10-05', {
            completedAt: new Date(2026, 9, 5, 20).toISOString(),
            threadStrengthAfter: 58,
          }),
          practice('stale', '2026-08-01', { threadStrengthAfter: 10 }),
        ];
        expect(buildSpark(sessions, 'a1', 30, NOW)).toEqual([{ dateKey: '2026-10-05', value: 58 }]);
      });

      it('returns nothing for legacy log entries that carry no Thread value', () => {
        expect(buildSpark(mockSessions, 'anchor-100', 30, NOW)).toEqual([]);
      });
    });

    describe('buildRouteSummary', () => {
      const waypoint = (id: string, position: number, state: string, reachedAt: string | null = null) =>
        ({
          id,
          courseId: 'c1',
          position,
          title: `Waypoint ${position}`,
          description: null,
          state,
          blockedReason: null,
          reachedAt,
          skippedAt: null,
          cancelledAt: null,
          anchorLink: null,
        }) as any;
      const course = (over: Partial<CourseDetail> = {}): CourseDetail =>
        ({
          id: 'c1',
          destinationText: 'A business that lets me choose my days',
          status: 'ACTIVE',
          version: 3,
          currentWaypointId: 'w3',
          waypointCount: 4,
          reachedCount: 2,
          plottedAt: '2026-09-01T00:00:00.000Z',
          completedAt: null,
          archivedAt: null,
          destinationAnchorLink: null,
          waypoints: [
            waypoint('w1', 1, 'REACHED', '2026-09-05T00:00:00.000Z'),
            waypoint('w2', 2, 'REACHED', '2026-09-20T00:00:00.000Z'),
            waypoint('w3', 3, 'CURRENT'),
            waypoint('w4', 4, 'UPCOMING'),
          ],
          ...over,
        }) as CourseDetail;

      it('is null without a live course', () => {
        expect(buildRouteSummary(null)).toBeNull();
        expect(buildRouteSummary(undefined)).toBeNull();
        expect(buildRouteSummary(course({ status: 'ARCHIVED' as any }))).toBeNull();
        expect(buildRouteSummary(course({ waypoints: [] }))).toBeNull();
      });

      it('reads current, reached and total from the Chart read model', () => {
        const route = buildRouteSummary(course());
        expect(route).toMatchObject({ currentIndex: 2, total: 4, reachedCount: 2, currentTitle: 'Waypoint 3' });
        expect(route?.waypoints.map((w) => w.state)).toEqual(['completed', 'completed', 'current', 'upcoming']);
        expect(route?.waypoints[3].isDestination).toBe(true);
      });
    });

    describe('buildProgressReflections', () => {
      const log = (id: string, moodAfter: any, occurredAt: string) =>
        ({
          id: `log-${id}`,
          eventType: 'REFLECTION_ADDED',
          message: '',
          waypointId: null,
          occurredAt,
          recordedAt: occurredAt,
          snapshot: null,
          reflection: { id, promptType: 'COURSE_STATUS', body: 'long text', structuredContent: null, moodAfter },
          practiceSession: null,
          anchorLink: null,
        }) as CourseLogEntry;
      const entry = (id: string, reflectionWord: string | undefined, anchorId = 'a1'): SessionLogEntry => ({
        id,
        anchorId,
        type: 'activate',
        mode: 'silent',
        durationSeconds: 30,
        reflectionWord,
        completedAt: '2026-10-04T10:00:00.000Z',
      });

      it('prefers Chart reflections when the flag is on', () => {
        const result = buildProgressReflections({
          courseLogs: [log('r1', 'CALM', '2026-10-04T10:00:00.000Z'), log('r2', null, '2026-10-05T10:00:00.000Z')],
          sessionLog: [entry('s1', 'Steady')],
          anchorIds: 'a1',
          chartReflectionsEnabled: true,
        });
        expect(result.source).toBe('course_log');
        expect(result.items.map((i) => i.word)).toEqual(['Calm']);
      });

      it('falls back to the legacy reflectionWord, for this Anchor only, and skips blanks', () => {
        const result = buildProgressReflections({
          courseLogs: [log('r1', 'CALM', '2026-10-04T10:00:00.000Z')],
          sessionLog: [entry('s1', ' Steady '), entry('s2', '  '), entry('s3', undefined), entry('s4', 'Clear', 'a2')],
          anchorIds: 'a1',
          chartReflectionsEnabled: false,
        });
        expect(result.source).toBe('session_log');
        expect(result.items.map((i) => i.word)).toEqual(['Steady']);
      });

      it('returns nothing, never sample words, when no source has data', () => {
        const result = buildProgressReflections({
          courseLogs: [],
          sessionLog: [entry('s1', undefined)],
          anchorIds: 'a1',
          chartReflectionsEnabled: true,
        });
        expect(result).toEqual({ source: 'none', items: [] });
      });
    });

    describe('copy helpers', () => {
      it('formats relative days', () => {
        expect(formatRelativeDay('2026-10-05', NOW)).toBe('today');
        expect(formatRelativeDay('2026-10-04', NOW)).toBe('yesterday');
        expect(formatRelativeDay('2026-10-01', NOW)).toBe('4 days ago');
        expect(formatRelativeDay('2026-09-14', NOW)).toBe('3 weeks ago');
        expect(formatRelativeDay(null, NOW)).toBeNull();
      });

      it('writes the verdict from Consistency and never claims unbacked patterns', () => {
        const steady = getProgressVerdict(68, false, '2026-10-04', NOW);
        expect(steady.headline).toBe('Holding steady and building.');
        expect(steady.support).toBe('Last practiced yesterday.');
        const soft = getProgressVerdict(41, false, '2026-10-02', NOW);
        expect(soft.headline).toBe('Soft, but still here.');
        expect(soft.support).toBe('Last practiced 3 days ago. One practice today starts it climbing again.');
        const waiting = getProgressVerdict(null, true, null, NOW);
        expect(waiting.headline).toBe('Your thread is waiting.');
        expect(getProgressVerdict(70, false, null, NOW).support).toBe('');
      });

      it('groups events by the local day, newest first', () => {
        const at = (d: Date, id: string) =>
          ({ id, occurredAt: d.toISOString(), title: id }) as unknown as import('../types').V2ThreadEventItem;
        const groups = groupThreadEventsByDay(
          [at(new Date(2026, 9, 5, 9), 'a'), at(new Date(2026, 9, 5, 7), 'b'), at(new Date(2026, 9, 4, 20), 'c'), at(new Date(2026, 9, 1, 8), 'd')],
          NOW,
        );
        expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Thu, Oct 1']);
        expect(groups[0].events.map((e) => e.id)).toEqual(['a', 'b']);
      });
    });

    describe('toV2ProgressModel extras', () => {
      it('keeps the original three-argument shape when no extras are given', () => {
        const model = toV2ProgressModel(mockAnchor, mockLogs, mockSessions);
        expect(model?.week).toBeUndefined();
        expect(model?.heatmap).toBeUndefined();
        expect(model?.route).toBeUndefined();
      });

      it('builds the evidence fields without fabricating a Thread delta', () => {
        const sessions = [
          practice('p1', '2026-10-05', { anchorId: 'anchor-100', threadStrengthAfter: 63 }),
          practice('p2', '2026-10-04', { anchorId: 'anchor-100', threadStrengthAfter: 60 }),
        ];
        const model = toV2ProgressModel(mockAnchor, [], sessions, {
          weekHistory: [true, false, false, false, false, false, false],
          weekHistoryKey: '2026-W41',
          lastGraceDayUsedAt: null,
          now: NOW,
        });
        expect(model?.week?.days[0]).toBe(true);
        expect(model?.streak?.current).toBe(2);
        expect(model?.rhythm?.Week.practices).toBe(1);
        expect(model?.heatmap?.Month).toHaveLength(35);
        expect(model?.spark).toHaveLength(2);
        expect(model?.route).toBeNull();
        expect(model?.lastPracticedAt).toBe(sessions[0].completedAt);
        for (const event of model?.events ?? []) expect(event.authoritativeDelta).toBeNull();
      });

      it('falls back to the store last-practice date only when no session records exist', () => {
        const none = toV2ProgressModel(mockAnchor, [], [], { lastPrimedAt: '2026-10-03', now: NOW });
        expect(none?.lastPracticedAt).toBe('2026-10-03');
        const other = toV2ProgressModel(
          mockAnchor,
          [],
          [practice('o', '2026-10-04', { anchorId: 'someone-else' })],
          { lastPrimedAt: '2026-10-03', now: NOW },
        );
        expect(other?.lastPracticedAt).toBeNull();
      });
    });
  });
});
