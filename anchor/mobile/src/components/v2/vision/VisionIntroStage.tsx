// DEFERRED: replaced by ceremony Ask beat.
import { useEffect } from 'react';
import { StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useV2ReduceMotion } from '@/hooks/v2';
import { AnchorMotion, colors, spacing } from '@/theme/v2';
import { VisionBackButton, VisionInkPill, VISION_GOLD, VISION_SERIF, VISION_SERIF_ITALIC } from './VisionPaperChrome';
import { Reveal, VISION_STAGGER_MS, useVisionEntrance } from './VisionMotion';
import { VisionTornEdge, TORN_EDGE_RATIO } from './VisionTornEdge';
import { visionIntroArt } from './visionIntroArt';

/** Share of the screen given to the photograph (the mockup's tear sits a little past the middle); the rest is the paper interface. */
export const VISION_INTRO_IMAGE_SHARE = 0.57;
/** The photograph is taller than its window by this factor so the camera can travel through it. */
const OVERSCAN = 1.22;
const PAN_MS = 22000;
/** The paper's content waits this long so the photograph's light is already coming up as it rises. */
const PAPER_BASE_MS = 200;

type Props = {
  anchorIntention: string;
  anchorCategory?: string | null;
  onBack: () => void;
  onStartCreate: () => void;
  testID: string;
};

/**
 * Screen 1: sells the idea before asking for work. A slow, restrained camera
 * move through a photograph chosen for the Anchor's category, a torn paper
 * edge, then the intention in the person's own words and one action.
 *
 * Arrival, in reading order: the photograph's light comes up (and settles from
 * a hair too large), then the paper's content rises one line at a time, and
 * last the gold stroke is drawn under the person's own words.
 */
export function VisionIntroStage({ anchorIntention, anchorCategory, onBack, onStartCreate, testID }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();
  const photoHeight = Math.round(height * VISION_INTRO_IMAGE_SHARE);
  const imageHeight = Math.round(photoHeight * OVERSCAN);
  const travel = imageHeight - photoHeight;
  const edgeHeight = width * TORN_EDGE_RATIO;

  const camera = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) { camera.value = 0.35; return; }
    camera.value = 0;
    camera.value = withRepeat(withTiming(1, { duration: PAN_MS, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(camera);
  }, [camera, reduceMotion]);
  const cameraStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -travel * camera.value }, { scale: 1 + camera.value * 0.04 }],
  }));

  const hero = useVisionEntrance(0, AnchorMotion.duration.expressive * 2, AnchorMotion.easing.emphasized);
  const heroStyle = useAnimatedStyle(() => ({
    opacity: hero.value,
    transform: [{ scale: reduceMotion ? 1 : 1.05 - hero.value * 0.05 }],
  }));
  // The stroke is drawn once the intention has landed above it.
  const stroke = useVisionEntrance(PAPER_BASE_MS + 3 * VISION_STAGGER_MS + AnchorMotion.duration.standard - 40, AnchorMotion.duration.expressive);
  const strokeStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: stroke.value }] }));

  return (
    <View testID={`${testID}-empty`} style={styles.stage}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.photoWindow, { height: photoHeight }]}>
        <Animated.View style={heroStyle}>
          <Animated.Image
            testID={`${testID}-intro-photo`}
            accessibilityIgnoresInvertColors
            accessible={false}
            source={visionIntroArt(anchorCategory)}
            resizeMode="cover"
            fadeDuration={0}
            style={[{ width, height: imageHeight }, cameraStyle]}
          />
        </Animated.View>
        <LinearGradient pointerEvents="none" colors={['rgba(14,21,28,0.55)', 'rgba(14,21,28,0)']} style={[styles.topScrim, { height: insets.top + 90 }]} />
      </View>
      <View style={[styles.edge, { top: photoHeight - edgeHeight / 2 }]} pointerEvents="none">
        <VisionTornEdge width={width} testID={`${testID}-edge`} />
      </View>
      <VisionBackButton onPress={onBack} style={{ position: 'absolute', left: spacing[4], top: insets.top + spacing[2] }} />

      <View style={[styles.paper, { top: photoHeight + edgeHeight / 2 - 1, paddingBottom: insets.bottom + spacing[4] }]}>
        <Reveal base={PAPER_BASE_MS} order={0}>
          <View style={styles.kickerRow}>
            <View style={styles.flank} />
            <Text style={styles.kicker}>VISION</Text>
            <View style={styles.flank} />
          </View>
        </Reveal>
        <Reveal base={PAPER_BASE_MS} order={1}>
          <Text accessibilityRole="header" style={styles.title}>See where this is going.</Text>
        </Reveal>
        <Reveal base={PAPER_BASE_MS} order={2}>
          <Text style={styles.subtitle}>Turn your intention into something you can see.</Text>
        </Reveal>
        <Reveal base={PAPER_BASE_MS} order={3} style={styles.stretch}>
          <View style={styles.note} accessible accessibilityLabel={`Your intention: ${anchorIntention}`}>
            <Text style={styles.noteText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{anchorIntention}</Text>
            <Animated.View style={[styles.noteStroke, strokeStyle]} />
          </View>
        </Reveal>
        <Reveal base={PAPER_BASE_MS} order={4} style={styles.stretch}>
          <VisionInkPill testID="vision-create" accessibilityLabel="Create my Vision" label="Create my Vision" onPress={onStartCreate} style={styles.cta} />
        </Reveal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: colors.canvas, overflow: 'hidden' },
  photoWindow: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden', backgroundColor: colors.ink.deep },
  topScrim: { position: 'absolute', left: 0, right: 0, top: 0 },
  edge: { position: 'absolute', left: 0, right: 0 },
  paper: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing[5], alignItems: 'center', justifyContent: 'space-evenly', backgroundColor: colors.canvas },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flank: { width: 28, height: StyleSheet.hairlineWidth * 2, backgroundColor: VISION_GOLD, opacity: 0.7 },
  kicker: { fontFamily: 'Inter-SemiBold', fontSize: 13, letterSpacing: 2.6, color: VISION_GOLD },
  title: { fontFamily: VISION_SERIF, fontSize: 36, lineHeight: 40, letterSpacing: -0.6, textAlign: 'center', color: colors.text.primary },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 21, textAlign: 'center', color: colors.text.secondary, maxWidth: 300 },
  note: {
    alignSelf: 'stretch', paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: 3,
    backgroundColor: colors.grouped, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default,
  },
  noteText: { fontFamily: VISION_SERIF_ITALIC, fontSize: 22, lineHeight: 28, alignSelf: 'stretch', textAlign: 'center', color: colors.text.primary },
  noteStroke: { marginTop: 4, width: '62%', height: 2, borderRadius: 1, backgroundColor: VISION_GOLD, opacity: 0.7 },
  cta: { alignSelf: 'stretch' },
  stretch: { alignSelf: 'stretch' },
});
