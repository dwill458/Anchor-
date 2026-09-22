import React, { memo, useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { PresentedImage } from './useVisionPresentationQueue';
import { VISION_REVEAL_TIMING as R } from './useVisionPresentationQueue';
import type { VisionGenerationStepState } from './visionGenerationProgress';

/** How many images stay visible in the stack: the hero and two behind it. */
const STACK_DEPTH = 3;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * One image in the forming stack. `depth` is 0 for the hero, 1-2 for history
 * behind it and -1 while entering from the right/rear. The image is already
 * decoded (the presentation queue prefetches it), so it never appears as an
 * empty frame; the entrance resolves from a soft, blurred copy to sharp.
 */
const StackCard = memo(function StackCard({
  uri, depth, width, height, accent, reduceMotion,
}: { uri: string; depth: number; width: number; height: number; accent: string; reduceMotion: boolean }) {
  const position = useSharedValue(reduceMotion ? depth : -1);
  const focus = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    const duration = reduceMotion ? R.reducedEnterMs : R.enterMs;
    position.value = withTiming(depth, { duration, easing: EASE });
  }, [depth, position, reduceMotion]);
  useEffect(() => {
    if (!reduceMotion) focus.value = withTiming(1, { duration: R.enterMs + 80, easing: Easing.out(Easing.quad) });
  }, [focus, reduceMotion]);

  const cardStyle = useAnimatedStyle(() => {
    const d = position.value;
    if (reduceMotion) {
      // Opacity only: the hero is shown, history rests out of sight.
      return { opacity: interpolate(d, [-1, 0, 1], [0, 1, 0], 'clamp') };
    }
    return {
      opacity: interpolate(d, [-1, 0, 1, 2, 3], [0, 1, 0.62, 0.3, 0], 'clamp'),
      transform: [
        { translateX: interpolate(d, [-1, 0, 1, 2, 3], [width * 0.34, 0, -width * 0.2, -width * 0.36, -width * 0.46], 'clamp') },
        { scale: interpolate(d, [-1, 0, 1, 2, 3], [0.94, 1, 0.95, 0.9, 0.86], 'clamp') },
      ],
    };
  });
  const blurStyle = useAnimatedStyle(() => ({ opacity: 1 - focus.value }));

  return (
    <Animated.View pointerEvents="none" style={[styles.card, { width, height, zIndex: 10 - Math.max(depth, 0) }, cardStyle]}>
      <Image source={{ uri }} resizeMode="cover" style={styles.fill} accessibilityIgnoresInvertColors />
      {!reduceMotion ? (
        <Animated.View style={[StyleSheet.absoluteFill, blurStyle]}>
          <Image source={{ uri }} blurRadius={14} resizeMode="cover" style={styles.fill} />
        </Animated.View>
      ) : null}
      {depth === 0 ? <View style={[styles.cardEdge, { borderColor: `${accent}AA` }]} /> : null}
    </Animated.View>
  );
});

/**
 * Before anything exists there is no frame at all - only a soft light where
 * the future will appear, breathing slowly. It leaves as the first image enters.
 */
function FormingLight({ width, height, accent, visible, reduceMotion }: {
  width: number; height: number; accent: string; visible: boolean; reduceMotion: boolean;
}) {
  const breath = useSharedValue(0.55);
  const presence = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    breath.value = withRepeat(withSequence(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      withTiming(0.55, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
    ), -1);
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion]);
  useEffect(() => {
    presence.value = withTiming(visible ? 1 : 0, { duration: 700 });
  }, [presence, visible]);
  const style = useAnimatedStyle(() => ({ opacity: presence.value * breath.value }));
  const size = Math.max(width, height) * 1.2;
  return (
    <Animated.View pointerEvents="none" style={[styles.light, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="vision-forming" cx="50%" cy="50%" r="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            <Stop offset="0" stopColor={accent} stopOpacity="0.42" />
            <Stop offset="0.45" stopColor={accent} stopOpacity="0.14" />
            <Stop offset="1" stopColor={accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill="url(#vision-forming)" />
      </Svg>
    </Animated.View>
  );
}

export function VisionGenerationStack({ presented, cardWidth, cardHeight, accent, reduceMotion }: {
  presented: PresentedImage[]; cardWidth: number; cardHeight: number; accent: string; reduceMotion: boolean;
}) {
  const visible = presented.slice(-STACK_DEPTH - 1);
  return (
    <View testID="vision-generation-stack" style={[styles.stack, { height: cardHeight }]}
      accessibilityLabel={presented.length ? `${presented.length} images shown` : 'Your images are being created'}>
      <FormingLight width={cardWidth} height={cardHeight} accent={accent} visible={presented.length === 0} reduceMotion={reduceMotion} />
      {visible.map(item => {
        const depth = presented.length - 1 - presented.indexOf(item);
        return (
          <StackCard key={item.id} uri={item.imageUrl} depth={depth} width={cardWidth} height={cardHeight}
            accent={accent} reduceMotion={reduceMotion} />
        );
      })}
    </View>
  );
}

const RailCell = memo(function RailCell({ uri, reduceMotion }: { uri?: string; reduceMotion: boolean }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    if (uri) shown.value = withTiming(1, { duration: reduceMotion ? 240 : 520, easing: Easing.out(Easing.quad) });
  }, [reduceMotion, shown, uri]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <View style={[styles.railCell, uri ? styles.railCellFilled : null]}>
      {uri ? (
        <Animated.View style={[styles.fill, style]}>
          <Image source={{ uri }} resizeMode="cover" style={styles.fill} />
        </Animated.View>
      ) : null}
    </View>
  );
});

