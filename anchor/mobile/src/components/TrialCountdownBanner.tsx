/**
 * TrialCountdownBanner
 *
 * In-app "Day X of 7" surface for the no-card free trial. Renders only while a
 * trial is active, giving it gentle urgency and a one-tap path to the paywall
 * (no-card trials convert lower than card trials, so visible countdown + an
 * upgrade affordance is the main lever for trial → paid).
 *
 * Self-contained: reads trial state from useTrialStatus and fires the funnel
 * analytics (viewed / tapped) with day context. Parent supplies the upgrade
 * handler so navigation stays where the route params already live.
 */

import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';
import { colors, typography } from '@/theme';
import { withAlpha } from '@/utils/color';

const TRIAL_LENGTH_DAYS = 7;

interface TrialCountdownBannerProps {
  /** Where this banner is rendered, for funnel attribution (e.g. 'practice_home'). */
  surface: string;
  /** Invoked on tap — parent navigates to the paywall. */
  onPressUpgrade: (context: { daysRemaining: number; trialDay: number }) => void;
}

export const TrialCountdownBanner: React.FC<TrialCountdownBannerProps> = ({
  surface,
  onPressUpgrade,
}) => {
  const { isTrialActive, daysRemaining } = useTrialStatus();

  // Day 1 of 7 on the first day, Day 7 on the last day of access.
  const trialDay = Math.min(
    TRIAL_LENGTH_DAYS,
    Math.max(1, TRIAL_LENGTH_DAYS - daysRemaining + 1)
  );
  const lastDay = daysRemaining <= 1;

  const viewedRef = useRef(false);

  useEffect(() => {
    if (!isTrialActive || viewedRef.current) {
      return;
    }
    viewedRef.current = true;
    AnalyticsService.track(AnalyticsEvents.TRIAL_BANNER_VIEWED, {
      surface,
      trial_days_remaining: daysRemaining,
      trial_day: trialDay,
    });
  }, [isTrialActive, daysRemaining, trialDay, surface]);

  if (!isTrialActive) {
    return null;
  }

  const daysLabel = lastDay
    ? 'Last day of your free trial'
    : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left · no card on file`;

  const handlePress = () => {
    AnalyticsService.track(AnalyticsEvents.TRIAL_BANNER_TAPPED, {
      surface,
      trial_days_remaining: daysRemaining,
      trial_day: trialDay,
    });
    AnalyticsService.track(AnalyticsEvents.UPGRADE_INITIATED, {
      source: 'trial_banner',
      surface,
      trial_days_remaining: daysRemaining,
    });
    onPressUpgrade({ daysRemaining, trialDay });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Free trial, day ${trialDay} of ${TRIAL_LENGTH_DAYS}. See plans.`}
      onPress={handlePress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.dayPill}>
        <Text style={styles.dayPillText}>DAY {trialDay}/{TRIAL_LENGTH_DAYS}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Free trial</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {daysLabel}
        </Text>
      </View>
      <Text style={styles.cta}>See plans →</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.32),
    backgroundColor: withAlpha(colors.gold, 0.08),
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  pressed: {
    opacity: 0.8,
  },
  dayPill: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.5),
    backgroundColor: withAlpha(colors.gold, 0.12),
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  dayPillText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.gold,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    letterSpacing: 1.4,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: withAlpha(colors.bone, 0.6),
    marginTop: 2,
  },
  cta: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.gold,
  },
});

export default TrialCountdownBanner;
