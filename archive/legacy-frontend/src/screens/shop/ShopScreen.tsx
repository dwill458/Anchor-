/**
 * Anchor App - Shop Screen
 *
 * Phase 4 feature - Physical anchor prints via Printful
 * Currently a placeholder for Phase 1 MVP
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme';

export const ShopScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Shop</Text>
        <Text style={styles.description}>
          Coming in Phase 4: Order beautiful physical prints of your anchors
          for your space.
        </Text>
        <Text style={styles.emoji}>🖼️</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.md,
  },
  description: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body1,
    marginBottom: spacing.xl,
  },
  emoji: {
    fontSize: 64,
  },
});
