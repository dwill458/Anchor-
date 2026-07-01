import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GlassCard } from '@/components/common';
import { colors, spacing, typography } from '@/theme';
import { useNotificationController } from '@/hooks/useNotificationController';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';

export type ReminderPromptVariant = 'first_anchor' | 'fallback';

interface DailyReminderPromptProps {
  visible: boolean;
  variant: ReminderPromptVariant;
  /**
   * Called when the prompt is fully resolved (scheduled, denied, or skipped).
   * The user is never blocked — every path leads here.
   */
  onDismiss: () => void;
}

type Step = 'intro' | 'time' | 'custom' | 'success';

interface ReminderTimeOption {
  label: string;
  time: string;
  hint: string;
}

const TIME_OPTIONS: ReminderTimeOption[] = [
  { label: 'Morning', time: '08:00', hint: '8:00 AM' },
  { label: 'Afternoon', time: '15:00', hint: '3:00 PM' },
  { label: 'Evening', time: '20:00', hint: '8:00 PM' },
];

const FALLBACK_DEFAULT_TIME = '08:00';

const COPY: Record<ReminderPromptVariant, {
  title: string;
  body: string;
  primary: string;
  secondary: string;
}> = {
  first_anchor: {
    title: 'Keep This Anchor Alive',
    body: 'Anchors work best when they’re returned to with intention. Choose a time, and Anchor will give you one quiet nudge to prime it.',
    primary: 'Set Daily Reminder',
    secondary: 'Not Now',
  },
  fallback: {
    title: 'Make This a Rhythm',
    body: 'You just primed your Anchor. Want a gentle reminder tomorrow so this becomes part of your day?',
    primary: 'Remind Me Tomorrow',
    secondary: 'Maybe Later',
  },
};

const SUCCESS_COPY =
  'Daily reminder set. Anchor will give you one quiet nudge when it’s time to prime.';

