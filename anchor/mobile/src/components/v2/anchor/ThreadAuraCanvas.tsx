import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { Canvas, Fill, ImageShader, Shader, Skia } from '@shopify/react-native-skia';
import { cancelAnimation, Easing, useDerivedValue, useFrameCallback, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { ThreadAuraStatic, type ThreadAuraProps } from './ThreadAura';
import { auraTransition, normalizeThreadStrength, threadAuraParameters } from './threadAuraModel';
import { threadAuraTexture } from './threadAuraTexture';
import { THREAD_AURA_SHADER } from './threadAuraShader';

const effect = Skia.RuntimeEffect.Make(THREAD_AURA_SHADER);

export const ThreadAuraCanvas = memo(function ThreadAuraCanvas(props: ThreadAuraProps & { animate: boolean; particlesEnabled: boolean }) {
  const { svg, size, artworkSize } = props;
  const key = `${size}:${artworkSize}:${svg}`;
  const [prepared, setPrepared] = useState<{ key: string; image: ReturnType<typeof threadAuraTexture> } | null>(null);
  useEffect(() => {
    if (!props.active || prepared?.key === key) return;
    // Do not parse/rasterize five mounted carousel cards during a drag or navigation flight.
    const task = InteractionManager.runAfterInteractions(() => setPrepared({ key, image: threadAuraTexture(svg, size, artworkSize) }));
    return () => task.cancel();
  }, [props.active, key, prepared?.key, svg, size, artworkSize]);
  const texture = prepared?.key === key ? prepared.image : null;
  if (!texture || !effect) return <ThreadAuraStatic {...props} />;
  return <AnimatedAura key={key} {...props} texture={texture} />;
});

function AnimatedAura(props: ThreadAuraProps & { animate: boolean; particlesEnabled: boolean; texture: NonNullable<ReturnType<typeof threadAuraTexture>> }) {
  const { size, threadStrength, variant, categoryColor, animate, particlesEnabled, texture } = props;
  const span = Math.min(384, Math.ceil(size * 1.6));
  const previous = useRef(threadStrength);
  const strength = useSharedValue(normalizeThreadStrength(threadStrength));
  const reward = useSharedValue(0);
  const time = useSharedValue(0);
  const tint = useMemo(() => {
    const value = categoryColor.replace('#', '');
    return [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
  }, [categoryColor]);
  const canAnimate = animate && Boolean(texture && effect);
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
    return { span, time: time.value, strength: strength.value, radius: p.radius, blur: p.blur, inner: p.inner, outer: p.outer,
      movement: canAnimate ? p.movement : 0, particles: particlesEnabled && canAnimate ? p.particles : 0,
      ambient: p.ambient, reward: reward.value, tint };
  }, [span, variant, canAnimate, particlesEnabled, tint]);
  return <Canvas style={{ width: size * 1.6, height: size * 1.6 }}>
    <Fill><Shader source={effect!} uniforms={uniforms} transform={[{ scale: size * 1.6 / span }]}>
      <ImageShader image={texture} tx="decal" ty="decal" fit="none" />
    </Shader></Fill>
  </Canvas>;
}
