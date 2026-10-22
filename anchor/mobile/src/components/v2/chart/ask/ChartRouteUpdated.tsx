import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, ReduceMotion, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { safeHaptics } from '@/utils/haptics';
import { colors, spacing } from '@/theme/v2';
import { chartTypography as typography } from '../chartTypography';
import { CHART_MAP_TOKENS } from '../map/chartMapTokens';
import type { ChartAnchorArt } from '../ChartLandscape';
import { askAccent } from './askChartTheme';
import { ROUTE_UPDATED, routeUpdatedSupport, type RouteUpdatedChange } from './routeUpdatedCopy';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const ANCHOR = 132;
const RING = 176;
const RING_R = 82;
const RING_LENGTH = 2 * Math.PI * RING_R;
const CHECK_LENGTH = 26;

/** Milliseconds from the moment the screen appears. The whole sequence resolves in about a second. */
export const ROUTE_UPDATED_TIMING = { anchorIn: 260, ringDelay: 200, ringDraw: 420, pulseAt: 640, checkAt: 700, headingAt: 720, supportAt: 800, actionsAt: 860 } as const;

type Props = {
  anchorArt: ChartAnchorArt | null;
  category: string | null | undefined;
  change: RouteUpdatedChange;
  reducedMotion: boolean;
  onViewChart: () => void;
  /** Absent when there is no conversation to return to. */
  onKeepChatting?: (() => void) | null;
  testID?: string;
};

/**
 * Confirmation that a change the person approved is saved. Quiet by design: their own Anchor, a fine ring drawn in the
 * category colour, one pulse that resolves into a check, then the words. No confetti, and not a celebration of
 * progress (that belongs to completing moves and reaching waypoints). Both buttons work from the first frame.
 */
