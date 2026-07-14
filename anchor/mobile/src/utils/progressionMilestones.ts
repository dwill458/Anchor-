import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useForgeMomentStore } from '@/stores/forgeMomentStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import {
  getPracticeDays,
  getReleasedAnchorCount,
  getTotalPrimes,
} from '@/utils/progression';
import {
  backfillMilestoneDates,
  checkAndRecordMilestones,
} from '@/utils/milestoneTracking';

function getProgressionSnapshot() {
  const anchors = useAnchorStore.getState().anchors;
  const storedTotalPrimes = useAnchorStore.getState().totalPrimes;
  const primingHistory = useSessionStore.getState().primingHistory ?? [];
  const profile = useProfileStore.getState();
  const timezone = profile.timezone;
  const scopeId =
    useAuthStore.getState().user?.id ??
    profile.ownerUserId ??
    null;

  return {
    metrics: {
      totalPrimes: Math.max(storedTotalPrimes, getTotalPrimes(primingHistory)),
      practiceDays: getPracticeDays(primingHistory, timezone),
      releasedAnchors: getReleasedAnchorCount(anchors),
    },
    scopeId,
    timezone,
  };
}

/**
 * Establishes a one-time baseline for accounts that predate the durable ledger.
 * Existing achievements are remembered as already shown; later crossings still
 * enter the outbox normally.
 */
export async function initializeProgressionMilestonesFromStores(): Promise<boolean> {
  const { metrics, scopeId, timezone } = getProgressionSnapshot();
  if (!scopeId) return false;
  const baseline = await backfillMilestoneDates(metrics, { scopeId, timezone });
  if (baseline === 'failed') return false;
  await useForgeMomentStore.getState().hydrateScope(scopeId);
  return true;
}

export async function queueProgressionMilestonesFromStores(options?: {
  sourceEventId?: string;
}): Promise<void> {
  const { metrics, scopeId, timezone } = getProgressionSnapshot();
  if (!scopeId) return;
  const baseline = await backfillMilestoneDates(metrics, { scopeId, timezone });
  if (baseline !== 'unchanged') {
    // A newly persisted baseline represents achievements that existed before
    // this ledger was ready. Do not replay them as a current celebration.
    return;
  }
  await checkAndRecordMilestones(
    metrics,
    { scopeId, timezone, sourceEventId: options?.sourceEventId }
  );

  // Presentation is a projection of the durable outbox. Re-hydrating here also
  // recovers any previously awarded item that survived a process restart.
  await useForgeMomentStore.getState().hydrateScope(scopeId);
}
