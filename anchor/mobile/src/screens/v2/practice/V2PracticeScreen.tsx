import { useCelebrationActive } from '@/hooks/v2/teaching/useCelebrationActive';
import type { ViewInstance } from 'react-native';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';
import { V2EmptyState, V2Screen } from '@/components/v2';
import {
  V2PracticeAnchorHeader,
  V2AnchorSwitcherSheet,
  V2TodayPracticeCard,
  V2PracticeGrid,
} from '@/components/v2/practice';
import {
  V2_RECOMMENDATION_ACTION_TO_MODE,
  type V2PracticeMode,
} from '@/constants/v2/practice';
import { useV2SelectedAnchor } from '@/hooks/v2/home';
import { useV2PracticeModel, type V2PracticeCapabilities } from '@/hooks/v2/practice';
import { acknowledgeV2RecommendationSignal, type V2RecommendationContext } from '@/adapters/v2/practice';
import { useSessionStore } from '@/stores/sessionStore';
import { localDateString } from '@/utils/primingAnalytics';
import { AnchorMotion, colors, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { V2PracticeCompletionResult, V2PracticeRouteIntents, V2PracticeStartRequest } from './practiceRoutes';
import { V2PracticePrepareScreen } from './V2PracticePrepareScreen';
import { V2PracticeSessionScreen } from './V2PracticeSessionScreen';
import { V2FocusPrepScreen } from './focus';
import { useV2ReduceMotion } from '@/hooks/v2';
import { V2_LAYER_ENTER_MS, V2_LAYER_TRAVEL, V2_TRANSITION_SETTLE_MS } from '@/navigation/v2/transitions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useV2Responsive } from '@/hooks/v2';
import {
  AnchorTransitionScene,
  useAnchorTransitionPlace,
  useOptionalAnchorTransition,
  type AnchorTransitionDestination,
} from '@/navigation/v2/ProgressiveFocusTransition';
import { predictPracticeSetupAnchorRect, predictSessionAnchorRect } from '@/navigation/v2/anchorHeroGeometry';
import { useAuthStore } from '@/stores/authStore';
import { beginGuidanceAction } from '@/hooks/v2/guidance/guidanceActions';
import { discoverGuidance } from '@/hooks/v2/guidance/guidanceRuntime';
import { useTeachingQueue } from '@/hooks/v2/teaching/useTeachingQueue';
import { useTeachingFocus } from '@/hooks/v2/teaching/useTeachingFocus';
import { practiceTeachingBeats } from '@/hooks/v2/teaching/practiceTeaching';
import { ScreenTeaching } from '@/components/v2/teaching/ScreenTeaching';

/** Where the Anchor comes to rest in each session. */
const SESSION_PLACE: Record<V2PracticeStartRequest['mode'], AnchorTransitionDestination> = {
  focus: 'focusSession',
  deep_prime: 'deepFocusSession',
  visualize: 'visualizeSession',
};

/**
 * Hub and prepare are layers of one route. Swapping them used to be a hard
 * cut; each now arrives with a short UI-thread settle in the direction of
 * travel. Driven by shared values rather than a Reanimated layout animation:
 * layout animations running while react-native-screens attaches the route's
 * fragment can crash Android (null child in dispatchAttachedToWindow). For the
 * same reason nothing animates while the route's own push is still moving.
 */
function PracticeLayer({ layerKey, depth, reduceMotion, settle = true, children }: { layerKey: string; depth: number; reduceMotion: boolean; settle?: boolean; children: React.ReactNode }) {
  const previous = useRef<{ key: string; depth: number } | null>(null);
  const mountedAt = useRef(Date.now());
  const entering = useRef(false);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  // The incoming layer's starting pose is written in the render that swaps
  // layers, so its first frame is already offset (never a frame in place
  // followed by a jump). The settle itself starts once it is committed.
  const last = previous.current;
  if (
    last && last.key !== layerKey && !entering.current && !reduceMotion && settle &&
    Date.now() - mountedAt.current >= V2_TRANSITION_SETTLE_MS
  ) {
    entering.current = true;
    translateY.value = depth > last.depth ? V2_LAYER_TRAVEL : -V2_LAYER_TRAVEL;
    opacity.value = 0.94;
  }

  useLayoutEffect(() => {
    previous.current = { key: layerKey, depth };
    if (!entering.current) return;
    entering.current = false;
    const config = { duration: V2_LAYER_ENTER_MS, easing: AnchorMotion.easing.enter };
    translateY.value = withTiming(0, config);
    opacity.value = withTiming(1, config);
  }, [depth, layerKey, opacity, translateY]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));
  return (
    <Animated.View style={[styles.layer, style]}>
      {children}
    </Animated.View>
  );
}

