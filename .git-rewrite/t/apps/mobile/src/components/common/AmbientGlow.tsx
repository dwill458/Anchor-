/**
 * Ambient Glow - Animated background atmosphere
 *
 * Creates a subtle animated gradient glow effect for screens.
 * Optional enhancement for premium meditation experience.
 *
 * Features:
 * - Smooth opacity animation (breathing effect)
 * - Customizable intensity
 * - 60fps performance target with useNativeDriver
 * - Subtle depth without distraction
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '@/theme';

export interface AmbientGlowProps {
  intensity?: number; // 0-1, opacity of glow
  duration?: number; // animation cycle duration in ms
  enabled?: boolean; // show/hide glow
}

/**
 * AmbientGlow Component
 *
 * Positioned absolutely behind content to create atmospheric depth.
 * Uses animated opacity to create subtle breathing effect.
 *
 * Note: On web/iOS, a radial gradient would be ideal. On React Native,
 * we use a simple gradient View with opacity animation for performance.
 */
export const AmbientGlow: React.FC<AmbientGlowProps> = ({
  intensity = 0.3,
  duration = 8000,
  enabled = true,
}) => {
  const opacityAnim = useRef(new Animated.Value(enabled ? intensity : 0)).current;

  useEffect(() => {
    if (!enabled) {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      return;
    }

    // Create continuous breathing animation
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: intensity,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: intensity * 0.5,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    glowLoop.start();

    return () => glowLoop.stop();
  }, [enabled, intensity, duration, opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      {/* Gradient glow - creates subtle depth */}
      <View style={styles.glowGradient} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  },

  glowGradient: {
    flex: 1,
    // Use a dark-to-transparent gradient to create subtle glow
    // In a production app, consider using LinearGradient from react-native-linear-gradient
    backgroundColor: `rgba(212, 175, 55, 0.1)`,
  },
});