export function ChartRouteUpdated({ anchorArt, category, change, reducedMotion, onViewChart, onKeepChatting, testID }: Props) {
  const insets = useSafeAreaInsets();
  const accent = askAccent(category);
  const T = ROUTE_UPDATED_TIMING;
  const ground = useSharedValue(reducedMotion ? 1 : 0);
  const anchor = useSharedValue(reducedMotion ? 1 : 0);
  const ring = useSharedValue(reducedMotion ? 1 : 0);
  const pulse = useSharedValue(0);
  const check = useSharedValue(reducedMotion ? 1 : 0);
  const heading = useSharedValue(reducedMotion ? 1 : 0);
  const support = useSharedValue(reducedMotion ? 1 : 0);
  const actions = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
      return undefined;
    }
    const never = { reduceMotion: ReduceMotion.Never } as const;
    const out = Easing.out(Easing.cubic);
    ground.value = withTiming(1, { duration: 140, easing: Easing.linear, ...never });
    anchor.value = withDelay(60, withTiming(1, { duration: T.anchorIn, easing: out, ...never }));
    ring.value = withDelay(T.ringDelay, withTiming(1, { duration: T.ringDraw, easing: Easing.inOut(Easing.cubic), ...never }));
    pulse.value = withDelay(T.pulseAt - 120, withSequence(withTiming(1, { duration: 140, easing: out, ...never }), withTiming(0, { duration: 260, easing: Easing.in(Easing.quad), ...never })));
    check.value = withDelay(T.checkAt, withTiming(1, { duration: 220, easing: out, ...never }, finished => {
      if (finished) runOnJS(celebrate)();
    }));
    heading.value = withDelay(T.headingAt, withTiming(1, { duration: 220, easing: out, ...never }));
    support.value = withDelay(T.supportAt, withTiming(1, { duration: 220, easing: out, ...never }));
    actions.value = withDelay(T.actionsAt, withTiming(1, { duration: 220, easing: out, ...never }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const celebrate = () => { void safeHaptics.notification(Haptics.NotificationFeedbackType.Success); };

  const groundStyle = useAnimatedStyle(() => ({ opacity: ground.value }));
  const anchorStyle = useAnimatedStyle(() => ({ opacity: anchor.value, transform: [{ scale: 0.92 + 0.08 * anchor.value }] }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING_LENGTH * (1 - ring.value) }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: pulse.value * 0.22, transform: [{ scale: 1 + pulse.value * 0.06 }] }));
  const badgeStyle = useAnimatedStyle(() => ({ opacity: check.value, transform: [{ scale: 0.6 + 0.4 * check.value }] }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - check.value) }));
  const headingStyle = useAnimatedStyle(() => ({ opacity: heading.value, transform: [{ translateY: (1 - heading.value) * 8 }] }));
  const supportStyle = useAnimatedStyle(() => ({ opacity: support.value, transform: [{ translateY: (1 - support.value) * 8 }] }));
  const actionsStyle = useAnimatedStyle(() => ({ opacity: actions.value, transform: [{ translateY: (1 - actions.value) * 10 }] }));

  return (
    <Animated.View style={[styles.root, groundStyle]} testID={testID ?? 'chart-route-updated'}>
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <View style={styles.mark} accessible accessibilityLabel="Your Anchor, with a check: route updated" accessibilityRole="image">
          <Animated.View pointerEvents="none" style={[styles.halo, { backgroundColor: accent.fill }, haloStyle]} />
          <Animated.View style={anchorStyle}>
            {anchorArt?.svg ? (
              <CircularAnchorRenderer
                svg={anchorArt.svg}
                imageUrl={anchorArt.imageUrl}
                category={anchorArt.category ?? category}
                expression={anchorArt.expression ?? undefined}
                size={ANCHOR}
                appearance="paper"
                accessibilityLabel="Your Anchor"
                testID="route-updated-anchor"
              />
            ) : (
              <View style={[styles.fallback, { backgroundColor: accent.wash, borderColor: accent.border }]} />
            )}
          </Animated.View>
          <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} style={styles.ring} pointerEvents="none">
            <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={accent.border} strokeWidth={1} fill="none" />
            <AnimatedCircle
              cx={RING / 2} cy={RING / 2} r={RING_R} stroke={accent.fill} strokeWidth={2.5} strokeLinecap="round" fill="none"
              strokeDasharray={[RING_LENGTH, RING_LENGTH]} rotation={-90} origin={`${RING / 2}, ${RING / 2}`}
              animatedProps={ringProps}
            />
          </Svg>
          <Animated.View style={[styles.badge, { backgroundColor: accent.fill }, badgeStyle]} testID="route-updated-check">
            <Svg width={28} height={28} viewBox="0 0 28 28">
              <AnimatedPath d="M8 14.5 L12.2 18.5 L20 9.5" stroke={accent.onFill} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={[CHECK_LENGTH, CHECK_LENGTH]} animatedProps={checkProps} />
            </Svg>
          </Animated.View>
        </View>

        <Animated.Text accessibilityRole="header" style={[styles.heading, headingStyle]}>{ROUTE_UPDATED.heading}</Animated.Text>
        <Animated.Text style={[styles.support, supportStyle]} testID="route-updated-support">{routeUpdatedSupport(change)}</Animated.Text>
      </View>

      <Animated.View style={[styles.actions, { paddingBottom: insets.bottom + spacing[4] }, actionsStyle]}>
        <V2Button size="large" onPress={onViewChart} testID="route-updated-view">{ROUTE_UPDATED.primary}</V2Button>
        {onKeepChatting ? (
          <Pressable accessibilityRole="button" onPress={onKeepChatting} hitSlop={8} style={styles.secondary} testID="route-updated-chat">
            <Text style={[styles.secondaryText, { color: accent.text }]}>{ROUTE_UPDATED.secondary}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6], gap: spacing[3] },
  mark: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[4] },
  halo: { position: 'absolute', width: RING, height: RING, borderRadius: RING / 2 },
  ring: { position: 'absolute' },
  fallback: { width: ANCHOR, height: ANCHOR, borderRadius: ANCHOR / 2, borderWidth: StyleSheet.hairlineWidth },
  badge: { position: 'absolute', right: 6, bottom: 8, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heading: { ...typography.displayMedium, fontFamily: CHART_MAP_TOKENS.serif, fontSize: 34, lineHeight: 38, color: colors.text.primary, textAlign: 'center' },
  support: { ...typography.bodyLG, color: colors.text.secondary, textAlign: 'center', maxWidth: 320 },
  actions: { paddingHorizontal: spacing[5], gap: spacing[2] },
  secondary: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  secondaryText: { ...typography.labelLG },
});
