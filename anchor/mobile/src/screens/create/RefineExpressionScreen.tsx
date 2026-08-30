import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, LockKeyhole, Sparkles } from 'lucide-react-native';
import { safeHaptics } from '@/utils/haptics';
import type { RootStackParamList, SigilVariant } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground } from '@/components/common';
import { API_URL } from '@/config';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import { RefineStyleCard } from './components/RefineStyleCard';
import {
  REFINE_STYLE_FILTERS,
  REFINE_STYLES,
  coreStyles,
  featuredStyles,
  getFilteredStyles,
  getRecommendedStyles,
  seasonalStyles,
  type RefineStyleFilter,
  type RefineStyleOption,
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

const FILTERED_SECTION_COPY = 'Showing finishes that match the selected library view.';

const isSigilVariant = (value: string | undefined): value is SigilVariant =>
  value === 'dense' || value === 'balanced' || value === 'minimal';

const normalizeSigilVariant = (value: string | undefined): SigilVariant =>
  isSigilVariant(value) ? value : 'balanced';

const getAmbientStyle = (style: RefineStyleOption) => {
  if (style.paletteLane.includes('aurora')) return 'rgba(92, 72, 154, 0.08)';
  if (style.paletteLane.includes('ember') || style.paletteLane.includes('solar')) return 'rgba(212, 123, 55, 0.06)';
  if (style.paletteLane.includes('moon') || style.paletteLane.includes('silver')) return 'rgba(150, 142, 186, 0.07)';
  if (style.paletteLane.includes('gold')) return 'rgba(212, 175, 55, 0.05)';
  if (style.category === 'Organic') return 'rgba(70, 84, 78, 0.05)';
  if (style.category === 'Geometric' || style.category === 'Minimal') return 'rgba(245, 245, 220, 0.035)';

  return 'rgba(62, 44, 91, 0.07)';
};

const SectionHeader = ({
  title,
  copy,
  meta,
  seasonal,
}: {
  title: string;
  copy: string;
  meta?: string;
  seasonal?: boolean;
}) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, seasonal && styles.sectionTitleSeasonal]}>{title}</Text>
      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
    </View>
    <Text style={styles.sectionCopy}>{copy}</Text>
  </View>
);

