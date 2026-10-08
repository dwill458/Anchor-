import type { ChartMapFrame } from './chartMapGeometry';
import React, { memo, useEffect, useMemo, useRef } from 'react';
import {
  Circle, DashPathEffect, DiscretePathEffect, Group, Path, RadialGradient, Skia, vec,
} from '@shopify/react-native-skia';
import {
  Easing, cancelAnimation, useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import type { ChartMapAnimState, ChartRouteRevision, RouteTable, WaypointPlacement } from './chartMapContracts';
import { buildRoughRoute, hexToRgba, routeCoordAt } from './chartMapShaders';
import { CHART_MAP_GOLD, CHART_MAP_TOKENS } from './chartMapTokens';
import { useChartIntroCameraTransform, useChartMapCameraTransform } from './useChartMapCamera';
import type { IntroSequenceProgress } from './chartMapSequences';

const INK = CHART_MAP_TOKENS.ink;
const SUMMIT_INK = '#7D766A';
const PAPER = CHART_MAP_TOKENS.paper;

const X_A = 'M-15,-15 L15,15';
const X_B = 'M15,-15 L-15,15';
const GLYPH_STEM = 'M0,-23 L0,20 M-14,-11 L14,-11 M-24,6 L0,24 L24,6';
const GLYPH_DIAMOND = 'M0,-6 L5,0 L0,6 L-5,0 Z';
const FLAG_POLE = 'M0,0 L0,-54';
const FLAG_PENNANT = 'M2,-54 L34,-44 L2,-33 Z';
/** The summit's soft glow (S1): the gold of the flag, bloomed wide and faint behind the destination. */
const GLOW_R = 78;
const GLOW_PEAK = 0.5;
/** The flag planted at the summit stands a little higher (clear of the artwork's circle) and pops 1 -> 1.12 as it drops. */
const SUMMIT_FLAG_LIFT = 38;
const WAYPOINT_FLAG_LIFT = 30;
const SUMMIT_FLAG_POP = 0.12;
const SWAY_DEG = 2;
const SWAY_HALF_MS = 2000; // 4 s loop
const DEG = Math.PI / 180;

type Props = {
  frame?: ChartMapFrame;
  width: number;
  height: number;
  anim: ChartMapAnimState;
  table: RouteTable;
  placement: WaypointPlacement;
  categoryColor: string;
  reducedMotion: boolean;
  arrived: boolean;
  /** Fog of war: the dotted route to the summit only shows as far as the clouds have lifted. */
  clouds?: boolean;
  /** Living weather covers the map: the summit X shows only faintly through it until arrival. */
  livingWeather?: boolean;
  introProgress?: IntroSequenceProgress;
  /**
   * Route revised (R1). When given, the old pencil route fades, the new one is drawn by the pen and settles into
   * pencil. Absent (every other host) the route draws exactly as before.
   */
  revision?: ChartRouteRevision;
  /** The Anchor's real artwork stands at the summit (rendered by the marker layer): the drawn stand-in glyph stays hidden. */
  summitArtwork?: boolean;
  /** The flag planted at the summit (S1) stays on screen once the Chart is arrived. */
  plantedFlag?: boolean;
};

/**
 * Overlay layer (inside its own transparent Skia Canvas): ghost + brush route,
 * start dot, tip + pulse, flag and summit. Kept apart from the land canvas so
 * the continuous flag sway never re-runs the fog shader.
 */
export const ChartMapOverlay = memo(function ChartMapOverlay({
  width, height, anim, table, placement, categoryColor, reducedMotion, arrived, clouds = false, livingWeather = false, introProgress, frame,
  revision, summitArtwork = false, plantedFlag = false,
}: Props) {
  // The opening keeps this overlay mounted after dropping its shader progress.
  // It still has no flag while the user reads the settled intro.
  const introSurface = useRef(introProgress !== undefined);
  if (introProgress) introSurface.current = true;
  const cameraTransform = useChartMapCameraTransform(anim, width, height, frame);
  // No overlay content is visible before the survey route starts. Keep its
  // picture static until then; the ink canvas owns the early camera movement.
  const introTransform = useChartIntroCameraTransform(introProgress?.cameraScale, width, introProgress?.route);
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

  // Undiscovered route geometry stays hidden: the dotted line ends a little past the revealed tip (into the fog).
  // Living weather: the surveyed (dotted) route also reaches as far as the clouds have parted (creation's planned
  // first leg, the next leg hinted after a reach). Static clouds keep the original rule.
  const dottedEnd = useDerivedValue(() => {
    if (!clouds) return 1;
    // DEFERRED (static clouds only now): (revealArc + 140 + 3000 * fog) / total
    const reach = livingWeather ? Math.max(anim.revealArc.value + 140, anim.coverArc.value) : anim.revealArc.value + 140;
    const f = (reach + 3000 * anim.fog.value) / table.total;
    return f < 0 ? 0 : f > 1 ? 1 : f;
  }, [clouds, livingWeather, table.total]);

  const routeEnd = useDerivedValue(() => introProgress?.route.value ?? dottedEnd.value, [dottedEnd, introProgress]);

  // Route revised (R1): the surveyed (pencil) route fades out and back in around the pen's pass. At rest (out = pencil = 1)
  // and with no revision it is the same .45 as ever.
  const pencilOpacity = useDerivedValue(
    () => (revision ? 0.45 * Math.max(1 - revision.out.value, revision.pencil.value) : 0.45),
    [revision],
  );
  // The pen's pass runs from the ink tip to as far as the pencil route reaches (never into undiscovered ground).
  const penStart = useDerivedValue(() => {
    const f = anim.revealArc.value / table.total;
    return f < 0 ? 0 : f > 1 ? 1 : f;
  }, [table.total]);
  const penEnd = useDerivedValue(() => {
    if (!revision) return penStart.value;
    return penStart.value + Math.max(0, routeEnd.value - penStart.value) * revision.pen.value;
  }, [revision, penStart, routeEnd]);
  const penOpacity = useDerivedValue(() => (revision ? 0.9 * (1 - revision.pencil.value) : 0), [revision]);

  // Tip / pulse position: worklet reads typed arrays only.
  const tipTransform = useDerivedValue(() => {
    const a = anim.revealArc.value;
    return [{ translateX: routeCoordAt(rxs, arcs, count, a) }, { translateY: routeCoordAt(rys, arcs, count, a) }];
  });
  // The tip dot is the pen's tip: it rests on the X once the route is drawn to the summit, so it hides there.
  const tipOpacity = useDerivedValue(() => (anim.revealArc.value <= 0.5 || anim.revealArc.value >= table.total - 0.5 ? 0 : 1), [table.total]);

  const pulseOpacity = useDerivedValue(() => 0.9 * (1 - anim.pulse.value));
  const pulseR = useDerivedValue(() => 26 + 56 * anim.pulse.value);
  const pulseColors = useMemo(() => [hexToRgba(categoryColor, 0.6), hexToRgba(categoryColor, 0)], [categoryColor]);

  // Flag: stands 30 above marker[flagIndex], drops 16 -> 0 with flagDrop. The table has one slot past the last waypoint:
  // the summit, where the flag plants at the end of the Chart (S1). There it stands higher and pops 1 -> 1.12 as it drops.
  const px = useMemo(() => Float32Array.from([...placement.points.map(p => p.x), placement.summit.x]), [placement]);
  const py = useMemo(() => Float32Array.from([...placement.points.map(p => p.y), placement.summit.y]), [placement]);
  const flagTransform = useDerivedValue(() => {
    const i = anim.flagIndex.value;
    const last = px.length - 1;
    const k = i < 0 ? 0 : i >= px.length ? last : i | 0;
    const atSummit = k === last;
    const lift = atSummit ? SUMMIT_FLAG_LIFT : WAYPOINT_FLAG_LIFT;
    const drop = anim.flagDrop.value;
    return [
      { translateX: px[k] },
      { translateY: py[k] - lift - 16 * (1 - drop) },
      { scale: atSummit ? 1 + SUMMIT_FLAG_POP * Math.sin(Math.PI * Math.max(0, Math.min(1, drop))) : 1 },
    ];
  });
  const flagOpacity = useDerivedValue(() => (anim.flagIndex.value < 0 ? 0 : anim.flagOpacity.value));

  const sway = useSharedValue(0);
  useEffect(() => {
    // The intro uses the destination X, never the flag. An invisible flag sway
    // would still invalidate this entire canvas every frame.
    if (reducedMotion || introSurface.current) {
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
  }, [introProgress, reducedMotion, sway]);
  const swayTransform = useDerivedValue(() => [{ rotate: sway.value * DEG }]);

  // DEFERRED: const xOpacity = useDerivedValue(() => 1 - anim.glyph.value);
  const xFaint = clouds && livingWeather && !arrived;
  // Under living weather the X shows faintly through the clouds, but once the pen has drawn the route to it, it is full.
  const xOpacity = useDerivedValue(() => introProgress
    ? introProgress.marker.value
    : (xFaint && anim.revealArc.value < table.total - 1 ? 0.35 : 1) * (1 - anim.glyph.value), [introProgress, xFaint, table.total]);
  const startOpacity = useDerivedValue(() => introProgress ? introProgress.route.value : 1, [introProgress]);
  const xScale = useDerivedValue(() => {
    if (!introProgress) return 1;
    const p = introProgress.marker.value;
    return p < 0.85 ? 0.4 + (0.68 / 0.85) * p : 1.08 - (0.08 * (p - 0.85)) / 0.15;
  }, [introProgress]);
  const xTransform = useDerivedValue(() => [{ scale: xScale.value }], [xScale]);
  // The drawn glyph is only the stand-in for an Anchor with no artwork to show.
  const glyphOpacity = useDerivedValue(() => (summitArtwork ? 0 : anim.glyph.value), [summitArtwork]);
  const goldOpacity = useDerivedValue(() => anim.goldDot.value);
  const glowOpacity = useDerivedValue(() => GLOW_PEAK * anim.goldDot.value);
  const glowColors = useMemo(() => [hexToRgba(CHART_MAP_GOLD, 0.55), hexToRgba(CHART_MAP_GOLD, 0)], []);

  return (
    <Group transform={introTransform}>
    <Group transform={cameraTransform}>
      {routePath ? (
        <>
          <Path path={routePath} style="stroke" strokeWidth={4} strokeCap="round" color={INK} opacity={revision ? pencilOpacity : 0.45} start={0} end={routeEnd}>
            <DashPathEffect intervals={[1, 10]} />
          </Path>
          {revision ? (
            <Path path={routePath} style="stroke" strokeWidth={4.5} strokeCap="round" strokeJoin="round" color={INK} opacity={penOpacity} start={penStart} end={penEnd} />
          ) : null}
          {roughPath ? (
            <Path path={roughPath} style="stroke" strokeWidth={5.5} strokeCap="round" strokeJoin="round" color={INK} start={0} end={end} />
          ) : null}
        </>
      ) : null}
      <Circle cx={placement.start.x} cy={placement.start.y} r={9} color={INK} opacity={startOpacity} />

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
        <Group opacity={glowOpacity}>
          <Circle cx={0} cy={0} r={GLOW_R}>
            <RadialGradient c={vec(0, 0)} r={GLOW_R} colors={glowColors} />
          </Circle>
        </Group>
        <Group opacity={xOpacity} transform={xTransform}>
          <Path path={X_A} style="stroke" strokeWidth={3.6} strokeCap="round" color={SUMMIT_INK}>
            <DiscretePathEffect length={6} deviation={1.2} seed={3} />
          </Path>
          <Path path={X_B} style="stroke" strokeWidth={3.6} strokeCap="round" color={SUMMIT_INK}>
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

      {!arrived || plantedFlag ? (
      <Group transform={flagTransform} opacity={flagOpacity}>
        <Group transform={swayTransform}>
          <Path path={FLAG_POLE} style="stroke" strokeWidth={4} strokeCap="round" color={INK} />
          <Path path={FLAG_PENNANT} color={CHART_MAP_GOLD} />
          <Path path={FLAG_PENNANT} style="stroke" strokeWidth={2.5} strokeJoin="round" color={INK} />
        </Group>
      </Group>
      ) : null}
    </Group>
    </Group>
  );
});
