import type { ViewInstance } from 'react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View, type TextInstance } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { V2Button, V2Screen } from '@/components/v2';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { circularAnchorArtworkShare } from '@/components/v2/anchor/CircularAnchorRenderer';
import { resolveEvolutionStage } from '@/adapters/v2/progress/progressAdapter';
import { AnchorMotion, getCategoryPalette, colors, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import { useCelebrationReduceMotion } from '@/hooks/useCelebrationReduceMotion';
import {
  practiceSceneValues,
  usePracticeCompletionScene,
  type PracticeSceneKind,
} from '@/hooks/v2/practice/usePracticeCompletionScene';
import type { ArrivalRect } from '@/stores/v2/homeArrivalStore';
import type { FocusSaveWaitResult } from './focusSaveWait';
import { offerPracticeDeparture, type PracticeDepartureMeasure } from '@/stores/v2/practiceDeparture';
import { V2FocusAnchorArtwork } from './V2FocusAnchorArtwork';
import { useMilestonePresentationHold } from '@/hooks/v2/milestones/useMilestonePresentationHold';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { queueMilestoneAction } from '@/milestones/queueMilestoneAction';
import { discoverGuidance } from '@/hooks/v2/guidance/guidanceRuntime';
import { useAuthStore } from '@/stores/authStore';
import { useTeachingFocus } from '@/hooks/v2/teaching/useTeachingFocus';

import { ThreadGlowLesson, threadGlowVariant } from '@/components/v2/thread/ThreadGlowLesson';

// COPY: from the celebration brief
const COPY = {
  stageReached: (stage: string) => `Your Anchor is now ${stage}.`,
  fullStrength: 'Full Strength.',
  fullStrengthSubline: 'Your Anchor is fully reinforced.',
  backAtFullStrength: 'Back at full strength.',
  skip: 'Skip',
} as const;

/** Gold of the stage segment and the Full Strength ring. Same gold as the Anchor detail palette. */
const CELEBRATION_GOLD = '#C9A24B';
/** The five stage segments, in the progress adapter's own names (Unestablished is not drawn). */
const STAGE_STRIP: readonly string[] = ['Forming', 'Building', 'Established', 'Integrated', 'Reinforced'];
/** The Full Strength ring sits this far outside the artwork. */
const RING_INSET = 8;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Complete to Home: after Continue, the header, label, bar, notes and buttons fade out over this long (linear). */
const LEAVE_CHROME_MS = 300;
/** ...and the struck old value (with its arrow) over this long. The new value stays, then fades in place on Home. */
const LEAVE_OLD_VALUE_MS = 200;
/** The glow behind the artwork is this share of the artwork's circle (styles.artworkAtmosphere). */
const ATMOSPHERE_SHARE = 0.84;
/** A finished image fills the same share of Home's paper disc as the mark does on this screen's disc. */
const IMAGE_MARK_SHARE = 0.72;
/** Longest a measurement may take before the screen leaves without it. */
const MEASURE_TIMEOUT_MS = 200;

/** A node's window rect, or null when it cannot be measured (no node, no method, no answer in time). */
function measureWindow(node: unknown): Promise<ArrivalRect | null> {
  const target = node as { measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void } | null;
  return new Promise((resolve) => {
    if (!target || typeof target.measureInWindow !== 'function') {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), MEASURE_TIMEOUT_MS);
    target.measureInWindow((x, y, width, height) => {
      clearTimeout(timer);
      resolve([x, y, width, height].every(Number.isFinite) && width > 0 ? { x, y, width, height } : null);
    });
  });
}

const isStageScene = (kind: PracticeSceneKind) =>
  kind === 'stageFirst' || kind === 'stageReinforced' || kind === 'stageRelight';

/**
 * The closing line for a scene, or null when the scene has none. Stage names come from the progress
 * adapter's resolver, never typed here. A stage relight is silent: the segment relights, no sentence.
 */
