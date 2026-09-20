import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { colors, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { V2PracticeRouteIntents, V2PracticeStartRequest } from './practiceRoutes';
import { V2PracticePrepareScreen } from './V2PracticePrepareScreen';
import { V2PracticeSessionScreen } from './V2PracticeSessionScreen';
import { V2FocusPrepScreen } from './focus';

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

  const effectiveCapabilities = capabilities ?? model.capability;

  const todayKey = localDateString(new Date());
  const todayPractice = useSessionStore((s) => s.todayPractice);
  const sessionLog = useSessionStore((s) => s.sessionLog);
  const practiceHistory = useSessionStore((s) => s.practiceHistory);

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

  // Handle initial mode passed from navigation once upon entry
  const initialModeConsumedRef = useRef(false);
  useEffect(() => {
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
        onBack={() => setActiveSession(null)}
        onCompleted={handleSessionCompleted}
      />
    );
  }

  // Pre-session setup interstitial layer
  if (prepareMode) {
    if (prepareMode === 'focus') {
      return (
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
      );
    }

    return (
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
    );
  }

  const recommendedMode = model.recommendation
    ? V2_RECOMMENDATION_ACTION_TO_MODE[model.recommendation.recommendation.action]
    : null;

  return (
    <V2Screen scroll testID="v2-practice-screen">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        disabled={!onBack}
        style={styles.back}
      >
        <ArrowLeft size={20} color={colors.text.primary} />
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
          onSelect={(anchorId) => {
            setSelectedOverrideId(anchorId);
            selectAnchor(anchorId);
            setIsSwitcherOpen(false);
          }}
          onClose={() => setIsSwitcherOpen(false)}
        />

        {/* Layer 2: Recommended Today Hero */}
        <View style={styles.recommendationSection}>
          {model.loadingRecommendation ? (
            <Text style={styles.hint}>Loading today’s practice…</Text>
          ) : recommendedMode ? (
            <V2TodayPracticeCard
              testID="v2-recommended-today"
              mode={recommendedMode}
              reason={model.recommendation?.recommendation.reason}
              isCompletedToday={isCompletedToday}
              onPress={() => selectMode(recommendedMode, 'recommended_today')}
              onPracticeAgain={() => selectMode(recommendedMode, 'recommended_today')}
            />
          ) : (
            <Text style={styles.hint}>
              {model.recommendationError ?? 'No recommendation is available today.'}
            </Text>
          )}
        </View>

        {/* Layer 3: All Practices 2x2 Grid */}
        <V2PracticeGrid
          capabilities={effectiveCapabilities}
          onSelectMode={(mode) => selectMode(mode, 'practice_hub')}
        />
      </View>
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
  },
  backText: {
    ...typography.labelLG,
    color: colors.text.primary,
  },
  content: {
    gap: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
  },
  recommendationSection: {
    gap: spacing[2],
  },
  hint: {
    ...typography.caption,
    color: colors.text.secondary,
    paddingTop: spacing[1],
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
});
