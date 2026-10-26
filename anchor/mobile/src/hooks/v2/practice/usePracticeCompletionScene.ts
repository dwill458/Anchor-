/**
 * Practice completion scenes (celebration Steps 3 and 4). One hook drives the Thread Strength bar on
 * every practice-complete screen (Focus, Deep Focus, Visualize), so the timing, the cue and the
 * coordinator request live in one place rather than in each screen.
 *
 * - P1, first practice ever (level 3, about 3.9s): the Thread label appears, the bar fills to the
 *   real new value, the Thread wake cue and a Medium haptic land at the end of the fill, then
 *   "Your Thread has begun." settles in.
 * - P2, repeat practice (level 2, about 2.5s): the old value is struck through, the bar and the glow
 *   swell to the real new value, the reinforcement cue and a Light haptic, then "Reinforced today".
 * - P4, stage reached (level 3, about 3.8s; Reinforced level 4, about 4.6s): the bar fills, the
 *   five-segment stage strip rises, the new stage's segment fills gold and its stage chord lands with
 *   a Medium haptic. Once per Anchor per stage. Re-reaching a stage after decay is a relight (level 2,
 *   under 2.0s, not skippable): the segment relights with its short cue and one Light haptic. The cue is omitted under Reduce Motion. No sentence. A
 *   stage replaces P2 for that completion.
 * - P5, Full Strength (a ceiling at 100, not a stage): first time per Anchor, level 4 (about 4.6s),
 *   the bar fills, a gold ring draws, the Full Strength cue and a Medium haptic land, the ring closes with a Light
 *   haptic. Back at 100 after decay: short (level 3, about 3.2s), a Light wake haptic, no chord. A
 *   completion that crosses a stage and reaches 100 plays P5 only, and the stage is still recorded.
 * - Records come from celebrationRecordsStore and are read only after hydration. Before hydration, or
 *   if the read times out, the completion falls back to P1/P2, so an unread record cannot replay a
 *   full scene. Records are written only through the store, once the scene has been decided.
 * - A zero or negative gain animates nothing and plays no cue, haptic or coordinator request.
 * - A session whose scene already played (a remount) lands on its settled end state, no replay.
 * - Reduce Motion: no travel and no draw. The bar snaps to its value; the words and figures crossfade;
 *   the settle beat (cue and haptic) fires at once; motion-timed extra haptics are dropped. Full scenes
 *   register at level 2 in that mode; the relight is level 2 already.
 * - Skip (scenes over 2.5s): the store calls onSkip, which lands the settled end state. A tap also
 *   fires the settle beat once, because the tap is the commitment; a preemption by a higher scene
 *   lands silently so two cues never overlap. A level 1 scene dropped by the coordinator lands
 *   silently (no practice scene is level 1 now; the branch is kept for the coordinator contract).
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
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { resolveEvolutionStage } from '@/adapters/v2/progress/progressAdapter';
import { AnchorMotion } from '@/theme/v2';
import { playCreationSound, type CreationSoundKey } from '@/services/CreationSounds';
import { SoundPool } from '@/services/audio/SoundPool';
import {
  celebrationRecordsReady,
  useCelebrationRecordsStore,
  type CelebratedStageId,
  type CelebrationOutcome,
} from '@/stores/v2/celebrationRecordsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTeachingStore } from '@/stores/teachingStore';
import { useCelebrationStore, type CelebrationLevel } from '@/stores/v2/celebrationStore';
import { safeHaptics } from '@/utils/haptics';

/** Scenes that are actually timed. 'none' (nothing animates) and 'pending' (awaiting records) are not. */
export type PracticeSceneKind =
  | 'none'
  | 'pending'
  | 'first'
  | 'repeat'
  | 'stageFirst'
  | 'stageReinforced'
  | 'stageRelight'
  | 'fullFirst'
  | 'fullRepeat';
export type PracticeScenePhase = 'idle' | 'playing' | 'settled';
type PlayedKind = Exclude<PracticeSceneKind, 'none' | 'pending'>;

