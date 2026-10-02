import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { OptimizedImage } from '@/components/common/OptimizedImage';
import { colors } from '@/theme/colors';
import { CARD, HOLD, PAGE_PITCH } from '../choosePager';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../creationFlowConfig';
import { FORM_LABELS, type GeneratedForm } from '../generatedForms';
import { sealCard, sealFlash, sealPress } from '../sealMath';
import { TOUCH_SURFACE, type ChooseController } from '../useChooseController';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Idle ring palette: a cream stroke with a faint ink outline reads on cream and on dark denim. */
const RING_CREAM = '#F4EDE0';
const RING_STROKE = 2;
const RING_FILL_STROKE = 3;
/** The ink outline sits just outside the cream stroke. */
const RING_OUTLINE_R = HOLD.radius + RING_STROKE / 2 + 1;
/** One-time pulse on arrival to Choose, so the zone is found before it is touched. */
const ARRIVAL_PULSE_MS = 400;

const RING_SIZE = HOLD.radius * 2 + 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * HOLD.radius;
/** The anchor sits on the image centre, 36 px above the card's own centre. */
const ANCHOR_IN_CARD = { x: HOLD.centerX - CARD.x, y: HOLD.centerY - CARD.y };

interface ChooseSceneProps {
  controller: ChooseController;
  forms: GeneratedForm[];
  styleName: string;
  reduceMotion: boolean;
  /** Plays once on arrival: a soft highlight crossing the images. */
  showSheen: boolean;
  holdHint: 'idle' | 'holding';
}

/**
 * Beat 7–8 — Form I and Form II as two full-canvas images, swipeable, with the hold zone on the
 * anchor itself. The anchor is baked into each image, so nothing is drawn over it: one flat layer.
 */
