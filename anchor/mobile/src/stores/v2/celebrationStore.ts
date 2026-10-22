import { create } from 'zustand';

/**
 * Central celebration coordinator. Every celebration scene goes through here: a scene asks
 * `request` before it plays and calls `finish` when it settles, so no two scenes play at once.
 *
 * - A higher level preempts the active scene. Its `onSkip` lands it on the settled end state
 *   and it is dropped, not requeued.
 * - An equal or lower level waits in the queue (level descending, then first in, first out)
 *   and starts through its `onStart` when promoted. Level 1 (quiet) is dropped instead of waiting.
 * - Scenes over CELEBRATION_SKIPPABLE_AFTER_MS can be skipped; skipping lands on `onSkip`.
 *
 * This store sequences scenes only. Reduce Motion is the scene's responsibility: it resolves to
 * the end state with a short crossfade (see hooks/useReduceMotionEnabled.ts). Sound and haptics
 * go through safeHaptics and the SoundPool / CreationSounds families, never directly.
 * Session-only: never persisted.
 */

export type CelebrationLevel = 1 | 2 | 3 | 4;

export const CELEBRATION_SKIPPABLE_AFTER_MS = 2500;

export type CelebrationRequestResult = 'play' | 'deferred' | 'dropped' | 'duplicate';

export type CelebrationOptions = {
  /** How long the scene runs. Without it, or at or under the threshold, the scene is not skippable. */
  durationMs?: number;
  /** Called when a deferred scene is promoted to active. Not called for 'play': the caller starts that. */
  onStart?: () => void;
  /** Called on preemption or skip. Must land the scene on its settled end state. */
  onSkip?: () => void;
};

export type ActiveCelebration = {
  id: string;
  level: CelebrationLevel;
  skippable: boolean;
};

type Scene = CelebrationOptions & { id: string; level: CelebrationLevel };

type CelebrationState = {
  /** The scene that is playing now, or null. */
  active: ActiveCelebration | null;
  /** How many scenes are waiting behind the active one. */
  queueLength: number;
  /** Full records behind the public view above. */
  current: Scene | null;
  queue: Scene[];
  request: (level: CelebrationLevel, id: string, opts?: CelebrationOptions) => CelebrationRequestResult;
  /** The scene with this id is done: an active one is cleared, a queued one is removed. */
  finish: (id: string) => void;
  /** Skips the active scene if it is skippable. Returns whether it skipped. */
  skip: () => boolean;
  reset: () => void;
};

const isSkippable = (durationMs: number | undefined): boolean =>
  durationMs !== undefined && durationMs > CELEBRATION_SKIPPABLE_AFTER_MS;

/** A scene's callback must never break the coordinator, so failures are logged and dropped. */
function runCallback(name: string, callback: (() => void) | undefined): void {
  if (!callback) return;
  try {
    callback();
  } catch (error) {
    console.warn(`[celebration] ${name} threw`, error);
  }
}

function toActive(scene: Scene | null): ActiveCelebration | null {
  return scene ? { id: scene.id, level: scene.level, skippable: isSkippable(scene.durationMs) } : null;
}

/** Level descending; within a level, a new scene goes after the ones already waiting. */
function insertByPriority(queue: Scene[], scene: Scene): Scene[] {
  const index = queue.findIndex((queued) => queued.level < scene.level);
  if (index === -1) return [...queue, scene];
  return [...queue.slice(0, index), scene, ...queue.slice(index)];
}

export const useCelebrationStore = create<CelebrationState>()((set, get) => {
  const setSlots = (current: Scene | null, queue: Scene[]) =>
    set({ current, queue, active: toActive(current), queueLength: queue.length });

  /** Makes the head of the queue active and starts it. Leaves the slot empty when nothing waits. */
  const promoteHead = () => {
    const [head, ...rest] = get().queue;
    setSlots(head ?? null, rest);
    if (head) runCallback('onStart', head.onStart);
  };

  return {
    active: null,
    queueLength: 0,
    current: null,
    queue: [],

    request: (level, id, opts = {}) => {
      const { current, queue } = get();
      if (current?.id === id) return 'duplicate';
      if (queue.some((queued) => queued.id === id)) return 'deferred';

      const scene: Scene = { ...opts, id, level };

      if (!current) {
        setSlots(scene, queue);
        return 'play';
      }

      if (level > current.level) {
        // Swap first so an onSkip that calls back into the store sees the new state.
        setSlots(scene, queue);
        runCallback('onSkip', current.onSkip);
        return 'play';
      }

      if (level === 1) return 'dropped';

      setSlots(current, insertByPriority(queue, scene));
      return 'deferred';
    },

    finish: (id) => {
      const { current, queue } = get();
      if (current?.id === id) {
        promoteHead();
        return;
      }
      if (queue.some((queued) => queued.id === id)) {
        setSlots(current, queue.filter((queued) => queued.id !== id));
      }
    },

    skip: () => {
      const { current } = get();
      if (!current || !isSkippable(current.durationMs)) return false;
      runCallback('onSkip', current.onSkip);
      get().finish(current.id);
      return true;
    },

    reset: () => set({ current: null, queue: [], active: null, queueLength: 0 }),
  };
});

/** Thin React binding: the active scene, the queue length, and the coordinator actions. */
export function useCelebration() {
  const active = useCelebrationStore((state) => state.active);
  const queueLength = useCelebrationStore((state) => state.queueLength);
  const request = useCelebrationStore((state) => state.request);
  const finish = useCelebrationStore((state) => state.finish);
  const skip = useCelebrationStore((state) => state.skip);
  return { active, queueLength, request, finish, skip };
}
