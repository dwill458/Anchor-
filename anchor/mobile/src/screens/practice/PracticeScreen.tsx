import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, View, Text, Pressable, Platform, InteractionManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Flame, Zap, ChevronRight } from 'lucide-react-native';
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
import { useSessionStore } from '@/stores/sessionStore';
import type { SessionLogEntry } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { countDailyGoalCompletions } from '@/services/DailyGoalNudgeService';
import { safeHaptics } from '@/utils/haptics';
import { colors, spacing, typography } from '@/theme';
import { PRACTICE_COPY } from '@/constants/copy';
import { PracticeInfoModal } from '@/components/PracticeInfoModal';
import { ThreadStrengthSheet } from '@/components/practice/ThreadStrengthSheet';
import { AnchorHero } from './components/AnchorHero';
import { AnchorSelectorSheet } from './components/AnchorSelectorSheet';
import { DailyGoalProgressCard } from './components/DailyGoalProgressCard';
import { ThreadStrengthBlock, getThreadState } from './components/ThreadStrengthBlock';
// DEFERRED: replaced by PracticeInfoModal to preserve rollback path.
// import { InfoSheet } from './components/InfoSheet';
import { ModePortalTile } from './components/ModePortalTile';
import { PracticeHubHeader } from './components/PracticeHubHeader';
import { resolveBurnArtworkUri } from '@/screens/rituals/utils/resolveBurnArtworkUri';
import { useNotificationController } from '@/hooks/useNotificationController';
import { ConfirmUnchargedBurnSheet } from '@/components/modals/ConfirmUnchargedBurnSheet';

type PracticeNavigationProp = StackNavigationProp<PracticeStackParamList, 'PracticeHome'>;
// DEFERRED: type PendingMode = 'charge' | 'stabilize' | 'burn' | 'quickActivate' | null;
type PendingMode = 'charge' | 'burn' | 'quickActivate' | null;

const AUTO_TEACHING_KEY = 'practice_teaching_auto_seen_v2';
const DEEP_CHARGE_MINUTES_MIN = 2;
const DEEP_CHARGE_MINUTES_MAX = 30;
const FOCUS_SESSION_TITLE = 'FOCUS SESSION';

function getDefaultDeepChargeSeconds(primeSessionDuration: number): number {
  return Math.min(
    DEEP_CHARGE_MINUTES_MAX * 60,
    Math.max(DEEP_CHARGE_MINUTES_MIN * 60, Math.round(primeSessionDuration))
  );
}

