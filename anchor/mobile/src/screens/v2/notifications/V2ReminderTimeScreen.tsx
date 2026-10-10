import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Check, ChevronLeft, Sun } from 'lucide-react-native';
import { NOTIFICATION_MOTION, useNotificationReduceMotion } from '@/components/v2/notifications/notificationMotion';
import { Reveal } from '@/components/v2/notifications/Reveal';
import { TimeWheel } from '@/components/v2/notifications/TimeWheel';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { recordInvitationOutcomeInStorage } from '@/hooks/useNotificationController';
import { useReminderEnrollment } from '@/hooks/v2/notifications/useReminderEnrollment';
import { leaveInvitationFlowToHome } from '@/navigation/v2/invitationHandoff';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useReminderInvitationStore } from '@/stores/v2/reminderInvitationStore';
import { AnchorMotion, colors, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import { safeHaptics } from '@/utils/haptics';
import { deviceUses24Hour } from '@/utils/reminderTime';
import { loadNotificationStateSnapshot } from './invitationEligibility';
import { REMINDER_TIME_COPY } from './invitationCopy';
import { INVITATION_TOKENS, invitationStyles as shared } from './invitationTheme';

/** After success the screen continues to Home on its own after this long (or on tap). */
export const REMINDER_SUCCESS_AUTO_CONTINUE_MS = 1400;
/**
 * A permission/scheduling attempt that has not settled after this long no longer holds the exits:
 * the person can always leave (no outcome is recorded, and a late success is never marked accepted).
 */
export const REMINDER_REQUEST_EXIT_UNLOCK_MS = 10000;
const DEFAULT_TIME = '20:00';
const PROGRESS_SEGMENTS = 3;
const PROGRESS_FILLED = 2;

function ProgressSegments() {
  return (
    <View
      style={styles.segments}
      accessible
      accessibilityLabel={`Step ${PROGRESS_FILLED} of ${PROGRESS_SEGMENTS}`}
      testID="reminder-time-progress"
    >
      {Array.from({ length: PROGRESS_SEGMENTS }, (_, i) => (
        <View key={i} style={[styles.segment, i < PROGRESS_FILLED && styles.segmentFilled]} />
      ))}
    </View>
  );
}

/** Check inside a ring that settles in over `successMs` (opacity-only under Reduce Motion). */
function SuccessMark({ reduceMotion }: { reduceMotion: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, {
      duration: reduceMotion ? NOTIFICATION_MOTION.reducedMs : NOTIFICATION_MOTION.successMs,
      easing: AnchorMotion.easing.emphasized,
    });
  }, [progress, reduceMotion]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion ? [] : [{ scale: 0.82 + 0.18 * progress.value }],
  }));
  return (
    <Animated.View style={[styles.successRing, ringStyle]} testID="reminder-time-success-ring">
      <Check size={30} color={INVITATION_TOKENS.gold} strokeWidth={2.2} />
    </Animated.View>
  );
}

