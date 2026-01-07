/**
 * Anchor App - Charge Choice Screen
 *
 * Let users choose between Quick (30s) or Deep (5min) charge.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Svg, { SvgXml } from 'react-native-svg';
import { useAnchorStore } from '../../stores/anchorStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';

const { width } = Dimensions.get('window');
const SIGIL_SIZE = width * 0.5;

type ChargeChoiceRouteProp = RouteProp<RootStackParamList, 'ChargingRitual'>;

export const ChargeChoiceScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ChargeChoiceRouteProp>();
  const { anchorId } = route.params;

  const { getAnchorById } = useAnchorStore();
  const anchor = getAnchorById(anchorId);

  /**
   * Navigate to Quick Charge (30s)
   */
  const handleQuickCharge = (): void => {
    // @ts-expect-error - Navigation types will be set up later
    navigation.navigate('QuickCharge', { anchorId });
  };

  /**
   * Navigate to Deep Charge (5min)
   */
  const handleDeepCharge = (): void => {
    // @ts-expect-error - Navigation types will be set up later
    navigation.navigate('DeepCharge', { anchorId });
  };

  if (!anchor) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Anchor not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Charge Your Anchor</Text>
        <Text style={styles.subtitle}>Choose your focus session</Text>
      </View>

      {/* Sigil Preview */}
      <View style={styles.sigilContainer}>
        <SvgXml
          xml={anchor.baseSigilSvg}
          width={SIGIL_SIZE}
          height={SIGIL_SIZE}
        />
      </View>

      {/* Intention */}
      <View style={styles.intentionContainer}>
        <Text style={styles.intentionLabel}>Your Intention</Text>
        <Text style={styles.intentionText}>"{anchor.intentionText}"</Text>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {/* Quick Charge */}
        <TouchableOpacity
          style={[styles.optionCard, styles.quickOption]}
          onPress={handleQuickCharge}
          activeOpacity={0.8}
        >
          <View style={styles.optionIcon}>
            <Text style={styles.iconText}>⚡</Text>
          </View>
          <Text style={styles.optionTitle}>Quick Charge</Text>
          <Text style={styles.optionDuration}>30 seconds</Text>
          <Text style={styles.optionDescription}>
            Fast focused session. Perfect for a quick boost.
          </Text>
        </TouchableOpacity>

        {/* Deep Charge */}
        <TouchableOpacity
          style={[styles.optionCard, styles.deepOption]}
          onPress={handleDeepCharge}
          activeOpacity={0.8}
        >
          <View style={styles.optionIcon}>
            <Text style={styles.iconText}>🔥</Text>
          </View>
          <Text style={styles.optionTitle}>Deep Charge</Text>
          <Text style={styles.optionDuration}>~5 minutes</Text>
          <Text style={styles.optionDescription}>
            Guided 5-phase session. Stronger, longer-lasting results.
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
  },
  sigilContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  intentionContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  intentionLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  intentionText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body1,
  },
  optionsContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  optionCard: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 2,
    alignItems: 'center',
  },
  quickOption: {
    borderColor: colors.gold,
  },
  deepOption: {
    borderColor: colors.bronze,
  },
  optionIcon: {
    marginBottom: spacing.md,
  },
  iconText: {
    fontSize: 48,
  },
  optionTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  optionDuration: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  optionDescription: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body2,
  },
  errorText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
