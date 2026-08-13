import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { SigilSvg, ZenBackground } from '@/components/common';
import { MicroTeachInline } from '@/components/teaching';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { generateAllVariants, SigilGenerationResult, SigilVariant } from '@/utils/sigil/traditional-generator';
import { classifyToTierPreliminary } from '@/utils/tierClassifier';
import { isCompactPhoneViewport, isShortPhoneViewport } from '@/utils/layout';
import { useFirstAnchorFlowStore, type FirstAnchorStructure } from '@/stores/firstAnchorFlowStore';

type StructureType = 'focused' | 'ritual' | 'raw';
type StructureCardType = StructureType | 'drawn';

type StructureForgeRouteProp = RouteProp<RootStackParamList, 'StructureForge'>;
type StructureForgeNavigationProp = StackNavigationProp<RootStackParamList, 'StructureForge'>;

const CARD_GAP = spacing.sm + spacing.xs;

const STRUCTURE_VARIANT_MAP = {
  focused: 'balanced',
  ritual: 'dense',
  raw: 'minimal',
} as const;

const DRAWN_ICON_XML = `
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 48L18.6 38.4L38.5 18.5C40.3 16.7 43.2 16.7 45 18.5L45.5 19C47.3 20.8 47.3 23.7 45.5 25.5L25.6 45.4L16 48Z" stroke="#D4AF37" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M34 23L41 30" stroke="#D4AF37" stroke-width="3" stroke-linecap="round"/>
    <path d="M22 15C25 11.8 28.6 10.2 32.8 10.2C37.1 10.2 40.9 12.3 44.2 16.4" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 5"/>
    <path d="M14 54C20.8 49.3 28.4 47 36.8 47C42.3 47 47.4 47.9 52 49.8" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 5"/>
  </svg>
`;

type StructureOption = {
  type: StructureCardType;
  label: string;
  traits: string;
  description: string;
  teaching: string;
  icon: StructureCardType;
  isManual?: boolean;
};

