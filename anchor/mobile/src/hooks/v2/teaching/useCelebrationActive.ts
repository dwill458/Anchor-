import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';

/** Read-only: teaching yields to celebrations and never holds their presentation. */
export function useCelebrationActive(): boolean {
  const milestonePending = useMilestoneCelebrationStore(state => state.queue.length > 0);
  const scenePending = useCelebrationStore(state => state.active !== null || state.queueLength > 0);
  return milestonePending || scenePending;
}
