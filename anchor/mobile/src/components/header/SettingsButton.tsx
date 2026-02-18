/**
 * Anchor App - Settings Header Button
 *
 * Premium settings button with tactile gear motion and reveal transition trigger
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { Pressable, View, StyleSheet, Platform } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SettingsIcon } from '../icons/SettingsIcon';
import { colors } from '@/theme';
import { safeHaptics } from '@/utils/haptics';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useSettingsReveal } from '@/components/transitions/SettingsRevealProvider';

interface SettingsButtonProps {
  size?: number;
  testID?: string;
}

const QUICK_TURNS_MIN = 0.5;
const QUICK_TURNS_MAX = 0.75;

export const SettingsButton: React.FC<SettingsButtonProps> = ({
  size = 28,
  testID = 'settings-button',
}) => {
  const reduceMotionEnabled = useReduceMotionEnabled();
  const { open } = useSettingsReveal();
  const containerRef = useRef<View>(null);
  const hasTriggeredOpenRef = useRef(false);
  const scale = useSharedValue(1);
  const turns = useSharedValue(0);

  const quickTurns = useMemo(
    () => QUICK_TURNS_MIN + Math.random() * (QUICK_TURNS_MAX - QUICK_TURNS_MIN),
    []
  );

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotateZ: `${turns.value * 360}deg` },
    ],
  }));

  const triggerOpen = useCallback(() => {
    if (hasTriggeredOpenRef.current) {
      return;
    }
    hasTriggeredOpenRef.current = true;
    containerRef.current?.measureInWindow((x, y, width, height) => {
      open(
        {
          cx: x + width / 2,
          cy: y + height / 2,
          size: Math.max(width, height),
        },
        { reduceMotion: reduceMotionEnabled }
      );
    });
  }, [open, reduceMotionEnabled]);

  const handlePressIn = useCallback(() => {
    if (!reduceMotionEnabled) {
      scale.value = withTiming(0.96, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
      const base = Math.floor(turns.value);
      turns.value = withTiming(base + quickTurns, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      scale.value = withTiming(0.98, { duration: 120 });
    }

    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    triggerOpen();
  }, [quickTurns, reduceMotionEnabled, scale, triggerOpen, turns]);

  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });

    if (!reduceMotionEnabled) {
      turns.value = withTiming(Math.ceil(turns.value), {
        duration: 260,
        easing: Easing.inOut(Easing.cubic),
      });
    }
    setTimeout(() => {
      hasTriggeredOpenRef.current = false;
    }, 40);
  }, [reduceMotionEnabled, scale, turns]);

  const handlePress = useCallback(() => {
    triggerOpen();
  }, [triggerOpen]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      testID={testID}
      style={styles.pressable}
    >
      <Animated.View ref={containerRef as any} style={[styles.container, iconAnimatedStyle]}>
        <View style={styles.glassChip} />
        <SettingsIcon size={size} color={colors.gold} glow={true} testID="settings-icon" />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    marginRight: 16,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  glassChip: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(26, 26, 29, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    ...Platform.select({
      ios: {
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
});
