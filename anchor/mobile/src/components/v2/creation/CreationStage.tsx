import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

import { V2Button, V2IconButton } from '@/components/v2';
import { V2InlineError } from '@/components/v2/feedback/V2Feedback';
import { AnchorMark } from '@/components/v2/anchor/AnchorMark';
import { expressionSpec } from '@/components/v2/anchor/anchorExpressions';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { homeCategoryArt } from '@/components/v2/home/homeCategoryArt';
import {
  CREATION_SAVE_ERRORS,
  DISTILLATION_COPY,
  EXPRESSION_COPY,
  FORMATION_COPY,
  GENERATION_COPY,
  CHOOSE_COPY,
  REVEAL_COPY,
  type AnchorExpression,
  type CreationStep,
} from '@/constants/v2/creation';
import { GENERATION_ERRORS, formationForDraft, type CreationDraft } from '@/stores/v2/creationStore';
import { useV2Responsive, v2Haptics } from '@/hooks/v2';
import { colors, getCategoryColor, getCategoryTextColor, spacing, typography } from '@/theme/v2';
import type { AIStyle } from '@/types';
import {
  CREATION_EASING,
  CREATION_PACE,
  CREATION_TIMING,
  FORMATION_TIMING,
  GENERATION_TIMING,
  KAMEA_CORE,
  MARK_CORE,
  PAPER_ART_SHARE,
  creationMarkSize,
  creationRepeat,
  creationSequence,
  creationTiming,
  formationTimeline,
  letterVertexIndexes,
  reducedFormationTimeline,
  stageFitScale,
} from './creationMotion';
import { DistillationLetters, type SettledSlots } from './DistillationLetters';
import type { DistillationStage } from './distillationMotion';
import { ExpressionPreview } from './ExpressionPreview';
import { ExpressionLibrary } from './ExpressionLibrary';
import { styleOption, creationStyleLibrary, type CreationStyleOption } from './expressionOptions';
import { FormationLayer, MappingTokens, kameaGeometry, type StagePoint } from './FormationLayer';
import { FormationSheet } from './FormationSheet';
import { DraftingSurface } from './DraftingSurface';
import { draftingInk, draftingCopyOpacity } from './draftingTone';
import { CandidatePager } from './CandidatePager';
import { lockSeal, unlockSeal } from './sealCommitment';
import { GenerationEtching } from './GenerationEtching';
import { FOIL_STOPS } from '@/components/v2/anchor/anchorExpressions';
import { SoundPool } from '@/services/audio/SoundPool';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import { creationTimingTracker, type CreationTimingRecord } from './creationTelemetry';

export type WindowRect = { x: number; y: number; width: number; height: number };

