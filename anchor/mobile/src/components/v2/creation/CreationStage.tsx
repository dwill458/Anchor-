import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';

import { V2Button, V2IconButton } from '@/components/v2';
import { V2InlineError } from '@/components/v2/feedback/V2Feedback';
import { CREATION_EXPRESSION_SPECS } from '@/components/v2/anchor/anchorExpressions';
import { categoryLabel } from '@/components/v2/anchors/anchorPresentation';
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
import { formationForDraft, type CreationDraft } from '@/stores/v2/creationStore';
import { useV2Responsive } from '@/hooks/v2';
import { AnchorMotion, colors, getCategoryColor, getCategoryTextColor, spacing, typography } from '@/theme/v2';
import {
  CREATION_EASING,
  CREATION_TIMING,
  FORMATION_TIMING,
  creationMarkSize,
  formationTimeline,
  letterVertexIndexes,
  stageFitScale,
  type FormationTimeline,
} from './creationMotion';
import { DistillationLetters } from './DistillationLetters';
import type { DistillationStage } from './distillationMotion';
import { ExpressionPreview } from './ExpressionPreview';
import { ExpressionCards } from './ExpressionCards';
import { FormationLayer, vertexArrivals } from './FormationLayer';
import { FormationSheet } from './FormationSheet';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';

export type WindowRect = { x: number; y: number; width: number; height: number };

/** Room kept above the grid for the lifted letter row during formation. */
const LETTER_ROW = 46;
/** Below this the stage cannot show the mark legibly; it steps aside for the panel. */
const MIN_STAGE_FOR_MARK = 76;

const HEADLINES: Record<CreationStep, { eyebrow: string; title: string }> = {
  intention: { eyebrow: '', title: '' },
  distillation: { eyebrow: DISTILLATION_COPY.eyebrow, title: DISTILLATION_COPY.title },
  formation: { eyebrow: FORMATION_COPY.eyebrow, title: FORMATION_COPY.title },
  reveal: { eyebrow: REVEAL_COPY.eyebrow, title: REVEAL_COPY.title },
  expression: { eyebrow: EXPRESSION_COPY.eyebrow, title: EXPRESSION_COPY.title },
  generating: { eyebrow: GENERATION_COPY.eyebrow, title: GENERATION_COPY.title },
  choose: { eyebrow: CHOOSE_COPY.eyebrow, title: CHOOSE_COPY.title },
  handoff: { eyebrow: CHOOSE_COPY.eyebrow, title: CHOOSE_COPY.title },
};

const REDUCED_TIMELINE: FormationTimeline = { total: FORMATION_TIMING.reducedTotal, gridEnd: 0.35, pathStart: 0.35, pathEnd: 0.6 };

export interface CreationStageProps {
  draft: CreationDraft;
  reduceMotion: boolean;
  /** The step the flow was opened on. A resumed flow does not replay what already happened. */
  entryStep: CreationStep;
  onBack: () => void;
  onFormAnchor: () => void;
  onFormationDone: () => void;
  onOpenExpression: () => void;
  onSelectExpression: (expression: AnchorExpression) => void;
  onKeep: () => void;
  onGenerate: () => void;
  onKeepOriginal: () => void;
  onSelectCandidate: (index: number) => void;
  onSignIn?: () => void;
  onPaywall?: () => void;
  onHandoff: (markRect: WindowRect | null) => void;
}

