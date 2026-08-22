/**
 * PracticeExitConfirmationModal
 *
 * Canonical unified exit confirmation modal for all practice modes
 * (Focus, Deep Prime, Visualize, Burn & Release).
 *
 * Design hierarchy:
 * - Centered dark glass card with blurred backdrop.
 * - Mode identity color applied to serif title text.
 * - Reserved gold filled button for "Keep Practicing" (staying is easy default).
 * - De-emphasized plain text for "Exit" (leaving requires deliberate intent).
 */

import React, { useEffect, useMemo } from 'react';
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

export type PracticeExitMode =
  | 'focus'
  | 'deep_prime'
  | 'deepPrime'
  | 'visualize'
  | 'release'
  | 'generic';

export interface PracticeExitConfirmationModalProps {
  visible: boolean;
  mode?: PracticeExitMode | string;
  title?: string;
  titleColor?: string;
  body?: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onBackdropPress?: () => void;
}

const DEFAULT_BODY = 'You will need to start over if you leave now.';
const DEFAULT_PRIMARY_LABEL = 'Keep Practicing';
const DEFAULT_SECONDARY_LABEL = 'Exit';

function resolveModeMetadata(mode?: PracticeExitMode | string): {
  defaultTitle: string;
  color: string;
} {
  switch (mode) {
    case 'focus':
      return {
        defaultTitle: 'Exit Focus?',
        color: colors.practiceMode.focus.primary, // purple (#AD99D2)
      };
    case 'deep_prime':
    case 'deepPrime':
      return {
        defaultTitle: 'Exit Deep Prime?',
        color: colors.bronze, // bronze (#CD7F32)
      };
    case 'visualize':
      return {
        defaultTitle: 'Exit Visualize?',
        color: colors.practiceMode.visualize.primary, // blue (#78B4D1)
      };
    case 'release':
      return {
        defaultTitle: 'Exit Burn & Release?',
        color: colors.practiceMode.release.primary, // orange (#C8875A)
      };
    case 'generic':
    default:
      return {
        defaultTitle: 'Exit Practice?',
        color: colors.gold, // gold (#D4AF37)
      };
  }
}

export const PracticeExitConfirmationModal: React.FC<PracticeExitConfirmationModalProps> = ({
  visible,
  mode = 'generic',
  title,
  titleColor,
  body = DEFAULT_BODY,
  primaryCtaLabel = DEFAULT_PRIMARY_LABEL,
  secondaryCtaLabel = DEFAULT_SECONDARY_LABEL,
  onPrimary,
  onSecondary,
  onBackdropPress,
}) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  const modeMeta = useMemo(() => resolveModeMetadata(mode), [mode]);
  const resolvedTitle = title ?? modeMeta.defaultTitle;
  const resolvedTitleColor = titleColor ?? modeMeta.color;

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
      {/* Backdrop — dismisses to primary action (Keep Practicing) */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onBackdropPress ?? onPrimary}
        accessibilityRole="button"
        accessibilityLabel="Dismiss modal"
        testID="confirm-modal-backdrop"
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
        <Text style={[styles.title, { color: resolvedTitleColor }]}>
          {resolvedTitle}
        </Text>
        <Text style={styles.body}>{body}</Text>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onPrimary}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={primaryCtaLabel}
            testID="confirm-modal-primary-btn"
          >
            <Text style={styles.primaryButtonText}>{primaryCtaLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onSecondary}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={secondaryCtaLabel}
            hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
            testID="confirm-modal-secondary-btn"
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