const STRUCTURES: StructureOption[] = [
  {
    type: 'focused',
    label: 'Focused',
    traits: 'Balanced · Directed · Precise',
    description: 'A structured form built around a clear center.',
    teaching: 'Balanced geometry · Defined center',
    icon: 'focused',
  },
  {
    type: 'ritual',
    label: 'Contained',
    traits: 'Enclosed · Compact · Dense',
    description: 'Your form held within a defined boundary.',
    teaching: 'Enclosed geometry · Bounded form',
    icon: 'ritual',
  },
  {
    type: 'raw',
    label: 'Raw',
    traits: 'Open · Minimal · Unrestricted',
    description: 'Less framing. More of the original form remains visible.',
    teaching: 'Open geometry · Minimal constraint',
    icon: 'raw',
  },
  {
    type: 'drawn',
    label: 'Drawn',
    traits: 'Personal · Manual · Freeform',
    description: 'Create the form yourself.',
    teaching: 'Your hand · Your form',
    icon: 'drawn',
    isManual: true,
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
  const { width, height } = useWindowDimensions();

  const { intentionText, category, distilledLetters } = route.params;
  const traceDefaultEnabled = useSettingsStore((state) => state.traceDefaultEnabled ?? true);
  const intention = (route.params as RootStackParamList['StructureForge'] & { intention?: string }).intention
    ?? intentionText;
  const isCompactLayout = isCompactPhoneViewport(width, height);
  const isShortLayout = isShortPhoneViewport(height);

  const structureTeaching = useTeachingGate({
    screenId: 'structure_forge',
    candidateIds: ['structure_forge_first_time_v1'],
  });
  const horizontalPadding = isCompactLayout ? spacing.md + spacing.xs : spacing.lg;
  const structureCardWidth = (width - horizontalPadding * 2 - CARD_GAP) / 2;
  const previewSize = isCompactLayout ? 140 : isShortLayout ? 150 : 160;
  const previewCanvasHeight = isCompactLayout ? 196 : isShortLayout ? 208 : 220;
  const previewGlowSize = isCompactLayout ? 164 : isShortLayout ? 174 : 186;
  const previewCoreSize = isCompactLayout ? 188 : isShortLayout ? 204 : 220;

  // Selection is explicit, but a resumed first-anchor draft should restore the
  // user's last choice instead of making them repeat it.
  const savedStructure = useFirstAnchorFlowStore((state) => state.draft?.structure);
  const [selectedStructure, setSelectedStructure] = useState<StructureCardType | null>(null);
  const [showAboutStructures, setShowAboutStructures] = useState(false);
  const glowOpacity = useSharedValue(0.7);
  const previewFlashOpacity = useSharedValue(0);

  const draftToCard: Record<FirstAnchorStructure, StructureCardType> = {
    balanced: 'focused',
    compact: 'ritual',
    minimal: 'raw',
    drawn: 'drawn',
  };

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [glowOpacity]);

  useEffect(() => {
    if (savedStructure) {
      setSelectedStructure(draftToCard[savedStructure]);
    }
  }, [savedStructure]);

  useEffect(() => {
    if (!selectedStructure) return;
    previewFlashOpacity.value = withSequence(
      withTiming(0.72, { duration: 120 }),
      withTiming(0, { duration: 420 })
    );
  }, [previewFlashOpacity, selectedStructure]);

  const { tier } = classifyToTierPreliminary(intention);

  const variants = useMemo<SigilGenerationResult[]>(
    () => generateAllVariants(distilledLetters, tier),
    [distilledLetters, tier]
  );

  const previewGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const previewFlashStyle = useAnimatedStyle(() => ({
    opacity: previewFlashOpacity.value,
  }));

  const selectedConfig = useMemo(
    () => STRUCTURES.find((item) => item.type === selectedStructure),
    [selectedStructure]
  );

  const variantByStructure = useMemo<Record<StructureType, string>>(() => {
    const variantMap = new Map(
      variants.map((item) => [item.variant, item.svg] as const)
    );

    return {
      focused: variantMap.get(STRUCTURE_VARIANT_MAP.focused as SigilVariant) ?? '',
      ritual: variantMap.get(STRUCTURE_VARIANT_MAP.ritual as SigilVariant) ?? '',
      raw: variantMap.get(STRUCTURE_VARIANT_MAP.raw as SigilVariant) ?? '',
    };
  }, [variants]);

  const getStructureIconXml = (structure: StructureOption): string => (
    structure.icon === 'drawn'
      ? DRAWN_ICON_XML
      : variantByStructure[structure.icon as StructureType] ?? ''
  );

  const selectedVariantSvg = selectedConfig ? getStructureIconXml(selectedConfig) : '';
  const isManualStructureSelected = selectedConfig?.isManual === true;

  const handleSelectStructure = (structure: StructureCardType) => {
    setSelectedStructure(structure);
    const selectedDraftStructure: FirstAnchorStructure = structure === 'focused'
      ? 'balanced'
      : structure === 'ritual'
        ? 'compact'
        : structure === 'raw'
          ? 'minimal'
          : 'drawn';
    useFirstAnchorFlowStore.getState().updateDraft({ structure: selectedDraftStructure });
  };

  const navigateToTraceStructure = () => {
    if (!selectedStructure || !selectedConfig || isManualStructureSelected) return;

    (navigation as unknown as { navigate: (...args: any[]) => void }).navigate('ManualReinforcement', {
      source: 'creation',
      intention,
      structureType: selectedStructure as StructureType,
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg: selectedVariantSvg,
      structureVariant: STRUCTURE_VARIANT_MAP[selectedStructure as StructureType],
    });
  };

  const handleBeginForging = () => {
    if (!selectedStructure || !selectedConfig) return;

    const selectedDraftStructure: FirstAnchorStructure = selectedStructure === 'focused'
      ? 'balanced'
      : selectedStructure === 'ritual'
        ? 'compact'
        : selectedStructure === 'raw'
          ? 'minimal'
          : 'drawn';
    useFirstAnchorFlowStore.getState().updateDraft({ structure: selectedDraftStructure });

    if (isManualStructureSelected) {
      (navigation as unknown as { navigate: (...args: any[]) => void }).navigate('ManualForge', {
        intentionText,
        category,
        distilledLetters,
        isFromScratch: true,
      });
      return;
    }

    if (!selectedVariantSvg) return;

    if (!traceDefaultEnabled) {
      (navigation as unknown as { navigate: (...args: any[]) => void }).navigate('StyleSelection', {
        intentionText,
        category,
        distilledLetters,
        baseSigilSvg: selectedVariantSvg,
        reinforcedSigilSvg: undefined,
        structureVariant: STRUCTURE_VARIANT_MAP[selectedStructure as StructureType],
        reinforcementMetadata: { completed: false, skipped: true, strokeCount: 0, fidelityScore: 0, timeSpentMs: 0 },
      });
      return;
    }

    navigateToTraceStructure();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ZenBackground />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isCompactLayout && styles.scrollContentCompact,
          { paddingBottom: insets.bottom + spacing.xxl + spacing.xl + spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerRow, { paddingHorizontal: horizontalPadding }]}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          {/*
            // DEFERRED: Forge pill removed from header — post-launch
            <View style={styles.forgeBadge}>
              <Text style={styles.forgeEmoji}>🔥</Text>
              <Text style={styles.forgeText}>Forge</Text>
            </View>
          */}
          <Text style={styles.stepIndicator}>Step 2 of 2</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.titleBlock, { paddingHorizontal: horizontalPadding }, isCompactLayout && styles.titleBlockCompact]}>
          <Text style={styles.eyebrow}>Structure</Text>
          <Text style={[styles.title, isCompactLayout && styles.titleCompact]}>Choose your structure</Text>
          <Text style={[styles.subtitle, isCompactLayout && styles.subtitleCompact]}>
            Choose how your Anchor takes form.
          </Text>
          <Text style={styles.supportingCopy}>
            Structure changes the form, not the intention. There is no stronger choice.
          </Text>
          <MicroTeachInline teaching={structureTeaching} screenId="structure_forge" />
        </View>

        <View style={[styles.intentionTag, { marginHorizontal: horizontalPadding }]}>
          <Text style={styles.intentionLabel}>Anchoring</Text>
          <View style={styles.intentionDivider} />
          <Text
            style={[
              styles.intentionText,
              { maxWidth: width - horizontalPadding * 4 },
              isCompactLayout && styles.intentionTextCompact,
            ]}
            numberOfLines={1}
          >
            {intention}
          </Text>
        </View>

        <View
          style={[
            styles.previewCanvas,
            {
              marginHorizontal: horizontalPadding,
              height: previewCanvasHeight,
            },
            isCompactLayout && styles.previewCanvasCompact,
          ]}
        >
          <View
            style={[
              styles.previewRadialCore,
              {
                width: previewCoreSize,
                height: previewCoreSize,
                borderRadius: previewCoreSize / 2,
              },
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.previewGlow,
              previewGlowStyle,
              {
                width: previewGlowSize,
                height: previewGlowSize,
                borderRadius: previewGlowSize / 2,
              },
            ]}
            pointerEvents="none"
          />
          <Animated.View style={[styles.previewFlash, previewFlashStyle]} pointerEvents="none" />
          <View style={[styles.previewCenter, { width: previewSize, height: previewSize }]}>
            {selectedVariantSvg ? (
              <SigilSvg xml={selectedVariantSvg} width={previewSize} height={previewSize} color={colors.gold} />
            ) : null}
          </View>
          <Text style={styles.previewWatermark}>Preview</Text>
        </View>

        <Text style={[styles.sectionLabel, { paddingHorizontal: horizontalPadding }, isCompactLayout && styles.sectionLabelCompact]}>
          Available Structures
        </Text>

        <View style={[styles.quoteRow, { marginHorizontal: horizontalPadding }]}>
          <View style={styles.quoteBar} />
          <Text style={styles.quoteText}>“Choose the form that can hold focus, not decoration.”</Text>
        </View>

        <View style={[styles.structureRow, { paddingHorizontal: horizontalPadding }]}>
          {STRUCTURES.map((structure) => {
            const isSelected = structure.type === selectedStructure;
            const cardIconXml = getStructureIconXml(structure);
            const isManualStructure = structure.isManual === true;
            return (
              <Pressable
                key={structure.type}
                style={[
                  styles.structureCard,
                  isSelected && styles.structureCardSelected,
                  isManualStructure && styles.manualStructureCard,
                  isSelected && isManualStructure && styles.manualStructureCardSelected,
                  isCompactLayout && styles.structureCardCompact,
                  { width: structureCardWidth },
                ]}
                onPress={() => handleSelectStructure(structure.type)}
                accessibilityRole="button"
                accessibilityLabel={`${structure.label} structure`}
                accessibilityState={{ selected: isSelected }}
              >
                {isSelected && (
                  <View style={styles.checkmarkBadge}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}

                <View style={[styles.cardIconWrap, isCompactLayout && styles.cardIconWrapCompact]}>
                  {cardIconXml ? (
                    <SigilSvg
                      xml={cardIconXml}
                      width={isCompactLayout ? 54 : 64}
                      height={isCompactLayout ? 54 : 64}
                      color={colors.gold}
                    />
                  ) : null}
                </View>

                <Text style={[styles.cardName, isCompactLayout && styles.cardNameCompact]}>
                  {structure.label}
                </Text>
                <Text style={[styles.cardTraits, isCompactLayout && styles.cardTraitsCompact]}>
                  {structure.traits}
                </Text>
                <Text style={[styles.cardDescription, isCompactLayout && styles.cardDescriptionCompact]}>
                  {structure.description}
                </Text>
                <Text style={styles.cardTeaching}>{structure.teaching}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.aboutStructuresLink, { marginHorizontal: horizontalPadding }]}
          onPress={() => setShowAboutStructures(true)}
          accessibilityRole="button"
          accessibilityLabel="About structures"
        >
          <Text style={styles.aboutStructuresText}>About structures</Text>
          <Text style={styles.aboutStructuresChevron}>⌄</Text>
        </Pressable>

        <Text style={[styles.activeHint, { paddingHorizontal: horizontalPadding }, isCompactLayout && styles.activeHintCompact]}>
          {selectedConfig ? `${selectedConfig.label} selected` : 'Choose a structure to continue'}
        </Text>
        {selectedConfig && !traceDefaultEnabled && !isManualStructureSelected ? (
          <Pressable
            style={[styles.traceLink, { marginHorizontal: horizontalPadding }]}
            onPress={navigateToTraceStructure}
            accessibilityRole="button"
            accessibilityLabel="Trace"
          >
            <Text style={styles.traceLinkText}>Trace</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={styles.ctaWrapper} pointerEvents="box-none">
        <LinearGradient
          colors={[rgba(colors.navy, 0), colors.navy]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[
            styles.ctaGradient,
            isCompactLayout && styles.ctaGradientCompact,
            { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <Pressable
            style={styles.ctaShadowWrap}
            onPress={handleBeginForging}
            disabled={!selectedConfig}
            accessibilityRole="button"
            accessibilityLabel={isManualStructureSelected ? 'Draw Your Anchor' : 'Continue'}
          >
            {isManualStructureSelected ? (
              <View style={[styles.ctaButton, styles.manualCtaButton]}>
                <Text style={[styles.ctaText, styles.manualCtaText]}>Draw Your Anchor →</Text>
              </View>
            ) : (
              <LinearGradient
                colors={[colors.gold, colors.forgeScreen.ctaMid, colors.forgeScreen.ctaEnd]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.ctaButton, !selectedConfig && styles.ctaButtonDisabled, isCompactLayout && styles.ctaButtonCompact]}
              >
                <Text style={styles.ctaText}>Continue →</Text>
              </LinearGradient>
            )}
          </Pressable>
        </LinearGradient>
      </View>

      <Modal
        visible={showAboutStructures}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAboutStructures(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowAboutStructures(false)} />
          <View style={styles.aboutSheet} accessibilityViewIsModal>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>About structures</Text>
            <Text style={styles.sheetTitle}>The structure holds the intention.</Text>
            <Text style={styles.sheetBody}>
              Each choice changes the shape and framing of your Anchor, never its meaning or strength. Choose the form that can hold focus, not decoration.
            </Text>
            <Pressable style={styles.sheetClose} onPress={() => setShowAboutStructures(false)} accessibilityRole="button" accessibilityLabel="Close about structures">
              <Text style={styles.sheetCloseText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  scrollContentCompact: {
    paddingTop: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  stepIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.forgeScreen.textMuted,
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
  // DEFERRED: Forge pill removed from header — post-launch
  // forgeBadge: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   borderRadius: 18,
  //   borderWidth: 1,
  //   borderColor: colors.forgeScreen.forgeBadgeBorder,
  //   backgroundColor: colors.forgeScreen.forgeBadgeBg,
  //   paddingVertical: spacing.xs,
  //   paddingHorizontal: spacing.md - spacing.xs,
  //   gap: spacing.xs,
  // },
  // DEFERRED: Forge pill removed from header — post-launch
  // forgeEmoji: {
  //   fontSize: 13,
  //   lineHeight: 15,
  // },
  // DEFERRED: Forge pill removed from header — post-launch
  // forgeText: {
  //   fontFamily: typography.fonts.heading,
  //   fontSize: 11,
  //   color: colors.gold,
  // },
  titleBlock: {
    paddingTop: spacing.md,
  },
  titleBlockCompact: {
    paddingTop: spacing.sm,
  },
  eyebrow: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.forgeScreen.textMuted,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 27,
    lineHeight: 34,
    color: colors.bone,
    textShadowColor: rgba(colors.gold, 0.2),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 40,
  },
  titleCompact: {
    fontSize: 24,
    lineHeight: 28,
  },
  subtitle: {
    marginTop: spacing.sm - spacing.xs / 2,
    fontFamily: typography.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.forgeScreen.textMuted,
    fontWeight: '300',
  },
  subtitleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  supportingCopy: {
    marginTop: spacing.sm,
    fontFamily: typography.fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.forgeScreen.textMuted,
    maxWidth: 340,
  },
  intentionTag: {
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
  },
  intentionTextCompact: {
    fontSize: 12,
  },
  previewCanvas: {
    marginTop: spacing.md,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.forgeScreen.previewBorder,
    backgroundColor: colors.forgeScreen.previewSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCanvasCompact: {
    marginTop: spacing.sm + spacing.xs,
    borderRadius: 18,
  },
  previewRadialCore: {
    position: 'absolute',
    backgroundColor: rgba(colors.deepPurple, 0.28),
  },
  previewGlow: {
    position: 'absolute',
    backgroundColor: rgba(colors.gold, 0.18),
  },
  previewFlash: {
    position: 'absolute',
    inset: 0,
    backgroundColor: rgba(colors.gold, 0.18),
  },
  previewCenter: {
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
    marginTop: spacing.md + spacing.xs / 2,
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 3,
    color: colors.forgeScreen.textMuted,
    textTransform: 'uppercase',
  },
  sectionLabelCompact: {
    marginTop: spacing.sm + spacing.xs,
    fontSize: 9,
    letterSpacing: 2.5,
  },
  quoteRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  quoteBar: {
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.gold,
  },
  quoteText: {
    flex: 1,
    fontFamily: typography.fonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    color: rgba(colors.white, 0.62),
  },
  structureRow: {
    paddingTop: spacing.sm + spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  structureCardCompact: {
    paddingTop: spacing.sm + spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderRadius: 14,
  },
  structureCardSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.forgeScreen.cardSelected,
  },
  manualStructureCard: {
    borderStyle: 'dashed',
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  manualStructureCardSelected: {
    borderStyle: 'solid',
    borderColor: '#D4AF37',
    backgroundColor: rgba(colors.deepPurple, 0.28),
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
  cardIconWrapCompact: {
    width: 54,
    height: 54,
    marginBottom: spacing.xs + 1,
  },
  cardName: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    color: rgba(colors.white, 0.85),
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  cardNameCompact: {
    fontSize: 10.5,
  },
  cardTraits: {
    fontFamily: typography.fonts.body,
    fontSize: 10.5,
    lineHeight: 14,
    textAlign: 'center',
    color: rgba(colors.gold, 0.84),
    marginBottom: spacing.xs,
  },
  cardTraitsCompact: {
    fontSize: 9.5,
    lineHeight: 12,
  },
  cardDescription: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    color: colors.forgeScreen.textMuted,
  },
  cardDescriptionCompact: {
    fontSize: 9,
    lineHeight: 12,
  },
  cardTeaching: {
    fontFamily: typography.fonts.body,
    fontSize: 9.5,
    lineHeight: 13,
    textAlign: 'center',
    color: rgba(colors.white, 0.42),
    marginTop: spacing.xs,
  },
  aboutStructuresLink: {
    marginTop: spacing.lg,
    minHeight: 44,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.forgeScreen.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aboutStructuresText: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.forgeScreen.textMuted,
  },
  aboutStructuresChevron: {
    fontSize: 18,
    color: colors.gold,
    lineHeight: 18,
  },
  activeHint: {
    marginTop: spacing.sm,
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: rgba(colors.white, 0.65),
  },
  activeHintCompact: {
    fontSize: 10,
  },
  traceLink: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  traceLinkText: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: colors.gold,
    textDecorationLine: 'underline',
    textDecorationColor: colors.gold,
  },
  ctaWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  ctaGradient: {
    paddingTop: spacing.xl,
  },
  ctaGradientCompact: {
    paddingTop: spacing.lg,
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
  ctaButtonDisabled: {
    opacity: 0.42,
  },
  ctaButtonCompact: {
    height: 50,
    borderRadius: 12,
  },
  manualCtaButton: {
    backgroundColor: '#3E2C5B',
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  ctaText: {
    fontFamily: typography.fonts.heading,
    fontSize: 15,
    letterSpacing: 1,
    color: colors.forgeScreen.ctaText,
    fontWeight: '600',
  },
  manualCtaText: {
    color: '#D4AF37',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5, 8, 12, 0.72)',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  aboutSheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.charcoal,
    borderTopWidth: 1,
    borderColor: colors.forgeScreen.glassBorder,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: rgba(colors.white, 0.22),
    marginBottom: spacing.lg,
  },
  sheetEyebrow: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: colors.forgeScreen.textMuted,
  },
  sheetTitle: {
    marginTop: spacing.md,
    fontFamily: typography.fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    color: colors.bone,
  },
  sheetBody: {
    marginTop: spacing.sm,
    fontFamily: typography.fonts.body,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    color: colors.forgeScreen.textMuted,
  },
  sheetClose: {
    marginTop: spacing.lg,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.gold,
  },
});
