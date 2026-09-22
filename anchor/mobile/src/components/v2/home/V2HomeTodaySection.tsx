import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import type { V2HomeTodayState } from '@/adapters/v2/home';
import { V2_PRACTICE_MODE_BY_ID, V2_RECOMMENDATION_WHY } from '@/constants/v2/practice';
import { V2_RECOMMENDATION_REASON_COPY } from '@/constants/v2/home';
import { V2DissolvedArtwork } from '@/components/v2/primitives';
import { colors, typography } from '@/theme/v2';
import { getPracticeCardTheme } from '@/theme/v2/practiceColors';

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
  testID?: string;
};

/**
 * Height of the resolved Today body (headline + Begin + reason), less the
 * skeleton group's own 14px offset. Scales with the slightly larger headline
 * below (~11% taller than a first pass at this, 110 -> 122) to keep the
 * skeleton's reserved height matching the resolved layout.
 */
const TODAY_BODY_HEIGHT = 122;

const TODAY_ART: Record<string, ImageSourcePropType> = {
  focus: require('@/assets/practice/today/focus.jpg'),
  deep_prime: require('@/assets/practice/today/deep-prime.jpg'),
  visualize: require('@/assets/practice/today/visualize.jpg'),
  release: require('@/assets/practice/today/release.jpg'),
};

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

/**
 * The server's `reason` is a machine code and must never reach the screen.
 * An unmapped code falls back to mode copy rather than rendering the raw value.
 */
export function todayReasonCopy(reason: string, mode: keyof typeof V2_RECOMMENDATION_WHY): string {
  const key = reason?.trim();
  return (key && V2_RECOMMENDATION_REASON_COPY[key]) || V2_RECOMMENDATION_WHY[mode];
}

/**
 * Today is the retention heartbeat, so it leads the graphite zone and nothing
 * below it is allowed to compete. Every value here comes from the server
 * recommendation for the ACTIVE Anchor; nothing is hardcoded.
 */
function V2HomeTodaySectionComponent({ today, visionCoverUri, visionCoverIsReused, onBegin, onOpenAllPractices, onRetry, testID }: Props) {
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

  // Resolving: render the section's frame only, never a fabricated recommendation.
  if (today.state === 'none' || today.state === 'loading') {
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

  if (today.state === 'error') {
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

  const definition = V2_PRACTICE_MODE_BY_ID[today.mode];
  const duration = durationLabel(today.durationSeconds);
  const accent = getPracticeCardTheme(today.mode).heroBadgeBg;
  // Visualize is the one recommendation that borrows the Anchor's own future
  // rather than illustrated Practice art — but only when a real cover exists.
  const usesVisionArt = today.mode === 'visualize' && Boolean(visionCoverUri);
  const artSource = usesVisionArt ? { uri: visionCoverUri } : TODAY_ART[today.mode];
  const artFocus = usesVisionArt && visionCoverIsReused ? TODAY_ART_FOCUS_REUSED_VISION : TODAY_ART_FOCUS;

  return (
    <View testID={testID} style={styles.container}>
      <V2DissolvedArtwork
        testID={usesVisionArt ? 'v2-home-today-artwork-vision' : 'v2-home-today-artwork'}
        source={artSource}
        surface={colors.graphite.base}
        focus={artFocus}
        clearRadius={0.34}
        radius={0.66}
        fade={TODAY_ART_FADE}
        style={styles.practiceArt}
      />
      <View style={styles.kickerRow}>
        <View style={[styles.ribbon, { backgroundColor: accent }]}>
          <Text style={styles.ribbonText}>TODAY</Text>
          <Svg width={9} height={22} style={styles.ribbonTip}><Polygon points="0,0 9,11 0,22" fill={accent} /></Svg>
        </View>
        {today.completionSignal ? <Text style={styles.returned}>Returned today</Text> : null}
      </View>

      <Text testID="v2-home-today-headline" style={styles.headline}>
        {definition.title}
      </Text>

      <Pressable
        testID="v2-home-today-begin"
        accessibilityRole="button"
        accessibilityLabel={today.mode === 'release' ? 'Open Release' : `Begin ${definition.title} practice`}
        onPress={onBegin}
        disabled={!onBegin}
        style={({ pressed }) => [styles.begin, pressed && styles.pressed]}
      >
        <Text style={styles.beginText}>{today.mode === 'release' ? 'Open Release' : duration ? `Begin · ${duration}` : 'Begin'}</Text>
        <ArrowRight color={colors.graphite.text.primary} />
      </Pressable>

      <Text testID="v2-home-today-reason" style={styles.reason}>
        {todayReasonCopy(today.reason, today.mode)}
      </Text>

      {allPractices}
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
  ribbonTip: { position: 'absolute', right: -9, top: 0 },
  ribbonText: { fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 2.2, color: colors.graphite.text.primary },
  returned: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.graphite.text.secondary,
  },
  headline: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 31,
    lineHeight: 33,
    letterSpacing: -0.7,
    color: colors.graphite.text.primary,
    marginTop: 8,
    maxWidth: '52%',
  },
  reason: {
    fontFamily: typography.body,
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
  beginText: {
    fontFamily: 'EBGaramond-Regular',
    fontSize: 18,
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
