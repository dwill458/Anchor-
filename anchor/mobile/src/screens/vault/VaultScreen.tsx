/**
 * Anchor App - Vault Screen (Sanctuary Redesign)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AnchorCard } from '../../components/cards/AnchorCard';
import { useAnchorStore } from '../../stores/anchorStore';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../components/ToastProvider';
import { AnchorGridSkeleton } from '../../components/skeletons/AnchorCardSkeleton';
import { AnchorLimitModal } from '../../components/modals/AnchorLimitModal';
import { useSubscription } from '../../hooks/useSubscription';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { AnalyticsService, AnalyticsEvents } from '../../services/AnalyticsService';
import { ErrorTrackingService } from '../../services/ErrorTrackingService';
import { PerformanceMonitoring } from '../../services/PerformanceMonitoring';
import { SanctuaryHeader } from './components/SanctuaryHeader';
import { DailyStreakStrip } from './components/DailyStreakStrip';
import { AnchorsSectionRow } from './components/AnchorsSectionRow';
import { ForgeAnchorButton } from './components/ForgeAnchorButton';
import { SanctuaryEmptyState } from './components/SanctuaryEmptyState';
import { AtmosphericOrbs } from './components/AtmosphericOrbs';
import { ZenBackground } from '@/components/common';
import { getEffectiveStabilizeStreakDays, toDateOrNull } from '@/utils/stabilizeStats';
import type { Anchor, RootStackParamList } from '@/types';
import { colors, spacing } from '@/theme';
import { useTabNavigation } from '@/contexts/TabNavigationContext';

const { width } = Dimensions.get('window');
const COLUMN_GAP = spacing.md;
const CARD_WIDTH = (width - spacing.lg * 2 - COLUMN_GAP) / 2;
const FADE_STAGGER_MS = 50;
const GRID_BASE_DELAY_MS = 150;
const FORGE_BUTTON_DELAY_MS = 350;

type VaultScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Vault'>;

const getFadeUpEntering = (delay: number, reduceMotionEnabled: boolean) => {
  if (reduceMotionEnabled) {
    return undefined;
  }
  return FadeInUp.duration(500)
    .delay(delay)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] });
};

export const VaultScreen: React.FC = () => {
  const navigation = useNavigation<VaultScreenNavigationProp>();
  const { registerTabNav, navigateToPractice, activeTabIndex } = useTabNavigation();
  const isVaultTabActive = activeTabIndex == null ? true : activeTabIndex === 0;
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const shouldRedirectToCreation = useAuthStore(
    (state) => state.shouldRedirectToCreation
  );
  const setShouldRedirectToCreation = useAuthStore(
    (state) => state.setShouldRedirectToCreation
  );
  const anchors = useAnchorStore((state) => state.anchors);
  const isLoading = useAnchorStore((state) => state.isLoading);
  const setLoading = useAnchorStore((state) => state.setLoading);
  const setError = useAnchorStore((state) => state.setError);
  const { isFree, features } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [showAnchorLimitModal, setShowAnchorLimitModal] = useState(false);
  const reduceMotionEnabled = useReduceMotionEnabled();
  const shouldReduceMotion = reduceMotionEnabled || !isVaultTabActive;
  const toast = useToast();

  useEffect(() => {
    registerTabNav(0, navigation as any);
    return () => registerTabNav(0, null);
  }, [navigation, registerTabNav]);

  useEffect(() => {
    if (shouldRedirectToCreation) {
      setShouldRedirectToCreation(false);
      if (isFree && anchors.length >= features.maxAnchors) {
        setShowAnchorLimitModal(true);
        return;
      }
      navigation.navigate('CreateAnchor');
    }
  }, [shouldRedirectToCreation, setShouldRedirectToCreation, isFree, anchors.length, features.maxAnchors, navigation]);

  const fetchAnchors = useCallback(async (): Promise<void> => {
    if (!user) return;

    const trace = PerformanceMonitoring.startTrace('fetch_anchors');
    setLoading(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      trace.putAttribute('anchor_count', anchors.length);
      AnalyticsService.track(AnalyticsEvents.VAULT_VIEWED, {
        anchor_count: anchors.length,
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      toast.error(`Failed to load anchors: ${errorMessage}`);

      ErrorTrackingService.captureException(error as Error, {
        screen: 'VaultScreen',
        action: 'fetch_anchors',
        user_id: user.id,
      });
    } finally {
      setLoading(false);
      trace.stop();
    }
  }, [user, setLoading, setError, toast, anchors.length]);

  useEffect(() => {
    fetchAnchors();
  }, [fetchAnchors]);

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await fetchAnchors();
    setRefreshing(false);
  }, [fetchAnchors]);

  const handleAnchorPress = useCallback((anchor: Anchor): void => {
    AnalyticsService.track(AnalyticsEvents.ANCHOR_VIEWED, {
      anchor_id: anchor.id,
      category: anchor.category,
      is_charged: anchor.isCharged,
      activation_count: anchor.activationCount,
      source: 'vault',
    });

    ErrorTrackingService.addBreadcrumb('Anchor pressed', 'navigation', {
      anchor_id: anchor.id,
      category: anchor.category,
    });

    navigation.navigate('AnchorDetail', { anchorId: anchor.id });
  }, [navigation]);

  const handleCreateAnchor = useCallback((): void => {
    if (isFree && anchors.length >= features.maxAnchors) {
      AnalyticsService.track(AnalyticsEvents.ANCHOR_LIMIT_REACHED, {
        current_count: anchors.length,
        max_count: features.maxAnchors,
        tier: 'free',
      });

      setShowAnchorLimitModal(true);
      return;
    }

    AnalyticsService.track(AnalyticsEvents.ANCHOR_CREATION_STARTED, {
      source: 'vault',
      has_existing_anchors: anchors.length > 0,
    });

    ErrorTrackingService.addBreadcrumb('Create anchor initiated', 'navigation', {
      source: 'vault',
    });

    navigation.navigate('CreateAnchor');
  }, [isFree, anchors.length, features.maxAnchors, navigation]);

  const handleUpgradeFromLimit = useCallback((): void => {
    setShowAnchorLimitModal(false);

    AnalyticsService.track(AnalyticsEvents.UPGRADE_INITIATED, {
      source: 'anchor_limit_modal',
      trigger: 'max_anchors_reached',
    });

    navigation.navigate('Settings');
  }, [navigation]);

  const handleBurnFromLimit = useCallback((): void => {
    setShowAnchorLimitModal(false);

    AnalyticsService.track(AnalyticsEvents.BURN_TO_MAKE_ROOM_INITIATED, {
      source: 'anchor_limit_modal',
      current_count: anchors.length,
    });

    toast.info('Select an anchor to release and make room for a new one');
  }, [anchors.length, toast]);

  const streakDays = useMemo(() => {
    const lastStabilizeAt = toDateOrNull(user?.lastStabilizeAt);
    return getEffectiveStabilizeStreakDays(
      user?.stabilizeStreakDays ?? 0,
      lastStabilizeAt,
      new Date()
    );
  }, [user?.lastStabilizeAt, user?.stabilizeStreakDays]);

  const gridItems = useMemo<Anchor[]>(() => anchors, [anchors]);

  const renderGridItem = useCallback(
    ({ item, index }: { item: Anchor; index: number }): React.JSX.Element => (
      <Animated.View
        entering={getFadeUpEntering(
          GRID_BASE_DELAY_MS + index * FADE_STAGGER_MS,
          reduceMotionEnabled || !isVaultTabActive
        )}
        style={{ width: CARD_WIDTH }}
      >
        <AnchorCard
          anchor={item}
          onPress={handleAnchorPress}
          reduceMotionEnabled={reduceMotionEnabled || !isVaultTabActive}
          variant="sanctuary"
        />
      </Animated.View>
    ),
    [handleAnchorPress, isVaultTabActive, reduceMotionEnabled]
  );

  const listHeader = useMemo(
    () => (
      <>
        <Animated.View entering={getFadeUpEntering(0, shouldReduceMotion)}>
          <SanctuaryHeader reduceMotionEnabled={shouldReduceMotion} />
        </Animated.View>
        <Animated.View entering={getFadeUpEntering(FADE_STAGGER_MS, shouldReduceMotion)}>
          <DailyStreakStrip
            streakDays={streakDays}
            onPress={navigateToPractice}
            reduceMotionEnabled={shouldReduceMotion}
          />
        </Animated.View>
        {anchors.length > 0 && (
          <Animated.View entering={getFadeUpEntering(FADE_STAGGER_MS * 2, shouldReduceMotion)}>
            <AnchorsSectionRow anchorCount={anchors.length} />
          </Animated.View>
        )}
      </>
    ),
    [shouldReduceMotion, streakDays, anchors.length, navigateToPractice]
  );

  const forgeButtonBottom = 106 + Math.max(0, insets.bottom - 4);
  const listBottomPadding = forgeButtonBottom + 86;

  return (
    <View style={styles.container}>
      <ZenBackground variant="sanctuary" showOrbs={isVaultTabActive} showGrain showVignette />
      <AtmosphericOrbs reduceMotionEnabled={shouldReduceMotion} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {isLoading && anchors.length === 0 ? (
          <AnchorGridSkeleton count={6} />
        ) : (
          <FlatList
            data={gridItems}
            renderItem={renderGridItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={(
              <Animated.View entering={getFadeUpEntering(GRID_BASE_DELAY_MS, shouldReduceMotion)}>
                <SanctuaryEmptyState />
              </Animated.View>
            )}
            refreshControl={(
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.sanctuary.gold}
                accessibilityLabel="Pull to refresh anchors"
              />
            )}
            ListFooterComponent={<View style={{ height: listBottomPadding }} />}
            showsVerticalScrollIndicator={false}
            accessibilityLabel={`List of ${anchors.length} anchors`}
          />
        )}

        <Animated.View entering={getFadeUpEntering(FORGE_BUTTON_DELAY_MS, shouldReduceMotion)}>
          <ForgeAnchorButton
            onPress={handleCreateAnchor}
            reduceMotionEnabled={shouldReduceMotion}
            bottomOffset={forgeButtonBottom}
          />
        </Animated.View>

        <AnchorLimitModal
          visible={showAnchorLimitModal}
          currentCount={anchors.length}
          maxCount={features.maxAnchors}
          onClose={() => setShowAnchorLimitModal(false)}
          onUpgrade={handleUpgradeFromLimit}
          onBurnAnchor={handleBurnFromLimit}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.sanctuary.purpleBg,
  },
  safeArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    flexGrow: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
});

export default VaultScreen;
