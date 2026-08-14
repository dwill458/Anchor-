import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { RootStackParamList } from '@/types';
import { colors, typography } from '@/theme';
import { SigilSvg, ZenBackground } from '@/components/common';
import { MicroTeachInline } from '@/components/teaching';
import { BackChevronIcon, CloseIcon } from '@/components/icons';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { generateAllVariants, SigilGenerationResult, SigilVariant } from '@/utils/sigil/traditional-generator';
import { classifyToTierPreliminary } from '@/utils/tierClassifier';
import { isCompactPhoneViewport } from '@/utils/layout';
import { useFirstAnchorFlowStore, type FirstAnchorStructure } from '@/stores/firstAnchorFlowStore';

type StructureType = 'focused' | 'ritual' | 'raw';
type StructureCardType = StructureType | 'drawn';

type StructureForgeRouteProp = RouteProp<RootStackParamList, 'StructureForge'>;
type StructureForgeNavigationProp = StackNavigationProp<RootStackParamList, 'StructureForge'>;

const gilt = colors.anchor15.gilt;
const giltBright = colors.anchor15.giltBright;
const ash = colors.anchor15.ash;
const bone = colors.anchor15.bone;
const boneSoft = 'rgba(244, 239, 230, 0.68)';
const boneFaint = 'rgba(244, 239, 230, 0.42)';
const goldLine = colors.anchor15.goldLine;
const hairlineGold = colors.anchor15.hairlineGold;
const hairline = colors.anchor15.hairline;

const CARD_GAP = 12;

const STRUCTURE_VARIANT_MAP = {
  focused: 'balanced',
  ritual: 'dense',
  raw: 'minimal',
} as const;

