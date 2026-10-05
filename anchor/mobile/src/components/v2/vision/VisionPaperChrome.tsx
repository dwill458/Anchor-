import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useV2ReduceMotion } from '@/hooks/v2';
import { AnchorMotion, colors, spacing } from '@/theme/v2';
import { AnimatedPressable, usePressScale } from './VisionMotion';

/** Restrained gold: an accent for kickers, rules and arrows, never a fill. */
export const VISION_GOLD = '#B08A4A';
export const VISION_SERIF = 'EBGaramond-Medium';
export const VISION_SERIF_REGULAR = 'EBGaramond-Regular';
export const VISION_SERIF_ITALIC = 'EBGaramond-Italic';

/** Round ink back button used on the creation screens (mockups 1-3). */
export function VisionBackButton({ onPress, label = 'Go back', style }: { onPress: () => void; label?: string; style?: StyleProp<ViewStyle> }) {
  const press = usePressScale(0.92);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={8}
      style={[styles.back, style, press.style]}
    >
      <ArrowLeft size={22} color={VISION_GOLD} />
    </AnimatedPressable>
  );
}

/** CREATE YOUR VISION, with the short gold rule beneath it. */
export function VisionKicker({ children, flanked = false }: { children: string; flanked?: boolean }) {
  return (
    <View style={styles.kickerWrap} accessible accessibilityRole="header" accessibilityLabel={children}>
      <View style={styles.kickerLine}>
        {flanked ? <View style={styles.flank} /> : null}
        <Text style={styles.kicker} importantForAccessibility="no">{children}</Text>
        {flanked ? <View style={styles.flank} /> : null}
      </View>
      {flanked ? null : <View style={styles.rule}><View style={styles.ruleDot} /></View>}
    </View>
  );
}

/** How far the arrow leans into a press. */
const ARROW_LEAN_PX = 4;
/** Horizontal travel of the blocked-tap nudge. */
const NUDGE_PX = 6;

/**
 * The dark pill used for the single primary action on a Vision creation screen.
 *
 * It is the one control whose state matters most, so its motion carries
 * meaning: it eases from dimmed to ready (and acknowledges becoming ready once),
 * leans forward under the finger, and, when tapped while blocked, nudges and
 * hands the tap to `onDisabledPress` so the screen can show what is missing.
 */
export function VisionInkPill({ label, onPress, disabled, onDisabledPress, testID, accessibilityLabel, style }: {
  label: string; onPress: () => void; disabled?: boolean; onDisabledPress?: () => void; testID?: string; accessibilityLabel?: string; style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useV2ReduceMotion();
  const press = usePressScale(0.98);
  // Only the shared value goes into the animated styles; the rest of `press` is JS and must stay out of their closures.
  const pressed = press.pressed;
  const ready = useSharedValue(disabled ? 0 : 1);
  const acknowledge = useSharedValue(0);
  const nudge = useSharedValue(0);
  const wasDisabled = useRef(Boolean(disabled));

  useEffect(() => {
    ready.value = withTiming(disabled ? 0 : 1, { duration: AnchorMotion.duration.standard, easing: AnchorMotion.easing.standard });
    // Becoming ready, not merely rendering ready: one small lift so the change is seen.
    if (wasDisabled.current && !disabled && !reduceMotion) {
      acknowledge.value = withSequence(
        withTiming(1, { duration: AnchorMotion.duration.micro, easing: AnchorMotion.easing.enter }),
        withSpring(0, AnchorMotion.spring.soft),
      );
    }
    wasDisabled.current = Boolean(disabled);
  }, [acknowledge, disabled, ready, reduceMotion]);

  const surface = useAnimatedStyle(() => ({
    opacity: (0.45 + ready.value * 0.55) * (reduceMotion ? 1 - pressed.value * 0.15 : 1),
    transform: [
      { translateX: nudge.value },
      { scale: reduceMotion ? 1 : (1 - pressed.value * 0.02) * (1 + acknowledge.value * 0.02) },
    ],
  }));
  const arrow = useAnimatedStyle(() => ({ transform: [{ translateX: reduceMotion ? 0 : pressed.value * ARROW_LEAN_PX }] }));

  const handlePress = () => {
    if (!disabled) { onPress(); return; }
    if (!reduceMotion) {
      nudge.value = withSequence(
        withTiming(-NUDGE_PX, { duration: 50 }),
        withTiming(NUDGE_PX, { duration: 80 }),
        withTiming(-NUDGE_PX / 2, { duration: 80 }),
        withTiming(0, { duration: 60 }),
      );
    }
    onDisabledPress?.();
  };

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      // Without a handler for blocked taps the control is simply inert, as before. `undefined` (not `false`) when it stays tappable:
      // a non-null `disabled` makes Pressable overwrite accessibilityState.disabled, and a blocked control must still report itself disabled.
      disabled={disabled && !onDisabledPress ? true : undefined}
      onPress={handlePress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.pill, style, surface]}
    >
      <Text style={styles.pillLabel}>{label}</Text>
      <Animated.View style={arrow}>
        <ArrowRight size={22} color={VISION_GOLD} />
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.ink.deep, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(176,138,74,0.45)',
  },
  kickerWrap: { alignItems: 'center', gap: 8 },
  kickerLine: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flank: { width: 28, height: StyleSheet.hairlineWidth * 2, backgroundColor: VISION_GOLD, opacity: 0.7 },
  kicker: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, letterSpacing: 2.6, color: VISION_GOLD },
  rule: { width: 140, height: StyleSheet.hairlineWidth * 2, backgroundColor: VISION_GOLD, opacity: 0.6, alignItems: 'center', justifyContent: 'center' },
  ruleDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: VISION_GOLD },
  pill: {
    minHeight: 58, borderRadius: 29, paddingHorizontal: spacing[6], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.ink.deep, borderWidth: 1, borderColor: 'rgba(176,138,74,0.4)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 5,
  },
  pillLabel: { flex: 1, textAlign: 'center', fontFamily: VISION_SERIF, fontSize: 22, lineHeight: 28, color: colors.ink.text.primary, marginLeft: spacing[5] },
});
