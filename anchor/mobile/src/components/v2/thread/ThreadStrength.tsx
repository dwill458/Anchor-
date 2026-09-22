/**
 * ThreadStrength.tsx
 *
 * Animated Thread Strength component for Anchor detail screens.
 *
 * Features:
 * - Multi-strand woven thread cord matching the design mockup (4 intertwined active fibers in category color)
 * - Fraying into 5 loose unwoven gray strands past the percentage point to the end of the track
 * - Animated percentage count-up on the UI thread with full Android & iOS compatibility
 * - Synchronized reveal from left to right using dual-layer strokeDashoffset + hardware-accelerated clipping
 * - "+X% this week" pill that fades and slides in ~300ms after the thread completes
 * - Replays smoothly from 0 on focus via navigation focus listeners, canceling on blur/unmount
 * - Seamlessly animates between values if `percent` changes while mounted without resetting to 0
 * - Reliable Android animation: protects against system animator scale zero skips via ReduceMotion.Never
 * - Respects in-app reduce motion preference and optional reduceMotion prop override
 * - Polish: glowing leading tip dot following the wave curvature during reveal
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { colors, typography } from '@/theme/v2';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSystemReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import {
  COLORED_STRAND_2,
  COLORED_STRAND_3,
  COLORED_STRAND_4,
  DEFAULT_COLORED_WAVE,
  GRAY_STRAND_1,
  GRAY_STRAND_2,
  GRAY_STRAND_3,
  GRAY_STRAND_4,
  GRAY_STRAND_5,
  generateWavePath,
  getWaveLength,
  getWaveY,
} from './wavePath';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface ThreadStrengthProps {
  /** Percentage value to display and reveal, clamped 0-100. */
  percent: number;
  /** Category color for the thread strand (e.g. Desire crimson, Health green, Career amber). */
  color: string;
  /** Delta from previous week (e.g. 6 -> "+6% this week"). */
  weeklyDelta?: number | null;
  /** Duration of reveal & count-up in ms (default: 1400ms). */
  duration?: number;
  /** Height of the wave graphic in px (default: 48). */
  height?: number;
  /** Optional status word (e.g. ROOTED, EMBEDDED, GROUNDED) displayed beside header. */
  status?: string;
  /** Optional header label (defaults to "CONSISTENCY", the user-facing name). */
  label?: string;
  /** Indicator arrow style: 'triangle' ('▲' / '▼') or 'arrow' ('↑' / '↓') (default: 'triangle'). */
  arrowStyle?: 'triangle' | 'arrow';
  /** Whether to render the weekly delta pill (default: true if weeklyDelta is non-null). */
  showDelta?: boolean;
  /** Optional reduced motion override (if omitted, uses Anchor's settings preference). */
  reduceMotion?: boolean;
  /** Optional container style. */
  style?: StyleProp<ViewStyle>;
  /**
   * Render the percentage count-up and delta row (default: true). Surfaces
   * that already print the value beside the thread (Home Progress) turn this
   * off and keep only the track, so the number is never shown twice.
   */
  showMetrics?: boolean;
  /**
   * Colour and opacity of the loose, unwoven strands past the percentage
   * point. The defaults are tuned for the cream Details surface; on graphite
   * they would all but vanish, so dark surfaces pass a lighter strand.
   */
  inactiveColor?: string;
  inactiveOpacity?: number;
  /** Test identifier. */
  testID?: string;
}

const EASING = Easing.bezier(0.22, 1, 0.36, 1);
const MIN_ACTIVE_VISUAL_PERCENT = 7;
const SERIF_FONT = Platform.select({
  ios: 'EBGaramond-Medium',
  android: 'EBGaramond-Medium',
  default: 'serif',
});

