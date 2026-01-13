/**
 * Anchor App - Vault Screen
 *
 * Main screen displaying user's anchor collection in a grid layout.
 * Features: grid view, pull-to-refresh, empty state, navigation to detail.
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
} from 'react-native';
import { Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AnchorCard } from '../../components/cards/AnchorCard';
import { useAnchorStore } from '../../stores/anchorStore';
import { useAuthStore } from '../../stores/authStore';
import type { Anchor, RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';

const { width } = Dimensions.get('window');
const CARD_PADDING = spacing.md;
const COLUMN_GAP = spacing.md;
const CARD_WIDTH = (width - CARD_PADDING * 2 - COLUMN_GAP) / 2;

type VaultScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Vault'>;

export const VaultScreen: React.FC = () => {
  const navigation = useNavigation<VaultScreenNavigationProp>();
  const { user } = useAuthStore();
  const { anchors, isLoading, setLoading, setError } = useAnchorStore();
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Fetch anchors from backend
   */
  const fetchAnchors = useCallback(async (): Promise<void> => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // TODO: Call API to fetch anchors
      // const response = await apiClient.get<ApiResponse<Anchor[]>>('/api/anchors');
      // if (response.success && response.data) {
      //   setAnchors(response.data);
      //   markSynced();
      // }

      // For now, just clear loading state
      // Anchors will be populated when user creates them
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user, setLoading, setError]);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchAnchors();
  }, [fetchAnchors]);

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await fetchAnchors();
    setRefreshing(false);
  }, [fetchAnchors]);

  /**
   * Navigate to anchor detail screen
   */
  const handleAnchorPress = (anchor: Anchor): void => {
    navigation.navigate('AnchorDetail', { anchorId: anchor.id });
  };

  /**
   * Navigate to create new anchor
   */
  const handleCreateAnchor = (): void => {
    navigation.navigate('CreateAnchor');
  };

  /**
   * Render individual anchor card in grid
   */
  const renderAnchorCard = ({ item }: { item: Anchor }): React.JSX.Element => (
    <View style={styles.cardWrapper}>
      <AnchorCard anchor={item} onPress={handleAnchorPress} />
    </View>
  );

  /**
   * Render empty state
   */
  const renderEmptyState = (): React.JSX.Element => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>⚓</Text>
      <Text style={styles.emptyTitle}>No Anchors Yet</Text>
      <Text style={styles.emptyDescription}>
        Create your first anchor to begin your journey of intentional living
      </Text>
      <TouchableOpacity style={styles.createButton} onPress={handleCreateAnchor}>
        <Text style={styles.createButtonText}>Create Your First Anchor</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render header with title and stats
   */
  const renderHeader = (): React.JSX.Element => (
    <View style={styles.header}>
      <Text style={styles.title}>Vault</Text>
      {anchors.length > 0 && (
        <Text style={styles.subtitle}>
          {anchors.length} {anchors.length === 1 ? 'Anchor' : 'Anchors'}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      {renderHeader()}

      {/* Anchor Grid */}
      <FlatList
        data={anchors}
        renderItem={renderAnchorCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Create Button */}
      {anchors.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={handleCreateAnchor} activeOpacity={0.9}>
          <Plus color={colors.charcoal} size={20} style={styles.fabIcon} />
          <Text style={styles.fabText}>Forge Anchor</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.h1,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
  },
  gridContainer: {
    padding: spacing.md,
    flexGrow: 1,
  },
  row: {
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: typography.lineHeights.body1,
  },
  createButton: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  createButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
  },
  fab: {
    position: 'absolute',
    bottom: 120, // Raised to clear the floating tab bar
    right: spacing.lg,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 30,
    elevation: 8,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabIcon: {
    marginRight: spacing.xs,
  },
  fabText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
