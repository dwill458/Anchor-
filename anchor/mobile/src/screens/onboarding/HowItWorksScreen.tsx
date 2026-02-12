/**
 * HowItWorksScreen - Explain the Anchor creation process
 *
 * Features:
 * - 4-step process visualization
 * - Clean, visual design
 * - Progressive disclosure to keep it simple
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
import { ArrowRight, Target, Sparkles, Flame, Play } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'HowItWorks'>;

const STEPS = [
  {
    number: '1',
    title: 'Set Your Intention',
    description: 'Name what you want to manifest. Be specific. Make it real.',
    icon: Target,
  },
  {
    number: '2',
    title: 'Forge Your Sigil',
    description: 'We transform your intention into a sacred visual symbol—your personal Anchor.',
    icon: Sparkles,
  },
  {
    number: '3',
    title: 'Charge with Ritual',
    description: 'Lock in the energy through embodied practice—breath, focus, emotion.',
    icon: Flame,
  },
  {
    number: '4',
    title: 'Activate Daily',
    description: 'Spend 30-60 seconds with your Anchor each day to reinforce your path.',
    icon: Play,
  },
];

export const HowItWorksScreen: React.FC<Props> = ({ navigation }) => {
  const handleContinue = () => {
    navigation.navigate('DailyLoop');
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
          <Text style={styles.headline}>How It Works</Text>
          <Text style={styles.subheadline}>
            Four simple steps to create your first Anchor
          </Text>

          {/* Steps */}
          <View style={styles.stepsContainer}>
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isLast = index === STEPS.length - 1;

              return (
                <View key={step.number}>
                  <View style={styles.stepCard}>
                    <View style={styles.stepIconContainer}>
                      <Icon size={24} color={colors.gold} strokeWidth={2} />
                    </View>
                    <View style={styles.stepContent}>
                      <View style={styles.stepHeader}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>{step.number}</Text>
                        </View>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                      </View>
                      <Text style={styles.stepDescription}>{step.description}</Text>
                    </View>
                  </View>
                  {!isLast && <View style={styles.stepConnector} />}
                </View>
              );
            })}
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
            accessibilityRole="button"
            accessibilityLabel="Next"
          >
            <LinearGradient
              colors={[colors.gold, '#B89B2F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueGradient}
            >
              <Text style={styles.continueText}>Next</Text>
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
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  stepsContainer: {
    marginTop: spacing.md,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(37, 37, 41, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    padding: spacing.lg,
    gap: spacing.md,
  },
  stepIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...typography.heading,
    fontSize: 12,
    color: colors.navy,
    fontWeight: '700',
  },
  stepTitle: {
    ...typography.heading,
    fontSize: typography.sizes.h4,
    color: colors.text.primary,
    flex: 1,
  },
  stepDescription: {
    ...typography.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  stepConnector: {
    width: 2,
    height: spacing.md,
    backgroundColor: 'rgba(212, 175, 55, 0.3)',
    marginLeft: spacing.lg + 23,
    marginVertical: spacing.xs,
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