export function ThreadStrength({
  percent,
  color,
  weeklyDelta,
  duration = 1400,
  height = 48,
  status,
  label = 'CONSISTENCY',
  arrowStyle = 'triangle',
  showDelta,
  reduceMotion: reduceMotionOverride,
  style,
  showMetrics = true,
  inactiveColor = colors.text.disabled,
  inactiveOpacity = 0.35,
  testID = 'thread-strength',
}: ThreadStrengthProps) {
  // Respect in-app preference; avoid false-positive zero animator scale on Android
  const inAppPreference = useSettingsStore((s) => s.reduceMotion ?? 'system');
  const systemReducedMotion = useSystemReduceMotionEnabled();

  const effectiveReduceMotion = useMemo(() => {
    if (reduceMotionOverride !== undefined) {
      return reduceMotionOverride;
    }
    if (inAppPreference === 'on') {
      return true;
    }
    if (inAppPreference === 'off') {
      return false;
    }
    return systemReducedMotion;
  }, [reduceMotionOverride, inAppPreference, systemReducedMotion]);

  const clampedPercent = Math.min(100, Math.max(0, Math.round(Number.isFinite(percent) ? percent : 0)));

  // Track layout width (React state for SVG path geometry, shared value for UI thread animations)
  const [trackWidth, setTrackWidth] = useState<number>(0);
  const trackWidthShared = useSharedValue(0);

  // Native TextInput reference for direct Android UI-thread text updates
  const inputRef = useRef<TextInput>(null);

  // Animation values
  const progress = useSharedValue(effectiveReduceMotion ? 1 : 0);
  const startPercent = useSharedValue(effectiveReduceMotion ? clampedPercent : 0);
  const targetPercent = useSharedValue(clampedPercent);

  // Pill animation values
  const pillOpacity = useSharedValue(effectiveReduceMotion ? 1 : 0);
  const pillTranslateY = useSharedValue(effectiveReduceMotion ? 0 : 6);

  // Screen focus state: default true so initial mount on focused screen immediately activates
  const isFocusedRef = useRef(true);
  const prevPercentRef = useRef(clampedPercent);

  // Android & iOS reliable text update without per-frame setState
  const updateNativeText = useCallback((textVal: string) => {
    inputRef.current?.setNativeProps({ text: textVal });
  }, []);

  // Primary animation trigger when gaining focus or after layout measurement
  const triggerFocusAnimation = useCallback(() => {
    if (effectiveReduceMotion) {
      startPercent.value = clampedPercent;
      targetPercent.value = clampedPercent;
      progress.value = 1;
      pillOpacity.value = 1;
      pillTranslateY.value = 0;
      if (inputRef.current) {
        inputRef.current.setNativeProps({ text: `${clampedPercent}%` });
      }
      return;
    }

    // Cancel any active transitions
    cancelAnimation(progress);
    cancelAnimation(pillOpacity);
    cancelAnimation(pillTranslateY);

    // Reset to starting frame
    startPercent.value = 0;
    targetPercent.value = clampedPercent;
    progress.value = 0;
    pillOpacity.value = 0;
    pillTranslateY.value = 6;

    if (inputRef.current) {
      inputRef.current.setNativeProps({ text: '0%' });
    }

    // Run synchronized thread reveal and number count-up
    progress.value = withTiming(
      1,
      {
        duration,
        easing: EASING,
        reduceMotion: ReduceMotion.Never,
      },
      (finished) => {
        if (finished) {
          runOnJS(updateNativeText)(`${clampedPercent}%`);
          // Pill fades and slides in ~300ms after the thread completes
          pillOpacity.value = withDelay(
            300,
            withTiming(1, {
              duration: 350,
              easing: Easing.out(Easing.quad),
              reduceMotion: ReduceMotion.Never,
            })
          );
          pillTranslateY.value = withDelay(
            300,
            withTiming(0, {
              duration: 350,
              easing: Easing.out(Easing.quad),
              reduceMotion: ReduceMotion.Never,
            })
          );
        }
      }
    );
  }, [clampedPercent, duration, effectiveReduceMotion, pillOpacity, pillTranslateY, progress, startPercent, targetPercent, updateNativeText]);

  // Measure track width via onLayout and start animation immediately once width is known
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const w = Math.round(event.nativeEvent.layout.width);
    if (w > 0) {
      trackWidthShared.value = w;
      setTrackWidth((prev) => {
        if (prev !== w) {
          return w;
        }
        return prev;
      });
    }
  }, [trackWidthShared]);

  // React Navigation integration for focus replay & cancel on blur/unmount
  let navigation: ReturnType<typeof useNavigation> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    navigation = useNavigation();
  } catch {
    navigation = null;
  }

  const nav = navigation as unknown as {
    addListener?: (event: 'focus' | 'blur', callback: () => void) => () => void;
  } | null;

  useEffect(() => {
    if (!nav || typeof nav.addListener !== 'function') {
      return undefined;
    }

    const unsubscribeFocus = nav.addListener('focus', () => {
      isFocusedRef.current = true;
      if (trackWidthShared.value > 0) {
        triggerFocusAnimation();
      }
    });

    const unsubscribeBlur = nav.addListener('blur', () => {
      isFocusedRef.current = false;
      cancelAnimation(progress);
      cancelAnimation(pillOpacity);
      cancelAnimation(pillTranslateY);
    });

    return () => {
      unsubscribeFocus?.();
      unsubscribeBlur?.();
    };
  }, [nav, trackWidthShared, triggerFocusAnimation, progress, pillOpacity, pillTranslateY]);

  // Trigger animation once trackWidth is measured
  useEffect(() => {
    if (trackWidth > 0 && isFocusedRef.current) {
      triggerFocusAnimation();
    }
  }, [trackWidth, triggerFocusAnimation]);

  // Native number count-up synchronization
  useAnimatedReaction(
    () => {
      const currentVal = Math.round(
        startPercent.value +
          (targetPercent.value - startPercent.value) * progress.value
      );
      return `${currentVal}%`;
    },
    (currentText, previousText) => {
      if (currentText !== previousText) {
        runOnJS(updateNativeText)(currentText);
      }
    }
  );

  // Smoothly animate between values if percent changes while mounted
  useEffect(() => {
    if (prevPercentRef.current === clampedPercent) return;
    prevPercentRef.current = clampedPercent;

    if (!isFocusedRef.current || trackWidth <= 0) {
      targetPercent.value = clampedPercent;
      return;
    }

    if (effectiveReduceMotion) {
      startPercent.value = clampedPercent;
      targetPercent.value = clampedPercent;
      progress.value = 1;
      if (inputRef.current) {
        inputRef.current.setNativeProps({ text: `${clampedPercent}%` });
      }
      return;
    }

    // Calculate current position to animate from without restarting at 0
    const currentVal =
      startPercent.value +
      (targetPercent.value - startPercent.value) * progress.value;

    cancelAnimation(progress);
    startPercent.value = currentVal;
    targetPercent.value = clampedPercent;
    progress.value = 0;

    const fraction = Math.abs(clampedPercent - currentVal) / 100;
    const dynamicDuration = Math.max(350, Math.round(duration * fraction));

    progress.value = withTiming(1, {
      duration: dynamicDuration,
      easing: EASING,
      reduceMotion: ReduceMotion.Never,
    });
  }, [clampedPercent, duration, effectiveReduceMotion, progress, startPercent, targetPercent, trackWidth]);

  // Pre-generate interwoven active colored paths and exact arc lengths
  const coloredPath1 = useMemo(
    () => (trackWidth > 0 ? generateWavePath(trackWidth, height, DEFAULT_COLORED_WAVE) : ''),
    [trackWidth, height]
  );
  const path1Length = useMemo(
    () => (trackWidth > 0 ? getWaveLength(trackWidth, height, DEFAULT_COLORED_WAVE) : 0),
    [trackWidth, height]
  );

  const coloredPath2 = useMemo(
    () => (trackWidth > 0 ? generateWavePath(trackWidth, height, COLORED_STRAND_2) : ''),
    [trackWidth, height]
  );
  const path2Length = useMemo(
    () => (trackWidth > 0 ? getWaveLength(trackWidth, height, COLORED_STRAND_2) : 0),
    [trackWidth, height]
  );

  const coloredPath3 = useMemo(
    () => (trackWidth > 0 ? generateWavePath(trackWidth, height, COLORED_STRAND_3) : ''),
    [trackWidth, height]
  );
  const path3Length = useMemo(
    () => (trackWidth > 0 ? getWaveLength(trackWidth, height, COLORED_STRAND_3) : 0),
    [trackWidth, height]
  );

  const coloredPath4 = useMemo(
    () => (trackWidth > 0 ? generateWavePath(trackWidth, height, COLORED_STRAND_4) : ''),
    [trackWidth, height]
  );
  const path4Length = useMemo(
    () => (trackWidth > 0 ? getWaveLength(trackWidth, height, COLORED_STRAND_4) : 0),
    [trackWidth, height]
  );

  // Pre-generate static loose unwoven gray strands past percentage point
  const grayPath1 = useMemo(
    () => (trackWidth > 0 ? generateWavePath(trackWidth, height, GRAY_STRAND_1) : ''),
    [trackWidth, height]
  );
  const grayPath2 = useMemo(
    () => (trackWidth > 0 ? generateWavePath(trackWidth, height, GRAY_STRAND_2) : ''),
    [trackWidth, height]
  );
  const grayPath3 = useMemo(
    () => (trackWidth > 0 ? generateWavePath(trackWidth, height, GRAY_STRAND_3) : ''),
    [trackWidth, height]
  );
  const grayPath4 = useMemo(
    () => (trackWidth > 0 ? generateWavePath(trackWidth, height, GRAY_STRAND_4) : ''),
    [trackWidth, height]
  );
  const grayPath5 = useMemo(
    () => (trackWidth > 0 ? generateWavePath(trackWidth, height, GRAY_STRAND_5) : ''),
    [trackWidth, height]
  );

  // Animated strokeDashoffset props for reliable 60fps path drawing on Android and iOS
  const strand1Props = useAnimatedProps(() => {
    const currentVal =
      startPercent.value +
      (targetPercent.value - startPercent.value) * progress.value;
    const visualVal = Math.max(MIN_ACTIVE_VISUAL_PERCENT, Math.max(0, Math.min(100, currentVal)));
    const fraction = visualVal / 100;
    return {
      strokeDashoffset: path1Length * (1 - fraction),
    };
  });

  const strand2Props = useAnimatedProps(() => {
    const currentVal =
      startPercent.value +
      (targetPercent.value - startPercent.value) * progress.value;
    const visualVal = Math.max(MIN_ACTIVE_VISUAL_PERCENT, Math.max(0, Math.min(100, currentVal)));
    const fraction = visualVal / 100;
    return {
      strokeDashoffset: path2Length * (1 - fraction),
    };
  });

  const strand3Props = useAnimatedProps(() => {
    const currentVal =
      startPercent.value +
      (targetPercent.value - startPercent.value) * progress.value;
    const visualVal = Math.max(MIN_ACTIVE_VISUAL_PERCENT, Math.max(0, Math.min(100, currentVal)));
    const fraction = visualVal / 100;
    return {
      strokeDashoffset: path3Length * (1 - fraction),
    };
  });

  const strand4Props = useAnimatedProps(() => {
    const currentVal =
      startPercent.value +
      (targetPercent.value - startPercent.value) * progress.value;
    const visualVal = Math.max(MIN_ACTIVE_VISUAL_PERCENT, Math.max(0, Math.min(100, currentVal)));
    const fraction = visualVal / 100;
    return {
      strokeDashoffset: path4Length * (1 - fraction),
    };
  });

  // Hardware-accelerated clip container for colored thread reveal
  const animatedClipStyle = useAnimatedStyle(() => {
    const currentVal =
      startPercent.value +
      (targetPercent.value - startPercent.value) * progress.value;
    const visualVal = Math.max(MIN_ACTIVE_VISUAL_PERCENT, Math.max(0, Math.min(100, currentVal)));
    const clipWidth =
      trackWidthShared.value > 0
        ? (trackWidthShared.value * visualVal) / 100
        : 0;
    return {
      width: clipWidth,
    };
  });

  // Dynamic revealing of the loose unwoven gray strands ahead of the colored thread
  const animatedGrayStyle = useAnimatedStyle(() => {
    const currentVal =
      startPercent.value +
      (targetPercent.value - startPercent.value) * progress.value;
    const visualVal = Math.max(MIN_ACTIVE_VISUAL_PERCENT, Math.max(0, Math.min(100, currentVal)));
    const clipX =
      trackWidthShared.value > 0
        ? (trackWidthShared.value * visualVal) / 100
        : 0;
    const remainingWidth = Math.max(0, trackWidthShared.value - clipX);
    return {
      left: clipX,
      width: remainingWidth,
    };
  });

  // Animated text input props for UI-thread number count-up
  const animatedTextProps = useAnimatedProps(() => {
    const currentVal = Math.round(
      startPercent.value +
        (targetPercent.value - startPercent.value) * progress.value
    );
    const textVal = `${currentVal}%`;
    return {
      text: textVal,
      defaultValue: textVal,
    } as unknown as Partial<TextInputProps>;
  });

  // Animated glowing tip dot that follows wave curvature
  const animatedDotStyle = useAnimatedStyle(() => {
    const currentVal =
      startPercent.value +
      (targetPercent.value - startPercent.value) * progress.value;
    const tipX =
      trackWidthShared.value > 0
        ? (trackWidthShared.value * currentVal) / 100
        : 0;
    const tipY = getWaveY(tipX, trackWidthShared.value, height, DEFAULT_COLORED_WAVE);

    const isFinished = progress.value >= 1;
    const opacity =
      currentVal <= 0 || isFinished
        ? 0
        : Math.max(0, 1 - Math.pow(progress.value, 3));

    return {
      opacity,
      transform: [
        { translateX: tipX - 5 },
        { translateY: tipY - 5 },
      ],
    };
  });

  // Animated pill style for slide & fade in
  const animatedPillStyle = useAnimatedStyle(() => {
    return {
      opacity: pillOpacity.value,
      transform: [{ translateY: pillTranslateY.value }],
    };
  });

  // Delta indicator formatting
  const hasDelta = showDelta !== undefined ? showDelta : (weeklyDelta !== null && weeklyDelta !== undefined);
  const deltaValue = weeklyDelta ?? 0;
  const isPositiveDelta = deltaValue > 0;
  const isNegativeDelta = deltaValue < 0;
  const deltaArrow = arrowStyle === 'arrow'
    ? (isPositiveDelta ? '↑' : isNegativeDelta ? '↓' : '')
    : (isPositiveDelta ? '▲' : isNegativeDelta ? '▼' : '');
  const deltaPrefix = isPositiveDelta ? ' +' : isNegativeDelta ? ' ' : '';
  const deltaColor = isNegativeDelta
    ? colors.semantic.error
    : isPositiveDelta
      ? colors.semantic.success
      : colors.text.secondary;

  return (
    <View testID={testID} style={[styles.container, style]}>
      {/* Optional Header Row if status or custom label is specified */}
      {status ? (
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>{label}</Text>
          <Text style={[styles.statusWord, { color }]}>{status.toUpperCase()}</Text>
        </View>
      ) : null}

      {/* Percentage Count-up and Delta Pill Row */}
      {showMetrics ? <View style={styles.metricsRow}>
        <AnimatedTextInput
          ref={inputRef}
          underlineColorAndroid="transparent"
          editable={false}
          animatedProps={animatedTextProps}
          defaultValue={`${effectiveReduceMotion ? clampedPercent : 0}%`}
          style={styles.percentageText}
          accessibilityLabel={`Consistency ${clampedPercent}%`}
        />

        {hasDelta ? (
          <Animated.View style={[styles.pillContainer, animatedPillStyle]}>
            <Text style={[styles.deltaText, { color: deltaColor }]}>
              {deltaArrow ? `${deltaArrow}` : ''}
              {deltaPrefix}
              {deltaValue}% this week
            </Text>
          </Animated.View>
        ) : null}
      </View> : null}

      {/* Wavy Thread SVG Track */}
      <View
        testID={`${testID}-track`}
        style={[styles.trackContainer, { height }]}
        onLayout={handleLayout}
      >
        {trackWidth > 0 ? (
          <>
            {/* 1. Loose unwoven gray strands past the percentage point; hidden when 100% */}
            {clampedPercent < 100 ? (
              <Animated.View
                collapsable={false}
                style={[styles.grayTrackWrap, { height }, animatedGrayStyle]}
              >
                <View style={{ position: 'absolute', right: 0, top: 0, width: trackWidth, height }}>
                  <Svg
                    width={trackWidth}
                    height={height}
                    viewBox={`0 0 ${trackWidth} ${height}`}
                    style={styles.svg}
                  >
                    <G opacity={inactiveOpacity}>
                      <Path
                        d={grayPath1}
                        stroke={inactiveColor}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        fill="none"
                      />
                      <Path
                        d={grayPath2}
                        stroke={inactiveColor}
                        strokeWidth={1.3}
                        strokeLinecap="round"
                        fill="none"
                      />
                      <Path
                        d={grayPath3}
                        stroke={inactiveColor}
                        strokeWidth={1.3}
                        strokeLinecap="round"
                        fill="none"
                      />
                      <Path
                        d={grayPath4}
                        stroke={inactiveColor}
                        strokeWidth={1.0}
                        strokeLinecap="round"
                        fill="none"
                      />
                      <Path
                        d={grayPath5}
                        stroke={inactiveColor}
                        strokeWidth={0.8}
                        strokeLinecap="round"
                        fill="none"
                      />
                    </G>
                  </Svg>
                </View>
              </Animated.View>
            ) : null}

            {/* 2. Active interwoven colored thread strands revealed via animated stroke and clipping */}
            {(
              <Animated.View
                collapsable={false}
                style={[styles.coloredTrackWrap, { height }, animatedClipStyle]}
              >
                <Svg
                  width={trackWidth}
                  height={height}
                  viewBox={`0 0 ${trackWidth} ${height}`}
                  style={styles.svg}
                >
                  {/* Strand 1: Core primary thread strand */}
                  <AnimatedPath
                    d={coloredPath1}
                    stroke={color}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={[path1Length, path1Length]}
                    animatedProps={strand1Props}
                  />

                  {/* Strand 2: Intertwined secondary thread strand */}
                  <AnimatedPath
                    d={coloredPath2}
                    stroke={color}
                    strokeWidth={2.0}
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.88}
                    strokeDasharray={[path2Length, path2Length]}
                    animatedProps={strand2Props}
                  />

                  {/* Strand 3: Third intertwined fiber strand */}
                  <AnimatedPath
                    d={coloredPath3}
                    stroke={color}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.78}
                    strokeDasharray={[path3Length, path3Length]}
                    animatedProps={strand3Props}
                  />

                  {/* Strand 4: Fourth fine accent fiber for rich spun texture */}
                  <AnimatedPath
                    d={coloredPath4}
                    stroke={color}
                    strokeWidth={1.2}
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.65}
                    strokeDasharray={[path4Length, path4Length]}
                    animatedProps={strand4Props}
                  />
                </Svg>
              </Animated.View>
            )}

            {/* 3. Polish: glowing leading tip dot following wave curvature */}
            {clampedPercent > 0 && !effectiveReduceMotion ? (
              <Animated.View style={[styles.dotWrapper, animatedDotStyle]} pointerEvents="none">
                <View style={[styles.glowHalo, { backgroundColor: color }]} />
                <View style={styles.glowDot} />
              </Animated.View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eyebrow: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.text.primary,
  },
  statusWord: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
    marginBottom: 4,
  },
  percentageText: {
    fontFamily: SERIF_FONT,
    fontSize: 50,
    lineHeight: 57,
    color: colors.text.primary,
    includeFontPadding: false,
    padding: 0,
    margin: 0,
    minWidth: 105,
  },
  pillContainer: {
    marginLeft: 14,
    alignSelf: 'center',
  },
  deltaText: {
    fontFamily: typography.bodySemiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  trackContainer: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  coloredTrackWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  grayTrackWrap: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  svg: {
    overflow: 'visible',
  },
  dotWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowHalo: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.4,
  },
  glowDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface,
  },
});
