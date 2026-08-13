import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
  InteractionManager,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from "@react-navigation/stack";
import { Eye, Flame, Zap, ChevronRight } from "lucide-react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { Anchor, PracticeStackParamList } from '@/types';
import type { PracticeEntrySource } from '@/types/practice';
import { ZenBackground } from '@/components/common';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { SessionLogEntry } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useLocationPrimingStore } from '@/stores/locationPrimingStore';
import type { LocationPrimingSuggestion } from '@/utils/locationPriming';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import AuthHydrationService from '@/services/AuthHydrationService';
import { safeHaptics } from '@/utils/haptics';
import { colors, spacing, typography } from '@/theme';
import { PRACTICE_COPY } from '@/constants/copy';
import { PracticeInfoModal } from '@/components/PracticeInfoModal';
import { AnchorSelectorSheet } from './components/AnchorSelectorSheet';
import { getThreadState } from './components/ThreadStrengthBlock';
// DEFERRED: replaced by PracticeInfoModal to preserve rollback path — remove post-launch.
// import { InfoSheet } from './components/InfoSheet';
import { ModePortalTile } from './components/ModePortalTile';
import { PracticeHubHeader } from './components/PracticeHubHeader';
import { resolveBurnArtworkUri } from '@/screens/rituals/utils/resolveBurnArtworkUri';
import { useAppPerformanceTier } from '@/hooks/useAppPerformanceTier';
import { useNotificationController } from '@/hooks/useNotificationController';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { usePracticeEntry } from '@/hooks/usePracticeEntry';
import { ENABLE_VISUALIZE } from '@/config';
import { ConfirmUnchargedBurnSheet } from '@/components/modals/ConfirmUnchargedBurnSheet';
import {
  DEFAULT_SESSION_AUDIO_DEFAULTS,
  resolveSessionAudioConfiguration,
  type SessionAudioDefaults,
} from "@/types/sessionAudio";
import { usePracticeMetrics } from "@/hooks/usePracticeMetrics";
import { PracticeOverviewCard } from "./components/PracticeOverviewCard";

type PracticeNavigationProp = StackNavigationProp<
  PracticeStackParamList,
  "PracticeHome"
>;
// DEFERRED: type PendingMode = 'charge' | 'stabilize' | 'burn' | 'quickActivate' | null; — restore post-launch
type PendingMode = "charge" | "burn" | "quickActivate" | "visualize" | null;
type PracticeToolMode = Exclude<PendingMode, null>;

const AUTO_TEACHING_KEY = "practice_teaching_auto_seen_v2";
const DEEP_CHARGE_MINUTES_MIN = 2;
const DEEP_CHARGE_MINUTES_MAX = 30;
const FOCUS_SESSION_TITLE = "FOCUS SESSION";

function formatSuggestedDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} sec`;
  }

  return `${Math.round(seconds / 60)} min`;
}

function getDefaultDeepChargeSeconds(primeSessionDuration: number): number {
  return Math.min(
    DEEP_CHARGE_MINUTES_MAX * 60,
    Math.max(DEEP_CHARGE_MINUTES_MIN * 60, Math.round(primeSessionDuration)),
  );
}

function toMillis(value?: Date | string): number {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function engagementRecency(anchor: Anchor): number {
  return Math.max(toMillis(anchor.lastActivatedAt), toMillis(anchor.chargedAt));
}

function toModeFromSessionType(
  type: SessionLogEntry["type"],
): Exclude<PendingMode, null> {
  if (type === "activate") return "quickActivate";
  if (type === "visualize") return "visualize";
  // DEFERRED: if (type === 'stabilize') return 'stabilize'; — restore post-launch
  return "charge";
}

function toModeTitle(mode: Exclude<PendingMode, null>): string {
  if (mode === "quickActivate") return FOCUS_SESSION_TITLE;
  // DEFERRED: if (mode === 'stabilize') return PRACTICE_COPY.rituals.stabilize.title; — restore post-launch
  if (mode === "burn") return PRACTICE_COPY.rituals.burn.title;
  if (mode === "visualize") return "VISUALIZE";
  return PRACTICE_COPY.rituals.charge.title;
}

export const PracticeScreen: React.FC = () => {
  useNotificationController();

  const navigation = useNavigation<PracticeNavigationProp>();
  const route = useRoute<RouteProp<PracticeStackParamList, 'PracticeHome'>>();
  const { navigateToPaywall, registerTabNav, activeTabIndex } = useTabNavigation();
  const isPracticeTabActive = activeTabIndex == null ? true : activeTabIndex === 1;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const performanceTier = useAppPerformanceTier();
  const anchors = useAnchorStore((state) => state.anchors);
  const currentAnchorId = useAnchorStore((state) => state.currentAnchorId);
  const setCurrentAnchor = useAnchorStore((state) => state.setCurrentAnchor);
  const primeSessionDuration = useSettingsStore(
    (state) => state.primeSessionDuration ?? 120,
  );
  const focusSessionDuration = useSettingsStore(
    (state) => state.focusSessionDuration ?? 30,
  );
  const sessionAudioDefaults = useSettingsStore(
    (state) => state.sessionAudioDefaults ?? DEFAULT_SESSION_AUDIO_DEFAULTS,
  );
  const resolveLocationPrimingSuggestion = useLocationPrimingStore(
    (state) => state.resolveActiveSuggestion,
  );
  const sessionLog = useSessionStore((s) => s.sessionLog);
  const threadStrength = useSessionStore((s) => s.threadStrength);
  const lastPrimedAt = useSessionStore((s) => s.lastPrimedAt);
  const applyDecay = useSessionStore((s) => s.applyDecay);
  const primingHistory = useSessionStore((s) => s.primingHistory);
  const visualizeAccess = useTrialStatus();
  const practiceMetrics = usePracticeMetrics();
  const {
    startPractice,
    isNavigationLocked,
    releaseNavigationLock,
  } = usePracticeEntry();

  // Self-healing thread/progress restore: if priming history is empty (e.g. a
  // failed/empty launch hydration), re-fetch the account export and rehydrate
  // the session store so thread counts/strength reappear without depending on
  // launch-time hydration. Runs at most once per mount.
  const didAttemptThreadRehydrateRef = useRef(false);
  useEffect(() => {
    const hasCanonicalStats = practiceMetrics.totalSessions > 0;
    if (hasCanonicalStats || didAttemptThreadRehydrateRef.current) {
      return;
    }
    didAttemptThreadRehydrateRef.current = true;
    void AuthHydrationService.rehydrateSessionFromExport();
  }, [practiceMetrics.totalSessions]);

  const [selectorVisible, setSelectorVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [pendingMode, setPendingMode] = useState<PendingMode>(null);
  const [pendingSource, setPendingSource] = useState<PracticeEntrySource | null>(null);
  const [selectedMode, setSelectedMode] = useState<PracticeToolMode>('quickActivate');
  const [autoTeachingSeen, setAutoTeachingSeen] = useState<boolean | null>(null);
  const [confirmUnchargedBurnVisible, setConfirmUnchargedBurnVisible] = useState(false);
  const [locationPrimingSuggestion, setLocationPrimingSuggestion] =
    useState<LocationPrimingSuggestion | null>(null);

  useEffect(() => {
    if (ENABLE_VISUALIZE) {
      AnalyticsService.track(AnalyticsEvents.VISUALIZE_CARD_VIEWED, {
        tier: visualizeAccess.subscriptionStatus,
      });
    }
  }, [visualizeAccess.subscriptionStatus]);

  useEffect(() => {
    registerTabNav(1, navigation);
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
    [anchors],
  );

  useEffect(() => {
    const requestedAnchorId = route.params?.anchorId;
    if (requestedAnchorId && selectableAnchors.some((anchor) => anchor.id === requestedAnchorId)) {
      setCurrentAnchor(requestedAnchorId);
    }
  }, [route.params?.anchorId, selectableAnchors, setCurrentAnchor]);

  const mostRecentAnchor = useMemo(() => {
    if (selectableAnchors.length === 0) return undefined;
    return selectableAnchors[0];
  }, [selectableAnchors]);

  useFocusEffect(
    useCallback(() => {
      releaseNavigationLock();
      return () => undefined;
    }, [activeTabIndex, releaseNavigationLock])
  );

  useFocusEffect(
    useCallback(() => {
      if (selectableAnchors.length === 0) {
        setCurrentAnchor(undefined);
        return () => undefined;
      }

      // Only auto-select if no anchor is currently selected (or selected anchor was deleted)
      const currentIsValid =
        currentAnchorId &&
        selectableAnchors.some((a) => a.id === currentAnchorId);
      if (!currentIsValid && mostRecentAnchor) {
        setCurrentAnchor(mostRecentAnchor.id);
      }
      return () => undefined;
    }, [
      selectableAnchors,
      currentAnchorId,
      mostRecentAnchor,
      setCurrentAnchor,
    ]),
  );

  const selectedAnchor = useMemo(
    () =>
      selectableAnchors.find((anchor) => anchor.id === currentAnchorId) ??
      mostRecentAnchor,
    [selectableAnchors, mostRecentAnchor, currentAnchorId],
  );

  // A new Anchor starts with the shortest return; an established Anchor opens
  // on its deeper default. Selecting a tool remains an explicit user choice.
  useEffect(() => {
    setSelectedMode(selectedAnchor?.isCharged ? 'charge' : 'quickActivate');
  }, [selectedAnchor?.id]);

  const threadState = getThreadState(threadStrength, lastPrimedAt);
  const isFading = threadState === "fading";
  const hasPrimedToday = lastPrimedAt === localDateString(new Date());
  const locationPreset = locationPrimingSuggestion?.zone.preset;
  const todayMode: "focusSession" | "deepPrime" =
    locationPreset?.sessionType === "focus"
      ? "focusSession"
      : locationPreset?.sessionType === "prime"
        ? "deepPrime"
        : threadStrength < 40
          ? "focusSession"
          : "deepPrime";
  const ctaTitle = locationPrimingSuggestion
    ? `Prime at ${locationPrimingSuggestion.zone.label}`
    : isFading
      ? "Restore Thread"
      : PRACTICE_COPY.primaryCTA;
  const ctaSubtitle = locationPreset
    ? `${locationPreset.sessionType === "focus" ? "Focus Session" : "Deep Prime"} · ${formatSuggestedDuration(locationPreset.durationSeconds)}`
    : isFading
      ? todayMode === "focusSession"
        ? "Focus Session · 10–60 sec to restore"
        : "Deep Prime · 2 min to restore"
      : todayMode === "focusSession"
        ? "Focus Session · 10–60 sec"
        : "Deep Prime · 2 min to custom";

  const defaultDeepChargeSeconds = useMemo(
    () => getDefaultDeepChargeSeconds(primeSessionDuration),
    [primeSessionDuration],
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
      await AsyncStorage.setItem(AUTO_TEACHING_KEY, "1");
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
          if (mounted) setAutoTeachingSeen(value === "1");
        } catch (_error) {
          if (mounted) setAutoTeachingSeen(false);
        }
      };
      void load();
      return () => {
        mounted = false;
      };
    }, []),
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
    }, [
      autoTeachingSeen,
      clearTeachingTimers,
      isPracticeTabActive,
      openAutoTeaching,
    ]),
  );

  // Apply thread strength decay on each screen focus
  useFocusEffect(
    useCallback(() => {
      applyDecay();
      return () => undefined;
    }, [applyDecay]),
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      resolveLocationPrimingSuggestion()
        .then((suggestion) => {
          if (isActive) {
            setLocationPrimingSuggestion(suggestion);
          }
        })
        .catch(() => {
          if (isActive) {
            setLocationPrimingSuggestion(null);
          }
        });

      return () => {
        isActive = false;
      };
    }, [resolveLocationPrimingSuggestion]),
  );

  const headerAnim = useSharedValue(0);
  const threadAnim = useSharedValue(0);
  const heroAnim = useSharedValue(0);
  const portalsAnim = useSharedValue(0);
  const hasAnimatedRef = useRef(false);
  const shouldAnimateIntro = !reduceMotion && performanceTier === "high";

  useFocusEffect(
    useCallback(() => {
      if (!isPracticeTabActive) return () => undefined;
      if (!shouldAnimateIntro) {
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
    }, [
      headerAnim,
      threadAnim,
      heroAnim,
      isPracticeTabActive,
      portalsAnim,
      shouldAnimateIntro,
    ]),
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
    (
      anchor: Anchor,
      durationSecondsOverride?: number,
      audioOverride?: SessionAudioDefaults,
      source: 'practice_hero' | 'practice_deep_prime_card' = 'practice_deep_prime_card'
    ) => {
      const started = startPractice({
        mode: 'deepPrime',
        anchorId: anchor.id,
        source,
        durationSeconds: durationSecondsOverride,
        audioConfiguration: audioOverride
          ? resolveSessionAudioConfiguration(sessionAudioDefaults.deep_prime, audioOverride)
          : undefined,
      });
      if (started) safeHaptics.selection();
      return started;
    },
    [sessionAudioDefaults.deep_prime, startPractice]
  );

  const startQuickActivate = useCallback(
    (
      anchor: Anchor,
      durationOverride = focusSessionDuration,
      audioOverride?: SessionAudioDefaults,
      source: 'practice_hero' | 'practice_focus_card' = 'practice_focus_card'
    ) => {
      const started = startPractice({
        mode: 'focus',
        anchorId: anchor.id,
        source,
        durationSeconds: durationOverride,
        audioConfiguration: audioOverride
          ? resolveSessionAudioConfiguration(sessionAudioDefaults.focus, audioOverride)
          : undefined,
      });
      if (started) safeHaptics.selection();
      return started;
    },
    [focusSessionDuration, sessionAudioDefaults.focus, startPractice]
  );

  const executeBurn = useCallback(
    (anchor: Anchor, source: PracticeEntrySource = 'practice_release_card') => {
      setConfirmUnchargedBurnVisible(false);
      startPractice({
        mode: 'release',
        anchorId: anchor.id,
        source,
        intention:
          anchor.intentionText ?? (anchor as Anchor & { intention?: string }).intention ?? '',
        sigilSvg: anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg ?? '',
        enhancedImageUrl: resolveBurnArtworkUri(anchor),
      });
    },
    [startPractice]
  );

  const startBurn = useCallback(
    (anchor: Anchor, source: PracticeEntrySource = 'practice_release_card') => {
      safeHaptics.selection();
      if (!anchor.isCharged) {
        setConfirmUnchargedBurnVisible(true);
        return;
      }
      executeBurn(anchor, source);
    },
    [executeBurn]
  );

  const runMode = useCallback(
    (
      mode: Exclude<PendingMode, null>,
      anchor?: Anchor,
      source: PracticeEntrySource = 'practice_deep_prime_card'
    ) => {
      const target = anchor ?? selectedAnchor;
      if (!target) {
        setPendingMode(mode);
        setPendingSource(source);
        setSelectorVisible(true);
        return;
      }
      if (mode === 'charge') {
        // ChargeSetup is only for choosing a duration on an anchor's first
        // prime. Once it's been charged before, Deep Prime should drop
        // straight into the ritual using the saved default duration.
        startCharge(
          target,
          target.isCharged ? primeSessionDuration : undefined,
          undefined,
          source === 'practice_hero' ? source : 'practice_deep_prime_card'
        );
      } else if (mode === 'quickActivate') {
        startQuickActivate(target, focusSessionDuration, undefined, source === 'practice_hero' ? source : 'practice_focus_card');
      } else if (mode === 'visualize') {
        AnalyticsService.track(AnalyticsEvents.VISUALIZE_SELECTED, {
          anchor_id: target.id,
          tier: visualizeAccess.subscriptionStatus,
        });
        startPractice({ mode: 'visualize', anchorId: target.id, source: 'practice_visualize_card' });
      } else {
        startBurn(
          target,
          source === 'practice_hero' ? source : 'practice_release_card'
        );
      }
    },
    [focusSessionDuration, primeSessionDuration, selectedAnchor, startBurn, startCharge, startPractice, startQuickActivate, visualizeAccess.subscriptionStatus]
  );

  const runTodayPractice = useCallback(() => {
    const target = selectedAnchor;
    if (!target) {
      setPendingMode(todayMode === 'focusSession' ? 'quickActivate' : 'charge');
      setPendingSource('practice_hero');
      setSelectorVisible(true);
      return;
    }

    if (locationPreset && locationPrimingSuggestion) {
      AnalyticsService.track(AnalyticsEvents.CHARGE_STARTED, {
        source: "practice_location_preset",
        location_preset_applied: true,
        session_type: locationPreset.sessionType,
        duration_seconds: locationPreset.durationSeconds,
      });

      if (locationPreset.sessionType === "focus") {
        startQuickActivate(
          target,
          locationPreset.durationSeconds,
          locationPreset.audioConfiguration,
          'practice_hero'
        );
        return;
      }

      startCharge(
        target,
        locationPreset.durationSeconds,
        locationPreset.audioConfiguration,
        'practice_hero'
      );
      return;
    }

    runMode(
      todayMode === 'focusSession' ? 'quickActivate' : 'charge',
      undefined,
      'practice_hero'
    );
  }, [
    locationPreset,
    locationPrimingSuggestion,
    runMode,
    selectedAnchor,
    startCharge,
    startQuickActivate,
    todayMode,
  ]);

  const handleSelectAnchor = useCallback(
    (anchor: Anchor) => {
      if (selectingAnchorRef.current) {
        return;
      }
      selectingAnchorRef.current = true;
      markInteraction();
      setSelectorVisible(false);
      const pendingModeSelection = pendingMode;
      const pendingSourceSelection = pendingSource;
      setPendingMode(null);
      setPendingSource(null);
      setCurrentAnchor(anchor.id);
      AnalyticsService.track(AnalyticsEvents.PRACTICE_CURRENT_ANCHOR_CHANGED, {
        anchor_id: anchor.id,
        source: "practice_screen",
      });

      const applySelection = () => {
        // Changing the current anchor from the hero should only refresh the
        // practice state. If the selector was opened from a mode tile, continue
        // into that explicitly requested ritual for the chosen anchor.
        if (pendingModeSelection) {
          runMode(pendingModeSelection, anchor, pendingSourceSelection ?? undefined);
        }
        selectingAnchorRef.current = false;
      };

      if (Platform.OS === "android") {
        InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(applySelection);
        });
        return;
      }

      applySelection();
    },
    [markInteraction, pendingMode, pendingSource, runMode, setCurrentAnchor]
  );

  const chooseMode = useCallback((mode: PracticeToolMode) => {
    markInteraction();
    setSelectedMode(mode);
    if (mode === 'visualize' && !visualizeAccess.hasActiveEntitlement) {
      AnalyticsService.track(AnalyticsEvents.VISUALIZE_PRO_LOCK_VIEWED, {
        tier: visualizeAccess.subscriptionStatus,
      });
    }
  }, [markInteraction, visualizeAccess.hasActiveEntitlement, visualizeAccess.subscriptionStatus]);

  const selectedModeSource: Record<PracticeToolMode, PracticeEntrySource> = {
    quickActivate: 'practice_focus_card',
    visualize: 'practice_visualize_card',
    charge: 'practice_deep_prime_card',
    burn: 'practice_release_card',
  };
  const selectedModeCta: Record<PracticeToolMode, string> = {
    quickActivate: 'BEGIN FOCUS →',
    visualize: 'BEGIN VISUALIZE →',
    charge: 'BEGIN DEEP PRIME →',
    burn: 'BEGIN RELEASE →',
  };
  const visualizeLocked = !ENABLE_VISUALIZE || !visualizeAccess.hasActiveEntitlement;
  const practiceCtaLabel = selectedMode === 'visualize' && visualizeLocked
    ? 'UNLOCK VISUALIZE →'
    : selectedModeCta[selectedMode];

  const anchorNextRituals = useMemo<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const anchor of selectableAnchors) {
      const anchorSessions = sessionLog
        .filter((s) => s.anchorId === anchor.id)
        .sort((a, b) => toMillis(b.completedAt) - toMillis(a.completedAt));
      const last = anchorSessions[0];
      result[anchor.id] = last
        ? toModeTitle(toModeFromSessionType(last.type))
        : FOCUS_SESSION_TITLE;
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
        startCharge(target, restartDuration, undefined, 'practice_hero');
        return;
      }

      if (session.type === 'activate') {
        const restartDuration = Math.max(10, Math.min(600, Math.round(session.durationSeconds || 30)));
        startQuickActivate(target, restartDuration, undefined, 'practice_hero');
        return;
      }

      startCharge(target, undefined, undefined, 'practice_hero');
    },
    [defaultDeepChargeSeconds, selectedAnchor, startCharge, startQuickActivate],
  );

  const suggestedRitual = useMemo(() => {
    if (!selectedAnchor) return null;
    if (selectedAnchor.isReleased) {
      return {
        type: "burn" as const,
        title: PRACTICE_COPY.rituals.burn.title,
        subtitle: PRACTICE_COPY.rituals.burn.duration,
      };
    }

    if (latestAnchorSession) {
      const type = toModeFromSessionType(latestAnchorSession.type);
      return {
        type,
        title: toModeTitle(type),
        subtitle: "Quick restart",
      };
    }

    return {
      type: "quickActivate" as const,
      title: FOCUS_SESSION_TITLE,
      subtitle: PRACTICE_COPY.rituals.quickActivate.duration,
    };
  }, [latestAnchorSession, selectedAnchor]);

  return (
    <View style={styles.container}>
      <ZenBackground
        variant="practice"
        showOrbs={isPracticeTabActive}
        showGrain
        showVignette
        performanceTier={performanceTier}
      />

      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 120 + insets.bottom },
          ]}
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
            <PracticeOverviewCard
              anchor={selectedAnchor}
              onOpenAnchor={() => {
                markInteraction();
                setPendingMode(null);
                setSelectorVisible(true);
              }}
            />
          </Animated.View>

          <Animated.View pointerEvents="box-none" style={[styles.portalsWrap, portalsStyle]}>
            <Text style={styles.sectionLabel}>Choose your practice</Text>
            <ModePortalTile
              testID="practice-focus-card"
              disabled={isNavigationLocked}
              variant="focus"
              title="FOCUS"
              meaning="Return your attention to the Anchor."
              durationHint="10–60 SEC"
              icon={<Zap size={14} color="#AD99D2" />}
              selected={selectedMode === 'quickActivate'}
              onPress={() => {
                chooseMode('quickActivate');
              }}
            />
            <ModePortalTile
              disabled={isNavigationLocked}
              variant="visualize"
              title="VISUALIZE"
              meaning="Rehearse the moment your intention is taking form."
              durationHint="1–5 MIN"
              badge="PRO"
              locked={visualizeLocked}
              icon={<Eye size={14} color="#78B4D1" />}
              selected={selectedMode === 'visualize'}
              onPress={() => {
                chooseMode('visualize');
              }}
            />
            <ModePortalTile
              testID="practice-deep-prime-card"
              disabled={isNavigationLocked}
              variant="deepPrime"
              title="DEEP PRIME"
              meaning="Spend longer building your connection to the Anchor."
              durationHint="2–10 MIN"
              icon={<Zap size={14} color="#F0CB6A" />}
              selected={selectedMode === 'charge'}
              onPress={() => {
                chooseMode('charge');
              }}
            />
            <ModePortalTile
              testID="practice-release-card"
              disabled={isNavigationLocked}
              variant="release"
              title="RELEASE"
              meaning="Close the loop when this Anchor has completed its work."
              durationHint="45 SEC–2 MIN"
              icon={<Flame size={14} color="#C8875A" />}
              selected={selectedMode === 'burn'}
              onPress={() => {
                chooseMode('burn');
              }}
            />
            <Pressable
              testID="practice-selected-mode-cta"
              accessibilityRole="button"
              accessibilityLabel={practiceCtaLabel}
              accessibilityState={{ disabled: isNavigationLocked }}
              disabled={isNavigationLocked}
              onPress={() => {
                markInteraction();
                runMode(selectedMode, undefined, selectedModeSource[selectedMode]);
              }}
              style={({ pressed }) => [
                styles.selectedModeCta,
                selectedMode === 'burn' && styles.selectedModeCtaRelease,
                pressed && styles.selectedModeCtaPressed,
              ]}
            >
              <Text style={styles.selectedModeCtaText}>{practiceCtaLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open The Weave"
              accessibilityHint="View your completed practice history"
              onPress={() => {
                navigation.navigate('Evolve');
              }}
              style={styles.weaveEntry}
              testID="practice-open-weave"
            >
              <View>
                <Text style={styles.weaveEntryEyebrow}>PRACTICE HISTORY</Text>
                <Text style={styles.weaveEntryTitle}>THE WEAVE</Text>
                <Text style={styles.weaveEntryText}>See the threads your returns have made.</Text>
              </View>
              <ChevronRight size={18} color={colors.gold} />
            </Pressable>
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
          setPendingSource(null);
        }}
      />

      {/* DEFERRED: previous practice teaching sheet retained for rollback — remove post-launch.
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
    paddingHorizontal: 20,
    paddingTop: spacing.xs,
    gap: spacing.lg,
  },
  portalsWrap: {
    gap: 0,
  },
  weaveEntry: {
    minHeight: 70,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212,175,55,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weaveEntryEyebrow: {
    color: 'rgba(242,223,168,0.56)',
    fontFamily: typography.fontFamily.sans,
    fontSize: 8,
    letterSpacing: 2,
  },
  weaveEntryTitle: {
    color: colors.gold,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 17,
    marginTop: 3,
  },
  weaveEntryText: {
    color: 'rgba(245,245,241,0.58)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: "rgba(212,175,55,0.6)",
    marginBottom: spacing.xs,
    paddingLeft: 0,
  },
  selectedModeCta: {
    minHeight: 52,
    marginLeft: 32,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(240,203,106,0.56)',
    backgroundColor: 'rgba(240,203,106,0.035)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedModeCtaRelease: {
    borderColor: 'rgba(200,135,90,0.6)',
    backgroundColor: 'rgba(200,135,90,0.08)',
  },
  selectedModeCtaPressed: { opacity: 0.78 },
  selectedModeCtaText: {
    color: colors.gold,
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 10,
    letterSpacing: 1.7,
  },
});
