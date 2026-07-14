import { checkAndRecordMilestones, getMilestoneLedger } from '@/utils/milestoneTracking';
import { useForgeMomentStore } from '../forgeMomentStore';

describe('forgeMomentStore', () => {
  beforeEach(() => {
    useForgeMomentStore.getState().resetMilestones();
  });

  it('rehydrates the persisted outbox and does not replay a shown award', async () => {
    const scopeId = `forge-hydration-${Date.now()}`;
    await checkAndRecordMilestones(
      { totalPrimes: 10, practiceDays: 3, releasedAnchors: 0 },
      { scopeId }
    );

    await useForgeMomentStore.getState().hydrateScope(scopeId);
    expect(useForgeMomentStore.getState().activeMilestone?.id).toBe('rank.practitioner');
    expect(useForgeMomentStore.getState().queuedMilestones.map(item => item.id)).toEqual([
      'mark.first_return',
    ]);

    await useForgeMomentStore.getState().markActiveShown();
    useForgeMomentStore.getState().resetMilestones();
    await useForgeMomentStore.getState().hydrateScope(scopeId);

    expect(useForgeMomentStore.getState().activeMilestone?.id).toBe('mark.first_return');
    expect((await getMilestoneLedger(scopeId)).awards['rank.practitioner']?.status).toBe(
      'shown'
    );
  });

  it('deduplicates simultaneous in-memory developer previews', async () => {
    const preview = { type: 'rank' as const, name: 'Preview' };
    const results = await Promise.all([
      useForgeMomentStore.getState().queueMilestone(preview),
      useForgeMomentStore.getState().queueMilestone(preview),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(useForgeMomentStore.getState().activeMilestone).toEqual(preview);
    expect(useForgeMomentStore.getState().queuedMilestones).toEqual([]);
  });
});