export function ChooseScene({ controller, forms, styleName, reduceMotion, showSheen, holdHint }: ChooseSceneProps) {
  const { page, hold, sealU, flash, phase, activePage, panHandlers } = controller;
  const sealing = phase !== 'choosing';

  const breathe = useSharedValue(0);
  const sheen = useSharedValue(0);
  const arrivalPulse = useSharedValue(0);
  // Page dots and labels read the same pager state.

  useEffect(() => {
    if (reduceMotion) return;
    breathe.value = withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) });
    const timer = setInterval(() => {
      breathe.value = withTiming(breathe.value > 0.5 ? 0 : 1, { duration: 1500, easing: Easing.inOut(Easing.sin) });
    }, 1500);
    return () => clearInterval(timer);
  }, [breathe, reduceMotion]);

  useEffect(() => {
    if (!showSheen || reduceMotion) return;
    sheen.value = withDelay(120, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }));
  }, [reduceMotion, sheen, showSheen]);

  // One 400 ms ring pulse when Choose arrives (the sheen's cue: phase has settled on 'choose').
  useEffect(() => {
    if (!showSheen || reduceMotion) return;
    arrivalPulse.value = withDelay(
      60,
      withTiming(1, { duration: ARRIVAL_PULSE_MS, easing: Easing.out(Easing.cubic) })
    );
  }, [arrivalPulse, reduceMotion, showSheen]);

  const pageDots = useMemo(() => forms.map((_, i) => i), [forms]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      {forms.map((form, index) => (
        <FormCard
          key={form.id}
          index={index}
          form={form}
          styleName={styleName}
          page={page}
          hold={hold}
          sealU={sealU}
          sealing={sealing}
          isActive={index === activePage}
          sheen={sheen}
          holdHint={holdHint}
        />
      ))}

      {/* Hold ring: breathes while idle, fills clockwise in gold as the hold fills. */}
      <HoldRing
        hold={hold}
        page={page}
        breathe={breathe}
        arrivalPulse={arrivalPulse}
        flash={flash}
        sealing={sealing}
        sealU={sealU}
      />

      <PageDots page={page} dots={pageDots} sealU={sealU} />

      {/* The touch surface: one target above the images so touches are in one coordinate space. */}
      {!sealing ? (
        <View
          style={styles.touchSurface}
          {...panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${FORM_LABELS[activePage] ?? 'Form'}. Swipe to change. Hold to seal.`}
          accessibilityActions={[
            { name: 'increment', label: 'Next Form' },
            { name: 'decrement', label: 'Previous Form' },
            { name: 'activate', label: 'Seal this Form' },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') controller.goToPage(activePage + 1);
            else if (event.nativeEvent.actionName === 'decrement') controller.goToPage(activePage - 1);
            else if (event.nativeEvent.actionName === 'activate') controller.sealNow();
          }}
        />
      ) : null}
    </View>
  );
}

interface FormCardProps {
  index: number;
  form: GeneratedForm;
  styleName: string;
  page: ChooseController['page'];
  hold: ChooseController['hold'];
  sealU: ChooseController['sealU'];
  sealing: boolean;
  isActive: boolean;
  sheen: SharedValue<number>;
  holdHint: 'idle' | 'holding';
}

function FormCard({ index, form, styleName, page, hold, sealU, sealing, isActive, sheen, holdHint }: FormCardProps) {
  // Position: pages sit side by side; the sealed card leaves the pager and contracts to a medallion.
  const frame = useAnimatedStyle(() => {
    const offset = (index - page.value) * PAGE_PITCH;
    if (!sealing) {
      return {
        left: CARD.x + offset,
        top: CARD.y,
        width: CARD.width,
        height: CARD.height,
        borderRadius: CARD.radius,
        opacity: 1,
        transform: [{ scale: 1 + 0.025 * hold.value }],
      };
    }

    if (!isActive) {
      return {
        left: CARD.x + offset,
        top: CARD.y,
        width: CARD.width,
        height: CARD.height,
        borderRadius: CARD.radius,
        opacity: 1 - Math.min(1, sealU.value * 4),
        transform: [{ scale: 1 }],
      };
    }

    const shape = sealCard(sealU.value);
    return {
      left: DESIGN_WIDTH / 2 - shape.width / 2,
      top: shape.centerY - shape.height / 2,
      width: shape.width,
      height: shape.height,
      borderRadius: shape.radius,
      opacity: 1,
      transform: [{ scale: sealPress(sealU.value) }],
    };
  });

  // The image keeps the anchor at the clip's centre while the clip contracts around it.
  const content = useAnimatedStyle(() => {
    if (!(sealing && isActive)) {
      return { left: 0, top: 0, transform: [{ scale: 1 }] };
    }
    const shape = sealCard(sealU.value);
    const e = interpolate(shape.contentScale, [1, 0.5], [0, 1]);
    const pivotY = CARD.height / 2 + (ANCHOR_IN_CARD.y - CARD.height / 2) * e;
    return {
      left: shape.width / 2 - ANCHOR_IN_CARD.x,
      top: shape.height / 2 - pivotY,
      transformOrigin: `${ANCHOR_IN_CARD.x}px ${pivotY}px`,
      transform: [{ scale: shape.contentScale }],
    };
  });

  const chrome = useAnimatedStyle(() => ({
    opacity: sealing && isActive ? sealCard(sealU.value).chromeAlpha : 1,
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.15, 0.85, 1], [0, 0.55, 0.55, 0]),
    transform: [{ translateX: interpolate(sheen.value, [0, 1], [-CARD.width, CARD.width]) }, { rotate: '-20deg' }],
  }));

  return (
    <Animated.View style={[styles.card, frame]} pointerEvents="none">
      <Animated.View style={[styles.content, content]}>
        {form.uri ? (
          <OptimizedImage uri={form.uri} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.missing]} />
        )}
        <Animated.View style={[styles.sheen, sheenStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.5)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, chrome]}>
          <LinearGradient
            colors={['rgba(244, 237, 224, 0)', 'rgba(244, 237, 224, 0.6)', 'rgba(244, 237, 224, 0.78)']}
            locations={[0, 0.6, 1]}
            style={styles.scrim}
          />
          <Text style={styles.formLabel}>{FORM_LABELS[index].toUpperCase()}</Text>
          <Text style={styles.styleName}>{styleName}</Text>
          <Text style={styles.hint} accessibilityLiveRegion={isActive ? 'polite' : 'none'}>
            {isActive ? (holdHint === 'holding' ? 'Keep holding…' : 'Hold your Anchor to seal') : ''}
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

interface HoldRingProps {
  hold: ChooseController['hold'];
  page: ChooseController['page'];
  breathe: SharedValue<number>;
  arrivalPulse: SharedValue<number>;
  flash: ChooseController['flash'];
  sealing: boolean;
  sealU: ChooseController['sealU'];
}

function HoldRing({ hold, breathe, arrivalPulse, flash, sealing, sealU, page }: HoldRingProps) {
  // The ring belongs to a settled card: it fades while the pager is mid-swipe.
  const style = useAnimatedStyle(() => {
    // The arrival pulse swells the ring 6% and settles back (a half-sine over its 400 ms).
    const pulse = 1 + 0.06 * Math.sin(Math.PI * arrivalPulse.value);
    return {
      opacity: sealing
        ? 1 - Math.min(1, sealU.value * 6)
        : 1 - Math.min(1, Math.abs(page.value - Math.round(page.value)) * 8),
      transform: [{ scale: pulse }],
    };
  });

  // Cream stroke breathes 0.55 <-> 0.95; the ink outline holds steady. Both leave as the hold fills.
  const idle = useAnimatedProps(() => ({
    strokeOpacity: (0.55 + 0.4 * breathe.value) * (1 - hold.value),
  }));
  const outline = useAnimatedProps(() => ({
    strokeOpacity: 0.35 * (1 - hold.value),
  }));

  // The gold centre dot pulses on the breathe clock and fades as the hold rises.
  const dot = useAnimatedStyle(() => ({
    opacity:
      (1 - Math.min(1, hold.value * 3)) *
      (sealing
        ? 1 - Math.min(1, sealU.value * 6)
        : 1 - Math.min(1, Math.abs(page.value - Math.round(page.value)) * 8)),
    transform: [{ scale: 1 + 0.25 * breathe.value }],
  }));

  const fill = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - hold.value),
    strokeWidth: RING_FILL_STROKE + RING_FILL_STROKE * 0.2 * hold.value,
    strokeOpacity: hold.value > 0.005 ? 1 : 0,
  }));

  const flashStyle = useAnimatedStyle(() => {
    const f = sealFlash(flash.value);
    return { opacity: f.alpha, transform: [{ scale: f.scale }] };
  });

  const c = RING_SIZE / 2;
  return (
    <>
      <Animated.View style={[styles.ring, style]} pointerEvents="none">
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <AnimatedCircle
            cx={c}
            cy={c}
            r={RING_OUTLINE_R}
            stroke={colors.creation.ink}
            strokeWidth={1}
            fill="none"
            animatedProps={outline}
          />
          <AnimatedCircle
            cx={c}
            cy={c}
            r={HOLD.radius}
            stroke={RING_CREAM}
            strokeWidth={RING_STROKE}
            fill="none"
            animatedProps={idle}
          />
          <AnimatedCircle
            cx={c}
            cy={c}
            r={HOLD.radius}
            stroke={colors.creation.gold}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            rotation={-90}
            origin={`${c}, ${c}`}
            animatedProps={fill}
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.centerDot, dot]} pointerEvents="none" />
      <Animated.View style={[styles.ring, flashStyle]} pointerEvents="none">
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={c}
            cy={c}
            r={HOLD.radius}
            stroke={colors.creation.gold}
            strokeWidth={RING_FILL_STROKE * 1.2}
            fill="none"
          />
        </Svg>
      </Animated.View>
    </>
  );
}

function PageDots({
  page,
  dots,
  sealU,
}: {
  page: ChooseController['page'];
  dots: number[];
  sealU: ChooseController['sealU'];
}) {
  return (
    <View style={styles.dots} pointerEvents="none">
      {dots.map((i) => (
        <Dot key={i} index={i} page={page} sealU={sealU} />
      ))}
    </View>
  );
}

function Dot({ index, page, sealU }: { index: number; page: ChooseController['page']; sealU: ChooseController['sealU'] }) {
  const style = useAnimatedStyle(() => ({
    opacity: (Math.abs(page.value - index) < 0.5 ? 0.9 : 0.25) * (1 - Math.min(1, sealU.value * 5)),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, top: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
  card: { position: 'absolute', overflow: 'hidden', backgroundColor: colors.creation.cream },
  content: { position: 'absolute', width: CARD.width, height: CARD.height },
  image: { width: CARD.width, height: CARD.height },
  missing: { backgroundColor: colors.creation.hairline },
  sheen: { position: 'absolute', top: -40, bottom: -40, left: CARD.width * 0.3, width: 80 },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 200 },
  formLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 84 - 6,
    textAlign: 'center',
    fontFamily: 'Figtree-SemiBold',
    fontSize: 12,
    letterSpacing: 3,
    color: colors.creation.ink,
    opacity: 0.9,
  },
  styleName: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 64 - 6,
    textAlign: 'center',
    fontFamily: 'Figtree-Regular',
    fontSize: 13,
    color: colors.creation.ink,
    opacity: 0.7,
  },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 26 - 6,
    textAlign: 'center',
    fontFamily: 'Figtree-Regular',
    fontSize: 13,
    color: colors.creation.ink,
    opacity: 0.8,
  },
  ring: {
    position: 'absolute',
    left: HOLD.centerX - RING_SIZE / 2,
    top: HOLD.centerY - RING_SIZE / 2,
    width: RING_SIZE,
    height: RING_SIZE,
  },
  centerDot: {
    position: 'absolute',
    left: HOLD.centerX - 4,
    top: HOLD.centerY - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.creation.gold,
  },
  dots: {
    position: 'absolute',
    left: 0,
    width: DESIGN_WIDTH,
    top: 789,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.creation.ink },
  touchSurface: {
    position: 'absolute',
    left: 0,
    width: DESIGN_WIDTH,
    top: TOUCH_SURFACE.top,
    height: TOUCH_SURFACE.height,
  },
});
