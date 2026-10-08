import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2Button } from '@/components/v2';
import type { V2ReleaseEnding } from '@/adapters/v2/release';
import { colors, spacing } from '@/theme/v2';
import {
  RELEASE_ENDING_DURATION_MS, RELEASE_ENDING_LEVEL, RELEASE_ENDING_REDUCED_MS, RELEASE_ENDING_SCENE_END_MS, RELEASE_ENDING_SETTLE_MS,
  RELEASE_ENDING_TIMELINE_MS as T, type V2ReleaseActionId,
} from '@/constants/v2/release';
import { useCelebrationReduceMotion } from '@/hooks/useCelebrationReduceMotion';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { playCreationSound } from '@/services/CreationSounds';
import { safeHaptics } from '@/utils/haptics';
import { releaseTypography } from './releaseTypography';
import { AnchorMark } from '@/components/v2/anchor/AnchorMark';
import { ReleaseFlagMark } from './ReleaseFlagMark';
import type { AnchorExpression } from '@/constants/v2/creation';
import { Canvas, Circle, ColorMatrix, Image as SkiaImage, Skia, type SkImage } from '@shopify/react-native-skia';

export interface ReleaseArtworkRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  ending: V2ReleaseEnding;
  ghostSvg: string;
  ghostImageUrl?: string | null;
  category?: string | null;
  expression?: AnchorExpression;
  reduceMotion?: boolean;
  /** Where the artwork was: the paper opens outward from its centre. Missing: the screen centre. */
  artworkRect?: ReleaseArtworkRect | null;
  /** Coordinator scene id for this ending. One ending per release. */
  celebrationId?: string;
  onAction: (action: V2ReleaseActionId) => void;
  testID?: string;
}

// Preserve the finished artwork's luminance and alpha, tinting dark details toward ink and
// light details toward the page. Unlike Image.tintColor, this keeps opaque artwork legible.
const GHOST_IMAGE_TINT = [0, 1, 2].flatMap(channel => {
  const ink = parseInt(colors.ink.base.slice(1 + channel * 2, 3 + channel * 2), 16) / 255;
  const paper = parseInt(colors.frame.slice(1 + channel * 2, 3 + channel * 2), 16) / 255;
  return [0.2126 * (paper - ink), 0.7152 * (paper - ink), 0.0722 * (paper - ink), 0, ink];
}).concat([0, 0, 0, 1, 0]);

/** Buttons rest at the disabled look until the paper settles. */
const ACTIONS_DISABLED_OPACITY = 0.35;

/** One element's reveal, started with the ending. Reduced Motion: a short crossfade, no stagger. */
function useReveal(delay: number, duration: number, reduce: boolean, started: boolean): SharedValue<number> {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!started) return undefined;
    progress.value = reduce
      ? withTiming(1, { duration: RELEASE_ENDING_REDUCED_MS, easing: Easing.linear })
      : withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(progress);
  }, [delay, duration, reduce, started, progress]);
  return progress;
}

function useRiseStyle(progress: SharedValue<number>, reduce: boolean) {
  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduce ? 0 : (1 - progress.value) * 8 }],
  }));
}

/**
 * Mounted only after the server has confirmed release and the empty interval has ended.
 * The ending is one Level 3 scene: it settles once (paper reveal end), and a tap before then skips
 * to the settled state. Sound and haptic fire exactly once, at the settle.
 */
