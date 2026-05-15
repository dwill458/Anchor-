import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { OptimizedImage, SigilSvg } from '@/components/common';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';

type NavigationProp = StackNavigationProp<RootStackParamList, 'SaveProgress'>;
type SaveProgressRouteProp = RouteProp<RootStackParamList, 'SaveProgress'>;

export const SaveProgressScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SaveProgressRouteProp>();
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding);
  const anchor = useAnchorStore((state) => state.getAnchorById(route.params.anchorId));
  const enhancedImageUrl = anchor?.enhancedImageUrl ?? null;
  const sigilSvg = anchor?.reinforcedSigilSvg ?? anchor?.baseSigilSvg ?? '';

  const handleCreateAccount = () => {
    navigation.navigate('SignUp', {
      context: 'save_progress',
      initialTab: 'signup',
    });
  };

  const handleSignIn = () => {
    navigation.navigate('Login', {
      context: 'save_progress',
    });
  };

  const handleSkip = () => {
    completeOnboarding();
    navigation.replace('Vault');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background.primary, '#0A0C0F', colors.background.primary]}
        style={styles.gradient}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>SAVE PROGRESS</Text>
          <Text style={styles.title}>Your first anchor is ready.</Text>
          <Text style={styles.body}>
            Create a free account now so this anchor stays with you before you enter the Vault.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.previewFrame}>
            {enhancedImageUrl ? (
              <OptimizedImage uri={enhancedImageUrl} style={styles.previewImage} resizeMode="cover" />
            ) : sigilSvg ? (
              <View style={styles.previewSigilWrap}>
                <SigilSvg xml={sigilSvg} width={172} height={172} color={colors.gold} />
              </View>
            ) : (
              <Text style={styles.previewGlyph}>⚓</Text>
            )}
            {enhancedImageUrl ? <View pointerEvents="none" style={styles.previewVignette} /> : null}
          </View>
          <Text style={styles.previewLabel}>
            {anchor?.intentionText?.trim() || 'Forged during onboarding'}
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCreateAccount}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.gold, '#B89B2F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryText}>Create Account</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSignIn}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryText}>I already have an account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  eyebrow: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.caption,
    color: colors.gold,
    letterSpacing: 2,
  },
  title: {
    ...typography.heading,
    fontSize: typography.sizes.h1,
    color: colors.text.primary,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    fontSize: typography.sizes.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  previewFrame: {
    width: 240,
    height: 240,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 8,
  },
  previewGlyph: {
    fontSize: 48,
    color: colors.gold,
  },
  previewSigilWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 12, 16, 0.18)',
  },
  previewImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
  },
  previewVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 12, 16, 0.18)',
  },
  previewLabel: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    maxWidth: 280,
    marginTop: spacing.sm,
  },
  footer: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
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
    alignItems: 'center',
    justifyContent: 'center',
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
