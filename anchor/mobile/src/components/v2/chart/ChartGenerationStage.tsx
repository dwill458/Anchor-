import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { colors, spacing, typography } from '@/theme/v2';
import { ChartLandscape, ROUTE_LIGHT, ROUTE_REVEAL_END, type ChartAnchorArt, type ChartMarker } from './ChartLandscape';
import { CHART_WINDOWS } from './chartRouteGeometry';
import { CHART_EASING, CHART_MAPPING_TIMING as T, chartRepeat, chartSequence, chartTiming } from './chartMotion';

/** @deprecated Use CHART_MAPPING_TIMING from ./chartMotion. Kept for existing imports. */
export const CHART_REVEAL_TIMING = T;

export type ChartMappingStage = 'reading' | 'finding' | 'building' | 'ready';
const STAGES: ChartMappingStage[] = ['reading', 'finding', 'building', 'ready'];

/** Reduced motion: the same honest stages, as short cross-fades. */
const REDUCED = { commitAfter: 600, readyAfter: 260, revealAfter: 420 } as const;

type Props = {
  width: number;
  height: number;
  category?: string | null;
  anchorArt?: ChartAnchorArt | null;
  destinationImageUrl?: string | null;
  /** The planned destination. Shown only once the route has resolved to it. */
  destinationLabel?: string | null;
  /** Null while the request runs. Set once real waypoints exist. */
  markers: ChartMarker[] | null;
  reducedMotion: boolean;
  /** Called once the route, its waypoints and the destination have fully resolved. */
  onRevealed?: () => void;
  /** Once revealed, the map stays mounted and settled (review, reveal) — status recedes. */
  settled?: boolean;
  /** Caption at the start of the trail; changes from HERE to START once the Chart exists. */
  hereCaption?: string;
  /** Room reserved under the map (status line while mapping, actions afterwards). */
  footerSpace?: number;
  testID?: string;
};

/**
 * The mapping sequence: the user watches Anchor construct their route.
 *
 *  1 TERRAIN   the landscape resolves out of the dark
 *  2 HERE      their Anchor settles at the start
 *  3 THERE     the destination resolves in the distance
 *  4 ROUTE     a pencil survey reaches toward THERE while the request runs
 *              (with a quiet reading sweep if it takes longer — never frozen);
 *              only when real waypoints exist does the route itself draw,
 *              each waypoint resolving with one restrained ripple as it passes
 *  5 SETTLE    one light pass along the finished route, then everything settles
 *
 * Nothing claims completion before the response exists: the solid route,
 * waypoints and "Chart ready" all wait for real data.
 */
