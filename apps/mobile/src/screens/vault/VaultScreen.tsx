/**
 * Anchor App - Vault Screen (Premium Redesign)
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AnchorCard } from '../../components/cards/AnchorCard';
import { useAnchorStore } from '../../stores/anchorStore';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../components/ToastProvider';
import { AnchorGridSkeleton } from '../../components/skeletons/AnchorCardSkeleton';
import { AnalyticsService, AnalyticsEvents } from '../../services/AnalyticsService';
import { ErrorTrackingService } from '../../services/ErrorTrackingService';
import { PerformanceMonitoring } from '../../services/PerformanceMonitoring';
import { prefetchImages } from '@/utils/image';
import type { Anchor, RootStackParamList, MainTabParamList } from '@/types';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { colors, spacing, typography } from '@/theme';

const { width } = Dimensions.get('window');
const COLUMN_GAP = spacing.md;
const CARD_WIDTH = (width - spacing.lg * 2 - COLUMN_GAP) / 2;

type VaultScreenNavigationProp = CompositeNavigationProp<
  StackNavigationProp<RootStackParamList, 'Vault'>,
  BottomTabNavigationProp<MainTabParamList>
>;

export const VaultScreen: React.FC = () => {
  const navigation = useNavigation<VaultScreenNavigationProp>();
  const { user } = useAuthStore();
  const { anchors, isLoading, error, setLoading, setError } = useAnchorStore();
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  // Handle redirect from onboarding
  useEffect(() => {
    const { shouldRedirectToCreation, setShouldRedirectToCreation } = useAuthStore.getState();

    if (shouldRedirectToCreation) {
      // Reset flag immediately
      setShouldRedirectToCreation(false);
      // Navigate to creation
      navigation.navigate('CreateAnchor');
    }
  }, [navigation]);

  const fetchAnchors = useCallback(async (): Promise<void> => {
    if (!user) return;

    const trace = PerformanceMonitoring.startTrace('fetch_anchors');
    setLoading(true);
    setError(null);

    try {
      // API call placeholder - logic remains in store
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

  useEffect(() => {
    prefetchImages(anchors.map((anchor) => anchor.enhancedImageUrl), 6);
  }, [anchors]);

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
    AnalyticsService.track(AnalyticsEvents.ANCHOR_CREATION_STARTED, {
      source: 'vault',
      has_existing_anchors: anchors.length > 0,
    });

    ErrorTrackingService.addBreadcrumb('Create anchor initiated', 'navigation', {
      source: 'vault',
    });

    navigation.navigate('CreateAnchor');
  }, [anchors.length, navigation]);

  const renderAnchorCard = useCallback(
    ({ item }: { item: Anchor }): React.JSX.Element => (
      <View style={{ width: CARD_WIDTH }}>
        <AnchorCard anchor={item} onPress={handleAnchorPress} />
      </View>
    ),
    [handleAnchorPress]
  );

  const renderEmptyState = (): React.JSX.Element => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon} accessibilityLabel="Anchor icon">⚓</Text>
      <Text style={styles.emptyTitle} accessibilityRole="header">Sanctuary Awaits</Text>
      <Text style={styles.emptyDescription}>
        Begin your journey of intentional living by forging your first anchor.
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={handleCreateAnchor}
        accessibilityRole="button"
        accessibilityLabel="Forge your first anchor"
        accessibilityHint="Opens the anchor creation screen"
        activeOpacity={0.8}
      >
        <LinearGradient colors={[colors.gold, '#B8941F']} style={styles.buttonGradient}>
          <Text style={styles.createButtonText}>Forge First Anchor</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );


  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.navy, colors.deepPurple, colors.charcoal]}
        style={StyleSheet.absoluteFill}
      />

      {Platform.OS === 'ios' && (
        <View style={styles.orbContainer}>
          <View style={[styles.orb, styles.orb1]} />
          <View style={[styles.orb, styles.orb2]} />
        </View>
      )}

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {isLoading && anchors.length === 0 ? (
            <AnchorGridSkeleton count={6} />
          ) : (
            <FlatList
              data={anchors}
              renderItem={renderAnchorCard}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.listContent}
              columnWrapperStyle={styles.columnWrapper}
              ListEmptyComponent={!isLoading ? renderEmptyState : null}
              removeClippedSubviews
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={5}
              updateCellsBatchingPeriod={50}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.gold}
                  accessibilityLabel="Pull to refresh anchors"
                />
              }
              showsVerticalScrollIndicator={false}
              accessibilityLabel={`List of ${anchors.length} anchors`}
            />
          )}
        </Animated.View>

        {/* Floating Create Button - Positioned to clear floating tab bar */}
        {anchors.length > 0 && (
          <TouchableOpacity
            style={styles.fab}
            onPress={handleCreateAnchor}
            accessibilityRole="button"
            accessibilityLabel="Forge new anchor"
            accessibilityHint="Opens the anchor creation screen"
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[colors.gold, '#B8941F']}
              style={styles.fabGradient}
            >
              <Plus color={colors.charcoal} size={20} style={styles.fabIcon} />
              <Text style={styles.fabText}>Forge Anchor</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  orbContainer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 200, backgroundColor: colors.gold, opacity: 0.1 },
  orb1: { width: 400, height: 400, top: -200, right: -150 },
  orb2: { width: 300, height: 300, bottom: 50, left: -100 },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 160, // Increased to clear FAB and Tab Bar
    flexGrow: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: 60,
  },
  emptyIcon: { fontSize: 80, marginBottom: 20 },
  emptyTitle: {
    fontSize: 24,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: 12,
  },
  emptyDescription: {
    fontSize: 16,
    color: colors.silver,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  createButton: { borderRadius: 12, overflow: 'hidden', width: '100%' },
  buttonGradient: { height: 56, justifyContent: 'center', alignItems: 'center' },
  createButtonText: { color: colors.charcoal, fontWeight: '700', fontSize: 16 },
  fab: {
    position: 'absolute',
    bottom: 120, // Raised to clear the floating tab bar
    right: spacing.lg,
    height: 56,
    borderRadius: 28,
    elevation: 8,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  fabGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  fabIcon: {
    marginRight: spacing.xs,
  },
  fabText: {
    fontSize: 14,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default VaultScreen;
