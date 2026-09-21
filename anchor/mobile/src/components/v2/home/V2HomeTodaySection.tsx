import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Polygon } from 'react-native-svg';
import type { V2HomeTodayState } from '@/adapters/v2/home';
import { V2_PRACTICE_MODE_BY_ID, V2_RECOMMENDATION_WHY } from '@/constants/v2/practice';
import { V2_RECOMMENDATION_REASON_COPY } from '@/constants/v2/home';
import { colors, typography } from '@/theme/v2';
import { getPracticeCardTheme } from '@/theme/v2/practiceColors';

type Props = {
  today: V2HomeTodayState;
  onBegin?: () => void;
  onOpenAllPractices?: () => void;
  onRetry?: () => void;
  testID?: string;
};

/**
 * Height of the resolved Today body, measured from the styles below:
 * headline (12 + 32) + reason (6 + 20) + Begin (20 + 42), less the skeleton
 * group's own 14px offset.
 */
const TODAY_BODY_HEIGHT = 118;

const TODAY_ART: Record<string, ImageSourcePropType> = {
  focus: require('@/assets/practice/today/focus.png'),
  deep_prime: require('@/assets/practice/today/deep-prime.png'),
  visualize: require('@/assets/practice/today/visualize.png'),
  release: require('@/assets/practice/today/release.png'),
};

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
function V2HomeTodaySectionComponent({ today, onBegin, onOpenAllPractices, onRetry, testID }: Props) {
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

  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.practiceArt} pointerEvents="none">
        <Image
          testID="v2-home-today-artwork"
          source={TODAY_ART[today.mode]}
          style={styles.practiceImage}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <LinearGradient colors={[colors.graphite.base, 'rgba(11,13,17,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.artLeftFade} />
        <LinearGradient colors={['rgba(11,13,17,0)', colors.graphite.base]} style={styles.artBottomFade} />
        <LinearGradient colors={[colors.graphite.base, 'rgba(11,13,17,0)']} style={styles.artTopFade} />
      </View>
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
    minHeight: 155,
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
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: colors.graphite.text.primary,
    marginTop: 7,
    maxWidth: '52%',
  },
  reason: {
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.graphite.text.secondary,
    marginTop: 6,
    maxWidth: '52%',
  },
  begin: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
    paddingVertical: 4,
  },
  practiceArt: {
    position: 'absolute',
    right: 0,
    top: 2,
    width: '58%',
    height: 136,
    overflow: 'hidden',
  },
  practiceImage: { width: '100%', height: '100%' },
  artLeftFade: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '36%' },
  artBottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44 },
  artTopFade: { position: 'absolute', left: 0, right: 0, top: 0, height: 20 },
  beginText: {
    fontFamily: 'EBGaramond-Regular',
    fontSize: 18,
    color: colors.graphite.text.primary,
  },
  allPractices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.graphite.hairline,
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