export function V2ReleaseCompletion({ ending, ghostSvg, ghostImageUrl, category, expression, reduceMotion: reduceMotionProp = false,
  artworkRect, celebrationId = 'release-ending:release', onAction, testID }: Props) {
  // The single Reduce Motion source for celebration scenes. The prop can only add to it.
  const reduce = useCelebrationReduceMotion() || reduceMotionProp;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [enhancedImage, setEnhancedImage] = useState<SkImage | null>(null);
  useEffect(() => {
    let mounted = true;
    setEnhancedImage(null);
    if (ghostImageUrl) {
      // Catch fetch/decode failures as well as blank results: the stored SVG stays available.
      Skia.Data.fromURI(ghostImageUrl)
        .then(data => Skia.Image.MakeImageFromEncoded(data))
        .then(image => { if (mounted) setEnhancedImage(image); })
        .catch(() => { if (mounted) setEnhancedImage(null); });
    }
    return () => { mounted = false; };
  }, [ghostImageUrl]);
  const showEnhancedImage = Boolean(ghostImageUrl && enhancedImage);
  const isDestination = ending.reason === 'destination_completed';
  const skippable = useCelebrationStore((state) => Boolean(state.active && state.active.id === celebrationId && state.active.skippable));

  const [started, setStarted] = useState(false);
  const [settled, setSettled] = useState(false);
  const settledRef = useRef(false);
  const title = useRef<Text>(null);

  // The paper opens from the artwork centre; the reach is the farthest screen corner, so it covers all.
  const origin = artworkRect
    ? { x: artworkRect.x + artworkRect.width / 2, y: artworkRect.y + artworkRect.height / 2 }
    : { x: width / 2, y: height / 2 };
  const reach = Math.hypot(Math.max(origin.x, width - origin.x), Math.max(origin.y, height - origin.y)) + 2;
  const paper = useSharedValue(0);
  const revealRadius = useDerivedValue(() => paper.value * reach, [reach]);
  const ground = useAnimatedStyle(() => ({ opacity: paper.value }));

  const eyebrowReveal = useReveal(T.headingDelay, T.textDuration, reduce, started);
  const headingReveal = useReveal(T.headingDelay, T.textDuration, reduce, started);
  const intentionReveal = useReveal(T.intentionDelay, T.textDuration, reduce, started);
  const bodyReveal = useReveal(T.bodyDelay, T.textDuration, reduce, started);
  const successorReveal = useReveal(T.successorDelay, T.textDuration, reduce, started);
  const glyphReveal = useReveal(T.glyphDelay, T.glyphDuration, reduce, started);
  const eyebrowStyle = useRiseStyle(eyebrowReveal, reduce);
  const headingStyle = useRiseStyle(headingReveal, reduce);
  const intentionStyle = useRiseStyle(intentionReveal, reduce);
  const bodyStyle = useRiseStyle(bodyReveal, reduce);
  const successorStyle = useRiseStyle(successorReveal, reduce);
  const ghostStyle = useAnimatedStyle(() => ({ opacity: 0.2 * glyphReveal.value }));
  const flagStyle = useAnimatedStyle(() => ({ opacity: glyphReveal.value }));

  // The glyph draws itself only on the expression path; an enhanced image or a plain mark just fades in.
  const drawsGlyph = !showEnhancedImage && expression !== undefined;
  const drawProgress = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!started) return undefined;
    if (reduce) { drawProgress.value = 1; return undefined; }
    if (!drawsGlyph) return undefined;
    drawProgress.value = withDelay(T.glyphDelay, withTiming(1, { duration: T.glyphDuration, easing: Easing.inOut(Easing.cubic) }));
    return () => cancelAnimation(drawProgress);
  }, [started, reduce, drawsGlyph, drawProgress]);

  const actions = useSharedValue(0);
  const actionsStyle = useAnimatedStyle(() => ({ opacity: ACTIONS_DISABLED_OPACITY + (1 - ACTIONS_DISABLED_OPACITY) * actions.value }));

  // Once per ending, at the paper settle. A skip and the timer both reach here; only the first counts.
  const settle = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    setSettled(true);
    playCreationSound('releaseResolve');
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
  };
  const settleRef = useRef(settle);
  settleRef.current = settle;

  // Skip lands on the settled end state: everything at rest, then the same single settle.
  const jumpToSettled = () => {
    const values = [paper, glyphReveal, drawProgress, eyebrowReveal, headingReveal, intentionReveal, bodyReveal, successorReveal, actions];
    for (const value of values) { cancelAnimation(value); value.value = 1; }
    settleRef.current();
  };
  const skipRef = useRef(jumpToSettled);
  skipRef.current = jumpToSettled;

  // Register the ending with the coordinator. It may wait behind a higher scene (onStart starts it).
  useEffect(() => {
    if (settledRef.current) return undefined;
    const outcome = useCelebrationStore.getState().request(RELEASE_ENDING_LEVEL, celebrationId, {
      durationMs: reduce ? RELEASE_ENDING_REDUCED_MS : RELEASE_ENDING_DURATION_MS,
      onStart: () => setStarted(true),
      onSkip: () => skipRef.current(),
    });
    if (outcome === 'play') setStarted(true);
    return () => { useCelebrationStore.getState().finish(celebrationId); };
  }, [celebrationId, reduce]);

  useEffect(() => {
    if (!started) return undefined;
    paper.value = reduce
      ? withTiming(1, { duration: RELEASE_ENDING_REDUCED_MS, easing: Easing.linear })
      : withDelay(T.paperDelay, withTiming(1, { duration: T.paperDuration, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
    return () => cancelAnimation(paper);
  }, [started, reduce, paper]);

  // The paper settle: the timer is the only normal path to it. Reduce Motion settles at its crossfade's end.
  useEffect(() => {
    if (!started) return undefined;
    const timer = setTimeout(() => settleRef.current(), reduce ? RELEASE_ENDING_REDUCED_MS : RELEASE_ENDING_SETTLE_MS);
    // The scene stays active (and skippable) until the last text has revealed, not just until the settle.
    const sceneEnd = setTimeout(
      () => useCelebrationStore.getState().finish(celebrationId),
      reduce ? RELEASE_ENDING_REDUCED_MS : RELEASE_ENDING_SCENE_END_MS,
    );
    return () => { clearTimeout(timer); clearTimeout(sceneEnd); };
  }, [started, reduce, celebrationId]);

  useEffect(() => {
    if (!settled) return;
    if (actions.value < 1) actions.value = withTiming(1, { duration: reduce ? RELEASE_ENDING_REDUCED_MS : T.actionsFadeDuration });
    const node = findNodeHandle(title.current);
    if (node) AccessibilityInfo.setAccessibilityFocus?.(node);
  }, [settled, reduce, actions]);

  const heading = ending.title ?? ending.eyebrow;
  return <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]} testID={testID ?? 'v2-release-completion'}>
    {reduce ? (
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.paper, ground]} testID="v2-release-completion-paper" />
    ) : (
      <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="v2-release-completion-reveal">
        <Canvas style={StyleSheet.absoluteFill}>
          <Circle cx={origin.x} cy={origin.y} r={revealRadius} color={colors.frame} />
        </Canvas>
      </View>
    )}
    <View style={styles.bodyWrap}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: Math.max(24, height * 0.18 - insets.top) }]} showsVerticalScrollIndicator={false}>
        {isDestination ? (
          <Animated.View style={[styles.glyph, flagStyle]} testID="v2-release-completion-flag"
            accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <ReleaseFlagMark size={132} />
          </Animated.View>
        ) : (
          <Animated.View style={[styles.ghost, ghostStyle]} testID="v2-release-completion-ghost"
            accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {showEnhancedImage ? (
              <View style={styles.enhancedGhost} testID="v2-release-completion-enhanced-ghost">
                <Canvas style={styles.ghostCanvas}>
                  <SkiaImage image={enhancedImage} x={0} y={0} width={132} height={132} fit="cover">
                    <ColorMatrix matrix={GHOST_IMAGE_TINT} />
                  </SkiaImage>
                </Canvas>
              </View>
            ) : <AnchorMark svg={ghostSvg} category={category} expression={expression} size={132} strokeColor={colors.ink.base}
              drawProgress={!reduce && expression !== undefined ? drawProgress : undefined} />}
          </Animated.View>
        )}
        {ending.title ? <Animated.Text style={[styles.kicker, eyebrowStyle]} testID="v2-release-completion-eyebrow">{ending.eyebrow}</Animated.Text> : null}
        <Animated.Text ref={title} style={[styles.title, headingStyle]} accessibilityRole="header" testID="v2-release-completion-heading">{heading}</Animated.Text>
        <Animated.Text style={[styles.intention, intentionStyle]}>“{ending.intentionText}”</Animated.Text>
        <Animated.Text style={[styles.detail, bodyStyle]} testID="v2-release-completion-body">{ending.body}</Animated.Text>
        {ending.successor ? (
          <Animated.View style={[styles.successor, successorStyle]} testID="v2-release-completion-successor">
            <Text style={styles.intention}>“{ending.successor.intentionText}”</Text>
            <Text style={styles.note}>{ending.successor.note}</Text>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
    <Animated.View style={[styles.actions, actionsStyle]} pointerEvents={settled ? 'auto' : 'none'} testID="v2-release-completion-actions"
      accessibilityElementsHidden={!settled} importantForAccessibility={settled ? 'auto' : 'no-hide-descendants'}>
      <V2Button variant="primary" size="large" onPress={() => { if (settled) onAction(ending.primary.id); }} testID="v2-release-completion-primary">{ending.primary.label}</V2Button>
      {ending.secondary ? <V2Button variant="tertiary" size="large" onPress={() => { if (settled) onAction(ending.secondary!.id); }} testID="v2-release-completion-secondary">{ending.secondary.label}</V2Button> : null}
    </Animated.View>
    {/* Only while the ending is the active skippable scene: a tap lands it on its settled state. */}
    {skippable ? (
      <Pressable accessibilityRole="button" accessibilityLabel="Skip" testID="v2-release-completion-skip" style={StyleSheet.absoluteFill}
        onPress={() => { useCelebrationStore.getState().skip(); }} />
    ) : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingHorizontal: 24 },
  paper: { backgroundColor: colors.frame },
  bodyWrap: { flex: 1 },
  body: { alignItems: 'center', gap: spacing[3], paddingBottom: spacing[6] },
  ghost: { marginBottom: spacing[2] },
  glyph: { width: 132, height: 132, marginBottom: spacing[2] },
  enhancedGhost: { width: 132, height: 132, borderRadius: 66, overflow: 'hidden' },
  ghostCanvas: { width: 132, height: 132 },
  kicker: { ...releaseTypography.kicker, color: colors.text.secondary, textAlign: 'center' },
  title: { ...releaseTypography.serifDisplay, color: colors.ink.base, textAlign: 'center' },
  detail: { ...releaseTypography.small, color: colors.text.secondary, textAlign: 'center', maxWidth: 240 },
  intention: { ...releaseTypography.serifQuote, color: colors.ink.base, textAlign: 'center', maxWidth: 286 },
  successor: { gap: spacing[1], alignItems: 'center' },
  note: { ...releaseTypography.small, color: colors.text.secondary, textAlign: 'center', maxWidth: 240 },
  actions: { gap: spacing[2] },
});
