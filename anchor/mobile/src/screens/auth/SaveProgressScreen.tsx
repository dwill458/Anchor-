import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { OptimizedImage, SigilSvg } from '@/components/common';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { isCompactPhoneViewport, isShortPhoneViewport } from '@/utils/layout';

type NavigationProp = StackNavigationProp<RootStackParamList, 'SaveProgress'>;
type SaveProgressRouteProp = RouteProp<RootStackParamList, 'SaveProgress'>;

export const SaveProgressScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SaveProgressRouteProp>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding);
  const anchor = useAnchorStore((state) => state.getAnchorById(route.params.anchorId));
  const enhancedImageUrl = anchor?.enhancedImageUrl ?? null;
  const sigilSvg = anchor?.reinforcedSigilSvg ?? anchor?.baseSigilSvg ?? '';
  const isCompactLayout = isCompactPhoneViewport(width, height);
  const isShortLayout = isShortPhoneViewport(height);
  const previewSize = Math.min(width - (isCompactLayout ? 112 : 96), isCompactLayout ? 216 : 240);
  const sigilSize = Math.round(previewSize * 0.72);

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
        <ScrollView
          style={styles.scrollView}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            isCompactLayout && styles.scrollContentCompact,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl },
          ]}
        >
          <View style={[styles.header, isCompactLayout && styles.headerCompact]}>
            <Text style={styles.eyebrow}>SAVE PROGRESS</Text>
            <Text style={[styles.title, isCompactLayout && styles.titleCompact]}>Your first anchor is ready.</Text>
            <Text style={[styles.body, isCompactLayout && styles.bodyCompact]}>
              Create a free account now so this anchor stays with you before you enter the Vault.
            </Text>
          </View>

          <View style={[styles.card, isCompactLayout && styles.cardCompact]}>
            <View
              style={[
                styles.previewFrame,
                isCompactLayout && styles.previewFrameCompact,
                { width: previewSize, height: previewSize, borderRadius: isCompactLayout ? 24 : 28 },
              ]}
            >
              {enhancedImageUrl ? (
                <OptimizedImage uri={enhancedImageUrl} style={styles.previewImage} resizeMode="cover" />
              ) : sigilSvg ? (
                <View style={styles.previewSigilWrap}>
                  <SigilSvg xml={sigilSvg} width={sigilSize} height={sigilSize} color={colors.gold} />
                </View>
              ) : (
                <Text style={styles.previewGlyph}>⚓</Text>
              )}
              {enhancedImageUrl ? <View pointerEvents="none" style={styles.previewVignette} /> : null}
            </View>
            <Text style={[styles.previewLabel, isCompactLayout && styles.previewLabelCompact]}>
              {anchor?.intentionText?.trim() || 'Forged during onboarding'}
            </Text>
          </View>

          <View style={[styles.footer, isShortLayout && styles.footerCompact]}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateAccount}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.gold, '#B89B2F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.primaryGradient, isCompactLayout && styles.primaryGradientCompact]}
              >
                <Text style={styles.primaryText}>Create Account</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, isCompactLayout && styles.secondaryButtonCompact]}
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
        </ScrollView>
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  scrollContentCompact: {
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.lg,
  },
  header: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  headerCompact: {
    marginTop: spacing.lg,
    gap: spacing.xs + 2,
    marginBottom: spacing.lg,
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
  titleCompact: {
    fontSize: typography.sizes.h2,
    lineHeight: 46,
  },
  body: {
    ...typography.body,
    fontSize: typography.sizes.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  bodyCompact: {
    fontSize: typography.sizes.body2,
    lineHeight: 22,
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  cardCompact: {
    gap: spacing.xs + 2,
    marginBottom: spacing.lg,
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
  previewFrameCompact: {
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
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
  previewLabelCompact: {
    marginTop: spacing.xs + 2,
    fontSize: typography.sizes.body2,
    lineHeight: 22,
  },
  footer: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
    marginTop: 'auto',
  },
  footerCompact: {
    gap: spacing.sm,
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
  primaryGradientCompact: {
    paddingVertical: spacing.md,
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
  secondaryButtonCompact: {
    paddingVertical: spacing.sm + 2,
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
