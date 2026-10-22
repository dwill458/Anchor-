import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { V2Button, V2TimePicker } from '@/components/v2/primitives';
import { v2Haptics } from '@/hooks/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';
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

const DEFAULT_REMINDER_TIME = '08:00';

const dateForReminderTime = (time: string): Date => {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
};

const COPY: Record<ReminderPromptVariant, {
  title: string;
  body: string;
  primary: string;
  secondary: string;
}> = {
  first_anchor: {
    title: 'Keep This Anchor Alive',
    body: 'Anchors work best when they’re returned to with intention. We’ll start with one quiet 8:00 AM nudge—you can choose a different time now or change it anytime.',
    primary: 'Set 8:00 AM Reminder',
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
  const [customTime, setCustomTime] = useState(() => dateForReminderTime(DEFAULT_REMINDER_TIME));
  const copy = COPY[variant];

  // Announce the prompt once when it becomes visible (also records shown-at).
  useEffect(() => {
    if (visible) {
      setStep('intro');
      setIsBusy(false);
      setCustomTime(dateForReminderTime(DEFAULT_REMINDER_TIME));
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
    v2Haptics.selection();
    AnalyticsService.track(AnalyticsEvents.NOTIFICATION_SET_DAILY_REMINDER_TAPPED, {
      source: variant,
    });
    void handleSchedule(DEFAULT_REMINDER_TIME);
  }, [variant, handleSchedule]);

  const handleChooseDifferentTime = useCallback(() => {
    v2Haptics.selection();
    setStep('time');
  }, []);

  const handleChooseCustomTime = useCallback(() => {
    v2Haptics.selection();
    setCustomTime(dateForReminderTime(DEFAULT_REMINDER_TIME));
    setStep('custom');
  }, []);

  const handleCustomTimeConfirm = useCallback(() => {
    const hours = String(customTime.getHours()).padStart(2, '0');
    const minutes = String(customTime.getMinutes()).padStart(2, '0');
    void handleSchedule(`${hours}:${minutes}`);
  }, [customTime, handleSchedule]);

  const handleSecondary = useCallback(() => {
    v2Haptics.selection();
    AnalyticsService.track(AnalyticsEvents.NOTIFICATION_NOT_NOW_TAPPED, {
      source: variant,
    });
    void completeReminderPrompt(variant);
    onDismiss();
  }, [variant, completeReminderPrompt, onDismiss]);

  const handleDone = useCallback(() => {
    v2Haptics.confirmation();
    void completeReminderPrompt(variant);
    onDismiss();
  }, [variant, completeReminderPrompt, onDismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={step === 'intro' ? handleSecondary : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {step === 'intro' && (
            <>
              <Text style={styles.eyebrow}>DAILY PRIME REMINDER</Text>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.body}>{copy.body}</Text>

              <View style={styles.actions}>
                <V2Button
                  size="large"
                  variant="primary"
                  loading={isBusy}
                  disabled={isBusy}
                  onPress={handlePrimary}
                  accessibilityLabel={copy.primary}
                >
                  {copy.primary}
                </V2Button>

                <Pressable
                  onPress={handleChooseDifferentTime}
                  style={styles.changeTimeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Choose a different reminder time"
                >
                  <Text style={styles.changeTimeText}>Choose a different time</Text>
                </Pressable>

                <V2Button
                  size="medium"
                  variant="secondary"
                  disabled={isBusy}
                  onPress={handleSecondary}
                  accessibilityLabel={copy.secondary}
                >
                  {copy.secondary}
                </V2Button>
              </View>
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
                  <Pressable
                    key={option.time}
                    onPress={() => void handleSchedule(option.time)}
                    disabled={isBusy}
                    style={({ pressed }) => [
                      styles.timeOption,
                      pressed && styles.timeOptionPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.label}, ${option.hint}`}
                  >
                    <Text style={styles.timeOptionLabel}>{option.label}</Text>
                    <Text style={styles.timeOptionHint}>{option.hint}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={handleChooseCustomTime}
                  disabled={isBusy}
                  style={({ pressed }) => [
                    styles.timeOption,
                    pressed && styles.timeOptionPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Custom time"
                >
                  <Text style={styles.timeOptionLabel}>Custom</Text>
                  <Text style={styles.timeOptionHint}>Pick a time</Text>
                </Pressable>
              </View>

              <View style={styles.timeSecondaryActions}>
                <V2Button
                  size="medium"
                  variant="secondary"
                  loading={isBusy}
                  onPress={handleSecondary}
                  accessibilityLabel={copy.secondary}
                >
                  {copy.secondary}
                </V2Button>
              </View>
            </>
          )}

          {step === 'custom' && (
            <>
              <Text style={styles.eyebrow}>CUSTOM TIME</Text>
              <Text style={styles.title}>Choose your time</Text>
              <Text style={styles.body}>Set the hour and minutes that fit your practice.</Text>

              <V2TimePicker
                testID="custom-time-picker"
                value={customTime}
                onChange={setCustomTime}
              />

              <View style={styles.customActions}>
                <V2Button
                  size="large"
                  variant="primary"
                  loading={isBusy}
                  onPress={handleCustomTimeConfirm}
                  accessibilityLabel="Set custom reminder time"
                >
                  Set Reminder
                </V2Button>
                <V2Button
                  size="medium"
                  variant="secondary"
                  disabled={isBusy}
                  onPress={() => setStep('time')}
                  accessibilityLabel="Back"
                >
                  Back
                </V2Button>
              </View>
            </>
          )}

          {step === 'success' && (
            <>
              <View style={styles.successBadge}>
                <Check size={28} color={colors.semantic.success} strokeWidth={2.5} />
              </View>
              <Text style={styles.title}>Reminder set</Text>
              <Text style={styles.body}>{SUCCESS_COPY}</Text>

              <View style={styles.successActions}>
                <V2Button
                  size="large"
                  variant="primary"
                  onPress={handleDone}
                  accessibilityLabel="Done"
                >
                  Done
                </V2Button>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 23, 20, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  eyebrow: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 1.2,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  title: {
    ...typography.headingLG,
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: spacing[2],
  },
  body: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[5],
  },
  actions: {
    width: '100%',
    gap: spacing[2],
  },
  changeTimeButton: {
    paddingVertical: spacing[2],
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  changeTimeText: {
    ...typography.labelMD,
    color: colors.text.primary,
    textDecorationLine: 'underline',
  },
  optionsWrap: {
    width: '100%',
    gap: spacing[2],
  },
  timeOption: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.grouped,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  timeOptionPressed: {
    backgroundColor: colors.border.subtle,
  },
  timeOptionLabel: {
    ...typography.bodyLG,
    fontWeight: '600',
    color: colors.text.primary,
  },
  timeOptionHint: {
    ...typography.bodySM,
    color: colors.text.secondary,
  },
  timeSecondaryActions: {
    width: '100%',
    marginTop: spacing[4],
  },
  customActions: {
    width: '100%',
    marginTop: spacing[4],
    gap: spacing[2],
  },
  successBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: colors.semantic.success,
    backgroundColor: '#287D5712',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  successActions: {
    width: '100%',
    marginTop: spacing[2],
  },
});

export default DailyReminderPrompt;
