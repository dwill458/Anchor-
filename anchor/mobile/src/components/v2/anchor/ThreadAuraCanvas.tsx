import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { cancelAnimation, Easing, useDerivedValue, useFrameCallback, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { ThreadAuraStatic, type ThreadAuraProps } from './ThreadAura';
import { auraTransition, normalizeThreadStrength, THREAD_AURA_SPAN, threadAuraParameters } from './threadAuraModel';
import { THREAD_AURA_SHADER } from './threadAuraShader';

const effect = Skia.RuntimeEffect.Make(THREAD_AURA_SHADER);

export const ThreadAuraCanvas = memo(function ThreadAuraCanvas(props: ThreadAuraProps & { animate: boolean; particlesEnabled: boolean }) {
  if (!effect) return <ThreadAuraStatic {...props} />;
  return <AnimatedAura {...props} />;
});

function AnimatedAura(props: ThreadAuraProps & { animate: boolean; particlesEnabled: boolean }) {
  const { size, threadStrength, variant, categoryColor, animate, particlesEnabled } = props;
  // Layer is size * THREAD_AURA_SPAN square; the coin sits in the middle at radius size / 2.
  const span = Math.min(512, Math.ceil(size * THREAD_AURA_SPAN));
  const disc = span * (0.5 / THREAD_AURA_SPAN);
  const previous = useRef(threadStrength);
  const strength = useSharedValue(normalizeThreadStrength(threadStrength));
  const reward = useSharedValue(0);
  const time = useSharedValue(0);
  const tint = useMemo(() => {
    const value = categoryColor.replace('#', '');
    return [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
  }, [categoryColor]);
  const canAnimate = animate;
  const frame = useFrameCallback(info => {
    time.value += Math.min(info.timeSincePreviousFrame ?? 0, 64) / 1000;
  }, false);
  useEffect(() => {
    frame.setActive(canAnimate);
    return () => frame.setActive(false);
  }, [frame, canAnimate]);
  useEffect(() => {
    // Retain the last seen server value while Home is covered by Practice. Re-focus can then
    // ease to the confirmed value instead of consuming the increase behind another screen.
    if (!props.active && !props.reducedMotion) return;
    const transition = auraTransition(previous.current, threadStrength);
    previous.current = threadStrength;
    cancelAnimation(strength);
    cancelAnimation(reward);
    reward.value = 0;
    const next = normalizeThreadStrength(threadStrength);
    strength.value = canAnimate ? withTiming(next, { duration: transition.duration, easing: Easing.inOut(Easing.cubic) }) : next;
    if (canAnimate && transition.reward) reward.value = withSequence(withTiming(1, { duration: 350 }), withTiming(0, { duration: 1150 }));
    return () => { cancelAnimation(strength); cancelAnimation(reward); };
  }, [threadStrength, canAnimate, props.active, props.reducedMotion, strength, reward]);
  const uniforms = useDerivedValue(() => {
    const p = threadAuraParameters(strength.value, variant);
    return { span, disc, time: time.value, core: p.core, coreWidth: p.coreWidth, mid: p.mid, midWidth: p.midWidth,
      bloom: p.bloom, bloomWidth: p.bloomWidth, filament: canAnimate ? p.filament : p.filament * 0.6,
      movement: canAnimate ? p.movement : 0, particles: particlesEnabled && canAnimate ? p.particles : 0,
      reward: reward.value, tint };
  }, [span, disc, variant, canAnimate, particlesEnabled, tint]);
  return <Canvas style={{ width: size * THREAD_AURA_SPAN, height: size * THREAD_AURA_SPAN }}>
    <Fill><Shader source={effect!} uniforms={uniforms} transform={[{ scale: size * THREAD_AURA_SPAN / span }]} /></Fill>
  </Canvas>;
}
