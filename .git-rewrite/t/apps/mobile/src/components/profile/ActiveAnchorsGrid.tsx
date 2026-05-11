/**
 * Anchor App - ActiveAnchorsGrid Component
 *
 * 2-column grid of charged anchors for profile display.
 * Reuses existing AnchorCard component with redacted labels.
 * Returns null if no anchors to allow parent to show empty state.
 */

import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing } from '@/theme';
import { AnchorCard } from '../cards/AnchorCard';
import { RedactedAnchor, Anchor } from '@/types';

interface ActiveAnchorsGridProps {
  anchors: RedactedAnchor[];
  onAnchorPress?: (anchorId: string) => void;
}

export const ActiveAnchorsGrid: React.FC<ActiveAnchorsGridProps> = ({
  anchors,
  onAnchorPress,
}) => {
  if (anchors.length === 0) {
    return null;
  }

  const handleAnchorPress = (anchor: Anchor) => {
    onAnchorPress?.(anchor.id);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>Active Anchors</Text>

      <FlatList
        data={anchors}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.cardWrapper}
            activeOpacity={0.8}
            onPress={() => onAnchorPress?.(item.id)}
          >
            <AnchorCard
              anchor={{
                // Core required fields
                id: item.id,
                userId: '',
                intentionText: item.displayLabel, // Use redacted label
                category: item.category || 'custom',
                distilledLetters: [],
                baseSigilSvg: item.baseSigilSvg,
                structureVariant: 'balanced',
                isCharged: item.isCharged,
                activationCount: item.activationCount,
                enhancedImageUrl: item.enhancedImageUrl,
                createdAt: item.createdAt,
                updatedAt: item.createdAt,
              } as Anchor}
              onPress={handleAnchorPress}
            />
          </TouchableOpacity>
        )}
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    ...typography.h3,
    color: colors.bone,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardWrapper: {
    width: '48%',
  },
});
