/**
 * Practice completion scene (celebration Step 3, P1 and P2). One hook drives the Thread Strength
 * bar on every practice-complete screen (Focus, Deep Focus, Visualize), so the timing, the cue and
 * the coordinator request live in one place rather than in each screen.
 *
 * - P1, first practice ever (level 3, about 3.9s): the Thread label appears, the bar fills to the
 *   real new value, the settle cue and a Medium haptic land at the end of the fill, then
 *   "Your Thread has begun." settles in.
 * - P2, repeat practice (level 2, about 2.5s): the old value is struck through, the bar and the glow
 *   swell to the real new value, one settle cue and a Light haptic, then "Reinforced today".
 * - A zero or negative gain animates nothing and plays no cue, haptic or coordinator request.
 * - A session whose scene already played (a remount) lands on its settled end state, no replay.
 * - Reduce Motion: no travel. The bar snaps to its value; the words and figures crossfade; the settle
 *   cue and haptic still fire; P1 registers at level 2.
 * - Skip (scenes over 2.5s): the store calls onSkip, which lands the settled end state. A tap also
 *   fires the settle beat once, because the tap is the commitment; a preemption by a higher scene
 *   lands silently so two cues never overlap.
 *
 * Thread Strength is read only. The before and after values come from the caller and are never
 * computed or changed here. Sound goes through playCreationSound('threadSettle') with the once-per-
 * session claim; haptics go through safeHaptics.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { AnchorMotion } from '@/theme/v2';
import { playCreationSound } from '@/services/CreationSounds';
import { useSessionStore } from '@/stores/sessionStore';
import { useTeachingStore } from '@/stores/teachingStore';
import { useCelebrationStore, type CelebrationLevel } from '@/stores/v2/celebrationStore';
import { safeHaptics } from '@/utils/haptics';

export type PracticeSceneKind = 'first' | 'repeat' | 'none';
export type PracticeScenePhase = 'idle' | 'playing' | 'settled';
type PlayedKind = Exclude<PracticeSceneKind, 'none'>;

/** Prototype timings in milliseconds, measured from the scene start. */
export const PRACTICE_SCENE_TIMING = {
  first: {
    level: 3 as CelebrationLevel,
    durationMs: 3900,
    labelAtMs: 600,
    labelInMs: 300,
    fillAtMs: 900,
    fillMs: 1400,
    noteAtMs: 2500,
    noteInMs: 500,
    glowFrom: 0.22,
    glowTo: 0.36,
    settleHaptic: Haptics.ImpactFeedbackStyle.Medium,
  },
  repeat: {
    level: 2 as CelebrationLevel,
    durationMs: 2500,
    fillAtMs: 500,
    fillMs: 1000,
    noteAtMs: 1500,
    noteInMs: 300,
    glowFrom: 0.32,
    glowTo: 0.38,
    settleHaptic: Haptics.ImpactFeedbackStyle.Light,
  },
  valueInMs: 300,
  crossfadeMs: 240,
  glowRest: 0.32,
} as const;

/** Process memory only. The Thread settle cue plays once per session, whatever the remounts. */
let threadSettleSessionId: string | null = null;
const threadSettlePlayedIds = new Set<string>();
function claimThreadSettle(sessionId: string): boolean {
  if (sessionId !== threadSettleSessionId) {
    threadSettlePlayedIds.clear();
    threadSettleSessionId = sessionId;
  }
  if (threadSettlePlayedIds.has(sessionId)) return false;
  threadSettlePlayedIds.add(sessionId);
  return true;
}

/** Process memory only. Which scene each completed session already played, so a remount does not replay it. */
const PLAYED_SCENE_LIMIT = 20;
const playedScenes = new Map<string, PlayedKind>();
function rememberPlayed(key: string, kind: PlayedKind): void {
  playedScenes.delete(key);
  playedScenes.set(key, kind);
  while (playedScenes.size > PLAYED_SCENE_LIMIT) {
    const oldest = playedScenes.keys().next().value;
    if (oldest === undefined) break;
    playedScenes.delete(oldest);
  }
}

let mountCounter = 0;

const clampStrength = (value: number): number => Math.max(0, Math.min(100, value));

/**
 * First practice ever: no completed practice other than this session in the local practice history,
 * and the lifetime session count (which hydrates from the server) is no more than this session.
 * The practice history is the canonical per-user record list, hydrated at sign-in; the count is the
 * server-backed fallback for a new device whose history has not hydrated yet.
 */
export function isFirstPracticeEver(sessionId: string | null): boolean {
  const { practiceHistory, totalSessionsCount } = useSessionStore.getState();
  const hasPriorPractice = practiceHistory.some(
    (record) => record.id !== sessionId && record.completionStatus === 'completed',
  );
  return !hasPriorPractice && totalSessionsCount <= 1;
}

