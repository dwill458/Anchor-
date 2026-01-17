/**
 * Anchor App - Charge Choice Screen
 *
 * Let users choose between Quick (30s) or Deep (5min) charge.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Svg, { SvgXml } from 'react-native-svg';
import { useAnchorStore } from '../../stores/anchorStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';

const { width } = Dimensions.get('window');
const SIGIL_SIZE = width * 0.15; // Very small to save space

type ChargeChoiceRouteProp = RouteProp<RootStackParamList, 'ChargingRitual'>;
type ChargeChoiceNavigationProp = StackNavigationProp<RootStackParamList, 'ChargingRitual'>;

export const ChargeChoiceScreen: React.FC = () => {
  const navigation = useNavigation<ChargeChoiceNavigationProp>();
  const route = useRoute<ChargeChoiceRouteProp>();
  const { anchorId, chargeType } = route.params;

  const { getAnchorById } = useAnchorStore();
  const anchor = getAnchorById(anchorId);

  /**
   * Navigate to Quick Charge (30s) via Emotional Priming
   */
  const handleQuickCharge = (): void => {
    navigation.navigate('EmotionalPriming', {
      anchorId,
      intention: anchor?.intentionText || '',
      chargeType: 'quick'
    });
  };

  /**
   * Navigate to Deep Charge (5min) via Emotional Priming
   */
  const handleDeepCharge = (): void => {
    navigation.navigate('EmotionalPriming', {
      anchorId,
      intention: anchor?.intentionText || '',
      chargeType: 'deep'
    });
  };

  /**
   * Navigate to Custom Prime (user-selected time)
   */
  const handleCustomPrime = (): void => {
    // TODO: Navigate to custom time selection screen
    // For now, default to Deep Prime
    navigation.navigate('EmotionalPriming', {
      anchorId,
      intention: anchor?.intentionText || '',
      chargeType: 'deep'
    });
  };

  if (!anchor) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Anchor not found</Text>
      </SafeAreaView>
    );
  }

  const handleBack = (): void => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prime Your Anchor</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.subtitle}>Choose your focus session</Text>
        </View>

        {/* Sigil Preview */}
        <View style={styles.sigilContainer}>
          <SvgXml
            xml={anchor.baseSigilSvg}
            width={SIGIL_SIZE * 2.5}
            height={SIGIL_SIZE * 2.5}
          />
        </View>

        {/* Educational Content - Why Prime? */}
        <View style={styles.educationCard}>
          <View style={styles.educationIconContainer}>
            <Text style={styles.educationIcon}>💡</Text>
          </View>
          <Text style={styles.educationTitle}>Why Prime Your Anchor?</Text>
          <Text style={styles.educationText}>
            Priming activates your anchor through focused intention and emotional resonance.
            This process strengthens the neural connection between the symbol and your goal,
            making it a powerful trigger for motivation and clarity.
          </Text>
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
            <Text style={styles.optionTitle}>Quick Prime</Text>
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
            <Text style={styles.optionTitle}>Deep Prime</Text>
            <Text style={styles.optionDuration}>~5 minutes</Text>
            <Text style={styles.optionDescription}>
              Guided 5-phase session. Stronger, longer-lasting results.
            </Text>
          </TouchableOpacity>

          {/* Custom Prime */}
          <TouchableOpacity
            style={[styles.optionCard, styles.customOption]}
            onPress={handleCustomPrime}
            activeOpacity={0.8}
          >
            <View style={styles.optionIcon}>
              <Text style={styles.iconText}>⏱️</Text>
            </View>
            <Text style={styles.optionTitle}>Custom Prime</Text>
            <Text style={styles.optionDuration}>Choose your time</Text>
            <Text style={styles.optionDescription}>
              Set a custom duration for your priming session.
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    paddingBottom: 120, // ample space for scrolling
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(26, 26, 29, 0.6)',
  },
  backIcon: {
    fontSize: 22,
    color: colors.gold,
  },
  headerTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  sigilContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.sm,
  },
  educationCard: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    padding: spacing.lg,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    borderRadius: spacing.sm,
  },
  educationIconContainer: {
    marginBottom: spacing.xs,
  },
  educationIcon: {
    fontSize: 24,
  },
  educationTitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  educationText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
  },
  intentionContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 0,
    paddingTop: spacing.xs,
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
    paddingHorizontal: spacing.lg,
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
  customOption: {
    borderColor: colors.deepPurple,
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
