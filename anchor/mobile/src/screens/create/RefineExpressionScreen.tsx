import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from 'lucide-react-native';
import { safeHaptics } from '@/utils/haptics';
import type { RootStackParamList, SigilVariant } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { SigilSvg } from '@/components/common';
import { API_URL } from '@/config';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import {
  RefineBadgeView,
  RefineFeatCard,
  RefineGlyph,
  RefineHeroCard,
  RefineStyleCard,
  StructureHeroGlyph,
} from './components/RefineStyleCard';
import {
  FAMILY_FILTERS,
  REFINE_STYLES,
  RefineStyleFamily,
  RefineStyleOption,
  allStyles,
  coreStyles,
  familyStyles,
  featuredStyles,
  getRecommendedStyles,
  heroStyle,
  railStyles,
  seasonalStyles,
} from './constants/refineStyles';

type StyleSelectionRouteProp = RouteProp<RootStackParamList, 'StyleSelection'>;
type StyleSelectionNavigationProp = StackNavigationProp<RootStackParamList, 'StyleSelection'>;

type StyleSelectionParams = Partial<RootStackParamList['StyleSelection']> & {
  intention?: string;
  sigilSvg?: string;
  structureType?: string;
};

type ForwardNavigationPayload = RootStackParamList['AIGenerating'] & {
  intention: string;
  sigilSvg?: string;
  structureType?: string;
  selectedStyle: RefineStyleOption;
};

const isSigilVariant = (value: string | undefined): value is SigilVariant =>
  value === 'dense' || value === 'balanced' || value === 'minimal';

const normalizeSigilVariant = (value: string | undefined): SigilVariant =>
  isSigilVariant(value) ? value : 'balanced';

const EXPLORE_TABS = [
  { id: 'week', label: 'This Week' },
  { id: 'core', label: 'Core' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'all', label: 'All Styles →' },
] as const;

type ExploreTabId = (typeof EXPLORE_TABS)[number]['id'];

