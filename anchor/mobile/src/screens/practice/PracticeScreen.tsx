import React, { useCallback, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, View, Text, Pressable, Platform, InteractionManager } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Flame, Wind, Zap, ChevronRight } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { Anchor, PracticeStackParamList } from '@/types';
import { ZenBackground } from '@/components/common';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore, type DefaultChargeSetting } from '@/stores/settingsStore';
import { safeHaptics } from '@/utils/haptics';
import { calculateStreakWithGrace } from '@/utils/streak';
import { getEffectiveStabilizeStreakDays, toDateOrNull } from '@/utils/stabilizeStats';
import { colors, spacing, typography } from '@/theme';
import { PRACTICE_COPY } from '@/constants/copy';
import { AnchorHero } from './components/AnchorHero';
import { AnchorSelectorSheet } from './components/AnchorSelectorSheet';
import { DailyThreadDetailsSheet } from './components/DailyThreadDetailsSheet';
import { DailyThreadPill } from './components/DailyThreadPill';
import { InfoSheet } from './components/InfoSheet';
import { ModePortalTile } from './components/ModePortalTile';
import { PracticeHubHeader } from './components/PracticeHubHeader';

type PracticeNavigationProp = StackNavigationProp<PracticeStackParamList, 'PracticeHome'>;
type PendingMode = 'charge' | 'stabilize' | 'burn' | 'quickActivate' | null;

const AUTO_TEACHING_KEY = 'practice_teaching_auto_seen_v2';
const DEEP_CHARGE_MINUTES_MIN = 2;
const DEEP_CHARGE_MINUTES_MAX = 30;

function getDefaultDeepChargeSeconds(defaultCharge: DefaultChargeSetting): number {
  if (defaultCharge.preset === 'custom') {
    const customMinutes = Math.min(
      DEEP_CHARGE_MINUTES_MAX,
      Math.max(
        DEEP_CHARGE_MINUTES_MIN,
        Math.round(defaultCharge.customMinutes ?? DEEP_CHARGE_MINUTES_MIN)
      )
    );
    return customMinutes * 60;
  }

  switch (defaultCharge.preset) {
    case '10m':
      return 10 * 60;
    case '5m':
      return 5 * 60;
    case '2m':
      return 2 * 60;
    case '30s':
    case '1m':
    default:
      return 2 * 60;
  }
}

