/**
 * WelcomeScreen - First onboarding screen
 *
 * Features:
 * - Welcome message
 * - Segment selection (Athlete / Entrepreneur / Wellness)
 * - Premium, calm design with Zen Architect theme
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Activity, Briefcase, Heart } from 'lucide-react-native';
import { useAuthStore, type OnboardingSegment } from '@/stores/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';

const { height } = Dimensions.get('window');

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

const SEGMENTS = [
  {
    id: 'athlete' as OnboardingSegment,
    label: 'Athlete',
    icon: Activity,
    description: 'Peak performance & mental resilience',
  },
  {
    id: 'entrepreneur' as OnboardingSegment,
    label: 'Entrepreneur',
    icon: Briefcase,
    description: 'Focus, clarity & strategic vision',
  },
  {
    id: 'wellness' as OnboardingSegment,
    label: 'Wellness',
    icon: Heart,
    description: 'Inner peace & emotional balance',
  },
];

export const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const setOnboardingSegment = useAuthStore((state) => state.setOnboardingSegment);
  const [selectedSegment, setSelectedSegment] = useState<OnboardingSegment>('entrepreneur');

  const handleContinue = () => {
    setOnboardingSegment(selectedSegment);
    navigation.navigate('Reframe');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.background.primary, '#0A0C0F', colors.background.primary]}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.hero}>
            <Text style={styles.logo}>⚓</Text>
            <Text style={styles.title}>Welcome to Anchor</Text>
            <Text style={styles.subtitle}>
              Transform your intentions into daily rituals
            </Text>
          </View>

          {/* Segment Selection */}
          <View style={styles.segmentSection}>
            <Text style={styles.segmentLabel}>I'm here to:</Text>
            <View style={styles.segmentGrid}>
              {SEGMENTS.map((segment) => {
                const Icon = segment.icon;
                const isSelected = selectedSegment === segment.id;

                return (
                  <TouchableOpacity
                    key={segment.id}
                    style={[
                      styles.segmentCard,
                      isSelected && styles.segmentCardSelected,
                    ]}
                    onPress={() => setSelectedSegment(segment.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.iconContainer,
                      isSelected && styles.iconContainerSelected,
                    ]}>
                      <Icon
                        size={28}
                        color={isSelected ? colors.navy : colors.gold}
                        strokeWidth={2}
                      />
                    </View>
                    <Text style={[
                      styles.segmentTitle,
                      isSelected && styles.segmentTitleSelected,
                    ]}>
                      {segment.label}
                    </Text>
                    <Text style={styles.segmentDescription}>
                      {segment.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* CTA Button */}
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
                <Text style={styles.continueText}>Continue</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: height * 0.08,
    paddingBottom: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
    fontSize: typography.sizes.h1,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    fontSize: typography.sizes.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  segmentSection: {
    flex: 1,
    justifyContent: 'center',
  },
  segmentLabel: {
    ...typography.body,
    fontSize: typography.sizes.body1,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  segmentGrid: {
    gap: spacing.md,
  },
  segmentCard: {
    backgroundColor: 'rgba(37, 37, 41, 0.6)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    padding: spacing.lg,
    alignItems: 'center',
  },
  segmentCardSelected: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: colors.gold,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(15, 20, 25, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconContainerSelected: {
    backgroundColor: colors.gold,
  },
  segmentTitle: {
    ...typography.heading,
    fontSize: typography.sizes.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  segmentTitleSelected: {
    color: colors.gold,
  },
  segmentDescription: {
    ...typography.body,
    fontSize: typography.sizes.body2,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  footer: {
    paddingTop: spacing.lg,
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
    alignItems: 'center',
  },
  continueText: {
    ...typography.heading,
    fontSize: typography.sizes.button,
    color: colors.navy,
    fontWeight: '600',
  },
});
