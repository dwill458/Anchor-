/**
 * ReframeScreen - Reframe the problem and position Anchor as solution
 *
 * Features:
 * - Segment-tuned copy (Athlete / Entrepreneur / Wellness)
 * - Identifies the pain point
 * - Positions Anchor as the bridge between intention and action
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
import { ArrowRight, Target, Zap } from 'lucide-react-native';
import { useAuthStore } from '@/stores/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Reframe'>;

const SEGMENT_CONTENT = {
  athlete: {
    headline: 'Your Mind is Your Edge',
    problem: 'Training your body is easy. Training your mind to stay consistent, focused, and resilient? That\'s the real challenge.',
    solution: 'Anchor transforms your mental game into a daily ritual - giving you the same discipline for your mindset that you have for your training.',
    icon: Target,
  },
  entrepreneur: {
    headline: 'Intentions Without Systems Fade',
    problem: 'You set big goals. You have the vision. But without a daily practice to anchor your focus, clarity slips away in the noise.',
    solution: 'Anchor gives you a ritual to turn fleeting intentions into consistent action - so you build momentum, not just motivation.',
    icon: Zap,
  },
  wellness: {
    headline: 'Peace Requires Practice',
    problem: 'You want to feel grounded, calm, and connected. But the chaos of daily life makes it hard to hold onto that feeling.',
    solution: 'Anchor creates a personal ritual that brings you back to center - so inner peace becomes a daily practice, not just a wish.',
    icon: Target,
  },
};

export const ReframeScreen: React.FC<Props> = ({ navigation }) => {
  const onboardingSegment = useAuthStore((state) => state.onboardingSegment);
  const segment = onboardingSegment || 'entrepreneur';
  const content = SEGMENT_CONTENT[segment];
  const Icon = content.icon;

  const handleContinue = () => {
    navigation.navigate('HowItWorks');
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
          {/* Icon */}
          <View style={styles.iconWrapper}>
            <View style={styles.iconContainer}>
              <Icon size={32} color={colors.gold} strokeWidth={2} />
            </View>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>{content.headline}</Text>

          {/* Problem Statement */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>The Problem</Text>
            <Text style={styles.cardText}>{content.problem}</Text>
          </View>

          {/* Solution Statement */}
          <View style={[styles.card, styles.cardHighlight]}>
            <Text style={[styles.cardLabel, styles.cardLabelHighlight]}>
              The Solution
            </Text>
            <Text style={[styles.cardText, styles.cardTextHighlight]}>
              {content.solution}
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
              <Text style={styles.continueText}>Show Me How</Text>
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
  iconWrapper: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    ...typography.heading,
    fontSize: typography.sizes.h1,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 40,
  },
  card: {
    backgroundColor: 'rgba(37, 37, 41, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.2)',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardHighlight: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  cardLabel: {
    ...typography.body,
    fontSize: typography.sizes.caption,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  cardLabelHighlight: {
    color: colors.gold,
  },
  cardText: {
    ...typography.body,
    fontSize: typography.sizes.body1,
    color: colors.text.primary,
    lineHeight: 24,
  },
  cardTextHighlight: {
    color: colors.bone,
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