/** One scene's timeline, in milliseconds from the scene start. Optional beats only exist on the scenes that use them. */
export interface PracticeSceneTiming {
  level: CelebrationLevel;
  durationMs: number;
  fillAtMs: number;
  fillMs: number;
  glowFrom: number;
  glowTo: number;
  /** Peak of the Full Strength glow bloom, timed to the ring draw. */
  bloomTo?: number;
  /** When the settle beat fires: the cue (if any) and the settle haptic. */
  settleAtMs: number;
  settleHaptic: Haptics.ImpactFeedbackStyle;
  /** Whether the settle beat carries a once-per-session Thread cue. */
  chord: boolean;
  noteAtMs: number;
  noteInMs: number;
  labelAtMs?: number;
  labelInMs?: number;
  stripAtMs?: number;
  stripInMs?: number;
  segmentAtMs?: number;
  segmentMs?: number;
  ringAtMs?: number;
  ringMs?: number;
  /** A haptic that belongs to a motion step (the ring closing). Dropped under Reduce Motion. */
  extraHaptic?: { atMs: number; style: Haptics.ImpactFeedbackStyle };
  sublineAtMs?: number;
  sublineInMs?: number;
}

/** Prototype timings in milliseconds, measured from the scene start. */
export const PRACTICE_SCENE_TIMING: Record<PlayedKind, PracticeSceneTiming> & {
  valueInMs: number;
  crossfadeMs: number;
  glowRest: number;
} = {
  first: {
    level: 3,
    durationMs: 3900,
    labelAtMs: 600,
    labelInMs: 300,
    fillAtMs: 900,
    fillMs: 1400,
    glowFrom: 0.22,
    glowTo: 0.36,
    settleAtMs: 2300,
    settleHaptic: Haptics.ImpactFeedbackStyle.Medium,
    chord: true,
    noteAtMs: 2500,
    noteInMs: 500,
  },
  repeat: {
    level: 2,
    durationMs: 2500,
    fillAtMs: 500,
    fillMs: 1000,
    glowFrom: 0.32,
    glowTo: 0.38,
    settleAtMs: 1500,
    settleHaptic: Haptics.ImpactFeedbackStyle.Light,
    chord: true,
    noteAtMs: 1500,
    noteInMs: 300,
  },
  stageFirst: {
    level: 3,
    durationMs: 3800,
    fillAtMs: 500,
    fillMs: 1000,
    glowFrom: 0.32,
    glowTo: 0.38,
    stripAtMs: 1000,
    stripInMs: 350,
    segmentAtMs: 1350,
    segmentMs: 600,
    settleAtMs: 1950,
    settleHaptic: Haptics.ImpactFeedbackStyle.Medium,
    chord: true,
    noteAtMs: 2100,
    noteInMs: 500,
  },
  stageReinforced: {
    level: 4,
    durationMs: 4600,
    fillAtMs: 500,
    fillMs: 1000,
    glowFrom: 0.32,
    glowTo: 0.38,
    stripAtMs: 1000,
    stripInMs: 350,
    segmentAtMs: 1350,
    segmentMs: 600,
    settleAtMs: 1950,
    settleHaptic: Haptics.ImpactFeedbackStyle.Medium,
    chord: true,
    noteAtMs: 2100,
    noteInMs: 500,
  },
  // Re-reaching a stage after decay: a short reinforcement (level 2, under 2.0s, so never skippable).
  // The strip rises and the segment relights, with one Light haptic as it does. No chord and no
  // sentence: nothing is rendered for the note, so noteAtMs and noteInMs are inert here.
  stageRelight: {
    level: 2,
    durationMs: 1900,
    fillAtMs: 300,
    fillMs: 700,
    glowFrom: 0.32,
    glowTo: 0.38,
    stripAtMs: 600,
    stripInMs: 250,
    segmentAtMs: 850,
    segmentMs: 350,
    settleAtMs: 1200,
    settleHaptic: Haptics.ImpactFeedbackStyle.Light,
    chord: false,
    noteAtMs: 1200,
    noteInMs: 200,
  },
  fullFirst: {
    level: 4,
    durationMs: 4600,
    fillAtMs: 500,
    fillMs: 1000,
    glowFrom: 0.32,
    glowTo: 0.38,
    bloomTo: 0.6,
    ringAtMs: 2000,
    ringMs: 900,
    settleAtMs: 2000,
    settleHaptic: Haptics.ImpactFeedbackStyle.Medium,
    chord: true,
    extraHaptic: { atMs: 2900, style: Haptics.ImpactFeedbackStyle.Light },
    noteAtMs: 3000,
    noteInMs: 600,
    sublineAtMs: 3200,
    sublineInMs: 400,
  },
  fullRepeat: {
    level: 3,
    durationMs: 3200,
    fillAtMs: 500,
    fillMs: 1000,
    glowFrom: 0.32,
    glowTo: 0.38,
    settleAtMs: 1700,
    settleHaptic: Haptics.ImpactFeedbackStyle.Light,
    chord: false,
    noteAtMs: 1900,
    noteInMs: 400,
  },
  valueInMs: 300,
  crossfadeMs: 240,
  glowRest: 0.32,
};

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
const THREAD_CELEBRATION_POOL_KEYS = [
  'threadSettle',
  'threadWake',
  'threadStageChord_building',
  'threadStageChord_established',
  'threadStageChord_integrated',
  'threadReinforcedLow',
  'threadFullStrengthChord',
  'threadReinforce',
  'threadStageRelight',
].map((key) => `creation:${key}`);