export default function RefineExpressionScreen() {
  const route = useRoute<StyleSelectionRouteProp>();
  const navigation = useNavigation<StyleSelectionNavigationProp>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const params = (route.params ?? {}) as StyleSelectionParams;
  const intention = (params.intention ?? params.intentionText ?? '').trim();
  const sigilSvg = params.sigilSvg ?? params.reinforcedSigilSvg ?? params.baseSigilSvg;
  const structureType = params.structureType ?? params.structureVariant;
  const category = params.category ?? 'custom';

  const recommendedStyles = useMemo(
    () => getRecommendedStyles(category, intention),
    [category, intention]
  );

  const [selectedStyleId, setSelectedStyleId] = useState(
    recommendedStyles[0]?.id ?? featuredStyles[0]?.id ?? REFINE_STYLES[0].id
  );
  const [activeFilter, setActiveFilter] = useState<RefineStyleFilter>('all');
  const [ambientColor, setAmbientColor] = useState(getAmbientStyle(recommendedStyles[0] ?? featuredStyles[0]));

  const ambientOpacity = useSharedValue(1);
  const ctaTextOpacity = useSharedValue(1);

  const selectedStyleOption = useMemo(
    () => REFINE_STYLES.find((style) => style.id === selectedStyleId) ?? REFINE_STYLES[0],
    [selectedStyleId]
  );

  const filteredStyles = useMemo(() => getFilteredStyles(activeFilter), [activeFilter]);
  const isFilteredView = activeFilter !== 'all';
  const filteredIds = useMemo(() => new Set(filteredStyles.map((style) => style.id)), [filteredStyles]);

  const visibleFeaturedStyles = useMemo(
    () => (isFilteredView ? featuredStyles.filter((style) => filteredIds.has(style.id)) : featuredStyles),
    [filteredIds, isFilteredView]
  );

  const visibleRecommendedStyles = useMemo(
    () => (isFilteredView ? recommendedStyles.filter((style) => filteredIds.has(style.id)) : recommendedStyles),
    [filteredIds, isFilteredView, recommendedStyles]
  );

  const visibleCoreStyles = useMemo(
    () => (isFilteredView ? coreStyles.filter((style) => filteredIds.has(style.id)) : coreStyles),
    [filteredIds, isFilteredView]
  );

  const visibleSeasonalStyles = useMemo(
    () => (isFilteredView ? seasonalStyles.filter((style) => filteredIds.has(style.id)) : seasonalStyles),
    [filteredIds, isFilteredView]
  );

  const hasVisibleSections =
    visibleFeaturedStyles.length > 0 ||
    visibleRecommendedStyles.length > 0 ||
    visibleCoreStyles.length > 0 ||
    visibleSeasonalStyles.length > 0;

  const gridGap = spacing.sm;
  const gridCardWidth = Math.floor((screenWidth - spacing.lg * 2 - gridGap) / 2);
  const seasonalCardWidth = Math.floor((screenWidth - spacing.lg * 2 - spacing.md * 2 - gridGap) / 2);
  const featuredCardWidth = Math.min(286, Math.max(238, screenWidth * 0.72));
  const recommendedCardWidth = Math.min(244, Math.max(212, screenWidth * 0.58));

  const ambientAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ambientOpacity.value,
  }));

  const ctaTextAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ctaTextOpacity.value,
  }));

  useEffect(() => {
    ambientOpacity.value = withTiming(0, { duration: 120 });
    ctaTextOpacity.value = withTiming(0, { duration: 90 });

    const timeout = setTimeout(() => {
      setAmbientColor(getAmbientStyle(selectedStyleOption));
      ambientOpacity.value = withTiming(1, { duration: 360, easing: Easing.inOut(Easing.ease) });
      ctaTextOpacity.value = withTiming(1, { duration: 180 });
    }, 100);

    return () => clearTimeout(timeout);
  }, [ambientOpacity, ctaTextOpacity, selectedStyleOption]);

  const handleStyleSelect = useCallback((style: RefineStyleOption) => {
    if (style.id === selectedStyleId) return;

    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStyleId(style.id);
    useFirstAnchorFlowStore.getState().updateDraft({ selectedStyleId: style.id });
  }, [selectedStyleId]);

  const handleRefineAnchor = useCallback(() => {
    // Wake Railway before the real request arrives so cold-start latency does not
    // block the AI call that fires shortly after navigation.
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

    navigation.navigate('AIGenerating', payload);
  }, [
    category,
    intention,
    navigation,
    params.distilledLetters,
    params.reinforcementMetadata,
    params.reinforcedSigilSvg,
    params.structureType,
    params.structureVariant,
    selectedStyleOption,
    sigilSvg,
    structureType,
  ]);

  const renderGrid = useCallback(
    (stylesToRender: RefineStyleOption[], variant: 'core' | 'seasonal' | 'filtered' = 'core') => {
      const renderCard = (style: RefineStyleOption, index: number) => (
        <View key={style.id} style={[styles.gridItem, { width: variant === 'seasonal' ? seasonalCardWidth : gridCardWidth }]}>
          <RefineStyleCard
            option={style}
            index={index}
            isSelected={selectedStyleId === style.id}
            onSelect={handleStyleSelect}
            variant={variant}
          />
        </View>
      );

      if (variant === 'seasonal') {
        const seasonalRows: RefineStyleOption[][] = [];

        for (let index = 0; index < stylesToRender.length; index += 2) {
          seasonalRows.push(stylesToRender.slice(index, index + 2));
        }

        return (
          <View style={styles.seasonalGrid}>
            {seasonalRows.map((row, rowIndex) => (
              <View key={`seasonal-row-${rowIndex}`} style={styles.seasonalRow}>
                {row.map((style, columnIndex) => renderCard(style, rowIndex * 2 + columnIndex))}
                {row.length === 1 ? <View style={[styles.gridItem, { width: seasonalCardWidth }]} /> : null}
              </View>
            ))}
          </View>
        );
      }

      return <View style={styles.grid}>{stylesToRender.map(renderCard)}</View>;
    },
    [gridCardWidth, handleStyleSelect, seasonalCardWidth, selectedStyleId]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <ZenBackground variant="creation" orbOpacity={0.1} animationDuration={800} />

        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: ambientColor },
            ambientAnimatedStyle,
          ]}
        />

        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={18} color={colors.gold} strokeWidth={1.8} />
          </Pressable>
          <Text style={styles.eyebrow}>EMBELLISH</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 196 },
          ]}
        >
          <View style={styles.introBlock}>
            <Text style={styles.title}>Refine Expression</Text>
            <Text style={styles.primaryCopy}>Adjust the finish. The structure remains unchanged.</Text>
            <Text style={styles.secondaryCopy}>
              Styles change the finish, not the meaning. Choose what holds your attention.
            </Text>

            <View style={styles.lockNote}>
              <LockKeyhole size={12} color="rgba(212, 175, 55, 0.72)" strokeWidth={1.8} />
              <Text style={styles.lockText}>Structure locked • visual refinement only</Text>
            </View>
          </View>

          <View style={styles.libraryCount}>
            <Sparkles size={13} color={colors.gold} strokeWidth={1.7} />
            <Text style={styles.libraryCountText}>{REFINE_STYLES.length} launch styles</Text>
          </View>

          {!isFilteredView && visibleFeaturedStyles.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="This Week’s Styles"
                copy="A curated set of limited finishes available now."
                meta={`${featuredStyles.length} rotating`}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuredRail}
                snapToInterval={featuredCardWidth + spacing.md}
                decelerationRate="fast"
              >
                {visibleFeaturedStyles.map((style, index) => (
                  <RefineStyleCard
                    key={style.id}
                    option={style}
                    index={index}
                    isSelected={selectedStyleId === style.id}
                    onSelect={handleStyleSelect}
                    variant="featured"
                    style={{ width: featuredCardWidth }}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.filterWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
              {REFINE_STYLE_FILTERS.map((filter) => {
                const isActive = activeFilter === filter.value;

                return (
                  <Pressable
                    key={filter.value}
                    onPress={() => setActiveFilter(filter.value)}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {!hasVisibleSections ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No matching styles</Text>
              <Text style={styles.emptyCopy}>Try another library filter.</Text>
            </View>
          ) : null}

          {isFilteredView && filteredStyles.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Filtered Styles"
                copy={FILTERED_SECTION_COPY}
                meta={`${filteredStyles.length} shown`}
              />
              {renderGrid(filteredStyles, 'filtered')}
            </View>
          ) : (
            <>
              {visibleRecommendedStyles.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader
                    title="Recommended for This Anchor"
                    copy="Chosen to match the tone and structure of your anchor."
                    meta={`${visibleRecommendedStyles.length} selected`}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.recommendedRail}
                  >
                    {visibleRecommendedStyles.map((style, index) => (
                      <RefineStyleCard
                        key={`recommended-${style.id}`}
                        option={style}
                        index={index}
                        isSelected={selectedStyleId === style.id}
                        onSelect={handleStyleSelect}
                        variant="recommended"
                        badgeLabel="Recommended"
                        style={{ width: recommendedCardWidth }}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {visibleCoreStyles.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader
                    title="Core Styles"
                    copy="Permanent finishes available any time."
                    meta={`${coreStyles.length} evergreen`}
                  />
                  {renderGrid(visibleCoreStyles)}
                </View>
              ) : null}

              {visibleSeasonalStyles.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader
                    title="Seasonal Collection"
                    copy="Special finishes available for a limited time."
                    meta="Summer / Lunar"
                    seasonal
                  />

                  <View style={styles.seasonalPanel}>
                    <View style={styles.seasonalPanelHeader}>
                      <Sparkles size={18} color="#CBB8E8" strokeWidth={1.6} />
                      <View style={styles.seasonalTextBlock}>
                        <Text style={styles.seasonalCollectionName}>Current Drops</Text>
                        <Text style={styles.seasonalUntil}>Available through Sep 21</Text>
                      </View>
                    </View>
                    {renderGrid(visibleSeasonalStyles, 'seasonal')}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        <View style={styles.bottomBar} pointerEvents="box-none">
          <LinearGradient
            colors={['rgba(15, 20, 25, 0)', 'rgba(15, 20, 25, 0.88)', colors.navy]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.bottomFade}
            pointerEvents="none"
          />

          <View style={[styles.bottomContent, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.ctaPanel}>
              <Animated.Text style={[styles.microcopy, ctaTextAnimatedStyle]}>
                Emotion softens form.
              </Animated.Text>

              <Animated.Text style={[styles.selectedLabel, ctaTextAnimatedStyle]} numberOfLines={1}>
                <Text style={styles.selectedPrefix}>Selected Style: </Text>
                <Text style={styles.selectedValue}>{selectedStyleOption.displayName}</Text>
              </Animated.Text>

              <Pressable
                onPress={handleRefineAnchor}
                style={styles.ctaOuter}
                accessibilityRole="button"
                accessibilityLabel="Refine Anchor"
              >
                <LinearGradient
                  colors={[colors.gold, colors.refineExpression.ctaMid, colors.refineExpression.ctaEnd]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.ctaButton}
                >
                  <Text style={styles.ctaText}>Refine Anchor</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 245, 220, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.24)',
  },
  eyebrow: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 11,
    letterSpacing: 3.2,
    color: colors.gold,
  },
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    paddingTop: spacing.sm,
  },
  introBlock: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.text.primary,
    letterSpacing: 0.3,
  },
  primaryCopy: {
    maxWidth: 330,
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 17,
    lineHeight: 23,
    color: colors.text.secondary,
  },
  secondaryCopy: {
    maxWidth: 330,
    fontFamily: typography.fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(192, 192, 192, 0.72)',
  },
  lockNote: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245, 245, 220, 0.1)',
    backgroundColor: 'rgba(245, 245, 220, 0.035)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  lockText: {
    fontFamily: typography.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.6,
    color: 'rgba(245, 245, 220, 0.68)',
    textTransform: 'uppercase',
  },
  libraryCount: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.24)',
    backgroundColor: 'rgba(212, 175, 55, 0.09)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  libraryCountText: {
    fontFamily: typography.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 19,
    lineHeight: 24,
    color: colors.text.primary,
    letterSpacing: 0.8,
  },
  sectionTitleSeasonal: {
    color: '#CBB8E8',
  },
  sectionMeta: {
    fontFamily: typography.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 1.4,
    color: 'rgba(245, 245, 220, 0.38)',
    textTransform: 'uppercase',
  },
  sectionCopy: {
    maxWidth: 330,
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  featuredRail: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.md,
  },
  filterWrap: {
    marginTop: spacing.xl,
  },
  filterContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245, 245, 220, 0.1)',
    backgroundColor: 'rgba(245, 245, 220, 0.035)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChipActive: {
    borderColor: 'rgba(212, 175, 55, 0.62)',
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
  },
  filterText: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: 'rgba(245, 245, 220, 0.68)',
  },
  filterTextActive: {
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.primary,
  },
  recommendedRail: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  grid: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
    columnGap: spacing.sm,
  },
  seasonalGrid: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    rowGap: spacing.md,
  },
  seasonalRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridItem: {
    flexGrow: 0,
    flexShrink: 0,
  },
  seasonalPanel: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 134, 196, 0.24)',
    backgroundColor: 'rgba(16, 10, 28, 0.68)',
    paddingVertical: spacing.md,
    overflow: 'hidden',
  },
  seasonalPanelHeader: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  seasonalTextBlock: {
    gap: 2,
  },
  seasonalCollectionName: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 13,
    color: colors.text.primary,
    letterSpacing: 0.8,
  },
  seasonalUntil: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 12.5,
    color: 'rgba(203, 184, 232, 0.7)',
  },
  emptyState: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(245, 245, 220, 0.08)',
    backgroundColor: 'rgba(245, 245, 220, 0.03)',
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyTitle: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 17,
    color: colors.text.primary,
  },
  emptyCopy: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 14,
    color: colors.text.secondary,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
  },
  bottomContent: {
    paddingHorizontal: spacing.lg,
  },
  ctaPanel: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    backgroundColor: 'rgba(16, 21, 28, 0.86)',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    shadowColor: colors.black,
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  microcopy: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  selectedLabel: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  selectedPrefix: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(245, 245, 220, 0.5)',
  },
  selectedValue: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 12,
    color: colors.gold,
    letterSpacing: 0.6,
  },
  ctaOuter: {
    borderRadius: 999,
    shadowColor: colors.gold,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaButton: {
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 13,
    letterSpacing: 2.4,
    color: colors.refineExpression.ctaText,
    textTransform: 'uppercase',
  },
});
