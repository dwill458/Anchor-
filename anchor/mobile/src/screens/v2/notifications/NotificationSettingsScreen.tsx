import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { CompactPickerSheet, SettingsHeader } from '@/components/settings/SettingsPrimitives';
import { IconBell, IconChevron, IconSliders, IconTarget } from '@/components/settings/SettingsIcons';
import { settingsColors, settingsTypography, T } from '@/components/settings/settingsTheme';
import { NOTIFICATION_MOTION, useNotificationReduceMotion } from '@/components/v2/notifications/notificationMotion';
import { ReminderTimeSheet } from '@/components/v2/notifications/ReminderTimeSheet';
import { behindSheetA11yProps } from '@/components/v2/notifications/timeWheelLayout';
import { Reveal } from '@/components/v2/notifications/Reveal';
import { useNotificationController } from '@/hooks/useNotificationController';
import { useReminderEnrollment } from '@/hooks/v2/notifications/useReminderEnrollment';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import NotificationService from '@/services/NotificationService';
import {
  momentumPatch,
  normalizeNotificationState,
  NOTIFICATION_STATE_STORAGE_KEY,
  type NotificationState,
} from '@/services/NotificationState';
import { NotificationCoordinator } from '@/services/notifications/NotificationCoordinator';
import type { NotificationPermissionStatus, NotificationTone } from '@/services/notifications/notificationTypes';
import { useSettingsStore } from '@/stores/settingsStore';
import { safeHaptics } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { deviceUses24Hour, formatDisplay } from '@/utils/reminderTime';
import { deriveSettingsModel } from './settingsModel';

interface Props {
  onBack: () => void;
}

type CategoryKey = 'vision' | 'chart' | 'momentum' | 'weekly_recap';

const GOLD = settingsColors.accent.goldInk;
const GOLD_TINT = settingsColors.accent.goldBg;
const GOLD_EDGE = settingsColors.accent.goldBorder;

/** Tones the template selector actually has copy for (the legacy "minimal" was normalised away). */
const TONE_OPTIONS: Array<{ label: string; value: NotificationTone; desc: string }> = [
  { label: 'Encouraging', value: 'encouraging', desc: 'Warm, supportive wording' },
  { label: 'Direct', value: 'direct', desc: 'Clear and concise' },
  { label: 'Reflective', value: 'reflective', desc: 'Calm and thoughtful' },
  { label: 'Performance', value: 'performance', desc: 'Focused and goal-driven' },
];

const toneLabel = (tone: string | undefined): string =>
  TONE_OPTIONS.find((option) => option.value === tone)?.label ?? 'Encouraging';

/* ── Small icons (react-native-svg, same family as SettingsIcons) ── */

const IconEye: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 22 22" fill="none">
    <Path d="M2 11s3.2-6 9-6 9 6 9 6-3.2 6-9 6-9-6-9-6Z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    <Circle cx={11} cy={11} r={2.6} stroke={color} strokeWidth={1.6} />
  </Svg>
);

const IconCalendar: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 22 22" fill="none">
    <Path d="M4 6.5h14v11H4v-11ZM4 10h14M8 4v3M14 4v3" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const IconVolume: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 22 22" fill="none">
    <Path d="M4 9v4h3l4 3.5v-11L7 9H4ZM14.5 8.5a4 4 0 0 1 0 5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/* ── Presentational pieces ─────────────────────────────────────── */

const IconDisc: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.iconDisc}>{children}</View>
);

const Caption: React.FC<{ title: string; hint?: string; first?: boolean }> = ({ title, hint, first }) => (
  <View style={[styles.captionWrap, first && styles.captionFirst]}>
    <Text style={styles.caption} accessibilityRole="header">
      {title}
    </Text>
    {hint ? <Text style={styles.captionHint}>{hint}</Text> : null}
  </View>
);

/**
 * Switch whose thumb travels on a spring. UI-thread value only: toggling never
 * re-renders per frame. Under Reduced Motion the thumb just fades its travel
 * with the short opacity-class timing instead of springing.
 */
