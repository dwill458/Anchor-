import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { colors, spacing } from '@/theme/v2';
import { usePerformanceTier } from '@/hooks/usePerformanceTier';
import { chartTypography } from './chartTypography';
import { ChartStaticMap } from './panel/ChartStaticMap';
import { CHART_INTRO_TIMING } from './chartMotion';
import { hexToRgba } from './map/chartMapShaders';
import { useChartSound } from './useChartSound';
import { useChartSequencer } from './map/useChartSequencer';
import {
  introFullSequence,
  introReducedSequence,
  introSkipSequence,
  introShortSequence,
  type ChartIntroBeat,
  type IntroSequenceProgress,
} from './map/chartMapSequences';
import { getChartIntroSeen, setChartIntroSeen } from './chartIntroSeen';
import { MAP_H, MAP_W } from './map/chartMapContracts';

type Props = {
  category: string | null | undefined;
  categoryColor: string;
  reducedMotion: boolean;
  onContinue: () => void;
  /** Parent-prepared presentation state, allowing the first visible frame to start synchronously. */
  initialSeen?: boolean;
  /** Keep the native map surface mounted beneath the parent's paper hold without starting the sequence. */
  preparing?: boolean;
  onIntroSurfaceReady?: () => void;
  artReadyAtMount?: boolean;
  /** Parent already tried decoding; allow the paper-only fallback if decoding failed. */
  artPreparationSettledAtMount?: boolean;
  introWidth?: number;
  /** Development lab override; production callers leave this unset. */
  replayMode?: 'full' | 'short';
  /** Parent header forwards non-button taps as a monotonically increasing request. */
  skipRequest?: number;
};

