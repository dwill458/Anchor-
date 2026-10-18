import React, { memo, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Filter, FeGaussianBlur } from 'react-native-svg';
import { useAppPerformanceTier } from '@/hooks/useAppPerformanceTier';
import { normalizeThreadStrength, THREAD_AURA_SPAN, threadAuraParameters, type ThreadAuraVariant } from './threadAuraModel';

export type ThreadAuraProps = {
  anchorId?: string;
  svg: string;
  threadStrength: number | null;
  categoryColor: string;
  size: number;
  artworkSize: number;
  variant: ThreadAuraVariant;
  active: boolean;
  reducedMotion: boolean;
};

/** Decorative geometry only. The existing Anchor renderer always owns the sharp foreground. */
export const ThreadAura = memo(function ThreadAura(props: ThreadAuraProps) {
  const tier = useAppPerformanceTier();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  // Native installations without Skia, and web without CanvasKit, retain the same SVG geometry.
  const Renderer = useMemo(() => {
    if (tier === 'low' || props.reducedMotion) return null;
    try { return require('./ThreadAuraCanvas').ThreadAuraCanvas as React.ComponentType<ThreadAuraProps & { animate: boolean; particlesEnabled: boolean }>; }
    catch { return null; }
  }, [tier, props.reducedMotion]);
  const animate = props.active && foreground && !props.reducedMotion && tier !== 'low';
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    testID={`thread-aura-${props.variant}`} style={[styles.layer, { width: props.size * THREAD_AURA_SPAN, height: props.size * THREAD_AURA_SPAN, left: -props.size * (THREAD_AURA_SPAN - 1) / 2, top: -props.size * (THREAD_AURA_SPAN - 1) / 2 }]}>
    {Renderer ? <Renderer {...props} active={props.active && foreground} animate={animate} particlesEnabled={tier === 'high'} /> : <ThreadAuraStatic {...props} />}
  </View>;
});

/** Renderer fallback: native SVG blurred rings around the coin edge, strength-correct, never a circular wash. */
export const ThreadAuraStatic = memo(function ThreadAuraStatic(props: ThreadAuraProps) {
  const id = React.useId().replace(/:/g, '');
  const p = threadAuraParameters(normalizeThreadStrength(props.threadStrength), props.variant);
  const span = props.size * THREAD_AURA_SPAN;
  const r = props.size / 2;
  return <Svg width="100%" height="100%" viewBox={`0 0 ${span} ${span}`}>
    <Defs><Filter id={id} x="-30%" y="-30%" width="160%" height="160%">
      <FeGaussianBlur stdDeviation={r * p.bloomWidth * 0.8} />
    </Filter></Defs>
    <Circle cx={span / 2} cy={span / 2} r={r * 1.04} fill="none" stroke={props.categoryColor} strokeWidth={r * (0.1 + 0.16 * p.mid)}
      opacity={Math.min(1, p.bloom + p.core * 0.4)} filter={`url(#${id})`} />
  </Svg>;
});

const styles = StyleSheet.create({ layer: { position: 'absolute' } });