export function V2ReminderTimeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const anchorId: string | undefined = route.params?.anchorId;
  const reduceMotion = useNotificationReduceMotion();
  const insets = useSafeAreaInsets();
  const { status, enroll, openSystemSettings, reset } = useReminderEnrollment();

  const anchors = useAnchorStore((state) => state.anchors) as Anchor[] | undefined;
  const anchor = useMemo(
    () => (anchorId ? (anchors ?? []).find((a) => a.id === anchorId || a.localId === anchorId) : undefined),
    [anchorId, anchors],
  );

  const use24h = useMemo(() => deviceUses24Hour(), []);
  const [time, setTime] = useState(DEFAULT_TIME);
  const touchedRef = useRef(false);

  // Start from the stored time (read only; this writes and schedules nothing).
  useEffect(() => {
    let cancelled = false;
    void loadNotificationStateSnapshot().then((snapshot) => {
      if (!cancelled && snapshot?.dailyPrimeTime && !touchedRef.current) setTime(snapshot.dailyPrimeTime);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTimeChange = useCallback((next: string) => {
    touchedRef.current = true;
    setTime(next);
  }, []);

  const leavingRef = useRef(false);
  const backRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  // When the current `requesting` stretch began (null when not requesting).
  const requestingSinceRef = useRef<number | null>(null);
  if (status === 'requesting') {
    if (requestingSinceRef.current === null) requestingSinceRef.current = Date.now();
  } else {
    requestingSinceRef.current = null;
  }
  /** True while an attempt is in flight and still young enough to hold the exits. */
  const exitsHeld = () =>
    statusRef.current === 'requesting' &&
    requestingSinceRef.current !== null &&
    Date.now() - requestingSinceRef.current < REMINDER_REQUEST_EXIT_UNLOCK_MS;
  /** An attempt that never settled: mute it (the hook ignores its late status) before leaving. */
  const abandonHungRequest = () => {
    if (statusRef.current !== 'requesting') return false;
    try {
      reset();
    } catch {
      // Leaving matters more than muting.
    }
    return true;
  };

  const leaveHome = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    const sessionId = useReminderInvitationStore.getState().staged?.sessionId ?? null;
    // The time screen shows no mark: Home receives its Anchor with a crossfade.
    void leaveInvitationFlowToHome(navigation, { anchor, sessionId, measure: async () => null }, { reduceMotion });
  }, [anchor, navigation, reduceMotion]);

  const dismiss = useCallback(() => {
    if (leavingRef.current || exitsHeld()) return;
    if (statusRef.current === 'success') {
      leaveHome();
      return;
    }
    if (abandonHungRequest()) {
      // A hung attempt: leave without recording any outcome.
      leaveHome();
      return;
    }
    AnalyticsService.track(AnalyticsEvents.NOTIFICATION_INVITATION_DISMISSED, { action: 'not_now', step: 'choose_time' });
    void recordInvitationOutcomeInStorage('dismissed');
    leaveHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveHome]);

  const goBack = useCallback(() => {
    if (leavingRef.current || backRef.current || exitsHeld()) return;
    if (statusRef.current === 'success') {
      leaveHome();
      return;
    }
    abandonHungRequest();
    backRef.current = true;
    if (typeof navigation.canGoBack !== 'function' || navigation.canGoBack()) navigation.goBack();
    else leaveHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveHome, navigation]);

  // Enroll is single-flight in the hook; this ref also keeps a double tap from queuing anything.
  const enrollingRef = useRef(false);
  const handleEnable = useCallback(() => {
    if (leavingRef.current || enrollingRef.current) return;
    enrollingRef.current = true;
    // The hook never rejects; if it ever did, the status (not this promise) decides what is shown.
    let pending: Promise<void>;
    try {
      pending = Promise.resolve(enroll(time));
    } catch {
      pending = Promise.resolve();
    }
    void pending
      .catch(() => undefined)
      .finally(() => {
        enrollingRef.current = false;
      });
  }, [enroll, time]);

  // Success: acknowledged once, recorded once, then on to Home (scheduling never waits on this).
  // The timer is started once and only cleared on unmount, so a re-render (a new Anchor object, a
  // Reduce Motion change) can never cancel the auto-continue; it always calls the latest leaveHome.
  const successHandledRef = useRef(false);
  const leaveHomeRef = useRef(leaveHome);
  leaveHomeRef.current = leaveHome;
  const autoContinueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (status !== 'success' || successHandledRef.current) return;
    // Left already (a hung attempt abandoned, or Back): a late success is never marked accepted.
    if (leavingRef.current || backRef.current) return;
    successHandledRef.current = true;
    void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
    void recordInvitationOutcomeInStorage('accepted');
    autoContinueTimerRef.current = setTimeout(() => leaveHomeRef.current(), REMINDER_SUCCESS_AUTO_CONTINUE_MS);
  }, [status]);
  useEffect(() => () => {
    if (autoContinueTimerRef.current) clearTimeout(autoContinueTimerRef.current);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (typeof navigation.isFocused === 'function' && !navigation.isFocused()) return false;
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack, navigation]);

  const isSuccess = status === 'success';
  const isBlocked = status === 'denied' || status === 'blocked';
  const isFailed = status === 'failed';
  const requesting = status === 'requesting';

  return (
    <View style={shared.root} testID="reminder-time-screen">
      <View style={[shared.topBar, { paddingTop: insets.top }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={REMINDER_TIME_COPY.back}
          onPress={goBack}
          hitSlop={8}
          style={styles.backButton}
          testID="reminder-time-back"
        >
          <ChevronLeft size={22} color={INVITATION_TOKENS.ink} strokeWidth={1.9} />
        </Pressable>
        <ProgressSegments />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={REMINDER_TIME_COPY.notNow}
          onPress={dismiss}
          hitSlop={8}
          style={shared.notNowHit}
          testID="reminder-time-not-now"
        >
          <Text style={shared.notNow}>{REMINDER_TIME_COPY.notNow}</Text>
        </Pressable>
      </View>

      {isSuccess ? (
        <Pressable
          style={styles.success}
          onPress={leaveHome}
          accessibilityRole="button"
          accessibilityLabel={`${REMINDER_TIME_COPY.success} ${REMINDER_TIME_COPY.successContinue}`}
          testID="reminder-time-success"
        >
          <SuccessMark reduceMotion={reduceMotion} />
          <Text accessibilityRole="header" style={[shared.headline, styles.successText]}>{REMINDER_TIME_COPY.success}</Text>
          <Text style={styles.successContinue}>{REMINDER_TIME_COPY.successContinue}</Text>
        </Pressable>
      ) : (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Reveal index={0} reduceMotion={reduceMotion}>
              <Text style={styles.eyebrow}>{REMINDER_TIME_COPY.eyebrow}</Text>
            </Reveal>
            <Reveal index={1} reduceMotion={reduceMotion}>
              <Text accessibilityRole="header" style={[shared.headline, styles.headline]}>{REMINDER_TIME_COPY.headline}</Text>
            </Reveal>
            <Reveal index={2} reduceMotion={reduceMotion} style={styles.supportWrap}>
              <Text style={shared.support}>{REMINDER_TIME_COPY.support}</Text>
            </Reveal>
            <Reveal index={3} reduceMotion={reduceMotion} style={[shared.card, styles.wheelCard]}>
              <TimeWheel value={time} onChange={handleTimeChange} use24h={use24h} />
            </Reveal>
            <Reveal index={4} reduceMotion={reduceMotion} style={styles.note}>
              <View style={styles.noteIcon}>
                <Sun size={18} color={INVITATION_TOKENS.gold} strokeWidth={1.8} />
              </View>
              <Text style={styles.noteText}>{REMINDER_TIME_COPY.note}</Text>
            </Reveal>

            {isBlocked ? (
              <View style={styles.statusCard} testID="reminder-time-denied">
                <Text style={styles.statusTitle}>{REMINDER_TIME_COPY.deniedTitle}</Text>
                <Text style={styles.statusBody}>{REMINDER_TIME_COPY.deniedBody}</Text>
                <View style={styles.statusActions}>
                  <V2Button size="compact" onPress={openSystemSettings} testID="reminder-time-open-settings">
                    {REMINDER_TIME_COPY.openSettings}
                  </V2Button>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={REMINDER_TIME_COPY.notNow}
                    onPress={dismiss}
                    style={shared.secondaryHit}
                    testID="reminder-time-denied-not-now"
                  >
                    <Text style={shared.secondaryText}>{REMINDER_TIME_COPY.notNow}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {isFailed ? (
              <View style={styles.statusCard} testID="reminder-time-failed">
                <Text style={styles.statusBody}>{REMINDER_TIME_COPY.failedBody}</Text>
              </View>
            ) : null}
          </ScrollView>

          <Reveal
            index={5}
            reduceMotion={reduceMotion}
            style={[shared.footer, { paddingBottom: Math.max(insets.bottom, spacing[3]) }]}
          >
            <V2Button
              size="large"
              onPress={handleEnable}
              loading={requesting}
              iconRight={<ArrowRight size={18} color={colors.text.inverse} />}
              accessibilityLabel={isFailed ? REMINDER_TIME_COPY.retry : REMINDER_TIME_COPY.cta}
              testID="reminder-time-cta"
            >
              {isFailed ? REMINDER_TIME_COPY.retry : REMINDER_TIME_COPY.cta}
            </V2Button>
          </Reveal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { width: 28, height: 3, borderRadius: 2, backgroundColor: INVITATION_TOKENS.line },
  segmentFilled: { backgroundColor: INVITATION_TOKENS.ink },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[4] },
  eyebrow: { ...typography.labelSM, letterSpacing: 1.6, color: INVITATION_TOKENS.gold, textAlign: 'center' },
  headline: { marginTop: spacing[2] },
  supportWrap: { marginTop: spacing[3], paddingHorizontal: spacing[2] },
  wheelCard: { marginTop: spacing[6], paddingVertical: spacing[2], paddingHorizontal: spacing[3], alignItems: 'center' },
  note: {
    marginTop: spacing[4],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: 16,
    backgroundColor: INVITATION_TOKENS.warm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INVITATION_TOKENS.goldEdge,
  },
  noteIcon: { paddingTop: 1 },
  noteText: { ...typography.bodySM, flex: 1, color: INVITATION_TOKENS.ink },
  statusCard: {
    marginTop: spacing[4],
    padding: spacing[4],
    gap: spacing[2],
    borderRadius: 16,
    backgroundColor: INVITATION_TOKENS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INVITATION_TOKENS.line,
    alignItems: 'flex-start',
  },
  statusActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  statusTitle: { ...typography.labelLG, color: INVITATION_TOKENS.ink },
  statusBody: { ...typography.bodySM, color: INVITATION_TOKENS.inkSoft },
  success: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6], gap: spacing[4] },
  successRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: INVITATION_TOKENS.goldEdge,
    backgroundColor: INVITATION_TOKENS.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: { marginTop: spacing[1] },
  successContinue: { ...typography.labelMD, color: INVITATION_TOKENS.inkSoft, textDecorationLine: 'underline' },
});

export default V2ReminderTimeScreen;
