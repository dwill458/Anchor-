/**
 * Sigil Hero Card Component
 *
 * Premium animated sigil display with:
 * - Glassmorphic container
 * - Breathing animation
 * - Shared premium glow ring treatment
 * - State-based visual intensity
 * - Reduce motion support
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import Reanimated, {
  Easing as ReanimatedEasing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { SvgXml } from 'react-native-svg';
import { Anchor } from '@/types';
import { colors, spacing } from '@/theme';
import { AnchorState } from '../utils/anchorStateHelpers';
import { OptimizedImage, PremiumAnchorGlow, PremiumGlowState } from '@/components/common';

const { width } = Dimensions.get('window');
const SIGIL_SIZE = width * 0.6;

interface SigilHeroCardProps {
  anchor: Anchor;
  anchorState: AnchorState;
  reduceMotionEnabled: boolean;
  activationRippleNonce?: number;
  deepChargeHaloActive?: boolean;
}

const mapAnchorStateToGlowState = (state: AnchorState): PremiumGlowState => {
  if (state === 'active') return 'active';
  if (state === 'charged') return 'charged';
  if (state === 'stale') return 'stale';
  return 'dormant';
};

export const SigilHeroCard: React.FC<SigilHeroCardProps> = ({
  anchor,
  anchorState,
  reduceMotionEnabled,
  activationRippleNonce = 0,
  deepChargeHaloActive = false,
}) => {
  const breathScale = useRef(new Animated.Value(1)).current;
  const rippleProgress = useSharedValue(0);
  const haloProgress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotionEnabled) {
      breathScale.setValue(1);
      return;
    }

    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breathScale, {
          toValue: 1.02,
          duration: 2100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathScale, {
          toValue: 1,
          duration: 2100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    breathing.start();
    return () => breathing.stop();
  }, [breathScale, reduceMotionEnabled]);

  useEffect(() => {
    if (reduceMotionEnabled || activationRippleNonce === 0) {
      cancelAnimation(rippleProgress);
      rippleProgress.value = 0;
      return;
    }

    rippleProgress.value = 0;
    rippleProgress.value = withTiming(1, {
      duration: 360,
      easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
    });
  }, [activationRippleNonce, reduceMotionEnabled, rippleProgress]);

  useEffect(() => {
    if (reduceMotionEnabled || !deepChargeHaloActive) {
      cancelAnimation(haloProgress);
      haloProgress.value = 0;
      return;
    }

    haloProgress.value = withRepeat(
      withTiming(1, {
        duration: 4000,
        easing: ReanimatedEasing.inOut(ReanimatedEasing.sin),
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(haloProgress);
      haloProgress.value = 0;
    };
  }, [deepChargeHaloActive, reduceMotionEnabled, haloProgress]);

  const rippleStyle = useAnimatedStyle(() => {
    const scale = interpolate(rippleProgress.value, [0, 1], [0.92, 1.88]);
    const opacity = interpolate(rippleProgress.value, [0, 0.16, 1], [0, 0.72, 0]);

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const breathingHaloStyle = useAnimatedStyle(() => {
    const scale = interpolate(haloProgress.value, [0, 1], [1, 1.16]);
    const opacity = interpolate(haloProgress.value, [0, 1], [0.12, 0.32]);

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const glowState = mapAnchorStateToGlowState(anchorState);

  return (
    <View style={styles.container}>
      <View style={[styles.glassmorphicCard, anchor.isCharged && styles.chargedCard]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={anchor.isCharged ? 30 : 20} tint="dark" style={StyleSheet.absoluteFill}>
            {renderSigilContent()}
          </BlurView>
        ) : (
          <View style={[styles.androidFallback, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>{renderSigilContent()}</View>
        )}
      </View>
    </View>
  );

  function renderSigilContent() {
    return (
      <View style={styles.content}>
        <PremiumAnchorGlow
          size={SIGIL_SIZE}
          state={glowState}
          variant="detail"
          reduceMotionEnabled={reduceMotionEnabled}
        />

        {!reduceMotionEnabled && deepChargeHaloActive && (
          <Reanimated.View pointerEvents="none" style={[styles.deepChargeHalo, breathingHaloStyle]} />
        )}

        {!reduceMotionEnabled && activationRippleNonce > 0 && (
          <Reanimated.View pointerEvents="none" style={[styles.activateRipple, rippleStyle]} />
        )}

        <Animated.View
          style={[
            styles.sigilContainer,
            {
              transform: [{ scale: breathScale }],
            },
          ]}
        >
          {anchor.enhancedImageUrl ? (
            <OptimizedImage
              uri={anchor.enhancedImageUrl}
              style={styles.sigilImage}
              resizeMode="cover"
            />
          ) : anchor.baseSigilSvg ? (
            <SvgXml xml={anchor.baseSigilSvg} width={SIGIL_SIZE} height={SIGIL_SIZE} />
          ) : (
            <View style={styles.placeholderContainer}>
              <Animated.Text style={styles.placeholderText}>◈</Animated.Text>
            </View>
          )}
        </Animated.View>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  glassmorphicCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `rgba(212, 175, 55, 0.15)`,
    backgroundColor:
      Platform.OS === 'ios' ? 'transparent' : 'rgba(26, 26, 29, 0.9)',
  },
  chargedCard: {
    borderColor: `rgba(212, 175, 55, 0.4)`,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
  androidFallback: {
    backgroundColor: 'rgba(26, 26, 29, 0.9)',
  },
  content: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  deepChargeHalo: {
    position: 'absolute',
    width: SIGIL_SIZE * 1.28,
    height: SIGIL_SIZE * 1.28,
    borderRadius: (SIGIL_SIZE * 1.28) / 2,
    borderWidth: 2,
    borderColor: `${colors.gold}66`,
    backgroundColor: `${colors.gold}14`,
  },
  activateRipple: {
    position: 'absolute',
    width: SIGIL_SIZE * 1.06,
    height: SIGIL_SIZE * 1.06,
    borderRadius: (SIGIL_SIZE * 1.06) / 2,
    borderWidth: 2,
    borderColor: `${colors.gold}CC`,
  },
  sigilContainer: {
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
  placeholderContainer: {
    width: SIGIL_SIZE,
    height: SIGIL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 72,
    color: colors.gold,
    opacity: 0.6,
  },
});