function sceneNoteText(kind: PracticeSceneKind, value: number): string | null {
  const stage = resolveEvolutionStage(value);
  switch (kind) {
    case 'first':
      return 'Your Thread has begun.';
    case 'stageFirst':
    case 'stageReinforced':
      return COPY.stageReached(stage);
    case 'stageRelight':
      return null;
    case 'fullFirst':
      return COPY.fullStrength;
    case 'fullRepeat':
      return COPY.backAtFullStrength;
    default:
      return 'Reinforced today ✓';
  }
}

export interface V2FocusCompleteScreenProps {
  anchor: Anchor;
  durationSeconds: number;
  beforeStrength?: number | null;
  afterStrength?: number | null;
  sessionSaved?: boolean;
  /** True only for a canonical session movement; Anchor snapshots are insufficient for teaching. */
  strengthResultVerified?: boolean;
  sessionSaveState?: 'saving' | FocusSaveWaitResult;
  onRetrySave?: () => void;
  /** Stable id of the completed session. Keys the completion scene and the Thread settle cue to one play per session. */
  sessionId?: string | null;
  /** Shared completion presentation; Focus keeps its original copy by default. */
  practiceTitle?: 'Deep Focus' | 'Visualize';
  /** What the session ended on: the ink field (Focus, Deep Focus) or the cream board (Visualize). */
  enterFrom?: 'ink' | 'cream';
  onDone: () => void;
  onAgain: () => void;
}

/** The entrance of the Anchor and the field. Shared by every practice completion. */
const ENTRANCE_MS = 500;

