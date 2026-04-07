import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { AIStyle, RootStackParamList, SigilVariant } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground } from '@/components/common';

type StyleCategory = 'all' | 'modern' | 'luminous' | 'mystic' | 'geometric' | 'organic';

interface StyleOption {
  id: string;
  name: string;
  category: Exclude<StyleCategory, 'all'>;
  description: string;
  icon: string;
  recommended?: boolean;
}

const STYLE_OPTIONS: StyleOption[] = [
  { id: 'minimal-line', name: 'Minimal Line', category: 'geometric', description: 'Crisp clarity and restraint.', icon: '◎', recommended: true },
  { id: 'ink-brush', name: 'Ink Brush', category: 'organic', description: 'Fluid, expressive movement.', icon: '⚡' },
  { id: 'sacred-geometry', name: 'Sacred Geometry', category: 'mystic', description: 'Structured symbolic precision.', icon: '⊕', recommended: true },
  { id: 'watercolor', name: 'Watercolor', category: 'organic', description: 'Soft tonal atmosphere.', icon: '〜' },
  { id: 'gold-leaf', name: 'Gold Leaf', category: 'luminous', description: 'Luxurious luminous finish.', icon: '♛' },
  { id: 'cosmic', name: 'Cosmic', category: 'mystic', description: 'Orbital celestial energy.', icon: '✦' },
  { id: 'obsidian-mono', name: 'Obsidian Mono', category: 'modern', description: 'High-contrast monochrome depth.', icon: '▤' },
  { id: 'aurora-glow', name: 'Aurora Glow', category: 'luminous', description: 'Atmospheric color bloom.', icon: '☁' },
  { id: 'ember-trace', name: 'Ember Trace', category: 'luminous', description: 'Warm ember edge lighting.', icon: '♨' },
  { id: 'echo-chamber', name: 'Echo Chamber', category: 'mystic', description: 'Layered cyclical resonance.', icon: '↺' },
  { id: 'monolith-ink', name: 'Monolith Ink', category: 'modern', description: 'Grounded heavy-line authority.', icon: '✦' },
  { id: 'celestial-grid', name: 'Celestial Grid', category: 'geometric', description: 'Constellation-inspired symmetry.', icon: '✧' },
];

const FILTER_TABS: Array<{ label: string; value: StyleCategory }> = [
  { label: 'All', value: 'all' },
  { label: 'Modern', value: 'modern' },
  { label: 'Luminous', value: 'luminous' },
  { label: 'Mystic', value: 'mystic' },
  { label: 'Geometric', value: 'geometric' },
  { label: 'Organic', value: 'organic' },
];

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
  selectedStyle: StyleOption;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.refineExpression.gridGap) / 2;

const isSigilVariant = (value: string | undefined): value is SigilVariant =>
  value === 'dense' || value === 'balanced' || value === 'minimal';

const normalizeSigilVariant = (value: string | undefined): SigilVariant =>
  isSigilVariant(value) ? value : 'balanced';

const toAIStyle = (id: StyleOption['id']): AIStyle => id.replace(/-/g, '_') as AIStyle;

