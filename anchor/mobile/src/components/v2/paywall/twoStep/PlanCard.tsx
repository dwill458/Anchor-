import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/v2';
import { PAYWALL_EASE_OUT, PAYWALL_TIMING } from './paywallMotion';
import { paywallType } from './paywallType';

type Props = {
  W: number;
  title: string;
  priceLine: string;
  /** Gold trial line ("7 days free"); omitted when the user is not eligible. */
  trialLine?: string | null;
  detailLines: string[];
  badge?: string | null;
  /** The pill dims to ~55% while another plan is selected. */
  badgeDimmed?: boolean;
  selected: boolean;
  disabled?: boolean;
  /** Full spoken plan text, including price and billing. */
  accessibilityLabel: string;
  onPress: () => void;
  reduceMotion: boolean;
  testID?: string;
};

const BADGE_GOLD = [colors.paywall.gold, colors.paywall.goldDeep] as const;

/**
 * A plan radio. Selection animates by cross-fading a gold border + tint layer
 * over the resting one and scaling the radio dot up from zero — opacity and
 * transform only.
 */
export function PlanCard({
  W,
  title,
  priceLine,
  trialLine,
  detailLines,
  badge,
  badgeDimmed = false,
  selected,
  disabled = false,
  accessibilityLabel,
  onPress,
  reduceMotion,
  testID,
}: Props) {
  const on = useSharedValue(selected ? 1 : 0);
  const dim = useSharedValue(badgeDimmed ? 1 : 0);

  useEffect(() => {
    const config = { duration: reduceMotion ? 0 : PAYWALL_TIMING.planSelectMs, easing: PAYWALL_EASE_OUT };
    on.value = withTiming(selected ? 1 : 0, config);
    dim.value = withTiming(badgeDimmed ? 1 : 0, config);
  }, [badgeDimmed, dim, on, reduceMotion, selected]);

  const selectedLayer = useAnimatedStyle(() => ({ opacity: on.value }));
  const restingLayer = useAnimatedStyle(() => ({ opacity: 1 - on.value }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scale: on.value }] }));
  const badgeStyle = useAnimatedStyle(() => ({ opacity: 1 - dim.value * 0.45 }));

  const radio = W * 0.062;
  const pad = W * 0.045;
  const radius = W * 0.045;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, selected, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={[styles.card, { borderRadius: radius, padding: pad, paddingLeft: pad * 0.75, gap: W * 0.045 }, disabled && styles.disabled]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.resting, { borderRadius: radius }, restingLayer]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.chosen, { borderRadius: radius }, selectedLayer]} />

      <View style={[styles.radio, { width: radio, height: radio, borderRadius: radio / 2, marginTop: W * 0.06 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.radioRingOff, { borderRadius: radio / 2 }, restingLayer]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.radioRingOn, { borderRadius: radio / 2 }, selectedLayer]} />
        <Animated.View style={[styles.dot, { width: radio * 0.56, height: radio * 0.56, borderRadius: radio * 0.28 }, dotStyle]} />
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[paywallType.planTitle(W), styles.title]}>{title}</Text>
          {badge ? (
            <Animated.View style={badgeStyle}>
              <LinearGradient
                colors={BADGE_GOLD}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.badge, { paddingHorizontal: W * 0.035, paddingVertical: W * 0.012, borderRadius: W * 0.05 }]}
              >
                <Text style={paywallType.badge(W)}>{badge}</Text>
              </LinearGradient>
            </Animated.View>
          ) : null}
        </View>
        <Text style={paywallType.planPrice(W)}>{priceLine}</Text>
        {trialLine ? <Text style={[paywallType.planTrial(W), { marginTop: W * 0.008 }]}>{trialLine}</Text> : null}
        {detailLines.map((line) => (
          <Text key={line} style={[paywallType.planDetail(W), { marginTop: W * 0.006 }]}>{line}</Text>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start' },
  disabled: { opacity: 0.5 },
  resting: { borderWidth: 1, borderColor: colors.paywall.hairlineStrong, backgroundColor: 'rgba(244, 237, 224, 0.02)' },
  chosen: { borderWidth: 1.5, borderColor: colors.paywall.gold, backgroundColor: 'rgba(226, 188, 107, 0.07)' },
  radio: { alignItems: 'center', justifyContent: 'center' },
  radioRingOff: { borderWidth: 1.5, borderColor: colors.paywall.hairlineStrong },
  radioRingOn: { borderWidth: 1.5, borderColor: colors.paywall.text },
  dot: { backgroundColor: colors.paywall.gold },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  title: { flexShrink: 1 },
  badge: { alignSelf: 'flex-start' },
});