export function CreationStage({
  draft,
  reduceMotion,
  entryStep,
  onBack,
  onFormAnchor,
  onFormationDone,
  onOpenExpression,
  onSelectExpression,
  onKeep,
  onGenerate,
  onKeepOriginal,
  onSelectCandidate,
  onSignIn,
  onPaywall,
  onHandoff,
}: CreationStageProps) {
  const step = draft.currentStep;
  const viewport = useV2Responsive();
  const insets = useSafeAreaInsets();
  const markSize = creationMarkSize(viewport);
  const svg = draft.structureSvg;
  const accent = getCategoryColor(draft.category);
  const specs = CREATION_EXPRESSION_SPECS;
  const expressionIndex = Math.max(0, specs.findIndex((spec) => spec.id === draft.expression));
  const letters = useMemo(() => draft.distilledLetters ?? [], [draft.distilledLetters]);
  const formation = useMemo(
    () => formationForDraft({ distilledLetters: letters, category: draft.category }),
    [letters, draft.category],
  );
  const timeline = useMemo(
    () => (reduceMotion ? REDUCED_TIMELINE : formationTimeline(formation?.vertices.length ?? 0)),
    [formation, reduceMotion],
  );
  const formed = step === 'reveal' || step === 'expression' || step === 'generating' || step === 'choose' || step === 'handoff';

  /* ── shared motion state ─────────────────────────────────────────────── */
  const progress = useSharedValue(formed ? 1 : 0);
  const railPosition = useSharedValue(expressionIndex);
  const chrome = useSharedValue(1);
  const markY = useSharedValue(0);
  const markScale = useSharedValue(1);
  const markVisible = useSharedValue(1);

  /* ── displayed step: the headline and panel swap out, then in ─────────── */
  const [shown, setShown] = useState<CreationStep>(step);
  const swap = useSharedValue(1);
  useEffect(() => {
    if (shown === step) return undefined;
    if (step === 'handoff') return undefined; // hand-off keeps the last panel while it fades
    if (reduceMotion) {
      setShown(step);
      return undefined;
    }
    swap.value = withTiming(0, { duration: CREATION_TIMING.swapOut, easing: CREATION_EASING.deliberate });
    const timer = setTimeout(() => {
      setShown(step);
      swap.value = withTiming(1, { duration: CREATION_TIMING.swapIn, easing: CREATION_EASING.enter });
    }, CREATION_TIMING.swapOut + 10);
    return () => clearTimeout(timer);
  }, [reduceMotion, shown, step, swap]);

  /* ── stage layout → where and how large the mark sits ─────────────────── */
  const stageRef = useRef<View>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const onStageLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setStage((previous) => (Math.abs(previous.width - width) < 0.5 && Math.abs(previous.height - height) < 0.5 ? previous : { width, height }));
  }, []);

  const placement = useMemo(() => {
    const lifted = shown === 'formation' || shown === 'distillation';
    const room = { width: stage.width, height: Math.max(0, stage.height - (lifted ? LETTER_ROW * 2 : 0)) };
    const scale = stageFitScale(room, markSize);
    const centerY = stage.height / 2 + (lifted ? LETTER_ROW / 2 : 0);
    return { scale, top: centerY - markSize / 2, visible: stage.height >= MIN_STAGE_FOR_MARK };
  }, [markSize, shown, stage]);
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
    markY.value = withTiming(placement.top, timing);
    markScale.value = withTiming(placement.scale, timing);
    markVisible.value = withTiming(placement.visible ? 1 : 0, timing);
  }, [markScale, markVisible, markY, placement, reduceMotion, stage.height]);

  /* ── distillation → formation ─────────────────────────────────────────── */
  const [distillStage, setDistillStage] = useState<DistillationStage>('whole');
  const formRequested = useRef(false);
  const onDistillStage = useCallback((next: DistillationStage) => setDistillStage(next), []);
  useEffect(() => {
    if (step !== 'distillation' || distillStage !== 'settled' || formRequested.current) return undefined;
    const timer = setTimeout(() => {
      formRequested.current = true;
      onFormAnchor();
    }, reduceMotion ? 120 : CREATION_TIMING.distillHold);
    return () => clearTimeout(timer);
  }, [distillStage, onFormAnchor, reduceMotion, step]);

  /* ── formation: one progress value drives grid, points, trace and colour ─ */
  const [formationPhase, setFormationPhase] = useState<keyof typeof FORMATION_COPY.status>('grid');
  const formationTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const formationRunning = useRef(false);
  const clearFormationTimers = () => {
    formationTimers.current.forEach(clearTimeout);
    formationTimers.current = [];
  };

  const runFormation = useCallback(
    (duration: number) => {
      clearFormationTimers();
      const from = progress.value;
      const remaining = Math.max(0, 1 - from);
      const total = Math.max(1, duration);
      progress.value = withTiming(1, { duration: total, easing: Easing.linear });
      const at = (fraction: number) => Math.max(0, ((fraction - from) / (remaining || 1)) * total);
      if (from < timeline.pathStart) formationTimers.current.push(setTimeout(() => setFormationPhase('path'), at(timeline.pathStart)));
      if (from < timeline.pathEnd) formationTimers.current.push(setTimeout(() => setFormationPhase('settle'), at(timeline.pathEnd)));
      // Completion does not wait for an animation callback: the timer is the contract, and it
      // still holds when frames are paused (backgrounded app, tests).
      formationTimers.current.push(setTimeout(() => {
        formationRunning.current = false;
        onFormationDone();
      }, total + 40));
    },
    [onFormationDone, progress, timeline],
  );

  useEffect(() => {
    if (step !== 'formation' || !svg || draft.formationError || formationRunning.current) return undefined;
    formationRunning.current = true;
    runFormation(timeline.total * (1 - progress.value));
    return undefined;
  }, [draft.formationError, progress, runFormation, step, svg, timeline.total]);

  useEffect(() => () => clearFormationTimers(), []);

  // Leaving formation early (Back) stops it cleanly; returning replays it from the start.
  useEffect(() => {
    if (step === 'formation' || formed) return;
    clearFormationTimers();
    formationRunning.current = false;
    formRequested.current = false;
    cancelAnimation(progress);
    progress.value = 0;
    setFormationPhase('grid');
  }, [formed, progress, step]);

  /** A tap during formation finishes it briskly instead of skipping what it shows. */
  const hurry = useCallback(() => {
    if (step !== 'formation' || !formationRunning.current || progress.value > 0.92) return;
    cancelAnimation(progress);
    runFormation(FORMATION_TIMING.hurry);
  }, [progress, runFormation, step]);

  /* ── expression ───────────────────────────────────────────────────────── */
  useEffect(() => {
    // An expression set from outside the rail (resume) lands without a sweep.
    if (Math.round(railPosition.value) !== expressionIndex && step !== 'expression') railPosition.value = expressionIndex;
  }, [expressionIndex, railPosition, step]);
  const commitExpression = useCallback((expression: AnchorExpression) => {
    onSelectExpression(expression);
  }, [onSelectExpression]);

  /* ── hand-off to Home ─────────────────────────────────────────────────── */
  const handedOff = useRef(false);
  const stageWidthRef = useRef(0);
  stageWidthRef.current = stage.width;
  const onHandoffRef = useRef(onHandoff);
  onHandoffRef.current = onHandoff;
  useEffect(() => {
    if (step !== 'handoff' || handedOff.current) return undefined;
    handedOff.current = true;
    Keyboard.dismiss();
    chrome.value = reduceMotion ? 0 : withTiming(0, { duration: CREATION_TIMING.handoffFade, easing: AnchorMotion.easing.exit });
    // The panel steps aside, so the mark returns to its full place before it travels.
    setTimeout(() => setShown('handoff'), reduceMotion ? 0 : CREATION_TIMING.handoffFade);
    setTimeout(() => {
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
        const { scale, top } = placementRef.current;
        const size = markSize * scale;
        const rect = Number.isFinite(x) && Number.isFinite(y) && size > 0
          ? { x: x + stageWidthRef.current / 2 - size / 2, y: y + top + markSize / 2 - size / 2, width: size, height: size }
          : null;
        onHandoffRef.current(rect);
      });
    }, reduceMotion ? 60 : CREATION_TIMING.handoffFade + CREATION_TIMING.stageFit + 40);
    // Deliberately not cleaned up on re-render: once begun, the hand-off must complete.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* ── animated styles ──────────────────────────────────────────────────── */
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
  const swapStyle = useAnimatedStyle(() => ({
    opacity: swap.value * chrome.value,
    transform: [{ translateY: (1 - swap.value) * 8 }],
  }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markVisible.value,
    transform: [{ translateY: markY.value }, { scale: markScale.value }],
  }));
  const colourIn = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [timeline.pathEnd, timeline.pathEnd + (1 - timeline.pathEnd) * 0.45], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(progress.value, [timeline.pathEnd, 1], [0.975, 1], 'clamp') }],
  }));
  const lettersStyle = useAnimatedStyle(() => {
    const settleStart = timeline.pathEnd;
    const lift = interpolate(progress.value, [0, timeline.gridEnd], [0, 1], 'clamp');
    return {
      opacity: interpolate(progress.value, [settleStart, settleStart + (1 - settleStart) * 0.5], [1, 0], 'clamp'),
      transform: [
        { translateY: -lift * Math.max(0, stage.height / 2 - LETTER_ROW / 2) },
        { scale: 1 - lift * 0.22 },
      ],
    };
  }, [stage.height, timeline]);

  /* ── derived presentation ─────────────────────────────────────────────── */
  const lettersVisible = (step === 'distillation' || step === 'formation') && letters.length > 0;
  const glow = useMemo(() => {
    if (!formation || reduceMotion) return undefined;
    const vertexTimes = vertexArrivals(formation, timeline);
    const indexes = letterVertexIndexes(letters, formation.vertices.map((vertex) => vertex.letter));
    return { progress, arrivals: indexes.map((index) => (index >= 0 ? vertexTimes[index] : -1)), accent };
  }, [accent, formation, letters, progress, reduceMotion, timeline]);
  const headline = HEADLINES[shown];
  const saving = draft.saveState === 'saving';
  const canGoBack = (step === 'distillation' || step === 'formation' || step === 'reveal' || step === 'expression' || step === 'generating' || step === 'choose') && !saving;
  const [sheetOpen, setSheetOpen] = useState(false);
  const categoryText = getCategoryTextColor(draft.category, colors.canvas, colors.text.primary);
  const intention = draft.normalizedIntention ?? draft.intention;

  const panel = (() => {
    switch (shown) {
      case 'distillation':
        return (
          <Text style={styles.status} accessibilityLiveRegion="polite" testID="distillation-status">
            {DISTILLATION_COPY.status[distillStage]}
          </Text>
        );
      case 'formation':
        return draft.formationError ? (
          <View style={styles.panelStack}>
            <V2InlineError message={FORMATION_COPY.error} />
            <V2Button size="large" style={styles.cta} onPress={onFormAnchor} testID="formation-retry">{FORMATION_COPY.retry}</V2Button>
          </View>
        ) : (
          <Text style={styles.status} accessibilityLiveRegion="polite" testID="formation-status">
            {FORMATION_COPY.status[formationPhase]}
          </Text>
        );
      case 'reveal':
        return (
          <View style={styles.panelStack}>
            <Text style={styles.principle}>{REVEAL_COPY.body}</Text>
            <View style={styles.caption}>
              <Text style={styles.quote} numberOfLines={3} testID="reveal-intention">“{intention}”</Text>
              <View style={styles.categoryRow}>
                <View style={[styles.categoryDash, { backgroundColor: accent }]} />
                <Text style={[styles.categoryText, { color: categoryText }]}>{categoryLabel(draft.category).toUpperCase()}</Text>
              </View>
            </View>
            <V2Button size="large" style={styles.cta} onPress={onOpenExpression} testID="reveal-continue">{REVEAL_COPY.cta}</V2Button>
            <Pressable onPress={() => setSheetOpen(true)} accessibilityRole="button" hitSlop={10} style={styles.link} testID="reveal-how-formed">
              <Text style={styles.linkText}>{REVEAL_COPY.howItFormed}</Text>
            </Pressable>
          </View>
        );
      case 'expression': {
        const failure = draft.saveState === 'error' ? draft.saveFailure : undefined;
        return (
          <View style={styles.panelStack}>
            <Text style={styles.principle}>{EXPRESSION_COPY.principle}</Text>
            <ExpressionCards selected={draft.expression} category={draft.category} intention={intention} disabled={saving} onSelect={commitExpression} />
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
                if (draft.expression === 'original') {
                  onKeepOriginal();
                  return onKeep();
                }
                onGenerate();
              }}
              accessibilityLabel={failure === 'second_anchor' ? 'See Anchor Pro' : draft.expression === 'original' ? EXPRESSION_COPY.original : EXPRESSION_COPY.generate}
              testID={draft.expression === 'original' ? 'expression-keep' : 'expression-generate'}
            >
              {failure === 'second_anchor' ? 'See Pro' : failure ? 'Try again' : draft.expression === 'original' ? EXPRESSION_COPY.original : EXPRESSION_COPY.generate}
            </V2Button>
          </View>
        );
      }
      case 'generating':
        return (
          <View style={styles.panelStack}>
            <Text style={styles.generationBody}>{GENERATION_COPY.body}</Text>
            {draft.generationError ? <V2InlineError message={draft.generationError} offline={draft.generationError.toLowerCase().includes('network')} /> : null}
            <V2Button size="large" style={styles.cta} loading={draft.generationState === 'generating'} disabled={draft.generationState === 'generating'} onPress={onGenerate} testID="generation-retry">{draft.generationError ? GENERATION_COPY.retry : 'Developing expression…'}</V2Button>
            <Pressable onPress={onBack} accessibilityRole="button" style={styles.link} testID="generation-back"><Text style={styles.linkText}>{GENERATION_COPY.back}</Text></Pressable>
          </View>
        );
      case 'choose': {
        const candidates = (draft.generatedCandidates ?? []).slice(0, 2);
        const chooseFailure = draft.saveState === 'error' ? draft.saveFailure : undefined;
        return (
          <View style={styles.panelStack}>
            <Text style={styles.generationBody}>{CHOOSE_COPY.body}</Text>
            <View style={styles.candidateRow}>
              {candidates.map((candidate, index) => (
                <Pressable
                  key={`${candidate.variationId ?? candidate.imageUrl}-${index}`}
                  onPress={() => onSelectCandidate(index)}
                  accessibilityRole="radio"
                  accessibilityLabel={`Anchor option ${index === 0 ? 'A' : 'B'}`}
                  accessibilityState={{ selected: draft.selectedCandidateIndex === index }}
                  testID={`candidate-${index}`}
                  style={[styles.candidate, draft.selectedCandidateIndex === index && styles.candidateSelected]}
                >
                  <CircularAnchorRenderer svg={svg ?? ''} imageUrl={candidate.imageUrl} category={draft.category} size={132} appearance="paper" accessibilityLabel={`Generated Anchor option ${index === 0 ? 'A' : 'B'}`} />
                  <Text style={styles.candidateLabel}>{index === 0 ? 'A' : 'B'}</Text>
                </Pressable>
              ))}
            </View>
            {chooseFailure ? <V2InlineError message={CREATION_SAVE_ERRORS[chooseFailure]} offline={chooseFailure === 'network'} /> : null}
            <V2Button size="large" style={styles.cta} loading={saving} onPress={onKeep} testID="choose-keep">{CHOOSE_COPY.keep}</V2Button>
            <Pressable onPress={onGenerate} accessibilityRole="button" style={styles.link} testID="choose-retry"><Text style={styles.linkText}>{CHOOSE_COPY.retry}</Text></Pressable>
          </View>
        );
      }
      default:
        return null;
    }
  })();

  const generatedCandidates = draft.generatedCandidates ?? [];
  const selectedCandidate = generatedCandidates[draft.selectedCandidateIndex ?? 0];
  const markLabel = formed
    ? `Your Anchor, ${specs[expressionIndex]?.label ?? 'Original'} expression`
    : step === 'formation' ? 'Your Anchor, forming' : undefined;

  return (
    // Insets from the provider, not a native safe-area view: a freshly mounted native one
    // applies them a beat late, which visibly shifts the whole stage.
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]} testID={`v2-creation-${step}`}>
      {/* Edge-to-edge: Android does not resize for the keyboard, so both platforms avoid it here. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={[styles.frame, { paddingHorizontal: viewport.gutter }]}>
          <Animated.View style={[styles.top, chromeStyle]}>
            {canGoBack ? (
              <V2IconButton icon={<ArrowLeft size={20} color={colors.text.primary} />} accessibilityLabel="Go back" onPress={onBack} testID="creation-back" />
            ) : (
              <View style={styles.topSpacer} />
            )}
          </Animated.View>

          <Animated.View style={[styles.headline, swapStyle]}>
            {headline.eyebrow ? <Text style={styles.eyebrow}>{headline.eyebrow}</Text> : null}
            <Text style={styles.title} accessibilityRole="header" testID="creation-title">{headline.title}</Text>
          </Animated.View>

          <View ref={stageRef} style={styles.stage} onLayout={onStageLayout} collapsable={false} testID="creation-stage">
            {lettersVisible ? (
              <Animated.View style={[StyleSheet.absoluteFill, lettersStyle]} pointerEvents="none">
                <DistillationLetters
                  intention={intention}
                  letters={letters}
                  reduceMotion={reduceMotion || entryStep === 'formation'}
                  glow={step === 'formation' ? glow : undefined}
                  onStage={onDistillStage}
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
                {step === 'formation' && formation ? (
                  <FormationLayer svg={svg} formation={formation} size={markSize} progress={progress} timeline={timeline} accent={accent} reduceMotion={reduceMotion} />
                ) : null}
                <Animated.View style={[StyleSheet.absoluteFill, colourIn]}>
                  {step === 'choose' && selectedCandidate ? (
                    <CircularAnchorRenderer svg={svg} imageUrl={selectedCandidate.imageUrl} category={draft.category} size={markSize} appearance="paper" />
                  ) : (
                    <ExpressionPreview svg={svg} category={draft.category} size={markSize} specs={specs} position={railPosition} testID="expression-preview" />
                  )}
                </Animated.View>
              </Animated.View>
            ) : null}

            {step === 'formation' ? (
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
        </View>
      </KeyboardAvoidingView>

      <FormationSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        intention={intention}
        letters={letters}
        category={draft.category}
        formation={formation}
        svg={svg}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  frame: { flex: 1 },
  top: { height: 48, justifyContent: 'center', marginLeft: -spacing[2] },
  topSpacer: { height: 44 },
  headline: { gap: spacing[2], minHeight: 92, paddingTop: spacing[1] },
  eyebrow: { ...typography.labelSM, color: colors.text.secondary },
  title: { fontFamily: typography.displayBold, fontSize: 30, lineHeight: 34, letterSpacing: -1, color: colors.text.primary },
  stage: { flex: 1, minHeight: 0, overflow: 'visible' },
  mark: { position: 'absolute', top: 0 },
  panelWrap: { flexShrink: 1 },
  panelScroll: { flexGrow: 0, flexShrink: 1 },
  panel: { gap: spacing[4], paddingTop: spacing[2] },
  panelStack: { gap: spacing[4] },
  status: { ...typography.labelSM, color: colors.text.secondary, textAlign: 'center', paddingVertical: spacing[5] },
  caption: { alignItems: 'center', gap: spacing[2] },
  quote: { fontFamily: 'EBGaramond-Medium', fontSize: 22, lineHeight: 27, letterSpacing: -0.3, color: colors.text.primary, textAlign: 'center' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryDash: { width: 18, height: 5, borderRadius: 2 },
  categoryText: { fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 2.2 },
  principle: { ...typography.caption, color: colors.text.secondary, textAlign: 'center' },
  generationBody: { ...typography.bodyMD, color: colors.text.secondary, textAlign: 'center' },
  candidateRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] },
  candidate: { flex: 1, alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 16 },
  candidateSelected: { borderColor: colors.text.primary, backgroundColor: '#F6F0E4' },
  candidateLabel: { ...typography.labelMD, color: colors.text.primary },
  failure: { gap: spacing[2] },
  cta: { height: 56, borderRadius: 16 },
  link: { alignSelf: 'center', paddingVertical: spacing[1] },
  linkText: { ...typography.labelMD, color: colors.text.secondary, textDecorationLine: 'underline' },
});
