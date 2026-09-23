import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { colors, spacing, typography } from '@/theme/v2';
import { ChartLandscape, type ChartAnchorArt, type ChartMarker } from './ChartLandscape';
import { CHART_WINDOWS } from './chartRouteGeometry';

/**
 * Timings for the map reveal. Kept together so device tuning is one edit;
 * ceremonial motion runs ~1.5× the prototype pace on real devices.
 */
export const CHART_REVEAL_TIMING = {
  veilIn: 1400,
  /** Route draws to this fraction while waiting for the server. */
  waitingThreshold: 0.62,
  routeToThreshold: 4200,
  /** Shortest honest reveal: fast responses still read as a map, not a flash. */
  minimumMs: 3200,
  phraseEveryMs: 2400,
  longWaitMs: [12_000, 22_000],
  routeFinish: 900,
  markerStagger: 220,
  settle: 700,
} as const;

type Props = {
  width: number;
  height: number;
  category?: string | null;
  anchorArt?: ChartAnchorArt | null;
  destinationImageUrl?: string | null;
  destinationLabel?: string | null;
  /** Null while waiting. Set once real waypoints exist. */
  markers: ChartMarker[] | null;
  reducedMotion: boolean;
  /** Called once markers and destination have fully resolved. */
  onRevealed?: () => void;
  testID?: string;
};

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
  testID,
}: Props) {
  const veil = useSharedValue(reducedMotion ? 0.3 : 0.78);
  const routeReveal = useSharedValue(reducedMotion ? 0 : 0);
  const markerReveal = useSharedValue(0);
  const destinationReveal = useSharedValue(0);
  const travelled = useSharedValue(0);
  const ambient = useSharedValue(0);
  const startedAt = useRef(Date.now());
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [longWaitIndex, setLongWaitIndex] = useState(-1);
  const revealedRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(() => {
    const running = timers.current;
    if (reducedMotion) {
      destinationReveal.value = withTiming(0.85, { duration: 300 });
    } else {
      veil.value = withTiming(0.34, { duration: CHART_REVEAL_TIMING.veilIn, easing: Easing.out(Easing.cubic) });
      destinationReveal.value = withTiming(0.55, { duration: CHART_REVEAL_TIMING.veilIn * 1.4 });
      routeReveal.value = withTiming(CHART_REVEAL_TIMING.waitingThreshold, {
        duration: CHART_REVEAL_TIMING.routeToThreshold,
        easing: Easing.inOut(Easing.quad),
      });
      // Quiet life while waiting: the scene breathes, nothing pulses.
      ambient.value = withRepeat(
        withSequence(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 3200, easing: Easing.inOut(Easing.sin) })),
        -1,
        false
      );
    }
    const phraseTimer = setInterval(() => {
      setPhraseIndex((index) => Math.min(index + 1, CHART_COPY.generation.phrases.length - 1));
    }, CHART_REVEAL_TIMING.phraseEveryMs);
    CHART_REVEAL_TIMING.longWaitMs.forEach((ms, index) => schedule(() => setLongWaitIndex(index), ms));
    return () => {
      clearInterval(phraseTimer);
      running.forEach(clearTimeout);
      cancelAnimation(ambient);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve only on a real result, after the minimum honest duration.
  useEffect(() => {
    if (!markers || revealedRef.current) return;
    revealedRef.current = true;
    const elapsed = Date.now() - startedAt.current;
    const wait = reducedMotion ? 0 : Math.max(0, CHART_REVEAL_TIMING.minimumMs - elapsed);
    schedule(() => {
      setLongWaitIndex(-1);
      cancelAnimation(ambient);
      if (reducedMotion) {
        routeReveal.value = 1;
        markerReveal.value = withTiming(markers.length, { duration: 250 });
        destinationReveal.value = withTiming(1, { duration: 250 });
        veil.value = withTiming(0, { duration: 250 });
        schedule(() => onRevealed?.(), 300);
        return;
      }
      routeReveal.value = withTiming(1, { duration: CHART_REVEAL_TIMING.routeFinish, easing: Easing.out(Easing.cubic) });
      veil.value = withTiming(0, { duration: CHART_REVEAL_TIMING.routeFinish + 400 });
      const markersMs = markers.length * CHART_REVEAL_TIMING.markerStagger;
      schedule(() => {
        markerReveal.value = withTiming(markers.length, { duration: markersMs, easing: Easing.linear });
      }, CHART_REVEAL_TIMING.routeFinish * 0.6);
      schedule(() => {
        destinationReveal.value = withTiming(1, { duration: 500 });
      }, CHART_REVEAL_TIMING.routeFinish * 0.6 + markersMs);
      schedule(() => onRevealed?.(), CHART_REVEAL_TIMING.routeFinish * 0.6 + markersMs + CHART_REVEAL_TIMING.settle);
    }, wait);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  const ambientStyle = useAnimatedStyle(() => ({ opacity: 0.05 * ambient.value }));
  const progressStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.02, routeReveal.value) }] }));

  const phrase = markers
    ? CHART_COPY.generation.phrases[CHART_COPY.generation.phrases.length - 1]
    : longWaitIndex >= 0
      ? CHART_COPY.generation.longWait[longWaitIndex]
      : CHART_COPY.generation.phrases[phraseIndex];

  const landscapeWidth = width;
  const shownMarkers = useMemo(() => markers ?? [], [markers]);

  return (
    <View testID={testID} style={[styles.stage, { width, height }]}>
      <ChartLandscape
        width={landscapeWidth}
        category={category}
        window={CHART_WINDOWS.full}
        markers={shownMarkers}
        travelled={travelled}
        routeReveal={routeReveal}
        markerReveal={markerReveal}
        veil={veil}
        destinationReveal={destinationReveal}
        anchorArt={anchorArt}
        destinationImageUrl={destinationImageUrl}
        destinationLabel={destinationLabel}
        hereCaption={CHART_COPY.labels.here}
        thereCaption={CHART_COPY.labels.there}
        scrimTop
        scrimBottom={colors.ink.base}
        accessibilityLabel={markers ? `Route mapped with ${markers.length} waypoints` : 'Mapping your route'}
        style={[styles.landscape, { bottom: STATUS_CARD_SPACE }]}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ambient, ambientStyle]} />
      <View style={styles.status} accessibilityLiveRegion="polite" accessible accessibilityLabel={phrase}>
        <Text style={styles.phrase}>{phrase}</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.bar, progressStyle]} />
        </View>
      </View>
    </View>
  );
}

/** Room reserved under the map for the status card, so HERE is never covered. */
const STATUS_CARD_SPACE = 104;

const styles = StyleSheet.create({
  stage: { overflow: 'hidden', backgroundColor: colors.ink.base, justifyContent: 'flex-end' },
  landscape: { position: 'absolute', left: 0, bottom: 0 },
  ambient: { backgroundColor: '#F2E6CB', opacity: 0 },
  status: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[5],
    padding: spacing[4],
    borderRadius: 18,
    backgroundColor: 'rgba(18, 26, 34, 0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink.hairlineStrong,
    gap: spacing[3],
  },
  phrase: { ...typography.bodyMD, color: colors.ink.text.primary },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.ink.hairlineStrong, overflow: 'hidden' },
  bar: { height: 3, width: '100%', backgroundColor: '#F2E6CB', transformOrigin: 'left' },
});
