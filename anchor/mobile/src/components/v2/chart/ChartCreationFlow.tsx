import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ArrowRight, ArrowUpRight, Star, X } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { CHART_COPY, reviewSupportCopy } from '@/constants/v2/chartCopy';
import {
  chartV2Api,
  classifyChartError,
  freshKey,
  type ChartAdjustmentReason,
  type ChartProposal,
  type ChartRequestError,
} from '@/services/v2/chartV2Api';
import { trackChart } from '@/hooks/v2/chart/useAnchorChart';
import type { CourseDetail } from '@/types/chart';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { ChartAdjustPanel, type ChartAdjustRequest } from './ChartAdjustPanel';
import {
  ChartCreamPanel,
  ChartEyebrow,
  ChartInkButton,
  ChartInkScreen,
  ChartTextArea,
  ChartTopBar,
  type ChartIdentity,
} from './ChartChrome';
import { ChartGenerationStage } from './ChartGenerationStage';
import { ChartKeyboardFrame } from './ChartKeyboardFrame';
import { ChartLandscape, type ChartAnchorArt, type ChartMarker } from './ChartLandscape';
import { ChartRealityInput } from './ChartRealityInput';
import { ChartRouteEditor, type DraftWaypoint } from './ChartRouteEditor';
import { CHART_WINDOWS, chartArtFor } from './chartRouteGeometry';
import { CHART_EASING, CHART_TRANSITION_TIMING as TT, chartTiming } from './chartMotion';

export type ChartCreationVision = {
  imageUrl: string | null;
  description: string | null;
  title: string | null;
};

export type ChartCreationPhase = Phase;

type Phase =
  | 'intro'
  | 'context'
  | 'generating'
  | 'followup'
  | 'review'
  | 'adjusting'
  | 'failed'
  | 'revealed';

type Props = {
  anchorId: string;
  identity: ChartIdentity;
  anchorArt: ChartAnchorArt | null;
  vision: ChartCreationVision | null;
  reducedMotion: boolean;
  onBack: () => void;
  onOpenVision: () => void;
  /** Persisted Chart; the caller publishes it to the shared cache. */
  onCreated: (chart: CourseDetail) => void;
  onExplore: () => void;
  /** Open at a given phase with a given proposal (fixture previews and tests). */
  initialPhase?: Phase;
  initialProposal?: ChartProposal | null;
  /** The Chart API. Injected only by the development fixture preview. */
  api?: ChartCreationApi;
  testID?: string;
};

export type ChartCreationApi = Pick<typeof chartV2Api, 'plan' | 'adjust' | 'create'>;

/** Phases that share one mounted map, so the route never resets between them. */
const STAGE_PHASES: readonly Phase[] = ['generating', 'review', 'adjusting', 'revealed'];

/** Room under the map for the status line while mapping and the CTA afterwards. */
const STAGE_FOOTER = 104;

/**
 * The permanent Chart's header sits a few points higher than the creation top
 * bar (no bottom padding) and its map tucks 28pt under it; the hero window
 * starts 20% down the art. Used to land the map exactly where the permanent
 * Chart will draw it, so "Explore your Chart" reads as moving into the map.
 */
const ACTIVE_MAP_TUCK = 28 + spacing[1];

export function toDraft(proposal: ChartProposal): DraftWaypoint[] {
  return proposal.waypoints.map((waypoint) => ({
    key: waypoint.clientKey,
    title: waypoint.title,
    rationale: waypoint.rationale,
    kind: waypoint.kind,
    metricLabel: waypoint.metricLabel,
    metricTarget: waypoint.metricTarget,
    metricBaseline: waypoint.metricBaseline,
  }));
}

/** A plain outline when no route could be generated at all. The person names it. */
export function manualOutline(intention: string): DraftWaypoint[] {
  const destination = intention.replace(/[.!]+$/, '').trim().slice(0, 60);
  const blank = (key: string): DraftWaypoint => ({
    key,
    title: '',
    rationale: null,
    kind: 'MILESTONE',
    metricLabel: null,
    metricTarget: null,
    metricBaseline: null,
  });
  return [blank('manual-1'), blank('manual-2'), { ...blank('manual-3'), title: destination }];
}

