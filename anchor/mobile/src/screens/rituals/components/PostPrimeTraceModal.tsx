import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { SvgXml } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { Anchor } from '@/types';
import { OptimizedImage, PremiumAnchorGlow } from '@/components/common';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { colors, spacing, typography } from '@/theme';

const SIGIL_SIZE = 88;

interface PostPrimeTraceModalProps {
  visible: boolean;
  anchor: Anchor;
  onTrace: () => void;
  onSkip: () => void;
}

export const PostPrimeTraceModal: React.FC<PostPrimeTraceModalProps> = ({
  visible,
  anchor,
  onTrace,
  onSkip,
}) => {
  const reduceMotionEnabled = useReduceMotionEnabled();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(reduceMotionEnabled ? 1 : 0.96);
  const sigilSvg = anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;

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

  if (!visible) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} accessible={false} testID="post-prime-trace-modal">
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, containerStyle]}>
          <View style={styles.sigilArea}>
            <View style={styles.sigilGlowWrap}>
              <PremiumAnchorGlow
                size={SIGIL_SIZE}
                state="active"
                variant="ritual"
                reduceMotionEnabled={reduceMotionEnabled}
              />
            </View>
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
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Trace"
            testID="post-prime-trace-button"
          >
            <Text style={styles.primaryButtonText}>Trace</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onSkip}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Skip"
            testID="post-prime-skip-button"
          >
            <Text style={styles.secondaryButtonText}>Skip</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
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
  container: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: 'rgba(10, 13, 18, 0.88)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  sigilArea: {
    width: SIGIL_SIZE * 1.7,
    height: SIGIL_SIZE * 1.7,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  sigilGlowWrap: {
    position: 'absolute',
    width: SIGIL_SIZE * 1.7,
    height: SIGIL_SIZE * 1.7,
  },
  sigilContent: {
    width: SIGIL_SIZE,
    height: SIGIL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodySerifItalic,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.bone,
  },
});
