import React, { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { cancelAnimation, Easing, ReduceMotion, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { ComponentProps } from 'react';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import type { ChartAnchorArt } from '../ChartLandscape';
import type { AskAccent } from './askChartTheme';
import { askRevealEnergy } from './askReveal';

type Props = {
  art: ChartAnchorArt | null;
  category: string | null | undefined;
  accent: AskAccent;
  size?: number;
  testID?: string;
  aura?: ComponentProps<typeof CircularAnchorRenderer>['aura'];
};

/**
 * The person's own Anchor, rendered from their stored structure (never a stock icon). With no Anchor art yet it
 * falls back to a quiet category-coloured disc so layout never shifts.
 */
export const AskAnchorAvatar = memo(function AskAnchorAvatar({ art, category, accent, size = 34, testID, aura }: Props) {
  if (!art?.svg) {
    return <View testID={testID} style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: accent.wash, borderColor: accent.border }]} />;
  }
  return (
    <CircularAnchorRenderer
      testID={testID}
      svg={art.svg}
      imageUrl={art.imageUrl}
      category={art.category ?? category}
      expression={art.expression ?? undefined}
      size={size}
      appearance="tinted"
      accessibilityLabel="Your Anchor"
      aura={aura}
    />
  );
});

/** Display-only strength that sets how full the shared Anchor aura looks while speaking. It is never the person's Thread Strength. */
const SPEAKING_AURA_LEVEL = 70;

/**
 * The avatar while the Anchor is speaking (thinking, streaming, or revealing its words). It uses the app's own Thread
 * Aura (the glow around Anchors on Home and Details) at a fixed look, fading in when speech starts and out when it
 * ends, with a gentle bloom while active. Nothing here reads or changes Thread Strength and no number is shown.
 * Under reduced motion the aura holds steady.
 */
export const AskSpeakingAvatar = memo(function AskSpeakingAvatar({ art, category, accent, size = 34, reducedMotion, active, mode, testID }: Props & { reducedMotion: boolean; active?: boolean; mode?: 'off' | 'thinking' | 'speaking' }) {
  const full = SPEAKING_AURA_LEVEL / 100;
  const state = mode ?? (active ? 'speaking' : 'off');
  const enabled = state !== 'off';
  const level = useSharedValue(enabled ? 1 : 0);
  const bloom = useSharedValue(1);
  useEffect(() => {
    level.value = reducedMotion ? (enabled ? 1 : 0) : withTiming(enabled ? 1 : 0, { duration: enabled ? 320 : 700, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never });
    // DEFERRED: the unconditional speaking bloom loop is now thinking-only (Oct 2026).
    if (state === 'thinking' && !reducedMotion) {
      bloom.value = withRepeat(withTiming(1.07, { duration: 1100, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }), -1, true);
    } else {
      cancelAnimation(bloom);
      bloom.value = 1;
    }
    return () => cancelAnimation(bloom);
  }, [enabled, state, bloom, level, reducedMotion]);
  const progress = useDerivedValue(() => level.value * full * (state === 'thinking' ? 0.8 : reducedMotion ? 1 : 0.70 + 0.30 * askRevealEnergy.value));
  const strengthBloom = useDerivedValue(() => reducedMotion ? 1 : state === 'thinking' ? bloom.value : 1 + 0.07 * askRevealEnergy.value);
  const aura = useMemo(
    () => ({ anchorId: 'ask-chart-speaking', threadStrength: SPEAKING_AURA_LEVEL, variant: 'details' as const, active: true, strengthProgress: progress, strengthBloom, reducedMotion }),
    [strengthBloom, progress, reducedMotion]
  );
  return (
    <View testID={testID} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={state === 'thinking' ? 'Your Anchor is thinking' : enabled ? 'Your Anchor is speaking' : 'Your Anchor'}>
      <AskAnchorAvatar art={art} category={category} accent={accent} size={size} aura={aura} />
    </View>
  );
});

const styles = StyleSheet.create({
  fallback: { borderWidth: StyleSheet.hairlineWidth },
});