const StyleCard: React.FC<{
  option: StyleOption;
  isSelected: boolean;
  onSelect: (id: string) => void;
}> = ({ option, isSelected, onSelect }) => {
  const scale = useSharedValue(1);
  const stripOpacity = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    stripOpacity.value = withTiming(isSelected ? 1 : 0, { duration: 300 });
  }, [isSelected, stripOpacity]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const stripAnimatedStyle = useAnimatedStyle(() => ({
    opacity: stripOpacity.value,
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 14, stiffness: 260, mass: 0.4 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 220, mass: 0.45 });
  }, [scale]);

  return (
    <Pressable
      onPress={() => onSelect(option.id)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={option.name}
    >
      <Animated.View style={[styles.styleCard, isSelected && styles.styleCardSelected, cardAnimatedStyle]}>
        {isSelected ? (
          <View style={styles.checkBadge}>
            <Text style={styles.checkBadgeText}>✓</Text>
          </View>
        ) : null}

        <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
          <Text style={styles.iconText}>{option.icon}</Text>
        </View>

        <Text style={styles.cardName}>{option.name}</Text>
        <Text style={styles.categoryText}>{option.category}</Text>
        <Text style={styles.descriptionText}>{option.description}</Text>

        {option.recommended ? (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>Recommended</Text>
          </View>
        ) : null}

        <Animated.View style={[styles.previewStripWrap, stripAnimatedStyle]}>
          <LinearGradient
            colors={[
              colors.refineExpression.transparent,
              colors.gold,
              colors.refineExpression.transparent,
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.previewStrip}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

export default function RefineExpressionScreen() {
  const route = useRoute<StyleSelectionRouteProp>();
  const navigation = useNavigation<StyleSelectionNavigationProp>();
  const insets = useSafeAreaInsets();

  const params = (route.params ?? {}) as StyleSelectionParams;
  const intention = (params.intention ?? params.intentionText ?? '').trim();
  const sigilSvg = params.sigilSvg ?? params.reinforcedSigilSvg ?? params.baseSigilSvg;
  const structureType = params.structureType ?? params.structureVariant;

  const [selectedStyle, setSelectedStyle] = useState<string>('gold-leaf');
  const [activeFilter, setActiveFilter] = useState<StyleCategory>('all');

  const filteredStyles = useMemo(
    () => (activeFilter === 'all' ? STYLE_OPTIONS : STYLE_OPTIONS.filter((style) => style.category === activeFilter)),
    [activeFilter]
  );

  const selectedStyleOption = useMemo(
    () => STYLE_OPTIONS.find((style) => style.id === selectedStyle) ?? STYLE_OPTIONS[0],
    [selectedStyle]
  );

  const handleRefineAnchor = useCallback(() => {
    const payload: ForwardNavigationPayload = {
      intention,
      sigilSvg,
      structureType,
      selectedStyle: selectedStyleOption,
      intentionText: intention,
      category: params.category ?? 'custom',
      distilledLetters: params.distilledLetters ?? [],
      baseSigilSvg: sigilSvg ?? '',
      reinforcedSigilSvg: params.reinforcedSigilSvg,
      structureVariant: normalizeSigilVariant(params.structureVariant ?? params.structureType),
      styleChoice: toAIStyle(selectedStyleOption.id),
      reinforcementMetadata: params.reinforcementMetadata,
    };

    navigation.navigate('AIGenerating', payload);
  }, [
    intention,
    navigation,
    params.category,
    params.distilledLetters,
    params.reinforcementMetadata,
    params.reinforcedSigilSvg,
    params.structureType,
    params.structureVariant,
    selectedStyleOption,
    sigilSvg,
    structureType,
  ]);

  const renderStyleCard = useCallback(
    ({ item }: { item: StyleOption }) => (
      <View style={styles.cardColumn}>
        <StyleCard option={item} isSelected={selectedStyle === item.id} onSelect={setSelectedStyle} />
      </View>
    ),
    [selectedStyle]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <ZenBackground orbOpacity={0.08} animationDuration={700} />

        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.stepLabel}>Embellish</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.heroBlock}>
          <Text style={styles.heroTitle}>Refine Expression</Text>
          <Text style={styles.heroSubtitle}>Adjust the finish. The structure remains unchanged.</Text>
        </View>

        <View style={styles.lockRow}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockText}>Structure locked</Text>
          <Text style={styles.lockSeparator}>·</Text>
          <Text style={styles.lockText}>Visual refinement only</Text>
        </View>

        <View style={styles.countPill}>
          <Text style={styles.countIcon}>✦</Text>
          <Text style={styles.countText}>12 Styles Available</Text>
        </View>

        <LinearGradient
          colors={[
            colors.refineExpression.transparent,
            colors.refineExpression.goldBorder,
            colors.refineExpression.transparent,
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.divider}
        />

        <View style={styles.filterTabsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsContent}>
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.value;
              return (
                <Pressable
                  key={tab.value}
                  onPress={() => {
                    if (isActive) return;
                    setActiveFilter(tab.value);
                  }}
                  style={[styles.filterTab, isActive ? styles.filterTabActive : styles.filterTabInactive]}
                >
                  <Text style={[styles.filterTabText, isActive ? styles.filterTabTextActive : styles.filterTabTextInactive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.gridWrap}>
          <FlatList
            data={filteredStyles}
            keyExtractor={(item) => item.id}
            renderItem={renderStyleCard}
            numColumns={2}
            columnWrapperStyle={styles.gridColumnRow}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <View style={styles.bottomBar}>
          <LinearGradient
            colors={[colors.refineExpression.transparent, colors.navy]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.bottomFade}
            pointerEvents="none"
          />

          <View
            style={[
              styles.bottomContent,
              {
                paddingBottom: insets.bottom + spacing.refineExpression.bottomInsetPadding,
              },
            ]}
          >
            <Text style={styles.selectedLabel}>
              <Text style={styles.selectedLabelPrefix}>Selected style: </Text>
              <Text style={styles.selectedLabelValue}>{selectedStyleOption.name}</Text>
            </Text>

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
                <Text style={styles.ctaText}>Refine Anchor  ✦</Text>
              </LinearGradient>
            </Pressable>
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
  headerRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.refineExpression.headerTop,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.refineExpression.glass,
    borderWidth: 1,
    borderColor: colors.refineExpression.goldBorder,
  },
  backIcon: {
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    color: colors.gold,
  },
  stepLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  headerSpacer: {
    width: 34,
  },
  heroBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.refineExpression.heroTop,
    alignItems: 'center',
  },
  heroTitle: {
    textAlign: 'center',
    fontFamily: typography.fonts.heading,
    fontSize: 22,
    fontWeight: '700',
    color: colors.gold,
    textShadowColor: colors.refineExpression.goldTextShadow,
    textShadowRadius: 24,
    marginBottom: spacing.refineExpression.heroTitleBottom,
  },
  heroSubtitle: {
    textAlign: 'center',
    fontFamily: typography.fonts.body,
    fontSize: 12.5,
    fontStyle: 'italic',
    lineHeight: 19,
    color: colors.refineExpression.muted,
  },
  lockRow: {
    marginTop: spacing.refineExpression.lockTop,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.refineExpression.lockGap,
  },
  lockIcon: {
    fontSize: 10,
    color: colors.gold,
  },
  lockText: {
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    color: colors.refineExpression.goldTextDim,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  lockSeparator: {
    fontFamily: typography.fonts.body,
    fontSize: 9,
    color: colors.refineExpression.muted,
  },
  countPill: {
    alignSelf: 'center',
    marginTop: spacing.refineExpression.chipTop,
    paddingVertical: spacing.refineExpression.chipVertical,
    paddingHorizontal: spacing.refineExpression.chipHorizontal,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.refineExpression.goldBorder,
    backgroundColor: colors.refineExpression.goldDim,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.refineExpression.chipGap,
  },
  countIcon: {
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    color: colors.gold,
  },
  countText: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  divider: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.refineExpression.dividerTop,
    height: 1,
  },
  filterTabsWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.refineExpression.tabsTop,
  },
  filterTabsContent: {
    gap: spacing.refineExpression.tabsGap,
    paddingRight: spacing.lg,
  },
  filterTab: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: spacing.refineExpression.tabVertical,
    paddingHorizontal: spacing.refineExpression.tabHorizontal,
  },
  filterTabActive: {
    backgroundColor: colors.refineExpression.goldDim,
    borderColor: colors.refineExpression.goldBorder,
  },
  filterTabInactive: {
    backgroundColor: colors.refineExpression.glass,
    borderColor: colors.refineExpression.subtle,
  },
  filterTabText: {
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  filterTabTextActive: {
    color: colors.gold,
  },
  filterTabTextInactive: {
    color: colors.refineExpression.muted,
  },
  gridWrap: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.refineExpression.gridTop,
    paddingBottom: spacing.refineExpression.gridBottom,
  },
  gridColumnRow: {
    justifyContent: 'space-between',
  },
  cardColumn: {
    width: CARD_WIDTH,
    marginBottom: spacing.refineExpression.gridGap,
  },
  styleCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.refineExpression.cardBg,
    borderRadius: 16,
    paddingVertical: spacing.refineExpression.cardVertical,
    paddingHorizontal: spacing.refineExpression.cardHorizontal,
    borderWidth: 1,
    borderColor: colors.refineExpression.subtle,
  },
  styleCardSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.refineExpression.goldTint,
  },
  checkBadge: {
    position: 'absolute',
    top: spacing.refineExpression.checkOffset,
    right: spacing.refineExpression.checkOffset,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadgeText: {
    color: colors.refineExpression.ctaText,
    fontSize: 9,
    fontWeight: '700',
    fontFamily: typography.fonts.body,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.refineExpression.glass,
    borderWidth: 1,
    borderColor: colors.refineExpression.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.refineExpression.iconBottom,
  },
  iconBoxSelected: {
    borderColor: colors.gold,
  },
  iconText: {
    fontSize: 16,
    color: colors.refineExpression.text,
    fontFamily: typography.fonts.body,
  },
  cardName: {
    fontFamily: typography.fonts.heading,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.refineExpression.text,
    letterSpacing: 0.5,
    marginBottom: spacing.refineExpression.nameBottom,
    lineHeight: 15,
  },
  categoryText: {
    fontFamily: typography.fonts.heading,
    fontSize: 8,
    color: colors.refineExpression.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.refineExpression.categoryBottom,
  },
  descriptionText: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.refineExpression.description,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  recommendedBadge: {
    marginTop: spacing.refineExpression.recommendedTop,
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.refineExpression.goldBorder,
    backgroundColor: colors.refineExpression.goldDim,
    paddingVertical: spacing.refineExpression.recommendedVertical,
    paddingHorizontal: spacing.refineExpression.recommendedHorizontal,
  },
  recommendedText: {
    fontFamily: typography.fonts.heading,
    fontSize: 7.5,
    color: colors.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  previewStripWrap: {
    marginTop: spacing.refineExpression.previewTop,
    height: 2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  previewStrip: {
    flex: 1,
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
    height: spacing.refineExpression.bottomFadeHeight,
  },
  bottomContent: {
    paddingHorizontal: spacing.lg,
  },
  selectedLabel: {
    textAlign: 'center',
    marginBottom: spacing.refineExpression.selectedBottom,
  },
  selectedLabelPrefix: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    color: colors.refineExpression.muted,
    letterSpacing: 1.5,
  },
  selectedLabelValue: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 1.5,
  },
  ctaOuter: {
    width: '100%',
    borderRadius: 14,
    shadowColor: colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  ctaButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: typography.fonts.heading,
    fontSize: 14,
    fontWeight: '600',
    color: colors.refineExpression.ctaText,
    letterSpacing: 1.5,
  },
});
