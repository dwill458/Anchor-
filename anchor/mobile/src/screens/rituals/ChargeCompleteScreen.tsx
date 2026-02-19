/**
 * Anchor App - Charge Complete Screen
 *
 * Completion screen after successful charging / reinforce ritual.
 * Shows CompletionModal first for one-word reflection, then reveals
 * the standard vault/activate CTAs.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { OptimizedImage, PremiumAnchorGlow } from '@/components/common';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { RitualScaffold } from './components/RitualScaffold';
import { InstructionGlassCard } from './components/InstructionGlassCard';
import { CompletionModal } from './components/CompletionModal';

const { width } = Dimensions.get('window');
const SYMBOL_SIZE = Math.min(width * 0.42, 180);

type ChargeCompleteRouteProp = RouteProp<RootStackParamList, 'ChargeComplete'>;
type ChargeCompleteNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ChargeComplete'
>;

export const ChargeCompleteScreen: React.FC = () => {
  const navigation = useNavigation<ChargeCompleteNavigationProp>();
  const { navigateToPractice } = useTabNavigation();
  const route = useRoute<ChargeCompleteRouteProp>();
  const { anchorId, returnTo } = route.params;

  const { getAnchorById } = useAnchorStore();
  const { recordSession } = useSessionStore();
  const { defaultCharge } = useSettingsStore();
  const reduceMotionEnabled = useReduceMotionEnabled();
  const anchor = getAnchorById(anchorId);

  // Show CompletionModal first before the vault/activate CTAs
  const [completionDone, setCompletionDone] = useState(false);
  const [showCompletion, setShowCompletion] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Only start the main screen animation after reflection is done
  useEffect(() => {
    if (!completionDone) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 540,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 36,
        useNativeDriver: true,
      }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [completionDone, fadeAnim, scaleAnim, glowAnim]);

  const handleSaveToVault = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (returnTo === 'practice') {
      navigateToPractice();
    } else if (returnTo === 'detail') {
      navigation.navigate('AnchorDetail', { anchorId });
    } else {
      navigation.navigate('Vault');
    }
  };

  const handleActivateNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('ActivationRitual', {
      anchorId,
      activationType: 'visual',
    });
  };

  const handleCompletionDone = (reflectionWord?: string) => {
    // Derive reinforce duration from defaultCharge preset
    const presetSeconds: Record<string, number> = {
      '30s': 30, '1m': 60, '2m': 120, '5m': 300, '10m': 600, '20m': 1200,
      custom: (defaultCharge.customMinutes ?? 5) * 60,
    };
    const durationSeconds = presetSeconds[defaultCharge.preset] ?? 300;

    recordSession({
      anchorId,
      type: 'reinforce',
      durationSeconds,
      mode: defaultCharge.mode === 'ritual' ? 'mantra' : 'silent',
      reflectionWord,
      completedAt: new Date().toISOString(),
    });

    setShowCompletion(false);
    setCompletionDone(true);
  };

  if (!anchor) {
    return (
      <RitualScaffold>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Anchor not found. Returning to vault...</Text>
        </View>
      </RitualScaffold>
    );
  }

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.34, 0.76],
  });
  const symbolSvg = anchor.reinforcedSigilSvg || anchor.baseSigilSvg;

  return (
    <>
      <RitualScaffold>
        {completionDone && (
          <Animated.View
            style={[
              styles.content,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.checkIcon}>✓</Text>
            </View>

            <Text style={styles.statusTitle}>Imprint strengthened.</Text>
            <Text style={styles.statusSubtitle}>Your imprint deepens.</Text>

            <Animated.View style={[styles.symbolWrapper, { opacity: glowOpacity }]}>
              <PremiumAnchorGlow
                size={SYMBOL_SIZE}
                state="charged"
                variant="ritual"
                reduceMotionEnabled={reduceMotionEnabled}
              />
              {anchor.enhancedImageUrl ? (
                <OptimizedImage
                  uri={anchor.enhancedImageUrl}
                  style={styles.symbolImage}
                  resizeMode="cover"
                />
              ) : (
                <SvgXml xml={symbolSvg} width={SYMBOL_SIZE} height={SYMBOL_SIZE} />
              )}
            </Animated.View>

            <View style={styles.intentionWrap}>
              <InstructionGlassCard text={`"${anchor.intentionText}"`} />
            </View>

            <View style={styles.ctaSection}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveToVault}
                accessibilityRole="button"
                accessibilityLabel="Save to Vault"
              >
                <Text style={styles.primaryButtonText}>Save to Vault</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleActivateNow}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Activate Now"
              >
                <Text style={styles.secondaryButtonText}>Activate Now</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </RitualScaffold>

      {/* CompletionModal shows first before the vault CTAs */}
      <CompletionModal
        visible={showCompletion}
        sessionType="reinforce"
        anchor={anchor}
        onDone={handleCompletionDone}
      />
    </>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.softGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  checkIcon: {
    fontSize: 36,
    lineHeight: 38,
    color: colors.gold,
    fontWeight: '700',
  },
  statusTitle: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.bone,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  symbolWrapper: {
    width: SYMBOL_SIZE,
    height: SYMBOL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  symbolImage: {
    width: SYMBOL_SIZE,
    height: SYMBOL_SIZE,
    borderRadius: SYMBOL_SIZE / 2,
  },
  intentionWrap: {
    width: '100%',
    maxWidth: 460,
    marginBottom: spacing.xxl,
  },
  ctaSection: {
    width: '100%',
    maxWidth: 460,
    marginTop: 'auto',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.softGlow,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 7,
  },
  primaryButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  secondaryButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textDecorationLine: 'underline',
    textDecorationColor: colors.text.secondary,
  },
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
