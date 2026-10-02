import React, { memo, useEffect, useMemo } from 'react';
import {
  Circle, DashPathEffect, DiscretePathEffect, Group, Path, RadialGradient, Skia, vec,
} from '@shopify/react-native-skia';
import {
  Easing, cancelAnimation, useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import type { ChartMapAnimState, RouteTable, WaypointPlacement } from './chartMapContracts';
import { buildRoughRoute, hexToRgba, routeCoordAt } from './chartMapShaders';
import { CHART_MAP_GOLD, CHART_MAP_TOKENS } from './chartMapTokens';
import { useChartMapCameraTransform } from './useChartMapCamera';

const INK = CHART_MAP_TOKENS.ink;
const PAPER = CHART_MAP_TOKENS.paper;

const X_A = 'M-15,-15 L15,15';
const X_B = 'M15,-15 L-15,15';
const GLYPH_STEM = 'M0,-23 L0,20 M-14,-11 L14,-11 M-24,6 L0,24 L24,6';
const GLYPH_DIAMOND = 'M0,-6 L5,0 L0,6 L-5,0 Z';
const FLAG_POLE = 'M0,0 L0,-54';
const FLAG_PENNANT = 'M2,-54 L34,-44 L2,-33 Z';
const SWAY_DEG = 2;
const SWAY_HALF_MS = 2000; // 4 s loop
const DEG = Math.PI / 180;

type Props = {
  width: number;
  height: number;
  anim: ChartMapAnimState;
  table: RouteTable;
  placement: WaypointPlacement;
  categoryColor: string;
  reducedMotion: boolean;
  arrived: boolean;
};

/**
 * Overlay layer (inside its own transparent Skia Canvas): ghost + brush route,
 * start dot, tip + pulse, flag and summit. Kept apart from the land canvas so
 * the continuous flag sway never re-runs the fog shader.
 */
export const ChartMapOverlay = memo(function ChartMapOverlay({
  width, height, anim, table, placement, categoryColor, reducedMotion, arrived,
}: Props) {
  const cameraTransform = useChartMapCameraTransform(anim, width, height);
  const routePath = useMemo(() => Skia.Path.MakeFromSVGString(table.svgPath), [table.svgPath]);

  const { arcs, count } = table;
  // Rough centreline: built once (stable edge), trimmed with start/end, no runtime path effect.
  const rough = useMemo(() => buildRoughRoute(table), [table]);
  const roughPath = useMemo(() => Skia.Path.MakeFromSVGString(rough.svgPath), [rough]);
  const rxs = rough.xs;
  const rys = rough.ys;
  const rcum = rough.cum;
  const rtotal = rough.total;
  // end = polyLenAt(revealArc) / polyTotal, so the trim ends exactly at the tip.
  const end = useDerivedValue(() => {
    const f = routeCoordAt(rcum, arcs, count, anim.revealArc.value) / rtotal;
    return f < 0 ? 0 : f > 1 ? 1 : f;
  }, [rtotal]);

  // Tip / pulse position: worklet reads typed arrays only.
  const tipTransform = useDerivedValue(() => {
    const a = anim.revealArc.value;
    return [{ translateX: routeCoordAt(rxs, arcs, count, a) }, { translateY: routeCoordAt(rys, arcs, count, a) }];
  });
  const tipOpacity = useDerivedValue(() => (anim.revealArc.value <= 0.5 ? 0 : 1));

  const pulseOpacity = useDerivedValue(() => 0.9 * (1 - anim.pulse.value));
  const pulseR = useDerivedValue(() => 26 + 56 * anim.pulse.value);
  const pulseColors = useMemo(() => [hexToRgba(categoryColor, 0.6), hexToRgba(categoryColor, 0)], [categoryColor]);

  // Flag: stands 30 above marker[flagIndex], drops 16 -> 0 with flagDrop.
  const px = useMemo(() => Float32Array.from(placement.points.map(p => p.x)), [placement]);
  const py = useMemo(() => Float32Array.from(placement.points.map(p => p.y)), [placement]);
  const flagTransform = useDerivedValue(() => {
    const i = anim.flagIndex.value;
    const k = i < 0 ? 0 : i >= px.length ? px.length - 1 : i | 0;
    return [{ translateX: px[k] }, { translateY: py[k] - 30 - 16 * (1 - anim.flagDrop.value) }];
  });
  const flagOpacity = useDerivedValue(() => (anim.flagIndex.value < 0 ? 0 : anim.flagOpacity.value));

  const sway = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(sway);
      sway.value = 0;
      return undefined;
    }
    const ease = Easing.bezier(0.4, 0, 0.6, 1);
    sway.value = -SWAY_DEG;
    sway.value = withRepeat(
      withSequence(
        withTiming(SWAY_DEG, { duration: SWAY_HALF_MS, easing: ease }),
        withTiming(-SWAY_DEG, { duration: SWAY_HALF_MS, easing: ease }),
      ),
      -1,
    );
    return () => cancelAnimation(sway);
  }, [reducedMotion, sway]);
  const swayTransform = useDerivedValue(() => [{ rotate: sway.value * DEG }]);

  const xOpacity = useDerivedValue(() => 1 - anim.glyph.value);
  const glyphOpacity = useDerivedValue(() => anim.glyph.value);
  const goldOpacity = useDerivedValue(() => anim.goldDot.value);

  return (
    <Group transform={cameraTransform}>
      {routePath ? (
        <>
          <Path path={routePath} style="stroke" strokeWidth={4} strokeCap="round" color={INK} opacity={0.45}>
            <DashPathEffect intervals={[1, 10]} />
          </Path>
          {roughPath ? (
            <Path path={roughPath} style="stroke" strokeWidth={5.5} strokeCap="round" strokeJoin="round" color={INK} start={0} end={end} />
          ) : null}
        </>
      ) : null}
      <Circle cx={placement.start.x} cy={placement.start.y} r={9} color={INK} />

      {!reducedMotion ? (
        <Group transform={tipTransform} opacity={pulseOpacity}>
          <Circle cx={0} cy={0} r={pulseR}>
            <RadialGradient c={vec(0, 0)} r={pulseR} colors={pulseColors} />
          </Circle>
        </Group>
      ) : null}
      {!arrived ? (
        <Group transform={tipTransform} opacity={tipOpacity}>
          <Circle cx={0} cy={0} r={8} color={categoryColor} />
          <Circle cx={0} cy={0} r={8} color={PAPER} style="stroke" strokeWidth={3} />
        </Group>
      ) : null}

      <Group transform={[{ translateX: placement.summit.x }, { translateY: placement.summit.y }]}>
        <Group opacity={xOpacity}>
          <Path path={X_A} style="stroke" strokeWidth={6} strokeCap="round" color={INK}>
            <DiscretePathEffect length={6} deviation={1.2} seed={3} />
          </Path>
          <Path path={X_B} style="stroke" strokeWidth={6} strokeCap="round" color={INK}>
            <DiscretePathEffect length={6} deviation={1.2} seed={5} />
          </Path>
        </Group>
        <Group opacity={glyphOpacity}>
          <Circle cx={0} cy={-30} r={7} style="stroke" strokeWidth={4.5} color={INK} />
          <Path path={GLYPH_STEM} style="stroke" strokeWidth={4.5} strokeCap="round" strokeJoin="round" color={INK} />
          <Path path={GLYPH_DIAMOND} style="stroke" strokeWidth={4.5} strokeCap="round" strokeJoin="round" color={INK} />
          <Circle cx={0} cy={0} r={4} color={CHART_MAP_GOLD} opacity={goldOpacity} />
        </Group>
      </Group>

      {!arrived ? (
      <Group transform={flagTransform} opacity={flagOpacity}>
        <Group transform={swayTransform}>
          <Path path={FLAG_POLE} style="stroke" strokeWidth={4} strokeCap="round" color={INK} />
          <Path path={FLAG_PENNANT} color={CHART_MAP_GOLD} />
          <Path path={FLAG_PENNANT} style="stroke" strokeWidth={2.5} strokeJoin="round" color={INK} />
        </Group>
      </Group>
      ) : null}
    </Group>
  );
});
