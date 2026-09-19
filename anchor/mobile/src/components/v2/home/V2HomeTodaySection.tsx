import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { V2HomeTodayState } from '@/adapters/v2/home';
import { V2_PRACTICE_MODE_BY_ID, V2_RECOMMENDATION_WHY } from '@/constants/v2/practice';
import { V2_RECOMMENDATION_REASON_COPY } from '@/constants/v2/home';
import { colors, typography } from '@/theme/v2';

type Props = {
  today: V2HomeTodayState;
  onBegin?: () => void;
  onOpenAllPractices?: () => void;
  onRetry?: () => void;
  testID?: string;
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
export function V2HomeTodaySection({ today, onBegin, onOpenAllPractices, onRetry, testID }: Props) {
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
  const headline = duration ? `${definition.title} · ${duration}` : definition.title;

  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>TODAY</Text>
        {today.completionSignal ? <Text style={styles.returned}>Returned today</Text> : null}
      </View>

      <Text testID="v2-home-today-headline" style={styles.headline}>
        {headline}
      </Text>
      <Text testID="v2-home-today-reason" style={styles.reason}>
        {todayReasonCopy(today.reason, today.mode)}
      </Text>

      <Pressable
        testID="v2-home-today-begin"
        accessibilityRole="button"
        accessibilityLabel={today.mode === 'release' ? 'Open Release' : `Begin ${definition.title} practice`}
        onPress={onBegin}
        disabled={!onBegin}
        style={({ pressed }) => [styles.begin, pressed && styles.pressed]}
      >
        <Text style={styles.beginText}>{today.mode === 'release' ? 'Open Release' : 'Begin'}</Text>
        <ArrowRight color={colors.graphite.text.primary} />
      </Pressable>

      {allPractices}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
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
  returned: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.graphite.text.secondary,
  },
  headline: {
    fontFamily: typography.displayBold,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: colors.graphite.text.primary,
    marginTop: 12,
  },
  reason: {
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.graphite.text.secondary,
    marginTop: 6,
    maxWidth: 300,
  },
  begin: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.graphite.hairlineStrong,
  },
  beginText: {
    fontFamily: typography.bodySemiBold,
    fontSize: 15,
    color: colors.graphite.text.primary,
  },
  allPractices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.graphite.hairline,
  },
  allPracticesText: {
    fontFamily: typography.bodyMedium,
    fontSize: 13.5,
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
