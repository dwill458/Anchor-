import { useAnchorStore } from '@/stores/anchorStore';
import { useForgeMomentStore } from '@/stores/forgeMomentStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import {
  getCurrentRank,
  getEarnedMarkNames,
  getPracticeDays,
  getReleasedAnchorCount,
  getTotalPrimes,
} from '@/utils/progression';
import { checkAndRecordMilestones } from '@/utils/milestoneTracking';

export async function queueProgressionMilestonesFromStores(): Promise<void> {
  const anchors = useAnchorStore.getState().anchors;
  const storedTotalPrimes = useAnchorStore.getState().totalPrimes;
  const primingHistory = useSessionStore.getState().primingHistory ?? [];
  const timezone = useProfileStore.getState().timezone;

  const countedPrimes = getTotalPrimes(primingHistory);
  const totalPrimes = Math.max(storedTotalPrimes, countedPrimes);
  const practiceDays = getPracticeDays(primingHistory, timezone);
  const releasedAnchors = getReleasedAnchorCount(anchors);
  const rank = getCurrentRank({
    totalPrimes,
    practiceDays,
    releasedAnchors,
  });

  const recorded = await checkAndRecordMilestones({
    totalPrimes,
    practiceDays,
    releasedAnchors,
  });

  const queueMilestone = useForgeMomentStore.getState().queueMilestone;

  for (const rankName of recorded.rank) {
    if (rankName === 'Initiate') {
      continue;
    }

    await queueMilestone({
      type: 'rank',
      name: rankName,
      primeCount: totalPrimes,
    });
  }

  const earnedMarks = getEarnedMarkNames(practiceDays);
  for (const markName of recorded.mark) {
    const markIndex = earnedMarks.findIndex((name) => name === markName);
    await queueMilestone({
      type: 'mark',
      name: markName,
      rankName: rank.tier.name,
      markIndex,
    });
  }
}
