import { useMilestoneCelebrationStore } from '../milestoneCelebrationStore';
import type { MilestoneRecord } from '@/milestones/milestoneModel';

const rec = (id: string, definitionId: string, earnedAt: string, celebratedAt: string | null = null): MilestoneRecord => ({
  id,
  anchorId: 'a1',
  definitionId,
  definitionVersion: 1,
  earnedAt,
  sourceKind: 'PRACTICE_COMPLETION',
  sourceEntityId: null,
  metadata: {},
  celebratedAt,
});

const store = () => useMilestoneCelebrationStore.getState();

describe('milestoneCelebrationStore', () => {
  it('fades only the first simultaneous award from cream and consumes a measured practice origin once', () => {
    store().setOrigin({ anchorId: 'a1', sessionId: 's1', x: 120, y: 260 });
    const first = { ...rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z'), sourceEntityId: 's1' };
    store().enqueueAwards([first, { ...first, id: 'm2', definitionId: 'strength.building' }], 'u');
    expect(store().queue.map(item => item.transition)).toEqual([true, false]);
    expect(store().takeOrigin(first)).toEqual({ x: 120, y: 260 });
    expect(store().takeOrigin(first)).toBeUndefined();
  });
  beforeEach(() => store().reset());

  it('queues uncelebrated milestones oldest first', () => {
    const added = store().enqueueAwards(
      [rec('m2', 'strength.established', '2026-10-02T00:00:00Z'), rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z')],
      'user-1',
    );
    expect(added).toBe(2);
    expect(store().queue.map((item) => item.record.id)).toEqual(['m1', 'm2']);
    expect(store().queue.every((item) => item.mode === 'award' && item.accountId === 'user-1')).toBe(true);
  });

  it('never queues an already celebrated milestone', () => {
    expect(store().enqueueAwards([rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z', '2026-10-01T00:01:00Z')], 'u')).toBe(0);
    expect(store().queue).toEqual([]);
  });

  it('never queues the same milestone twice in a session, even from repeated reads', () => {
    const r = rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z');
    store().enqueueAwards([r], 'u');
    store().shift('award:m1');
    // A stale read still shows it uncelebrated; it must not come back.
    expect(store().enqueueAwards([r], 'u')).toBe(0);
    expect(store().queue).toEqual([]);
  });

  it('skips records this app version has no definition for', () => {
    expect(store().enqueueAwards([rec('mx', 'future.unknown', '2026-10-01T00:00:00Z')], 'u')).toBe(0);
  });

  it('puts new awards ahead of a replay that is already waiting', () => {
    const earned = rec('m1', 'strength.building', '2026-09-01T00:00:00Z', '2026-09-01T00:01:00Z');
    store().requestReplay(earned);
    store().enqueueAwards([rec('m2', 'commitment.practices.1', '2026-10-01T00:00:00Z')], 'u');
    expect(store().queue.map((item) => item.mode)).toEqual(['award', 'replay']);
  });

  it('queues a replay once at a time, with no account so it can never settle', () => {
    const earned = rec('m1', 'strength.building', '2026-09-01T00:00:00Z', '2026-09-01T00:01:00Z');
    store().requestReplay(earned);
    store().requestReplay(earned);
    expect(store().queue).toHaveLength(1);
    expect(store().queue[0]).toMatchObject({ mode: 'replay', accountId: null });
  });

  it('lets a milestone be replayed again after its replay finished', () => {
    const earned = rec('m1', 'strength.building', '2026-09-01T00:00:00Z', '2026-09-01T00:01:00Z');
    store().requestReplay(earned);
    store().shift(store().queue[0].key);
    store().requestReplay(earned);
    expect(store().queue).toHaveLength(1);
  });

  it('ignores a replay request for a milestone it cannot draw', () => {
    store().requestReplay(rec('mx', 'future.unknown', '2026-10-01T00:00:00Z'));
    expect(store().queue).toEqual([]);
  });
});
