// DEFERRED: replaced by ceremony Ask beat.
import { ScrollView, StatusBar, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ImageStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Image as ImageIcon, Infinity as InfinityIcon, Sparkles } from 'lucide-react-native';
import { v2Haptics } from '@/hooks/v2';
import { AnchorMotion, colors, spacing } from '@/theme/v2';
import { AnimatedPressable, Reveal, usePressScale, useVisionEntrance } from './VisionMotion';
import { VisionBackButton, VisionKicker, VISION_GOLD, VISION_SERIF } from './VisionPaperChrome';
import { VISION_METHOD_ART } from './visionIntroArt';

export type VisionCreationPath = 'generate' | 'photos';

type Props = {
  onBack: () => void;
  onChoose: (path: VisionCreationPath) => void;
  testID: string;
};

/** Each polaroid's resting angle; they start upright and fan out to it. */
const POLAROID_REST_DEG = { back: -7, right: 6, front: -2 } as const;

/**
 * A polaroid that is laid down once the card has arrived: it turns from upright
 * to its resting angle. It is what says "your photos" before a word is read.
 */
function Polaroid({ source, style, restDeg, order }: { source: ImageSourcePropType; style: StyleProp<ImageStyle>; restDeg: number; order: number }) {
  const progress = useVisionEntrance(AnchorMotion.duration.standard + 4 * 60 + order * 50, AnchorMotion.duration.expressive + 100);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 8 }, { rotate: `${restDeg * progress.value}deg` }],
  }));
  return <Animated.Image source={source} resizeMode="cover" style={[style, animated]} />;
}

/**
 * Screen 2: two equally legitimate ways to build a Vision. No hero image;
 * this screen starts directly on the paper. Personal photos are never
 * presented as a lesser or disabled option.
 *
 * Arrival follows the hierarchy: the question, then the Generate card, then the
 * photos card, then the footnote. The cards sink under the finger and their
 * arrows lean into the press. The gold sparkle twinkles once; nothing loops.
 */
export function VisionMethodStage({ onBack, onChoose, testID }: Props) {
  const insets = useSafeAreaInsets();
  const choose = (path: VisionCreationPath) => { v2Haptics.selection(); onChoose(path); };
  const generatePress = usePressScale(0.975);
  const photosPress = usePressScale(0.975);
  const generatePressed = generatePress.pressed;
  const photosPressed = photosPress.pressed;
  const generateArrow = useAnimatedStyle(() => ({ transform: [{ translateX: generatePressed.value * 3 }] }));
  const photosArrow = useAnimatedStyle(() => ({ transform: [{ translateX: photosPressed.value * 3 }] }));

  // The photograph in the Generate card settles from a hair too large, as the card lands.
  const settle = useVisionEntrance(AnchorMotion.duration.micro, AnchorMotion.duration.expressive * 2, AnchorMotion.easing.emphasized);
  const settleStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1.08 - settle.value * 0.08 }] }));
  // The sparkle appears with the card, then turns into place once.
  const twinkle = useVisionEntrance(AnchorMotion.duration.standard, AnchorMotion.duration.expressive);
  const twinkleStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + twinkle.value * 0.7,
    transform: [{ scale: 0.75 + twinkle.value * 0.25 }, { rotate: `${(1 - twinkle.value) * -28}deg` }],
  }));
  return (
    <View testID={`${testID}-method`} style={styles.stage}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[2], paddingBottom: insets.bottom + spacing[6] }]} showsVerticalScrollIndicator={false}>
        <VisionBackButton onPress={onBack} style={styles.back} />
        <Reveal order={0} style={styles.stretch}>
          <View style={styles.header}>
            <VisionKicker>CREATE YOUR VISION</VisionKicker>
            <Text accessibilityRole="header" style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>How do you want to see it?</Text>
            <Text style={styles.subtitle}>Choose a way to bring your intention to life.</Text>
          </View>
        </Reveal>

        <Reveal order={1} style={styles.stretch}>
        <AnimatedPressable
          testID="vision-method-generate"
          accessibilityRole="button"
          accessibilityLabel="Generate my Vision. Describe what you want to see and Anchor will create the imagery."
          onPress={() => choose('generate')}
          onPressIn={generatePress.onPressIn}
          onPressOut={generatePress.onPressOut}
          style={[styles.generateCard, generatePress.style]}
        >
          <Animated.Image source={VISION_METHOD_ART.generate} resizeMode="cover" accessibilityIgnoresInvertColors style={[styles.generatePhoto, settleStyle]} />
          <LinearGradient pointerEvents="none" colors={[colors.ink.deep, colors.ink.deep, 'rgba(14,21,28,0.78)', 'rgba(14,21,28,0)']}
            locations={[0, 0.3, 0.5, 0.85]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <View style={styles.generateCopy}>
            <Animated.View style={[styles.sparkle, twinkleStyle]}>
              <Sparkles size={26} color={VISION_GOLD} strokeWidth={1.6} />
            </Animated.View>
            <Text style={styles.generateTitle}>Generate{'\n'}my Vision</Text>
            <Text style={styles.generateBody}>Describe what you want to see and Anchor will create the imagery.</Text>
          </View>
          <View style={styles.ringArrow}><Animated.View style={generateArrow}><ArrowRight size={22} color={VISION_GOLD} /></Animated.View></View>
        </AnimatedPressable>
        </Reveal>

        <Reveal order={2} style={styles.stretch}>
        <AnimatedPressable
          testID="vision-method-photos"
          accessibilityRole="button"
          accessibilityLabel="Use my photos. Choose or take photos that already mean something to you."
          onPress={() => choose('photos')}
          onPressIn={photosPress.onPressIn}
          onPressOut={photosPress.onPressOut}
          style={[styles.photosCard, photosPress.style]}
        >
          <View style={styles.photosCopy}>
            <ImageIcon size={28} color={colors.text.primary} strokeWidth={1.6} />
            <Text style={styles.photosTitle}>Use my{'\n'}photos</Text>
            <Text style={styles.photosBody}>Choose or take photos that already mean something to you.</Text>
          </View>
          <View style={styles.stack} pointerEvents="none">
            <Polaroid source={VISION_METHOD_ART.photoA} style={[styles.polaroid, styles.polaroidBack]} restDeg={POLAROID_REST_DEG.back} order={0} />
            <Polaroid source={VISION_METHOD_ART.photoC} style={[styles.polaroid, styles.polaroidRight]} restDeg={POLAROID_REST_DEG.right} order={1} />
            <Polaroid source={VISION_METHOD_ART.photoB} style={[styles.polaroid, styles.polaroidFront]} restDeg={POLAROID_REST_DEG.front} order={2} />
          </View>
          <View style={styles.solidArrow}><Animated.View style={photosArrow}><ArrowRight size={22} color={colors.ink.text.primary} /></Animated.View></View>
        </AnimatedPressable>
        </Reveal>

        <Reveal order={4} rise={8} style={styles.stretch}>
          <View style={styles.footer} accessible accessibilityLabel="You can mix generated and personal images later.">
            <View style={styles.footerRule} />
            <InfinityIcon size={18} color={colors.text.secondary} />
            <Text style={styles.footerText}>You can mix generated and personal images later.</Text>
            <View style={styles.footerRule} />
          </View>
        </Reveal>
      </ScrollView>
    </View>
  );
}

