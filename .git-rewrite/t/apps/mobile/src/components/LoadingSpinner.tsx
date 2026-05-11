/**
 * Anchor App - Loading Spinner Component
 *
 * Accessible loading indicator with optional message.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '@/theme';

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  color?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  message,
  color = colors.gold,
}) => {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinAnimation.start();

    return () => spinAnimation.stop();
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getSize = (): number => {
    switch (size) {
      case 'small':
        return 24;
      case 'large':
        return 64;
      case 'medium':
      default:
        return 40;
    }
  };

  const spinnerSize = getSize();

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={message || 'Loading'}
      accessibilityLiveRegion="polite"
    >
      <Animated.View
        style={[
          styles.spinner,
          {
            width: spinnerSize,
            height: spinnerSize,
            borderRadius: spinnerSize / 2,
            borderTopColor: color,
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
            borderWidth: spinnerSize / 10,
            transform: [{ rotate: spin }],
          },
        ]}
      />
      {message && (
        <Text style={styles.message} accessibilityLabel={`Loading: ${message}`}>
          {message}
        </Text>
      )}
    </View>
  );
};

export const LoadingOverlay: React.FC<LoadingSpinnerProps> = (props) => {
  return (
    <View style={styles.overlay}>
      <LinearGradient
        colors={[colors.navy, colors.charcoal]}
        style={StyleSheet.absoluteFill}
      />
      <LoadingSpinner {...props} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    // Border styles applied dynamically
  },
  message: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
