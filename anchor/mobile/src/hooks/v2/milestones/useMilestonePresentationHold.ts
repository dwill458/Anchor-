import { useId, useLayoutEffect } from 'react';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';

/** A mounted active task owns its hold; cleanup always frees it, including navigation away. */
export function useMilestonePresentationHold(held: boolean): void {
  const key = useId();
  useLayoutEffect(() => {
    if (!held) return;
    useMilestoneCelebrationStore.getState().hold(key);
    return () => useMilestoneCelebrationStore.getState().release(key);
  }, [held, key]);
}
