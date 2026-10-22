import { bundleV2ThreadEvents, classifyV2ThreadEvent, intakeV2ThreadEvents } from '../threadEventAdapter';
import type { V2PersistedThreadEvent } from '../types';

const event = (overrides: Partial<V2PersistedThreadEvent> = {}): V2PersistedThreadEvent => ({
  eventId: 'te-1', ledgerSequence: '1', eventType: 'EVOLUTION_STAGE_REACHED', significance: 'HIGH', occurredAt: '2026-09-08T12:00:00.000Z', sourceKind: 'THREAD_ENGINE', correlationId: 'practice-1', correlationSequence: 1, eventVersion: 1, detectorVersion: 'v1', metadata: { thresholdValue: 10, stageName: 'Grounded', threadValue: 10 }, createdAt: '2026-09-08T12:00:00.000Z', ...overrides,
});

describe('Thread Event ledger intake', () => {
  it.each(['FOCUS_SESSION', 'DEEP_PRIME_SESSION', 'VISUALIZE_SESSION'])('accepts persisted events from %s completion intake', (completionType) => {
    expect(intakeV2ThreadEvents({ completionType, events: [event()] })).toHaveLength(1);
  });

  it('accepts Chart events without pretending they are Practice completions', () => {
    const waypoint = event({ eventId: 'waypoint-1', eventType: 'WAYPOINT_REACHED', sourceKind: 'COURSE_EVENT', metadata: { waypointTitle: 'Publish your work' } });
    expect(intakeV2ThreadEvents({ events: [waypoint] })).toEqual([waypoint]);
  });

  it.each([[10, 'Grounded'], [25, 'Rooted'], [50, 'Embedded'], [100, 'Sovereign']])('maps the server-persisted %i evolution threshold to %s', (thresholdValue, stageName) => {
    const result = classifyV2ThreadEvent(event({ metadata: { thresholdValue, stageName } }));
    expect(result.isEvolution).toBe(true);
    expect(result.persistedStage).toBe(stageName);
  });

  it('does not treat a current Thread value as an evolution transition', () => {
    expect(classifyV2ThreadEvent(event({ eventType: 'THREAD_STRENGTHENED', metadata: { threadValue: 100 } })).isEvolution).toBe(false);
  });

  it('selects one primary event and keeps only two supporting facts', () => {
    const bundles = bundleV2ThreadEvents([
      event({ eventId: 'strength', eventType: 'THREAD_STRENGTHENED', significance: 'LOW', correlationSequence: 1 }),
      event({ eventId: 'rooted', ledgerSequence: '2', correlationSequence: 2, metadata: { thresholdValue: 25, stageName: 'Rooted' } }),
      event({ eventId: 'practice-25', ledgerSequence: '3', eventType: 'PRACTICE_MILESTONE_REACHED', correlationSequence: 3, metadata: { practiceCount: 25 } }),
      event({ eventId: 'extra', ledgerSequence: '4', eventType: 'THREAD_STABILIZED', significance: 'MEDIUM', correlationSequence: 4 }),
    ]);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].primary.eventId).toBe('rooted');
    expect(bundles[0].supporting).toHaveLength(2);
  });
});
