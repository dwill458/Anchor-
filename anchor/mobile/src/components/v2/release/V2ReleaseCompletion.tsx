import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2Button } from '@/components/v2';
import type { V2ReleaseEnding } from '@/adapters/v2/release';
import { colors, spacing } from '@/theme/v2';
import type { V2ReleaseActionId } from '@/constants/v2/release';
import { v2Haptics } from '@/hooks/v2';
import { releaseTypography } from './releaseTypography';
import { AnchorMark } from '@/components/v2/anchor/AnchorMark';
import type { AnchorExpression } from '@/constants/v2/creation';
import { Canvas, ColorMatrix, Image as SkiaImage, Skia, type SkImage } from '@shopify/react-native-skia';

interface Props {
  ending: V2ReleaseEnding;
  ghostSvg: string;
  ghostImageUrl?: string | null;
  category?: string | null;
  expression?: AnchorExpression;
  reduceMotion?: boolean;
  onAction: (action: V2ReleaseActionId) => void;
  testID?: string;
}

/** The result reveal takes 400ms (Reduced Motion: a short crossfade). */
const REVEAL_MS = 400;

// Preserve the finished artwork's luminance and alpha, tinting dark details toward ink and
// light details toward the page. Unlike Image.tintColor, this keeps opaque artwork legible.
const GHOST_IMAGE_TINT = [0, 1, 2].flatMap(channel => {
  const ink = parseInt(colors.ink.base.slice(1 + channel * 2, 3 + channel * 2), 16) / 255;
  const paper = parseInt(colors.frame.slice(1 + channel * 2, 3 + channel * 2), 16) / 255;
  return [0.2126 * (paper - ink), 0.7152 * (paper - ink), 0.0722 * (paper - ink), 0, ink];
}).concat([0, 0, 0, 1, 0]);

/** Each element owns its UI-thread reveal; Reduced Motion has no stagger or movement. */
function useCompletionReveal(delay: number, reduceMotion: boolean) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(reduceMotion ? 0 : delay, withTiming(1, {
      duration: reduceMotion ? 120 : 450,
      easing: reduceMotion ? Easing.linear : Easing.out(Easing.cubic),
    }));
    return () => cancelAnimation(progress);
  }, [delay, reduceMotion, progress]);
  return useAnimatedStyle(() => ({ opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * 8 }],
  }));
}

/** Mounted only after the server has confirmed release and the empty interval has ended. */
export function V2ReleaseCompletion({ ending, ghostSvg, ghostImageUrl, category, expression, reduceMotion = false, onAction, testID }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
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
  const paper = useSharedValue(0);
  // DEFERRED: The single words reveal is replaced by individual element reveals.
  const eyebrow = useCompletionReveal(450, reduceMotion);
  const headingStyle = useCompletionReveal(ending.title ? 550 : 450, reduceMotion);
  const quote = useCompletionReveal(800, reduceMotion);
  const body = useCompletionReveal(1000, reduceMotion);
  const successor = useCompletionReveal(1000, reduceMotion);
  const ctas = useCompletionReveal(1250, reduceMotion);
  const drawProgress = useSharedValue(reduceMotion ? 1 : 0);
  const ghostFade = useSharedValue(reduceMotion || (!showEnhancedImage && expression !== undefined) ? 1 : 0);
  const [actionsReady, setActionsReady] = useState(reduceMotion);
  const title = useRef<Text>(null);
  const notified = useRef(false);
  useEffect(() => {
    const duration = reduceMotion ? 120 : REVEAL_MS;
    paper.value = withTiming(1, { duration, easing: reduceMotion ? Easing.linear : Easing.out(Easing.cubic) });
    // Soft success haptic once, at settle; focus then moves to the heading.
    const timer = setTimeout(() => {
      if (!notified.current) { notified.current = true; v2Haptics.completion(); }
      const node = findNodeHandle(title.current);
      if (node) AccessibilityInfo.setAccessibilityFocus?.(node);
    }, reduceMotion ? 120 : 680);
    return () => { clearTimeout(timer); cancelAnimation(paper); };
  }, [reduceMotion, paper]);
  useEffect(() => {
    setActionsReady(reduceMotion);
    if (reduceMotion) return;
    const timer = setTimeout(() => setActionsReady(true), 1250);
    return () => clearTimeout(timer);
  }, [reduceMotion]);
  useEffect(() => {
    if (reduceMotion) {
      drawProgress.value = 1;
      ghostFade.value = 1;
    } else if (!showEnhancedImage && expression !== undefined) {
      ghostFade.value = 1;
      drawProgress.value = withDelay(250, withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) }));
    } else {
      ghostFade.value = 0;
      ghostFade.value = withDelay(250, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    }
    return () => { cancelAnimation(drawProgress); cancelAnimation(ghostFade); };
  }, [reduceMotion, expression, showEnhancedImage, drawProgress, ghostFade]);
  const ground = useAnimatedStyle(() => ({ opacity: paper.value }));
  const ghost = useAnimatedStyle(() => ({ opacity: 0.2 * ghostFade.value }));
  const heading = ending.title ?? ending.eyebrow;
  return <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]} testID={testID ?? 'v2-release-completion'}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.paper, ground]} />
    <View style={styles.bodyWrap}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: Math.max(24, height * 0.18 - insets.top) }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.ghost, ghost]} testID="v2-release-completion-ghost"
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
            drawProgress={!reduceMotion && expression !== undefined ? drawProgress : undefined} />}
        </Animated.View>
        {ending.title ? <Animated.Text style={[styles.kicker, eyebrow]} testID="v2-release-completion-eyebrow">{ending.eyebrow}</Animated.Text> : null}
        <Animated.Text ref={title} style={[styles.title, headingStyle]} accessibilityRole="header" testID="v2-release-completion-heading">{heading}</Animated.Text>
        <Animated.Text style={[styles.intention, quote]}>“{ending.intentionText}”</Animated.Text>
        <Animated.Text style={[styles.detail, body]} testID="v2-release-completion-body">{ending.body}</Animated.Text>
        {ending.successor ? (
          <Animated.View style={[styles.successor, successor]} testID="v2-release-completion-successor">
            <Text style={styles.intention}>“{ending.successor.intentionText}”</Text>
            <Text style={styles.note}>{ending.successor.note}</Text>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
    <Animated.View style={[styles.actions, ctas]} pointerEvents={actionsReady ? 'auto' : 'none'}
      accessibilityElementsHidden={!actionsReady} importantForAccessibility={actionsReady ? 'auto' : 'no-hide-descendants'}>
      <V2Button variant="primary" size="large" onPress={() => { if (actionsReady) onAction(ending.primary.id); }} testID="v2-release-completion-primary">{ending.primary.label}</V2Button>
      {ending.secondary ? <V2Button variant="tertiary" size="large" onPress={() => { if (actionsReady) onAction(ending.secondary!.id); }} testID="v2-release-completion-secondary">{ending.secondary.label}</V2Button> : null}
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingHorizontal: 24 },
  paper: { backgroundColor: colors.frame },
  bodyWrap: { flex: 1 },
  body: { alignItems: 'center', gap: spacing[3], paddingBottom: spacing[6] },
  ghost: { opacity: 0.2, marginBottom: spacing[2] },
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