const STAGE_RANK: Record<string, number> = {
  Unestablished: -1,
  Forming: 0,
  Building: 1,
  Established: 2,
  Integrated: 3,
  Reinforced: 4,
};

/** The four celebrated stages, keyed by the progress adapter's own names. Forming is not celebrated. */
const CELEBRATED_STAGE_BY_NAME: Record<string, CelebratedStageId> = {
  Building: 'building',
  Established: 'established',
  Integrated: 'integrated',
  Reinforced: 'reinforced',
};

/** The celebrated stage a Thread value sits in, derived by the progress adapter's resolver. Null below Building. */
export function celebratedStageFor(value: number): CelebratedStageId | null {
  return CELEBRATED_STAGE_BY_NAME[resolveEvolutionStage(value)] ?? null;
}

/**
 * The celebrated stage this completion carried the Thread up into, or null. Derived from the before and
 * after values only; nothing about the stage is stored on the Thread.
 */
export function stageCrossedBy(from: number, to: number): CelebratedStageId | null {
  if (!(to > from)) return null;
  const reached = celebratedStageFor(to);
  if (!reached) return null;
  return STAGE_RANK[resolveEvolutionStage(to)] > STAGE_RANK[resolveEvolutionStage(from)] ? reached : null;
}

/** Full Strength is the ceiling: a completion that carries the Thread from below 100 to 100. */
export function fullStrengthCrossedBy(from: number, to: number): boolean {
  return to >= 100 && from < 100;
}

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

/** Which P1/P2 scene a completion earns. Only a real positive gain on a saved, authoritative session can earn one. */
export function planPracticeSceneKind(
  sessionId: string | null,
  gain: number,
  eligible: boolean,
): 'none' | 'first' | 'repeat' {
  if (!eligible || !(gain > 0)) return 'none';
  const firstUnseen = !useTeachingStore.getState().userFlags.hasSeenFirstPracticeScene;
  return firstUnseen && isFirstPracticeEver(sessionId) ? 'first' : 'repeat';
}

/**
 * The scene a decided record outcome earns. Full Strength outranks a stage crossed in the same
 * completion; the stage is still recorded by the caller.
 */
export function sceneForRecords(input: {
  stage: CelebratedStageId | null;
  stageOutcome?: CelebrationOutcome;
  fullStrength: boolean;
  fullOutcome?: CelebrationOutcome;
}): PracticeSceneKind {
  if (input.fullStrength) return input.fullOutcome === 'first' ? 'fullFirst' : 'fullRepeat';
  if (input.stage) {
    if (input.stageOutcome !== 'first') return 'stageRelight';
    return input.stage === 'reinforced' ? 'stageReinforced' : 'stageFirst';
  }
  return 'none';
}

export interface PracticeSceneValues {
  bar: number;
  glow: number;
  label: number;
  value: number;
  note: number;
  /** Opacity of the stage strip (stage scenes only). */
  strip: number;
  /** 0 to 1 gold fill of the newly reached stage's segment. */
  segment: number;
  /** 0 to 1 ring draw (Full Strength first only): 0 is dashoffset full, 1 is the ring closed. */
  ring: number;
  /** Opacity of the Full Strength subline. */
  subline: number;
}

