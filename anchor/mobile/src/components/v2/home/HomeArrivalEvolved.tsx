import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { CircularAnchorRenderer } from '@/components/v2';
import type { Anchor } from '@/types';
import { useHomeArrivalStore, type ArrivalGhost } from '@/stores/v2/homeArrivalStore';
import { colors } from '@/theme/v2';
import { EVOLVED_LINE_HEIGHT, evolvedLineRowHeight } from './homeHeroLayout';
import {
  EVOLVED_GHOST_SCALE,
  evolvedGhostOpacity,
  evolvedLineProgress,
  evolvedParams,
  evolvedUnderlineProgress,
  useHomeArrivalContext,
  type EvolvedArrivalMotion,
} from './homeArrival';

/**
 * The three things Evolved anchor lands on Home (EV1) adds to the hero, each a no-op unless that
 * arrival is playing: the released Anchor's art lingering behind the new one, the underline drawing,
 * and one line under the intention. Everything reads the arrival's shared progress.
 */

/** The only new string of the scene. Typographic quotes; the intention is the released Anchor's own words. */
export function evolvedFromLine(intention: string): string {
  return `Evolved from “${intention}”`;
}

/**
 * The released Anchor's art, faint, behind the new one. It fades in with the arrival and dissolves
 * before it ends, so it is never there at rest. No ghost without the artwork: nothing is drawn.
 */
export function HomeEvolvedGhost({ anchorSize, boxHeight, active }: { anchorSize: number; boxHeight: number; active: boolean }) {
  const arrival = useHomeArrivalContext();
  const motion = active ? arrival?.evolved ?? null : null;
  if (!arrival || !motion || !motion.ghost) return null;
  const size = Math.round(anchorSize * EVOLVED_GHOST_SCALE);
  return (
    <EvolvedGhostArt
      ghost={motion.ghost}
      size={size}
      top={(boxHeight - size) / 2}
      motion={motion}
      progress={arrival.progress}
    />
  );
}

function EvolvedGhostArt({ ghost, size, top, motion, progress }: {
  ghost: ArrivalGhost;
  size: number;
  top: number;
  motion: EvolvedArrivalMotion;
  progress: SharedValue<number>;
}) {
  const params = evolvedParams(motion);
  const style = useAnimatedStyle(() => ({ opacity: evolvedGhostOpacity(progress.value, params) }));
  return (
    <Animated.View
      pointerEvents="none"
      testID="v2-home-evolved-ghost"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ghost, { width: size, height: size, borderRadius: size / 2, top, marginLeft: -size / 2 }, style]}
    >
      <CircularAnchorRenderer
        svg={ghost.svg}
        imageUrl={ghost.imageUrl}
        category={ghost.category}
        expression={ghost.expression}
        size={size}
        appearance="paper"
      />
    </Animated.View>
  );
}

/**
 * Draws its child (the hand-drawn underline) from left to right during an evolved arrival. At any
 * other time it is the child, untouched, so nothing about the layout changes.
 */
export function HomeArrivalUnderline({ active, width, height, children }: {
  active: boolean;
  width: number;
  height: number;
  children: React.ReactElement;
}) {
  const arrival = useHomeArrivalContext();
  const motion = active ? arrival?.evolved ?? null : null;
  if (!arrival || !motion) return children;
  return <UnderlineDraw width={width} height={height} motion={motion} progress={arrival.progress}>{children}</UnderlineDraw>;
}

function UnderlineDraw({ width, height, motion, progress, children }: {
  width: number;
  height: number;
  motion: EvolvedArrivalMotion;
  progress: SharedValue<number>;
  children: React.ReactElement;
}) {
  const params = evolvedParams(motion);
  const reveal = useAnimatedStyle(() => ({ width: width * evolvedUnderlineProgress(progress.value, params) }));
  return (
    <Animated.View testID="v2-home-underline-draw" style={{ width, height }}>
      <Animated.View style={[{ height, overflow: 'hidden' }, reveal]}>{children}</Animated.View>
    </Animated.View>
  );
}

/**
 * One line under the intention: "Evolved from “<the released Anchor's intention>”". It exists only for
 * the selected Anchor during its evolved arrival, including the Reduce Motion crossfade.
 * It fades in (2200 to 2800ms, ease-out) and is removed when the scene finishes or is skipped.
 */
export function HomeEvolvedFromLine({ anchor, active }: { anchor: Pick<Anchor, 'evolvedFrom'>; active: boolean }) {
  const arrival = useHomeArrivalContext();
  const { fontScale } = useWindowDimensions();
  const kind = useHomeArrivalStore((state) => state.arrival?.kind);
  const intention = anchor.evolvedFrom?.intention?.trim();
  if (!intention || !active || !arrival?.active || kind !== 'evolved') return null;
  const motion = active ? arrival?.evolved ?? null : null;
  const line = !motion ? <Text testID="v2-home-evolved-from" style={styles.line} numberOfLines={1}>{evolvedFromLine(intention)}</Text> : <FadingLine text={evolvedFromLine(intention)} motion={motion} progress={arrival.progress} />;
  return <View testID="v2-home-evolved-row" style={{ height: evolvedLineRowHeight(fontScale), paddingVertical: 4 }}>{line}</View>;
}

function FadingLine({ text, motion, progress }: {
  text: string;
  motion: EvolvedArrivalMotion;
  progress: SharedValue<number>;
}) {
  const params = evolvedParams(motion);
  const style = useAnimatedStyle(() => ({ opacity: evolvedLineProgress(progress.value, params) }));
  return <Animated.Text testID="v2-home-evolved-from" style={[styles.line, style]} numberOfLines={1}>{text}</Animated.Text>;
}

const styles = StyleSheet.create({
  ghost: { position: 'absolute', left: '50%', overflow: 'hidden' },
  // The carousel reserves a scaled row during this scene; no negative-margin slack.
  line: {

    fontFamily: 'EBGaramond-Italic',
    fontSize: 13,
    lineHeight: EVOLVED_LINE_HEIGHT,
    textAlign: 'center',
    color: colors.text.secondary,
    paddingHorizontal: 24,
  },
});
