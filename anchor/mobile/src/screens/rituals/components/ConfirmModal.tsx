/**
 * ConfirmModal
 *
 * Reusable blurred confirmation modal for the Burn & Release ceremony.
 * Always kept in the component tree; animates in/out via scale + opacity.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, typography } from '@/theme';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  body: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  body,
  primaryCtaLabel,
  secondaryCtaLabel,
  onPrimary,
  onSecondary,
}) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) });
      scale.value = withTiming(1.0, { duration: 250, easing: Easing.out(Easing.ease) });
    } else {
      opacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
      scale.value = withTiming(0.85, { duration: 200, easing: Easing.in(Easing.ease) });
    }
  }, [visible]);

  const wrapperStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.wrapper, wrapperStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Backdrop — tappable to dismiss */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onSecondary}
        accessibilityLabel="Dismiss modal"
      />

      {/* Blurred backdrop layer */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={40}
          tint="dark"
          style={[StyleSheet.absoluteFill, styles.blurBackdrop]}
          pointerEvents="none"
        />
      ) : (
        <View
          style={[StyleSheet.absoluteFill, styles.androidBackdrop]}
          pointerEvents="none"
        />
      )}

      {/* Dim overlay */}
      <View
        style={[StyleSheet.absoluteFill, styles.dimOverlay]}
        pointerEvents="none"
      />

      {/* Card */}
      <Animated.View
        style={[styles.card, cardStyle]}
        accessibilityViewIsModal={true}
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onPrimary}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={primaryCtaLabel}
          >
            <Text style={styles.primaryButtonText}>{primaryCtaLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onSecondary}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={secondaryCtaLabel}
          >
            <Text style={styles.secondaryButtonText}>{secondaryCtaLabel}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  blurBackdrop: {
    zIndex: 0,
  },
  androidBackdrop: {
    backgroundColor: 'rgba(12, 17, 24, 0.92)',
    zIndex: 0,
  },
  dimOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
  card: {
    zIndex: 10,
    width: '100%',
    backgroundColor: colors.ritual.glassStrong,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    padding: spacing.xl,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: colors.gold,
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  body: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.primary,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  buttonGroup: {
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.button,
    color: colors.background.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
  },
});
