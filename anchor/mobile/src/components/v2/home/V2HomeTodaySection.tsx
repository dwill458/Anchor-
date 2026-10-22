import React, { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import Svg, { Path, Polygon } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import type { V2HomeTodayState } from '@/adapters/v2/home';
import { V2_PRACTICE_MODE_BY_ID, V2_RECOMMENDATION_WHY, v2PracticeModeTitle } from '@/constants/v2/practice';
import { V2DissolvedArtwork } from '@/components/v2/primitives';
import { VisualProfiler } from '@/utils/visualProfiler';
import { colors, typography } from '@/theme/v2';
import { getPracticeCardTheme, practiceColors } from '@/theme/v2/practiceColors';
import { resolvePracticeArtwork } from '@/components/v2/practice';

type Props = {
  today: V2HomeTodayState;
  /**
   * The image Today borrows to illustrate a Visualize recommendation. Used
   * ONLY when the recommended mode is Visualize — it never changes which
   * practice is recommended, and every other mode keeps its own illustrated
   * artwork. Ideally a second Vision photograph distinct from the one shown
   * in the Vision section below; when the Vision has only one image, Home
   * passes that same uri and sets `visionCoverIsReused` so this section can
   * give it a visibly different crop instead of repeating the identical frame.
   */
  visionCoverUri?: string;
  visionCoverIsReused?: boolean;
  onBegin?: () => void;
  onOpenAllPractices?: () => void;
  onRetry?: () => void;
  contentStyle?: StyleProp<ViewStyle> | AnimatedStyle<ViewStyle>;
  testID?: string;
};

/**
 * Height of the resolved Today body (headline + Begin + reason), less the
 * skeleton group's own 14px offset. Scales with the slightly larger headline
 * below (~11% taller than a first pass at this, 110 -> 122) to keep the
 * skeleton's reserved height matching the resolved layout.
 */
const TODAY_BODY_HEIGHT = 122;

/**
 * The practice illustrations share one composition — a glowing focal element
 * on the centre line, a little above middle — so one focus serves all four.
 */
const TODAY_ART_FOCUS = { x: 0.5, y: 0.4 };

/**
 * Focus used only when Today reuses the Vision section's own single cover
 * photograph (no second image exists to alternate with) — biased away from
 * centre so the crop reads as a distinct composition rather than the same
 * frame twice.
 */
const TODAY_ART_FOCUS_REUSED_VISION = { x: 0.64, y: 0.32 };

/**
 * How far the artwork dissolves from each edge. The left dissolve is the
 * deepest because the artwork sits behind the Today copy there; the right one
 * is shallow because most of it runs past the screen edge (see `practiceArt`).
 */
const TODAY_ART_FADE = { left: 0.46, right: 0.2, top: 0.26, bottom: 0.36 };

/** The graphite zone's page inset, which the artwork bleeds through. */
const PAGE_INSET = 20;

/** How far the artwork rises above the ribbon into the graphite zone's top padding. */
export const TODAY_ART_BLEED_TOP = 10;

function ArrowRight({ color }: { color: string }) {
  return (
    <Svg width={17} height={11} viewBox="0 0 17 11" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M0.8 5.5H15.4M10.9 1L15.4 5.5L10.9 10" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function durationLabel(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '';
  return seconds < 60 ? `${seconds} sec` : `${Math.round(seconds / 60)} min`;
}

function translucentColor(hexColor: string, opacity: number): string {
  const hex = hexColor.replace('#', '');
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

/**
 * `reason` remains in the signature for compatibility, but Home copy is one
 * stable line per practice mode rather than server-reason variants.
 */
export function todayReasonCopy(reason: string, mode: keyof typeof V2_RECOMMENDATION_WHY): string {
  // DEFERRED: Server reason variants are retired in favor of one stable line per mode.
  // const key = reason?.trim();
  // return (key && V2_RECOMMENDATION_REASON_COPY[key]) || V2_RECOMMENDATION_WHY[mode];
  void reason;
  return {
    visualize: 'Step into your Vision.',
    focus: 'Hold your anchor in focus.',
    deep_prime: 'Go deeper with your anchor.',
    release: "Let go when you're ready.",
  }[mode];
}

/**
 * Today is the retention heartbeat, so it leads the graphite zone and nothing
 * below it is allowed to compete. Every value here comes from the server
 * recommendation for the ACTIVE Anchor; nothing is hardcoded.
 */
type ReadyToday = Extract<V2HomeTodayState, { state: 'ready' }>;

function V2HomeTodaySectionComponent({ today, visionCoverUri, visionCoverIsReused, onBegin, onOpenAllPractices, onRetry, contentStyle, testID }: Props) {
  const lastReadyRef = useRef<ReadyToday | null>(today.state === 'ready' ? today : null);
  if (today.state === 'ready') {
    lastReadyRef.current = today;
  }

  useEffect(() => {
    if (today.state === 'ready') {
      VisualProfiler.record('todayContentChange', { mode: today.mode, reason: today.reason });
    }
  }, [today]);

  const allPractices = onOpenAllPractices ? (
    <Pressable
      testID="v2-home-all-practices"
      accessibilityRole="button"
      accessibilityLabel="All Practices"
      onPress={onOpenAllPractices}
      style={({ pressed }) => [styles.allPractices, pressed && styles.pressed]}
    >
      <Text style={styles.allPracticesText}>All Practices</Text>
      <ArrowRight color={colors.graphite.text.tertiary} />
    </Pressable>
  ) : null;

  // Resolving on cold start or explicitly none: render skeleton on cold start only
  if ((today.state === 'none' || today.state === 'loading') && !lastReadyRef.current) {
    return (
      <View testID={testID} style={styles.container}>
        <Text style={styles.kicker}>TODAY</Text>
        {today.state === 'loading' ? (
          <View testID="v2-home-today-loading" style={styles.skeletonGroup}>
            <View style={[styles.skeletonLine, styles.skeletonTitle]} />
            <View style={[styles.skeletonLine, styles.skeletonCopy]} />
          </View>
        ) : null}
        {allPractices}
      </View>
    );
  }

  if (today.state === 'error' && !lastReadyRef.current) {
    return (
      <View testID={testID} style={styles.container}>
        <Text style={styles.kicker}>TODAY</Text>
        <Text testID="v2-home-today-error" style={styles.errorCopy}>
          Today’s practice could not be loaded.
        </Text>
        {onRetry ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Retry Today" onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        ) : null}
        {allPractices}
      </View>
    );
  }

  const activeToday = today.state === 'ready' ? today : lastReadyRef.current;
  if (!activeToday) return null;

  const doneToday = activeToday.doneToday;
  const nextMode = doneToday?.nextMode;
  const displayMode = nextMode ?? activeToday.mode;
  const duration = durationLabel(doneToday ? doneToday.durationSeconds : activeToday.durationSeconds);
  const practiceTheme = getPracticeCardTheme(displayMode);
  const accent = practiceTheme.accent;
  const completedAccent = doneToday ? getPracticeCardTheme(doneToday.completedMode).accent : accent;
  const completedTint = doneToday ? translucentColor(completedAccent, 0.18) : accent;
  const completedDuration = durationLabel(doneToday?.completedDurationSeconds);
  const completedVerb = doneToday?.completedMode === 'visualize'
    ? 'Seen'
    : doneToday?.completedMode === 'release'
      ? 'Released'
      : 'Held';
  // Visualize is the one recommendation that borrows the Anchor's own future
  // rather than illustrated Practice art — but only when a real cover exists.
  const usesVisionArt = displayMode === 'visualize' && Boolean(visionCoverUri);
  const artSource = usesVisionArt ? { uri: visionCoverUri } : resolvePracticeArtwork(displayMode);
  const artFocus = usesVisionArt && visionCoverIsReused ? TODAY_ART_FOCUS_REUSED_VISION : TODAY_ART_FOCUS;
  const onArtPress = doneToday?.nextMode ? onBegin : doneToday ? onOpenAllPractices : onBegin;
  const artAccessibilityLabel = doneToday?.nextMode
    ? `Next · ${v2PracticeModeTitle(doneToday.nextMode)} · ${duration || 'When ready'}`
    : doneToday
      ? 'All Practices'
      : activeToday.mode === 'release'
        ? 'Open Release'
        : `Begin ${V2_PRACTICE_MODE_BY_ID[activeToday.mode].title} practice`;

  return (
    <View testID={testID} style={styles.container}>
      <Pressable
        testID="v2-home-today-artwork-launch"
        accessibilityRole="button"
        accessibilityLabel={artAccessibilityLabel}
        onPress={onArtPress}
        disabled={!onArtPress}
        style={({ pressed }) => [styles.practiceArt, pressed && styles.artPressed]}
      >
        <V2DissolvedArtwork
          testID={usesVisionArt ? 'v2-home-today-artwork-vision' : 'v2-home-today-artwork'}
          source={artSource}
          surface={colors.graphite.base}
          focus={artFocus}
          clearRadius={0.34}
          radius={0.66}
          fade={TODAY_ART_FADE}
          style={styles.practiceArtImage}
        />
      </Pressable>
      <Animated.View pointerEvents="box-none" style={contentStyle}>
      <View style={styles.kickerRow}>
        {/* // DEFERRED: The old outlined completion tag is retained after replacing it with the filled pennant.
        <View style={[styles.ribbon, styles.doneRibbon]}>
          <Text style={[styles.ribbonText, styles.doneRibbonText]}>DONE TODAY</Text>
        </View>
        */}
        <View style={[styles.ribbon, { backgroundColor: doneToday ? completedTint : accent }, doneToday && styles.doneRibbonRow]}>
          {doneToday ? (
            <View style={styles.doneRibbonContents}>
              <Check size={11} color={practiceColors.deepPrime} strokeWidth={2.8} />
              <Text style={[styles.ribbonText, { color: completedAccent }]}>DONE TODAY</Text>
            </View>
          ) : (
            <Text style={[styles.ribbonText, { color: practiceTheme.ctaText }]}>TODAY</Text>
          )}
          <Svg width={9} height={22} style={styles.ribbonTip}>
            <Polygon points="0,0 9,11 0,22" fill={doneToday ? completedTint : accent} />
          </Svg>
        </View>
        {!doneToday && activeToday.completionSignal ? <Text style={styles.returned}>Returned today</Text> : null}
      </View>

      {/* // DEFERRED: The former completion headline showed the next mode instead of the mode just completed.
      {doneToday?.nextMode ? (
        <Text testID="v2-home-today-headline" style={styles.headline}>{v2PracticeModeTitle(doneToday.nextMode)}</Text>
      ) : !doneToday ? (
        <Text testID="v2-home-today-headline" style={styles.headline}>{V2_PRACTICE_MODE_BY_ID[activeToday.mode].title}</Text>
      ) : null}
      */}
      {doneToday ? (
        <Text testID="v2-home-today-headline" style={[styles.headline, styles.doneHeadline]}>
          {v2PracticeModeTitle(doneToday.completedMode)}
        </Text>
      ) : (
        <Text testID="v2-home-today-headline" style={styles.headline}>{V2_PRACTICE_MODE_BY_ID[activeToday.mode].title}</Text>
      )}

      {doneToday ? (
        <>
          {/* // DEFERRED: The outlined completion button is replaced by one settled text link. */}
          {/*
          <Pressable
            testID="v2-home-today-begin"
            accessibilityRole="button"
            accessibilityLabel="All Practices"
            onPress={onOpenAllPractices}
            disabled={!onOpenAllPractices}
            style={({ pressed }) => [styles.begin, styles.doneBegin, pressed && styles.pressed]}
          >
            <Text style={[styles.beginText, styles.doneBeginText]}>All Practices</Text>
            <ArrowRight color={colors.graphite.text.secondary} />
          </Pressable>
          */}
          <Pressable
            testID="v2-home-today-begin"
            accessibilityRole="button"
            accessibilityLabel={doneToday.nextMode
              ? `Next · ${v2PracticeModeTitle(doneToday.nextMode)} · ${duration || 'When ready'}`
              : 'All Practices'}
            onPress={doneToday.nextMode ? onBegin : onOpenAllPractices}
            disabled={doneToday.nextMode ? !onBegin : !onOpenAllPractices}
            style={({ pressed }) => [styles.begin, pressed && styles.pressed]}
          >
            <Text style={[styles.beginText, styles.doneCtaText]}>
              {doneToday.nextMode
                ? `Next · ${v2PracticeModeTitle(doneToday.nextMode)} · ${duration || 'When ready'}`
                : 'All Practices'}
            </Text>
            <ArrowRight color="rgba(244, 246, 250, 0.8)" />
          </Pressable>
        </>
      ) : (
        <Pressable
          testID="v2-home-today-begin"
          accessibilityRole="button"
          accessibilityLabel={activeToday.mode === 'release' ? 'Open Release' : `Begin ${V2_PRACTICE_MODE_BY_ID[activeToday.mode].title} practice`}
          onPress={onBegin}
          disabled={!onBegin}
          style={({ pressed }) => [styles.begin, pressed && styles.pressed]}
        >
          <Text style={styles.beginText}>{activeToday.mode === 'release' ? 'Open Release' : duration ? `Begin · ${duration}` : 'Begin'}</Text>
          <ArrowRight color={colors.graphite.text.primary} />
        </Pressable>
      )}

      {/* // DEFERRED: The old completion line omitted which session duration was held or seen.
      <Text testID="v2-home-today-reason" style={styles.reason}>
        {doneToday ? doneToday.completedMode === 'visualize' ? 'Seen today.' : 'Held today.' : todayReasonCopy(activeToday.reason, activeToday.mode)}
      </Text>
      */}
      <Text testID="v2-home-today-reason" style={styles.reason}>
        {doneToday
          ? `${completedVerb} today${completedDuration ? ` · ${completedDuration}` : ''}`
          : todayReasonCopy(activeToday.reason, activeToday.mode)}
      </Text>

      {!doneToday ? allPractices : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 0,
    // ~13% taller than a first pass at this (140 -> 158): Vision's photography
    // now reads richer than Today, so Today gets a little more room to match.
    minHeight: 158,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: typography.bodyBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.graphite.text.tertiary,
  },
  ribbon: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4 },
  // DEFERRED: The outlined done tag is retained here as history after switching to a mode-tinted pennant.
  // doneRibbon: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.graphite.hairlineStrong },
  // DEFERRED: The outlined tag text color is retained after switching to full mode color.
  // doneRibbonText: { color: colors.graphite.text.secondary },
  doneRibbonRow: { flexDirection: 'row', alignItems: 'center' },
  doneRibbonContents: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ribbonTip: { position: 'absolute', right: -9, top: 0 },
  ribbonText: { fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 2.2, color: colors.graphite.text.primary },
  returned: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.graphite.text.secondary,
  },
  headline: {
    fontFamily: 'BricolageGrotesque-SemiBold',
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.45,
    color: colors.graphite.text.primary,
    marginTop: 8,
    maxWidth: '52%',
  },
  reason: {
    fontFamily: 'Figtree-Regular',
    fontSize: 14,
    lineHeight: 19,
    color: colors.graphite.text.secondary,
    marginTop: 5,
    maxWidth: '52%',
  },
  begin: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 3,
    paddingVertical: 4,
  },
  // DEFERRED: The outlined done button styling is retained after switching to an unboxed text link.
  // doneBegin: { borderWidth: 1, borderColor: colors.graphite.hairlineStrong, borderRadius: 3, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6 },
  // DEFERRED: The smaller, subdued button typography is retained after matching the active link scale.
  // doneBeginText: { fontSize: 14, color: colors.graphite.text.secondary },
  doneHeadline: { opacity: 0.7 },
  doneCtaText: { opacity: 0.8 },
  /**
   * Bleeds through the page inset and a little past the screen edge, so the
   * frame's right side is never visible and the focal point lands at ~3/4 of
   * the screen width, where the reference puts it. Proportional horizontally;
   * the height keeps the art's own 16:9-ish ratio at typical phone widths.
   */
  practiceArt: {
    position: 'absolute',
    left: '46%',
    right: -(PAGE_INSET + 24),
    top: -TODAY_ART_BLEED_TOP,
    // Ratio, not a fixed height: at 320pt the frame is narrower, and a fixed
    // 170 would crop the art differently on every width. Slightly taller than
    // a first pass at this (1.5 -> 1.32, ~14% more height at the same width)
    // so the illustration keeps pace with Today's larger headline.
    aspectRatio: 1.32,
  },
  practiceArtImage: {
    width: '100%',
    height: '100%',
  },
  artPressed: {
    opacity: 0.94,
  },
  beginText: {
    fontFamily: 'Figtree-Regular',
    fontSize: 17,
    color: colors.graphite.text.primary,
  },
  allPractices: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingVertical: 4,
  },
  allPracticesText: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    color: colors.graphite.text.secondary,
  },
  errorCopy: {
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.graphite.text.secondary,
    marginTop: 12,
  },
  retry: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  retryText: {
    fontFamily: typography.bodySemiBold,
    fontSize: 13.5,
    color: colors.graphite.text.primary,
    textDecorationLine: 'underline',
  },
  skeletonGroup: {
    marginTop: 14,
    gap: 10,
    /**
     * Reserves the height of the resolved recommendation (headline + reason +
     * Begin). Switching the Home Anchor re-resolves Today, and without this the
     * graphite zone collapsed by ~70px and sprang back again — two full layout
     * passes landing on the frames where the Anchor carousel is settling.
     */
    minHeight: TODAY_BODY_HEIGHT,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.graphite.hairlineStrong,
  },
  skeletonTitle: {
    width: '52%',
    height: 20,
  },
  skeletonCopy: {
    width: '72%',
  },
  pressed: {
    opacity: 0.68,
  },
});

/**
 * Memoised. Switching the Home Anchor re-renders this screen twice - once on
 * selection and again when Today's recommendation settles - and most of these
 * sections do not depend on Today at all. With stable props from V2HomeScreen
 * they now render only when their own data actually changes.
 */
export const V2HomeTodaySection = memo(V2HomeTodaySectionComponent);
