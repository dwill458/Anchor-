/**
 * SaveProgressScreen - Account gate (optional) before first Anchor creation
 *
 * Features:
 * - Explains value of account (save progress, sync)
 * - Options: Create account, Sign in, or Skip
 * - Strong CTA to create first Anchor
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Cloud, Lock, Zap } from 'lucide-react-native';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ToastProvider';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SaveProgress'>;

const BENEFITS = [
  {
    icon: Cloud,
    text: 'Sync across all devices',
  },
  {
    icon: Lock,
    text: 'Never lose your progress',
  },
  {
    icon: Zap,
    text: 'Unlock advanced features',
  },
];

export const SaveProgressScreen: React.FC<Props> = ({ navigation }) => {
  const { completeOnboarding, setAuthenticated } = useAuthStore();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const navigateToAuth = (routeName: 'SignUp' | 'Login'): boolean => {
    const parent = navigation.getParent();
    const currentRoutes = navigation.getState().routeNames;
    const parentRoutes = parent?.getState().routeNames || [];
    const canNavigate = currentRoutes.includes(routeName) || parentRoutes.includes(routeName);

    if (!canNavigate) return false;

    if (parentRoutes.includes(routeName)) {
      parent?.navigate(routeName as never);
    } else {
      navigation.navigate(routeName as never);
    }
    return true;
  };

  const handleCreateAccount = async () => {
    try {
      setIsLoading(true);
      if (navigateToAuth('SignUp')) {
        return;
      }

      // Fallback: allow onboarding completion without account creation
      await new Promise((resolve) => setTimeout(resolve, 500));
      setAuthenticated(true);
      completeOnboarding();
      toast.success('Welcome to Anchor!');
      // Navigation will be handled by RootNavigator
    } catch (error) {
      toast.error('Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      if (navigateToAuth('Login')) {
        return;
      }

      // Fallback: allow onboarding completion without login
      await new Promise((resolve) => setTimeout(resolve, 500));
      setAuthenticated(true);
      completeOnboarding();
      toast.success('Welcome back!');
    } catch (error) {
      toast.error('Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Skip account creation and complete onboarding
    completeOnboarding();
    // Navigation will be handled by RootNavigator
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
            <Text style={styles.headline}>Save Your Progress</Text>
            <Text style={styles.subheadline}>
              Create a free account to keep your Anchors safe and synced
            </Text>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            {BENEFITS.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <View key={index} style={styles.benefitRow}>
                  <View style={styles.benefitIconContainer}>
                    <Icon size={18} color={colors.gold} strokeWidth={2} />
                  </View>
                  <Text style={styles.benefitText}>{benefit.text}</Text>
                </View>
              );
            })}
          </View>

          {/* Spacer */}
          <View style={styles.spacer} />
        </ScrollView>

        {/* Fixed Footer */}
        <View style={styles.footer}>
          {/* Primary CTA - Create Account */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCreateAccount}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            <LinearGradient
              colors={[colors.gold, '#B89B2F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGradient}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.navy} />
              ) : (
                <>
                  <Text style={styles.primaryText}>Create My First Anchor</Text>
                  <ArrowRight size={20} color={colors.navy} strokeWidth={2.5} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Secondary CTA - Sign In */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSignIn}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <Text style={styles.secondaryText}>Already have an account? Sign in</Text>
          </TouchableOpacity>

          {/* Tertiary CTA - Skip */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <Text style={styles.skipText}>Skip for now</Text>
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
  benefitsContainer: {
    backgroundColor: 'rgba(37, 37, 41, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    padding: spacing.lg,
    gap: spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  benefitIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    ...typography.body,
    fontSize: typography.sizes.body1,
    color: colors.text.primary,
    flex: 1,
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
    gap: spacing.md,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryGradient: {
    paddingVertical: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryText: {
    ...typography.heading,
    fontSize: typography.sizes.button,
    color: colors.navy,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryText: {
    ...typography.body,
    fontSize: typography.sizes.body1,
    color: colors.text.secondary,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  skipText: {
    ...typography.body,
    fontSize: typography.sizes.body2,
    color: colors.text.tertiary,
  },
});
