import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { PracticeStackParamList } from '@/types';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { ZenBackground } from '@/components/common';
import { safeHaptics } from '@/utils/haptics';
import { getDayDiffLocal, getEffectiveStabilizeStreakDays, toDateOrNull } from '@/utils/stabilizeStats';
import { calculateStreakWithGrace } from '@/utils/streak';

// Practice Components
import { PracticeHeader } from './components/PracticeHeader';
import { StreakCard } from './components/StreakCard';
import { PracticeModeCard } from './components/PracticeModeCard';
import { SanctuaryCandleIndicator } from './components/SanctuaryCandleIndicator';
import { TodayAnchorCard } from './components/TodayAnchorCard';
import { ContinueRitualRow } from './components/ContinueRitualRow';

type PracticeNavigationProp = StackNavigationProp<PracticeStackParamList, 'PracticeHome'>;

export const PracticeScreen: React.FC = () => {
  const navigation = useNavigation<PracticeNavigationProp>();
  const user = useAuthStore((state) => state.user);
  const { getActiveAnchors, getAnchorById } = useAnchorStore();
  const { defaultActivation, defaultCharge, dailyPracticeGoal } = useSettingsStore();
  const { lastSession, todayPractice, sessionLog, lastGraceDayUsedAt, consumeGraceDay } =
    useSessionStore();

  const activeAnchors = getActiveAnchors();
  const hasAnchors = activeAnchors.length > 0;
  const mostRecentAnchor = React.useMemo(() => {
    if (!hasAnchors) return undefined;

    const toMillis = (value?: Date | string): number => {
      if (!value) return 0;
      const parsed = value instanceof Date ? value : new Date(value);
      return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    };

    return [...activeAnchors].sort((a, b) => {
      const aRecency = Math.max(toMillis(a.lastActivatedAt), toMillis(a.updatedAt), toMillis(a.createdAt));
      const bRecency = Math.max(toMillis(b.lastActivatedAt), toMillis(b.updatedAt), toMillis(b.createdAt));
      return bRecency - aRecency;
    })[0];
  }, [activeAnchors, hasAnchors]);

  // ── Stabilize streak (existing logic, unchanged) ─────────────────────────
  const now = new Date();
  const lastStabilizeAt = toDateOrNull(user?.lastStabilizeAt);
  const hasStabilizedToday = getDayDiffLocal(now, lastStabilizeAt) === 0;
  const stabilizeStreakDays = getEffectiveStabilizeStreakDays(
    user?.stabilizeStreakDays ?? 0,
    lastStabilizeAt,
    now
  );

  // ── Combined "Days Anchored" streak (all session types + grace day) ───────
  const anchoredStreak = calculateStreakWithGrace(sessionLog, lastGraceDayUsedAt);
  const showGraceDayCopy =
    anchoredStreak.currentStreak === 0 && sessionLog.length > 0 && anchoredStreak.isStreakProtected === false;

  // ── Derived settings ─────────────────────────────────────────────────────
  const defaultActivationSeconds =
    defaultActivation.unit === 'seconds' ? defaultActivation.value : defaultActivation.value * 60;

  // Map preset key to minutes for reinforce label
  const presetMinutes: Record<string, number> = {
    '30s': 0,
    '1m': 1,
    '2m': 2,
    '5m': 5,
    '10m': 10,
    '20m': 20,
    custom: defaultCharge.customMinutes ?? 5,
  };
  const defaultReinforceMinutes = presetMinutes[defaultCharge.preset] ?? 5;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCreateAnchor = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    const tabNav = navigation.getParent?.() as any;
    tabNav?.navigate('Vault', { screen: 'CreateAnchor' });
  };

  const handleActivate = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    if (!mostRecentAnchor) {
      handleCreateAnchor();
      return;
    }
    const tabNav = navigation.getParent?.() as any;
    tabNav?.navigate('Vault', {
      screen: 'ActivationRitual',
      params: { anchorId: mostRecentAnchor.id, activationType: 'visual', returnTo: 'practice' },
    });
  };

  const handleReinforce = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    if (!mostRecentAnchor) {
      handleCreateAnchor();
      return;
    }
    const tabNav = navigation.getParent?.() as any;
    tabNav?.navigate('Vault', {
      screen: 'ChargeSetup',
      params: { anchorId: mostRecentAnchor.id, returnTo: 'practice' },
    });
  };

  const handleChangeAnchor = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    const tabNav = navigation.getParent?.() as any;
    tabNav?.navigate('Vault', { screen: 'Vault' });
  };

  const handleContinue = () => {
    if (!lastSession) return;
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    const tabNav = navigation.getParent?.() as any;
    if (lastSession.type === 'activate') {
      tabNav?.navigate('Vault', {
        screen: 'ActivationRitual',
        params: {
          anchorId: lastSession.anchorId,
          activationType: 'visual',
          durationOverride: lastSession.durationSeconds,
        },
      });
    } else if (lastSession.type === 'reinforce') {
      tabNav?.navigate('Vault', {
        screen: 'Ritual',
        params: {
          anchorId: lastSession.anchorId,
          ritualType: 'ritual',
          durationSeconds: lastSession.durationSeconds,
          returnTo: 'practice',
        },
      });
    } else {
      // stabilize
      navigation.navigate('StabilizeRitual', { anchorId: lastSession.anchorId });
    }
  };

  const handleReconnect = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    if (!mostRecentAnchor) {
      handleCreateAnchor();
      return;
    }
    const tabNav = navigation.getParent?.() as any;
    tabNav?.navigate('Vault', {
      screen: 'Ritual',
      params: { anchorId: mostRecentAnchor.id, ritualType: 'focus', returnTo: 'practice' },
    });
  };

  const handleStabilize = () => {
    safeHaptics.selection();
    if (!mostRecentAnchor) {
      handleCreateAnchor();
      return;
    }
    navigation.navigate('StabilizeRitual', { anchorId: mostRecentAnchor.id });
  };

  const handleEvolve = () => {
    safeHaptics.selection();
    navigation.navigate('Evolve');
  };

  // ── Anchor for lastSession (for ContinueRitualRow) ────────────────────────
  const continueAnchor = lastSession
    ? getAnchorById(lastSession.anchorId)
    : undefined;

  // ── Entrance stagger animations ────────────────────────────────────────────
  const reduceMotion = useReducedMotion();

  const headerAnim = useSharedValue(0);
  const streakAnim = useSharedValue(0);
  const todayAnim = useSharedValue(0);
  const cardsAnim = useSharedValue(0);

  const EASING = Easing.out(Easing.cubic);
  const DUR = 380;

  // Each animated section: fade in + gentle rise from 14px below
  const animatedHeaderStyle = useAnimatedStyle(() => ({
    opacity: headerAnim.value,
    transform: [{ translateY: (1 - headerAnim.value) * 14 }],
  }));
  const animatedStreakStyle = useAnimatedStyle(() => ({
    opacity: streakAnim.value,
    transform: [{ translateY: (1 - streakAnim.value) * 14 }],
  }));
  const animatedTodayStyle = useAnimatedStyle(() => ({
    opacity: todayAnim.value,
    transform: [{ translateY: (1 - todayAnim.value) * 14 }],
  }));
  const animatedCardsStyle = useAnimatedStyle(() => ({
    opacity: cardsAnim.value,
    transform: [{ translateY: (1 - cardsAnim.value) * 14 }],
  }));

  // Track whether we've played the entrance animation yet.
  // - If the component actually unmounts (detachInactiveScreens), this ref resets on
  //   each remount, so the entrance plays each time the screen mounts fresh.
  // - If the component stays mounted (screen is cached), the ref stays false and we
  //   skip the reset to 0 on return visits — preventing the visible content flash.
  const hasAnimatedRef = useRef(false);

  useFocusEffect(useCallback(() => {
    if (reduceMotion) {
      headerAnim.value = 1;
      streakAnim.value = 1;
      todayAnim.value = 1;
      cardsAnim.value = 1;
      return;
    }

    if (hasAnimatedRef.current) {
      // Return visit on a cached (non-detached) screen: content is already at 1.
      // Do not reset to 0 — that would create a visible flash before re-animating.
      return;
    }
    hasAnimatedRef.current = true;

    // Values start at 0 (fresh mount). Stagger them in.
    headerAnim.value = withDelay(0, withTiming(1, { duration: DUR, easing: EASING }));
    streakAnim.value = withDelay(60, withTiming(1, { duration: DUR, easing: EASING }));
    todayAnim.value = withDelay(120, withTiming(1, { duration: DUR, easing: EASING }));
    cardsAnim.value = withDelay(190, withTiming(1, { duration: DUR, easing: EASING }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]));

  return (
    <View style={styles.container}>
      <ZenBackground />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header row: fades + rises first ── */}
          <Animated.View style={[styles.headerRow, animatedHeaderStyle]}>
            <PracticeHeader subhead="Return to your signal" />
            <SanctuaryCandleIndicator isLit={hasStabilizedToday} streakDays={stabilizeStreakDays} />
          </Animated.View>

          {/* ── Streak card: stagger 60ms ── */}
          <Animated.View style={animatedStreakStyle}>
            <StreakCard streakDays={stabilizeStreakDays} hasStabilizedToday={hasStabilizedToday} />
          </Animated.View>

          {/* ── Today's Anchor Module: stagger 120ms ── */}
          <Animated.View style={animatedTodayStyle}>
            {mostRecentAnchor ? (
              <>
                <TodayAnchorCard
                  anchor={mostRecentAnchor}
                  todaySessionsCount={todayPractice.sessionsCount}
                  dailyGoal={dailyPracticeGoal}
                  defaultActivationSeconds={defaultActivationSeconds}
                  defaultReinforceMinutes={defaultReinforceMinutes}
                  onActivate={handleActivate}
                  onReinforce={handleReinforce}
                  onChangeAnchor={handleChangeAnchor}
                />

                {/* Continue last session row */}
                {lastSession && (
                  <ContinueRitualRow
                    lastSession={lastSession}
                    anchor={continueAnchor}
                    onContinue={handleContinue}
                  />
                )}

                {/* Days Anchored streak */}
                {anchoredStreak.currentStreak > 0 && (
                  <Text style={styles.daysAnchoredText}>
                    Days anchored: {anchoredStreak.currentStreak}
                    {anchoredStreak.isStreakProtected ? ' ✦' : ''}
                  </Text>
                )}

                {/* Grace day recovery copy */}
                {showGraceDayCopy && (
                  <Text style={styles.graceCopy}>
                    Pick it back up. Your practice is still here.
                  </Text>
                )}
              </>
            ) : null}
          </Animated.View>

          {/* ── Daily Practice cards: stagger 190ms ── */}
          <Animated.View style={animatedCardsStyle}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daily Practice</Text>

              <PracticeModeCard
                title="Resume Ritual"
                subtext="Pick up your thread."
                cta="Reconnect"
                onPress={handleReconnect}
              />

              <PracticeModeCard
                title="Stabilize (30s)"
                subtext="Breathe. Return. Seal the state."
                cta="Stabilize"
                onPress={handleStabilize}
              />

              <PracticeModeCard
                title="Expand Your Sanctuary"
                subtext="Unlock deeper rituals, pattern tracking, and longer sessions."
                cta="Evolve"
                onPress={handleEvolve}
              />
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: spacing.lg,
  },
  scrollContent: {
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  daysAnchoredText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
    letterSpacing: 0.5,
  },
  graceCopy: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginHorizontal: spacing.xl,
    lineHeight: 18,
  },
});
