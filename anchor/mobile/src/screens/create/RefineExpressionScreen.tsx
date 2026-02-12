import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Lock, Sparkles } from 'lucide-react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import type { AIStyle, RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground } from '@/components/common';
import { ProPaywallModal } from '@/components/modals/ProPaywallModal';
import { useEntitlementsStore } from '@/hooks/useEntitlementsStore';
import { RefineStyleCard } from './components/RefineStyleCard';
import {
  FREE_VISIBLE_STYLE_COUNT,
  REFINE_STYLES,
  type RefineStyleOption,
} from './constants/refineStyles';

type StyleSelectionRouteProp = RouteProp<RootStackParamList, 'StyleSelection'>;
type StyleSelectionNavigationProp = StackNavigationProp<RootStackParamList, 'StyleSelection'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LIST_HORIZONTAL_PADDING = spacing.lg;
const GRID_GAP = spacing.md;
const CARD_WIDTH = (SCREEN_WIDTH - LIST_HORIZONTAL_PADDING * 2 - GRID_GAP) / 2;
const FOOTER_BASE_HEIGHT = 122;

export default function RefineExpressionScreen() {
  const route = useRoute<StyleSelectionRouteProp>();
  const navigation = useNavigation<StyleSelectionNavigationProp>();
  const insets = useSafeAreaInsets();
  const { tier } = useEntitlementsStore((state) => state.getEntitlements());
  const isPro = tier === 'pro';

  const {
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    reinforcedSigilSvg,
    structureVariant,
    reinforcementMetadata,
  } = route.params;

  const [selectedStyleId, setSelectedStyleId] = useState<AIStyle>('minimal_line');
  const [showProPaywall, setShowProPaywall] = useState(false);

  const selectableStyles = useMemo(
    () => (isPro ? REFINE_STYLES : REFINE_STYLES.slice(0, FREE_VISIBLE_STYLE_COUNT)),
    [isPro]
  );

  const availableCountLabel = `${selectableStyles.length} styles available`;
  const footerPaddingBottom = Math.max(insets.bottom, spacing.md);
  const listBottomPadding = FOOTER_BASE_HEIGHT + footerPaddingBottom + spacing.xl;

  useEffect(() => {
    if (!isPro) {
      const currentStyleStillAllowed = selectableStyles.some((style) => style.id === selectedStyleId);
      if (!currentStyleStillAllowed) {
        setSelectedStyleId(selectableStyles[0].id);
      }
    }
  }, [isPro, selectableStyles, selectedStyleId]);

  const selectedStyle = useMemo(
    () => REFINE_STYLES.find((style) => style.id === selectedStyleId) ?? REFINE_STYLES[0],
    [selectedStyleId]
  );

  const handleSelectStyle = useCallback(async (option: RefineStyleOption) => {
    setSelectedStyleId(option.id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleLockedStylePress = useCallback(async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setShowProPaywall(true);
  }, []);

  const handleContinue = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    navigation.navigate('AIGenerating', {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg,
      structureVariant,
      reinforcementMetadata,
      styleChoice: selectedStyleId,
    });
  }, [
    navigation,
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    reinforcedSigilSvg,
    structureVariant,
    reinforcementMetadata,
    selectedStyleId,
  ]);

  const renderStyleCard = useCallback(
    ({ item, index }: { item: RefineStyleOption; index: number }) => {
      const isLocked = !isPro && index >= FREE_VISIBLE_STYLE_COUNT;

      return (
        <View style={[styles.cardContainer, { width: CARD_WIDTH, opacity: isLocked ? 0.84 : 1 }]}>
          <RefineStyleCard
            option={item}
            index={index}
            isSelected={selectedStyleId === item.id}
            isLocked={isLocked}
            onSelect={handleSelectStyle}
            onLockedPress={handleLockedStylePress}
          />
        </View>
      );
    },
    [isPro, selectedStyleId, handleSelectStyle, handleLockedStylePress]
  );

  const listFooter = useMemo(() => {
    if (isPro) return null;

    return (
      <View style={styles.upsellContainer}>
        <BlurView intensity={14} tint="dark" style={styles.upsellCard}>
          <View style={styles.upsellTextWrap}>
            <Text style={styles.upsellTitle}>Unlock 12 Refinement Styles</Text>
            <Text style={styles.upsellSubtitle}>
              Expand your aesthetic range with premium visual finishes and advanced style depth.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.upsellButton}
            onPress={() => setShowProPaywall(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go Pro"
          >
            <Text style={styles.upsellButtonText}>Go Pro</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    );
  }, [isPro]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <ZenBackground orbOpacity={0.08} animationDuration={700} />

        <View style={styles.header}>
          <Text style={styles.title}>Refine Expression</Text>
          <Text style={styles.subtitle}>Adjust the finish. The structure remains unchanged.</Text>

          <View style={styles.lockHintRow}>
            <Lock size={14} color={colors.gold} />
            <Text style={styles.lockHintText}>Structure locked · Visual refinement only</Text>
          </View>

          <View style={styles.availabilityChip}>
            <Sparkles size={14} color={colors.gold} />
            <Text style={styles.availabilityChipText}>{availableCountLabel}</Text>
          </View>
        </View>

        <View style={styles.listWrap}>
          <FlatList
            data={REFINE_STYLES}
            keyExtractor={(item) => item.id}
            renderItem={renderStyleCard}
            numColumns={2}
            columnWrapperStyle={styles.column}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              {
                paddingBottom: listBottomPadding,
              },
            ]}
            ListFooterComponent={listFooter}
          />
        </View>

        <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
          <Text style={styles.selectedStyleText}>Selected style: {selectedStyle.title}</Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleContinue}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Refine Anchor"
          >
            <Text style={styles.ctaText}>Refine Anchor</Text>
          </TouchableOpacity>
        </View>

        <ProPaywallModal
          visible={showProPaywall}
          feature="all_styles"
          onClose={() => setShowProPaywall(false)}
          onUpgrade={() => {
            setShowProPaywall(false);
            navigation.navigate('Settings');
          }}
        />
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 30,
    letterSpacing: 0.4,
    color: colors.bone,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    lineHeight: typography.lineHeights.body2,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  lockHintRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lockHintText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.caption,
    color: 'rgba(212, 175, 55, 0.72)',
    letterSpacing: 0.25,
  },
  availabilityChip: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.38)',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  availabilityChipText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: LIST_HORIZONTAL_PADDING,
    paddingTop: spacing.sm,
  },
  column: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardContainer: {
    height: 188,
  },
  upsellContainer: {
    marginTop: spacing.sm,
  },
  upsellCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    backgroundColor: colors.ritual.glassStrong,
    padding: spacing.md,
    gap: spacing.md,
  },
  upsellTextWrap: {
    gap: spacing.xs,
  },
  upsellTitle: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 18,
    color: colors.gold,
    letterSpacing: 0.4,
  },
  upsellSubtitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.text.secondary,
  },
  upsellButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.8)',
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
  },
  upsellButtonText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.caption,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(10, 13, 18, 0.88)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.16)',
  },
  selectedStyleText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  ctaButton: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.82)',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.button,
    color: colors.bone,
    letterSpacing: 0.6,
  },
});
