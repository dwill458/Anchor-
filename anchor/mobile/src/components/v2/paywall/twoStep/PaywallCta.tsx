import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { colors } from '@/theme/v2';
import { PAYWALL_EASE_OUT, PAYWALL_LAYOUT, PAYWALL_TIMING } from './paywallMotion';
import { paywallType } from './paywallType';

type Props = {
  W: number;
  label: string;
  onPress: () => void;
  /** Purchase in flight: spinner instead of the arrow, presses ignored. */
  busy?: boolean;
  disabled?: boolean;
  /** The CTA's step is on screen; the idle sheen only runs then. */
  visible: boolean;
  reduceMotion: boolean;
  accessibilityHint?: string;
  testID?: string;
};

const SHEEN = ['rgba(226, 188, 107, 0)', 'rgba(226, 188, 107, 0.38)', 'rgba(226, 188, 107, 0)'] as const;

/**
 * Cream pill CTA. Press scales to 97.5% and nudges the arrow; a label change
 * cross-fades with a small vertical shift; a slow gold sheen crosses it every
 * 5.5 s while it sits idle on screen.
 */
export function PaywallCta({ W, label, onPress, busy = false, disabled = false, visible, reduceMotion, accessibilityHint, testID }: Props) {
  const [labels, setLabels] = useState<{ current: string; previous: string | null }>({ current: label, previous: null });
  const swap = useSharedValue(1);
  const press = useSharedValue(0);
  const sheen = useSharedValue(0);
  const shift = PAYWALL_LAYOUT.labelShift * W;
  const height = W * 0.128;
  const width = W - 2 * PAYWALL_LAYOUT.gutter * W;

  useEffect(() => {
    if (label === labels.current) return;
    setLabels({ current: label, previous: labels.current });
    swap.value = 0;
    swap.value = withTiming(1, { duration: reduceMotion ? 0 : PAYWALL_TIMING.labelSwapMs, easing: PAYWALL_EASE_OUT });
  }, [label, labels, reduceMotion, swap]);

  const idle = visible && !busy && !disabled && !reduceMotion;
  useEffect(() => {
    cancelAnimation(sheen);
    sheen.value = 0;
    if (!idle) return;
    const { ctaSheenEveryMs, ctaSheenMs } = PAYWALL_TIMING;
    sheen.value = withRepeat(
      withSequence(
        withDelay(ctaSheenEveryMs - ctaSheenMs, withTiming(1, { duration: ctaSheenMs, easing: Easing.inOut(Easing.quad) })),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );
  }, [idle, sheen]);

  const pressTo = (to: number) => {
    press.value = withTiming(to, { duration: reduceMotion ? 0 : PAYWALL_TIMING.pressMs, easing: PAYWALL_EASE_OUT });
  };

  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * (1 - PAYWALL_TIMING.pressScale) }] }));
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: press.value * W * 0.014 }] }));
  const currentStyle = useAnimatedStyle(() => ({ opacity: swap.value, transform: [{ translateY: (1 - swap.value) * shift }] }));
  const previousStyle = useAnimatedStyle(() => ({ opacity: 1 - swap.value, transform: [{ translateY: -swap.value * shift }] }));
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: sheen.value > 0 && sheen.value < 1 ? 1 : 0,
    transform: [{ translateX: (sheen.value * 1.4 - 0.2) * width }, { rotate: '20deg' }],
  }));

  const inactive = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => pressTo(1)}
      onPressOut={() => pressTo(0)}
      testID={testID}
    >
      <Animated.View style={[styles.body, { minHeight: height, borderRadius: height / 2, paddingHorizontal: W * 0.08 }, disabled && !busy && styles.disabled, bodyStyle]}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: height / 2 }]}>
          <Animated.View style={[styles.sheen, { width: width * 0.22, height: height * 2.4, top: -height * 0.7 }, sheenStyle]}>
            <LinearGradient colors={SHEEN} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
        <View style={styles.labelSlot}>
          {labels.previous ? (
            <Animated.Text numberOfLines={2} style={[paywallType.ctaLabel(W), styles.previous, previousStyle]}>{labels.previous}</Animated.Text>
          ) : null}
          <Animated.Text style={[paywallType.ctaLabel(W), styles.labelText, currentStyle]} testID="v2-paywall-cta-label">
            {labels.current}
          </Animated.Text>
        </View>
        <Animated.View style={[styles.trailing, { right: W * 0.06 }, arrowStyle]}>
          {busy ? (
            <ActivityIndicator color={colors.paywall.inkText} testID="v2-paywall-cta-busy" />
          ) : (
            <ArrowRight size={W * 0.06} color={colors.paywall.inkText} strokeWidth={1.6} />
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { backgroundColor: colors.paywall.cream, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  disabled: { opacity: 0.55 },
  clip: { overflow: 'hidden' },
  sheen: { position: 'absolute', left: 0 },
  labelSlot: { alignItems: 'center', justifyContent: 'center' },
  labelText: { textAlign: 'center' },
  previous: { position: 'absolute', textAlign: 'center' },
  trailing: { position: 'absolute' },
});