function markersFor(draft: DraftWaypoint[], currentIndex = -1): ChartMarker[] {
  return draft.map((waypoint, index) => ({
    id: waypoint.key,
    number: index + 1,
    state: index === currentIndex ? 'current' : 'upcoming',
    accessibilityLabel: `Waypoint ${index + 1} of ${draft.length}: ${waypoint.title || 'unnamed'}`,
  }));
}

function errorCopy(error: ChartRequestError | null): string {
  if (!error) return CHART_COPY.errors.generation;
  if (error.kind === 'offline') return CHART_COPY.errors.offline;
  if (error.kind === 'rate_limited') return CHART_COPY.errors.rateLimited;
  if (error.kind === 'disabled') return CHART_COPY.errors.disabled;
  if (error.kind === 'anchor_released') return CHART_COPY.errors.released;
  return CHART_COPY.errors.generation;
}

/**
 * Cross-fades a headline block when its content key changes: the old copy
 * leaves, the new one arrives. Reduced motion swaps immediately.
 */
function useStagedCopy<K extends string>(key: K, reducedMotion: boolean) {
  const [shown, setShown] = useState(key);
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (key === shown) return undefined;
    if (reducedMotion) {
      setShown(key);
      return undefined;
    }
    opacity.value = chartTiming(0, { duration: TT.copyOut, easing: CHART_EASING.exit });
    const timer = setTimeout(() => {
      setShown(key);
      opacity.value = chartTiming(1, { duration: TT.copyIn, easing: CHART_EASING.settle });
    }, TT.copyOut);
    return () => clearTimeout(timer);
  }, [key, opacity, reducedMotion, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: (1 - opacity.value) * 6 }],
  }));
  return [shown, style] as const;
}