/** The resting values of a scene: where it starts, or where it settles. Pure, so the timeline ends are testable. */
export function practiceSceneValues(
  kind: PracticeSceneKind,
  from: number,
  to: number,
  when: 'start' | 'final',
): PracticeSceneValues {
  const rest = PRACTICE_SCENE_TIMING.glowRest;
  if (kind === 'none') {
    return { bar: to / 100, glow: rest, label: 1, value: 1, note: 1, strip: 0, segment: 0, ring: 0, subline: 0 };
  }
  if (kind === 'pending') {
    return { bar: from / 100, glow: rest, label: 1, value: 0, note: 0, strip: 0, segment: 0, ring: 0, subline: 0 };
  }
  const timing = PRACTICE_SCENE_TIMING[kind];
  const hasStrip = timing.segmentAtMs !== undefined ? 1 : 0;
  const hasRing = timing.ringAtMs !== undefined ? 1 : 0;
  const hasSubline = timing.sublineAtMs !== undefined ? 1 : 0;
  if (when === 'final') {
    return {
      bar: to / 100,
      glow: timing.glowTo,
      label: 1,
      value: 1,
      note: 1,
      strip: hasStrip,
      segment: hasStrip,
      ring: hasRing,
      subline: hasSubline,
    };
  }
  return {
    bar: from / 100,
    glow: timing.glowFrom,
    label: kind === 'first' ? 0 : 1,
    value: 0,
    note: 0,
    strip: 0,
    segment: 0,
    ring: 0,
    subline: 0,
  };
}

/** The cue lands on the existing settle beat; the scene timing and haptic remain unchanged. */
function playSettle(sessionId: string | null, timing: PracticeSceneTiming, kind: PlayedKind, toValue: number, reduceMotion: boolean): void {
  let cue: CreationSoundKey;
  switch (kind) {
    case 'first': cue = 'threadWake'; break;
    case 'stageFirst': {
      const stage = resolveEvolutionStage(toValue);
      cue = stage === 'Building'
        ? 'threadStageChord_building'
        : stage === 'Established'
          ? 'threadStageChord_established'
          : 'threadStageChord_integrated';
      break;
    }
    case 'stageReinforced': cue = 'threadReinforcedLow'; break;
    case 'stageRelight': cue = 'threadStageRelight'; break;
    case 'fullFirst': cue = 'threadFullStrengthChord'; break;
    case 'fullRepeat': cue = 'threadReinforce'; break;
    default: cue = 'threadSettle'; break;
  }
  const newCelebrationCue = kind !== 'repeat' && !(kind === 'stageRelight' && reduceMotion);
  if (newCelebrationCue && (!timing.chord || !sessionId || claimThreadSettle(sessionId))) playCreationSound(cue);
  else if (timing.chord && (!sessionId || claimThreadSettle(sessionId))) playCreationSound('threadSettle');
  void safeHaptics.impact(timing.settleHaptic);
}

export interface PracticeCompletionSceneArgs {
  /** Stable id of the completed session. Null means the scene plays once per mount. */
  sessionId: string | null;
  /** The Anchor the completion belongs to. Keys the stage and Full Strength records. Null means no such scenes. */
  anchorId?: string | null;
  /** Thread Strength before the session, as recorded. */
  fromValue: number;
  /** Thread Strength after the session, as recorded. */
  toValue: number;
  /** The session was saved and both values are authoritative. */
  eligible: boolean;
  reduceMotion: boolean;
}

export interface PracticeCompletionScene {
  /** The scene that is playing or has played. 'none' when nothing animates; 'pending' while records are read. */
  kind: PracticeSceneKind;
  phase: PracticeScenePhase;
  /** Natural completion of this mount's transition, with the same result still on screen. */
  educationReady: boolean;
  /** 0 to 1 bar fill. */
  barProgress: SharedValue<number>;
  /** Opacity of the artwork atmosphere, the glow behind the Anchor. */
  glowOpacity: SharedValue<number>;
  glowScale: SharedValue<number>;
  /** Opacity of the "THREAD STRENGTH" label (P1 only; the label is otherwise always visible). */
  labelOpacity: SharedValue<number>;
  /** Opacity of the new value and the movement figure, which appear at the settle. */
  valueOpacity: SharedValue<number>;
  /** Opacity of the scene's closing note: the "Your Thread has begun." line, the stage line, or the "Reinforced today" badge. */
  noteOpacity: SharedValue<number>;
  /** Opacity and rise of the five-segment stage strip (stage scenes). */
  stripOpacity: SharedValue<number>;
  /** 0 to 1 gold fill of the newly reached stage's segment. */
  segmentFill: SharedValue<number>;
  /** 0 to 1 draw of the Full Strength ring. */
  ringDraw: SharedValue<number>;
  /** Opacity of the Full Strength subline. */
  sublineOpacity: SharedValue<number>;
  /** True only while this scene is the active skippable one. */
  canSkip: boolean;
  /** A tap on the scene: lands it on its settled end state and fires the settle beat once. */
  skip: () => void;
}