function CreationTimingHud({ reduceMotion }: { reduceMotion: boolean }) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<CreationTimingRecord[]>([]);

  useEffect(() => {
    return creationTimingTracker.subscribe((latest) => setRecords(latest));
  }, []);

  if (!__DEV__) return null;

  return (
    <View style={styles.hudContainer} pointerEvents="box-none">
      <Pressable style={styles.hudPill} onPress={() => setOpen((prev) => !prev)}>
        <Text style={styles.hudPillText}>
          ⏱ Timing {records.length}/9 {open ? '▲' : '▼'}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.hudPanel}>
          <Text style={styles.hudHeader}>
            {Platform.OS.toUpperCase()} | {reduceMotion ? 'Reduced Motion' : 'Full Motion'}
          </Text>
          {records.map((r) => (
            <View key={r.stepNumber} style={styles.hudRow}>
              <Text style={styles.hudStep}>{r.stepNumber}. {r.label}</Text>
              <Text style={styles.hudTime}>{r.elapsedMs}ms (+{r.deltaMs})</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}


/** Room kept above the grid for the lifted letter row during formation. */
const LETTER_ROW = 46;
/** How much the lifted letter row shrinks. */
const LIFTED_SCALE = 0.78;
/** Below this the stage cannot show the mark legibly; it steps aside for the panel. */
const MIN_STAGE_FOR_MARK = 76;
/** Room above the mark for the Expression stage's label. */
const STAGE_LABEL_ROOM = 22;
/** The mark inside its paper circle: the circle is what must fit. */
const DISC_CORE = 1 / PAPER_ART_SHARE;
const PAPER = colors.surface;
/** The second-Anchor paywall action, the same on every panel and for assistive tech. */
const PRO_LABEL = 'See Anchor Pro';

/** What the stage is showing. A replay of the formation plays inside Reveal. */
type Scene = CreationStep;
type Replay = null | 'distillation' | 'formation';

const HEADLINES: Record<Scene, { eyebrow: string; title: string }> = {
  intention: { eyebrow: '', title: '' },
  distillation: { eyebrow: DISTILLATION_COPY.eyebrow, title: DISTILLATION_COPY.title },
  formation: { eyebrow: FORMATION_COPY.eyebrow, title: FORMATION_COPY.title },
  reveal: { eyebrow: REVEAL_COPY.eyebrow, title: REVEAL_COPY.title },
  expression: { eyebrow: EXPRESSION_COPY.eyebrow, title: EXPRESSION_COPY.title },
  generating: { eyebrow: GENERATION_COPY.eyebrow, title: GENERATION_COPY.title },
  choose: { eyebrow: CHOOSE_COPY.eyebrow, title: CHOOSE_COPY.title },
  handoff: { eyebrow: REVEAL_COPY.eyebrow, title: REVEAL_COPY.title },
};

type FormationPhase = keyof typeof FORMATION_COPY.status;
type GenerationPhase = keyof typeof GENERATION_COPY.phase;

export interface CreationStageProps {
  draft: CreationDraft;
  reduceMotion: boolean;
  /** The step the flow was opened on. A resumed flow does not replay what already happened. */
  entryStep: CreationStep;
  /** Stage pace multiplier (see `CREATION_PACE`). */
  pace?: number;
  onBack: () => void;
  onFormAnchor: () => void;
  onFormationDone: () => void;
  onOpenExpression: () => void;
  onSelectStyle: (styleChoice: AIStyle | null, expression: AnchorExpression) => void;
  onKeep: () => void;
  onGenerate: () => void;
  onKeepOriginal: () => void;
  onSelectCandidate: (index: number) => void;
  /** Back to the pair set aside when a fresh one was asked for. */
  onReturnToPrevious?: () => void;
  onSignIn?: () => void;
  onPaywall?: () => void;
  onHandoff: (markRect: WindowRect | null) => void;
}

export function CreationStage({
  draft,
  reduceMotion,
  entryStep,
  pace = CREATION_PACE.first,
  onBack,
  onFormAnchor,
  onFormationDone,
  onOpenExpression,
  onSelectStyle,
  onKeep,
  onGenerate,
  onKeepOriginal,
  onSelectCandidate,
  onReturnToPrevious,
  onSignIn,
  onPaywall,
  onHandoff,
}: CreationStageProps) {
  const step = draft.currentStep;
  const [sealCommitted, setSealCommitted] = useState(false);
  const sealRect = useRef<WindowRect | null>(null);
  useEffect(() => () => unlockSeal(draft.draftId), [draft.draftId]);
  // Optional drone deliberately stays silent until the real asset is supplied.
  const FORGE_DRONE_ENABLED = false;
  // DEFERRED: awaiting assets/sounds/forge-drone.wav
  // const forgeDrone = require('../../../assets/sounds/forge-drone.wav');
  void FORGE_DRONE_ENABLED;
  const soundedLandings = useRef(new Set<number>());
  const viewport = useV2Responsive();
  const insets = useSafeAreaInsets();
  const markSize = creationMarkSize(viewport);
  const svg = draft.structureSvg;
  const accent = getCategoryColor(draft.category);
  // The chosen look: the local treatment plus the chosen style's own colour, if it has one.
  // Until Expression, the Anchor is shown as the structure itself: a style kept from an earlier
  // intention is applied only once the user arrives at the choice of how it appears.
  const expressed = step === 'expression' || step === 'generating' || step === 'choose' || step === 'handoff';
  const lookExpression: AnchorExpression = expressed ? draft.expression : 'original';
  const lookTint = expressed ? styleOption(draft.expression === 'original' ? undefined : draft.styleChoice)?.tint : undefined;
  const letters = useMemo(() => draft.distilledLetters ?? [], [draft.distilledLetters]);
  const formation = useMemo(
    () => formationForDraft({ distilledLetters: letters, category: draft.category }),
    [letters, draft.category],
  );
  const timeline = useMemo(
    () => (reduceMotion ? reducedFormationTimeline(formation?.vertices.length ?? 0) : formationTimeline(formation?.vertices ?? [], pace)),
    [formation, pace, reduceMotion],
  );
  const formed = step === 'reveal' || step === 'expression' || step === 'generating' || step === 'choose' || step === 'handoff';
  const candidates = useMemo(() => (draft.generatedCandidates ?? []).slice(0, 2), [draft.generatedCandidates]);
  const chosenIndex = draft.selectedCandidateIndex ?? -1;
  useEffect(() => {
    if (step === 'choose' && candidates.length === 2 && chosenIndex < 0) onSelectCandidate(0);
  }, [candidates.length, chosenIndex, onSelectCandidate, step]);
  const keptCandidate = step === 'handoff' && chosenIndex >= 0 && Boolean(candidates[chosenIndex]);

  /* ── replay of the formation, inside Reveal ───────────────────────────── */
  const [replay, setReplay] = useState<Replay>(null);
  const [replayKey, setReplayKey] = useState(0);
  useEffect(() => {
    if (step !== 'reveal' && replay) setReplay(null);
  }, [replay, step]);

  /* ── shared motion state ─────────────────────────────────────────────── */
  const progress = useSharedValue(formed ? 1 : 0);
  const mix = useSharedValue(1);
  const chrome = useSharedValue(1);
  const markY = useSharedValue(0);
  const markScale = useSharedValue(1);
  const markVisible = useSharedValue(1);
  const gen = useSharedValue(step === 'generating' || step === 'choose' || keptCandidate ? 1 : 0);
  const breath = useSharedValue(0);
  const emerge = useSharedValue(step === 'choose' || step === 'handoff' ? 1 : 0);
  const resolve = useSharedValue(0);

  /* ── displayed scene: the headline and panel swap out, then in ────────── */
  const target: Scene = replay ?? step;
  const [shown, setShown] = useState<Scene>(target);
  const swap = useSharedValue(1);
  useEffect(() => {
    if (shown === target) return undefined;
    if (target === 'handoff') return undefined; // hand-off keeps the last panel while it fades
    if (reduceMotion) {
      setShown(target);
      return undefined;
    }
    swap.value = creationTiming(0, { duration: CREATION_TIMING.swapOut, easing: CREATION_EASING.exit });
    const timer = setTimeout(() => {
      setShown(target);
      swap.value = creationTiming(1, { duration: CREATION_TIMING.swapIn, easing: CREATION_EASING.enter });
    }, CREATION_TIMING.swapOut + 10);
    return () => clearTimeout(timer);
  }, [reduceMotion, shown, target, swap]);

  useEffect(() => {
    if (shown === 'reveal') {
      creationTimingTracker.record('reveal_complete');
    }
  }, [shown]);


  // Shared-element fallback: the same mounted mark scales and moves into expressions.
  /* ── stage layout → where and how large the mark sits ─────────────────── */
  const stageRef = useRef<View>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const onStageLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setStage((previous) => (Math.abs(previous.width - width) < 0.5 && Math.abs(previous.height - height) < 0.5 ? previous : { width, height }));
  }, []);

  const placement = useMemo(() => {
    const scene = shown === 'handoff' ? 'handoff' : target === 'formation' || target === 'distillation' ? target : shown;
    const lifted = scene === 'formation' || scene === 'distillation';
    const inCircle = scene === 'generating' || scene === 'choose' || scene === 'handoff';
    const core = lifted ? KAMEA_CORE : inCircle ? DISC_CORE : MARK_CORE;
    // The "YOUR STRUCTURE" label sits above the mark on Expression; the mark keeps clear of it.
    const labelRoom = scene === 'expression' ? STAGE_LABEL_ROOM : 0;
    const room = { width: stage.width, height: Math.max(0, stage.height - (lifted ? LETTER_ROW * 2 : 0) - (scene === 'handoff' ? 40 : 0) - labelRoom) };
    const gridShare = formation ? kameaGeometry(formation).side / 100 : KAMEA_CORE;
    const scale = lifted
      ? Math.min(stage.width / (markSize * gridShare), Math.max(0.24, room.height / (markSize * gridShare)))
      : stageFitScale(room, markSize, core);
    const centerY = stage.height / 2 + (lifted ? LETTER_ROW / 2 : 0) - (scene === 'handoff' ? 20 : 0) + labelRoom / 2;
    const visible = stage.height >= MIN_STAGE_FOR_MARK && scene !== 'distillation' && !(scene === 'handoff' && keptCandidate);
    return { scale, top: centerY - markSize / 2, centerY, visible };
  }, [formation, keptCandidate, markSize, shown, stage, target]);
  const placementRef = useRef(placement);
  placementRef.current = placement;

  const placedOnce = useRef(false);
  useEffect(() => {
    if (stage.height <= 0) return;
    const timing = { duration: CREATION_TIMING.stageFit, easing: CREATION_EASING.deliberate };
    if (!placedOnce.current || reduceMotion) {
      placedOnce.current = true;
      markY.value = placement.top;
      markScale.value = placement.scale;
      markVisible.value = placement.visible ? 1 : 0;
      return;
    }
    markY.value = creationTiming(placement.top, timing);
    markScale.value = creationTiming(placement.scale, timing);
    markVisible.value = creationTiming(placement.visible ? 1 : 0, timing);
  }, [markScale, markVisible, markY, placement, reduceMotion, stage.height]);

  /* ── distillation → formation ─────────────────────────────────────────── */
  const [distillStage, setDistillStage] = useState<DistillationStage>('whole');
  const [slots, setSlots] = useState<SettledSlots | null>(null);
  const formRequested = useRef(false);
  const onDistillStage = useCallback((next: DistillationStage) => setDistillStage(next), []);
  useEffect(() => {
    if (distillStage !== 'settled' || formRequested.current) return undefined;
    if (step !== 'distillation' && replay !== 'distillation') return undefined;
    const timer = setTimeout(() => {
      formRequested.current = true;
      if (replay === 'distillation') setReplay('formation');
      else onFormAnchor();
    }, reduceMotion ? 120 : CREATION_TIMING.distillHold);
    return () => clearTimeout(timer);
  }, [distillStage, onFormAnchor, reduceMotion, replay, step]);

  /* One ink-to-paper wipe; the later scenes stay in the paper world. */
  const initiallyDark = entryStep === 'distillation' || entryStep === 'formation';
  const darkTone = useSharedValue(initiallyDark ? 1 : 0);
  const iris = useSharedValue(initiallyDark ? 0 : 1);
  const [darkStatusBar, setDarkStatusBar] = useState(!initiallyDark);
  const worldStep = useRef<Scene>(entryStep);
  useEffect(() => {
    const previous = worldStep.current;
    worldStep.current = target;
    const dark = target === 'distillation' || target === 'formation';
    if (dark) {
      darkTone.value = 1;
      iris.value = 0;
      setDarkStatusBar(false);
      return;
    }
    if (target === 'reveal' && (previous === 'formation' || previous === 'distillation') && !reduceMotion) {
      iris.value = 0;
      iris.value = creationTiming(1, { duration: 600, easing: CREATION_EASING.deliberate });
      const contrast = setTimeout(() => { darkTone.value = 0; setDarkStatusBar(true); }, 280);
      return () => clearTimeout(contrast);
    }
    iris.value = 1;
    darkTone.value = 0;
    setDarkStatusBar(true);
  }, [darkTone, iris, reduceMotion, target]);
  const irisDiameter = Math.hypot(viewport.width, viewport.height) * 2;
  const irisStyle = useAnimatedStyle(() => ({ transform: [{ scale: iris.value }] }));
  // DEFERRED: the old tonal cross-fade returned to ink during generation.

  /* ── formation: one progress value drives square, letters, points, line ── */
  const [formationPhase, setFormationPhase] = useState<FormationPhase>('grid');
  const formationTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const formationRunning = useRef(false);
  const clearFormationTimers = () => {
    formationTimers.current.forEach(clearTimeout);
    formationTimers.current = [];
  };
  const forming = step === 'formation' || replay === 'formation';
  const replayRef = useRef(replay);
  replayRef.current = replay;

  const formationStartedAt = useRef(0);
  const runFormation = useCallback(
    (hurried = false) => {
      clearFormationTimers();
      formationStartedAt.current = Date.now();
      creationTimingTracker.record('kamea_mapping_begin', { hurried, pace });
      const from = progress.value;
      if (from === 0) soundedLandings.current.clear();
      const normal = (a: number, b: number) => Math.max(0, (b - a) * timeline.total);
      let total: number;
      let at: (fraction: number) => number;
      if (!hurried || from >= timeline.constructEnd) {
        total = Math.max(1, normal(from, 1));
        progress.value = creationTiming(1, { duration: total, easing: Easing.linear });
        at = (fraction) => normal(from, fraction);
      } else {
        // A tap hurries what is still being drawn, never the hold that follows it: the finished
        // geometry still breathes and the grid still recedes at their own pace.
        const pivot = timeline.constructEnd;
        const quick = FORMATION_TIMING.hurry;
        const tail = Math.max(1, normal(pivot, 1));
        total = quick + tail;
        progress.value = creationSequence(
          creationTiming(pivot, { duration: quick, easing: Easing.linear }),
          creationTiming(1, { duration: tail, easing: Easing.linear }),
        );
        at = (fraction) => (fraction <= pivot ? ((fraction - from) / (pivot - from || 1)) * quick : quick + normal(pivot, fraction));
      }
      const phases: Array<[number, FormationPhase]> = [
        [timeline.departures[0] ?? timeline.gridEnd, 'map'],
        [timeline.constructStart, 'path'],
        [timeline.constructEnd, 'settle'],
      ];
      for (const [fraction, phase] of phases) {
        if (from < fraction) formationTimers.current.push(setTimeout(() => setFormationPhase(phase), at(fraction)));
        else setFormationPhase(phase);
      }

      timeline.landings.forEach((landing, index) => {
        if (landing < from || soundedLandings.current.has(index)) return;
        formationTimers.current.push(setTimeout(() => {
          soundedLandings.current.add(index);
          SoundPool.play('creation:distillTick', { volume: 0.5, rate: distillLandingRate(index) });
          void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
        }, at(landing)));
      });

      // Step 4: First letter begins movement
      if (timeline.departures[0] !== undefined) {
        formationTimers.current.push(setTimeout(() => {
          creationTimingTracker.record('first_letter_movement');
        }, at(timeline.departures[0])));
      }

      // Step 5: Final letter reaches mapped position
      const finalLanding = timeline.landings[timeline.landings.length - 1];
      if (finalLanding !== undefined) {
        formationTimers.current.push(setTimeout(() => {
          creationTimingTracker.record('final_letter_mapped');
        }, at(finalLanding)));
      }

      // Step 6: First geometry stroke begins
      formationTimers.current.push(setTimeout(() => {
        creationTimingTracker.record('first_geometry_stroke');
      }, at(timeline.constructStart)));

      // Step 7: Final geometry stroke completes
      formationTimers.current.push(setTimeout(() => {
        creationTimingTracker.record('final_geometry_stroke');
      }, at(timeline.constructEnd)));

      // Completion does not wait for an animation callback: the timer is the contract, and it
      // still holds when frames are paused (backgrounded app, tests).
      formationTimers.current.push(setTimeout(() => {
        formationRunning.current = false;
        creationTimingTracker.record('final_reveal_begin');
        if (replayRef.current === 'formation') {
          setReplay(null);
          return;
        }
        onFormationDone();
      }, total + 40));
    },
    [onFormationDone, pace, progress, timeline],
  );

  useEffect(() => {
    if (!forming || !svg || draft.formationError || formationRunning.current) return undefined;
    formationRunning.current = true;
    if (replay === 'formation') progress.value = 0;
    setFormationPhase('grid');
    runFormation(false);
    return undefined;
  }, [draft.formationError, forming, progress, replay, runFormation, svg]);

  useEffect(() => () => clearFormationTimers(), []);

  // Leaving formation early (Back) stops it cleanly; returning replays it from the start.
  useEffect(() => {
    if (forming || formed || replay) return;
    clearFormationTimers();
    formationRunning.current = false;
    formRequested.current = false;
    cancelAnimation(progress);
    progress.value = 0;
    setFormationPhase('grid');
    setSlots(null);
  }, [formed, forming, progress, replay]);

  /** A tap during formation finishes it briskly instead of skipping what it shows. */
  const hurry = useCallback(() => {
    // 1200ms grace period to avoid touch-through / lingering taps from truncating formation
    if (Date.now() - formationStartedAt.current < 1200) return;
    if (!forming || !formationRunning.current || progress.value >= timeline.constructEnd) return;
    cancelAnimation(progress);
    runFormation(true);
  }, [forming, progress, runFormation, timeline.constructEnd]);


  const startReplay = useCallback(() => {
    if (step !== 'reveal' || replay) return;
    formRequested.current = false;
    setDistillStage('whole');
    setSlots(null);
    setReplayKey((key) => key + 1);
    setReplay('distillation');
  }, [replay, step]);

  /* ── expression: the structure adopts the chosen treatment ─────────────── */
  type Look = { expression: AnchorExpression; tint?: string };
  const [look, setLook] = useState<{ from: Look; to: Look }>(() => {
    const initial = { expression: lookExpression, tint: lookTint };
    return { from: initial, to: initial };
  });
  const lookRef = useRef(look);
  lookRef.current = look;
  useEffect(() => {
    const next: Look = { expression: lookExpression, tint: lookTint };
    const shownLook = lookRef.current.to;
    if (shownLook.expression === next.expression && shownLook.tint === next.tint) return undefined;
    if (reduceMotion || step !== 'expression') {
      setLook({ from: next, to: next });
      mix.value = 1;
      return undefined;
    }
    // Only the look being left and the look being chosen take part in the change.
    setLook({ from: shownLook, to: next });
    mix.value = 0;
    mix.value = creationTiming(1, { duration: CREATION_TIMING.expressionBlend, easing: CREATION_EASING.deliberate });
    const settle = setTimeout(() => setLook({ from: next, to: next }), CREATION_TIMING.expressionBlend + 40);
    return () => clearTimeout(settle);
  }, [lookExpression, lookTint, mix, reduceMotion, step]);

  const hasInteracted = useRef(false);

  const selectStyle = useCallback((option: CreationStyleOption | null) => {
    hasInteracted.current = true;
    v2Haptics.selection();
    onSelectStyle(option?.styleChoice ?? null, option?.expression ?? 'original');
  }, [onSelectStyle]);

  useEffect(() => {
    if (shown !== 'expression' || hasInteracted.current) return;
    if (draft.expression === 'original' && draft.styleChoice === undefined) {
      const intentionText = draft.normalizedIntention ?? draft.intention;
      const library = creationStyleLibrary(draft.category, intentionText);
      const defaultOption = library.suggested[0] ?? library.all[0];
      if (defaultOption) {
        onSelectStyle(defaultOption.styleChoice, defaultOption.expression);
      }
    }
  }, [draft.category, draft.expression, draft.intention, draft.normalizedIntention, draft.styleChoice, onSelectStyle, shown]);

  /* ── generation: structure → expression → surface, then an honest wait ─── */
  const developing = step === 'generating' && draft.generationState === 'generating';
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('structure');
  useEffect(() => {
    if (step !== 'generating') {
      cancelAnimation(breath);
      breath.value = 0;
      return undefined;
    }
    if (!developing) {
      // A failure holds the structure exactly where it is; nothing pretends to continue.
      cancelAnimation(gen);
      cancelAnimation(breath);
      breath.value = creationTiming(0, { duration: 400 });
      return undefined;
    }
    const total = GENERATION_TIMING.structure + GENERATION_TIMING.expression + GENERATION_TIMING.surface;
    // A retry for the one missing interpretation continues from the resolved circle; a fresh
    // development starts from the plain structure.
    const from = reduceMotion ? 1 : candidates.length ? Math.min(1, Math.max(0, gen.value)) : 0;
    if (reduceMotion) {
      gen.value = 1;
      setGenerationPhase('surface');
    } else {
      gen.value = from;
      gen.value = creationTiming(1, { duration: Math.max(1, total * (1 - from)), easing: Easing.linear });
      setGenerationPhase(from >= 1 ? 'surface' : 'structure');
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!reduceMotion) {
      const elapsed = from * total;
      const after = (ms: number) => Math.max(0, ms - elapsed);
      timers.push(setTimeout(() => setGenerationPhase('expression'), after(GENERATION_TIMING.structure)));
      timers.push(setTimeout(() => setGenerationPhase('surface'), after(GENERATION_TIMING.structure + GENERATION_TIMING.expression)));
      // Once the sequence has resolved, the circle rests with the slowest of breaths — an
      // honest "still working", not a progress claim.
      timers.push(setTimeout(() => {
        breath.value = creationRepeat(creationTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }));
      }, after(total)));
    }
    timers.push(setTimeout(() => setGenerationPhase('extended'), GENERATION_TIMING.extendedAfter));
    return () => timers.forEach(clearTimeout);
    // The sequence restarts per attempt, not per candidate change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developing, draft.generationRequestId, reduceMotion, step]);

  /* ── the choice: two interpretations emerge from the one structure ─────── */
  const lastStep = useRef(step);
  useEffect(() => {
    const previous = lastStep.current;
    lastStep.current = step;
    if (step === 'choose' && previous !== 'choose') {
      if (reduceMotion || previous !== 'generating') emerge.value = 1;
      else {
        emerge.value = 0;
        emerge.value = creationTiming(1, { duration: GENERATION_TIMING.reveal, easing: CREATION_EASING.enter });
      }
    }
    if (step !== 'choose' && step !== 'handoff') emerge.value = 0;
  }, [emerge, reduceMotion, step]);

  /* ── hand-off to Home ─────────────────────────────────────────────────── */
  const handedOff = useRef(false);
  const handoffTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => handoffTimers.current.forEach(clearTimeout), []);
  const stageSizeRef = useRef(stage);
  stageSizeRef.current = stage;
  const onHandoffRef = useRef(onHandoff);
  onHandoffRef.current = onHandoff;
  const keptCandidateRef = useRef(keptCandidate);
  keptCandidateRef.current = keptCandidate;
  useEffect(() => {
    if (step !== 'handoff' || handedOff.current) return undefined;
    handedOff.current = true;
    Keyboard.dismiss();
    const fade = reduceMotion ? 0 : CREATION_TIMING.handoffFade;
    const settle = reduceMotion ? 60 : CREATION_TIMING.handoffResolve + 380;
    chrome.value = reduceMotion ? 0 : creationTiming(0, { duration: fade, easing: CREATION_EASING.exit });
    resolve.value = reduceMotion ? 1 : creationTiming(1, { duration: CREATION_TIMING.handoffResolve, easing: CREATION_EASING.deliberate });
    // Kept as the original structure, the panel steps aside so the mark takes its full place
    // in its circle before it travels. A kept interpretation already sits in its circle; its
    // stage keeps its size so nothing under it moves.
    if (!keptCandidateRef.current) handoffTimers.current.push(setTimeout(() => setShown('handoff'), fade));
    handoffTimers.current.push(setTimeout(() => {
      if (sealRect.current) {
        onHandoffRef.current(reduceMotion ? null : sealRect.current);
        return;
      }
      const view = stageRef.current;
      if (!view || typeof view.measureInWindow !== 'function') {
        onHandoffRef.current(null);
        return;
      }
      let answered = false;
      // A view that is mid-detach can fail to answer; the hand-off proceeds without a flight.
      const fallback = setTimeout(() => {
        if (answered) return;
        answered = true;
        onHandoffRef.current(null);
      }, 250);
      view.measureInWindow((x, y) => {
        if (answered) return;
        answered = true;
        clearTimeout(fallback);
        const { width } = stageSizeRef.current;
        const { scale, centerY } = placementRef.current;
        // The rect handed over is the mark's own square inside the circle, which is what
        // Home's hero reports for its resting place.
        const art = markSize * scale;
        const rect = Number.isFinite(x) && Number.isFinite(y) && art > 0
          ? { x: x + width / 2 - art / 2, y: y + centerY - art / 2, width: art, height: art }
          : null;
        onHandoffRef.current(rect);
      });
    }, settle));
    // Deliberately not cleaned up on re-render: once begun, the hand-off must complete. Only
    // the screen going away (below) cancels it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* ── animated styles ──────────────────────────────────────────────────── */
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
  const swapStyle = useAnimatedStyle(() => ({
    opacity: swap.value * chrome.value,
    transform: [{ translateY: (1 - swap.value) * 8 }],
  }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markVisible.value * (step === 'choose' ? interpolate(emerge.value, [0, 0.45], [1, 0], 'clamp') : 1),
    transform: [{ translateY: markY.value }, { scale: markScale.value }],
  }), [step]);
  const settleStart = timeline.settleStart;
  const inGeneration = shown === 'generating' || step === 'generating';
  const showGenerationLayers = inGeneration || step === 'choose' || (step === 'handoff' && !keptCandidate);
  const colourIn = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [settleStart, settleStart + (1 - settleStart) * 0.5], [0, 1], 'clamp') * (showGenerationLayers ? 1 : interpolate(darkTone.value, [0, 0.15], [1, 0], 'clamp')),
    transform: [{ scale: interpolate(progress.value, [settleStart, 1], [0.975, 1], 'clamp') }],
  }), [settleStart, showGenerationLayers]);
  const lift = timeline.gridEnd;
  const lettersStyle = useAnimatedStyle(() => {
    const up = interpolate(progress.value, [0, lift], [0, 1], 'clamp');
    return {
      opacity: interpolate(progress.value, [settleStart, settleStart + (1 - settleStart) * 0.5], [1, 0], 'clamp'),
      transform: [
        { translateY: -up * Math.max(0, stage.height / 2 - LETTER_ROW / 2) },
        { scale: 1 - up * (1 - LIFTED_SCALE) },
      ],
    };
  }, [lift, settleStart, stage.height]);

  // Generation: the expressed mark gives way to a plain ink re-drawing of the structure, then
  // returns as the expression settles back onto it, then the circle forms around it.
  const s1 = GENERATION_TIMING.structure / (GENERATION_TIMING.structure + GENERATION_TIMING.expression + GENERATION_TIMING.surface);
  const s2 = (GENERATION_TIMING.structure + GENERATION_TIMING.expression) / (GENERATION_TIMING.structure + GENERATION_TIMING.expression + GENERATION_TIMING.surface);
  const genPreviewStyle = useAnimatedStyle(() => {
    if (!inGeneration) return { opacity: 1 };
    return { opacity: interpolate(gen.value, [0, s1 * 0.35, s1, s2], [1, 0.14, 0.14, 1], 'clamp') };
  }, [inGeneration, s1, s2]);
  const retrace = useDerivedValue(() => interpolate(gen.value, [s1 * 0.2, s1], [0, 1], 'clamp'));
  const inkStyle = useAnimatedStyle(() => ({
    opacity: inGeneration ? interpolate(gen.value, [0, s1 * 0.2, s2, 1], [0, 1, 1, 0], 'clamp') : 0,
  }), [inGeneration, s1, s2]);
  const discStyle = useAnimatedStyle(() => {
    const surfaced = step === 'handoff' ? Math.max(interpolate(gen.value, [s2, 1], [0, 1], 'clamp'), resolve.value) : interpolate(gen.value, [s2, 1], [0, 1], 'clamp');
    return { opacity: surfaced, transform: [{ scale: 0.9 + surfaced * 0.1 }] };
  }, [s2, step]);
  const breathStyle = useAnimatedStyle(() => ({ opacity: interpolate(gen.value, [0.96, 1], [0, 1], 'clamp') * (0.1 + breath.value * 0.3) }));
  const handoffCaptionStyle = useResolveStyle(resolve);
  const darkMarkStyle = useAnimatedStyle(() => ({ opacity: darkTone.value >= 0.8 ? 1 : 0 }));
  const neutralMarkStyle = useAnimatedStyle(() => ({
    opacity: shown === 'reveal' ? 1 : darkTone.value < 0.8 ? interpolate(darkTone.value, [0, 0.15], [0, 1], 'clamp') : 0,
  }));
  const backInkStyle = useAnimatedStyle(() => ({ opacity: darkTone.value < 0.8 ? 1 : 0 }));
  const backPaperStyle = useAnimatedStyle(() => ({ opacity: darkTone.value < 0.8 ? 0 : 1 }));
  const quietChromeStyle = useAnimatedStyle(() => ({
    opacity: swap.value * chrome.value * (target === 'formation' || shown === 'formation' ? interpolate(progress.value, [0, timeline.gridEnd, timeline.constructEnd], [0.5, 0, 0], 'clamp') : 1),
    transform: [{ translateY: (1 - swap.value) * 8 }],
  }), [target, shown, timeline.gridEnd, timeline.constructEnd]);
  const quietStatusStyle = useAnimatedStyle(() => ({
    opacity: draftingCopyOpacity(darkTone.value) * (target === 'formation' || shown === 'formation' ? interpolate(progress.value, [timeline.constructEnd, timeline.settleStart], [1, 0], 'clamp') : 1),
    color: draftingInk(darkTone.value),
  }), [target, shown, timeline.constructEnd, timeline.settleStart]);

  /* ── dynamic tone styles ──────────────────────────────────────────────── */
  const bgToneStyle = useAnimatedStyle(() => ({
    backgroundColor: colors.ink.base,
  }));
  const dynamicTitleStyle = useAnimatedStyle(() => ({
    color: draftingInk(darkTone.value),
  }));
  const dynamicEyebrowStyle = useAnimatedStyle(() => ({
    color: draftingInk(darkTone.value),
    opacity: draftingCopyOpacity(darkTone.value),
  }));
  const dynamicStatusStyle = useAnimatedStyle(() => ({
    color: draftingInk(darkTone.value),
    opacity: draftingCopyOpacity(darkTone.value),
  }));
  const categoryArt = useMemo(() => homeCategoryArt(draft.category), [draft.category]);
  const categoryWorldStyle = useAnimatedStyle(() => {
    const isReveal = shown === 'reveal';
    const targetOpacity = isReveal ? 0.24 : 0;
    return {
      opacity: reduceMotion ? targetOpacity : creationTiming(targetOpacity, { duration: 800, easing: CREATION_EASING.enter }),
    };
  }, [reduceMotion, shown]);

  /* ── derived presentation ─────────────────────────────────────────────── */
  const lettersVisible = (target === 'distillation' || target === 'formation') && letters.length > 0;
  const vertexIndexes = useMemo(
    () => (formation ? letterVertexIndexes(letters, formation.vertices.map((vertex) => vertex.letter)) : []),
    [formation, letters],
  );
  const glow = useMemo(() => {
    if (!formation || reduceMotion) return undefined;
    return { progress, departures: vertexIndexes.map((index) => (index >= 0 ? timeline.departures[index] : -1)), accent };
  }, [accent, formation, progress, reduceMotion, timeline, vertexIndexes]);

  // Each letter's journey, in stage coordinates: from where it sits in the lifted row to the
  // point its cell holds inside the formation square.
  const tokens = useMemo(() => {
    if (!formation || reduceMotion || !forming || stage.width <= 0) return null;
    const cx = stage.width / 2;
    const cy = stage.height / 2;
    const raise = Math.max(0, stage.height / 2 - LETTER_ROW / 2);
    const { scale, top } = placement;
    const left = (stage.width - markSize) / 2;
    const unit = markSize / 100;
    const toStage = (vx: number, vy: number): StagePoint => ({
      x: left + markSize / 2 + (vx * unit - markSize / 2) * scale,
      y: top + markSize / 2 + (vy * unit - markSize / 2) * scale,
    });
    const vertexLetter: string[] = [];
    const numbers: number[] = [];
    const origins: Array<StagePoint | null> = [];
    const targets: StagePoint[] = [];
    formation.vertices.forEach((vertex, index) => {
      const letterIndex = vertexIndexes.indexOf(index);
      const slot = letterIndex >= 0 ? slots?.get(letterIndex) : undefined;
      vertexLetter.push(vertex.letter ?? '');
      numbers.push(vertex.value);
      const fallbackOrigin: StagePoint = {
        x: cx + (letterIndex >= 0 ? (letterIndex - (letters.length - 1) / 2) * (26 * LIFTED_SCALE + 12) : 0),
        y: cy - raise,
      };
      origins.push(slot ? { x: cx + (slot.x - cx) * LIFTED_SCALE, y: cy - raise + (slot.y - cy) * LIFTED_SCALE } : fallbackOrigin);
      targets.push(toStage(vertex.x, vertex.y));
    });
    return { letters: vertexLetter, numbers, origins, targets };
  }, [formation, forming, letters.length, markSize, placement, reduceMotion, slots, stage, vertexIndexes]);

  const headline = HEADLINES[shown];
  const spokenStatus = shown === 'distillation'
    ? DISTILLATION_COPY.status[distillStage]
    : shown === 'formation'
    ? FORMATION_COPY.status[formationPhase]
    : shown === 'generating' && draft.generationState === 'generating'
    ? GENERATION_COPY.phase[generationPhase]
    : null;
  useEffect(() => {
    if (Platform.OS !== 'ios' || !spokenStatus) return;
    AccessibilityInfo.announceForAccessibility(spokenStatus);
  }, [spokenStatus]);
  const saving = draft.saveState === 'saving';
  const canGoBack = !replay && (step === 'distillation' || step === 'formation' || step === 'reveal' || step === 'expression' || step === 'generating' || step === 'choose') && !saving && !sealCommitted;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [stillnessCancelled, setStillnessCancelled] = useState(false);
  const stillnessPlayed = useRef(false);
  useEffect(() => {
    if (shown !== 'reveal' || step !== 'reveal' || replay || stillnessCancelled || sheetOpen) return;
    if (!stillnessPlayed.current) {
      stillnessPlayed.current = true;
      SoundPool.play('creation:revealSettle', { volume: 0.55 });
    }
    const wipeRemaining = !reduceMotion && iris.value < 1 ? 400 : 0;
    const timer = setTimeout(onOpenExpression, 1500 + wipeRemaining);
    return () => clearTimeout(timer);
  }, [iris, onOpenExpression, reduceMotion, replay, sheetOpen, shown, step, stillnessCancelled]);
  const categoryText = getCategoryTextColor(draft.category, colors.canvas, colors.text.primary);
  const intention = draft.normalizedIntention ?? draft.intention;
  const keepingOriginal = draft.expression === 'original';

  const categoryRow = (
    <View style={styles.categoryRow}>
      <View style={[styles.categoryDash, { backgroundColor: accent }]} />
      <Text style={[styles.categoryText, { color: categoryText }]}>{categoryLabel(draft.category).toUpperCase()}</Text>
    </View>
  );

  const panel = (() => {
    switch (shown) {
      case 'distillation':
        return (
          <Animated.Text style={[styles.status, dynamicStatusStyle]} accessibilityLiveRegion="polite" testID="distillation-status">
            {DISTILLATION_COPY.status[distillStage]}
          </Animated.Text>
        );
      case 'formation':
        return draft.formationError ? (
          <View style={styles.panelStack}>
            <View style={styles.darkError}><V2InlineError message={FORMATION_COPY.error} /></View>
            <V2Button size="large" style={styles.cta} onPress={onFormAnchor} testID="formation-retry">{FORMATION_COPY.retry}</V2Button>
          </View>
        ) : (
          <Animated.Text style={[styles.status, quietStatusStyle]} accessibilityLiveRegion="polite" testID="formation-status">
            {FORMATION_COPY.status[formationPhase]}
          </Animated.Text>
        );
      case 'reveal':
        return (
          <View style={styles.panelStack}>
            <Text style={styles.principle}>{REVEAL_COPY.body}</Text>
            <View style={styles.caption}>
              <Text style={styles.quote} numberOfLines={3} testID="reveal-intention">“{intention}”</Text>
              {categoryRow}
            </View>
            {/* // DEFERRED: <V2Button size="large" style={styles.cta} onPress={onOpenExpression} testID="reveal-continue">{REVEAL_COPY.cta}</V2Button> */}
            <Pressable onPress={() => { setStillnessCancelled(true); setSheetOpen(true); }} accessibilityRole="button" hitSlop={10} style={styles.link} testID="reveal-how-formed">
              <Text style={styles.linkText}>{REVEAL_COPY.howItFormed}</Text>
            </Pressable>
          </View>
        );
      case 'generating': {
        const failed = draft.generationState === 'error';
        return (
          <View style={styles.panelStack}>
            {failed ? (
              <>
                <View style={styles.darkError}><V2InlineError message={draft.generationError ?? GENERATION_COPY.body} offline={draft.generationError === GENERATION_ERRORS.offline} /></View>
                {/* An exhausted daily allowance is not fixed by trying again today. */}
                {draft.generationError === GENERATION_ERRORS.limit ? null : (
                  <V2Button size="large" style={styles.cta} onPress={onGenerate} testID="generation-retry">{GENERATION_COPY.retry}</V2Button>
                )}
                {draft.previousCandidates?.length === 2 && onReturnToPrevious ? (
                  <Pressable onPress={onReturnToPrevious} accessibilityRole="button" style={styles.link} testID="generation-previous">
                    <Animated.Text style={[styles.linkText, dynamicStatusStyle]}>{GENERATION_COPY.previous}</Animated.Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <Animated.Text style={[styles.generationBody, dynamicStatusStyle]} accessibilityLiveRegion="polite" testID="generation-status">
                {GENERATION_COPY.phase[generationPhase]}
              </Animated.Text>
            )}
            <Pressable onPress={onBack} accessibilityRole="button" style={styles.link} testID="generation-back">
              <Animated.Text style={[styles.linkText, dynamicStatusStyle]}>{GENERATION_COPY.back}</Animated.Text>
            </Pressable>
          </View>
        );
      }
      case 'choose': {
        const chooseFailure = draft.saveState === 'error' ? draft.saveFailure : undefined;
        return (
          <View style={styles.panelStack}>
            <Text style={styles.generationBody}>{CHOOSE_COPY.body}</Text>
            {draft.generationError && !chooseFailure ? <V2InlineError message={draft.generationError} /> : null}
            {chooseFailure ? (
              <View style={styles.failure}>
                <V2InlineError message={CREATION_SAVE_ERRORS[chooseFailure]} offline={chooseFailure === 'network'} />
                {chooseFailure === 'auth' && onSignIn ? (
                  <V2Button variant="secondary" onPress={onSignIn} testID="choose-sign-in">Sign in</V2Button>
                ) : null}
              </View>
            ) : null}
            {/* // DEFERRED: the old keep button; completion now comes from the selected medallion.
            <V2Button
              size="large"
              style={styles.cta}
              loading={saving}
              disabled={chosenIndex < 0 || chooseFailure === 'limit'}
              onPress={() => (chooseFailure === 'second_anchor' && onPaywall ? onPaywall() : onKeep())}
              accessibilityLabel={chooseFailure === 'second_anchor' ? PRO_LABEL : undefined}
              testID="choose-keep"
            >
              {chooseFailure === 'second_anchor' ? PRO_LABEL : chooseFailure ? 'Try again' : CHOOSE_COPY.keep}
            </V2Button>
            */}
            {chooseFailure ? <V2Button size="large" loading={saving} disabled={chooseFailure === 'limit'}
              onPress={() => chooseFailure === 'second_anchor' && onPaywall ? onPaywall() : onKeep()}
              testID="seal-save-retry">{chooseFailure === 'second_anchor' ? PRO_LABEL : 'Try again'}</V2Button> : null}
          </View>
        );
      }
      default:
        return null;
    }
  })();

  const expressionPanel = (() => {
    if (shown !== 'expression' || !svg) return null;
    const failure = draft.saveState === 'error' ? draft.saveFailure : undefined;
    return (
      <View style={styles.expressionPanel}>
        <Text style={styles.principle}>{EXPRESSION_COPY.principle}</Text>
        <View style={styles.libraryWrap}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.libraryContent}
            showsVerticalScrollIndicator
            persistentScrollbar
            testID="expression-library"
          >
            <ExpressionLibrary
              svg={svg}
              category={draft.category}
              intention={intention}
              selectedStyle={draft.styleChoice}
              keepOriginal={keepingOriginal}
              disabled={saving}
              onSelect={selectStyle}
            />
          </ScrollView>
          {/* More below: the grid visibly continues under a soft edge. */}
          <LinearGradient pointerEvents="none" colors={[`${colors.canvas}00`, colors.canvas]} style={styles.libraryFade} />
        </View>
        {failure ? (
          <View style={styles.failure}>
            <V2InlineError message={CREATION_SAVE_ERRORS[failure]} offline={failure === 'network'} />
            {failure === 'auth' && onSignIn ? (
              <V2Button variant="secondary" onPress={onSignIn} testID="creation-sign-in">Sign in</V2Button>
            ) : null}
          </View>
        ) : null}
        <V2Button
          size="large"
          style={styles.cta}
          loading={saving}
          disabled={failure === 'limit'}
          onPress={() => {
            if (failure === 'second_anchor' && onPaywall) return onPaywall();
            if (failure) return onKeep();
            if (keepingOriginal) {
              onKeepOriginal();
              return onKeep();
            }
            onGenerate();
          }}
          accessibilityLabel={failure === 'second_anchor' ? PRO_LABEL : keepingOriginal ? EXPRESSION_COPY.original : EXPRESSION_COPY.generate}
          testID={keepingOriginal ? 'expression-keep' : 'expression-generate'}
        >
          {failure === 'second_anchor' ? PRO_LABEL : failure ? 'Try again' : keepingOriginal ? EXPRESSION_COPY.original : EXPRESSION_COPY.generate}
        </V2Button>
      </View>
    );
  })();

  const markLabel = formed
    ? `Your Anchor, ${expressed && draft.styleChoice ? styleOption(draft.styleChoice)?.name ?? expressionSpec(draft.expression).label : 'original'} expression`
    : step === 'formation' ? 'Your Anchor, forming' : undefined;
  const discSize = markSize / PAPER_ART_SHARE;
  const showCandidates = (step === 'choose' || keptCandidate) && candidates.length === 2 && stage.width > 0;

  return (
    // Insets from the provider, not a native safe-area view: a freshly mounted native one
    // applies them a beat late, which visibly shifts the whole stage.
    <Animated.View style={[styles.safe, bgToneStyle, { paddingTop: insets.top, paddingBottom: insets.bottom }]} testID={`v2-creation-${step}`}>
      <StatusBar style={darkStatusBar ? 'dark' : 'light'} />
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', width: irisDiameter, height: irisDiameter, borderRadius: irisDiameter / 2,
        left: (viewport.width - irisDiameter) / 2,
        top: insets.top + 48 + 92 + stage.height / 2 - irisDiameter / 2,
        backgroundColor: colors.canvas,
      }, irisStyle]} />
      <DraftingSurface />
      <CreationTimingHud reduceMotion={reduceMotion} />
      <View style={[styles.frame, { paddingHorizontal: 32 }]}>
        <Animated.View style={[styles.top, chromeStyle]}>
          {canGoBack ? (
            <V2IconButton icon={
              <View style={{ width: 20, height: 20 }}>
                <Animated.View style={[StyleSheet.absoluteFill, backInkStyle]}><ArrowLeft size={20} color={colors.text.primary} /></Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, backPaperStyle]}><ArrowLeft size={20} color={colors.paper} /></Animated.View>
              </View>
            } accessibilityLabel="Go back" onPress={onBack} testID="creation-back" />
          ) : (
            <View style={styles.topSpacer} />
          )}
        </Animated.View>

        <Animated.View style={[styles.headline, quietChromeStyle]}>
          {headline.eyebrow ? <Animated.Text style={[styles.eyebrow, dynamicEyebrowStyle]}>{headline.eyebrow}</Animated.Text> : null}
          <Animated.Text style={[styles.title, dynamicTitleStyle]} accessibilityRole="header" testID="creation-title">{headline.title}</Animated.Text>
        </Animated.View>

        <View ref={stageRef} style={styles.stage} onLayout={onStageLayout} collapsable={false} testID="creation-stage">
          {shown === 'reveal' && categoryArt ? (
            <Animated.View style={[styles.categoryWorld, categoryWorldStyle]} pointerEvents="none">
              <Image source={categoryArt} style={styles.categoryWorldImg} resizeMode="contain" />
            </Animated.View>
          ) : null}

          {shown === 'expression' ? (
            <Animated.Text style={[styles.stageLabel, swapStyle]}>{EXPRESSION_COPY.structureLabel}</Animated.Text>
          ) : null}

          {lettersVisible ? (
            <Animated.View style={[StyleSheet.absoluteFill, lettersStyle]} pointerEvents="none">
              <DistillationLetters
                key={replayKey}
                intention={intention}
                letters={letters}
                reduceMotion={reduceMotion}
                startSettled={entryStep === 'formation' && !replay}
                glow={forming ? glow : undefined}
                tone={darkTone}
                showSource={!forming}
                onStage={onDistillStage}
                onSlots={setSlots}
              />
            </Animated.View>
          ) : null}

          {svg && stage.width > 0 ? (
            <Animated.View
              style={[styles.mark, { width: markSize, height: markSize, left: (stage.width - markSize) / 2 }, markStyle]}
              pointerEvents="none"
              accessible={Boolean(markLabel)}
              accessibilityRole="image"
              accessibilityLabel={markLabel}
              testID="creation-mark"
            >
              {showGenerationLayers && !inGeneration ? (
                <>
                  <Animated.View style={[styles.disc, { width: discSize, height: discSize, borderRadius: discSize / 2, left: (markSize - discSize) / 2, top: (markSize - discSize) / 2 }, discStyle]} />
                  {/* // DEFERRED: outer breathing ring; surface etching owns the wait.
                  <Animated.View style={[styles.discRing, { width: discSize + 18, height: discSize + 18, borderRadius: (discSize + 18) / 2, left: (markSize - discSize - 18) / 2, top: (markSize - discSize - 18) / 2 }, breathStyle]} />
                  */}
                </>
              ) : null}
              {forming && formation ? (
                <FormationLayer svg={svg} formation={formation} size={markSize} progress={progress} timeline={timeline} accent={accent} reduceMotion={reduceMotion} />
              ) : null}
              {!forming && !showGenerationLayers ? (
                <>
                  <Animated.View style={[StyleSheet.absoluteFill, darkMarkStyle]}>
                    <AnchorMark svg={svg} size={markSize} strokeColor={colors.paper} />
                  </Animated.View>
                  <Animated.View style={[StyleSheet.absoluteFill, neutralMarkStyle]}>
                    <AnchorMark svg={svg} size={markSize} strokeColor={colors.text.primary} />
                  </Animated.View>
                </>
              ) : null}
              <Animated.View style={[StyleSheet.absoluteFill, colourIn, shown === 'reveal' || inGeneration ? { opacity: 0 } : null]}>
                <Animated.View style={[StyleSheet.absoluteFill, genPreviewStyle]}>
                  <ExpressionPreview svg={svg} category={draft.category} size={markSize} from={look.from.expression} to={look.to.expression} fromTint={look.from.tint} toTint={look.to.tint} mix={mix} testID="expression-preview" />
                </Animated.View>
              </Animated.View>
              {inGeneration && formation ? (
                <GenerationEtching points={formation.vertices} size={markSize}
                  color={lookTint ?? (lookExpression === 'foil' ? FOIL_STOPS[1].color : colors.ink.base)}
                  requestId={draft.generationRequestId} running={developing} reduceMotion={reduceMotion} />
              ) : null}
              {/* // DEFERRED: uniform retrace replaced by expression etching.
              <Animated.View style={[StyleSheet.absoluteFill, inkStyle]}>
                <AnchorMark svg={svg} size={markSize} strokeColor={colors.ink.text.primary} drawProgress={retrace} />
              </Animated.View>
              */}
            </Animated.View>
          ) : null}

          {tokens ? (
            <MappingTokens
              letters={tokens.letters}
              numbers={tokens.numbers}
              origins={tokens.origins}
              targets={tokens.targets}
              departures={timeline.departures}
              landings={timeline.landings}
              progress={progress}
              accent={accent}
              fontSize={Math.round(30 * LIFTED_SCALE)}
            />
          ) : null}

          {showCandidates && svg ? (
            <CandidatePager
              svg={svg}
              category={draft.category}
              candidates={candidates}
              chosen={chosenIndex}
              stage={stage}
              originSize={discSize * placement.scale}
              originY={placement.centerY}
              emerge={emerge}
              resolve={resolve}
              handingOff={keptCandidate}
              disabled={saving || step !== 'choose'}
              reduceMotion={reduceMotion}
              points={formation?.vertices ?? []}
              onKeep={onKeep}
              onCommitted={() => { lockSeal(draft.draftId); setSealCommitted(true); }}
              onMeasure={(rect) => { sealRect.current = rect; }}
              onSelect={(index) => {
                v2Haptics.selection();
                onSelectCandidate(index);
              }}
            />
          ) : null}

          {step === 'handoff' ? (
            <Animated.View style={[styles.handoffCaption, { top: placement.centerY + (discSize * placement.scale) / 2 + spacing[3] }, handoffCaptionStyle]} pointerEvents="none">
              {categoryRow}
            </Animated.View>
          ) : null}

          {shown === 'reveal' && !replay && !sheetOpen ? (
            <Pressable style={StyleSheet.absoluteFill} onPress={onOpenExpression}
              accessibilityRole="button" accessibilityLabel={REVEAL_COPY.cta} testID="reveal-tap" />
          ) : null}
          {forming ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={hurry}
              accessibilityRole="button"
              accessibilityLabel="Finish forming"
              accessibilityHint="Completes the formation animation"
              testID="formation-hurry"
            />
          ) : null}
        </View>

        {shown === 'expression' ? (
          <Animated.View style={[styles.expressionWrap, viewport.heightClass === 'short' && styles.expressionWrapShort, swapStyle]}>{expressionPanel}</Animated.View>
        ) : (
          <Animated.View style={[styles.panelWrap, swapStyle]}>
            <ScrollView
              style={styles.panelScroll}
              contentContainerStyle={[styles.panel, { paddingBottom: Math.max(spacing[3], viewport.bottomInset ? spacing[2] : spacing[4]) }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {panel}
            </ScrollView>
          </Animated.View>
        )}
      </View>

      <FormationSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onReplay={() => {
          setSheetOpen(false);
          startReplay();
        }}
        intention={intention}
        letters={letters}
        category={draft.category}
        formation={formation}
        svg={svg}
      />
    </Animated.View>
  );
}

