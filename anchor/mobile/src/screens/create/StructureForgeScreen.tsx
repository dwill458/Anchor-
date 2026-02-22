import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground } from '@/components/common';
import { generateAllVariants, SigilGenerationResult, SigilVariant } from '@/utils/sigil/traditional-generator';

type StructureType = 'focused' | 'ritual' | 'raw';

type StructureForgeRouteProp = RouteProp<RootStackParamList, 'StructureForge'>;
type StructureForgeNavigationProp = StackNavigationProp<RootStackParamList, 'StructureForge'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = spacing.sm + spacing.xs;
const HORIZONTAL_PADDING = spacing.lg;
const STRUCTURE_CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_GAP * 2) / 3;

const STRUCTURE_VARIANT_MAP = {
  focused: 'balanced',
  ritual: 'dense',
  raw: 'minimal',
} as const;

const STRUCTURES: Array<{ type: StructureType; label: string; description: string }> = [
  {
    type: 'focused',
    label: 'Focused',
    description: 'Clear paths,\nsteady center',
  },
  {
    type: 'ritual',
    label: 'Ritual',
    description: 'Contained,\namplified force',
  },
  {
    type: 'raw',
    label: 'Raw',
    description: 'Open lines,\nfree energy',
  },
];

const rgba = (hex: string, alpha: number): string => {
  const value = hex.replace('#', '');
  const normalized = value.length === 3
    ? value.split('').map((c) => c + c).join('')
    : value;
  const int = parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function StructureForgeScreen() {
  const navigation = useNavigation<StructureForgeNavigationProp>();
  const route = useRoute<StructureForgeRouteProp>();
  const insets = useSafeAreaInsets();

  const { intentionText, category, distilledLetters } = route.params;
  const intention = (route.params as RootStackParamList['StructureForge'] & { intention?: string }).intention
    ?? intentionText;

  const [selectedStructure, setSelectedStructure] = useState<StructureType>('focused');
  const [variants, setVariants] = useState<SigilGenerationResult[]>([]);

  const glowOpacity = useSharedValue(0.7);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [glowOpacity]);

  useEffect(() => {
    try {
      const generated = generateAllVariants(distilledLetters);
      setVariants(generated);
    } catch (error) {
      console.error('Failed to generate structure variants:', error);
      setVariants([]);
    }
  }, [distilledLetters]);

  const previewGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const selectedConfig = useMemo(
    () => STRUCTURES.find((item) => item.type === selectedStructure) ?? STRUCTURES[0],
    [selectedStructure]
  );

  const getVariantForStructure = (structureType: StructureType): SigilGenerationResult | undefined => {
    const mappedVariant = STRUCTURE_VARIANT_MAP[structureType] as SigilVariant;
    return variants.find((item) => item.variant === mappedVariant);
  };

  const selectedVariantSvg = getVariantForStructure(selectedStructure)?.svg ?? '';

  const handleBeginForging = () => {
    if (!selectedVariantSvg) return;

    (navigation as unknown as { navigate: (...args: any[]) => void }).navigate('ManualReinforcement', {
      intention,
      structureType: selectedStructure,
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg: selectedVariantSvg,
      structureVariant: STRUCTURE_VARIANT_MAP[selectedStructure],
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ZenBackground />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl + spacing.xl + spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <View style={styles.forgeBadge}>
            <Text style={styles.forgeEmoji}>🔥</Text>
            <Text style={styles.forgeText}>Forge</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proText}>PRO</Text>
            </View>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Choose Your{`\n`}Structure</Text>
          <Text style={styles.subtitle}>Select a frame that resonates with your intention.</Text>
        </View>

        <View style={styles.intentionTag}>
          <Text style={styles.intentionLabel}>Anchor</Text>
          <View style={styles.intentionDivider} />
          <Text style={styles.intentionText} numberOfLines={1}>
            {intention}
          </Text>
        </View>

        <View style={styles.previewCanvas}>
          <View style={styles.previewRadialCore} pointerEvents="none" />
          <Animated.View style={[styles.previewGlow, previewGlowStyle]} pointerEvents="none" />
          <View style={styles.previewCenter}>
            {selectedVariantSvg ? (
              <SvgXml xml={selectedVariantSvg} width={160} height={160} color={colors.gold} />
            ) : null}
          </View>
          <Text style={styles.previewWatermark}>PREVIEW</Text>
        </View>

        <Text style={styles.sectionLabel}>Available Structures</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.structureRow}
        >
          {STRUCTURES.map((structure) => {
            const isSelected = structure.type === selectedStructure;
            const cardVariant = getVariantForStructure(structure.type);
            return (
              <Pressable
                key={structure.type}
                style={[
                  styles.structureCard,
                  isSelected && styles.structureCardSelected,
                  { width: STRUCTURE_CARD_WIDTH },
                ]}
                onPress={() => setSelectedStructure(structure.type)}
                accessibilityRole="button"
                accessibilityLabel={`${structure.label} structure`}
                accessibilityState={{ selected: isSelected }}
              >
                {isSelected && (
                  <View style={styles.checkmarkBadge}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}

                <View style={styles.cardIconWrap}>
                  {cardVariant ? (
                    <SvgXml xml={cardVariant.svg} width={64} height={64} color={colors.gold} />
                  ) : null}
                </View>

                <Text style={styles.cardName}>{structure.label}</Text>
                <Text style={styles.cardDescription}>{structure.description}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.activeHint}>{selectedConfig.label} selected</Text>
      </ScrollView>

      <View style={styles.ctaWrapper} pointerEvents="box-none">
        <LinearGradient
          colors={[rgba(colors.navy, 0), colors.navy]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.ctaGradient, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <Pressable
            style={styles.ctaShadowWrap}
            onPress={handleBeginForging}
            accessibilityRole="button"
            accessibilityLabel="Begin Forging"
          >
            <LinearGradient
              colors={[colors.gold, colors.forgeScreen.ctaMid, colors.forgeScreen.ctaEnd]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>Begin Forging</Text>
            </LinearGradient>
          </Pressable>
        </LinearGradient>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  scrollContent: {
    paddingTop: spacing.md + spacing.xs,
  },
  headerRow: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forgeScreen.glassBg,
    borderWidth: 1,
    borderColor: colors.forgeScreen.glassBorder,
  },
  backIcon: {
    fontFamily: typography.fonts.heading,
    fontSize: 22,
    color: colors.gold,
  },
  forgeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.forgeScreen.forgeBadgeBorder,
    backgroundColor: colors.forgeScreen.forgeBadgeBg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md - spacing.xs,
    gap: spacing.xs,
  },
  forgeEmoji: {
    fontSize: 13,
    lineHeight: 15,
  },
  forgeText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    color: colors.gold,
  },
  proBadge: {
    borderRadius: 8,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  proText: {
    fontFamily: typography.fonts.body,
    fontSize: 8,
    color: colors.forgeScreen.ctaText,
    letterSpacing: 0.3,
  },
  titleBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 28,
    lineHeight: 32,
    color: colors.gold,
    textShadowColor: rgba(colors.gold, 0.3),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 40,
  },
  subtitle: {
    marginTop: spacing.sm - spacing.xs / 2,
    fontFamily: typography.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.forgeScreen.textMuted,
    fontWeight: '300',
  },
  intentionTag: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm + spacing.xs / 2,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    backgroundColor: colors.forgeScreen.glassBg,
    borderWidth: 1,
    borderColor: colors.forgeScreen.glassBorder,
    paddingVertical: spacing.sm - spacing.xs / 2,
    paddingHorizontal: spacing.md - spacing.xs,
  },
  intentionLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.gold,
    opacity: 0.7,
    textTransform: 'uppercase',
  },
  intentionDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.forgeScreen.glassBorder,
    marginHorizontal: spacing.sm,
  },
  intentionText: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.forgeScreen.intentionText,
    fontStyle: 'italic',
    maxWidth: SCREEN_WIDTH - spacing.lg * 4,
  },
  previewCanvas: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.forgeScreen.previewBorder,
    backgroundColor: colors.forgeScreen.previewSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewRadialCore: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: rgba(colors.deepPurple, 0.28),
  },
  previewGlow: {
    position: 'absolute',
    width: 186,
    height: 186,
    borderRadius: 93,
    backgroundColor: rgba(colors.gold, 0.18),
  },
  previewCenter: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewWatermark: {
    position: 'absolute',
    bottom: spacing.sm + spacing.xs,
    right: spacing.md - spacing.xs / 2,
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.forgeScreen.previewWatermark,
  },
  sectionLabel: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md + spacing.xs / 2,
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 3,
    color: colors.forgeScreen.textMuted,
    textTransform: 'uppercase',
  },
  structureRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + spacing.xs,
    gap: CARD_GAP,
  },
  structureCard: {
    flexShrink: 0,
    borderRadius: 16,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm + spacing.xs / 2,
    paddingBottom: spacing.sm + spacing.xs + spacing.xs / 2,
    borderWidth: 1,
    borderColor: colors.forgeScreen.cardBorder,
    backgroundColor: colors.forgeScreen.cardSurface,
    alignItems: 'center',
    position: 'relative',
  },
  structureCardSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.forgeScreen.cardSelected,
  },
  checkmarkBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.forgeScreen.ctaText,
    lineHeight: 12,
    fontWeight: '600',
  },
  cardIconWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  cardName: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    color: rgba(colors.white, 0.85),
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  cardDescription: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    color: colors.forgeScreen.textMuted,
  },
  activeHint: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: rgba(colors.white, 0.65),
  },
  ctaWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  ctaGradient: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  ctaShadowWrap: {
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: spacing.sm },
    shadowRadius: 14,
    elevation: 8,
    borderRadius: 14,
  },
  ctaButton: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: typography.fonts.heading,
    fontSize: 15,
    letterSpacing: 1,
    color: colors.forgeScreen.ctaText,
    fontWeight: '600',
  },
});
