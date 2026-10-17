import React, { memo, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Svg, { Defs, Filter, FeGaussianBlur, FeColorMatrix, G, SvgXml } from 'react-native-svg';
import { useAppPerformanceTier } from '@/hooks/useAppPerformanceTier';
import { normalizeThreadStrength, threadAuraParameters, type ThreadAuraVariant } from './threadAuraModel';

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
    testID={`thread-aura-${props.variant}`} style={[styles.layer, { width: props.size * 1.6, height: props.size * 1.6, left: -props.size * 0.3, top: -props.size * 0.3 }]}>
    {Renderer ? <Renderer {...props} active={props.active && foreground} animate={animate} particlesEnabled={tier === 'high'} /> : <ThreadAuraStatic {...props} />}
  </View>;
});

/** Renderer fallback: native SVG blur + alpha tint, never a substitute symbol or circular halo. */
export const ThreadAuraStatic = memo(function ThreadAuraStatic(props: ThreadAuraProps) {
  const id = React.useId().replace(/:/g, '');
  const s = normalizeThreadStrength(props.threadStrength);
  const p = threadAuraParameters(s, props.variant);
  const span = props.size * 1.6;
  const inset = (span - props.artworkSize) / 2;
  const hex = props.categoryColor.replace('#', '');
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return <Svg width="100%" height="100%" viewBox={`0 0 ${span} ${span}`}>
    <Defs><Filter id={id} x="-60%" y="-60%" width="220%" height="220%">
      <FeGaussianBlur stdDeviation={props.artworkSize * p.blur} />
      <FeColorMatrix type="matrix" values={`0 0 0 0 ${rgb[0]} 0 0 0 0 ${rgb[1]} 0 0 0 0 ${rgb[2]} 0 0 0 1 0`} />
    </Filter></Defs>
    <G filter={`url(#${id})`} opacity={p.outer + p.inner}>
      <SvgXml xml={props.svg} x={inset} y={inset} width={props.artworkSize} height={props.artworkSize} />
    </G>
  </Svg>;
});

const styles = StyleSheet.create({ layer: { position: 'absolute' } });