type Props = Partial<V2PracticeRouteIntents> & {
  visionEntry?: import('@/adapters/v2/vision').VisionVisualizeEntry;
  anchor?: Anchor | null;
  recommendation?: V2RecommendationContext | null;
  capabilities?: V2PracticeCapabilities;
  initialMode?: V2PracticeMode;
  resumeMode?: V2PracticeMode;
  resumeDuration?: number;
  resumeSource?: 'practice_hub' | 'recommended_today';
  onBack?: () => void;
  /** Arrived from another screen (the Vision): leaving setup returns there instead of showing the hub. */
  leaveOnSetupBack?: boolean;
  /**
   * Called when a session completes. Returning true says the route is taking over leaving (it carries
   * the Anchor home itself): the complete screen then stays up until the route changes.
   */
  onSessionCompleted?: (result?: V2PracticeCompletionResult) => boolean | void;
};

export function V2PracticeScreen({
  anchor: suppliedAnchor,
  recommendation: suppliedRecommendation,
  capabilities,
  initialMode,
  resumeMode,
  resumeDuration,
  resumeSource,
  visionEntry,
  onBack,
  leaveOnSetupBack = false,
  onPremiumCapabilityRequired,
  onCreateVision,
  onOpenVision,
  onReleaseRequested,
  onBeginPractice,
  onSessionCompleted,
}: Props) {
  const teachingFocus = useTeachingFocus();
  const celebrationActive = useCelebrationActive();
  const teachingAccountId = useAuthStore(state => state.user?.id ?? null);
  const todayTeachingRef = useRef<ViewInstance>(null);
  const switchTeachingRef = useRef<ViewInstance>(null);
  const { selectedAnchor, activeAnchors, selectAnchor } = useV2SelectedAnchor();
  const reduceMotion = useV2ReduceMotion();
  const [selectedOverrideId, setSelectedOverrideId] = useState<string | null>(null);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const prevSuppliedAnchorIdRef = useRef(suppliedAnchor?.id);

  useEffect(() => {
    if (suppliedAnchor && suppliedAnchor.id !== prevSuppliedAnchorIdRef.current) {
      prevSuppliedAnchorIdRef.current = suppliedAnchor.id;
      setSelectedOverrideId(null);
    }
  }, [suppliedAnchor]);

  const fixedAnchor = useMemo(() => {
    if (selectedOverrideId) {
      const found = activeAnchors.find((a) => a.id === selectedOverrideId || a.localId === selectedOverrideId);
      if (found) return found;
    }
    return suppliedAnchor === undefined ? selectedAnchor : suppliedAnchor;
  }, [activeAnchors, selectedOverrideId, selectedAnchor, suppliedAnchor]);

  const model = useV2PracticeModel(fixedAnchor, suppliedRecommendation);

  // The shared Anchor transition: the hub's ACTIVE ANCHOR mark flies into
  // setup, and setup's Anchor flies into the session. While the Anchor is in
  // the air, the layer swap it causes adds no settle of its own: the setup
  // Anchor is measured on arrival and must already be where it will rest.
  const transition = useOptionalAnchorTransition();
  const anchorInFlight = Boolean(transition?.active);
  const viewport = useV2Responsive();
  const insets = useSafeAreaInsets();
  const windowSize = useWindowDimensions();
  const headerPlace = useAnchorTransitionPlace('practice', fixedAnchor?.id, 'bare');

  const [prepareMode, setPrepareMode] = useState<V2PracticeMode | null>(() => visionEntry && resumeMode === 'visualize' ? 'visualize' : null);
  const [prepareSource, setPrepareSource] = useState<'practice_hub' | 'recommended_today'>('practice_hub');
  const [activeSession, setActiveSession] = useState<V2PracticeStartRequest | null>(null);
  const [justCompletedTodayAnchorId, setJustCompletedTodayAnchorId] = useState<string | null>(null);
  const [justCompletedMode, setJustCompletedMode] = useState<V2PracticeMode | null>(null);
  const [justCompletedDurationSeconds, setJustCompletedDurationSeconds] = useState<number | null>(null);
  const teachingQueue = useTeachingQueue({ screenId: 'practice', accountId: teachingAccountId, contextKey: fixedAnchor?.id,
    eligible: practiceTeachingBeats(activeAnchors.length, Boolean(fixedAnchor)), cap: 2, isFocused: teachingFocus.isFocused,
    blocked: celebrationActive || teachingFocus.transitioning || anchorInFlight || isSwitcherOpen || Boolean(prepareMode || activeSession || initialMode || resumeMode) || !fixedAnchor || model.loadingRecommendation });

  const effectiveCapabilities = capabilities ?? model.capability;

  const todayKey = localDateString(new Date());
  const todayPractice = useSessionStore((s) => s.todayPractice);
  const sessionLog = useSessionStore((s) => s.sessionLog);
  const practiceHistory = useSessionStore((s) => s.practiceHistory);

  /** Most recent practice per Anchor, derived from existing history; nothing new is persisted. */
  const lastPracticedAtByAnchorId = useMemo(() => {
    const latest: Record<string, number> = {};
    const note = (id: string | null | undefined, completedAt: string | undefined) => {
      if (!id || !completedAt) return;
      const at = new Date(completedAt).getTime();
      if (!Number.isNaN(at) && at > (latest[id] ?? 0)) latest[id] = at;
    };
    sessionLog?.forEach((s) => note(s.anchorId, s.completedAt));
    practiceHistory?.forEach((p) => {
      note(p.anchorId, p.completedAt);
      note(p.anchorLocalId, p.completedAt);
    });
    return latest;
  }, [practiceHistory, sessionLog]);

  const lastCompletedPracticeToday = useMemo<{ mode: V2PracticeMode; durationSeconds?: number } | null>(() => {
    if (!fixedAnchor) return null;
    const anchorMatches = (id?: string | null) =>
      Boolean(id && (id === fixedAnchor.id || id === fixedAnchor.localId));
    if (
      justCompletedMode &&
      justCompletedTodayAnchorId &&
      anchorMatches(justCompletedTodayAnchorId)
    ) {
      return {
        mode: justCompletedMode,
        durationSeconds: justCompletedDurationSeconds ?? undefined,
      };
    }

    let latestTime = 0;
    let latest: { mode: V2PracticeMode; durationSeconds?: number } | null = null;

    practiceHistory?.forEach((p) => {
      if ((anchorMatches(p.anchorId) || anchorMatches(p.anchorLocalId)) && p.completedAt) {
        if (localDateString(new Date(p.completedAt)) === todayKey) {
          const t = new Date(p.completedAt).getTime();
          if (
            t >= latestTime &&
            (p.practiceMode === 'focus' ||
              p.practiceMode === 'deep_prime' ||
              p.practiceMode === 'visualize' ||
              p.practiceMode === 'release')
          ) {
            latestTime = t;
            const durationSeconds =
              typeof p.completedDurationSeconds === 'number' && p.completedDurationSeconds > 0
                ? p.completedDurationSeconds
                : typeof p.plannedDurationSeconds === 'number' && p.plannedDurationSeconds > 0
                  ? p.plannedDurationSeconds
                  : undefined;
            latest = { mode: p.practiceMode, durationSeconds };
          }
        }
      }
    });

    sessionLog?.forEach((s) => {
      if (anchorMatches(s.anchorId) && s.completedAt) {
        if (localDateString(new Date(s.completedAt)) === todayKey) {
          const t = new Date(s.completedAt).getTime();
          if (t > latestTime) {
            let mode: V2PracticeMode | null = null;
            if (s.type === 'activate') mode = 'focus';
            else if (s.type === 'reinforce') mode = 'deep_prime';
            else if (s.type === 'visualize') mode = 'visualize';
            if (mode) {
              latestTime = t;
              latest = { mode };
            }
          }
        }
      }
    });

    return latest;
  }, [fixedAnchor, justCompletedDurationSeconds, justCompletedMode, justCompletedTodayAnchorId, practiceHistory, sessionLog, todayKey]);

  const isCompletedToday = useMemo(() => {
    if (!fixedAnchor) return false;
    if (
      justCompletedTodayAnchorId &&
      (fixedAnchor.id === justCompletedTodayAnchorId || fixedAnchor.localId === justCompletedTodayAnchorId)
    ) {
      return true;
    }
    const anchorMatches = (id?: string | null) =>
      Boolean(id && (id === fixedAnchor.id || id === fixedAnchor.localId));

    if (todayPractice?.date === todayKey && todayPractice.sessionsCount > 0) {
      const inLog = sessionLog?.some(
        (s) =>
          anchorMatches(s.anchorId) &&
          s.completedAt &&
          localDateString(new Date(s.completedAt)) === todayKey
      );
      if (inLog) return true;
      const inHist = practiceHistory?.some(
        (p) =>
          (anchorMatches(p.anchorId) || anchorMatches(p.anchorLocalId)) &&
          p.completedAt &&
          localDateString(new Date(p.completedAt)) === todayKey
      );
      if (inHist) return true;
    }
    const inLogDirect = sessionLog?.some(
      (s) =>
        anchorMatches(s.anchorId) &&
        s.completedAt &&
        localDateString(new Date(s.completedAt)) === todayKey
    );
    if (inLogDirect) return true;

    const inHistDirect = practiceHistory?.some(
      (p) =>
        (anchorMatches(p.anchorId) || anchorMatches(p.anchorLocalId)) &&
        p.completedAt &&
        localDateString(new Date(p.completedAt)) === todayKey
    );
    if (inHistDirect) return true;

    if (fixedAnchor.chargedAt) {
      const chargedDate = new Date(fixedAnchor.chargedAt);
      if (!isNaN(chargedDate.getTime()) && localDateString(chargedDate) === todayKey) return true;
    }
    return false;
  }, [fixedAnchor, justCompletedTodayAnchorId, practiceHistory, sessionLog, todayKey, todayPractice]);

  /**
   * Acknowledgement is an explicit-engagement action only. Mounting, fetching,
   * prefetching or switching Anchors never reaches this line, and the ref
   * keeps a re-entry (back out of Prepare and tap again) from acknowledging
   * the same signal twice.
   */
  const acknowledgedSignalRef = useRef<string | null>(null);

  const selectMode = (mode: V2PracticeMode, source: 'practice_hub' | 'recommended_today') => {
    if (!fixedAnchor) return;
    const signal = model.recommendation?.completionSignal;
    if (source === 'recommended_today' && signal && acknowledgedSignalRef.current !== signal.id) {
      acknowledgedSignalRef.current = signal.id;
      void acknowledgeV2RecommendationSignal(fixedAnchor.id, signal.id, signal.type).catch(() => undefined);
    }
    setPrepareSource(source);
    setPrepareMode(mode);
  };

  /** Hub -> setup. The ACTIVE ANCHOR mark travels to where setup shows it. */
  const openModeFromHub = (mode: V2PracticeMode, source: 'practice_hub' | 'recommended_today') => {
    if (!fixedAnchor) return;
    if (!effectiveCapabilities[mode]) {
      if (mode === 'deep_prime' || mode === 'visualize') {
        onPremiumCapabilityRequired?.({
          capability: mode,
          anchorId: fixedAnchor.id,
          source,
          durationSeconds: mode === 'visualize' ? 600 : 300,
        });
        return;
      }
    }
    // Visualize setup is led by the person's Vision and carries no Anchor flight of its own.
    if (!transition || mode === 'visualize') {
      selectMode(mode, source);
      return;
    }
    transition.startAnchorTransition({
      anchor: fixedAnchor,
      from: 'practice',
      to: {
        target: 'practiceSetup',
        rect: predictPracticeSetupAnchorRect({ viewport, topInset: insets.top, mode, hasVision: model.vision.state === 'ready' }),
      },
      onNavigate: () => selectMode(mode, source),
    });
  };

  /**
   * Setup -> session. Begin is refused while another flight owns the Anchor,
   * so repeated taps never start a second session. The session learns whether
   * the Anchor is arriving with it or whether it runs its own entry.
   */
  const handleBeginPractice = (request: V2PracticeStartRequest) => {
    const begin = (withHero: boolean) => {
      onBeginPractice?.(request);
      setActiveSession({ ...request, anchorTransition: withHero });
    };
    if (request.mode === 'visualize' || !transition || !fixedAnchor) {
      begin(false);
      return;
    }
    transition.startAnchorTransition({
      anchor: fixedAnchor,
      from: 'practiceSetup',
      to: {
        target: SESSION_PLACE[request.mode],
        rect: predictSessionAnchorRect({
          width: windowSize.width,
          height: windowSize.height,
          topInset: insets.top,
          bottomInset: insets.bottom,
          mode: request.mode,
        }),
      },
      onNavigate: begin,
    });
  };

  const handleSessionCompleted = (completion?: V2PracticeCompletionResult) => {
    if (fixedAnchor && completion?.saved !== false) {
      setJustCompletedTodayAnchorId(fixedAnchor.id);
      const completedMode = completion?.mode ?? activeSession?.mode;
      if (completedMode) setJustCompletedMode(completedMode);
      const completedDuration = completion?.durationSeconds ?? activeSession?.durationSeconds;
      setJustCompletedDurationSeconds(
        typeof completedDuration === 'number' && completedDuration > 0 ? completedDuration : null,
      );
    }
    const sessionSource = completion?.source ?? activeSession?.source ?? prepareSource;
    // The route may take over leaving (returning true): the complete screen then stays up while it
    // fades and flies the Anchor home, and the route change itself removes this screen.
    const routeIsLeaving = onSessionCompleted?.({
      mode: (completion?.mode ?? activeSession?.mode ?? 'focus') as Exclude<V2PracticeMode, 'release'>,
      durationSeconds: completion?.durationSeconds ?? activeSession?.durationSeconds ?? 0,
      saved: completion?.saved ?? true,
      source: sessionSource,
    }) === true;
    if (!routeIsLeaving) {
      setActiveSession(null);
      setPrepareMode(null);
    }
    model.refetchRecommendation();
  };

  // Resume after paywall purchase / trial activation. On a pushed route, select
  // the requested setup before the first paint so the Practice hub does not
  // appear briefly before Visualize.
  useLayoutEffect(() => {
    if (!resumeMode || !fixedAnchor) return;
    const source = resumeSource ?? 'practice_hub';
    if (resumeDuration && resumeMode !== 'release' && resumeMode !== 'visualize') {
      setActiveSession({
        anchorId: fixedAnchor.id,
        mode: resumeMode,
        durationSeconds: resumeDuration,
        source,
      });
    } else {
      setPrepareMode(resumeMode);
      setPrepareSource(source);
    }
  }, [fixedAnchor?.id, resumeDuration, resumeMode, resumeSource]);

  // Handle initial mode passed from navigation once upon entry. A layout
  // effect, so when the recommendation is already known the route's first
  // painted frame is the prepare layer, not a frame of the hub it replaces.
  const initialModeConsumedRef = useRef(false);
  const prevInitialModeRef = useRef(initialMode);
  const prevResumeModeRef = useRef(resumeMode);
  useLayoutEffect(() => {
    const initialChanged = initialMode !== prevInitialModeRef.current;
    const resumeChanged = resumeMode !== prevResumeModeRef.current;
    if (!initialChanged && !resumeChanged) return;
    prevInitialModeRef.current = initialMode;
    prevResumeModeRef.current = resumeMode;
    if (!initialMode && !resumeMode) {
      initialModeConsumedRef.current = false;
      setPrepareMode(null);
      setActiveSession(null);
      return;
    }
    if (initialChanged && initialMode && !resumeMode) {
      initialModeConsumedRef.current = false;
      setPrepareMode(null);
      setActiveSession(null);
    }
  }, [initialMode, resumeMode]);
  useLayoutEffect(() => {
    if (initialModeConsumedRef.current) return;
    if (model.loadingRecommendation || !initialMode || !fixedAnchor || prepareMode || activeSession) return;
    initialModeConsumedRef.current = true;
    if (!effectiveCapabilities[initialMode] && (initialMode === 'deep_prime' || initialMode === 'visualize')) {
      onPremiumCapabilityRequired?.({
        capability: initialMode,
        anchorId: fixedAnchor.id,
        source: 'recommended_today',
        durationSeconds: initialMode === 'visualize' ? 600 : 300,
      });
      return;
    }
    selectMode(initialMode, 'recommended_today');
  }, [activeSession, effectiveCapabilities, fixedAnchor?.id, initialMode, model.loadingRecommendation, onPremiumCapabilityRequired, prepareMode]);

  if (!fixedAnchor) {
    return (
      <V2Screen testID="v2-practice-screen">
        <View style={styles.empty}>
          <V2EmptyState
            title="No Anchor selected"
            message="Choose an Anchor before beginning a practice."
          />
        </View>
      </V2Screen>
    );
  }

  // Active immersive session layer
  if (activeSession) {
    return (
      <AnchorTransitionScene place={SESSION_PLACE[activeSession.mode]}>
      <V2PracticeSessionScreen
        anchorTransition={activeSession.anchorTransition === true}
        anchorId={activeSession.anchorId}
        mode={activeSession.mode}
        durationSeconds={activeSession.durationSeconds}
        source={activeSession.source}
        voice={activeSession.voice}
        ambient={activeSession.ambient}
        haptics={activeSession.haptics}
        preparedVisualize={activeSession.preparedVisualize}
        onBack={() => setActiveSession(null)}
        onCompleted={handleSessionCompleted}
        onFocusAgain={() => setActiveSession(null)}
      />
      </AnchorTransitionScene>
    );
  }

  // Pre-session setup interstitial layer
  if (prepareMode) {
    if (prepareMode === 'focus') {
      return (
        <AnchorTransitionScene place="practiceSetup">
        <PracticeLayer layerKey="prepare-focus" depth={1} reduceMotion={reduceMotion} settle={!anchorInFlight}>
        <V2FocusPrepScreen
          anchor={fixedAnchor}
          source={prepareSource}
          initialDuration={resumeDuration}
          onBack={() => {
            if (leaveOnSetupBack && onBack) onBack();
            else setPrepareMode(null);
          }}
          onBeginFocus={(config) => {
            handleBeginPractice({
              anchorId: fixedAnchor.id,
              mode: 'focus',
              durationSeconds: config.durationSeconds,
              source: prepareSource,
              voice: config.voice,
              ambient: config.ambient,
              haptics: config.haptics,
              focusEntryAnchorCenterY: config.anchorCenterY,
              focusEntryAnchorSize: config.anchorSize,
            });
          }}
        />
        </PracticeLayer>
        </AnchorTransitionScene>
      );
    }

    return (
      <AnchorTransitionScene place="practiceSetup">
      <PracticeLayer layerKey={`prepare-${prepareMode}`} depth={1} reduceMotion={reduceMotion} settle={!anchorInFlight}>
      <V2PracticePrepareScreen
        anchor={fixedAnchor}
        mode={prepareMode}
        vision={visionEntry?.anchorId === fixedAnchor.id ? { state: 'ready', visionId: visionEntry.visionId,
          previewText: fixedAnchor.intentionText ?? '', seenToday: false, tiles: visionEntry.tiles, notes: visionEntry.notes, boardLayout: visionEntry.boardLayout ?? 'CLASSIC' } : model.vision}
        visionEntry={visionEntry?.anchorId === fixedAnchor.id ? visionEntry : undefined}
        source={prepareSource}
        initialDuration={prepareMode === resumeMode ? resumeDuration ?? undefined : undefined}
        entitled={effectiveCapabilities[prepareMode]}
        onBack={() => { if (leaveOnSetupBack && onBack) onBack(); else setPrepareMode(null); }}
        onCreateVision={onCreateVision ?? (() => undefined)}
        onOpenVision={onOpenVision}
        onReleaseRequested={onReleaseRequested ?? (() => undefined)}
        onBeginPractice={handleBeginPractice}
        onPremiumRequired={onPremiumCapabilityRequired}
        anchorHandoff={Boolean(transition) && !transition?.reduceMotion}
      />
      </PracticeLayer>
      </AnchorTransitionScene>
    );
  }

  const recommendedMode = model.recommendation
    ? V2_RECOMMENDATION_ACTION_TO_MODE[model.recommendation.recommendation.action]
    : null;

  const displayHeroMode = isCompletedToday
    ? (lastCompletedPracticeToday?.mode ?? recommendedMode ?? 'focus')
    : recommendedMode;

  return (
    <AnchorTransitionScene place="practice">
    <PracticeLayer layerKey="hub" depth={0} reduceMotion={reduceMotion} settle={!anchorInFlight}>
    <StatusBar barStyle="light-content" animated />
    <V2Screen scroll style={styles.screen} testID="v2-practice-screen">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        disabled={!onBack}
        style={styles.back}
      >
        <ArrowLeft size={20} color={colors.ink.text.primary} />
        <Text style={styles.backText}>Practice</Text>
      </Pressable>

      <View style={styles.content}>
        {/* Layer 1: Active Anchor Switcher */}
        <View ref={switchTeachingRef} collapsable={false}>
        <V2PracticeAnchorHeader
          anchor={fixedAnchor}
          thread={model.thread}
          onPress={() => { const confirm = beginGuidanceAction(teachingAccountId ?? 'guest', 'practice.switch_anchor', 'target:switcher'); setIsSwitcherOpen(true); confirm(true); discoverGuidance(teachingAccountId ?? 'guest', 'practice.switch_anchor'); }}
          artworkPlace={headerPlace}
        />
        </View>

        {/* Anchor Switcher Modal / Bottom Sheet */}
        <V2AnchorSwitcherSheet
          visible={isSwitcherOpen}
          anchors={activeAnchors.length > 0 ? activeAnchors : [fixedAnchor]}
          selectedAnchorId={fixedAnchor.id}
          lastPracticedAtByAnchorId={lastPracticedAtByAnchorId}
          onSelect={(anchorId) => {
            setSelectedOverrideId(anchorId);
            selectAnchor(anchorId);
            setIsSwitcherOpen(false);
          }}
          onClose={() => setIsSwitcherOpen(false)}
        />

        {/* Layer 2: Recommended Today Hero */}
        <View ref={todayTeachingRef} collapsable={false} style={styles.recommendationSection}>
          {model.loadingRecommendation && !isCompletedToday ? (
            <Text style={styles.hint}>Loading today’s practice…</Text>
          ) : displayHeroMode ? (
            <V2TodayPracticeCard
              testID="v2-recommended-today"
              mode={displayHeroMode}
              reason={model.recommendation?.recommendation.reason}
              isCompletedToday={isCompletedToday}
              completedDurationSeconds={
                lastCompletedPracticeToday?.mode === displayHeroMode
                  ? lastCompletedPracticeToday.durationSeconds
                  : undefined
              }
              onPress={() => openModeFromHub(displayHeroMode, 'recommended_today')}
              onPracticeAgain={() => openModeFromHub(displayHeroMode, 'recommended_today')}
            />
          ) : (
            <View style={styles.unavailableToday}>
              <Text style={styles.hint}>Today’s practice could not be loaded.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry Today"
                onPress={model.refetchRecommendation}
                style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Layer 3: All Practices 2x2 Grid */}
        <View style={styles.gridSection}>
          <V2PracticeGrid
            capabilities={effectiveCapabilities}
            heroMode={displayHeroMode}
            onSelectMode={(mode) => openModeFromHub(mode, 'practice_hub')}
          />
        </View>
      </View>
    </V2Screen>
    <ScreenTeaching screen="practice" queue={teachingQueue} reducedMotion={reduceMotion} targets={{
      'practice.today': { targetRef: todayTeachingRef }, 'practice.switch': { targetRef: switchTeachingRef },
    }} />
    </PracticeLayer>
    </AnchorTransitionScene>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.ink.base,
  },
  layer: {
    flex: 1,
  },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
  },
  backText: {
    fontFamily: typography.displayBold,
    fontSize: 20,
    letterSpacing: -0.2,
    color: colors.ink.text.primary,
  },
  content: {
    // Section rhythm is set per-section below rather than by a uniform gap,
    // so the Today hero and the practice library read as distinct beats.
    paddingTop: spacing[2],
    paddingBottom: spacing[8],
  },
  recommendationSection: {
    // The context header and the hero it frames are one beat, so the air
    // between them stays smaller than the air before the practice library.
    marginTop: spacing[4],
  },
  gridSection: {
    // A wider beat than the one above the hero: the library is the next
    // section, not a continuation of the recommendation.
    marginTop: spacing[5],
  },
  hint: {
    ...typography.caption,
    color: colors.ink.text.secondary,
    paddingTop: spacing[1],
  },
  unavailableToday: {
    gap: spacing[2],
  },
  retry: {
    alignSelf: 'flex-start',
  },
  retryPressed: {
    opacity: 0.68,
  },
  retryText: {
    ...typography.labelMD,
    color: colors.ink.text.primary,
    textDecorationLine: 'underline',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.ink.base,
  },
});
