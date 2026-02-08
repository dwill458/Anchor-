/**
 * ZenBackground Component
 *
 * Standardized background with gradient and floating orbs
 * Follows the Zen Architect design system
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme';

interface ZenBackgroundProps {
  showOrbs?: boolean;
  orbOpacity?: number;
  animationDuration?: number;
}

export const ZenBackground: React.FC<ZenBackgroundProps> = ({
  showOrbs = true,
  orbOpacity = 0.1,
  animationDuration = 800,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const IS_ANDROID = Platform.OS === 'android';

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: animationDuration,
      useNativeDriver: true,
    }).start();
  }, [animationDuration]);

  return (
    <>
      {/* Gradient Background */}
      <LinearGradient
        colors={[colors.navy, colors.deepPurple, colors.charcoal]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Floating Orbs (iOS only for better performance) */}
      {showOrbs && !IS_ANDROID && (
        <>
          <Animated.View
            style={[
              styles.orb,
              styles.orb1,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, orbOpacity],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.orb,
              styles.orb2,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, orbOpacity * 0.7],
                }),
              },
            ]}
          />
        </>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orb: {
    position: 'absolute',
    borderRadius: 200,
    backgroundColor: colors.gold,
  },
  orb1: {
    width: 250,
    height: 250,
    top: -80,
    right: -80,
  },
  orb2: {
    width: 180,
    height: 180,
    bottom: 100,
    left: -60,
  },
});