const DRAWN_ICON_XML = `
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 48L18.6 38.4L38.5 18.5C40.3 16.7 43.2 16.7 45 18.5L45.5 19C47.3 20.8 47.3 23.7 45.5 25.5L25.6 45.4L16 48Z" stroke="#D9B36C" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M34 23L41 30" stroke="#D9B36C" stroke-width="3" stroke-linecap="round"/>
    <path d="M22 15C25 11.8 28.6 10.2 32.8 10.2C37.1 10.2 40.9 12.3 44.2 16.4" stroke="#D9B36C" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 5"/>
    <path d="M14 54C20.8 49.3 28.4 47 36.8 47C42.3 47 47.4 47.9 52 49.8" stroke="#D9B36C" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 5"/>
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

// ── Morph preview — the same layered vocabulary (rings / boundary / triangle /
// center dot / drawn path) cross-fades between structures instead of swapping
// a static icon. Only opacity + numeric SVG attrs are animated (no transform),
// which keeps it safe on both platforms.
type PreviewKey = StructureCardType | 'none';

type PreviewState = {
  ringsOpacity: number;
  boundaryOpacity: number;
  boundaryScale: number;
  boundaryWidth: number;
  triangleOpacity: number;
  dotOpacity: number;
  drawnOpacity: number;
};

const PREVIEW_STATES: Record<PreviewKey, PreviewState> = {
  focused: { ringsOpacity: 0.5, boundaryOpacity: 0, boundaryScale: 0.85, boundaryWidth: 2, triangleOpacity: 1, dotOpacity: 1, drawnOpacity: 0 },
  ritual: { ringsOpacity: 0, boundaryOpacity: 0.65, boundaryScale: 1, boundaryWidth: 4.5, triangleOpacity: 1, dotOpacity: 1, drawnOpacity: 0 },
  raw: { ringsOpacity: 0.12, boundaryOpacity: 0, boundaryScale: 1.16, boundaryWidth: 1.5, triangleOpacity: 1, dotOpacity: 0.28, drawnOpacity: 0 },
  drawn: { ringsOpacity: 0, boundaryOpacity: 0, boundaryScale: 1, boundaryWidth: 2, triangleOpacity: 0, dotOpacity: 0, drawnOpacity: 1 },
  none: { ringsOpacity: 0.22, boundaryOpacity: 0, boundaryScale: 1, boundaryWidth: 2, triangleOpacity: 0, dotOpacity: 0, drawnOpacity: 0 },
};

// Triangle vertices scaled around the 100,100 center per structure — precomputed
// so the shape reads correctly the instant a structure is selected while
// opacity still animates the actual cross-fade.
const TRIANGLE_D: Record<StructureType, string> = {
  focused: 'M58 62 L142 62 L72 148',
  ritual: 'M67.24 70.36 L132.76 70.36 L78.16 137.44',
  raw: 'M49.6 54.4 L150.4 54.4 L66.4 157.6',
};

const DRAWN_PATH_D = 'M55 145 L125 75 L145 95 L75 165 L52 168 Z';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

function MorphPreview({ active, size, reduceMotion }: { active: PreviewKey; size: number; reduceMotion: boolean }) {
  const target = PREVIEW_STATES[active];
  const ringsOpacity = useSharedValue(target.ringsOpacity);
  const boundaryOpacity = useSharedValue(target.boundaryOpacity);
  const boundaryR = useSharedValue(90 * target.boundaryScale);
  const boundaryWidth = useSharedValue(target.boundaryWidth);
  const triangleOpacity = useSharedValue(target.triangleOpacity);
  const dotOpacity = useSharedValue(target.dotOpacity);
  const drawnOpacity = useSharedValue(target.drawnOpacity);

  useEffect(() => {
    const cfg = { duration: reduceMotion ? 0 : 550, easing: Easing.out(Easing.cubic) };
    ringsOpacity.value = withTiming(target.ringsOpacity, cfg);
    boundaryOpacity.value = withTiming(target.boundaryOpacity, cfg);
    boundaryR.value = withTiming(90 * target.boundaryScale, cfg);
    boundaryWidth.value = withTiming(target.boundaryWidth, cfg);
    triangleOpacity.value = withTiming(target.triangleOpacity, cfg);
    dotOpacity.value = withTiming(target.dotOpacity, cfg);
    drawnOpacity.value = withTiming(target.drawnOpacity, cfg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduceMotion]);

  const ringsProps = useAnimatedProps(() => ({ opacity: ringsOpacity.value }));
  const boundaryProps = useAnimatedProps(() => ({
    opacity: boundaryOpacity.value,
    r: boundaryR.value,
    strokeWidth: boundaryWidth.value,
  }));
  const triangleProps = useAnimatedProps(() => ({ opacity: triangleOpacity.value }));
  const dotProps = useAnimatedProps(() => ({ opacity: dotOpacity.value }));
  const drawnProps = useAnimatedProps(() => ({ opacity: drawnOpacity.value }));

  const triangleKey: StructureType = active === 'ritual' || active === 'raw' ? active : 'focused';

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <AnimatedG animatedProps={ringsProps}>
        {[20, 35, 50, 65, 80].map((r) => (
          <Circle key={r} cx={100} cy={100} r={r} stroke={gilt} strokeWidth={0.8} />
        ))}
      </AnimatedG>
      <AnimatedCircle cx={100} cy={100} stroke={gilt} animatedProps={boundaryProps} />
      <AnimatedPath
        d={TRIANGLE_D[triangleKey]}
        stroke={giltBright}
        strokeWidth={6.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        animatedProps={triangleProps}
      />
      <AnimatedCircle cx={100} cy={100} r={13} stroke={gilt} strokeWidth={1.8} animatedProps={dotProps} />
      <AnimatedPath
        d={DRAWN_PATH_D}
        stroke={giltBright}
        strokeWidth={4}
        strokeDasharray="6 7"
        strokeLinecap="round"
        strokeLinejoin="round"
        animatedProps={drawnProps}
      />
    </Svg>
  );
}

export default function StructureForgeScreen() {
  const navigation = useNavigation<StructureForgeNavigationProp>();
  const route = useRoute<StructureForgeRouteProp>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotionEnabled();

  const { intentionText, category, distilledLetters } = route.params;
  const traceDefaultEnabled = useSettingsStore((state) => state.traceDefaultEnabled ?? true);
  const intention = (route.params as RootStackParamList['StructureForge'] & { intention?: string }).intention
    ?? intentionText;
  const isCompactLayout = isCompactPhoneViewport(width, height);
  const horizontalPadding = isCompactLayout ? 22 : 28;

  const structureTeaching = useTeachingGate({
    screenId: 'structure_forge',
    candidateIds: ['structure_forge_first_time_v1'],
  });

  const structureCardWidth = (width - horizontalPadding * 2 - CARD_GAP) / 2;
  const previewSize = isCompactLayout ? 132 : 150;
  const previewCanvasHeight = isCompactLayout ? 190 : 210;

  // Selection is explicit, but a resumed first-anchor draft should restore the
  // user's last choice instead of making them repeat it.
  const savedStructure = useFirstAnchorFlowStore((state) => state.draft?.structure);
  const [selectedStructure, setSelectedStructure] = useState<StructureCardType | null>(null);
  const [teachingId, setTeachingId] = useState<StructureCardType | null>(null);
  const [showAboutStructures, setShowAboutStructures] = useState(false);
  const previewFlashOpacity = useSharedValue(0);
  const teachZoneProgress = useSharedValue(0); // 0 = teach label, 1 = selected caption
  const teachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draftToCard: Record<FirstAnchorStructure, StructureCardType> = {
    balanced: 'focused',
    compact: 'ritual',
    minimal: 'raw',
    drawn: 'drawn',
  };

  useEffect(() => {
    if (savedStructure) {
      setSelectedStructure(draftToCard[savedStructure]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedStructure]);

  useEffect(() => () => {
    if (teachTimerRef.current) clearTimeout(teachTimerRef.current);
  }, []);

  useEffect(() => {
    teachZoneProgress.value = withTiming(teachingId ? 0 : 1, {
      duration: reduceMotion ? 0 : 350,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teachingId, reduceMotion]);

  const { tier } = classifyToTierPreliminary(intention);

  const variants = useMemo<SigilGenerationResult[]>(
    () => generateAllVariants(distilledLetters, tier),
    [distilledLetters, tier]
  );

  const previewFlashStyle = useAnimatedStyle(() => ({
    opacity: previewFlashOpacity.value,
  }));
  const teachLabelStyle = useAnimatedStyle(() => ({ opacity: 1 - teachZoneProgress.value }));
  const selectedCaptionStyle = useAnimatedStyle(() => ({ opacity: teachZoneProgress.value }));

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

  const isManualStructureSelected = selectedConfig?.isManual === true;

  const handleSelectStructure = (structure: StructureCardType) => {
    const isNewSelection = structure !== selectedStructure;
    setSelectedStructure(structure);
    const selectedDraftStructure: FirstAnchorStructure = structure === 'focused'
      ? 'balanced'
      : structure === 'ritual'
        ? 'compact'
        : structure === 'raw'
          ? 'minimal'
          : 'drawn';
    useFirstAnchorFlowStore.getState().updateDraft({ structure: selectedDraftStructure });

    if (isNewSelection) {
      setTeachingId(structure);
      previewFlashOpacity.value = reduceMotion
        ? 0
        : withSequence(
          withTiming(0.85, { duration: 130 }),
          withTiming(0, { duration: 470 })
        );
      if (teachTimerRef.current) clearTimeout(teachTimerRef.current);
      teachTimerRef.current = setTimeout(() => setTeachingId(null), 1800);
    }
  };

  const navigateToTraceStructure = () => {
    if (!selectedStructure || !selectedConfig || isManualStructureSelected) return;
    const selectedVariantSvg = getStructureIconXml(selectedConfig);

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

    const selectedVariantSvg = getStructureIconXml(selectedConfig);
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

  const morphActive: PreviewKey = selectedStructure ?? 'none';

  return (
    <View style={styles.container}>
      <ZenBackground variant="sanctuary" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <BackChevronIcon size={16} color={boneSoft} />
          </Pressable>
          <Text style={styles.stepTag}>Step 2 of 2</Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 140 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contextPill}>
            <Text style={styles.contextPillTag}>Anchoring</Text>
            <View style={styles.contextPillSep} />
            <Text style={styles.contextPillText} numberOfLines={1}>
              &ldquo;{intention}&rdquo;
            </Text>
          </View>

          <View style={styles.textZone}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowRule} />
              <Text style={styles.eyebrow}>Structure</Text>
            </View>
            <Text style={styles.title}>Choose your structure</Text>
            <Text style={styles.body}>Choose how your Anchor takes form.</Text>
            <Text style={styles.headerTeach}>
              Structure changes the form, not the intention. There is no stronger choice.
            </Text>
            <MicroTeachInline teaching={structureTeaching} screenId="structure_forge" />
          </View>

          <View style={[styles.previewCard, { height: previewCanvasHeight }]}>
            <View style={styles.previewGlow} pointerEvents="none" />
            <Animated.View style={[styles.previewFlash, previewFlashStyle]} pointerEvents="none" />
            <MorphPreview active={morphActive} size={previewSize} reduceMotion={reduceMotion} />
            <Text style={styles.previewTag}>Preview</Text>
          </View>

          <View style={styles.quoteLine}>
            <View style={styles.quoteBar} />
            <Text style={styles.quoteText}>Choose the form that can hold focus, not decoration.</Text>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionEyebrow}>Available structures</Text>
            <Pressable
              style={styles.aboutToggle}
              onPress={() => setShowAboutStructures(true)}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="About structures"
            >
              <Text style={styles.aboutToggleText}>About structures</Text>
              <View style={styles.principlesQ}>
                <Text style={styles.principlesQText}>?</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.structureGrid}>
            {STRUCTURES.map((structure) => {
              const isSelected = structure.type === selectedStructure;
              const cardIconXml = getStructureIconXml(structure);
              const isManualStructure = structure.isManual === true;
              return (
                <Pressable
                  key={structure.type}
                  style={[
                    styles.structureCard,
                    { width: structureCardWidth },
                    isManualStructure && styles.structureCardDashed,
                    isSelected && styles.structureCardActive,
                  ]}
                  onPress={() => handleSelectStructure(structure.type)}
                  accessibilityRole="button"
                  accessibilityLabel={`${structure.label} structure`}
                  accessibilityState={{ selected: isSelected }}
                >
                  {isSelected && (
                    <View style={styles.structureCheck}>
                      <Text style={styles.structureCheckText}>✓</Text>
                    </View>
                  )}

                  <View style={styles.structureIconWrap}>
                    {cardIconXml ? (
                      <SigilSvg
                        xml={cardIconXml}
                        width={isCompactLayout ? 44 : 52}
                        height={isCompactLayout ? 44 : 52}
                        color={isSelected ? giltBright : gilt}
                      />
                    ) : null}
                  </View>

                  <Text style={[styles.structureName, isSelected && styles.structureNameActive]}>
                    {structure.label}
                  </Text>
                  <Text style={[styles.structureDesc, isSelected && styles.structureDescActive]}>
                    {structure.traits}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.teachZone}>
            {selectedConfig && (
              <>
                <Animated.View style={[styles.teachLabelWrap, teachLabelStyle]} pointerEvents="none">
                  <Text style={styles.teachLabel}>
                    <Text style={styles.teachLabelName}>{selectedConfig.label}</Text>
                    <Text style={styles.teachLabelSep}> &middot; </Text>
                    {selectedConfig.teaching}
                  </Text>
                </Animated.View>
                <Animated.View style={[styles.selectedCaptionWrap, selectedCaptionStyle]} pointerEvents="none">
                  <Text style={styles.selectedCaption}>{`${selectedConfig.label} selected`}</Text>
                </Animated.View>
              </>
            )}
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 18 }]}>
          <Pressable
            onPress={handleBeginForging}
            disabled={!selectedConfig}
            style={({ pressed }) => [
              styles.nextBtn,
              !selectedConfig && styles.nextBtnDisabled,
              pressed && !!selectedConfig && styles.nextBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isManualStructureSelected ? 'Draw Your Anchor' : 'Continue'}
            accessibilityState={{ disabled: !selectedConfig }}
          >
            <Text style={styles.nextBtnText}>
              {isManualStructureSelected ? 'Draw Your Anchor →' : 'Continue →'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <Modal
        visible={showAboutStructures}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAboutStructures(false)}
        accessibilityViewIsModal
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setShowAboutStructures(false)}
          accessibilityLabel="Dismiss"
        >
          <Pressable style={{ width: '100%' }} onPress={(event) => event.stopPropagation()}>
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 40 }]}>
              <View style={styles.sheetHandle} />
              <Pressable
                onPress={() => setShowAboutStructures(false)}
                hitSlop={8}
                style={styles.sheetClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <CloseIcon size={12} color={boneFaint} />
              </Pressable>
              <Text style={styles.sheetTitle}>About Structure</Text>

              <View style={[styles.sheetItem, styles.sheetItemFirst]}>
                <Text style={styles.sheetItemTitle}>
                  Structure determines how the source material is arranged into your Anchor. It changes the visual language, not the intention behind it.
                </Text>
              </View>

              {STRUCTURES.map((structure) => (
                <View key={structure.type} style={styles.sheetItem}>
                  <Text style={styles.sheetItemLabel}>{structure.label}</Text>
                  <Text style={styles.sheetItemTitle}>{structure.description}</Text>
                </View>
              ))}

              <View style={styles.sheetQuoteLine}>
                <View style={styles.quoteBar} />
                <Text style={styles.quoteText}>
                  There is no correct structure. Choose the one you want to return to.
                </Text>
              </View>

              <Pressable
                onPress={() => setShowAboutStructures(false)}
                style={({ pressed }) => [styles.sheetDismiss, pressed && styles.nextBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Got it"
              >
                <Text style={styles.sheetDismissText}>Got it</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.anchor15.navy,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hairlineGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    borderColor: goldLine,
  },
  stepTag: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2,
    color: ash,
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  contextPill: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: 'rgba(244, 239, 230, 0.03)',
  },
  contextPillTag: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.8,
    color: gilt,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  contextPillSep: {
    width: 1,
    height: 12,
    backgroundColor: hairline,
    marginHorizontal: 10,
  },
  contextPillText: {
    flexShrink: 1,
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontSize: 14,
    color: boneSoft,
  },
  textZone: {
    marginTop: 18,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  eyebrowRule: {
    width: 20,
    height: 1,
    backgroundColor: goldLine,
  },
  eyebrow: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2.2,
    color: ash,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontWeight: '500',
    fontSize: 25,
    lineHeight: 32,
    color: bone,
    letterSpacing: 0.15,
    marginBottom: 14,
  },
  body: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 16,
    color: boneSoft,
    lineHeight: 25.6,
  },
  headerTeach: {
    marginTop: 12,
    maxWidth: '92%',
    fontFamily: typography.fontFamily.instrument,
    fontSize: 12.5,
    lineHeight: 19.4,
    color: ash,
  },
  previewCard: {
    marginTop: 20,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: 'rgba(15, 20, 25, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.anchor15.steel,
    opacity: 0.55,
  },
  previewFlash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    backgroundColor: rgba(gilt, 0.4),
  },
  previewTag: {
    position: 'absolute',
    bottom: 14,
    right: 18,
    fontFamily: typography.fontFamily.ritual,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2.2,
    color: 'rgba(217, 179, 108, 0.55)',
    textTransform: 'uppercase',
  },
  quoteLine: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  quoteBar: {
    width: 2,
    minHeight: 18,
    borderRadius: 2,
    backgroundColor: gilt,
    flexShrink: 0,
  },
  quoteText: {
    flex: 1,
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 19.6,
    color: boneSoft,
  },
  sectionHeaderRow: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionEyebrow: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 2.31,
    color: ash,
    textTransform: 'uppercase',
  },
  aboutToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 24,
  },
  aboutToggleText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 11,
    color: ash,
  },
  principlesQ: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principlesQText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 10,
    color: gilt,
  },
  structureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  structureCard: {
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(244, 239, 230, 0.08)',
    backgroundColor: 'rgba(244, 239, 230, 0.03)',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  structureCardDashed: {
    borderStyle: 'dashed',
    borderColor: 'rgba(244, 239, 230, 0.16)',
    opacity: 0.72,
  },
  structureCardActive: {
    borderStyle: 'solid',
    borderColor: rgba(gilt, 0.5),
    backgroundColor: rgba(gilt, 0.09),
    opacity: 1,
  },
  structureCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: gilt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  structureCheckText: {
    fontFamily: typography.fontFamily.instrumentSemiBold,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    color: colors.anchor15.navy,
  },
  structureIconWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  structureName: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: boneFaint,
    textAlign: 'center',
  },
  structureNameActive: {
    color: gilt,
  },
  structureDesc: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 17.5,
    textAlign: 'center',
    color: boneFaint,
  },
  structureDescActive: {
    color: boneSoft,
  },
  teachZone: {
    height: 32,
    marginTop: 16,
    marginBottom: 4,
  },
  teachLabelWrap: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teachLabel: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 13,
    color: boneSoft,
    textAlign: 'center',
  },
  teachLabelName: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.8,
    color: giltBright,
    textTransform: 'uppercase',
  },
  teachLabelSep: {
    color: ash,
  },
  selectedCaptionWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCaption: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 13,
    color: boneSoft,
    textAlign: 'center',
  },
  bottomBar: {
    paddingHorizontal: 28,
    paddingTop: 18,
    alignItems: 'center',
  },
  nextBtn: {
    width: '100%',
    height: 56,
    borderRadius: 999,
    backgroundColor: 'rgba(217, 179, 108, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnPressed: {
    backgroundColor: 'rgba(217, 179, 108, 0.16)',
    borderColor: 'rgba(217, 179, 108, 0.48)',
  },
  nextBtnDisabled: {
    opacity: 0.36,
  },
  nextBtnText: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 2.52,
    color: giltBright,
    textTransform: 'uppercase',
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(6, 9, 13, 0.7)',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: goldLine,
    backgroundColor: colors.anchor15.veil,
    paddingHorizontal: 26,
    paddingTop: 14,
    maxHeight: '86%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(244, 239, 230, 0.18)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetClose: {
    position: 'absolute',
    top: 14,
    right: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hairlineGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 11,
    letterSpacing: 2.42,
    textTransform: 'uppercase',
    color: ash,
    textAlign: 'center',
    marginBottom: 18,
  },
  sheetItem: {
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: hairlineGold,
  },
  sheetItemFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  sheetItemLabel: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.2,
    color: gilt,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  sheetItemTitle: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 22.7,
    color: bone,
  },
  sheetQuoteLine: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  sheetDismiss: {
    width: '100%',
    height: 48,
    borderRadius: 999,
    marginTop: 22,
    backgroundColor: 'rgba(217, 179, 108, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetDismissText: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 2.08,
    color: giltBright,
    textTransform: 'uppercase',
  },
});
