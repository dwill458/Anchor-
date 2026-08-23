import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop, SvgXml } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { Anchor } from '@/types';
import { OptimizedImage } from '@/components/common';
import { CloseIcon } from '@/components/icons';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useSettingsStore } from '@/stores/settingsStore';
import { AnalyticsService } from '@/services/AnalyticsService';
import { colors, spacing, typography } from '@/theme';

const SIGIL_SIZE = 124; // ~1.4x the prior 88px medallion
const GOLD_BRIGHT = '#F2DFA8';
const boneFaint = 'rgba(244, 239, 230, 0.42)';
const boneSoft = 'rgba(244, 239, 230, 0.68)';

// A bespoke, slow-breathing radial-gradient halo behind the sigil — softer
// and more premium than a flat tinted circle, scoped to this modal only.
const TraceSigilGlow: React.FC<{ size: number; reduceMotionEnabled: boolean }> = ({
  size,
  reduceMotionEnabled,
}) => {
  const breath = useSharedValue(reduceMotionEnabled ? 0.6 : 0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduceMotionEnabled) {
      cancelAnimation(breath);
      cancelAnimation(spin);
      breath.value = 0.6;
      spin.value = 0;
      return;
    }

    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    spin.value = withRepeat(withTiming(360, { duration: 26000, easing: Easing.linear }), -1, false);

    return () => {
      cancelAnimation(breath);
      cancelAnimation(spin);
    };
  }, [breath, spin, reduceMotionEnabled]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.55, 1]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.94, 1.08]) }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
    opacity: interpolate(breath.value, [0, 1], [0.4, 0.75]),
  }));

  const auraSize = size * 2.3;
  const ringSize = size * 1.5;

  return (
    <View style={styles.sigilGlowLayer} pointerEvents="none">
      <Animated.View
        style={[
          { width: auraSize, height: auraSize, alignItems: 'center', justifyContent: 'center' },
          glowStyle,
        ]}
      >
        <Svg width={auraSize} height={auraSize}>
          <Defs>
            <RadialGradient id="traceSigilGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={GOLD_BRIGHT} stopOpacity={0.5} />
              <Stop offset="34%" stopColor={colors.gold} stopOpacity={0.24} />
              <Stop offset="70%" stopColor={colors.gold} stopOpacity={0.07} />
              <Stop offset="100%" stopColor={colors.gold} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={auraSize / 2} cy={auraSize / 2} r={auraSize / 2} fill="url(#traceSigilGlow)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.sigilGlowRing, { width: ringSize, height: ringSize }, ringStyle]}>
        <Svg width={ringSize} height={ringSize}>
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={ringSize / 2 - 1.5}
            stroke={GOLD_BRIGHT}
            strokeWidth={1.25}
            fill="none"
            strokeDasharray="2 10"
            strokeLinecap="round"
            opacity={0.8}
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

interface PostPrimeTraceModalProps {
  visible: boolean;
  anchor: Anchor;
  onTrace: () => void;
  onSkip: () => void;
  compact?: boolean;
  /** Renders the compact CTA in-flow (no absolute floating pill). Ignored unless `compact` is true. */
  inline?: boolean;
  /** Overrides the compact/inline CTA text style, e.g. to match a sibling CTA. */
  textStyle?: StyleProp<TextStyle>;
}

export const PostPrimeTraceModal: React.FC<PostPrimeTraceModalProps> = ({
  visible,
  anchor,
  onTrace,
  onSkip,
  compact = false,
  inline = false,
  textStyle,
}) => {
  const reduceMotionEnabled = useReduceMotionEnabled();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(reduceMotionEnabled ? 1 : 0.96);
  const sigilSvg = anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;

  const setTraceDefaultEnabled = useSettingsStore((state) => state.setTraceDefaultEnabled);
  const recordTraceSkipped = useSettingsStore((state) => state.recordTraceSkipped);
  const resetTraceSkipStreak = useSettingsStore((state) => state.resetTraceSkipStreak);
  const [showTraceDefaultPrompt, setShowTraceDefaultPrompt] = useState(false);

  const handleSkipPress = useCallback(() => {
    setShowTraceDefaultPrompt(true);
  }, []);

  const handleCancelSkipPrompt = useCallback(() => {
    setShowTraceDefaultPrompt(false);
  }, []);

  const handleDisableTraceDefault = useCallback(() => {
    setShowTraceDefaultPrompt(false);
    setTraceDefaultEnabled(false);
    resetTraceSkipStreak();
    AnalyticsService.track('trace_default_disabled', { source: 'post_prime_skip_modal' });
    onSkip();
  }, [onSkip, resetTraceSkipStreak, setTraceDefaultEnabled]);

  const handleKeepTraceDefault = useCallback(() => {
    setShowTraceDefaultPrompt(false);
    recordTraceSkipped();
    AnalyticsService.track('trace_skipped_once', { source: 'post_prime_skip_modal' });
    onSkip();
  }, [onSkip, recordTraceSkipped]);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: reduceMotionEnabled ? 0 : 300 });
      scale.value = withTiming(1, { duration: reduceMotionEnabled ? 0 : 300 });
    } else {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      opacity.value = 0;
      scale.value = reduceMotionEnabled ? 1 : 0.96;
    }

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [opacity, reduceMotionEnabled, scale, visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const cardBreath = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(cardBreath);
      cardBreath.value = 0;
      return;
    }
    if (reduceMotionEnabled) {
      cardBreath.value = 0.5;
      return;
    }
    cardBreath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(cardBreath);
  }, [cardBreath, reduceMotionEnabled, visible]);

  const cardHaloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cardBreath.value, [0, 1], [0.45, 0.85]),
  }));

  if (!visible) {
    return null;
  }

  if (compact) {
    if (inline) {
      return (
        <TouchableOpacity
          style={styles.inlineLink}
          onPress={onTrace}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Trace"
          testID="post-prime-trace-link"
        >
          <Text style={[styles.inlineLinkText, textStyle]}>Trace</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.compactWrap} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.compactLink}
          onPress={onTrace}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Trace"
          testID="post-prime-trace-link"
        >
          <Text style={[styles.compactLinkText, textStyle]}>Trace</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} accessible={false} testID="post-prime-trace-modal">
      <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.overlay}>
        <View style={styles.cardShell}>
          <Animated.View style={[styles.cardHaloOuter, cardHaloStyle]} pointerEvents="none" />
          <Animated.View style={[styles.cardHaloInner, cardHaloStyle]} pointerEvents="none" />

          <Animated.View style={[styles.container, containerStyle]}>
            <View style={styles.sigilArea}>
              <TraceSigilGlow size={SIGIL_SIZE} reduceMotionEnabled={reduceMotionEnabled} />
              <View style={styles.sigilContent}>
                {anchor.enhancedImageUrl ? (
                  <OptimizedImage
                    uri={anchor.enhancedImageUrl}
                    style={styles.sigilImage}
                    resizeMode="cover"
                  />
                ) : (
                  <SvgXml xml={sigilSvg} width={SIGIL_SIZE} height={SIGIL_SIZE} />
                )}
              </View>
            </View>

            <Text style={styles.headline}>Trace to deepen</Text>
            <Text style={styles.body}>
              While you&apos;re primed, trace your anchor again. It only takes 30 seconds.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onTrace}
              activeOpacity={0.86}
              disabled={showTraceDefaultPrompt}
              accessibilityRole="button"
              accessibilityLabel="Trace"
              accessibilityState={{ disabled: showTraceDefaultPrompt }}
              testID="post-prime-trace-button"
            >
              <LinearGradient
                colors={[GOLD_BRIGHT, colors.gold, '#A9832A']}
                locations={[0, 0.55, 1]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.primaryButtonGradient}
              >
                <Text style={styles.primaryButtonText}>Trace</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSkipPress}
              activeOpacity={0.7}
              disabled={showTraceDefaultPrompt}
              accessibilityRole="button"
              accessibilityLabel="Skip"
              accessibilityState={{ disabled: showTraceDefaultPrompt }}
              testID="post-prime-skip-button"
            >
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {showTraceDefaultPrompt ? (
        <View style={styles.modalRoot} accessibilityViewIsModal>
          <Pressable
            style={styles.modalBackdrop}
            onPress={handleCancelSkipPrompt}
            accessibilityRole="button"
            accessibilityLabel="Dismiss modal"
          />
          <View style={styles.modalCard}>
            <Pressable
              onPress={handleCancelSkipPrompt}
              hitSlop={10}
              style={styles.modalCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="post-prime-skip-prompt-cancel"
            >
              <CloseIcon size={12} color={boneFaint} />
            </Pressable>

            <View style={styles.modalEyebrowRow}>
              <View style={styles.modalEyebrowRule} />
              <Text style={styles.modalEyebrow}>Tracing Preference</Text>
            </View>

            <Text style={styles.modalTitle}>Skip tracing by default?</Text>
            <Text style={styles.modalBody}>
              You can skip this step after future Prime sessions. You can always change this in Settings.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.modalBtnPressed]}
                onPress={handleDisableTraceDefault}
                accessibilityRole="button"
                accessibilityLabel="Set as default"
                testID="post-prime-skip-prompt-set-default"
              >
                <Text style={styles.modalPrimaryBtnText}>Set as Default</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.modalSecondaryBtn, pressed && styles.modalSecondaryBtnPressed]}
                onPress={handleKeepTraceDefault}
                accessibilityRole="button"
                accessibilityLabel="Just this time"
                testID="post-prime-skip-prompt-just-once"
              >
                <Text style={styles.modalSecondaryBtnText}>Just This Time</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  compactWrap: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    zIndex: 200,
    elevation: 20,
  },
  compactLink: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.36)',
    backgroundColor: 'rgba(10, 13, 18, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  compactLinkText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    textDecorationLine: 'underline',
    textDecorationColor: colors.gold,
  },
  inlineLink: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  inlineLinkText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
  },
  cardShell: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHaloOuter: {
    position: 'absolute',
    width: '112%',
    aspectRatio: 0.86,
    borderRadius: 48,
    backgroundColor: 'transparent',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 60,
    elevation: 24,
  },
  cardHaloInner: {
    position: 'absolute',
    width: '104%',
    aspectRatio: 0.9,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    backgroundColor: 'transparent',
  },
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.32)',
    backgroundColor: 'rgba(10, 13, 18, 0.92)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 18,
  },
  sigilArea: {
    width: SIGIL_SIZE * 1.85,
    height: SIGIL_SIZE * 1.85,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  sigilGlowLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilGlowRing: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilContent: {
    width: SIGIL_SIZE,
    height: SIGIL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SIGIL_SIZE / 2,
    overflow: 'hidden',
  },
  sigilImage: {
    width: SIGIL_SIZE,
    height: SIGIL_SIZE,
    borderRadius: SIGIL_SIZE / 2,
  },
  headline: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.bone,
    textAlign: 'center',
    letterSpacing: 0.6,
    marginBottom: spacing.sm + 2,
  },
  body: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodySerifItalic,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 25,
    maxWidth: 300,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    width: '100%',
    height: 54,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: spacing.md,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  primaryButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    letterSpacing: 0.6,
  },
  secondaryButton: {
    height: 36,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.bone,
    opacity: 0.7,
    letterSpacing: 0.4,
  },
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 100,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 9, 13, 0.78)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.anchor15.goldLine,
    backgroundColor: colors.anchor15.veil,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  modalEyebrowRule: {
    width: 16,
    height: 1,
    backgroundColor: colors.anchor15.goldLine,
  },
  modalEyebrow: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2,
    color: colors.anchor15.ash,
    textTransform: 'uppercase',
  },
  modalTitle: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontWeight: '500',
    fontSize: 22,
    lineHeight: 28,
    color: colors.anchor15.bone,
    marginBottom: 10,
  },
  modalBody: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 14.5,
    lineHeight: 22,
    color: boneSoft,
    marginBottom: spacing.lg,
  },
  modalActions: {
    gap: 10,
  },
  modalPrimaryBtn: {
    width: '100%',
    height: 50,
    borderRadius: 999,
    backgroundColor: 'rgba(217, 179, 108, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPressed: {
    opacity: 0.85,
  },
  modalPrimaryBtnText: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 2,
    color: colors.anchor15.giltBright,
    textTransform: 'uppercase',
  },
  modalSecondaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.anchor15.hairlineGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalSecondaryBtnText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 14,
    color: colors.anchor15.bone,
  },
});
