import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
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
import type { V2PracticeRouteIntents, V2PracticeStartRequest } from './practiceRoutes';
import { V2PracticePrepareScreen } from './V2PracticePrepareScreen';
import { V2PracticeSessionScreen } from './V2PracticeSessionScreen';
import { V2FocusPrepScreen } from './focus';
import { useV2ReduceMotion } from '@/hooks/v2';
import { V2_LAYER_ENTER_MS, V2_LAYER_TRAVEL, V2_TRANSITION_SETTLE_MS } from '@/navigation/v2/transitions';

/**
 * Hub and prepare are layers of one route. Swapping them used to be a hard
 * cut; each now arrives with a short UI-thread settle in the direction of
 * travel. Driven by shared values rather than a Reanimated layout animation:
 * layout animations running while react-native-screens attaches the route's
 * fragment can crash Android (null child in dispatchAttachedToWindow). For the
 * same reason nothing animates while the route's own push is still moving.
 */
function PracticeLayer({ layerKey, depth, reduceMotion, children }: { layerKey: string; depth: number; reduceMotion: boolean; children: React.ReactNode }) {
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
    last && last.key !== layerKey && !entering.current && !reduceMotion &&
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
  anchor?: Anchor | null;
  recommendation?: V2RecommendationContext | null;
  capabilities?: V2PracticeCapabilities;
  initialMode?: V2PracticeMode;
  resumeMode?: V2PracticeMode;
  resumeDuration?: number;
  resumeSource?: 'practice_hub' | 'recommended_today';
  onBack?: () => void;
  onSessionCompleted?: () => void;
};