export default function RefineExpressionScreen() {
  const route = useRoute<StyleSelectionRouteProp>();
  const navigation = useNavigation<StyleSelectionNavigationProp>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const params = (route.params ?? {}) as StyleSelectionParams;
  const intention = (params.intention ?? params.intentionText ?? '').trim();
  const sigilSvg = params.sigilSvg ?? params.reinforcedSigilSvg ?? params.baseSigilSvg;
  const structureType = params.structureType ?? params.structureVariant;
  const category = params.category ?? 'custom';
  const flowDraft = useFirstAnchorFlowStore((state) => state.draft);

  const structureId = flowDraft?.structure === 'drawn'
    ? 'drawn'
    : structureType === 'dense'
      ? 'contained'
      : structureType === 'minimal'
        ? 'raw'
        : 'focused';

  const structureLabel =
    structureId === 'drawn'
      ? 'Drawn'
      : structureId === 'contained'
        ? 'Contained'
        : structureId === 'raw'
          ? 'Raw'
          : 'Focused';

  const recommendedStyles = useMemo(
    () => getRecommendedStyles(category, intention),
    [category, intention]
  );

  const [selectedStyleId, setSelectedStyleId] = useState<string>(
    recommendedStyles[0]?.id ?? featuredStyles[0]?.id ?? REFINE_STYLES[0].id
  );

  const [exploreTab, setExploreTab] = useState<ExploreTabId | null>(null);
  const [exploreFamily, setExploreFamily] = useState<RefineStyleFamily | 'All'>('All');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTeachVisible, setIsTeachVisible] = useState(false);

  const taughtRef = useRef(false);
  const teachTimer = useRef<NodeJS.Timeout | null>(null);
  const genTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (teachTimer.current) clearTimeout(teachTimer.current);
      if (genTimer.current) clearTimeout(genTimer.current);
    };
  }, []);

  const teachOpacity = useSharedValue(0);
  const teachHeight = useSharedValue(0);

  const spinRotation = useSharedValue(0);

  const selectedStyleOption = useMemo(
    () => REFINE_STYLES.find((s) => s.id === selectedStyleId) ?? REFINE_STYLES[0],
    [selectedStyleId]
  );

  // Spin animation for generating indicator
  useEffect(() => {
    if (isGenerating && !reduceMotion) {
      spinRotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      spinRotation.value = 0;
    }
  }, [isGenerating, reduceMotion, spinRotation]);

  const animatedSpinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinRotation.value}deg` }],
  }));

  const animatedTeachStyle = useAnimatedStyle(() => ({
    opacity: teachOpacity.value,
    maxHeight: teachHeight.value,
    marginTop: teachHeight.value > 0 ? 18 : 0,
  }));

  const handleStyleSelect = useCallback((style: RefineStyleOption) => {
    if (style.id === selectedStyleId) return;

    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStyleId(style.id);
    useFirstAnchorFlowStore.getState().updateDraft({ selectedStyleId: style.id });

    // First-use teaching animation trigger
    if (!taughtRef.current) {
      taughtRef.current = true;
      setIsTeachVisible(true);

      if (reduceMotion) {
        teachOpacity.value = 1;
        teachHeight.value = 60;
      } else {
        teachOpacity.value = withTiming(1, { duration: 360 });
        teachHeight.value = withTiming(60, { duration: 360 });
      }

      if (teachTimer.current) clearTimeout(teachTimer.current);
      teachTimer.current = setTimeout(() => {
        setIsTeachVisible(false);
        if (reduceMotion) {
          teachOpacity.value = 0;
          teachHeight.value = 0;
        } else {
          teachOpacity.value = withTiming(0, { duration: 300 });
          teachHeight.value = withTiming(0, { duration: 300 });
        }
      }, 2400);
    }
  }, [reduceMotion, selectedStyleId, teachHeight, teachOpacity]);

  const handleTabPress = useCallback((tabId: ExploreTabId) => {
    void safeHaptics.selection();
    setExploreTab((prev) => (prev === tabId ? null : tabId));
  }, []);

  const handleFamilyPress = useCallback((family: RefineStyleFamily | 'All') => {
    void safeHaptics.selection();
    setExploreFamily(family);
  }, []);

  const handleRefineAnchor = useCallback(() => {
    if (isGenerating) return;
    setIsGenerating(true);
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);

    // Warm Railway server before transition
    void fetch(`${API_URL}/health`).catch(() => {});

    useFirstAnchorFlowStore.getState().updateDraft({
      selectedStyleId: selectedStyleOption.id,
      generationStatus: 'generating',
    });

    const payload: ForwardNavigationPayload = {
      intention,
      sigilSvg,
      structureType,
      selectedStyle: selectedStyleOption,
      intentionText: intention,
      category,
      distilledLetters: params.distilledLetters ?? [],
      baseSigilSvg: sigilSvg ?? '',
      reinforcedSigilSvg: params.reinforcedSigilSvg,
      structureVariant: normalizeSigilVariant(params.structureVariant ?? params.structureType),
      styleChoice: selectedStyleOption.generationStyle,
      reinforcementMetadata: params.reinforcementMetadata,
    };

    const delayMs = reduceMotion ? 400 : 900;
    if (genTimer.current) clearTimeout(genTimer.current);
    genTimer.current = setTimeout(() => {
      navigation.navigate('AIGenerating', payload);
    }, delayMs);
  }, [
    category,
    intention,
    isGenerating,
    navigation,
    params.distilledLetters,
    params.reinforcementMetadata,
    params.reinforcedSigilSvg,
    params.structureType,
    params.structureVariant,
    reduceMotion,
    selectedStyleOption,
    sigilSvg,
    structureType,
  ]);

  // Card dimensions for 2-column grid
  const gridGap = 12;
  const gridPadding = spacing.lg;
  const cardWidth = Math.floor((screenWidth - gridPadding * 2 - gridGap) / 2);

  const renderStyleGrid = (stylesToRender: RefineStyleOption[], variant: 'core' | 'recommended' | 'seasonal' | 'filtered' = 'core') => {
    return (
      <View style={styles.grid}>
        {stylesToRender.map((style, index) => (
          <View key={style.id} style={{ width: cardWidth }}>
            <RefineStyleCard
              option={style}
              index={index}
              isSelected={selectedStyleId === style.id}
              onSelect={handleStyleSelect}
              variant={variant}
              structureId={structureId}
              structureLabel={structureLabel}
            />
          </View>
        ))}
      </View>
    );
  };

  const allFilteredStyles = useMemo(() => {
    if (exploreFamily === 'All') return allStyles;
    return familyStyles(exploreFamily);
  }, [exploreFamily]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Ambient background field */}
        <LinearGradient
          colors={['#18202A', '#121820', colors.anchor15.navy]}
          locations={[0, 0.44, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.atmosphericGlow} pointerEvents="none" />

        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back to Style"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={16} color={colors.anchor15.ash} strokeWidth={1.8} />
            <Text style={styles.backText}>Style</Text>
          </Pressable>

          <View style={styles.topDots} pointerEvents="none">
            <View style={styles.topDot} />
            <View style={styles.topDot} />
            <View style={styles.topDot} />
          </View>
        </View>

        {/* Scroll Body */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 140 },
          ]}
        >
          {/* Header Intro Block */}
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrow}>STYLE</Text>
            <Text style={styles.title}>Refine Style</Text>
            <Text style={styles.lead}>
              Choose how your Anchor will be visually treated during generation.
            </Text>
            <Text style={styles.microline}>Same structure. New style.</Text>
          </View>

          {/* Your Structure Continuity Hero */}
          <View style={styles.structHero}>
            <Text style={styles.structHeroLabel}>YOUR STRUCTURE</Text>
            <View style={styles.structHeroGlyph}>
              {sigilSvg ? (
                <SigilSvg xml={sigilSvg} width={104} height={104} color={colors.anchor15.gilt} />
              ) : (
                <StructureHeroGlyph id={structureId} size={104} />
              )}
            </View>
            <Text style={styles.structHeroName}>{structureLabel}</Text>
          </View>

          {/* First-Use Microteaching */}
          <Animated.View style={[styles.teachContainer, animatedTeachStyle]}>
            <Text style={styles.teachLine1}>Style changes the appearance, not the meaning.</Text>
            <Text style={styles.teachLine2}>Your structure stays the same through generation.</Text>
          </Animated.View>

          {/* Recommended Section */}
          {recommendedStyles.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHd}>
                <Text style={styles.sectionTitle}>RECOMMENDED</Text>
              </View>
              <Text style={styles.sectionSub}>Choices that work well with your structure.</Text>
              {renderStyleGrid(recommendedStyles, 'recommended')}
            </View>
          ) : null}

          {/* Explore More Section */}
          <View style={styles.section}>
            <View style={styles.sectionHd}>
              <Text style={styles.sectionTitle}>EXPLORE MORE</Text>
            </View>

            {/* Explore Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exploreTabsRow}
            >
              {EXPLORE_TABS.map((t) => {
                const isActive = exploreTab === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => handleTabPress(t.id)}
                    style={[styles.exploreTabChip, isActive && styles.exploreTabChipActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.label} tab`}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[styles.exploreTabChipText, isActive && styles.exploreTabChipTextActive]}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Explore Panels */}
            {exploreTab === 'week' ? (
              <View style={styles.explorePanel}>
                <Text style={styles.sectionSub}>A curated set of limited finishes available now.</Text>
                {heroStyle ? (
                  <RefineHeroCard
                    option={heroStyle}
                    isSelected={selectedStyleId === heroStyle.id}
                    onSelect={handleStyleSelect}
                  />
                ) : null}

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.featuredRail}
                >
                  {railStyles.map((style) => (
                    <RefineFeatCard
                      key={style.id}
                      option={style}
                      isSelected={selectedStyleId === style.id}
                      onSelect={handleStyleSelect}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {exploreTab === 'core' ? (
              <View style={styles.explorePanel}>
                <Text style={styles.sectionSub}>Permanent finishes available any time.</Text>
                {renderStyleGrid(coreStyles, 'core')}
              </View>
            ) : null}

            {exploreTab === 'seasonal' ? (
              <View style={styles.explorePanel}>
                <View style={styles.seasonalHd}>
                  <View style={styles.seasonalGlyph}>
                    <RefineGlyph name="lunar" size={24} color={colors.anchor15.gilt} />
                  </View>
                  <View style={styles.seasonalHdText}>
                    <Text style={styles.seasonalName}>Lunar Collection</Text>
                    <Text style={styles.seasonalNote}>Finishes that leave when the season turns.</Text>
                  </View>
                </View>
                {renderStyleGrid(seasonalStyles, 'seasonal')}
              </View>
            ) : null}

            {exploreTab === 'all' ? (
              <View style={styles.explorePanel}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.familyFiltersRow}
                >
                  {(['All', ...FAMILY_FILTERS] as const).map((fam) => {
                    const isFamActive = exploreFamily === fam;
                    const displayLabel = fam === 'All' ? 'All' : fam.charAt(0) + fam.slice(1).toLowerCase();
                    return (
                      <Pressable
                        key={fam}
                        onPress={() => handleFamilyPress(fam)}
                        style={[styles.familyChip, isFamActive && styles.familyChipActive]}
                        accessibilityRole="button"
                        accessibilityLabel={`${displayLabel} family filter`}
                        accessibilityState={{ selected: isFamActive }}
                      >
                        <Text style={[styles.familyChipText, isFamActive && styles.familyChipTextActive]}>
                          {displayLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {renderStyleGrid(allFilteredStyles, 'filtered')}
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* Sticky Bottom CTA Bar */}
        <View style={styles.ctaBar} pointerEvents="box-none">
          <LinearGradient
            colors={['rgba(15,20,25,0)', 'rgba(15,20,25,0.7)', colors.anchor15.navy]}
            locations={[0, 0.46, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={[styles.ctaContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.selectedRow}>
              <View style={styles.selectedSwatch} />
              <Text style={styles.selectedPrefix}>SELECTED STYLE: </Text>
              <Text style={styles.selectedValue}>{selectedStyleOption.displayName}</Text>
            </View>

            <Pressable
              onPress={handleRefineAnchor}
              disabled={isGenerating}
              accessibilityRole="button"
              accessibilityLabel="Generate Anchor"
              style={[styles.ctaButton, isGenerating && styles.ctaButtonDisabled]}
            >
              <Text style={styles.ctaButtonText}>GENERATE ANCHOR →</Text>
            </Pressable>
          </View>
        </View>

        {/* Generation Transition Overlay */}
        {isGenerating ? (
          <View style={styles.generationOverlay}>
            <View style={styles.genComboRow}>
              <Text style={styles.genComboText}>{structureLabel}</Text>
              <Text style={styles.genComboSep}>·</Text>
              <Text style={styles.genComboText}>{selectedStyleOption.displayName}</Text>
            </View>

            <Text style={styles.genArrow}>↓</Text>

            <View style={styles.genCreatingRow}>
              <Animated.View style={[styles.genRing, animatedSpinStyle]} />
              <Text style={styles.genCreatingText}>CREATING YOUR ANCHOR</Text>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.anchor15.navy,
  },
  container: {
    flex: 1,
    backgroundColor: colors.anchor15.navy,
  },
  atmosphericGlow: {
    position: 'absolute',
    top: -140,
    left: -90,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(217, 179, 108, 0.075)',
  },

  // Top Bar
  topBar: {
    height: 44,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
    paddingRight: 12,
  },
  backText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    color: colors.anchor15.ash,
  },
  topDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 44,
    height: 44,
    justifyContent: 'flex-end',
  },
  topDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.anchor15.ash,
  },

  // Scroll Body
  scrollContent: {
    paddingTop: 14,
  },

  // Header Block
  headerBlock: {
    paddingHorizontal: spacing.lg,
  },
  eyebrow: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2.2,
    color: colors.anchor15.ash,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '600',
    color: colors.anchor15.bone,
    letterSpacing: 0.28,
    marginTop: 8,
  },
  lead: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 17,
    lineHeight: 24,
    color: 'rgba(244, 239, 230, 0.68)',
    marginTop: 10,
    maxWidth: 320,
  },
  microline: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.58,
    color: colors.anchor15.gilt,
    textTransform: 'uppercase',
    marginTop: 18,
  },

  // Your Structure Hero
  structHero: {
    marginTop: 26,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  structHeroLabel: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.89,
    color: colors.anchor15.ash,
    textTransform: 'uppercase',
  },
  structHeroGlyph: {
    width: 148,
    height: 148,
    borderRadius: 74,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.22)',
    backgroundColor: '#141D24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  structHeroName: {
    marginTop: 14,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.92,
    color: colors.anchor15.giltBright,
    textTransform: 'uppercase',
  },

  // First-Use Microteaching
  teachContainer: {
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
    alignItems: 'center',
  },
  teachLine1: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: colors.anchor15.giltBright,
    letterSpacing: 0.26,
    textAlign: 'center',
  },
  teachLine2: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11.5,
    color: colors.anchor15.ash,
    marginTop: 4,
    textAlign: 'center',
  },

  // Sections
  section: {
    marginTop: 32,
  },
  sectionHd: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: colors.anchor15.bone,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionSub: {
    paddingHorizontal: spacing.lg,
    paddingTop: 6,
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(244, 239, 230, 0.55)',
    maxWidth: 330,
  },

  // 2-Column Grid
  grid: {
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // Explore Tabs
  exploreTabsRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    gap: 20,
  },
  exploreTabChip: {
    paddingBottom: 7,
    borderBottomWidth: 1.5,
    borderBottomColor: 'transparent',
  },
  exploreTabChipActive: {
    borderBottomColor: colors.anchor15.gilt,
  },
  exploreTabChipText: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.43,
    color: colors.anchor15.ash,
    textTransform: 'uppercase',
  },
  exploreTabChipTextActive: {
    color: colors.anchor15.giltBright,
  },
  explorePanel: {
    marginTop: 6,
  },

  // Featured Rail
  featuredRail: {
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 12,
  },

  // Seasonal Panel
  seasonalHd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: spacing.lg,
    marginTop: 16,
  },
  seasonalGlyph: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seasonalHdText: {
    gap: 1,
  },
  seasonalName: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.75,
    color: colors.anchor15.bone,
  },
  seasonalNote: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 12.5,
    color: colors.anchor15.ash,
  },

  // Family Filters Row
  familyFiltersRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    gap: 16,
  },
  familyChip: {
    paddingBottom: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: 'transparent',
  },
  familyChipActive: {
    borderBottomColor: colors.anchor15.gilt,
  },
  familyChipText: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.2,
    color: colors.anchor15.ash,
    textTransform: 'uppercase',
  },
  familyChipTextActive: {
    color: colors.anchor15.giltBright,
  },

  // Sticky Bottom CTA Bar
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingTop: 36,
  },
  ctaContent: {
    paddingHorizontal: spacing.lg,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  selectedSwatch: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.anchor15.gilt,
    shadowColor: colors.anchor15.gilt,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 2,
  },
  selectedPrefix: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    letterSpacing: 0.88,
    color: colors.anchor15.ash,
    textTransform: 'uppercase',
  },
  selectedValue: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.39,
    color: colors.anchor15.giltBright,
  },
  ctaButton: {
    width: '100%',
    height: 54,
    borderRadius: 999,
    backgroundColor: 'rgba(217, 179, 108, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaButtonText: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2.24,
    color: colors.anchor15.giltBright,
    textTransform: 'uppercase',
  },

  // Generation Transition Overlay
  generationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 16, 21, 0.94)',
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  genComboRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  genComboText: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: colors.anchor15.giltBright,
    textTransform: 'uppercase',
  },
  genComboSep: {
    color: 'rgba(217, 179, 108, 0.34)',
    fontSize: 16,
  },
  genArrow: {
    fontSize: 18,
    color: 'rgba(217, 179, 108, 0.34)',
  },
  genCreatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  genRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(217, 179, 108, 0.34)',
    borderTopColor: colors.anchor15.gilt,
  },
  genCreatingText: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.92,
    color: colors.anchor15.ash,
    textTransform: 'uppercase',
  },
});
