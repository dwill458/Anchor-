/**
 * DailyLoopScreen - Explain the daily activation loop
 *
 * Features:
 * - Emphasizes daily ritual and consistency
 * - Shows the compound effect
 * - Builds anticipation for creating first Anchor
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Repeat, TrendingUp, Clock } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'DailyLoop'>;

const BENEFITS = [
  {
    icon: Clock,
    title: 'Just 60 Seconds',
    description: 'Daily activation takes less than a minute—easy to sustain.',
  },
  {
    icon: Repeat,
    title: 'Build Momentum',
    description: 'Consistency compounds. Each day strengthens the neural pathway.',
  },
  {
    icon: TrendingUp,
    title: 'Track Your Streak',
    description: 'Watch your commitment grow as you build an unbroken chain.',
  },
];

export const DailyLoopScreen: React.FC<Props> = ({ navigation }) => {
  const handleContinue = () => {
    navigation.navigate('SaveProgress');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.background.primary, '#0A0C0F', colors.background.primary]}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headline}>The Daily Loop</Text>
            <Text style={styles.subheadline}>
              Transformation happens through repetition, not intensity
            </Text>
          </View>

          {/* Visual Loop */}
          <View style={styles.loopContainer}>
            <View style={styles.loopCard}>
              <View style={styles.loopIconContainer}>
                <Text style={styles.loopEmoji}>☀️</Text>
              </View>
              <Text style={styles.loopLabel}>Morning</Text>
              <Text style={styles.loopText}>Activate your Anchor</Text>
            </View>

            <View style={styles.loopArrow}>
              <ArrowRight size={24} color={colors.gold} strokeWidth={2} />
            </View>

            <View style={styles.loopCard}>
              <View style={styles.loopIconContainer}>
                <Text style={styles.loopEmoji}>🎯</Text>
              </View>
              <Text style={styles.loopLabel}>All Day</Text>
              <Text style={styles.loopText}>Act with clarity</Text>
            </View>

            <View style={styles.loopArrow}>
              <ArrowRight size={24} color={colors.gold} strokeWidth={2} />
            </View>

            <View style={styles.loopCard}>
              <View style={styles.loopIconContainer}>
                <Text style={styles.loopEmoji}>🌙</Text>
              </View>
              <Text style={styles.loopLabel}>Evening</Text>
              <Text style={styles.loopText}>Reflect & renew</Text>
            </View>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            {BENEFITS.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <View key={index} style={styles.benefitCard}>
                  <Icon size={20} color={colors.gold} strokeWidth={2} />
                  <View style={styles.benefitContent}>
                    <Text style={styles.benefitTitle}>{benefit.title}</Text>
                    <Text style={styles.benefitDescription}>
                      {benefit.description}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Callout */}
          <View style={styles.callout}>
            <Text style={styles.calloutText}>
              The hardest part isn't creating your Anchor.{'\n'}
              <Text style={styles.calloutHighlight}>
                It's showing up every day.
              </Text>
            </Text>
          </View>

          {/* Spacer */}
          <View style={styles.spacer} />
        </ScrollView>

        {/* Fixed Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.gold, '#B89B2F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueGradient}
            >
              <Text style={styles.continueText}>I'm Ready</Text>
              <ArrowRight size={20} color={colors.navy} strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  headline: {
    ...typography.heading,
    fontSize: typography.sizes.h1,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subheadline: {
    ...typography.body,
    fontSize: typography.sizes.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  loopContainer: {
    backgroundColor: 'rgba(37, 37, 41, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  loopCard: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  loopIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  loopEmoji: {
    fontSize: 28,
  },
  loopLabel: {
    ...typography.heading,
    fontSize: typography.sizes.h4,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  loopText: {
    ...typography.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
  },
  loopArrow: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  benefitsContainer: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  benefitCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(37, 37, 41, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.2)',
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    ...typography.heading,
    fontSize: typography.sizes.body1,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  benefitDescription: {
    ...typography.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  callout: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    borderRadius: 8,
    padding: spacing.lg,
  },
  calloutText: {
    ...typography.body,
    fontSize: typography.sizes.body1,
    color: colors.text.secondary,
    lineHeight: 24,
    textAlign: 'center',
  },
  calloutHighlight: {
    color: colors.gold,
    fontWeight: '600',
  },
  spacer: {
    height: spacing.xxl,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: 'transparent',
  },
  continueButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  continueGradient: {
    paddingVertical: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  continueText: {
    ...typography.heading,
    fontSize: typography.sizes.button,
    color: colors.navy,
    fontWeight: '600',
  },
});
