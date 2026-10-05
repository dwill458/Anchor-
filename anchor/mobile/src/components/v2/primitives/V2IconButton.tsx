import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { AnimatedPressable, usePressScale } from '@/components/v2/motion';
import { colors, radii } from '@/theme/v2';

type Props = { icon: React.ReactNode; accessibilityLabel: string; onPress?: () => void; disabled?: boolean; surface?: boolean; style?: StyleProp<ViewStyle>; testID?: string };

export function V2IconButton({ icon, accessibilityLabel, onPress, disabled = false, surface = false, style, testID }: Props) {
  const press = usePressScale();
  // The grouped tint fades in with the press instead of flipping.
  const tint = useAnimatedStyle(() => ({ opacity: press.pressed.value }));
  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[styles.base, surface && styles.surface, disabled && styles.disabled, style, press.style]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, tint]} />
      <View pointerEvents="none">{icon}</View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: radii.md },
  surface: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border.subtle },
  disabled: { opacity: 0.45 },
  tint: { backgroundColor: colors.grouped, borderRadius: radii.md },
});