export function ChartCreationFlow({
  anchorId,
  identity,
  anchorArt,
  vision,
  reducedMotion,
  onBack,
  onOpenVision,
  onCreated,
  onExplore,
  initialPhase = 'intro',
  initialProposal = null,
  api = chartV2Api,
  testID,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [startingContext, setStartingContext] = useState('');
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [proposal, setProposal] = useState<ChartProposal | null>(initialProposal);
  const [draft, setDraft] = useState<DraftWaypoint[]>(() => (initialProposal ? toDraft(initialProposal) : []));
  const [oneMove, setOneMove] = useState(initialProposal?.suggestedOneMove?.title ?? '');
  const [destination, setDestination] = useState(initialProposal?.destination ?? '');
  const [needsNaming, setNeedsNaming] = useState(false);
  const [revised, setRevised] = useState(false);
  const [error, setError] = useState<ChartRequestError | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generationMarkers, setGenerationMarkers] = useState<ChartMarker[] | null>(() =>
    initialProposal ? markersFor(toDraft(initialProposal)) : null
  );
  // A new mapping attempt remounts the map; review, adjust and reveal keep it.
  const [mappingKey, setMappingKey] = useState(0);
  const [stageSize, setStageSize] = useState({ height: 0, pageY: 0 });
  const [heroHeight, setHeroHeight] = useState(0);
  const [panelMounted, setPanelMounted] = useState(initialPhase === 'review' || initialPhase === 'adjusting');
  const [exploring, setExploring] = useState(false);
  // One key per creation attempt, so a retried submit cannot create two Charts.
  const createKey = useRef(freshKey(`chart-create:${anchorId}`));
  const planStarted = useRef<number>(0);
  const stageRef = useRef<View>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Review panel: 0 = risen over the map, 1 = below the screen.
  const panelOffset = useSharedValue(initialPhase === 'review' || initialPhase === 'adjusting' ? 0 : 1);
  const ctaOpacity = useSharedValue(initialPhase === 'revealed' ? 1 : 0);
  const explore = useSharedValue(0);
  const exploreDelta = useSharedValue(0);

  const hasVision = Boolean(vision && (vision.imageUrl || vision.description));
  const inStage = STAGE_PHASES.includes(phase);

  useEffect(() => {
    const running = timers.current;
    return () => {
      running.forEach(clearTimeout);
      [panelOffset, ctaOpacity, explore].forEach((value) => cancelAnimation(value));
    };
  }, [ctaOpacity, explore, panelOffset]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const acceptProposal = useCallback(
    (next: ChartProposal) => {
      setProposal(next);
      setDraft(toDraft(next));
      setDestination(next.destination);
      setOneMove(next.suggestedOneMove?.title ?? '');
      setNeedsNaming(next.generation.needsNaming);
      trackChart('chart_generation_succeeded', {
        source: next.generation.source,
        fallbackUsed: next.generation.fallbackUsed,
        waypointCount: next.waypoints.length,
        complexity: next.complexity,
        latencyMs: Date.now() - planStarted.current,
      });
      if (next.generation.fallbackUsed) trackChart('chart_fallback_used', { stage: 'generation' });
    },
    []
  );

  const runPlan = useCallback(
    async (answer: { question: string; answer: string } | null) => {
      setPhase('generating');
      setMappingKey((key) => key + 1);
      setGenerationMarkers(null);
      setError(null);
      planStarted.current = Date.now();
      trackChart('chart_generation_started', { hasVision, followUp: Boolean(answer) });
      try {
        const response = await api.plan(anchorId, {
          idempotencyKey: freshKey(`chart-plan:${anchorId}`),
          startingContext: startingContext.trim() || null,
          followUp: answer,
        });
        if (response.status === 'needs_context') {
          setFollowUpQuestion(response.followUpQuestion);
          setFollowUpAnswer('');
          setPhase('followup');
          return;
        }
        acceptProposal(response.proposal);
        setGenerationMarkers(markersFor(toDraft(response.proposal)));
      } catch (caught) {
        const classified = classifyChartError(caught);
        trackChart('chart_generation_failed', { kind: classified.kind });
        setError(classified);
        setPhase('failed');
      }
    },
    [acceptProposal, anchorId, api, hasVision, startingContext]
  );

  // The finished map is already on screen; the cream review surface rises over it.
  const showReview = useCallback(() => {
    setPanelMounted(true);
    setPhase((current) => (current === 'generating' || current === 'failed' || current === 'context' ? 'review' : current));
    panelOffset.value = reducedMotion ? 0 : chartTiming(0, { duration: TT.panelIn, easing: CHART_EASING.settle });
  }, [panelOffset, reducedMotion]);

  const startManual = () => {
    setProposal(null);
    const outline = manualOutline(identity.intention);
    setDraft(outline);
    setGenerationMarkers(null);
    setMappingKey((key) => key + 1);
    setDestination(identity.intention.replace(/[.!]+$/, '').trim().slice(0, 140));
    setOneMove('');
    setNeedsNaming(true);
    setRevised(false);
    trackChart('chart_generation_manual', {});
    panelOffset.value = 1;
    showReview();
  };

  const submitAdjust = async ({ reason, detail }: ChartAdjustRequest) => {
    setAdjusting(true);
    setAdjustError(null);
    try {
      const response = await api.adjust(anchorId, {
        idempotencyKey: freshKey(`chart-adjust:${anchorId}`),
        reason: reason as ChartAdjustmentReason,
        detail,
        startingContext: startingContext.trim() || null,
        draft: {
          destination: destination || identity.intention.slice(0, 140),
          waypoints: draft
            .filter((waypoint) => waypoint.title.trim())
            .map((waypoint) => ({
              title: waypoint.title,
              kind: waypoint.kind,
              metricTarget: waypoint.metricTarget,
              metricLabel: waypoint.metricLabel,
            })),
        },
      });
      if (response.status === 'proposal') {
        acceptProposal(response.proposal);
        setGenerationMarkers(markersFor(toDraft(response.proposal)));
        setRevised(true);
        trackChart('chart_route_adjusted', { reason, stage: 'review', hasDetail: Boolean(detail) });
        setPhase('review');
      }
    } catch (caught) {
      const classified = classifyChartError(caught);
      setAdjustError(classified.kind === 'offline' ? CHART_COPY.errors.offline : CHART_COPY.errors.adjust);
    } finally {
      setAdjusting(false);
    }
  };

  const save = async () => {
    const waypoints = draft.filter((waypoint) => waypoint.title.trim());
    if (waypoints.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const chart = await api.create(anchorId, {
        idempotencyKey: createKey.current,
        destinationText: (destination || identity.intention).slice(0, 140),
        startingContext: startingContext.trim() || null,
        proposalId: proposal?.proposalId ?? null,
        complexity: proposal?.complexity ?? null,
        waypoints: waypoints.map((waypoint) => ({
          title: waypoint.title.trim(),
          rationale: waypoint.rationale,
          kind: waypoint.kind,
          metricLabel: waypoint.metricLabel,
          metricTarget: waypoint.metricTarget,
          metricBaseline: waypoint.metricBaseline,
        })),
        oneMove: oneMove.trim() ? { title: oneMove.trim(), rationale: proposal?.suggestedOneMove?.rationale ?? null } : null,
      });
      trackChart('chart_route_reviewed', {
        waypointCount: waypoints.length,
        proposedCount: proposal?.waypoints.length ?? 0,
        edited: JSON.stringify(waypoints.map((w) => w.title)) !== JSON.stringify(proposal?.waypoints.map((w) => w.title) ?? []),
      });
      trackChart('chart_created', {
        courseId: chart.id,
        waypointCount: waypoints.length,
        source: proposal ? proposal.generation.source : 'manual',
        hasVision,
        hasOneMove: Boolean(oneMove.trim()),
      });
      onCreated(chart);
      // PLAN → MAP: the review surface falls away; the map it was resting on becomes the Chart.
      setPhase('revealed');
      if (reducedMotion) {
        panelOffset.value = 1;
        setPanelMounted(false);
        ctaOpacity.value = chartTiming(1, { duration: 200 });
      } else {
        panelOffset.value = chartTiming(1, { duration: TT.panelOut, easing: CHART_EASING.deliberate });
        later(() => setPanelMounted(false), TT.panelOut + 40);
        later(() => {
          ctaOpacity.value = chartTiming(1, { duration: TT.copyIn, easing: CHART_EASING.settle });
        }, TT.panelOut + TT.revealCta);
      }
    } catch (caught) {
      const classified = classifyChartError(caught);
      if (classified.code === 'ACTIVE_COURSE_EXISTS') {
        // Another device (or a lost response) already saved this Anchor's Chart.
        onExplore();
        return;
      }
      setSaveError(classified.kind === 'offline' ? CHART_COPY.errors.saveSupport : CHART_COPY.errors.save);
    } finally {
      setSaving(false);
    }
  };

  // "Explore your Chart": the chrome recedes and the map rises to exactly where
  // the permanent Chart draws it, then the permanent Chart takes over in place.
  const exploreChart = () => {
    if (exploring) return;
    setExploring(true);
    if (reducedMotion) {
      ctaOpacity.value = chartTiming(0, { duration: 160 });
      later(onExplore, 180);
      return;
    }
    const finish = (pageY: number) => {
      const art = chartArtFor(identity.category);
      const imageHeight = (width * art.height) / art.width;
      const stageHeight = stageSize.height || height;
      // Where the art's top edge is now (the settled camera drifts 5pt down) …
      const currentTop = pageY + stageHeight - STAGE_FOOTER - imageHeight + 5;
      // … and where the permanent Chart's hero window will put it.
      const targetTop = pageY - ACTIVE_MAP_TUCK - CHART_WINDOWS.hero.top * imageHeight;
      exploreDelta.value = targetTop - currentTop;
      explore.value = chartTiming(1, { duration: TT.explore, easing: CHART_EASING.deliberate });
      later(onExplore, TT.explore);
    };
    if (stageRef.current?.measureInWindow) {
      stageRef.current.measureInWindow((_x, y) => finish(Number.isFinite(y) ? y : stageSize.pageY));
    } else {
      finish(stageSize.pageY);
    }
  };

  const goBack = useCallback(() => {
    switch (phase) {
      case 'context':
        setPhase('intro');
        return true;
      case 'followup':
      case 'failed':
        setPhase('context');
        return true;
      case 'adjusting':
        setPhase('review');
        return true;
      case 'review':
        setPanelMounted(false);
        panelOffset.value = 1;
        setPhase('context');
        return true;
      case 'generating':
        return true; // Let the mapping finish; the request is already in flight.
      default:
        onBack();
        return true;
    }
  }, [onBack, panelOffset, phase]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  }, [goBack]);

  const namedCount = draft.filter((waypoint) => waypoint.title.trim()).length;
  const destinationLabel = destination || identity.intention;
  const reviewSupport = needsNaming ? CHART_COPY.review.outline : revised ? CHART_COPY.adjust.reviewSupport : reviewSupportCopy(draft.length);

  const title =
    phase === 'intro'
      ? CHART_COPY.title
      : phase === 'generating'
        ? CHART_COPY.generation.headerTitle
        : phase === 'review'
          ? CHART_COPY.review.headerTitle
          : phase === 'adjusting'
            ? CHART_COPY.adjust.headerTitle
            : phase === 'revealed'
              ? CHART_COPY.revealed.headerTitle
              : CHART_COPY.creation.headerTitle;

  const revealedMarkers = useMemo(
    () => (phase === 'revealed' ? markersFor(draft.filter((waypoint) => waypoint.title.trim()), 0) : null),
    [draft, phase]
  );
  // During review the map keeps the route it just drew (or, for a hand-named outline, draws it on reveal).
  const stageMarkers = revealedMarkers ?? generationMarkers;

  const heroKey = (phase === 'generating'
    ? 'generating'
    : phase === 'adjusting'
      ? 'adjusting'
      : phase === 'revealed'
        ? 'revealed'
        : revised
          ? 'revised'
          : 'review') as 'generating' | 'adjusting' | 'revealed' | 'revised' | 'review';
  const [shownHero, heroStyle] = useStagedCopy(heroKey, reducedMotion);
  const heroCopy: Record<typeof heroKey, { headline: string; support: string }> = {
    generating: { headline: CHART_COPY.generation.headline, support: CHART_COPY.generation.support },
    review: { headline: CHART_COPY.review.headline, support: reviewSupport },
    revised: { headline: CHART_COPY.adjust.review, support: reviewSupport },
    adjusting: { headline: CHART_COPY.adjust.headline, support: CHART_COPY.adjust.support },
    revealed: { headline: CHART_COPY.revealed.headline, support: CHART_COPY.revealed.support },
  };
  const compact = height < 760;

  const stageHeight = stageSize.height || Math.max(420, height - insets.top - 140);
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: panelOffset.value * (stageHeight + 40) }],
  }));
  const mapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: explore.value * exploreDelta.value }],
  }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, explore.value * 1.8) }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value * (1 - Math.min(1, explore.value * 2.2)) }));

  return (
    <ChartInkScreen testID={testID ?? 'chart-creation'}>
      <ChartTopBar title={title} onBack={phase === 'generating' || exploring ? undefined : goBack} identity={identity} />

      {phase === 'intro' ? (
        <View style={styles.flex} testID="chart-empty-state">
          <View style={styles.hero}>
            <Text accessibilityRole="header" style={styles.display}>
              {CHART_COPY.empty.headline}
            </Text>
            <Text style={styles.support}>{CHART_COPY.empty.support}</Text>
          </View>
          <View style={styles.flexEnd}>
            <ChartLandscape
              width={width}
              category={identity.category}
              window={CHART_WINDOWS.full}
              showRoute={false}
              scrimTop
              scrimBottom={colors.canvas}
              accessibilityLabel="A landscape with a path toward the horizon"
              style={styles.introLandscape}
            />
            <ChartCreamPanel style={{ paddingBottom: insets.bottom + spacing[4] }}>
              <View style={styles.reinforcingIcon}>
                <Star size={14} color={colors.semantic.warning} fill={colors.semantic.warning} />
              </View>
              <ChartEyebrow tone="cream">{CHART_COPY.labels.reinforcing}</ChartEyebrow>
              <Text style={styles.reinforcing} numberOfLines={3}>
                {identity.intention}
              </Text>
              <V2Button
                size="large"
                onPress={() => {
                  trackChart('chart_creation_started', { hasVision });
                  setPhase('context');
                }}
                iconRight={<ArrowRight size={18} color={colors.text.inverse} />}
                testID="chart-create-cta"
                accessibilityLabel={CHART_COPY.empty.cta}
                style={styles.cta}
              >
                {CHART_COPY.empty.cta}
              </V2Button>
            </ChartCreamPanel>
          </View>
        </View>
      ) : null}

      {phase === 'context' ? (
        <ChartRealityInput
          intention={identity.intention}
          category={identity.category}
          value={startingContext}
          onChangeText={setStartingContext}
          reducedMotion={reducedMotion}
          onContinue={() => {
            trackChart('chart_context_submitted', { hasVision, length: startingContext.trim().length });
            void runPlan(null);
          }}
          header={
            hasVision && vision ? (
              <View style={styles.visionCard} testID="chart-vision-context">
                <ChartEyebrow tone="cream">{CHART_COPY.labels.alreadySeen}</ChartEyebrow>
                <Text accessibilityRole="header" style={styles.visionHeadline}>
                  {CHART_COPY.creation.visionHeadline}
                </Text>
                <Text style={styles.visionSupport}>{CHART_COPY.creation.visionSupport}</Text>
                {vision.imageUrl ? (
                  <Image
                    source={{ uri: vision.imageUrl }}
                    style={styles.visionImage}
                    accessibilityIgnoresInvertColors
                    accessibilityLabel="Your Vision"
                  />
                ) : null}
                {vision.description ? (
                  <Text style={styles.visionDescription} numberOfLines={4}>
                    {vision.description}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={CHART_COPY.creation.viewVision}
                  onPress={onOpenVision}
                  style={({ pressed }) => [styles.visionLink, pressed && styles.pressed]}
                >
                  <Text style={styles.visionLinkText}>{CHART_COPY.creation.viewVision}</Text>
                  <ArrowUpRight size={14} color={colors.text.primary} />
                </Pressable>
              </View>
            ) : null
          }
          testID="chart-reality-input"
        />
      ) : null}

      {phase === 'followup' && followUpQuestion ? (
        <ChartKeyboardFrame
          contentContainerStyle={styles.scroll}
          footerStyle={styles.inkFooter}
          footer={
            <ChartInkButton
              label={CHART_COPY.creation.continue}
              disabled={followUpAnswer.trim().length < 2}
              onPress={() => void runPlan({ question: followUpQuestion, answer: followUpAnswer.trim() })}
              icon={<ArrowRight size={18} color={colors.text.primary} />}
              testID="chart-follow-up-continue"
            />
          }
        >
          <View style={styles.section} testID="chart-follow-up">
            <Text accessibilityRole="header" style={styles.display}>
              {CHART_COPY.followUp.headline}
            </Text>
            <Text style={styles.support}>{CHART_COPY.followUp.support}</Text>
            <Text style={styles.question}>{followUpQuestion}</Text>
            <ChartTextArea
              value={followUpAnswer}
              onChangeText={setFollowUpAnswer}
              placeholder={CHART_COPY.followUp.placeholder}
              maxLength={500}
              maxHeight={180}
              accessibilityLabel={followUpQuestion}
              autoFocus
              testID="chart-follow-up-input"
            />
          </View>
        </ChartKeyboardFrame>
      ) : null}

      {phase === 'failed' ? (
        <ChartKeyboardFrame contentContainerStyle={styles.scroll}>
          <View style={styles.section} testID="chart-generation-failed">
            <Text accessibilityRole="header" style={styles.question}>
              {errorCopy(error)}
            </Text>
            <Text style={styles.support}>{CHART_COPY.errors.generationSupport}</Text>
            <ChartInkButton
              label={CHART_COPY.errors.retry}
              onPress={() => void runPlan(null)}
              testID="chart-generation-retry"
              disabled={error?.kind === 'disabled' || error?.kind === 'anchor_released'}
            />
            <ChartInkButton
              label={CHART_COPY.errors.manual}
              variant="outline"
              onPress={startManual}
              testID="chart-generation-manual"
              disabled={error?.kind === 'disabled' || error?.kind === 'anchor_released'}
            />
          </View>
        </ChartKeyboardFrame>
      ) : null}

      {inStage ? (
        <View
          ref={stageRef}
          style={styles.flex}
          onLayout={(event) => {
            const { height: h, y } = event.nativeEvent.layout;
            setStageSize((size) => (size.height === h && size.pageY === y ? size : { height: h, pageY: y }));
          }}
          testID={phase === 'revealed' ? 'chart-revealed' : undefined}
        >
          {/* One map from the first line of the survey to the permanent Chart. */}
          {/* While the review surface covers it, the map is scenery: one route for screen readers, not two. */}
          <Animated.View
            style={[StyleSheet.absoluteFill, mapStyle]}
            pointerEvents="none"
            accessibilityElementsHidden={panelMounted}
            importantForAccessibility={panelMounted ? 'no-hide-descendants' : 'auto'}
          >
            <ChartGenerationStage
              key={mappingKey}
              width={width}
              height={stageHeight}
              category={identity.category}
              anchorArt={anchorArt}
              destinationImageUrl={vision?.imageUrl ?? null}
              destinationLabel={destinationLabel}
              markers={stageMarkers}
              reducedMotion={reducedMotion}
              settled={phase !== 'generating'}
              hereCaption={phase === 'revealed' ? 'START' : CHART_COPY.labels.here}
              footerSpace={STAGE_FOOTER + insets.bottom}
              onRevealed={phase === 'generating' ? showReview : undefined}
              testID={phase === 'generating' ? 'chart-generation' : 'chart-stage-map'}
            />
          </Animated.View>

          <Animated.View
            style={[styles.hero, styles.stageHero, heroStyle, chromeStyle]}
            onLayout={(event) => setHeroHeight(event.nativeEvent.layout.height)}
            pointerEvents="none"
          >
            <Text accessibilityRole="header" style={[styles.display, compact && shownHero !== 'generating' && styles.displayCompact]}>
              {heroCopy[shownHero].headline}
            </Text>
            <Text style={[styles.support, compact && shownHero !== 'generating' && styles.supportCompact]}>
              {heroCopy[shownHero].support}
            </Text>
          </Animated.View>

          {panelMounted ? (
            <Animated.View style={[styles.panelWrap, { top: heroHeight + spacing[3] }, panelStyle]}>
              <ChartCreamPanel style={styles.reviewPanel}>
                <ChartKeyboardFrame
                  contentContainerStyle={styles.reviewScroll}
                  restingBottom={spacing[3]}
                  footer={
                    phase === 'review' ? (
                      <View style={styles.reviewActions}>
                        <V2Button
                          variant="secondary"
                          size="large"
                          onPress={() => setPhase('adjusting')}
                          style={styles.actionHalf}
                          testID="chart-review-adjust"
                          accessibilityLabel={CHART_COPY.review.adjust}
                          disabled={saving}
                        >
                          {CHART_COPY.review.adjust}
                        </V2Button>
                        <V2Button
                          size="large"
                          onPress={() => void save()}
                          loading={saving}
                          disabled={namedCount === 0 || (needsNaming && namedCount < draft.length)}
                          iconRight={<ArrowRight size={18} color={colors.text.inverse} />}
                          style={styles.actionHalf}
                          testID="chart-review-confirm"
                          accessibilityLabel={CHART_COPY.review.confirm}
                        >
                          {CHART_COPY.review.confirm}
                        </V2Button>
                      </View>
                    ) : null
                  }
                >
                  {phase === 'adjusting' ? (
                    <ChartAdjustPanel onSubmit={submitAdjust} loading={adjusting} error={adjustError} testID="chart-adjust-panel" />
                  ) : (
                    <>
                      <View style={styles.routeHeader}>
                        <ChartEyebrow tone="cream">{CHART_COPY.review.routeLabel}</ChartEyebrow>
                        <Text style={styles.routeCount}>
                          {draft.length} waypoint{draft.length === 1 ? '' : 's'}
                        </Text>
                      </View>
                      {proposal?.guidance && !needsNaming ? <Text style={styles.guidance}>{proposal.guidance}</Text> : null}
                      <ChartRouteEditor
                        waypoints={draft}
                        onChange={setDraft}
                        onEdit={(kind) => trackChart(kind === 'add' ? 'chart_waypoint_added' : 'chart_waypoint_edited', { stage: 'review', kind })}
                        showRail
                        testID="chart-route-editor"
                      />
                      <Text style={styles.evolve}>{CHART_COPY.review.evolve}</Text>

                      {/* One Move is an action toward Waypoint 1 — never a stand-in for it. */}
                      <View style={styles.oneMoveCard} testID="chart-review-one-move-card">
                        <View style={styles.oneMoveHeader}>
                          <ChartEyebrow tone="cream">{CHART_COPY.review.oneMoveLabel}</ChartEyebrow>
                          <View style={styles.oneMoveFor}>
                            <Text style={styles.oneMoveForText}>For waypoint 1</Text>
                          </View>
                        </View>
                        <Text style={styles.oneMoveExplainer}>
                          {CHART_COPY.review.oneMoveFor(draft.find((waypoint) => waypoint.title.trim())?.title ?? '')}
                        </Text>
                        <View style={styles.oneMoveRow}>
                          <TextInput
                            value={oneMove}
                            onChangeText={setOneMove}
                            placeholder={CHART_COPY.active.noMove}
                            placeholderTextColor={colors.text.tertiary}
                            maxLength={120}
                            accessibilityLabel="Your first move"
                            style={styles.oneMoveInput}
                            testID="chart-review-one-move"
                          />
                          {oneMove ? (
                            <Pressable accessibilityRole="button" accessibilityLabel="Clear first move" hitSlop={8} onPress={() => setOneMove('')}>
                              <X size={16} color={colors.text.secondary} />
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                      {saveError ? (
                        <Text style={styles.saveError} accessibilityLiveRegion="polite">
                          {saveError}
                        </Text>
                      ) : null}
                    </>
                  )}
                </ChartKeyboardFrame>
              </ChartCreamPanel>
            </Animated.View>
          ) : null}

          {phase === 'revealed' ? (
            <Animated.View style={[styles.revealFooter, { paddingBottom: insets.bottom + spacing[4] }, ctaStyle]}>
              <ChartInkButton
                label={CHART_COPY.revealed.cta}
                variant="outline"
                onPress={exploreChart}
                disabled={exploring}
                icon={<ArrowRight size={18} color={colors.ink.text.primary} />}
                testID="chart-explore"
              />
            </Animated.View>
          ) : null}
        </View>
      ) : null}
    </ChartInkScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexEnd: { flex: 1, justifyContent: 'flex-end' },
  hero: { paddingHorizontal: spacing[5], paddingTop: spacing[3], gap: spacing[2], zIndex: 1 },
  stageHero: { position: 'absolute', left: 0, right: 0, top: 0 },
  display: { ...typography.displayMedium, fontSize: 34, lineHeight: 38, color: colors.ink.text.primary },
  support: { ...typography.bodyLG, color: colors.ink.text.secondary },
  guidance: { ...typography.bodySM, color: colors.text.secondary, marginBottom: spacing[1] },
  displayCompact: { fontSize: 28, lineHeight: 32 },
  supportCompact: { ...typography.bodyMD },
  question: { ...typography.headingLG, color: colors.ink.text.primary },
  introLandscape: { position: 'absolute', left: 0, bottom: 0 },
  reinforcingIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.grouped,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  reinforcing: { ...typography.headingSM, color: colors.text.primary, marginTop: spacing[1] },
  cta: { marginTop: spacing[4] },
  scroll: { paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[6], gap: spacing[6] },
  section: { gap: spacing[3] },
  inkFooter: { paddingHorizontal: spacing[5], paddingTop: spacing[3], backgroundColor: colors.ink.base },
  visionCard: { backgroundColor: colors.canvas, borderRadius: radii.xl, padding: spacing[5], gap: spacing[2] },
  visionHeadline: { ...typography.headingXL, color: colors.text.primary },
  visionSupport: { ...typography.bodyMD, color: colors.text.secondary },
  visionImage: { width: '100%', aspectRatio: 1.6, borderRadius: radii.md, marginTop: spacing[2] },
  visionDescription: { ...typography.bodyMD, color: colors.text.primary },
  visionLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: spacing[4],
    borderRadius: radii.pill,
    backgroundColor: colors.grouped,
  },
  visionLinkText: { ...typography.labelMD, color: colors.text.primary },
  panelWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  reviewPanel: { flex: 1, paddingTop: spacing[4] },
  reviewScroll: { paddingBottom: spacing[4] },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  routeCount: { ...typography.labelMD, color: colors.text.secondary },
  reviewActions: { flexDirection: 'row', gap: spacing[3], paddingTop: spacing[3] },
  actionHalf: { flex: 1 },
  evolve: { ...typography.bodySM, color: colors.text.secondary, marginTop: spacing[3] },
  oneMoveCard: {
    marginTop: spacing[5],
    padding: spacing[4],
    gap: spacing[2],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
  },
  oneMoveHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  oneMoveFor: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radii.pill, backgroundColor: colors.grouped },
  oneMoveForText: { ...typography.labelSM, color: colors.text.secondary },
  oneMoveExplainer: { ...typography.bodySM, color: colors.text.secondary },
  oneMoveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.canvas,
  },
  oneMoveInput: { flex: 1, ...typography.bodyMD, color: colors.text.primary, minHeight: 46 },
  saveError: { ...typography.bodySM, color: colors.semantic.error, marginTop: spacing[2] },
  revealFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing[5], paddingTop: spacing[3] },
  pressed: { opacity: 0.8 },
});
