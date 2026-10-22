import { DEV_MILESTONE_LABELS, isDevMilestoneRecord, makeDevMilestoneRecord } from '../devTrigger';
import { MILESTONE_SPECS, describeEarnedValue, getMilestoneSpec } from '../registry';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';

describe('dev milestone trigger', () => {
  beforeEach(() => useMilestoneCelebrationStore.getState().reset());

  it('builds a record for every milestone, marked as a dev trigger and already settled', () => {
    for (const spec of MILESTONE_SPECS) {
      const record = makeDevMilestoneRecord(spec.id, 'a1')!;
      expect(record.definitionId).toBe(spec.id);
      expect(isDevMilestoneRecord(record)).toBe(true);
      expect(record.sourceKind).toBe('DEV_TRIGGER');
      expect(record.celebratedAt).not.toBeNull();
    }
    expect(DEV_MILESTONE_LABELS).toHaveLength(MILESTONE_SPECS.length);
  });

  it('carries sample values the celebration can describe', () => {
    const value = (id: string) => describeEarnedValue(getMilestoneSpec(id)!, makeDevMilestoneRecord(id, 'a1')!.metadata);
    expect(value('strength.integrated')).toBe('Thread Strength was 75 when you reached it.');
    expect(value('commitment.practices.30')).toBe('Practice number 30.');
    expect(value('commitment.minutes.500')).toBe('Passed 500 total minutes.');
    expect(value('journey.halfway')).toBe('Your Chart had 6 waypoints.');
  });

  it('returns null for an unknown definition', () => {
    expect(makeDevMilestoneRecord('future.unknown', 'a1')).toBeNull();
  });

  it('can only ever be queued as a replay, never as an award, so it cannot be saved or settled', () => {
    const record = makeDevMilestoneRecord('strength.full', 'a1')!;
    // Even handed to the award path, an already-celebrated record is refused.
    expect(useMilestoneCelebrationStore.getState().enqueueAwards([record], 'user-1')).toBe(0);
    useMilestoneCelebrationStore.getState().requestReplay(record);
    expect(useMilestoneCelebrationStore.getState().queue.map((item) => item.mode)).toEqual(['replay']);
  });
});