/** Which scene a completion earns. Only a real positive gain on a saved, authoritative session can earn one. */
export function planPracticeSceneKind(
  sessionId: string | null,
  gain: number,
  eligible: boolean,
): PracticeSceneKind {
  if (!eligible || !(gain > 0)) return 'none';
  const firstUnseen = !useTeachingStore.getState().userFlags.hasSeenFirstPracticeScene;
  return firstUnseen && isFirstPracticeEver(sessionId) ? 'first' : 'repeat';
}

export interface PracticeSceneValues {
  bar: number;
  glow: number;
  label: number;
  value: number;
  note: number;
}

/** The resting values of a scene: where it starts, or where it settles. Pure, so the timeline ends are testable. */
export function practiceSceneValues(
  kind: PracticeSceneKind,
  from: number,
  to: number,
  when: 'start' | 'final',
): PracticeSceneValues {
  if (kind === 'none') {
    return { bar: to / 100, glow: PRACTICE_SCENE_TIMING.glowRest, label: 1, value: 1, note: 1 };
  }
  const timing = PRACTICE_SCENE_TIMING[kind];
  if (when === 'final') {
    return { bar: to / 100, glow: timing.glowTo, label: 1, value: 1, note: 1 };
  }
  return {
    bar: from / 100,
    glow: timing.glowFrom,
    label: kind === 'first' ? 0 : 1,
    value: 0,
    note: 0,
  };
}

function playSettle(sessionId: string | null, kind: PlayedKind): void {
  if (!sessionId || claimThreadSettle(sessionId)) playCreationSound('threadSettle');
  void safeHaptics.impact(PRACTICE_SCENE_TIMING[kind].settleHaptic);
}

export interface PracticeCompletionSceneArgs {
  /** Stable id of the completed session. Null means the scene plays once per mount. */
  sessionId: string | null;
  /** Thread Strength before the session, as recorded. */
  fromValue: number;
  /** Thread Strength after the session, as recorded. */
  toValue: number;
  /** The session was saved and both values are authoritative. */
  eligible: boolean;
  reduceMotion: boolean;
}

export interface PracticeCompletionScene {
  /** The scene that is playing or has played. 'none' when nothing animates. */
  kind: PracticeSceneKind;
  phase: PracticeScenePhase;
  /** 0 to 1 bar fill. */
  barProgress: SharedValue<number>;
  /** Opacity of the artwork atmosphere, the glow behind the Anchor. */
  glowOpacity: SharedValue<number>;
  /** Opacity of the "THREAD STRENGTH" label (P1 only; the label is otherwise always visible). */
  labelOpacity: SharedValue<number>;
  /** Opacity of the new value and the movement figure, which appear at the settle. */
  valueOpacity: SharedValue<number>;
  /** Opacity of the scene's closing note: the "Your Thread has begun." line or the "Reinforced today" badge. */
  noteOpacity: SharedValue<number>;
  /** True only while this scene is the active skippable one. */
  canSkip: boolean;
  /** A tap on the scene: lands it on its settled end state and fires the settle beat once. */
  skip: () => void;
}

