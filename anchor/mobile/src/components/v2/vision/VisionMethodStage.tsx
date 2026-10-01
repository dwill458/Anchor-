import { Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Image as ImageIcon, Infinity as InfinityIcon, Sparkles } from 'lucide-react-native';
import { v2Haptics } from '@/hooks/v2';
import { colors, spacing } from '@/theme/v2';
import { VisionBackButton, VisionKicker, VISION_GOLD, VISION_SERIF } from './VisionPaperChrome';
import { VISION_METHOD_ART } from './visionIntroArt';

export type VisionCreationPath = 'generate' | 'photos';

type Props = {
  onBack: () => void;
  onChoose: (path: VisionCreationPath) => void;
  testID: string;
};

/**
 * Screen 2: two equally legitimate ways to build a Vision. No hero image;
 * this screen starts directly on the paper. Personal photos are never
 * presented as a lesser or disabled option.
 */
export function VisionMethodStage({ onBack, onChoose, testID }: Props) {
  const insets = useSafeAreaInsets();
  const choose = (path: VisionCreationPath) => { v2Haptics.selection(); onChoose(path); };
  return (
    <View testID={`${testID}-method`} style={styles.stage}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[2], paddingBottom: insets.bottom + spacing[6] }]} showsVerticalScrollIndicator={false}>
        <VisionBackButton onPress={onBack} style={styles.back} />
        <View style={styles.header}>
          <VisionKicker>CREATE YOUR VISION</VisionKicker>
          <Text accessibilityRole="header" style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>How do you want to see it?</Text>
          <Text style={styles.subtitle}>Choose a way to bring your intention to life.</Text>
        </View>

        <Pressable
          testID="vision-method-generate"
          accessibilityRole="button"
          accessibilityLabel="Generate my Vision. Describe what you want to see and Anchor will create the imagery."
          onPress={() => choose('generate')}
          style={({ pressed }) => [styles.generateCard, pressed && styles.pressed]}
        >
          <Image source={VISION_METHOD_ART.generate} resizeMode="cover" accessibilityIgnoresInvertColors style={styles.generatePhoto} />
          <LinearGradient pointerEvents="none" colors={[colors.ink.deep, colors.ink.deep, 'rgba(14,21,28,0.78)', 'rgba(14,21,28,0)']}
            locations={[0, 0.3, 0.5, 0.85]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <View style={styles.generateCopy}>
            <Sparkles size={26} color={VISION_GOLD} strokeWidth={1.6} />
            <Text style={styles.generateTitle}>Generate{'\n'}my Vision</Text>
            <Text style={styles.generateBody}>Describe what you want to see and Anchor will create the imagery.</Text>
          </View>
          <View style={styles.ringArrow}><ArrowRight size={22} color={VISION_GOLD} /></View>
        </Pressable>

        <Pressable
          testID="vision-method-photos"
          accessibilityRole="button"
          accessibilityLabel="Use my photos. Choose or take photos that already mean something to you."
          onPress={() => choose('photos')}
          style={({ pressed }) => [styles.photosCard, pressed && styles.pressed]}
        >
          <View style={styles.photosCopy}>
            <ImageIcon size={28} color={colors.text.primary} strokeWidth={1.6} />
            <Text style={styles.photosTitle}>Use my{'\n'}photos</Text>
            <Text style={styles.photosBody}>Choose or take photos that already mean something to you.</Text>
          </View>
          <View style={styles.stack} pointerEvents="none">
            <Image source={VISION_METHOD_ART.photoA} resizeMode="cover" style={[styles.polaroid, styles.polaroidBack]} />
            <Image source={VISION_METHOD_ART.photoC} resizeMode="cover" style={[styles.polaroid, styles.polaroidRight]} />
            <Image source={VISION_METHOD_ART.photoB} resizeMode="cover" style={[styles.polaroid, styles.polaroidFront]} />
          </View>
          <View style={styles.solidArrow}><ArrowRight size={22} color={colors.ink.text.primary} /></View>
        </Pressable>

        <View style={styles.footer} accessible accessibilityLabel="You can mix generated and personal images later.">
          <View style={styles.footerRule} />
          <InfinityIcon size={18} color={colors.text.secondary} />
          <Text style={styles.footerText}>You can mix generated and personal images later.</Text>
          <View style={styles.footerRule} />
        </View>
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
  pressed: { transform: [{ scale: 0.99 }] },
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
  polaroidBack: { left: 6, top: 26, transform: [{ rotate: '-7deg' }] },
  polaroidRight: { right: 8, top: 14, transform: [{ rotate: '6deg' }] },
  polaroidFront: { left: 44, top: 52, transform: [{ rotate: '-2deg' }] },
  solidArrow: {
    position: 'absolute', right: spacing[4], bottom: spacing[4], width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink.deep,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  footerRule: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: VISION_GOLD, opacity: 0.45 },
  footerText: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: colors.text.secondary },
});