const SpringSwitch: React.FC<{ on: boolean; disabled?: boolean }> = ({ on, disabled }) => {
  const reduceMotion = useNotificationReduceMotion();
  const progress = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? withTiming(on ? 1 : 0, { duration: NOTIFICATION_MOTION.reducedMs })
      : withSpring(on ? 1 : 0, NOTIFICATION_MOTION.settleSpring);
  }, [on, reduceMotion, progress]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 19 }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <View style={[styles.track, disabled && styles.trackDisabled]} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.trackFill, fillStyle]} />
      <Animated.View style={[styles.thumb, thumbStyle]} />
    </View>
  );
};

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  on: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  testID?: string;
  showDivider?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  icon,
  title,
  subtitle,
  on,
  disabled = false,
  onToggle,
  testID,
  showDivider = true,
}) => (
  <Pressable
    accessibilityRole="switch"
    accessibilityLabel={title}
    accessibilityHint={subtitle}
    accessibilityState={{ checked: on, disabled }}
    disabled={disabled}
    onPress={() => onToggle(!on)}
    style={({ pressed }) => [styles.row, showDivider && styles.rowDivider, pressed && styles.rowPressed]}
    testID={testID ?? `settings-row-${title}`}
  >
    <IconDisc>{icon}</IconDisc>
    <View style={styles.rowText}>
      <Text style={[styles.rowTitle, disabled && styles.rowTitleDisabled]}>{title}</Text>
      <Text style={styles.rowSubtitle}>{subtitle}</Text>
    </View>
    <SpringSwitch on={on} disabled={disabled} />
  </Pressable>
);

/**
 * Measurement-free drawer. The content renders at its natural height; the wrapper's maxHeight
 * animates from 0 up to DRAWER_MAX_HEIGHT, which is generously larger than the content, so the
 * content shows fully. We avoid measuring (onLayout + absolute inner view) on purpose: the
 * measure-then-animate version stayed at height 0 on a Galaxy S24 and the drawer never expanded.
 */
const DRAWER_MAX_HEIGHT = 240;

const Drawer: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => {
  const reduceMotion = useNotificationReduceMotion();
  // Initialised from `open` so a returning user with Daily ON sees the drawer fully open on frame one.
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    const duration = reduceMotion ? NOTIFICATION_MOTION.reducedMs : NOTIFICATION_MOTION.screenMs;
    progress.value = withTiming(open ? 1 : 0, { duration });
  }, [open, reduceMotion, progress]);

  const style = useAnimatedStyle(() => ({
    maxHeight: progress.value * DRAWER_MAX_HEIGHT,
    opacity: progress.value,
  }));

  return (
    <Animated.View
      style={[styles.drawer, style]}
      pointerEvents={open ? 'auto' : 'none'}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!open}
      testID="notification-time-drawer"
    >
      {children}
    </Animated.View>
  );
};

/* ── Screen ────────────────────────────────────────────────────── */

