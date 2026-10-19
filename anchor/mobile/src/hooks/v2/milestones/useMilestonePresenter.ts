import { useCallback, useEffect, useRef, useState } from 'react';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useMilestoneCelebrationStore, type MilestonePresentation } from '@/stores/v2/milestoneCelebrationStore';
import { getMilestoneSpec } from '@/milestones/registry';
import { settleMilestone } from '@/milestones/milestoneSnapshots';

export interface MilestonePresenter {
  /** The milestone being celebrated now, or null. At most one is ever on screen. */
  presenting: MilestonePresentation | null;
  /** The user finished it (Continue or dismiss). Settles an award's receipt. Safe to call twice. */
  finish: () => void;
}

/**
 * Plays queued milestones one at a time through the shared celebration coordinator. It never
 * starts while another scene (such as the practice completion) is playing: it waits for the
 * coordinator to go idle, so completion finishes its own transition first and is never preempted
 * or blocked. An award settles its receipt only when the user finishes it; if the coordinator
 * interrupts it (or the host unmounts) nothing is settled, so it simply plays again next time.
 * Replays settle nothing, ever.
 */
export function useMilestonePresenter(): MilestonePresenter {
  const head = useMilestoneCelebrationStore((state) => state.queue[0] ?? null);
  const shift = useMilestoneCelebrationStore((state) => state.shift);
  const [presenting, setPresenting] = useState<MilestonePresentation | null>(null);
  const presentingRef = useRef<MilestonePresentation | null>(null);
  presentingRef.current = presenting;

  const end = useCallback(
    (settle: boolean) => {
      const item = presentingRef.current;
      if (!item) return;
      presentingRef.current = null;
      useCelebrationStore.getState().finish(item.key);
      if (settle && item.mode === 'award' && item.accountId) void settleMilestone(item.accountId, item.record);
      shift(item.key);
      setPresenting(null);
    },
    [shift],
  );

  const finish = useCallback(() => end(true), [end]);

  useEffect(() => {
    if (!head || presenting) return;
    const spec = getMilestoneSpec(head.record.definitionId);
    if (!spec) {
      // A milestone from a newer app version: leave it recorded, never celebrate invented copy.
      shift(head.key);
      return;
    }

    const start = () => {
      const result = useCelebrationStore.getState().request(spec.celebration.level, head.key, {
        durationMs: spec.celebration.durationMs,
        // The coordinator only skips or preempts to make room for something else: not a user finish.
        onSkip: () => end(false),
        onStart: () => setPresenting(head),
      });
      if (result === 'play') setPresenting(head);
    };

    if (!useCelebrationStore.getState().current) {
      start();
      return;
    }
    // Something else is playing (usually the practice completion). Wait for idle, then start.
    const unsubscribe = useCelebrationStore.subscribe((state) => {
      if (state.current) return;
      unsubscribe();
      start();
    });
    return unsubscribe;
  }, [end, head, presenting, shift]);

  // Leaving while a celebration is up frees the coordinator and settles nothing.
  useEffect(() => () => end(false), [end]);

  return { presenting, finish };
}