const isStageKind = (kind: PracticeSceneKind) => kind === 'stageFirst' || kind === 'stageReinforced' || kind === 'stageRelight';

export function usePracticeCompletionScene({
  sessionId,
  anchorId = null,
  fromValue,
  toValue,
  eligible,
  reduceMotion,
}: PracticeCompletionSceneArgs): PracticeCompletionScene {
  const [educationResult, setEducationResult] = useState<{ key: string; from: number; to: number } | null>(null);
  const from = clampStrength(fromValue);
  const to = clampStrength(toValue);
  const [mountKey] = useState(() => {
    mountCounter += 1;
    return `practice-complete:mount-${mountCounter}`;
  });
  const sceneKey = sessionId ? `practice-complete:${sessionId}` : mountKey;
  const needsRecords = stageCrossedBy(from, to) !== null || fullStrengthCrossedBy(from, to);

  const [initial] = useState(() => {
    const played = playedScenes.get(sceneKey);
    if (played) {
      return { kind: played as PracticeSceneKind, phase: 'settled' as PracticeScenePhase, values: practiceSceneValues(played, from, to, 'final') };
    }
    if (eligible && anchorId && needsRecords) {
      return { kind: 'pending' as PracticeSceneKind, phase: 'idle' as PracticeScenePhase, values: practiceSceneValues('pending', from, to, 'start') };
    }
    const planned = planPracticeSceneKind(sessionId, to - from, eligible);
    return {
      kind: planned as PracticeSceneKind,
      phase: 'idle' as PracticeScenePhase,
      values: practiceSceneValues(planned, from, to, planned === 'none' ? 'final' : 'start'),
    };
  });

  const barProgress = useSharedValue(initial.values.bar);
  const glowOpacity = useSharedValue(initial.values.glow);
  const glowScale = useSharedValue(1);
  useEffect(() => () => cancelAnimation(glowScale), [glowScale]);
  const labelOpacity = useSharedValue(initial.values.label);
  const valueOpacity = useSharedValue(initial.values.value);
  const noteOpacity = useSharedValue(initial.values.note);
  const stripOpacity = useSharedValue(initial.values.strip);
  const segmentFill = useSharedValue(initial.values.segment);
  const ringDraw = useSharedValue(initial.values.ring);
  const sublineOpacity = useSharedValue(initial.values.subline);
  const [scene, setScene] = useState<{ kind: PracticeSceneKind; phase: PracticeScenePhase }>({
    kind: initial.kind,
    phase: initial.phase,
  });

  useEffect(() => {
    const poolKeys = THREAD_CELEBRATION_POOL_KEYS;
    SoundPool.prewarm(poolKeys);
    return () => SoundPool.releaseIdle(poolKeys);
  }, []);

  const runKey = useRef<string | null>(null);
  const started = useRef(false);
  const settled = useRef(false);
  const requested = useRef(false);
  const deciding = useRef(false);
  const decideToken = useRef(0);
  const skipByUser = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current = [];
  }, []);

  const applyValues = (values: PracticeSceneValues) => {
    cancelAnimation(barProgress);
    cancelAnimation(glowOpacity);
    cancelAnimation(glowScale);
    glowScale.value = 1;
    cancelAnimation(labelOpacity);
    cancelAnimation(valueOpacity);
    cancelAnimation(noteOpacity);
    cancelAnimation(stripOpacity);
    cancelAnimation(segmentFill);
    cancelAnimation(ringDraw);
    cancelAnimation(sublineOpacity);
    barProgress.value = values.bar;
    glowOpacity.value = values.glow;
    labelOpacity.value = values.label;
    valueOpacity.value = values.value;
    noteOpacity.value = values.note;
    stripOpacity.value = values.strip;
    segmentFill.value = values.segment;
    ringDraw.value = values.ring;
    sublineOpacity.value = values.subline;
  };

  // Leaving the screen, or switching to another session, releases the scene from the coordinator and
  // invalidates any record read still in flight.
  useEffect(() => () => {
    clearTimers();
    decideToken.current += 1;
    deciding.current = false;
    if (requested.current) useCelebrationStore.getState().finish(sceneKey);
  }, [clearTimers, sceneKey]);

  useEffect(() => {
    if (!eligible) return;
    if (runKey.current !== sceneKey) {
      runKey.current = sceneKey;
      started.current = false;
      settled.current = false;
      requested.current = false;
      deciding.current = false;
      decideToken.current += 1;
    }

    const played = playedScenes.get(sceneKey);
    if (played) {
      if (!started.current) {
        applyValues(practiceSceneValues(played, from, to, 'final'));
        setScene({ kind: played, phase: 'settled' });
      }
      return;
    }
    if (started.current || deciding.current) return;

    const gain = to - from;

    /** Starts a decided scene: no scene (zero gain, nothing to show) lands on its rest values. */
    const launch = (kind: PlayedKind) => {
      const timing = PRACTICE_SCENE_TIMING[kind];
      const schedule = (ms: number, callback: () => void) => {
        timers.current.push(setTimeout(callback, ms));
      };
      const settle = () => {
        if (settled.current) return;
        settled.current = true;
        playSettle(sessionId, timing, kind, to, reduceMotion);
      };
      const finishScene = () => {
        setEducationResult({ key: sceneKey, from, to });
        clearTimers();
        useCelebrationStore.getState().finish(sceneKey);
      };
      const hasSegment = timing.segmentAtMs !== undefined && timing.segmentMs !== undefined;
      const hasRing = timing.ringAtMs !== undefined && timing.ringMs !== undefined;
      const hasSubline = timing.sublineAtMs !== undefined && timing.sublineInMs !== undefined;

      const begin = () => {
        if (started.current) return;
        started.current = true;
        rememberPlayed(sceneKey, kind);
        // The once-ever flag is written when the first scene actually starts, not when it is requested.
        if (kind === 'first') {
          const teaching = useTeachingStore.getState();
          teaching.setUserFlag('hasSeenFirstPracticeScene', true);
          // Thread education is now owned by the completion Guidance host.
        }
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
          stripOpacity.value = isStageKind(kind) ? withTiming(1, crossfade) : 0;
          segmentFill.value = hasSegment ? withTiming(1, crossfade) : 0;
          ringDraw.value = hasRing ? withTiming(1, crossfade) : 0;
          sublineOpacity.value = hasSubline ? withTiming(1, crossfade) : 0;
          settle();
          setScene({ kind, phase: 'settled' });
          schedule(PRACTICE_SCENE_TIMING.crossfadeMs, finishScene);
          return;
        }

        const ease = kind === 'first' ? Easing.inOut(Easing.ease) : AnchorMotion.easing.emphasized;
        const fillEnd = timing.fillAtMs + timing.fillMs;
        barProgress.value = withDelay(
          timing.fillAtMs,
          withTiming(to / 100, { duration: timing.fillMs, easing: ease }),
        );
        glowScale.value = withDelay(timing.fillAtMs, withSequence(
          withTiming(1.15, { duration: timing.fillMs, easing: ease }),
          withTiming(1, { duration: 450, easing: AnchorMotion.easing.enter }),
        ));
        if (timing.bloomTo !== undefined && timing.ringAtMs !== undefined) {
          // Full Strength: the glow holds, then blooms as the ring starts drawing, then settles.
          glowOpacity.value = withDelay(
            timing.fillAtMs,
            withSequence(
              withTiming(timing.glowTo, { duration: timing.fillMs, easing: ease }),
              withTiming(timing.glowTo, { duration: Math.max(0, timing.ringAtMs - fillEnd) }),
              withTiming(timing.bloomTo, { duration: 450, easing: AnchorMotion.easing.enter }),
              withTiming(timing.glowTo, { duration: 650, easing: AnchorMotion.easing.enter }),
            ),
          );
        } else {
          glowOpacity.value = withDelay(
            timing.fillAtMs,
            withTiming(timing.glowTo, { duration: timing.fillMs, easing: ease }),
          );
        }
        if (timing.labelAtMs !== undefined && timing.labelInMs !== undefined) {
          labelOpacity.value = withDelay(timing.labelAtMs, withTiming(1, { duration: timing.labelInMs }));
        }
        if (timing.stripAtMs !== undefined && timing.stripInMs !== undefined) {
          stripOpacity.value = withDelay(timing.stripAtMs, withTiming(1, { duration: timing.stripInMs }));
        }
        if (hasSegment) {
          segmentFill.value = withDelay(
            timing.segmentAtMs!,
            withTiming(1, { duration: timing.segmentMs!, easing: ease }),
          );
        }
        if (hasRing) {
          ringDraw.value = withDelay(
            timing.ringAtMs!,
            withTiming(1, { duration: timing.ringMs!, easing: Easing.inOut(Easing.ease) }),
          );
        }
        if (hasSubline) {
          sublineOpacity.value = withDelay(timing.sublineAtMs!, withTiming(1, { duration: timing.sublineInMs! }));
        }
        valueOpacity.value = withDelay(timing.settleAtMs, withTiming(1, { duration: PRACTICE_SCENE_TIMING.valueInMs }));
        noteOpacity.value = withDelay(timing.noteAtMs, withTiming(1, { duration: timing.noteInMs }));

        schedule(timing.settleAtMs, () => {
          settle();
          setScene((previous) => ({ ...previous, phase: 'settled' }));
        });
        const extra = timing.extraHaptic;
        if (extra) schedule(extra.atMs, () => { void safeHaptics.impact(extra.style); });
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
      // Full scenes register at level 2 under Reduce Motion; the relight is level 2 already.
      const level = (reduceMotion ? Math.min(timing.level, 2) : timing.level) as CelebrationLevel;
      const outcome = useCelebrationStore.getState().request(level, sceneKey, {
        durationMs: timing.durationMs,
        onStart: begin,
        onSkip,
      });
      // 'deferred' waits in the coordinator queue and starts through onStart when promoted.
      if (outcome === 'play') begin();
      // A quiet scene dropped by a busy coordinator lands silently on its final values, and is not replayed.
      if (outcome === 'dropped') {
        rememberPlayed(sceneKey, kind);
        applyValues(practiceSceneValues(kind, from, to, 'final'));
        setScene({ kind, phase: 'settled' });
      }
    };

    /** Starts whatever a decision chose. 'none' and 'pending' rest on their final values. */
    const start = (kind: PracticeSceneKind) => {
      if (kind === 'none' || kind === 'pending') {
        applyValues(practiceSceneValues('none', from, to, 'final'));
        return;
      }
      launch(kind);
    };

    const stage = anchorId ? stageCrossedBy(from, to) : null;
    const fullStrength = anchorId ? fullStrengthCrossedBy(from, to) : false;
    if (!stage && !fullStrength) {
      start(planPracticeSceneKind(sessionId, gain, eligible));
      return;
    }

    // A stage or Full Strength is decided only after the records are read. Until then nothing plays.
    deciding.current = true;
    const token = decideToken.current;
    void celebrationRecordsReady().then((ready) => {
      if (token !== decideToken.current) return;
      deciding.current = false;
      if (!ready || !anchorId) {
        // Records unreadable: fall back to the practice scene, which never replays a stage or Full Strength.
        start(planPracticeSceneKind(sessionId, gain, eligible));
        return;
      }
      const records = useCelebrationRecordsStore.getState();
      const stageOutcome = stage ? records.recordStage(anchorId, stage) : undefined;
      const fullOutcome = fullStrength ? records.recordFullStrength(anchorId) : undefined;
      start(sceneForRecords({ stage, stageOutcome, fullStrength, fullOutcome }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, from, to, sceneKey, sessionId, anchorId, reduceMotion]);

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
    educationReady: educationResult?.key === sceneKey && educationResult?.from === from && educationResult?.to === to,
    barProgress,
    glowOpacity,
    glowScale,
    labelOpacity,
    valueOpacity,
    noteOpacity,
    stripOpacity,
    segmentFill,
    ringDraw,
    sublineOpacity,
    canSkip,
    skip,
  };
}