export function V2FocusCompleteScreen({
  anchor,
  beforeStrength: propBefore,
  afterStrength: propAfter,
  sessionSaved = true,
  strengthResultVerified = false,
  sessionSaveState = sessionSaved ? 'saved' : 'failed',
  onRetrySave,
  sessionId = null,
  practiceTitle,
  enterFrom = 'ink',
  onDone,
  onAgain,
}: V2FocusCompleteScreenProps) {
  const { height } = useWindowDimensions();
  const reduceMotion = useCelebrationReduceMotion();
  const [milestoneReady, setMilestoneReady] = useState(false);
  const guidanceAccount = useAuthStore(state => state.user?.id ?? 'guest');
  useEffect(() => { if (sessionSaved && sessionId) discoverGuidance(guidanceAccount, 'today.recommended'); }, [guidanceAccount, sessionId, sessionSaved]);
  const completionAccount = useRef(guidanceAccount);
  const [completionExited, setCompletionExited] = useState(false);
  const milestoneFocus = useTeachingFocus();
  useEffect(() => {
    if (!milestoneFocus.isFocused) setCompletionExited(true);
  }, [milestoneFocus.isFocused]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') setCompletionExited(true);
    });
    return () => subscription.remove();
  }, []);
  const milestoneFocused = useRef(milestoneFocus.isFocused);
  const milestoneReturn = useRef<() => void>(() => undefined);
  milestoneFocused.current = milestoneFocus.isFocused;
  useMilestonePresentationHold(milestoneFocus.isFocused && (!milestoneReady || !sessionSaved));
  useEffect(() => {
    const timer = setTimeout(() => setMilestoneReady(true), reduceMotion ? 160 : 2500);
    return () => clearTimeout(timer);
  }, [reduceMotion]);
  useEffect(() => {
    if (!milestoneReady || !sessionSaved || !sessionId || !milestoneFocus.isFocused) return;
    let active = true;
    void queueMilestoneAction(anchor.id, { kind: 'practice', sourceEntityId: sessionId }, () => active && milestoneFocused.current, () => milestoneReturn.current());
    return () => { active = false; };
  }, [anchor.id, milestoneReady, sessionId, sessionSaved, milestoneFocus.isFocused]);
  const categoryPalette = getCategoryPalette(anchor.category);
  const artworkSize = Math.round(Math.min(188, Math.max(148, height * 0.22)));
  // V2Screen already applies the bottom safe-area inset.
  const footerBottomPadding = Math.round(Math.min(20, Math.max(12, height * 0.018)));

  // Authoritative thread strength resolution:
  const hasAuthoritativeMovement =
    typeof propBefore === 'number' && Number.isFinite(propBefore) && typeof propAfter === 'number' && Number.isFinite(propAfter);
  const baselineStored = typeof anchor.threadStrength === 'number';

  const isUnmeasured = !hasAuthoritativeMovement && !baselineStored;

  const fromVal = hasAuthoritativeMovement
    ? Math.max(0, Math.min(100, propBefore!))
    : baselineStored
    ? Math.max(0, Math.min(100, anchor.threadStrength!))
    : 0;

  const toVal = hasAuthoritativeMovement
    ? Math.max(0, Math.min(100, propAfter!))
    : fromVal;

  const delta = hasAuthoritativeMovement ? Math.round((toVal - fromVal) * 100) / 100 : 0;

  // The Thread scene (first practice, repeat practice, or nothing) is decided and played by the shared hook.
  const scene = usePracticeCompletionScene({
    sessionId,
    anchorId: anchor.id,
    fromValue: fromVal,
    toValue: toVal,
    eligible: sessionSaved && hasAuthoritativeMovement,
    reduceMotion,
  });
  const glowVariant = threadGlowVariant({ sessionId, saved: sessionSaved && strengthResultVerified && scene.educationReady, before: propBefore, after: propAfter, kind: scene.kind, phase: scene.phase });
  const fromStruck = scene.kind === 'repeat' && scene.phase !== 'idle';
  const noteText = sceneNoteText(scene.kind, toVal);

  // Presentation only: the authoritative Thread values above are already
  // resolved before this screen mounts. The Anchor is visible on the first cream
  // frame. This avoids a blank beat between the resolving session field and the
  // same Anchor on completion.
  const contentOpacity = useSharedValue(reduceMotion ? 1 : 0.34);
  const inkOverlayOpacity = useSharedValue(reduceMotion || enterFrom === 'cream' ? 0 : 1);
  const artworkScale = useSharedValue(reduceMotion ? 1 : 0.94);
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const inkOverlayStyle = useAnimatedStyle(() => ({ opacity: inkOverlayOpacity.value }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: scene.barProgress.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: scene.glowOpacity.value }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: scene.labelOpacity.value }));
  const valueStyle = useAnimatedStyle(() => ({ opacity: scene.valueOpacity.value }));
  const noteStyle = useAnimatedStyle(() => ({ opacity: scene.noteOpacity.value }));
  const stripStyle = useAnimatedStyle(() => ({
    opacity: scene.stripOpacity.value,
    transform: [{ translateY: (1 - scene.stripOpacity.value) * 8 }],
  }));
  const segmentStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: scene.segmentFill.value }] }));
  const sublineStyle = useAnimatedStyle(() => ({ opacity: scene.sublineOpacity.value }));
  const ringSize = artworkSize + RING_INSET * 2;
  const ringRadius = ringSize / 2 - 1;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: ringCircumference * (1 - scene.ringDraw.value),
  }));
  const stageIndex = Math.max(0, STAGE_STRIP.indexOf(resolveEvolutionStage(toVal)));
  const artworkStyle = useAnimatedStyle(() => ({ transform: [{ scale: artworkScale.value }] }));

  // Complete to Home. Continue fades everything but the artwork, its glow and the new value (linear,
  // the old value first); the route then carries the same artwork and glow to Home's hero. Only the
  // Anchor and the new figure are measured; no sound and no haptic belong to this beat.
  const [leaving, setLeaving] = useState(false);
  const chromeOut = useSharedValue(1);
  const oldValueOut = useSharedValue(1);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chromeOut.value }));
  const oldValueStyle = useAnimatedStyle(() => ({ opacity: oldValueOut.value }));
  const artworkRef = useRef<ViewInstance>(null);
  const originAlive = useRef(true);
  const recordMilestoneOrigin = useCallback(() => {
    if (!sessionId || !sessionSaved) return;
    void measureWindow(artworkRef.current).then(rect => {
      if (rect && originAlive.current) useMilestoneCelebrationStore.getState().setOrigin({ sessionId, anchorId: anchor.id, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    });
  }, [anchor.id, sessionId, sessionSaved]);
  useEffect(() => {
    originAlive.current = true;
    return () => {
      originAlive.current = false;
      const store = useMilestoneCelebrationStore.getState();
      if (store.origin?.sessionId === sessionId) store.setOrigin(null);
    };
  }, [sessionId]);
  const valueRef = useRef<TextInstance>(null);
  const showsNewValue = hasAuthoritativeMovement && delta !== 0;

  const measureDeparture = useCallback(async (): Promise<PracticeDepartureMeasure | null> => {
    const circle = await measureWindow(artworkRef.current);
    if (!circle) return null;
    // The mark's own square, not its circle: what Home's overlay flies and scales.
    const share = anchor.enhancedImageUrl ? IMAGE_MARK_SHARE : circularAnchorArtworkShare('dark', circle.width, false);
    const side = circle.width * share;
    const fromRect: ArrivalRect = {
      x: circle.x + (circle.width - side) / 2,
      y: circle.y + (circle.height - side) / 2,
      width: side,
      height: side,
    };
    const valueRect = showsNewValue ? await measureWindow(valueRef.current) : null;
    let glowOpacity = practiceSceneValues(scene.kind, fromVal, toVal, 'final').glow;
    try {
      const live = scene.glowOpacity.value;
      if (Number.isFinite(live)) glowOpacity = live;
    } catch {
      // The settled glow stands in.
    }
    return {
      fromRect,
      number: valueRect ? { text: `${toVal}%`, rect: valueRect } : null,
      glow: { color: categoryPalette.soft, opacity: glowOpacity, scale: (circle.width * ATMOSPHERE_SHARE) / side },
    };
  }, [anchor.enhancedImageUrl, categoryPalette.soft, fromVal, scene.glowOpacity, scene.kind, showsNewValue, toVal]);

  const handleContinue = useCallback(() => {
    setCompletionExited(true);
    if (sessionSaved) {
      if (!reduceMotion) {
        // The app decides Reduce Motion; the OS animator scale must not collapse the fade into a jump.
        chromeOut.value = withTiming(0, { duration: LEAVE_CHROME_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
        oldValueOut.value = withTiming(0, { duration: LEAVE_OLD_VALUE_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
        setLeaving(true);
      }
      offerPracticeDeparture({ sessionId, at: Date.now(), measure: () => measureDeparture().catch(() => null) });
    }
    onDone();
  }, [chromeOut, measureDeparture, oldValueOut, onDone, reduceMotion, sessionId, sessionSaved]);
  milestoneReturn.current = handleContinue;

  useEffect(() => {
    if (reduceMotion) {
      contentOpacity.value = 1;
      inkOverlayOpacity.value = 0;
      artworkScale.value = 1;
      return;
    }

    contentOpacity.value = withTiming(1, {
      duration: ENTRANCE_MS,
      easing: AnchorMotion.easing.enter,
    });
    inkOverlayOpacity.value = withTiming(0, { duration: ENTRANCE_MS, easing: AnchorMotion.easing.enter });
    artworkScale.value = withTiming(1, { duration: ENTRANCE_MS, easing: AnchorMotion.easing.enter });
  }, [artworkScale, contentOpacity, inkOverlayOpacity, reduceMotion]);

  return (
    <V2Screen testID="v2-focus-complete-screen" style={styles.screen}>
      <StatusBar barStyle="dark-content" animated />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.resultContent, contentStyle]}>
        <Animated.View
          ref={artworkRef}
          onLayout={recordMilestoneOrigin}
          collapsable={false}
          style={[styles.artworkContainer, { width: artworkSize, height: artworkSize }, artworkStyle]}
        >
          <Animated.View style={[styles.artworkAtmosphere, { backgroundColor: categoryPalette.soft }, glowStyle]} />
          <V2FocusAnchorArtwork
            svg={anchorArtworkSvg(anchor)} imageUrl={anchor.enhancedImageUrl}
            category={anchor.category}
            size={artworkSize}
            surface={colors.background}
            accessibilityLabel={`${anchor.category} Anchor artwork`}
            testID="focus-complete-anchor-artwork"
            threadStrength={toVal}
            anchorId={anchor.id}
            strengthProgress={scene.barProgress}
            strengthBloom={scene.glowScale}
          />
          {scene.kind === 'fullFirst' ? (
            <Svg
              testID="focus-complete-full-strength-ring"
              width={ringSize}
              height={ringSize}
              style={{ position: 'absolute', top: -RING_INSET, left: -RING_INSET }}
            >
              <AnimatedCircle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                fill="none"
                stroke={CELEBRATION_GOLD}
                strokeWidth={2}
                strokeDasharray={[ringCircumference, ringCircumference]}
                rotation={-90}
                origin={`${ringSize / 2}, ${ringSize / 2}`}
                animatedProps={ringProps}
              />
            </Svg>
          ) : null}
        </Animated.View>

        <Animated.View testID="focus-complete-heading" style={[styles.headingBlock, chromeStyle]}>
          <Text style={styles.headline}>{practiceTitle ?? 'Focus'} complete</Text>
        </Animated.View>

        {sessionSaved ? <>
        {/* Authoritative Consistency (Thread Strength) feedback */}
        <View testID="focus-complete-thread-bar" style={styles.threadBlock}>
          {isUnmeasured ? (
            <View style={styles.unmeasuredContainer}>
              <View style={styles.threadHeader}>
                <Text style={styles.threadTitle}>THREAD STRENGTH</Text>
              </View>
              <Text style={styles.unmeasuredHint}>Session recorded. Strength will appear as data builds.</Text>
            </View>
          ) : hasAuthoritativeMovement ? (
            <View style={styles.measuredCard}>
              <Animated.View style={[styles.threadHeader, chromeStyle]}>
                <View style={styles.deltaGroup}>
                  <Animated.Text style={[styles.threadTitle, labelStyle]}>THREAD STRENGTH</Animated.Text>
                  {delta !== 0 ? (
                    <Animated.Text
                      testID="focus-thread-delta"
                      style={[
                        styles.threadDelta,
                        { color: categoryPalette.deep },
                        valueStyle,
                      ]}
                    >
                      {delta > 0 ? '+' : ''}{delta}
                    </Animated.Text>
                  ) : null}
                </View>
              </Animated.View>

              {delta !== 0 ? (
                <View style={styles.valuesRow}>
                  <Animated.Text style={[
                    styles.strengthValue,
                    { color: colors.text.secondary },
                    fromStruck ? styles.struck : null,
                    oldValueStyle,
                  ]}
                  >
                    {fromVal}%
                  </Animated.Text>
                  <Animated.View style={[styles.valuesRowTo, valueStyle]}>
                    <Animated.Text style={[styles.arrow, oldValueStyle]}>→</Animated.Text>
                    <Text
                      ref={valueRef}
                      testID="focus-complete-new-value"
                      style={[styles.strengthValue, { color: colors.text.primary }]}
                    >
                      {toVal}%
                    </Text>
                  </Animated.View>
                </View>
              ) : (
                <Animated.Text style={[styles.currentStrengthLabel, chromeStyle]}>{toVal}%</Animated.Text>
              )}

              <Animated.View style={[styles.progressBarTrack, chromeStyle]}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: categoryPalette.deep,
                    },
                    barStyle,
                  ]}
                />
              </Animated.View>
            </View>
          ) : (
            <View style={styles.measuredCard}>
              <Animated.View style={[styles.threadHeader, chromeStyle]}>
                <Text style={styles.threadTitle}>THREAD STRENGTH</Text>
                <Text style={styles.currentStrengthLabel}>{toVal}%</Text>
              </Animated.View>
              <Animated.View style={[styles.progressBarTrack, chromeStyle]}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: categoryPalette.deep,
                    },
                    barStyle,
                  ]}
                />
              </Animated.View>
            </View>
          )}
        </View>

        {isStageScene(scene.kind) ? (
          <Animated.View testID="focus-complete-stage-strip" style={[styles.stageStrip, stripStyle, chromeStyle]}>
            <View style={styles.stageSegments}>
              {STAGE_STRIP.map((name, index) => (
                <View key={name} style={styles.stageSegmentTrack}>
                  {index < stageIndex ? (
                    <View style={[styles.stageSegmentFill, { backgroundColor: categoryPalette.deep }]} />
                  ) : null}
                  {index === stageIndex ? (
                    <Animated.View style={[styles.stageSegmentFill, { backgroundColor: CELEBRATION_GOLD }, segmentStyle]} />
                  ) : null}
                </View>
              ))}
            </View>
            <View style={styles.stageLabels}>
              {STAGE_STRIP.map((name) => (
                <Text key={name} numberOfLines={1} style={styles.stageLabel}>{name}</Text>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {noteText ? (
          <Animated.Text
            testID={scene.kind === 'first' ? 'focus-complete-first-line' : undefined}
            style={[scene.kind === 'fullFirst' ? styles.fullStrengthTitle : styles.reinforcedToday, noteStyle, chromeStyle]}
          >
            {noteText}
          </Animated.Text>
        ) : null}
        {scene.kind === 'fullFirst' ? (
          <Animated.Text testID="focus-complete-full-strength-subline" style={[styles.sublineText, sublineStyle, chromeStyle]}>
            {COPY.fullStrengthSubline}
          </Animated.Text>
        ) : null}
        {glowVariant && sessionId ? <ThreadGlowLesson account={guidanceAccount} anchorId={anchor.id} sessionId={sessionId}
          variant={glowVariant} strength={toVal} active={!completionExited && !leaving && milestoneFocus.isFocused && !milestoneFocus.transitioning && completionAccount.current === guidanceAccount} /> : null}
        </> : (
          <View style={styles.unmeasuredContainer}>
            <Text style={styles.unmeasuredHint}>
              {sessionSaveState === 'unknown'
                ? 'Saving is taking longer than expected. The outcome is still being confirmed. Thread Strength will appear after the save is confirmed.'
                : sessionSaveState === 'saving'
                  ? 'Your session is still being saved. Thread Strength will appear after the save is confirmed.'
                  : 'This session could not be saved. Thread Strength was not updated.'}
            </Text>
            {onRetrySave && sessionSaveState !== 'saved' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={sessionSaveState === 'failed' ? 'Retry saving session' : 'Check session save status'}
                accessibilityState={{ disabled: sessionSaveState === 'saving', busy: sessionSaveState === 'saving' }}
                disabled={sessionSaveState === 'saving'}
                testID="focus-complete-retry-save"
                onPress={onRetrySave}
                style={styles.retrySave}
              >
                <Text style={styles.againText}>
                  {sessionSaveState === 'failed' ? 'Retry saving' : 'Check save status'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </Animated.View>
      </ScrollView>
      {/* Only while the Thread scene is the active skippable one. Sits under the footer, so Continue and the link stay usable. */}
      {scene.canSkip ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={COPY.skip}
          testID="focus-complete-skip"
          onPress={scene.skip}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {/* Action buttons */}
      <Animated.View
        testID="focus-complete-footer"
        pointerEvents={leaving ? 'none' : 'auto'}
        style={[
          styles.footer,
          { paddingBottom: footerBottomPadding },
          chromeStyle,
        ]}
      >
        <V2Button
          size="large"
          onPress={handleContinue}
          accessibilityLabel="Continue"
          testID="focus-complete-done-button"
          style={styles.doneButton}
        >
          Continue
        </V2Button>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${practiceTitle ?? 'Focus'} again`}
          testID="focus-complete-again-button"
          onPress={() => { setCompletionExited(true); onAgain(); }}
          style={styles.againLink}
        >
          <Text style={styles.againText}>{practiceTitle ?? 'Focus'} again</Text>
        </Pressable>
      </Animated.View>
      <Animated.View testID="v2-focus-complete-ink" pointerEvents="none" style={[styles.inkOverlay, inkOverlayStyle]} />
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inkOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0B0F18',
  },
  scroll: { flex: 1 },
  resultContent: { alignSelf: 'stretch', alignItems: 'center' },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  artworkContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  artworkAtmosphere: {
    position: 'absolute',
    width: '84%',
    height: '84%',
    borderRadius: 999,
  },
  headingBlock: {
    alignItems: 'center',
    marginBottom: spacing[5],
    gap: 6,
  },
  headline: {
    ...typography.headingXL,
    fontFamily: typography.display,
    fontSize: 26,
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  threadBlock: {
    width: '100%',
    maxWidth: 296,
  },
  unmeasuredContainer: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
    gap: spacing[2],
  },
  formingTitle: {
    ...typography.labelMD,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    color: colors.text.primary,
    letterSpacing: 0.8,
  },
  unmeasuredHint: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  retrySave: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing[3] },
  measuredCard: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
    gap: spacing[2],
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deltaGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  threadTitle: {
    ...typography.labelSM,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    color: colors.text.secondary,
    letterSpacing: 0.6,
  },
  threadDelta: {
    ...typography.labelLG,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  currentStrengthLabel: {
    ...typography.labelMD,
    fontFamily: typography.bodyBold,
    color: colors.text.primary,
  },
  valuesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
    marginTop: 4,
  },
  valuesRowTo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
  },
  strengthValue: {
    ...typography.headingMD,
    fontFamily: typography.display,
    fontSize: 18,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  arrow: {
    ...typography.bodyMD,
    fontSize: 14,
    color: colors.text.secondary,
  },
  progressBarTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.border.strong,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressBarFill: {
    width: '100%',
    height: '100%',
    borderRadius: 1,
    transformOrigin: 'left center',
  },
  reinforcedToday: {
    ...typography.labelMD,
    color: colors.text.primary,
    marginTop: spacing[3],
    textAlign: 'center',
  },
  stageStrip: {
    width: '100%',
    maxWidth: 296,
    marginTop: spacing[3],
    gap: 6,
  },
  stageSegments: {
    flexDirection: 'row',
    gap: 4,
  },
  stageSegmentTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.border.strong,
    overflow: 'hidden',
  },
  stageSegmentFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 1.5,
    transformOrigin: 'left center',
  },
  stageLabels: {
    flexDirection: 'row',
    gap: 4,
  },
  stageLabel: {
    flex: 1,
    ...typography.labelSM,
    fontSize: 9.5,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  fullStrengthTitle: {
    ...typography.labelMD,
    fontFamily: typography.bodyBold,
    fontSize: 17,
    color: colors.text.primary,
    marginTop: spacing[3],
    textAlign: 'center',
  },
  sublineText: {
    ...typography.bodyMD,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing[6],
    gap: 0,
  },
  doneButton: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radii.round,
  },
  againLink: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  againText: {
    ...typography.bodyMD,
    fontFamily: typography.bodySemiBold,
    fontSize: 14.5,
    color: colors.text.secondary,
  },
});