function toMillis(value?: Date | string): number {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function engagementRecency(anchor: Anchor): number {
  return Math.max(toMillis(anchor.lastActivatedAt), toMillis(anchor.chargedAt));
}

function toModeFromSessionType(type: SessionLogEntry['type']): Exclude<PendingMode, null> {
  if (type === 'activate') return 'quickActivate';
  // DEFERRED: if (type === 'stabilize') return 'stabilize';
  return 'charge';
}

function toModeTitle(mode: Exclude<PendingMode, null>): string {
  if (mode === 'quickActivate') return FOCUS_SESSION_TITLE;
  // DEFERRED: if (mode === 'stabilize') return PRACTICE_COPY.rituals.stabilize.title;
  if (mode === 'burn') return PRACTICE_COPY.rituals.burn.title;
  return PRACTICE_COPY.rituals.charge.title;
}

export const PracticeScreen: React.FC = () => {
  useNotificationController();

  const navigation = useNavigation<PracticeNavigationProp>();
  const { navigateToVault, registerTabNav, activeTabIndex } = useTabNavigation();
  const isPracticeTabActive = activeTabIndex == null ? true : activeTabIndex === 1;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const anchors = useAnchorStore((state) => state.anchors);
  const currentAnchorId = useAnchorStore((state) => state.currentAnchorId);
  const setCurrentAnchor = useAnchorStore((state) => state.setCurrentAnchor);
  const primeSessionDuration = useSettingsStore((state) => state.primeSessionDuration ?? 120);
  const focusSessionDuration = useSettingsStore((state) => state.focusSessionDuration ?? 30);
  const dailyPracticeGoal = useSettingsStore((state) => state.dailyPracticeGoal ?? 3);
  const {
    sessionLog,
    threadStrength,
    totalSessionsCount,
    lastPrimedAt,
    weekHistory,
    applyDecay,
  } = useSessionStore();

  const [selectorVisible, setSelectorVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [pendingMode, setPendingMode] = useState<PendingMode>(null);
  const [autoTeachingSeen, setAutoTeachingSeen] = useState<boolean | null>(null);
  const [confirmUnchargedBurnVisible, setConfirmUnchargedBurnVisible] = useState(false);
  const [threadSheetVisible, setThreadSheetVisible] = useState(false);

  useEffect(() => {
    registerTabNav(1, navigation as any);
    return () => registerTabNav(1, null);
  }, [navigation, registerTabNav]);

  const selectableAnchors = useMemo(
    () =>
      anchors
        .filter((a) => !a.isReleased && !a.archivedAt)
        .sort((a, b) => {
          const activityDelta = engagementRecency(b) - engagementRecency(a);
          if (activityDelta !== 0) return activityDelta;
          return toMillis(b.createdAt) - toMillis(a.createdAt);
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

      // Only auto-select if no anchor is currently selected (or selected anchor was deleted)
      const currentIsValid = currentAnchorId && selectableAnchors.some((a) => a.id === currentAnchorId);
      if (!currentIsValid && mostRecentAnchor) {
        setCurrentAnchor(mostRecentAnchor.id);
      }
      return () => undefined;
    }, [selectableAnchors, currentAnchorId, mostRecentAnchor, setCurrentAnchor])
  );

  const selectedAnchor = useMemo(
    () => selectableAnchors.find((anchor) => anchor.id === currentAnchorId) ?? mostRecentAnchor,
    [selectableAnchors, mostRecentAnchor, currentAnchorId]
  );

  const threadState = getThreadState(threadStrength, lastPrimedAt);
  const hasPrimedToday = lastPrimedAt === localDateString(new Date());
  const todayMode: 'focusSession' | 'deepPrime' = threadStrength < 40 ? 'focusSession' : 'deepPrime';
  const ctaTitle = PRACTICE_COPY.primaryCTA;
  const ctaSubtitle = todayMode === 'focusSession'
    ? 'Focus Session · 10–60 sec'
    : 'Deep Prime · 2 min to custom';

  const defaultDeepChargeSeconds = useMemo(
    () => getDefaultDeepChargeSeconds(primeSessionDuration),
    [primeSessionDuration]
  );
  const completedGoalSessions = useMemo(
    () => countDailyGoalCompletions(sessionLog),
    [sessionLog]
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

  // Apply thread strength decay on each screen focus
  useFocusEffect(
    useCallback(() => {
      applyDecay();
      return () => undefined;
    }, [applyDecay])
  );

  const headerAnim = useSharedValue(0);
  const threadAnim = useSharedValue(0);
  const heroAnim = useSharedValue(0);
  const portalsAnim = useSharedValue(0);
  const hasAnimatedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!isPracticeTabActive) return () => undefined;
      if (reduceMotion) {
        headerAnim.value = 1;
        threadAnim.value = 1;
        heroAnim.value = 1;
        portalsAnim.value = 1;
        return () => undefined;
      }
      if (hasAnimatedRef.current) return () => undefined;
      hasAnimatedRef.current = true;
      const timing = { duration: 360, easing: Easing.out(Easing.cubic) };
      headerAnim.value = withDelay(0, withTiming(1, timing));
      threadAnim.value = withDelay(60, withTiming(1, timing));
      heroAnim.value = withDelay(130, withTiming(1, timing));
      portalsAnim.value = withDelay(200, withTiming(1, timing));
      return () => undefined;
    }, [headerAnim, threadAnim, heroAnim, isPracticeTabActive, portalsAnim, reduceMotion])
  );

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerAnim.value,
    transform: [{ translateY: (1 - headerAnim.value) * 12 }],
  }));
  const threadStyle = useAnimatedStyle(() => ({
    opacity: threadAnim.value,
    transform: [{ translateY: (1 - threadAnim.value) * 10 }],
  }));
  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroAnim.value,
    transform: [{ translateY: (1 - heroAnim.value) * 12 }],
  }));
  const portalsStyle = useAnimatedStyle(() => ({
    opacity: portalsAnim.value,
    transform: [{ translateY: (1 - portalsAnim.value) * 12 }],
  }));

  const startCharge = useCallback(
    (anchor: Anchor, durationSecondsOverride?: number) => {
      safeHaptics.selection();
      navigateToVault('Ritual', {
        anchorId: anchor.id,
        ritualType: 'ritual',
        durationSeconds: durationSecondsOverride ?? defaultDeepChargeSeconds,
        returnTo: 'practice',
      });
    },
    [defaultDeepChargeSeconds, navigateToVault]
  );

  const startQuickActivate = useCallback(
    (anchor: Anchor, durationOverride = focusSessionDuration) => {
      safeHaptics.selection();
      navigateToVault('ActivationRitual', {
        anchorId: anchor.id,
        activationType: 'visual',
        durationOverride,
        returnTo: 'practice',
      });
    },
    [focusSessionDuration, navigateToVault]
  );

  const startBurn = useCallback(
    (anchor: Anchor) => {
      safeHaptics.selection();
      if (!anchor.isCharged) {
        setConfirmUnchargedBurnVisible(true);
        return;
      }
      executeBurn(anchor);
    },
    []
  );

  const executeBurn = useCallback(
    (anchor: Anchor) => {
      setConfirmUnchargedBurnVisible(false);
      navigateToVault('ConfirmBurn', {
        anchorId: anchor.id,
        intention: anchor.intentionText ?? (anchor as Anchor & { intention?: string }).intention ?? '',
        sigilSvg: anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg ?? '',
        enhancedImageUrl: resolveBurnArtworkUri(anchor),
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
      } else if (mode === 'quickActivate') {
        startQuickActivate(target);
      } else {
        startBurn(target);
      }
    },
    [selectedAnchor, startBurn, startCharge, startQuickActivate]
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
      setCurrentAnchor(anchor.id);

      const applySelection = () => {
        // Changing the current anchor from the hero should only refresh the
        // practice state. If the selector was opened from a mode tile, continue
        // into that explicitly requested ritual for the chosen anchor.
        if (pendingModeSelection) {
          runMode(pendingModeSelection, anchor);
        }
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
    [markInteraction, pendingMode, runMode, setCurrentAnchor]
  );

  const anchorNextRituals = useMemo<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const anchor of selectableAnchors) {
      const anchorSessions = sessionLog
        .filter((s) => s.anchorId === anchor.id)
        .sort((a, b) => toMillis(b.completedAt) - toMillis(a.completedAt));
      const last = anchorSessions[0];
      result[anchor.id] = last ? toModeTitle(toModeFromSessionType(last.type)) : FOCUS_SESSION_TITLE;
    }
    return result;
  }, [selectableAnchors, sessionLog]);

  const latestAnchorSession = useMemo<SessionLogEntry | null>(() => {
    if (!selectedAnchor) return null;
    const anchorSessions = sessionLog
      .filter((s) => s.anchorId === selectedAnchor.id)
      .sort((a, b) => toMillis(b.completedAt) - toMillis(a.completedAt));
    return anchorSessions[0] ?? null;
  }, [selectedAnchor, sessionLog]);

  const runQuickRestartFromSession = useCallback(
    (session: SessionLogEntry, anchor?: Anchor) => {
      const target = anchor ?? selectedAnchor;
      const mode = toModeFromSessionType(session.type);

      if (!target) {
        setPendingMode(mode);
        setSelectorVisible(true);
        return;
      }

      if (session.type === 'reinforce') {
        const restartDuration = Math.max(30, Math.min(1800, Math.round(session.durationSeconds || defaultDeepChargeSeconds)));
        startCharge(target, restartDuration);
        return;
      }

      if (session.type === 'activate') {
        const restartDuration = Math.max(10, Math.min(600, Math.round(session.durationSeconds || 30)));
        startQuickActivate(target, restartDuration);
        return;
      }

      startCharge(target);
    },
    [defaultDeepChargeSeconds, selectedAnchor, startCharge, startQuickActivate]
  );

  const isFading = threadState === 'fading';

  const suggestedRitual = useMemo(() => {
    if (!selectedAnchor) return null;
    if (selectedAnchor.isReleased) {
      return { type: 'burn' as const, title: PRACTICE_COPY.rituals.burn.title, subtitle: PRACTICE_COPY.rituals.burn.duration };
    }

    if (latestAnchorSession) {
      const type = toModeFromSessionType(latestAnchorSession.type);
      return {
        type,
        title: toModeTitle(type),
        subtitle: 'Quick restart',
      };
    }

    return {
      type: 'quickActivate' as const,
      title: FOCUS_SESSION_TITLE,
      subtitle: PRACTICE_COPY.rituals.quickActivate.duration,
    };
  }, [latestAnchorSession, selectedAnchor]);

  return (
    <View style={styles.container}>
      <ZenBackground variant="practice" showOrbs={isPracticeTabActive} showGrain showVignette />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
          onTouchStart={markInteraction}
          onScrollBeginDrag={markInteraction}
        >
          <Animated.View style={headerStyle}>
            <PracticeHubHeader
              onInfoPress={() => {
                markInteraction();
                setInfoVisible(true);
              }}
            />
          </Animated.View>

          <Animated.View style={threadStyle}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View thread strength history"
              onPress={() => {
                markInteraction();
                setThreadSheetVisible(true);
              }}
              style={({ pressed }) => [
                styles.threadPressable,
                pressed && styles.threadPressablePressed,
              ]}
            >
              <ThreadStrengthBlock
                threadStrength={threadStrength}
                totalSessionsCount={totalSessionsCount}
                lastPrimedAt={lastPrimedAt}
                weekHistory={weekHistory}
                anchor={selectedAnchor}
              />
              <Text style={styles.threadViewHint}>VIEW ▾</Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={threadStyle}>
            <DailyGoalProgressCard
              completedCount={completedGoalSessions}
              goal={dailyPracticeGoal}
            />
          </Animated.View>

          <Animated.View style={heroStyle}>
            <AnchorHero
              anchor={selectedAnchor}
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
                  runMode(todayMode === 'focusSession' ? 'quickActivate' : 'charge');
                }}
                style={({ pressed }) => [
                  styles.ctaPressable,
                  { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                {isFading ? (
                  <View style={[styles.ctaButton, styles.ctaButtonFading]}>
                    <View style={styles.ctaLeft}>
                      <Text style={[styles.ctaLabel, styles.ctaLabelFading]}>TODAY'S PRACTICE</Text>
                      <Text style={[styles.ctaTitle, styles.ctaTitleFading]}>{ctaTitle}</Text>
                      <Text style={[styles.ctaSubtitle, styles.ctaSubtitleFading]}>{ctaSubtitle}</Text>
                    </View>
                    <View style={[styles.ctaArrow, styles.ctaArrowFading]}>
                      <ChevronRight size={18} color="#3a3a4a" />
                    </View>
                  </View>
                ) : (
                  <LinearGradient
                    colors={[
                      colors.practice.ctaGradientStart,
                      colors.practice.ctaGradientMid,
                      colors.practice.ctaGradientEnd,
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ctaButton}
                  >
                    <View style={styles.ctaLeft}>
                      <Text style={styles.ctaLabel}>TODAY'S PRACTICE</Text>
                      <Text style={styles.ctaTitle}>{ctaTitle}</Text>
                      <Text style={styles.ctaSubtitle}>{ctaSubtitle}</Text>
                    </View>
                    <View style={styles.ctaArrow}>
                      <ChevronRight size={18} color={colors.practice.ctaTextPrimary} />
                    </View>
                  </LinearGradient>
                )}
              </Pressable>
            </Animated.View>
          )}

          <Animated.View style={[styles.portalsWrap, portalsStyle]}>
            <Text style={styles.sectionLabel}>Other modes</Text>
            <ModePortalTile
              variant="charge"
              title={PRACTICE_COPY.rituals.charge.title}
              meaning={PRACTICE_COPY.rituals.charge.meaning}
              durationHint={PRACTICE_COPY.rituals.charge.duration}
              durationNode={
                <>
                  {'2 mins to '}
                  <Text style={{ color: '#D4AF37', textDecorationLine: 'underline' }}>custom</Text>
                </>
              }
              icon={<Zap size={16} color={colors.gold} />}
              onPress={() => {
                markInteraction();
                runMode('charge');
              }}
            />
            <ModePortalTile
              variant="stabilize"
              title={FOCUS_SESSION_TITLE}
              meaning={PRACTICE_COPY.rituals.quickActivate.meaning}
              durationHint={PRACTICE_COPY.rituals.quickActivate.duration}
              icon={<Zap size={16} color={colors.gold} />}
              onPress={() => {
                markInteraction();
                runMode('quickActivate');
              }}
            />
            <ModePortalTile
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

      <ThreadStrengthSheet
        visible={threadSheetVisible}
        onClose={() => setThreadSheetVisible(false)}
      />

      {/* DEFERRED: previous practice teaching sheet retained for rollback.
      <InfoSheet
        visible={infoVisible}
        onClose={() => {
          setInfoVisible(false);
          markInteraction();
        }}
      />
      */}
      
      <ConfirmUnchargedBurnSheet
        visible={confirmUnchargedBurnVisible}
        onConfirm={() => selectedAnchor && executeBurn(selectedAnchor)}
        onCancel={() => setConfirmUnchargedBurnVisible(false)}
        intentionText={selectedAnchor?.intentionText}
      />

      <PracticeInfoModal
        isVisible={infoVisible}
        onDismiss={() => {
          setInfoVisible(false);
          markInteraction();
        }}
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
  threadPressable: {
    position: 'relative',
  },
  threadPressablePressed: {
    opacity: 0.92,
  },
  threadViewHint: {
    position: 'absolute',
    top: 14,
    right: 16,
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(212,175,55,0.5)',
  },
  ctaPressable: {
    marginBottom: spacing.md,
  },
  ctaButton: {
    borderRadius: 18,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#070a10',
    shadowColor: colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  ctaLeft: {
    flex: 1,
  },
  ctaLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 11,
    letterSpacing: 2.5,
    color: colors.practice.ctaTextSecondary,
    marginBottom: 3,
  },
  ctaTitle: {
    fontFamily: typography.fontFamily.serifBold,
    fontSize: 20,
    color: colors.practice.ctaTextPrimary,
    letterSpacing: 1,
  },
  ctaSubtitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    color: colors.practice.ctaTextTertiary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  ctaArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.practice.ctaArrowSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonFading: {
    backgroundColor: '#1e2028',
    borderWidth: 1,
    borderColor: '#2a2a38',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaLabelFading: {
    color: '#555a6a',
  },
  ctaTitleFading: {
    color: '#3a3a4a',
  },
  ctaSubtitleFading: {
    color: '#3a3a4a',
  },
  ctaArrowFading: {
    backgroundColor: '#2a2a38',
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.bronze,
    marginBottom: spacing.sm,
    paddingLeft: 2,
  },
});