export function usePracticeCompletionScene({
  sessionId,
  fromValue,
  toValue,
  eligible,
  reduceMotion,
}: PracticeCompletionSceneArgs): PracticeCompletionScene {
  const from = clampStrength(fromValue);
  const to = clampStrength(toValue);
  const [mountKey] = useState(() => {
    mountCounter += 1;
    return `practice-complete:mount-${mountCounter}`;
  });
  const sceneKey = sessionId ? `practice-complete:${sessionId}` : mountKey;

  const [initial] = useState(() => {
    const played = playedScenes.get(sceneKey);
    if (played) {
      return { kind: played as PracticeSceneKind, phase: 'settled' as PracticeScenePhase, values: practiceSceneValues(played, from, to, 'final') };
    }
    const planned = planPracticeSceneKind(sessionId, to - from, eligible);
    return {
      kind: planned,
      phase: 'idle' as PracticeScenePhase,
      values: practiceSceneValues(planned, from, to, planned === 'none' ? 'final' : 'start'),
    };
  });

  const barProgress = useSharedValue(initial.values.bar);
  const glowOpacity = useSharedValue(initial.values.glow);
  const labelOpacity = useSharedValue(initial.values.label);
  const valueOpacity = useSharedValue(initial.values.value);
  const noteOpacity = useSharedValue(initial.values.note);
  const [scene, setScene] = useState<{ kind: PracticeSceneKind; phase: PracticeScenePhase }>({
    kind: initial.kind,
    phase: initial.phase,
  });

  const runKey = useRef<string | null>(null);
  const started = useRef(false);
  const settled = useRef(false);
  const requested = useRef(false);
  const skipByUser = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current = [];
  }, []);

  const applyValues = (values: PracticeSceneValues) => {
    cancelAnimation(barProgress);
    cancelAnimation(glowOpacity);
    cancelAnimation(labelOpacity);
    cancelAnimation(valueOpacity);
    cancelAnimation(noteOpacity);
    barProgress.value = values.bar;
    glowOpacity.value = values.glow;
    labelOpacity.value = values.label;
    valueOpacity.value = values.value;
    noteOpacity.value = values.note;
  };

  // Leaving the screen, or switching to another session, releases the scene from the coordinator.
  useEffect(() => () => {
    clearTimers();
    if (requested.current) useCelebrationStore.getState().finish(sceneKey);
  }, [clearTimers, sceneKey]);

  useEffect(() => {
    if (!eligible) return;
    if (runKey.current !== sceneKey) {
      runKey.current = sceneKey;
      started.current = false;
      settled.current = false;
      requested.current = false;
    }

    const played = playedScenes.get(sceneKey);
    if (played) {
      if (!started.current) {
        applyValues(practiceSceneValues(played, from, to, 'final'));
        setScene({ kind: played, phase: 'settled' });
      }
      return;
    }
    if (started.current) return;

    const gain = to - from;
    const kind = planPracticeSceneKind(sessionId, gain, eligible);
    if (kind === 'none') {
      applyValues(practiceSceneValues('none', from, to, 'final'));
      return;
    }

    const timing = PRACTICE_SCENE_TIMING[kind];
    const schedule = (ms: number, callback: () => void) => {
      timers.current.push(setTimeout(callback, ms));
    };
    const settle = () => {
      if (settled.current) return;
      settled.current = true;
      playSettle(sessionId, kind);
    };
    const finishScene = () => {
      clearTimers();
      useCelebrationStore.getState().finish(sceneKey);
    };

    const begin = () => {
      if (started.current) return;
      started.current = true;
      rememberPlayed(sceneKey, kind);
      // The once-ever flag is written when the first scene actually starts, not when it is requested.
      if (kind === 'first') useTeachingStore.getState().setUserFlag('hasSeenFirstPracticeScene', true);
      setScene({ kind, phase: 'playing' });
      applyValues(practiceSceneValues(kind, from, to, 'start'));

      if (reduceMotion) {
        // No travel and no draw: the bar is at its value at once, and the words and figures crossfade.
        const crossfade = { duration: PRACTICE_SCENE_TIMING.crossfadeMs };
        barProgress.value = to / 100;
        glowOpacity.value = timing.glowTo;
        labelOpacity.value = withTiming(1, crossfade);
        valueOpacity.value = withTiming(1, crossfade);
        noteOpacity.value = withTiming(1, crossfade);
        settle();
        setScene({ kind, phase: 'settled' });
        schedule(PRACTICE_SCENE_TIMING.crossfadeMs, finishScene);
        return;
      }

      const settleAt = timing.fillAtMs + timing.fillMs;
      const ease = kind === 'first' ? Easing.inOut(Easing.ease) : AnchorMotion.easing.emphasized;
      barProgress.value = withDelay(
        timing.fillAtMs,
        withTiming(to / 100, { duration: timing.fillMs, easing: ease }),
      );
      glowOpacity.value = withDelay(
        timing.fillAtMs,
        withTiming(timing.glowTo, { duration: timing.fillMs, easing: ease }),
      );
      if (kind === 'first') {
        labelOpacity.value = withDelay(
          PRACTICE_SCENE_TIMING.first.labelAtMs,
          withTiming(1, { duration: PRACTICE_SCENE_TIMING.first.labelInMs }),
        );
      }
      valueOpacity.value = withDelay(settleAt, withTiming(1, { duration: PRACTICE_SCENE_TIMING.valueInMs }));
      noteOpacity.value = withDelay(timing.noteAtMs, withTiming(1, { duration: timing.noteInMs }));
      schedule(settleAt, () => {
        settle();
        setScene((previous) => ({ ...previous, phase: 'settled' }));
      });
      schedule(timing.durationMs, finishScene);
    };

    // Skip, or a higher scene preempting this one, lands on the settled end state.
    const onSkip = () => {
      if (!started.current) return;
      const byUser = skipByUser.current;
      clearTimers();
      applyValues(practiceSceneValues(kind, from, to, 'final'));
      if (byUser) settle();
      setScene({ kind, phase: 'settled' });
    };

    requested.current = true;
    const level: CelebrationLevel = reduceMotion ? 2 : timing.level;
    const outcome = useCelebrationStore.getState().request(level, sceneKey, {
      durationMs: timing.durationMs,
      onStart: begin,
      onSkip,
    });
    // 'deferred' waits in the coordinator queue and starts through onStart when promoted.
    if (outcome === 'play') begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, from, to, sceneKey, sessionId, reduceMotion]);

  const canSkip = useCelebrationStore((state) =>
    Boolean(state.active && state.active.id === sceneKey && state.active.skippable),
  );

  const skip = useCallback(() => {
    skipByUser.current = true;
    try {
      useCelebrationStore.getState().skip();
    } finally {
      skipByUser.current = false;
    }
  }, []);

  return {
    kind: scene.kind,
    phase: scene.phase,
    barProgress,
    glowOpacity,
    labelOpacity,
    valueOpacity,
    noteOpacity,
    canSkip,
    skip,
  };
}
