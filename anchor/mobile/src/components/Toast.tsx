/**
 * Anchor App - Custom Toast Component
 *
 * Accessible toast notifications for user feedback.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

const ACCENT_BY_TYPE: Record<ToastType, { color: string; border: string }> = {
  success: { color: colors.gold, border: 'rgba(212, 175, 55, 0.35)' },
  warning: { color: colors.gold, border: 'rgba(212, 175, 55, 0.35)' },
  error: { color: '#EF4444', border: 'rgba(239, 68, 68, 0.35)' },
  info: { color: '#3B82F6', border: 'rgba(59, 130, 246, 0.35)' },
};

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-6)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDismissingRef = useRef(false);

  const handleDismiss = useCallback(() => {
    if (isDismissingRef.current) {
      return;
    }

    isDismissingRef.current = true;

    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -6,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  }, [onDismiss, opacity, translateY]);

  useEffect(() => {
    // Haptic feedback on show
    if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Settle in: subtle fade + drift down, not a slide from off-screen
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss after duration
    dismissTimerRef.current = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [duration, handleDismiss, opacity, translateY, type]);

  const accent = ACCENT_BY_TYPE[type];

  const getIcon = (): string | null => {
    switch (type) {
      case 'success':
        return null; // rendered as a thin-stroke circle-check instead
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  const getAccessibilityLabel = (): string => {
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    return `${typeLabel} notification: ${message}`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={getAccessibilityLabel()}
      accessibilityLiveRegion="polite"
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        accessibilityHint="Double tap to dismiss this notification"
      >
        <View
          style={[
            styles.card,
            { borderColor: accent.border, borderLeftColor: accent.color },
          ]}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          {type === 'success' ? (
            <Svg width={18} height={18} style={styles.icon} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={10} stroke={accent.color} strokeWidth={1.3} />
              <Path
                d="M7 12.5L10.2 15.5L17 8.5"
                stroke={accent.color}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ) : (
            <Text style={[styles.iconGlyph, { color: accent.color }]}>{getIcon()}</Text>
          )}
          <Text style={styles.message} numberOfLines={3}>
            {message}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 20, 25, 0.72)',
    borderWidth: 1,
    borderLeftWidth: 2,
    borderRadius: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  icon: {
    marginRight: spacing.md,
  },
  iconGlyph: {
    fontSize: 18,
    marginRight: spacing.md,
    fontWeight: '600',
  },
  message: {
    ...typography.body,
    color: colors.bone,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});