const formatHourLabel = (hour: number): string => {
  const period = hour < 12 ? 'AM' : 'PM';
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:00 ${period}`;
};

export const DailyReminderPrompt: React.FC<DailyReminderPromptProps> = ({
  visible,
  variant,
  onDismiss,
}) => {
  const {
    markReminderPromptShown,
    completeReminderPrompt,
    setDailyPrimeReminder,
  } = useNotificationController();

  const [step, setStep] = useState<Step>('intro');
  const [isBusy, setIsBusy] = useState(false);
  const copy = COPY[variant];

  // Announce the prompt once when it becomes visible (also records shown-at).
  useEffect(() => {
    if (visible) {
      setStep('intro');
      setIsBusy(false);
      void markReminderPromptShown(variant);
    }
  }, [visible, variant, markReminderPromptShown]);

  const handleSchedule = useCallback(async (time: string) => {
    if (isBusy) return;
    setIsBusy(true);
    // The native OS permission prompt only fires here — after clear intent.
    const status = await setDailyPrimeReminder(time, variant);
    if (status === 'granted') {
      setStep('success');
      setIsBusy(false);
      return;
    }
    // Denied: state is persisted as denied; do not nag again.
    await completeReminderPrompt(variant);
    setIsBusy(false);
    onDismiss();
  }, [isBusy, setDailyPrimeReminder, variant, completeReminderPrompt, onDismiss]);

  const handlePrimary = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AnalyticsService.track(AnalyticsEvents.NOTIFICATION_SET_DAILY_REMINDER_TAPPED, {
      source: variant,
    });
    if (variant === 'fallback') {
      void handleSchedule(FALLBACK_DEFAULT_TIME);
      return;
    }
    setStep('time');
  }, [variant, handleSchedule]);

  const handleSecondary = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AnalyticsService.track(AnalyticsEvents.NOTIFICATION_NOT_NOW_TAPPED, {
      source: variant,
    });
    void completeReminderPrompt(variant);
    onDismiss();
  }, [variant, completeReminderPrompt, onDismiss]);

  const handleDone = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void completeReminderPrompt(variant);
    onDismiss();
  }, [variant, completeReminderPrompt, onDismiss]);

  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, hour) => hour), []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={step === 'intro' ? handleSecondary : undefined}
    >
      <View style={styles.overlay}>
        <GlassCard style={styles.card} contentStyle={styles.cardContent}>
          <View style={styles.accentLine} />

          {step === 'intro' && (
            <>
              <Text style={styles.eyebrow}>DAILY PRIME REMINDER</Text>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.body}>{copy.body}</Text>

              <TouchableOpacity
                onPress={handlePrimary}
                activeOpacity={0.9}
                disabled={isBusy}
                style={styles.primaryButton}
                accessibilityRole="button"
                accessibilityLabel={copy.primary}
              >
                <LinearGradient
                  colors={[colors.gold, '#B8941F']}
                  style={styles.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isBusy ? (
                    <ActivityIndicator color={colors.charcoal} size="small" />
                  ) : (
                    <Text style={styles.primaryText}>{copy.primary}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSecondary}
                activeOpacity={0.7}
                style={styles.secondaryButton}
                accessibilityRole="button"
                accessibilityLabel={copy.secondary}
              >
                <Text style={styles.secondaryText}>{copy.secondary}</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'time' && (
            <>
              <Text style={styles.eyebrow}>CHOOSE A TIME</Text>
              <Text style={styles.title}>When should we nudge you?</Text>
              <Text style={styles.body}>
                Pick the moment that fits your day. You can change it anytime in Settings.
              </Text>

              <View style={styles.optionsWrap}>
                {TIME_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.time}
                    onPress={() => void handleSchedule(option.time)}
                    activeOpacity={0.85}
                    disabled={isBusy}
                    style={styles.timeOption}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.label}, ${option.hint}`}
                  >
                    <Text style={styles.timeOptionLabel}>{option.label}</Text>
                    <Text style={styles.timeOptionHint}>{option.hint}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => setStep('custom')}
                  activeOpacity={0.85}
                  disabled={isBusy}
                  style={styles.timeOption}
                  accessibilityRole="button"
                  accessibilityLabel="Custom time"
                >
                  <Text style={styles.timeOptionLabel}>Custom</Text>
                  <Text style={styles.timeOptionHint}>Pick an hour</Text>
                </TouchableOpacity>
              </View>

              {isBusy ? (
                <ActivityIndicator color={colors.gold} size="small" style={styles.busySpinner} />
              ) : (
                <TouchableOpacity
                  onPress={handleSecondary}
                  activeOpacity={0.7}
                  style={styles.secondaryButton}
                  accessibilityRole="button"
                  accessibilityLabel={copy.secondary}
                >
                  <Text style={styles.secondaryText}>{copy.secondary}</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {step === 'custom' && (
            <>
              <Text style={styles.eyebrow}>CUSTOM TIME</Text>
              <Text style={styles.title}>Choose your hour</Text>
              <ScrollView
                style={styles.hourList}
                contentContainerStyle={styles.hourListContent}
                showsVerticalScrollIndicator={false}
              >
                {hourOptions.map((hour) => (
                  <TouchableOpacity
                    key={hour}
                    onPress={() => void handleSchedule(`${String(hour).padStart(2, '0')}:00`)}
                    activeOpacity={0.85}
                    disabled={isBusy}
                    style={styles.hourOption}
                    accessibilityRole="button"
                    accessibilityLabel={formatHourLabel(hour)}
                  >
                    <Text style={styles.hourOptionText}>{formatHourLabel(hour)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {isBusy ? (
                <ActivityIndicator color={colors.gold} size="small" style={styles.busySpinner} />
              ) : (
                <TouchableOpacity
                  onPress={() => setStep('time')}
                  activeOpacity={0.7}
                  style={styles.secondaryButton}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                >
                  <Text style={styles.secondaryText}>Back</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {step === 'success' && (
            <>
              <View style={styles.successBadge}>
                <Text style={styles.successCheck}>✓</Text>
              </View>
              <Text style={styles.title}>Reminder set</Text>
              <Text style={styles.body}>{SUCCESS_COPY}</Text>

              <TouchableOpacity
                onPress={handleDone}
                activeOpacity={0.9}
                style={styles.primaryButton}
                accessibilityRole="button"
                accessibilityLabel="Done"
              >
                <LinearGradient
                  colors={[colors.gold, '#B8941F']}
                  style={styles.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.primaryText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </GlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 12, 16, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
  },
  cardContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(212, 175, 55, 0.4)',
  },
  eyebrow: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(212, 175, 55, 0.55)',
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.bone,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 17,
    lineHeight: 25,
    color: 'rgba(245, 245, 220, 0.72)',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  primaryText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 16,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: typography.fonts.body,
    fontSize: 14,
    color: 'rgba(192, 192, 192, 0.7)',
    letterSpacing: 0.5,
  },
  optionsWrap: {
    width: '100%',
    gap: spacing.sm,
  },
  timeOption: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  timeOptionLabel: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 16,
    color: colors.bone,
    letterSpacing: 0.3,
  },
  timeOptionHint: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: 'rgba(212, 175, 55, 0.65)',
    letterSpacing: 0.3,
  },
  hourList: {
    width: '100%',
    maxHeight: 260,
    marginBottom: spacing.sm,
  },
  hourListContent: {
    paddingVertical: spacing.xs,
  },
  hourOption: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.14)',
    backgroundColor: 'rgba(212, 175, 55, 0.03)',
    paddingVertical: 13,
    paddingHorizontal: 18,
    marginBottom: spacing.xs,
    alignItems: 'center',
  },
  hourOptionText: {
    fontFamily: typography.fonts.body,
    fontSize: 15,
    color: colors.bone,
    letterSpacing: 0.5,
  },
  busySpinner: {
    marginTop: spacing.lg,
  },
  successBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.5)',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successCheck: {
    fontSize: 26,
    color: colors.gold,
    fontWeight: '400',
  },
});

export default DailyReminderPrompt;