/** Creation intro: the existing map, animated ink pass, paper zone and copy. */
export function ChartIntroOpening({ category, categoryColor, reducedMotion, onContinue, replayMode, skipRequest = 0, initialSeen, preparing = false, onIntroSurfaceReady, artReadyAtMount = false, artPreparationSettledAtMount = false, introWidth }: Props) {
  const { width: windowWidth, height } = useWindowDimensions();
  const width = introWidth ?? windowWidth;
  const performanceTier = usePerformanceTier();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const insets = useSafeAreaInsets();
  const runner = useChartSequencer(reducedMotion);
  const performanceTierRef = useRef(performanceTier);
  performanceTierRef.current = performanceTier;
  const sound = useChartSound(reducedMotion, {
    airFadeInMs: CHART_INTRO_TIMING.airFadeIn,
    playOpenWhenReducedMotion: true,
    fadeAirOnUnmount: true,
  });
  const contour = useSharedValue(0);
  const tone = useSharedValue(0);
  const route = useSharedValue(0);
  const copy = useSharedValue(0);
  const marker = useSharedValue(0);
  const continueProgress = useSharedValue(0);
  const land = useSharedValue(0);
  const cameraScale = useSharedValue(1);
  const progress = useMemo<IntroSequenceProgress>(
    () => ({ contour, tone, route, copy, marker, continue: continueProgress, land, cameraScale }),
    [cameraScale, continueProgress, copy, contour, land, marker, route, tone],
  );
  const [inkMounted, setInkMounted] = useState(true);
  // The settled layer is prepared under the paper cover from mount; its UI-clock opacity remains zero until the final crossfade.
  const [baseLandVisible, setBaseLandVisible] = useState(true);
  const [continueEnabled, setContinueEnabled] = useState(false);
  const [mapReady, setMapReady] = useState(artReadyAtMount || artPreparationSettledAtMount);
  const [introCanvasSized, setIntroCanvasSized] = useState(false);
  const [seen, setSeen] = useState<boolean | null>(replayMode ? replayMode === 'short' : initialSeen ?? null);
  const resolvedSeen = replayMode ? replayMode === 'short' : initialSeen ?? seen;
  const [bodyFrame, setBodyFrame] = useState({ y: 0, height: 0 });
  const rootRef = useRef<View>(null);
  const started = useRef(false);
  const skipOnStart = useRef(skipRequest > 0);
  const skipStarted = useRef(false);
  const introSurfaceFrameReady = useRef(false);
  const handledSkipRequest = useRef(skipRequest);
  const activeMode = useRef<'full' | 'short' | 'reduced'>('full');
  const openPlayed = useRef(false);
  const onBeat = useCallback((beat: ChartIntroBeat) => {
    switch (beat) {
      case 'open': openPlayed.current = true; sound.open(); break;
      case 'ink': sound.ink(activeMode.current === 'short' ? CHART_INTRO_TIMING.shortRoute : CHART_INTRO_TIMING.route); break;
      case 'flag': sound.flag(); break;
      case 'duck': sound.duck(1300); break;
    }
  }, [sound]);

  const onRouteStart = useCallback(() => {
    // The helper catches storage errors; a failed write must never restart the opening.
    void setChartIntroSeen().catch(() => undefined);
  }, []);
  const onSequenceEnd = useCallback(() => {
    setInkMounted(false);
  }, []);
  const onLandReveal = useCallback(() => setBaseLandVisible(true), []);
  const onMapArtReady = useCallback((ready: boolean) => {
    setMapReady(ready || artPreparationSettledAtMount);
  }, [artPreparationSettledAtMount]);
  const onIntroCanvasSized = useCallback(() => setIntroCanvasSized(true), []);

  useEffect(() => {
    if (!preparing || !mapReady || !introCanvasSized || introSurfaceFrameReady.current) return undefined;
    let firstFrame: number | null = null;
    let secondFrame: number | null = null;
    firstFrame = requestAnimationFrame(() => {
      firstFrame = null;
      secondFrame = requestAnimationFrame(() => {
        secondFrame = null;
        introSurfaceFrameReady.current = true;
        onIntroSurfaceReady?.();
      });
    });
    return () => {
      if (firstFrame !== null) cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
    };
  }, [introCanvasSized, mapReady, onIntroSurfaceReady, preparing]);

  useEffect(() => {
    if (replayMode) setSeen(replayMode === 'short');
    else if (initialSeen !== undefined) setSeen(initialSeen);
  }, [initialSeen, replayMode]);

  useEffect(() => {
    if (artPreparationSettledAtMount && !artReadyAtMount) setBaseLandVisible(true);
  }, [artPreparationSettledAtMount, artReadyAtMount]);

  const runSkipTransition = useCallback(() => {
    if (skipStarted.current) return;
    skipStarted.current = true;
    runner.cancel();
    void runner.run(introSkipSequence({
      progress,
      onContinueVisible: () => setContinueEnabled(true),
      onRouteStart,
      onLandReveal,
      onEnd: onSequenceEnd,
    }));
  }, [onLandReveal, onRouteStart, onSequenceEnd, progress, runner]);

  useEffect(() => {
    if (preparing || initialSeen !== undefined || replayMode) return undefined;
    let active = true;
    void getChartIntroSeen().then(value => {
      if (active) setSeen(value);
    }).catch(() => {
      if (active) setSeen(false);
    });
    return () => { active = false; };
  }, [initialSeen, preparing, replayMode]);

  useLayoutEffect(() => {
    const sequenceReady = mapReady || artReadyAtMount || artPreparationSettledAtMount;
    if (preparing || resolvedSeen === null || !sequenceReady || started.current) return undefined;
    started.current = true;
    if (skipOnStart.current) {
      runSkipTransition();
      return () => runner.cancel();
    }
    const shaderFallback = artPreparationSettledAtMount && !artReadyAtMount;
    const shouldReduceMotion = reducedMotionRef.current || shaderFallback;
    const useShortSequence = replayMode
      ? replayMode === 'short'
      : resolvedSeen || performanceTierRef.current === 'low';
    activeMode.current = shouldReduceMotion ? 'reduced' : useShortSequence ? 'short' : 'full';
    const context = {
      progress,
      onBeat,
      onContinueVisible: () => setContinueEnabled(true),
      onRouteStart,
      onLandReveal,
      onEnd: onSequenceEnd,
    };
    const spec = shouldReduceMotion
      ? introReducedSequence(context)
      : useShortSequence
        ? introShortSequence(context)
        : introFullSequence({ ...context, onStartAir: () => {
          sound.startAir();
        } });
    void runner.run(spec);
    return () => runner.cancel();
  }, [artPreparationSettledAtMount, artReadyAtMount, mapReady, onBeat, onLandReveal, onRouteStart, onSequenceEnd, preparing, progress, replayMode, resolvedSeen, runSkipTransition, runner, sound.startAir]);

  useEffect(() => {
    if (!reducedMotion || !started.current || activeMode.current === 'reduced' || !runner.isBusy()) return;
    activeMode.current = 'reduced';
    runner.cancel();
    sound.stopAir();
    void runner.run(introReducedSequence({
      progress,
      onBeat: openPlayed.current ? undefined : onBeat,
      onContinueVisible: () => setContinueEnabled(true),
      onRouteStart,
      onLandReveal,
      onEnd: onSequenceEnd,
    }));
  }, [onBeat, onLandReveal, onRouteStart, onSequenceEnd, progress, reducedMotion, runner, sound.stopAir]);

  const skip = useCallback(() => {
    if (runner.isBusy()) runSkipTransition();
    else if (!started.current) skipOnStart.current = true;
  }, [runSkipTransition, runner]);

  useEffect(() => {
    if (skipRequest <= handledSkipRequest.current) return;
    handledSkipRequest.current = skipRequest;
    skip();
  }, [skip, skipRequest]);

  const handleContinue = useCallback(() => {
    if (!continueEnabled) return;
    if (runner.isBusy()) runner.skip();
    sound.stopAir();
    onContinue();
  }, [continueEnabled, onContinue, runner, sound]);

  const copyStyle = useAnimatedStyle(() => ({
    opacity: copy.value,
    transform: [{ translateY: (1 - copy.value) * 14 }],
  }));
  const continueStyle = useAnimatedStyle(() => ({ opacity: continueProgress.value }));
  const paperStart = bodyFrame.height > 0 ? Math.max(0, Math.min(1, (height * 0.55 - bodyFrame.y) / bodyFrame.height)) : 0;
  const paperEnd = bodyFrame.height > 0 ? Math.max(paperStart + 0.01, Math.min(1, (height * 0.78 - bodyFrame.y) / bodyFrame.height)) : 1;
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const localHeight = event.nativeEvent.layout.height;
    rootRef.current?.measureInWindow((_x, y, _width, measuredHeight) => {
      setBodyFrame(current => current.y === y && current.height === measuredHeight
        ? current
        : { y, height: measuredHeight || localHeight });
    });
  }, [width]);

  return (
    <View
      ref={rootRef}
      onLayout={onLayout}
      style={styles.root}
      accessibilityElementsHidden={preparing}
      importantForAccessibility={preparing ? 'no-hide-descendants' : 'auto'}
      testID="chart-intro-opening"
    >
      <Pressable
        accessibilityRole="none"
        accessible={false}
        onPress={skip}
        style={StyleSheet.absoluteFill}
        testID="chart-intro-skip-surface"
      />
      <View style={[styles.map, { width, height: (width * MAP_H) / MAP_W }]}>
        <ChartStaticMap
          width={width}
          categoryColor={categoryColor}
          category={category}
          mode="empty"
          waypointCount={3}
          reducedMotion={reducedMotion}
            introProgress={inkMounted ? progress : undefined}
            introBaseVisible={baseLandVisible}
          onArtReady={onMapArtReady}
          onIntroSurfaceSized={onIntroCanvasSized}
          onMapPress={skip}
          testID="chart-intro-map"
        />
      </View>
      {bodyFrame.height > 0 ? <LinearGradient
        pointerEvents="none"
        colors={[hexToRgba(colors.canvas, 0), hexToRgba(colors.canvas, 0), colors.canvas, colors.canvas]}
        locations={[0, paperStart, paperEnd, 1]}
        style={styles.paperZone}
        testID="chart-intro-paper-zone"
      /> : null}
      <Animated.View style={[styles.copy, { paddingBottom: insets.bottom + spacing[4] }]} pointerEvents="box-none">
        <Animated.View style={[styles.copyText, copyStyle]} pointerEvents="none">
          <Text accessibilityRole="header" style={styles.headline}>{CHART_COPY.empty.headline}</Text>
          <Text style={styles.support}>{CHART_COPY.empty.support}</Text>
        </Animated.View>
        <Animated.View
        style={[styles.cta, continueStyle]}
        pointerEvents={continueEnabled ? 'auto' : 'none'}
        accessibilityElementsHidden={!continueEnabled}
        importantForAccessibility={continueEnabled ? 'auto' : 'no-hide-descendants'}
        testID="chart-intro-continue-wrap"
      >
        <V2Button
          size="large"
          iconRight={<ArrowRight size={18} color={colors.text.inverse} />}
          disabled={!continueEnabled}
          onPress={handleContinue}
          testID="chart-create-cta"
          accessibilityLabel={CHART_COPY.empty.cta}
        >
          {CHART_COPY.empty.cta}
        </V2Button>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { position: 'absolute', left: 0, top: 0 },
  paperZone: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  copy: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, paddingHorizontal: spacing[5], gap: spacing[2] },
  copyText: { gap: spacing[2] },
  headline: { ...chartTypography.displayMedium, fontFamily: 'EBGaramond-Medium', fontSize: 34, lineHeight: 38, color: colors.text.primary },
  support: { ...chartTypography.bodyLG, color: colors.text.secondary },
  cta: { marginTop: spacing[4], zIndex: 3 },
});