const CARD_RADIUS = 22;
const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing[4], gap: spacing[4] },
  back: { alignSelf: 'flex-start' },
  header: { alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[2], marginBottom: spacing[1] },
  title: { alignSelf: 'stretch', fontFamily: VISION_SERIF, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, textAlign: 'center', color: colors.text.primary },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 21, textAlign: 'center', color: colors.text.secondary },
  stretch: { alignSelf: 'stretch' },
  sparkle: { alignSelf: 'flex-start' },
  generateCard: { height: 214, borderRadius: CARD_RADIUS, overflow: 'hidden', backgroundColor: colors.ink.deep },
  generatePhoto: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '68%' },
  generateCopy: { flex: 1, padding: spacing[5], gap: spacing[2], width: '62%', justifyContent: 'center' },
  generateTitle: { fontFamily: VISION_SERIF, fontSize: 32, lineHeight: 34, letterSpacing: -0.5, color: colors.ink.text.primary },
  generateBody: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.ink.text.secondary },
  ringArrow: {
    position: 'absolute', right: spacing[4], bottom: spacing[4], width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: VISION_GOLD, backgroundColor: 'rgba(14,21,28,0.55)',
  },
  photosCard: {
    height: 214, borderRadius: CARD_RADIUS, overflow: 'hidden', backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default,
  },
  photosCopy: { flex: 1, padding: spacing[5], gap: spacing[2], width: '56%', justifyContent: 'center' },
  photosTitle: { fontFamily: VISION_SERIF, fontSize: 32, lineHeight: 34, letterSpacing: -0.5, color: colors.text.primary },
  photosBody: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.secondary },
  stack: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '52%' },
  polaroid: { position: 'absolute', width: 104, height: 128, borderWidth: 4, borderColor: '#FFFFFF', borderRadius: 2, backgroundColor: '#FFFFFF' },
  polaroidBack: { left: 6, top: 26 },
  polaroidRight: { right: 8, top: 14 },
  polaroidFront: { left: 44, top: 52 },
  solidArrow: {
    position: 'absolute', right: spacing[4], bottom: spacing[4], width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink.deep,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  footerRule: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: VISION_GOLD, opacity: 0.45 },
  footerText: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: colors.text.secondary },
});
