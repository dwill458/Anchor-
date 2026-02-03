/**
 * Anchor App - Charge Complete Screen
 *
 * Completion screen after successful charging ritual.
 * Premium feel: gold glow, clear CTAs, satisfying closure.
 * Zen Architect theme.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useAnchorStore } from '@/stores/anchorStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { SigilSvg } from '@/components/common';
import { safeHaptics } from '@/utils/haptics';
import { playSoundEffect } from '@/utils/soundEffects';

const { width } = Dimensions.get('window');
const SYMBOL_SIZE = 160;

type ChargeCompleteRouteProp = RouteProp<RootStackParamList, 'ChargeComplete'>;
type ChargeCompleteNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ChargeComplete'
>;

export const ChargeCompleteScreen: React.FC = () => {
  const navigation = useNavigation<ChargeCompleteNavigationProp>();
  const route = useRoute<ChargeCompleteRouteProp>();
  const { anchorId } = route.params;

  const { getAnchorById } = useAnchorStore();
  const anchor = getAnchorById(anchorId);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE: Entry animation + success haptic
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    void playSoundEffect('completion');
    // Success haptic
    void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);

    // Fade in + scale up
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Glow pulse loop
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    glowLoop.start();

    return () => glowLoop.stop();
  }, []);

  // ══════════════════════════════════════════════════════════════
  // NULL SAFETY: Defensive handling
  // ══════════════════════════════════════════════════════════════

  if (!anchor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Anchor not found. Returning to vault...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════

  const handleSaveToVault = () => {
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate back to vault (anchor is already saved by RitualScreen)
    navigation.navigate('Vault');
  };

  const handleActivateNow = () => {
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('ActivationRitual', {
      anchorId,
      activationType: 'visual',
    });
  };

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>

        {/* Status Text */}
        <Text style={styles.statusTitle}>Anchor Charged</Text>
        <Text style={styles.statusSubtitle}>Your intention is locked in</Text>

        {/* Hero Symbol with Glow */}
        <Animated.View style={[styles.symbolWrapper, { opacity: glowOpacity }]}>
          <View style={styles.glowContainer}>
            <SigilSvg xml={anchor.baseSigilSvg} width={SYMBOL_SIZE} height={SYMBOL_SIZE} />
          </View>
        </Animated.View>

        {/* Intention Display */}
        <View style={styles.intentionContainer}>
          <Text style={styles.intentionText} numberOfLines={2}>
            "{anchor.intentionText}"
          </Text>
        </View>

        {/* CTAs */}
        <View style={styles.ctaSection}>
          {/* Primary CTA: Save to Vault */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSaveToVault}
            activeOpacity={0.8}
          >
            <BlurView intensity={10} tint="dark" style={styles.buttonBlur}>
              <View style={styles.primaryButtonContent}>
                <Text style={styles.primaryButtonText}>Save to Vault</Text>
              </View>
            </BlurView>
          </TouchableOpacity>

          {/* Secondary CTA: Activate Now */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleActivateNow}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Activate Now</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },

  // ────────────────────────────────────────────────────────────
  // Success Icon
  // ────────────────────────────────────────────────────────────
  iconContainer: {
    marginTop: spacing.xxxl + spacing.xl,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.gold}20`,
    borderWidth: 2,
    borderColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  checkIcon: {
    fontSize: 40,
    color: colors.gold,
    fontWeight: 'bold',
  },

  // ────────────────────────────────────────────────────────────
  // Status Text
  // ────────────────────────────────────────────────────────────
  statusTitle: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    marginBottom: spacing.xxl,
    textAlign: 'center',
  },

  // ────────────────────────────────────────────────────────────
  // Symbol with Glow
  // ────────────────────────────────────────────────────────────
  symbolWrapper: {
    marginBottom: spacing.xl,
  },
  glowContainer: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
  },

  // ────────────────────────────────────────────────────────────
  // Intention Display
  // ────────────────────────────────────────────────────────────
  intentionContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  intentionText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: typography.lineHeights.body1,
  },

  // ────────────────────────────────────────────────────────────
  // CTA Section
  // ────────────────────────────────────────────────────────────
  ctaSection: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    marginTop: 'auto',
    marginBottom: spacing.xxxl,
  },

  // Primary Button
  primaryButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  buttonBlur: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  primaryButtonContent: {
    paddingVertical: spacing.md + spacing.xs,
    paddingHorizontal: spacing.xl,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: `${colors.gold}15`,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    letterSpacing: 0.5,
  },

  // Secondary Button
  secondaryButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    textDecorationLine: 'underline',
  },

  // ────────────────────────────────────────────────────────────
  // Error State
  // ────────────────────────────────────────────────────────────
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
