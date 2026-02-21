import React, { useCallback, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Flame, Wind, Zap } from 'lucide-react-native';
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
import { useSettingsStore } from '@/stores/settingsStore';
import { safeHaptics } from '@/utils/haptics';
import { calculateStreakWithGrace } from '@/utils/streak';
import { getEffectiveStabilizeStreakDays, toDateOrNull } from '@/utils/stabilizeStats';
import { colors, spacing } from '@/theme';
import { AnchorHero } from './components/AnchorHero';
import { AnchorSelectorSheet } from './components/AnchorSelectorSheet';
import { DailyThreadDetailsSheet } from './components/DailyThreadDetailsSheet';
import { DailyThreadPill } from './components/DailyThreadPill';
import { InfoSheet } from './components/InfoSheet';
import { ModePortalTile } from './components/ModePortalTile';
import { PracticeHubHeader } from './components/PracticeHubHeader';

type PracticeNavigationProp = StackNavigationProp<PracticeStackParamList, 'PracticeHome'>;
type PendingMode = 'charge' | 'stabilize' | 'burn' | null;

const AUTO_TEACHING_KEY = 'practice_teaching_auto_seen_v2';

function toMillis(value?: Date | string): number {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export const PracticeScreen: React.FC = () => {
  const navigation = useNavigation<PracticeNavigationProp>();
  const { navigateToVault } = useTabNavigation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { getActiveAnchors } = useAnchorStore();
  const user = useAuthStore((state) => state.user);
  const { defaultActivation } = useSettingsStore();
  const { todayPractice, sessionLog, lastGraceDayUsedAt } = useSessionStore();

  const [selectedAnchorId, setSelectedAnchorId] = useState<string | undefined>(undefined);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [threadVisible, setThreadVisible] = useState(false);
  const [pendingMode, setPendingMode] = useState<PendingMode>(null);
  const [autoTeachingSeen, setAutoTeachingSeen] = useState<boolean | null>(null);

  const activeAnchors = getActiveAnchors();
  const mostRecentAnchor = useMemo(() => {
    if (activeAnchors.length === 0) return undefined;
    return [...activeAnchors].sort((a, b) => {
      const aRecency = Math.max(toMillis(a.lastActivatedAt), toMillis(a.updatedAt), toMillis(a.createdAt));
      const bRecency = Math.max(toMillis(b.lastActivatedAt), toMillis(b.updatedAt), toMillis(b.createdAt));
      return bRecency - aRecency;
    })[0];
  }, [activeAnchors]);

  useFocusEffect(
    useCallback(() => {
      if (activeAnchors.length === 0) {
        setSelectedAnchorId(undefined);
        return () => undefined;
      }
      setSelectedAnchorId((current) => {
        if (current && activeAnchors.some((anchor) => anchor.id === current)) {
          return current;
        }
        return mostRecentAnchor?.id;
      });
      return () => undefined;
    }, [activeAnchors, mostRecentAnchor?.id])
  );

  const selectedAnchor = useMemo(
    () => activeAnchors.find((anchor) => anchor.id === selectedAnchorId) ?? mostRecentAnchor,
    [activeAnchors, mostRecentAnchor, selectedAnchorId]
  );

  const progressLabel = todayPractice.sessionsCount > 0 ? '1/1' : '0/1';
  const anchoredStreak = calculateStreakWithGrace(sessionLog, lastGraceDayUsedAt).currentStreak;
  const lastStabilizeAt = toDateOrNull(user?.lastStabilizeAt);
  const stabilizeStreakDays = getEffectiveStabilizeStreakDays(
    user?.stabilizeStreakDays ?? 0,
    lastStabilizeAt,
    new Date()
  );

  const clampedSeconds = useMemo(() => {
    const raw =
      defaultActivation.unit === 'seconds'
        ? defaultActivation.value
        : defaultActivation.unit === 'minutes'
          ? defaultActivation.value * 60
          : 30;
    return Math.max(10, Math.min(600, Math.round(raw || 30)));
  }, [defaultActivation.unit, defaultActivation.value]);

  const interactionRef = useRef(false);
  const firstVisitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hesitationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPlayedFirstAutoRef = useRef(false);

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
    }, [autoTeachingSeen, clearTeachingTimers, openAutoTeaching])
  );

  const headerAnim = useSharedValue(0);
  const heroAnim = useSharedValue(0);
  const portalsAnim = useSharedValue(0);
  const threadAnim = useSharedValue(0);
  const hasAnimatedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
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
    }, [headerAnim, heroAnim, portalsAnim, reduceMotion, threadAnim])
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
      navigateToVault('ActivationRitual', {
        anchorId: anchor.id,
        activationType: 'visual',
        durationOverride: clampedSeconds,
        returnTo: 'practice',
      });
    },
    [clampedSeconds, navigateToVault]
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
      } else {
        startBurn(target);
      }
    },
    [selectedAnchor, startBurn, startCharge, startStabilize]
  );

  const handleSelectAnchor = useCallback(
    (anchor: Anchor) => {
      markInteraction();
      setSelectedAnchorId(anchor.id);
      setSelectorVisible(false);
      if (pendingMode) {
        runMode(pendingMode, anchor);
        setPendingMode(null);
      }
    },
    [markInteraction, pendingMode, runMode]
  );

  return (
    <View style={styles.container}>
      <ZenBackground variant="practice" showOrbs showGrain showVignette />

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
              onPress={() => {
                markInteraction();
                setPendingMode(null);
                setSelectorVisible(true);
              }}
            />
          </Animated.View>

          <Animated.View style={[styles.portalsWrap, portalsStyle]}>
            <ModePortalTile
              variant="charge"
              title="CHARGE"
              meaning="Imprint the symbol into attention."
              durationHint="10 sec to 10 min"
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
                title="STABILIZE"
                meaning="Settle the intent. Make it steady."
                durationHint="30 sec to 3 min"
                icon={<Wind size={16} color={colors.gold} />}
                onPress={() => {
                  markInteraction();
                  runMode('stabilize');
                }}
              />
              <ModePortalTile
                style={styles.portalHalf}
                variant="burn"
                title="BURN & RELEASE"
                meaning="Close the loop. Release the hold."
                durationHint="45 sec to 2 min"
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
        anchors={activeAnchors}
        selectedAnchorId={selectedAnchor?.id}
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
});