/** A contact-sheet rail that fills as images are shown. */
export function VisionContactRail({ presented, total, reduceMotion }: {
  presented: PresentedImage[]; total: number; reduceMotion: boolean;
}) {
  return (
    <View style={styles.rail} testID="vision-generation-sheet">
      {Array.from({ length: total }, (_, index) => (
        <RailCell key={presented[index]?.id ?? `slot-${index}`} uri={presented[index]?.imageUrl} reduceMotion={reduceMotion} />
      ))}
    </View>
  );
}

const StepRow = memo(function StepRow({ label, state, accent, reduceMotion }: {
  label: string; state: VisionGenerationStepState; accent: string; reduceMotion: boolean;
}) {
  const active = useSharedValue(state === 'active' ? 1 : 0);
  const done = useSharedValue(state === 'done' ? 1 : 0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    const duration = reduceMotion ? 0 : 420;
    active.value = withTiming(state === 'active' ? 1 : 0, { duration });
    done.value = withTiming(state === 'done' ? 1 : 0, { duration });
    if (state === 'active' && !reduceMotion) {
      pulse.value = withRepeat(withSequence(
        withTiming(0.45, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ), -1);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration });
    }
  }, [active, done, pulse, reduceMotion, state]);

  const ringStyle = useAnimatedStyle(() => ({ opacity: active.value }));
  const coreStyle = useAnimatedStyle(() => ({ opacity: active.value * pulse.value }));
  const doneStyle = useAnimatedStyle(() => ({ opacity: done.value, transform: [{ scale: 0.7 + done.value * 0.3 }] }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: 0.42 + Math.max(active.value, done.value * 0.82) * 0.58 }));

  return (
    <View style={styles.stepRow} accessible accessibilityLabel={`${label}, ${state === 'done' ? 'done' : state === 'active' ? 'in progress' : 'waiting'}`}>
      <View style={styles.stepMark}>
        <Animated.View style={[styles.stepRing, { borderColor: accent }, ringStyle]} />
        <Animated.View style={[styles.stepCore, { backgroundColor: accent }, coreStyle]} />
        <Animated.View style={[styles.stepDone, doneStyle]}>
          <Check size={11} color={colors.ink.base} strokeWidth={3} />
        </Animated.View>
      </View>
      <Animated.Text style={[styles.stepText, labelStyle]}>{label}</Animated.Text>
    </View>
  );
});

export function VisionGenerationSteps({ steps, accent, reduceMotion }: {
  steps: Array<{ key: string; label: string; state: VisionGenerationStepState }>; accent: string; reduceMotion: boolean;
}) {
  return (
    <View style={styles.steps}>
      {steps.map(item => <StepRow key={item.key} label={item.label} state={item.state} accent={accent} reduceMotion={reduceMotion} />)}
    </View>
  );
}

/** Truthful count, eased rather than jumped. */
export function VisionGenerationMeter({ ready, total, accent, reduceMotion }: {
  ready: number; total: number; accent: string; reduceMotion: boolean;
}) {
  const fraction = useSharedValue(ready / total);
  useEffect(() => {
    fraction.value = withTiming(ready / total, { duration: reduceMotion ? 0 : 600, easing: Easing.out(Easing.cubic) });
  }, [fraction, ready, reduceMotion, total]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fraction.value * 100}%` }));
  return (
    <View style={styles.meter}>
      <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: ready }}>
        <Animated.View style={[styles.trackFill, { backgroundColor: accent }, fillStyle]} />
      </View>
      <Text style={styles.meterText}>{ready} of {total} images ready</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  stack: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginVertical: spacing[4] },
  light: { position: 'absolute' },
  card: { position: 'absolute', borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.ink.deep },
  cardEdge: { ...StyleSheet.absoluteFillObject, borderRadius: radii.lg, borderWidth: 1 },
  rail: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  railCell: { width: 24, height: 38, borderRadius: 5, overflow: 'hidden', borderWidth: 1, borderColor: colors.ink.hairline },
  railCellFilled: { borderColor: 'transparent' },
  steps: { gap: spacing[3], marginTop: spacing[5] },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  stepMark: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.ink.hairlineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  stepRing: { position: 'absolute', left: -1.5, top: -1.5, width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  stepCore: { width: 8, height: 8, borderRadius: 4 },
  stepDone: {
    position: 'absolute', left: -1.5, top: -1.5, width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.ink.text.primary, alignItems: 'center', justifyContent: 'center',
  },
  stepText: { ...typography.bodyMD, color: colors.ink.text.primary },
  meter: { gap: spacing[2], marginTop: spacing[5] },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.ink.hairlineStrong, overflow: 'hidden' },
  trackFill: { height: '100%' },
  meterText: { ...typography.caption, color: colors.ink.text.secondary, textAlign: 'center' },
});