export const LANDING_RATE_STEP = 0.06;
export const LANDING_RATE_MAX = 1.48;
export function distillLandingRate(index: number): number {
  return Math.min(1 + LANDING_RATE_STEP * Math.max(0, index), LANDING_RATE_MAX);
}

/** Fades the hand-off caption in once the Anchor has taken its place. */
function useResolveStyle(resolve: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    opacity: interpolate(resolve.value, [0.55, 1], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(resolve.value, [0.55, 1], [6, 0], 'clamp') }],
  }));
}

/**
 * The two interpretations. They emerge from the one circle the structure was developed in,
 * sit side by side large enough to compare, answer a choice clearly, and — once one is kept —
 * the chosen one takes the centre in its circle while the other withdraws.
 */
// DEFERRED: stacked medallions replaced by the full-width pager.
// DEFERRED: function CandidatePair({
// DEFERRED:   svg,
// DEFERRED:   category,
// DEFERRED:   candidates,
// DEFERRED:   chosen,
// DEFERRED:   stage,
// DEFERRED:   originSize,
// DEFERRED:   originY,
// DEFERRED:   emerge,
// DEFERRED:   resolve,
// DEFERRED:   handingOff,
// DEFERRED:   disabled,
// DEFERRED:   reduceMotion,
// DEFERRED:   onSelect,
// DEFERRED: }: {
// DEFERRED:   svg: string;
// DEFERRED:   category?: string;
// DEFERRED:   candidates: CreationDraft['generatedCandidates'];
// DEFERRED:   chosen: number;
// DEFERRED:   stage: { width: number; height: number };
// DEFERRED:   /** The developing circle's on-screen diameter, where both begin. */
// DEFERRED:   originSize: number;
// DEFERRED:   originY: number;
// DEFERRED:   emerge: SharedValue<number>;
// DEFERRED:   resolve: SharedValue<number>;
// DEFERRED:   handingOff: boolean;
// DEFERRED:   disabled: boolean;
// DEFERRED:   reduceMotion: boolean;
// DEFERRED:   onSelect: (index: number) => void;
// DEFERRED: }) {
// DEFERRED:   const gap = spacing[3];
// DEFERRED:   // Portrait compositions give each interpretation a generous diagonal field. On short
// DEFERRED:   // stages they remain side by side so neither overlaps the controls or safe area.
// DEFERRED:   const portrait = stage.height >= stage.width * 1.05;
// DEFERRED:   const size = portrait
// DEFERRED:     ? Math.min(stage.width * 0.64, (stage.height - gap - 24) / 2)
// DEFERRED:     : Math.min((stage.width - gap - 24) / 2, stage.height * 0.84);
// DEFERRED:   const centerY = stage.height / 2;
// DEFERRED:   const slots = portrait
// DEFERRED:     ? [stage.width * 0.38, stage.width * 0.62]
// DEFERRED:     : [stage.width / 2 - (size + gap) / 2, stage.width / 2 + (size + gap) / 2];
// DEFERRED:   const heroSize = originSize;
// DEFERRED:   return (
// DEFERRED:     <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
// DEFERRED:       {candidates.slice(0, 2).map((candidate, index) => (
// DEFERRED:         <Candidate
// DEFERRED:           key={`${candidate.variationId ?? candidate.imageUrl}-${index}`}
// DEFERRED:           index={index}
// DEFERRED:           svg={svg}
// DEFERRED:           category={category}
// DEFERRED:           imageUrl={candidate.imageUrl}
// DEFERRED:           size={size}
// DEFERRED:           slotX={slots[index]}
// DEFERRED:           slotY={portrait ? centerY + (index === 0 ? -1 : 1) * (size + gap) / 2 : centerY}
// DEFERRED:           originX={stage.width / 2}
// DEFERRED:           originY={originY}
// DEFERRED:           originScale={originSize / size}
// DEFERRED:           heroScale={heroSize / size}
// DEFERRED:           chosen={chosen}
// DEFERRED:           emerge={emerge}
// DEFERRED:           resolve={resolve}
// DEFERRED:           handingOff={handingOff}
// DEFERRED:           disabled={disabled}
// DEFERRED:           reduceMotion={reduceMotion}
// DEFERRED:           onSelect={onSelect}
// DEFERRED:         />
// DEFERRED:       ))}
// DEFERRED:     </View>
// DEFERRED:   );
// DEFERRED: }
// DEFERRED: 
// DEFERRED: function Candidate({
// DEFERRED:   index,
// DEFERRED:   svg,
// DEFERRED:   category,
// DEFERRED:   imageUrl,
// DEFERRED:   size,
// DEFERRED:   slotX,
// DEFERRED:   slotY,
// DEFERRED:   originX,
// DEFERRED:   originY,
// DEFERRED:   originScale,
// DEFERRED:   heroScale,
// DEFERRED:   chosen,
// DEFERRED:   emerge,
// DEFERRED:   resolve,
// DEFERRED:   handingOff,
// DEFERRED:   disabled,
// DEFERRED:   reduceMotion,
// DEFERRED:   onSelect,
// DEFERRED: }: {
// DEFERRED:   index: number;
// DEFERRED:   svg: string;
// DEFERRED:   category?: string;
// DEFERRED:   imageUrl: string;
// DEFERRED:   size: number;
// DEFERRED:   slotX: number;
// DEFERRED:   slotY: number;
// DEFERRED:   originX: number;
// DEFERRED:   originY: number;
// DEFERRED:   originScale: number;
// DEFERRED:   heroScale: number;
// DEFERRED:   chosen: number;
// DEFERRED:   emerge: SharedValue<number>;
// DEFERRED:   resolve: SharedValue<number>;
// DEFERRED:   handingOff: boolean;
// DEFERRED:   disabled: boolean;
// DEFERRED:   reduceMotion: boolean;
// DEFERRED:   onSelect: (index: number) => void;
// DEFERRED: }) {
// DEFERRED:   const isChosen = chosen === index;
// DEFERRED:   const someoneChosen = chosen >= 0;
// DEFERRED:   const response = useSharedValue(0); // 1 chosen, -1 set aside, 0 undecided
// DEFERRED:   useEffect(() => {
// DEFERRED:     const next = !someoneChosen ? 0 : isChosen ? 1 : -1;
// DEFERRED:     response.value = reduceMotion ? next : creationTiming(next, { duration: 280, easing: CREATION_EASING.deliberate });
// DEFERRED:   }, [isChosen, reduceMotion, response, someoneChosen]);
// DEFERRED: 
// DEFERRED:   const style = useAnimatedStyle(() => {
// DEFERRED:     const e = emerge.value;
// DEFERRED:     const r = handingOff && isChosen ? resolve.value : 0;
// DEFERRED:     const away = handingOff && !isChosen ? resolve.value : 0;
// DEFERRED:     // Emerge: from the developing circle to this slot. Resolve: the kept one to the centre.
// DEFERRED:     const x = originX + (slotX - originX) * e + (originX - slotX) * r;
// DEFERRED:     const y = originY + (slotY - originY) * e + (originY - slotY) * r;
// DEFERRED:     const baseScale = originScale + (1 - originScale) * e;
// DEFERRED:     const chosenScale = 1 + response.value * (response.value >= 0 ? 0.025 : 0.035);
// DEFERRED:     const scale = (baseScale * chosenScale) * (1 - r) + heroScale * r;
// DEFERRED:     const opacity = interpolate(e, [0, 0.55], [0, 1], 'clamp') * (1 + Math.min(0, response.value) * 0.22) * (1 - away);
// DEFERRED:     return { opacity, transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }, { scale }] };
// DEFERRED:   }, [handingOff, isChosen, originScale, originX, originY, heroScale, size, slotX, slotY]);
// DEFERRED:   const ringStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, response.value) * (1 - (handingOff ? resolve.value : 0)) }), [handingOff]);
// DEFERRED: 
// DEFERRED:   return (
// DEFERRED:     <Animated.View style={[styles.candidate, { width: size, height: size }, style]}>
// DEFERRED:       <Pressable
// DEFERRED:         onPress={() => onSelect(index)}
// DEFERRED:         disabled={disabled}
// DEFERRED:         accessibilityRole="radio"
// DEFERRED:         accessibilityLabel={`Anchor interpretation ${index === 0 ? 'one' : 'two'}`}
// DEFERRED:         accessibilityState={{ selected: isChosen, disabled }}
// DEFERRED:         testID={`candidate-${index}`}
// DEFERRED:         style={styles.flex}
// DEFERRED:       >
// DEFERRED:         <Animated.View style={[styles.candidateRing, { width: size + 14, height: size + 14, borderRadius: (size + 14) / 2 }, ringStyle]} />
// DEFERRED:         <CircularAnchorRenderer svg={svg} imageUrl={imageUrl} category={category} size={size} appearance="paper" accessibilityLabel={`Generated Anchor interpretation ${index === 0 ? 'one' : 'two'}`} />
// DEFERRED:       </Pressable>
// DEFERRED:     </Animated.View>
// DEFERRED:   );
// DEFERRED: }
// DEFERRED: 
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  frame: { flex: 1 },
  top: { height: 48, justifyContent: 'center', marginLeft: -spacing[2] },
  topSpacer: { height: 44 },
  headline: { gap: spacing[2], minHeight: 92, paddingTop: spacing[1] },
  eyebrow: { ...typography.labelSM, color: colors.text.secondary },
  title: { fontFamily: 'EBGaramond-Regular', fontSize: 34, lineHeight: 38, letterSpacing: -0.5, color: colors.text.primary },
  stage: { flex: 1, minHeight: 0, overflow: 'visible' },
  stageLabel: { ...typography.labelSM, color: colors.text.secondary, position: 'absolute', top: 0, left: 0 },
  mark: { position: 'absolute', top: 0 },
  disc: { position: 'absolute', backgroundColor: PAPER },
  discRing: { position: 'absolute', borderWidth: 1, borderColor: colors.ink.base },
  panelWrap: { flexShrink: 1 },
  panelScroll: { flexGrow: 0, flexShrink: 1 },
  panel: { gap: spacing[4], paddingTop: spacing[2] },
  panelStack: { gap: spacing[4] },
  expressionWrap: { flex: 1.1, minHeight: 0 },
  // A short screen keeps the structure legible: the library scrolls in a little less room.
  expressionWrapShort: { flex: 1.1 },
  expressionPanel: { flex: 1, gap: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[3] },
  libraryWrap: { flex: 1, minHeight: 0 },
  libraryContent: { paddingBottom: spacing[6] },
  libraryFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 36 },
  status: { ...typography.labelSM, color: colors.text.secondary, textAlign: 'center', paddingVertical: spacing[5] },
  caption: { alignItems: 'center', gap: spacing[2] },
  quote: { fontFamily: 'EBGaramond-Medium', fontStyle: 'italic', fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: colors.text.primary, textAlign: 'center' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  categoryDash: { width: 18, height: 5, borderRadius: 2 },
  categoryText: { fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 2.2 },
  handoffCaption: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  principle: { ...typography.caption, color: colors.text.secondary, textAlign: 'center' },
  generationBody: { ...typography.bodyMD, color: colors.text.secondary, textAlign: 'center', paddingVertical: spacing[2] },
  candidate: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  candidateRing: {
    position: 'absolute',
    left: -8,
    top: -8,
    borderWidth: 1,
    borderColor: colors.text.primary,
  },
  categoryWorld: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryWorldImg: {
    width: '100%',
    height: '100%',
  },
  failure: { gap: spacing[2] },
  darkError: { backgroundColor: colors.surface, padding: spacing[3], borderRadius: 8 },
  cta: { height: 56, borderRadius: 16 },
  link: { alignSelf: 'center', paddingVertical: spacing[1] },
  linkText: { ...typography.labelMD, color: colors.text.secondary, textDecorationLine: 'underline' },
  hudContainer: { position: 'absolute', top: 12, right: 12, zIndex: 9999 },
  hudPill: { backgroundColor: colors.ink.deep, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  hudPillText: { color: colors.paper, fontSize: 11, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  hudPanel: { backgroundColor: colors.ink.raised, padding: 10, borderRadius: 8, marginTop: 4, width: 280, shadowColor: colors.ink.deep, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 },
  hudHeader: { color: colors.ink.text.secondary, fontSize: 10, marginBottom: 6, fontWeight: '700' },
  hudRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  hudStep: { color: colors.ink.text.primary, fontSize: 10, flex: 1 },
  hudTime: { color: colors.paper, fontSize: 10, fontWeight: '600', marginLeft: 8 },
});
