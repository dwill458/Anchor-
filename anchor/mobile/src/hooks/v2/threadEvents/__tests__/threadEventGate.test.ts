import { isAlreadyCelebrated, localStageForServerEvent } from '../threadEventGate';
import type { V2PersistedThreadEvent } from '@/adapters/v2/threadEvents';

const serverEvent = (overrides: Partial<V2PersistedThreadEvent> & { threadValue?: number } = {}): V2PersistedThreadEvent => {
  const { threadValue, ...rest } = overrides;
  return {
    eventId: 'te-1', ledgerSequence: '1', anchorId: 'anchor-1', eventType: 'EVOLUTION_STAGE_REACHED', significance: 'HIGH',
    occurredAt: '2026-09-08T12:00:00.000Z', sourceKind: 'THREAD_ENGINE', correlationId: 'c-1', correlationSequence: 1,
    eventVersion: 1, detectorVersion: 'v1', metadata: { thresholdValue: 25, stageName: 'Rooted', ...(threadValue === undefined ? {} : { threadValue }) },
    createdAt: '2026-09-08T12:00:00.000Z', ...rest,
  };
};

describe('localStageForServerEvent', () => {
  it('maps the persisted Thread value through the same rule Progress uses', () => {
    expect(localStageForServerEvent(serverEvent({ threadValue: 10 }))).toBeNull();
    expect(localStageForServerEvent(serverEvent({ threadValue: 25 }))).toBe('building');
    expect(localStageForServerEvent(serverEvent({ threadValue: 50 }))).toBe('established');
    expect(localStageForServerEvent(serverEvent({ threadValue: 75 }))).toBe('integrated');
    expect(localStageForServerEvent(serverEvent({ threadValue: 90 }))).toBe('reinforced');
    expect(localStageForServerEvent(serverEvent({ threadValue: 100 }))).toBe('reinforced');
  });

  it('returns null without a usable Thread value', () => {
    expect(localStageForServerEvent(serverEvent())).toBeNull();
    expect(localStageForServerEvent(serverEvent({ threadValue: Number.NaN }))).toBeNull();
  });

  it('returns null for any event type other than a stage', () => {
    expect(localStageForServerEvent(serverEvent({ eventType: 'WAYPOINT_REACHED', threadValue: 50 }))).toBeNull();
  });
});

describe('isAlreadyCelebrated', () => {
  const records = { 'anchor-1': { stages: { established: '2026-08-06T09:30:00.000Z' } } };

  it('is true when the device has celebrated the stage for this Anchor', () => {
    expect(isAlreadyCelebrated(serverEvent({ threadValue: 50 }), records)).toBe(true);
  });

  it('is false for a stage the device has not celebrated, or another Anchor', () => {
    expect(isAlreadyCelebrated(serverEvent({ threadValue: 75 }), records)).toBe(false);
    expect(isAlreadyCelebrated(serverEvent({ threadValue: 50, anchorId: 'anchor-2' }), records)).toBe(false);
  });

  it('is false when the event has no anchor id', () => {
    expect(isAlreadyCelebrated(serverEvent({ threadValue: 50, anchorId: null }), records)).toBe(false);
  });
});