export const NotificationSettingsScreen: React.FC<Props> = ({ onBack }) => {
  const { notifState, updateNotificationPreferences } = useNotificationController();
  const { status: enrollStatus, enroll, openSystemSettings, reset: resetEnrollment } = useReminderEnrollment();
  const use24h = useMemo(() => deviceUses24Hour(), []);

  // The enrollment hook owns its own controller instance, so its writes reach storage but not
  // this screen's hook state. `stored` is a read-only re-read of storage after actions and on
  // foreground; it is dropped whenever this screen's own controller publishes fresh state.
  const [stored, setStored] = useState<NotificationState | null>(null);
  const [livePermission, setLivePermission] = useState<NotificationPermissionStatus | null>(null);
  const [nativeScheduled, setNativeScheduled] = useState<boolean | null>(null);
  const [optimisticDaily, setOptimisticDaily] = useState<boolean | null>(null);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const [tonePickerOpen, setTonePickerOpen] = useState(false);

  const mounted = useRef(true);
  const readSeq = useRef(0);
  const inFlight = useRef<Set<string>>(new Set());

  const base = (stored ?? notifState) as NotificationState | null;
  const effective = useMemo<NotificationState | null>(
    () => (base && livePermission ? { ...base, notificationPermissionStatus: livePermission } : base),
    [base, livePermission]
  );
  const dailyPrimeTime = effective?.dailyPrimeTime ?? '21:00';
  const timeRef = useRef(dailyPrimeTime);
  timeRef.current = dailyPrimeTime;
  // A time just written by this screen wins over a render that has not caught up yet.
  const pendingTime = useRef<string | null>(null);

  useEffect(() => {
    setStored(null);
  }, [notifState]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const readStored = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(NOTIFICATION_STATE_STORAGE_KEY);
      if (raw && mounted.current) setStored(normalizeNotificationState(JSON.parse(raw)));
    } catch (error) {
      logger.warn('[NotificationSettings] state re-read failed', error);
    }
  }, []);

  /** Read-only look at the OS permission and the native schedule. */
  const readNative = useCallback(async (time?: string) => {
    const seq = ++readSeq.current;
    try {
      const [permission, scheduled] = await Promise.all([
        NotificationService.getPermissionStatus(),
        NotificationService.hasMatchingPersonalDailyReminder(time ?? pendingTime.current ?? timeRef.current),
      ]);
      if (mounted.current && seq === readSeq.current) {
        setLivePermission(permission);
        setNativeScheduled(Boolean(scheduled));
      }
    } catch (error) {
      logger.warn('[NotificationSettings] native read failed', error);
    }
  }, []);

  /** Coordinator verify (the existing reconcile path), then re-read everything. */
  const verifyAndRefresh = useCallback(async () => {
    try {
      await NotificationCoordinator.verifyAndReconcileNativeSchedule();
    } catch (error) {
      logger.warn('[NotificationSettings] verify failed', error);
    }
    await readStored();
    await readNative();
  }, [readNative, readStored]);

  // Mount, and every time the app returns to the foreground (the user may have changed OS settings).
  useEffect(() => {
    void verifyAndRefresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void verifyAndRefresh();
    });
    return () => subscription?.remove?.();
  }, [verifyAndRefresh]);

  // Prefs changed (time edit, toggles): re-read the schedule so the toggle keeps telling the truth.
  const prefsKey = effective
    ? `${effective.notification_enabled}|${effective.dailyPrimeEnabled}|${effective.personalDailyReminderOptedIn}|${effective.dailyPrimeTime}`
    : 'none';
  useEffect(() => {
    if (prefsKey !== 'none') void readNative();
  }, [prefsKey, readNative]);

  const model = deriveSettingsModel(effective, nativeScheduled ?? Boolean(effective?.dailyPrimeEnabled));
  // Until the first native read lands we trust the saved prefs, so a returning user never sees the
  // switch jump; the read then corrects it if the schedule is actually missing.
  const dailyShown = optimisticDaily ?? model.dailyOn;
  const othersDisabled = model.osDenied || effective?.notification_enabled === false;
  const dailyDisabled = model.osDenied;

  const trackCategory = (category: string, enabled: boolean) => {
    AnalyticsService.track(AnalyticsEvents.NOTIFICATION_CATEGORY_TOGGLED, { category, enabled });
  };

  const handleDailyToggle = async (next: boolean) => {
    if (inFlight.current.has('daily')) return;
    inFlight.current.add('daily');
    safeHaptics.selection();
    setOptimisticDaily(next);
    try {
      if (next) {
        resetEnrollment();
        pendingTime.current = dailyPrimeTime;
        await enroll(dailyPrimeTime);
      } else {
        resetEnrollment();
        // Personal reminder only: never touch Vision / Chart / Momentum / Weekly recap or push tokens.
        await updateNotificationPreferences({ dailyPrimeEnabled: false, personalDailyReminderOptedIn: false });
      }
      await readStored();
      await readNative(pendingTime.current ?? undefined);
    } finally {
      pendingTime.current = null;
      inFlight.current.delete('daily');
      if (mounted.current) setOptimisticDaily(null);
    }
  };

  const handleCategory = async (
    key: CategoryKey,
    current: boolean,
    next: boolean,
    patch: Parameters<typeof updateNotificationPreferences>[0],
    after?: () => void
  ) => {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    safeHaptics.selection();
    try {
      // Idempotent: only the requested value is ever written, and an unchanged value is a no-op.
      if (current !== next) {
        await updateNotificationPreferences(patch);
        after?.();
        trackCategory(key, next);
        await readStored();
      }
    } finally {
      inFlight.current.delete(key);
    }
  };

  const handleTimeConfirm = async (time: string) => {
    setTimeSheetOpen(false);
    if (time === dailyPrimeTime) return;
    pendingTime.current = time;
    timeRef.current = time;
    try {
      await updateNotificationPreferences({ dailyPrimeTime: time });
      await readStored();
      await readNative(time);
    } finally {
      pendingTime.current = null;
    }
  };

  const showEnrollmentFeedback = enrollStatus === 'denied' || enrollStatus === 'blocked' || enrollStatus === 'failed';
  const showBanner = model.osDenied;

  const visionOn = Boolean(effective?.visionRemindersEnabled);
  const chartOn = Boolean(effective?.chartRemindersEnabled);
  const weeklyOn = Boolean(effective?.weeklyRecapEnabled);
  const timeValue = dailyShown ? formatDisplay(dailyPrimeTime, use24h) : 'Off';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea} {...behindSheetA11yProps(timeSheetOpen)}>
        <SettingsHeader title="Notifications & reminders" onBack={onBack} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {showBanner ? (
            <View style={styles.banner} testID="notification-denied-banner">
              <Text style={styles.bannerText}>Notifications are disabled in device settings.</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Open Settings"
                onPress={openSystemSettings}
                style={styles.bannerButton}
                activeOpacity={0.7}
              >
                <Text style={styles.bannerButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Reveal index={0}>
            <Caption title="YOUR DAILY MOMENT" first />
            <View style={styles.card}>
              <ToggleRow
                icon={<IconBell size={20} color={GOLD} />}
                title="Daily reminder"
                subtitle="Reconnect at a time you choose."
                on={dailyShown}
                disabled={dailyDisabled}
                onToggle={(next) => void handleDailyToggle(next)}
                showDivider={false}
              />
              <Drawer open={dailyShown}>
                <View style={styles.drawerBody}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Remind me at"
                    accessibilityValue={{ text: timeValue }}
                    onPress={() => setTimeSheetOpen(true)}
                    activeOpacity={0.65}
                    style={styles.timeRow}
                    testID="settings-row-Remind me at"
                  >
                    <Text style={styles.timeLabel}>Remind me at</Text>
                    <Text style={styles.timeValue}>{timeValue}</Text>
                    <IconChevron size={12} color={T.ink3} />
                  </TouchableOpacity>
                  <Text style={styles.note}>Every day, even if you&apos;ve already practiced earlier.</Text>
                </View>
              </Drawer>
              {showEnrollmentFeedback ? (
                <View style={styles.feedback} testID="notification-enroll-feedback">
                  <Text style={styles.feedbackText}>
                    {enrollStatus === 'failed'
                      ? "We couldn't set your reminder. Please try again."
                      : 'Notifications are turned off for Anchor in your device settings.'}
                  </Text>
                  {enrollStatus !== 'failed' ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Open Settings"
                      onPress={openSystemSettings}
                      style={styles.bannerButton}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.bannerButtonText}>Open Settings</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          </Reveal>

          <Reveal index={1}>
            <Caption title="OPTIONAL REMINDERS" hint="Gentle encouragement based on your goals." />
            <View style={styles.card}>
              {model.showVisionChart ? (
                <>
                  <ToggleRow
                    icon={<IconEye color={GOLD} />}
                    title="Vision reminders"
                    subtitle="Reconnect with the future you're building."
                    on={visionOn}
                    disabled={othersDisabled}
                    onToggle={(next) =>
                      void handleCategory('vision', visionOn, next, { visionRemindersEnabled: next })
                    }
                  />
                  <ToggleRow
                    icon={<IconTarget size={20} color={GOLD} />}
                    title="Chart reminders"
                    subtitle="Stay connected to your next move."
                    on={chartOn}
                    disabled={othersDisabled}
                    onToggle={(next) =>
                      void handleCategory('chart', chartOn, next, { chartRemindersEnabled: next })
                    }
                  />
                </>
              ) : null}
              <ToggleRow
                icon={<IconSliders size={20} color={GOLD} />}
                title="Momentum check-ins"
                subtitle="Gentle encouragement after time away."
                on={model.momentumOn}
                disabled={othersDisabled}
                onToggle={(next) =>
                  void handleCategory('momentum', model.momentumOn, next, momentumPatch(next))
                }
                showDivider={false}
              />
            </View>
          </Reveal>

          <Reveal index={2}>
            <Caption title="YOUR PROGRESS" />
            <View style={styles.card}>
              <ToggleRow
                icon={<IconCalendar color={GOLD} />}
                title="Weekly recap"
                subtitle="A look at what you've accomplished."
                on={weeklyOn}
                disabled={othersDisabled}
                onToggle={(next) =>
                  void handleCategory(
                    'weekly_recap',
                    weeklyOn,
                    next,
                    { weeklyRecapEnabled: next },
                    () => useSettingsStore.getState?.()?.setWeeklySummaryEnabled?.(next)
                  )
                }
                showDivider={false}
              />
            </View>
          </Reveal>

          <Reveal index={3}>
            <Caption title="DELIVERY" />
            <View style={styles.card}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Notification tone"
                accessibilityHint="Applies to momentum check-ins and your weekly recap."
                disabled={othersDisabled}
                onPress={() => setTonePickerOpen(true)}
                activeOpacity={0.65}
                style={[styles.row, othersDisabled && styles.rowDisabled]}
                testID="settings-row-Notification tone"
              >
                <IconDisc>
                  <IconVolume color={GOLD} />
                </IconDisc>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Notification tone</Text>
                  <Text style={styles.rowSubtitle}>For momentum check-ins and your weekly recap.</Text>
                </View>
                <Text style={styles.timeValue}>{toneLabel(effective?.notificationTone)}</Text>
                <IconChevron size={12} color={T.ink3} />
              </TouchableOpacity>
            </View>
          </Reveal>
        </ScrollView>
      </SafeAreaView>

      <CompactPickerSheet
        open={tonePickerOpen}
        title="Notification Tone"
        options={TONE_OPTIONS}
        value={effective?.notificationTone ?? 'encouraging'}
        onPick={(val) => void updateNotificationPreferences({ notificationTone: val as NotificationTone }).then(readStored)}
        onClose={() => setTonePickerOpen(false)}
      />

      <ReminderTimeSheet
        open={timeSheetOpen}
        value={dailyPrimeTime}
        use24h={use24h}
        onConfirm={(time) => void handleTimeConfirm(time)}
        onClose={() => setTimeSheetOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 48 },
  captionWrap: { marginTop: 28, marginBottom: 10, paddingHorizontal: 4 },
  captionFirst: { marginTop: 14 },
  caption: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 11.5,
    letterSpacing: 1.1,
    color: T.ink2,
  },
  captionHint: {
    fontFamily: settingsTypography.body,
    fontSize: 13,
    lineHeight: 18,
    color: T.ink3,
    marginTop: 4,
  },
  card: {
    backgroundColor: T.surface,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.line,
    paddingHorizontal: 16,
    shadowColor: '#2A2418',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    paddingVertical: 14,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line },
  rowPressed: { opacity: 0.7 },
  rowDisabled: { opacity: 0.5 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: settingsTypography.bodySemiBold, fontSize: 16, color: T.ink },
  rowTitleDisabled: { color: T.ink2 },
  rowSubtitle: { fontFamily: settingsTypography.body, fontSize: 13, lineHeight: 18, color: T.ink2 },
  iconDisc: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: GOLD_TINT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD_EDGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    width: 46,
    height: 27,
    borderRadius: 14,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.line,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackDisabled: { opacity: 0.45 },
  trackFill: { ...StyleSheet.absoluteFill, backgroundColor: T.ink },
  thumb: {
    position: 'absolute',
    left: 2,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: T.surface,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  drawer: { overflow: 'hidden' },
  drawerBody: { paddingBottom: 14 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: T.surface2,
  },
  timeLabel: { flex: 1, fontFamily: settingsTypography.bodyMedium, fontSize: 15, color: T.ink },
  timeValue: { fontFamily: settingsTypography.bodySemiBold, fontSize: 15, color: GOLD },
  note: {
    fontFamily: settingsTypography.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: T.ink3,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  banner: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: GOLD_TINT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD_EDGE,
    gap: 10,
  },
  bannerText: { fontFamily: settingsTypography.body, fontSize: 14, lineHeight: 20, color: T.ink },
  bannerButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: T.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerButtonText: { fontFamily: settingsTypography.bodySemiBold, fontSize: 14, color: T.surface },
  feedback: { paddingBottom: 14, gap: 10 },
  feedbackText: { fontFamily: settingsTypography.body, fontSize: 13.5, lineHeight: 19, color: T.danger },
});

export default NotificationSettingsScreen;