export function ChartGenerationStage({
  width,
  height,
  category,
  anchorArt,
  destinationImageUrl,
  destinationLabel,
  markers,
  reducedMotion,
  onRevealed,
  settled = false,
  hereCaption = CHART_COPY.labels.here,
  footerSpace = STATUS_SPACE,
  testID,
}: Props) {
  const veil = useSharedValue(reducedMotion ? 0.3 : 0.86);
  const terrain = useSharedValue(reducedMotion ? 1 : 0);
  const hereReveal = useSharedValue(0);
  const destinationReveal = useSharedValue(0);
  const surveyReveal = useSharedValue(0);
  const routeReveal = useSharedValue(0);
  const sweep = useSharedValue(0);
  const sweepOpacity = useSharedValue(0);
  const statusOpacity = useSharedValue(1);
  const travelled = useSharedValue(0);

  const [stage, setStage] = useState<ChartMappingStage>('reading');
  const [longWaitIndex, setLongWaitIndex] = useState(-1);
  const [destinationResolved, setDestinationResolved] = useState(false);
  const startedAt = useRef(Date.now());
  const committed = useRef(false);
  const holding = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onRevealedRef = useRef(onRevealed);
  onRevealedRef.current = onRevealed;

  const schedule = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, Math.max(0, ms)));
  };

  // Phases 1–4a: terrain, HERE, THERE, survey. Independent of the request.
  useEffect(() => {
    const running = timers.current;
    if (reducedMotion) {
      destinationReveal.value = chartTiming(1, { duration: T.reducedFade });
      hereReveal.value = chartTiming(1, { duration: T.reducedFade });
      schedule(() => !committed.current && setStage('finding'), T.minStageCopy);
    } else {
      veil.value = chartTiming(0.3, { duration: T.terrain, easing: CHART_EASING.settle });
      terrain.value = chartTiming(1, { duration: T.terrain * 1.6, easing: CHART_EASING.settle });
      schedule(() => {
        hereReveal.value = chartTiming(1, { duration: T.here, easing: CHART_EASING.settle });
      }, T.hereAt);
      schedule(() => {
        destinationReveal.value = chartTiming(1, { duration: T.there, easing: CHART_EASING.settle });
      }, T.thereAt);
      schedule(() => {
        if (committed.current) return;
        setStage('finding');
        surveyReveal.value = chartTiming(1, { duration: T.survey, easing: CHART_EASING.draw });
      }, T.surveyAt);
      // Still waiting once the survey reaches THERE: read along it, quietly, until data exists.
      schedule(() => {
        if (committed.current) return;
        holding.current = true;
        sweep.value = 0;
        sweep.value = chartRepeat(chartTiming(1, { duration: T.holdSweep, easing: CHART_EASING.deliberate }));
        sweepOpacity.value = chartTiming(0.3, { duration: 600 });
      }, T.surveyAt + T.survey);
    }
    T.longWait.forEach((ms, index) => schedule(() => !committed.current && setLongWaitIndex(index), ms));
    return () => {
      running.forEach(clearTimeout);
      [veil, terrain, hereReveal, destinationReveal, surveyReveal, routeReveal, sweep, sweepOpacity, statusOpacity].forEach(
        (value) => cancelAnimation(value)
      );
    };
    // Runs once per mapping; the stage remounts for a new attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phases 4b–5: only on a real result.
  useEffect(() => {
    if (!markers || committed.current) return;
    committed.current = true;
    const elapsed = Date.now() - startedAt.current;
    const surveyDone = T.surveyAt + T.survey;

    if (reducedMotion) {
      schedule(() => {
        setLongWaitIndex(-1);
        setStage('building');
        routeReveal.value = ROUTE_REVEAL_END;
        veil.value = chartTiming(0, { duration: T.reducedFade });
        schedule(() => {
          setStage('ready');
          setDestinationResolved(true);
        }, REDUCED.readyAfter);
        schedule(() => onRevealedRef.current?.(), REDUCED.readyAfter + REDUCED.revealAfter);
      }, REDUCED.commitAfter - elapsed);
      return;
    }

    // The survey always reaches THERE first, so fast answers still read as a map being made.
    schedule(() => {
      setLongWaitIndex(-1);
      setStage('building');
      if (holding.current) {
        sweepOpacity.value = chartTiming(0, { duration: 260 });
      }
      surveyReveal.value = chartTiming(1, { duration: 200 });
      routeReveal.value = chartTiming(ROUTE_REVEAL_END, { duration: T.route, easing: CHART_EASING.draw });
      veil.value = chartTiming(0.14, { duration: T.route });
      // The route arrives at THERE: destination resolves, one light pass, settle.
      schedule(() => {
        cancelAnimation(sweep);
        sweep.value = 0;
        setStage('ready');
        setDestinationResolved(true);
        destinationReveal.value = chartSequence(
          chartTiming(0.55, { duration: 140 }),
          chartTiming(1, { duration: 520, easing: CHART_EASING.settle })
        );
        sweepOpacity.value = chartSequence(
          chartTiming(0.9, { duration: T.sweep * 0.25 }),
          chartTiming(0.9, { duration: T.sweep * 0.45 }),
          chartTiming(0, { duration: T.sweep * 0.3 })
        );
        sweep.value = chartTiming(1, { duration: T.sweep, easing: CHART_EASING.deliberate });
        veil.value = chartTiming(0, { duration: T.sweep + T.settle, easing: CHART_EASING.settle });
      }, T.route * 0.88);
      schedule(() => onRevealedRef.current?.(), T.route * 0.88 + T.sweep + T.settle);
    }, surveyDone - elapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  useEffect(() => {
    if (!settled) return;
    statusOpacity.value = reducedMotion ? 0 : chartTiming(0, { duration: 320 });
  }, [reducedMotion, settled, statusOpacity]);

  // A very small viewport drift following the route upward; the terrain settles from 2% scale.
  const cameraStyle = useAnimatedStyle(() => {
    if (reducedMotion) return { transform: [{ translateY: 0 }, { scale: 1 }] };
    const progress = Math.max(0, Math.min(1, routeReveal.value / ROUTE_REVEAL_END));
    return {
      transform: [{ translateY: -5 + 10 * progress }, { scale: 1.02 - 0.02 * terrain.value }],
    };
  });
  const statusStyle = useAnimatedStyle(() => ({ opacity: statusOpacity.value }));

  const phrase =
    longWaitIndex >= 0 && (stage === 'reading' || stage === 'finding')
      ? CHART_COPY.generation.longWait[longWaitIndex]
      : CHART_COPY.generation.stages[stage];
  const stageIndex = STAGES.indexOf(stage);
  const shownMarkers = useMemo(() => markers ?? [], [markers]);

  return (
    <View testID={testID} style={[styles.stage, { width, height }]}>
      <Animated.View style={[styles.landscape, { bottom: footerSpace }, cameraStyle]}>
        <ChartLandscape
          width={width}
          category={category}
          window={CHART_WINDOWS.full}
          markers={shownMarkers}
          markersFollowRoute
          travelled={travelled}
          routeReveal={routeReveal}
          surveyReveal={surveyReveal}
          sweep={sweep}
          sweepOpacity={sweepOpacity}
          veil={veil}
          hereReveal={hereReveal}
          destinationReveal={destinationReveal}
          anchorArt={anchorArt}
          destinationImageUrl={destinationImageUrl}
          destinationLabel={destinationResolved ? destinationLabel : null}
          hereCaption={hereCaption}
          thereCaption={CHART_COPY.labels.there}
          scrimTop
          scrimBottom={colors.ink.base}
          accessibilityLabel={markers ? `Route mapped with ${markers.length} waypoints` : 'Mapping your route'}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.status, { height: footerSpace }, statusStyle]}
        accessibilityLiveRegion="polite"
        accessible
        accessibilityLabel={phrase}
        testID="chart-generation-status"
      >
        <View style={styles.ticks}>
          {STAGES.map((key, index) => (
            <View key={key} style={[styles.tick, index <= stageIndex && styles.tickOn]} />
          ))}
        </View>
        <Text style={styles.phrase}>{phrase}</Text>
      </Animated.View>
    </View>
  );
}

/** Room reserved under the map for the status line, so HERE is never covered. */
const STATUS_SPACE = 96;

const styles = StyleSheet.create({
  stage: { overflow: 'hidden', backgroundColor: colors.ink.base },
  landscape: { position: 'absolute', left: 0 },
  status: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[5],
    justifyContent: 'center',
    gap: spacing[2],
  },
  ticks: { flexDirection: 'row', gap: 6 },
  tick: { width: 18, height: 2, borderRadius: 1, backgroundColor: colors.ink.hairlineStrong },
  tickOn: { backgroundColor: ROUTE_LIGHT },
  phrase: { ...typography.bodyMD, color: colors.ink.text.primary },
});