export function V2PracticeScreen({
  anchor: suppliedAnchor,
  recommendation: suppliedRecommendation,
  capabilities,
  initialMode,
  resumeMode,
  resumeDuration,
  resumeSource,
  onBack,
  onPremiumCapabilityRequired,
  onCreateVision,
  onOpenVision,
  onReleaseRequested,
  onBeginPractice,
  onSessionCompleted,
}: Props) {
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

  const [prepareMode, setPrepareMode] = useState<V2PracticeMode | null>(null);
  const [prepareSource, setPrepareSource] = useState<'practice_hub' | 'recommended_today'>('practice_hub');
  const [activeSession, setActiveSession] = useState<V2PracticeStartRequest | null>(null);
  const [justCompletedTodayAnchorId, setJustCompletedTodayAnchorId] = useState<string | null>(null);
  const [justCompletedMode, setJustCompletedMode] = useState<V2PracticeMode | null>(null);

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

  const lastCompletedModeToday = useMemo<V2PracticeMode | null>(() => {
    if (!fixedAnchor) return null;
    if (
      justCompletedMode &&
      justCompletedTodayAnchorId &&
      (fixedAnchor.id === justCompletedTodayAnchorId || fixedAnchor.localId === justCompletedTodayAnchorId)
    ) {
      return justCompletedMode;
    }
    const anchorMatches = (id?: string | null) =>
      Boolean(id && (id === fixedAnchor.id || id === fixedAnchor.localId));

    let latestTime = 0;
    let latestMode: V2PracticeMode | null = null;

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
            latestMode = p.practiceMode;
          }
        }
      }
    });

    sessionLog?.forEach((s) => {
      if (anchorMatches(s.anchorId) && s.completedAt) {
        if (localDateString(new Date(s.completedAt)) === todayKey) {
          const t = new Date(s.completedAt).getTime();
          if (t >= latestTime) {
            let mode: V2PracticeMode | null = null;
            if (s.type === 'activate') mode = 'focus';
            else if (s.type === 'reinforce') mode = 'deep_prime';
            else if (s.type === 'visualize') mode = 'visualize';
            if (mode) {
              latestTime = t;
              latestMode = mode;
            }
          }
        }
      }
    });

    return latestMode;
  }, [fixedAnchor, justCompletedMode, justCompletedTodayAnchorId, practiceHistory, sessionLog, todayKey]);

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

  const handleBeginPractice = (request: V2PracticeStartRequest) => {
    onBeginPractice?.(request);
    setActiveSession(request);
  };

  const handleSessionCompleted = () => {
    if (fixedAnchor) {
      setJustCompletedTodayAnchorId(fixedAnchor.id);
      if (activeSession) {
        setJustCompletedMode(activeSession.mode);
      }
    }
    setActiveSession(null);
    setPrepareMode(null);
    model.refetchRecommendation();
    onSessionCompleted?.();
  };

  // Resume after paywall purchase / trial activation
  useEffect(() => {
    if (!resumeMode || !fixedAnchor) return;
    const source = resumeSource ?? 'practice_hub';
    if (resumeDuration && resumeMode !== 'release') {
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
  useLayoutEffect(() => {
    if (initialModeConsumedRef.current) return;
    if (model.loadingRecommendation || !initialMode || !fixedAnchor || prepareMode || activeSession) return;
    initialModeConsumedRef.current = true;
    selectMode(initialMode, 'recommended_today');
  }, [activeSession, fixedAnchor?.id, initialMode, model.loadingRecommendation, prepareMode]);

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
      <V2PracticeSessionScreen
        anchorId={activeSession.anchorId}
        mode={activeSession.mode}
        durationSeconds={activeSession.durationSeconds}
        source={activeSession.source}
        voice={activeSession.voice}
        ambient={activeSession.ambient}
        haptics={activeSession.haptics}
        onBack={() => setActiveSession(null)}
        onCompleted={handleSessionCompleted}
        onFocusAgain={() => setActiveSession(null)}
      />
    );
  }

  // Pre-session setup interstitial layer
  if (prepareMode) {
    if (prepareMode === 'focus') {
      return (
        <PracticeLayer layerKey="prepare-focus" depth={1} reduceMotion={reduceMotion}>
        <V2FocusPrepScreen
          anchor={fixedAnchor}
          source={prepareSource}
          initialDuration={resumeDuration}
          onBack={() => setPrepareMode(null)}
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
          onPremiumRequired={onPremiumCapabilityRequired ? (intent) => {
            onPremiumCapabilityRequired({
              capability: 'focus',
              anchorId: intent.anchorId,
              source: intent.source,
              durationSeconds: intent.durationSeconds,
            });
          } : undefined}
        />
        </PracticeLayer>
      );
    }

    return (
      <PracticeLayer layerKey={`prepare-${prepareMode}`} depth={1} reduceMotion={reduceMotion}>
      <V2PracticePrepareScreen
        anchor={fixedAnchor}
        mode={prepareMode}
        vision={model.vision}
        source={prepareSource}
        entitled={effectiveCapabilities[prepareMode]}
        onBack={() => setPrepareMode(null)}
        onCreateVision={onCreateVision ?? (() => undefined)}
        onOpenVision={onOpenVision}
        onReleaseRequested={onReleaseRequested ?? (() => undefined)}
        onBeginPractice={handleBeginPractice}
        onPremiumRequired={onPremiumCapabilityRequired}
      />
      </PracticeLayer>
    );
  }

  const recommendedMode = model.recommendation
    ? V2_RECOMMENDATION_ACTION_TO_MODE[model.recommendation.recommendation.action]
    : null;

  const displayHeroMode = isCompletedToday
    ? (lastCompletedModeToday ?? recommendedMode ?? 'focus')
    : recommendedMode;

  return (
    <PracticeLayer layerKey="hub" depth={0} reduceMotion={reduceMotion}>
    <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
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
        <V2PracticeAnchorHeader
          anchor={fixedAnchor}
          thread={model.thread}
          onPress={() => setIsSwitcherOpen(true)}
        />

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
        <View style={styles.recommendationSection}>
          {model.loadingRecommendation && !isCompletedToday ? (
            <Text style={styles.hint}>Loading today’s practice…</Text>
          ) : displayHeroMode ? (
            <V2TodayPracticeCard
              testID="v2-recommended-today"
              mode={displayHeroMode}
              reason={model.recommendation?.recommendation.reason}
              isCompletedToday={isCompletedToday}
              onPress={() => selectMode(displayHeroMode, 'recommended_today')}
              onPracticeAgain={() => selectMode(displayHeroMode, 'recommended_today')}
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
            onSelectMode={(mode) => selectMode(mode, 'practice_hub')}
          />
        </View>
      </View>
    </V2Screen>
    </PracticeLayer>
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