function toMillis(value?: Date | string): number {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export const PracticeScreen: React.FC = () => {
  const navigation = useNavigation<PracticeNavigationProp>();
  const { navigateToVault, activeTabIndex } = useTabNavigation();
  const isPracticeTabActive = activeTabIndex == null ? true : activeTabIndex === 1;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const anchors = useAnchorStore((state) => state.anchors);
  const currentAnchorId = useAnchorStore((state) => state.currentAnchorId);
  const setCurrentAnchor = useAnchorStore((state) => state.setCurrentAnchor);
  const user = useAuthStore((state) => state.user);
  const { defaultCharge } = useSettingsStore();
  const { todayPractice, sessionLog, lastGraceDayUsedAt } = useSessionStore();

  const [selectorVisible, setSelectorVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [threadVisible, setThreadVisible] = useState(false);
  const [pendingMode, setPendingMode] = useState<PendingMode>(null);
  const [autoTeachingSeen, setAutoTeachingSeen] = useState<boolean | null>(null);

  const selectableAnchors = useMemo(
    () =>
      anchors
        .filter((a) => !a.isReleased && !a.archivedAt)
        .sort((a, b) => {
          const aRecency = Math.max(toMillis(a.lastActivatedAt), toMillis(a.updatedAt), toMillis(a.createdAt));
          const bRecency = Math.max(toMillis(b.lastActivatedAt), toMillis(b.updatedAt), toMillis(b.createdAt));
          return bRecency - aRecency;
        }),
    [anchors]
  );

  const mostRecentAnchor = useMemo(() => {
    if (selectableAnchors.length === 0) return undefined;
    return selectableAnchors[0];
  }, [selectableAnchors]);

  useFocusEffect(
    useCallback(() => {
      if (selectableAnchors.length === 0) {
        setCurrentAnchor(undefined);
        return () => undefined;
      }
      if (!currentAnchorId || !selectableAnchors.some((anchor) => anchor.id === currentAnchorId)) {
        setCurrentAnchor(mostRecentAnchor?.id);
      }
      return () => undefined;
    }, [selectableAnchors, currentAnchorId, mostRecentAnchor?.id, setCurrentAnchor])
  );

  const selectedAnchor = useMemo(
    () => selectableAnchors.find((anchor) => anchor.id === currentAnchorId) ?? mostRecentAnchor,
    [selectableAnchors, mostRecentAnchor, currentAnchorId]
  );

  const progressLabel = todayPractice.sessionsCount > 0 ? '1/1' : '0/1';
  const anchoredStreak = calculateStreakWithGrace(sessionLog, lastGraceDayUsedAt).currentStreak;
  const lastStabilizeAt = toDateOrNull(user?.lastStabilizeAt);
  const stabilizeStreakDays = getEffectiveStabilizeStreakDays(
    user?.stabilizeStreakDays ?? 0,
    lastStabilizeAt,
    new Date()
  );

  const defaultDeepChargeSeconds = useMemo(
    () => getDefaultDeepChargeSeconds(defaultCharge),
    [defaultCharge.customMinutes, defaultCharge.preset]
  );

  const interactionRef = useRef(false);
  const firstVisitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hesitationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPlayedFirstAutoRef = useRef(false);
  const selectingAnchorRef = useRef(false);

  const clearTeachingTimers = useCallback(() => {
    if (firstVisitTimerRef.current) {
      clearTimeout(firstVisitTimerRef.current);
      firstVisitTimerRef.current = null;
    }
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
  }, []);

  const markInteraction = useCallback(() => {
    interactionRef.current = true;
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
  }, []);

  const persistAutoTeachingSeen = useCallback(async () => {
    setAutoTeachingSeen(true);
    try {
      await AsyncStorage.setItem(AUTO_TEACHING_KEY, '1');
    } catch (_error) {
      // non-blocking
    }
  }, []);

  const openAutoTeaching = useCallback(() => {
    if (autoTeachingSeen !== false) return;
    setInfoVisible(true);
    void persistAutoTeachingSeen();
    clearTeachingTimers();
  }, [autoTeachingSeen, clearTeachingTimers, persistAutoTeachingSeen]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const load = async () => {
        try {
          const value = await AsyncStorage.getItem(AUTO_TEACHING_KEY);
          if (mounted) setAutoTeachingSeen(value === '1');
        } catch (_error) {
          if (mounted) setAutoTeachingSeen(false);
        }
      };
      void load();
      return () => {
        mounted = false;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (!isPracticeTabActive) {
        clearTeachingTimers();
        return () => undefined;
      }
      interactionRef.current = false;
      if (autoTeachingSeen !== false) return () => undefined;

      clearTeachingTimers();
      if (!hasPlayedFirstAutoRef.current) {
        hasPlayedFirstAutoRef.current = true;
        firstVisitTimerRef.current = setTimeout(() => {
          openAutoTeaching();
        }, 700);
      }

      hesitationTimerRef.current = setTimeout(() => {
        if (!interactionRef.current) {
          openAutoTeaching();
        }
      }, 6000);

      return () => {
        clearTeachingTimers();
      };
    }, [autoTeachingSeen, clearTeachingTimers, isPracticeTabActive, openAutoTeaching])
  );

  const headerAnim = useSharedValue(0);
  const heroAnim = useSharedValue(0);
  const portalsAnim = useSharedValue(0);
  const threadAnim = useSharedValue(0);
  const hasAnimatedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!isPracticeTabActive) return () => undefined;
      if (reduceMotion) {
        headerAnim.value = 1;
        heroAnim.value = 1;
        portalsAnim.value = 1;
        threadAnim.value = 1;
        return () => undefined;
      }
      if (hasAnimatedRef.current) return () => undefined;
      hasAnimatedRef.current = true;
      const timing = { duration: 360, easing: Easing.out(Easing.cubic) };
      headerAnim.value = withDelay(0, withTiming(1, timing));
      heroAnim.value = withDelay(60, withTiming(1, timing));
      portalsAnim.value = withDelay(130, withTiming(1, timing));
      threadAnim.value = withDelay(210, withTiming(1, timing));
      return () => undefined;
    }, [headerAnim, heroAnim, isPracticeTabActive, portalsAnim, reduceMotion, threadAnim])
  );

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerAnim.value,
    transform: [{ translateY: (1 - headerAnim.value) * 12 }],
  }));
  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroAnim.value,
    transform: [{ translateY: (1 - heroAnim.value) * 12 }],
  }));
  const portalsStyle = useAnimatedStyle(() => ({
    opacity: portalsAnim.value,
    transform: [{ translateY: (1 - portalsAnim.value) * 12 }],
  }));
  const threadStyle = useAnimatedStyle(() => ({
    opacity: threadAnim.value,
    transform: [{ translateY: (1 - threadAnim.value) * 10 }],
  }));

  const startCharge = useCallback(
    (anchor: Anchor) => {
      safeHaptics.selection();
      navigateToVault('Ritual', {
        anchorId: anchor.id,
        ritualType: 'ritual',
        durationSeconds: defaultDeepChargeSeconds,
        returnTo: 'practice',
      });
    },
    [defaultDeepChargeSeconds, navigateToVault]
  );

  const startQuickActivate = useCallback(
    (anchor: Anchor) => {
      safeHaptics.selection();
      navigateToVault('ActivationRitual', {
        anchorId: anchor.id,
        activationType: 'visual',
        durationOverride: 30,
        returnTo: 'practice',
      });
    },
    [navigateToVault]
  );

  const startStabilize = useCallback(
    (anchor: Anchor) => {
      safeHaptics.selection();
      navigation.navigate('StabilizeRitual', { anchorId: anchor.id });
    },
    [navigation]
  );

  const startBurn = useCallback(
    (anchor: Anchor) => {
      safeHaptics.selection();
      navigateToVault('ConfirmBurn', {
        anchorId: anchor.id,
        intention: anchor.intentionText,
        sigilSvg: anchor.baseSigilSvg ?? '',
        enhancedImageUrl: anchor.enhancedImageUrl,
      });
    },
    [navigateToVault]
  );

  const runMode = useCallback(
    (mode: Exclude<PendingMode, null>, anchor?: Anchor) => {
      const target = anchor ?? selectedAnchor;
      if (!target) {
        setPendingMode(mode);
        setSelectorVisible(true);
        return;
      }
      if (mode === 'charge') {
        startCharge(target);
      } else if (mode === 'stabilize') {
        startStabilize(target);
      } else if (mode === 'quickActivate') {
        startQuickActivate(target);
      } else {
        startBurn(target);
      }
    },
    [selectedAnchor, startBurn, startCharge, startStabilize, startQuickActivate]
  );

  const handleSelectAnchor = useCallback(
    (anchor: Anchor) => {
      if (selectingAnchorRef.current) {
        return;
      }
      selectingAnchorRef.current = true;
      markInteraction();
      setSelectorVisible(false);
      const pendingModeSelection = pendingMode;
      setPendingMode(null);

      // Compute the next ritual for this anchor so selection always navigates forward
      const todayKey = localDateKey(new Date());
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const anchorSessions = sessionLog
        .filter((s) => s.anchorId === anchor.id)
        .sort((a, b) => toMillis(b.completedAt) - toMillis(a.completedAt));
      const hasSessionToday = anchorSessions.some((s) => s.completedAt.startsWith(todayKey));
      let defaultMode: Exclude<PendingMode, null> = 'quickActivate';
      if (hasSessionToday) {
        const last = anchorSessions[0];
        if (last?.type === 'activate' && new Date(last.completedAt) > twentyFourHoursAgo) {
          defaultMode = 'stabilize';
        } else {
          defaultMode = 'charge';
        }
      }

      const applySelection = () => {
        setCurrentAnchor(anchor.id);
        // Use pending mode if set (e.g. tapped a mode tile first), otherwise
        // route to this anchor's next suggested ritual so the selector always
        // navigates the user forward.
        runMode(pendingModeSelection ?? defaultMode, anchor);
        selectingAnchorRef.current = false;
      };

      if (Platform.OS === 'android') {
        InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(applySelection);
        });
        return;
      }

      applySelection();
    },
    [markInteraction, pendingMode, runMode, sessionLog, setCurrentAnchor]
  );

  const anchorNextRituals = useMemo<Record<string, string>>(() => {
    const todayKey = localDateKey(new Date());
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result: Record<string, string> = {};
    for (const anchor of selectableAnchors) {
      const anchorSessions = sessionLog
        .filter((s) => s.anchorId === anchor.id)
        .sort((a, b) => toMillis(b.completedAt) - toMillis(a.completedAt));
      const hasSessionToday = anchorSessions.some((s) => s.completedAt.startsWith(todayKey));
      if (!hasSessionToday) {
        result[anchor.id] = PRACTICE_COPY.rituals.quickActivate.title;
      } else {
        const last = anchorSessions[0];
        if (last?.type === 'activate' && new Date(last.completedAt) > twentyFourHoursAgo) {
          result[anchor.id] = PRACTICE_COPY.rituals.stabilize.title;
        } else {
          result[anchor.id] = PRACTICE_COPY.rituals.charge.title;
        }
      }
    }
    return result;
  }, [selectableAnchors, sessionLog]);

  const suggestedRitual = useMemo(() => {
    if (!selectedAnchor) return null;
    if (selectedAnchor.isReleased) {
      return { type: 'burn' as const, title: PRACTICE_COPY.rituals.burn.title, subtitle: PRACTICE_COPY.rituals.burn.duration };
    }

    const anchorSessions = sessionLog
      .filter((s) => s.anchorId === selectedAnchor.id)
      .sort((a, b) => toMillis(b.completedAt) - toMillis(a.completedAt));
    const todayKey = localDateKey(new Date());
    const hasAnchorSessionToday = anchorSessions.some((s) => s.completedAt.startsWith(todayKey));

    if (!hasAnchorSessionToday) {
      return { type: 'quickActivate' as const, title: PRACTICE_COPY.rituals.quickActivate.title, subtitle: PRACTICE_COPY.rituals.quickActivate.duration };
    }
    const lastSession = anchorSessions[0];
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (lastSession?.type === 'activate' && new Date(lastSession.completedAt) > twentyFourHoursAgo) {
      return { type: 'stabilize' as const, title: PRACTICE_COPY.rituals.stabilize.title, subtitle: PRACTICE_COPY.rituals.stabilize.duration };
    }

    return {
      type: 'charge' as const,
      title: PRACTICE_COPY.rituals.charge.title,
      subtitle: `${Math.max(DEEP_CHARGE_MINUTES_MIN, Math.round(defaultDeepChargeSeconds / 60))} min`,
    };
  }, [selectedAnchor, sessionLog, defaultDeepChargeSeconds]);

  return (
    <View style={styles.container}>
      <ZenBackground variant="practice" showOrbs={isPracticeTabActive} showGrain showVignette />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
          onTouchStart={markInteraction}
          onScrollBeginDrag={markInteraction}
          scrollEventThrottle={16}
        >
          <Animated.View style={headerStyle}>
            <PracticeHubHeader
              onInfoPress={() => {
                markInteraction();
                setInfoVisible(true);
              }}
            />
          </Animated.View>

          <Animated.View style={heroStyle}>
            <AnchorHero
              anchor={selectedAnchor}
              animationsEnabled={isPracticeTabActive}
              onPress={() => {
                markInteraction();
                setPendingMode(null);
                setSelectorVisible(true);
              }}
            />
          </Animated.View>

          {suggestedRitual && (
            <Animated.View style={portalsStyle}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  markInteraction();
                  runMode(suggestedRitual.type);
                }}
                style={({ pressed }) => [{ marginBottom: spacing.md, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
              >
                <View style={styles.primaryCtaCard}>
                  <View style={styles.primaryCtaLeft}>
                    <Text style={styles.primaryCtaTitle}>{PRACTICE_COPY.primaryCTA}</Text>
                    <Text style={styles.primaryCtaSubtitle}>
                      {suggestedRitual.title} • {suggestedRitual.subtitle}
                    </Text>
                  </View>
                  <View style={styles.primaryCtaIconWrap}>
                    <ChevronRight size={20} color={colors.gold} />
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          )}

          <Animated.View style={[styles.portalsWrap, portalsStyle]}>
            <ModePortalTile
              variant="charge"
              title={PRACTICE_COPY.rituals.charge.title}
              meaning={PRACTICE_COPY.rituals.charge.meaning}
              durationHint={PRACTICE_COPY.rituals.charge.duration}
              icon={<Zap size={16} color={colors.gold} />}
              onPress={() => {
                markInteraction();
                runMode('charge');
              }}
            />
            <View style={styles.portalRow}>
              <ModePortalTile
                style={styles.portalHalf}
                variant="stabilize"
                title={PRACTICE_COPY.rituals.stabilize.title}
                meaning={PRACTICE_COPY.rituals.stabilize.meaning}
                durationHint={PRACTICE_COPY.rituals.stabilize.duration}
                icon={<Wind size={16} color={colors.gold} />}
                onPress={() => {
                  markInteraction();
                  runMode('stabilize');
                }}
              />
              <ModePortalTile
                style={styles.portalHalf}
                variant="burn"
                title={PRACTICE_COPY.rituals.burn.title}
                meaning={PRACTICE_COPY.rituals.burn.meaning}
                durationHint={PRACTICE_COPY.rituals.burn.duration}
                icon={<Flame size={16} color={colors.gold} />}
                onPress={() => {
                  markInteraction();
                  runMode('burn');
                }}
              />
            </View>
          </Animated.View>

          <Animated.View style={threadStyle}>
            <DailyThreadPill
              progressLabel={progressLabel}
              streakDays={Math.max(anchoredStreak, stabilizeStreakDays)}
              onPress={() => {
                markInteraction();
                setThreadVisible(true);
              }}
            />
          </Animated.View>
        </Animated.ScrollView>
      </SafeAreaView>

      <AnchorSelectorSheet
        visible={selectorVisible}
        anchors={selectableAnchors}
        selectedAnchorId={selectedAnchor?.id}
        nextRituals={anchorNextRituals}
        onSelect={handleSelectAnchor}
        onClose={() => {
          setSelectorVisible(false);
          setPendingMode(null);
        }}
      />

      <InfoSheet
        visible={infoVisible}
        onClose={() => {
          setInfoVisible(false);
          markInteraction();
        }}
      />

      <DailyThreadDetailsSheet
        visible={threadVisible}
        onClose={() => setThreadVisible(false)}
        todaySessionsCount={todayPractice.sessionsCount}
        streakDays={Math.max(stabilizeStreakDays, anchoredStreak)}
        sessions={sessionLog}
      />
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  portalsWrap: {
    gap: spacing.sm,
  },
  portalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  portalHalf: {
    flex: 1,
  },
  primaryCtaCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    backgroundColor: 'rgba(26,21,35,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryCtaLeft: {
    flex: 1,
  },
  primaryCtaTitle: {
    fontFamily: typography.fontFamily.serifBold,
    fontSize: 20,
    color: colors.gold,
    letterSpacing: 0.2,
  },
  primaryCtaSubtitle: {
    marginTop: 4,
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    color: colors.text.secondary,
  },
  primaryCtaIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
