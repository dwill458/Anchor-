/**
 * Anchor App - Custom Toast Component
 *
 * Accessible toast notifications for user feedback.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

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
  const translateY = useRef(new Animated.Value(-100)).current;
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
        toValue: -100,
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

    // Animate in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 15,
        mass: 1,
        stiffness: 150,
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

  const getColors = (): [string, string] => {
    switch (type) {
      case 'success':
        return ['#10B981', '#059669']; // Green
      case 'error':
        return ['#EF4444', '#DC2626']; // Red
      case 'warning':
        return [colors.gold, '#B8941F']; // Gold
      case 'info':
      default:
        return ['#3B82F6', '#2563EB']; // Blue
    }
  };

  const getIcon = (): string => {
    switch (type) {
      case 'success':
        return '✓';
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
        <LinearGradient
          colors={getColors()}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.icon}>{getIcon()}</Text>
          <Text style={styles.message} numberOfLines={3}>
            {message}
          </Text>
        </LinearGradient>
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
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
  },
  icon: {
    fontSize: 20,
    color: colors.bone,
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
