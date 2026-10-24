import type { ViewInstance } from 'react-native';

import { chartTypography as typography } from './chartTypography';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { CHART_COPY, chartReviewSupport } from '@/constants/v2/chartCopy';
import {
  chartV2Api,
  classifyChartError,
  freshKey,
  type ChartAdjustmentReason,
  type ChartProposal,
  type ChartReferenceWire,
  type ChartRequestError,
} from '@/services/v2/chartV2Api';
import { trackChart } from '@/hooks/v2/chart/useAnchorChart';
import type { CourseDetail } from '@/types/chart';
import { colors, getCategoryColor, radii, spacing } from '@/theme/v2';
import { ChartAdjustPanel, type ChartAdjustRequest } from './ChartAdjustPanel';
import {
  ChartCreamPanel,
  ChartEyebrow,
  ChartInkButton,
  ChartInkScreen,
  // DEFERRED: ChartTopBar,
  type ChartIdentity,
} from './ChartChrome';
import { ChartGenerationStage } from './ChartGenerationStage';
import { ChartKeyboardFrame } from './ChartKeyboardFrame';
import { ChartCourseReviewScreen } from './ChartCourseReviewScreen';
import type { ChartAnchorArt, ChartMarker } from './ChartLandscape';
// DEFERRED: import { ChartJourneyWorld } from './ChartJourneyWorld';
import { ChartStaticMap } from './panel/ChartStaticMap';
import { ChartIntroOpening } from './ChartIntroOpening';
import { ChartMapHeader } from './panel/ChartMapHeader';
import { panelAccent } from './panel/chartPanelColors';
import { CHART_MAP_TOKENS } from './map/chartMapTokens';
import { buildRouteTable } from './map/chartMapGeometry';
import { chartMapScreenTop } from './map/ChartWeatherHold';
import { prepareChartMapIntroArt, warmChartMapResources } from './map/ChartMapLand';
import { getChartIntroSeen } from './chartIntroSeen';
import { MAP_H, MAP_W } from './map/chartMapContracts';
import { ChartCreationAsk, type AskPlanSource } from './ask/ChartCreationAsk';
import type { AskPlanInput } from '@/services/v2/askChartApi';
import type { DraftWaypoint } from './ChartRouteEditor';
import { CHART_EASING, CHART_INTRO_TIMING, CHART_TRANSITION_TIMING as TT, chartTiming } from './chartMotion';

export type ChartCreationVision = {
  imageUrl: string | null;
  description: string | null;
  title: string | null;
};

export type ChartCreationPhase = Phase;

type Phase =
  | 'intro'
  | 'ask'
  | 'generating'
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
  /** Creating a Chart is Pro; opens the paywall when the server refuses a free account. */
  onPremiumRequired?: () => void;
  /** Open at a given phase with a given proposal (fixture previews and tests). */
  initialPhase?: Phase;
  initialProposal?: ChartProposal | null;
  /** The Chart API. Injected only by the development fixture preview. */
  api?: ChartCreationApi;
  /** Development-only opening replay choice; production callers leave it unset. */
  introReplayMode?: 'full' | 'short';
  /** The intro opening has started; the route clears its one-shot replay param here. */
  onIntroStarted?: () => void;
  testID?: string;
};

export type ChartCreationApi = Pick<typeof chartV2Api, 'plan' | 'adjust' | 'create'>;

/** Entrance → conversation: the opening leaves, then the conversation settles in. About 420 ms end to end. */
const ASK_ENTRANCE = { introOut: 190, askIn: 230 } as const;

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
    progressMode: waypoint.progressMode,
    requirements: waypoint.requirements, completionCriteria: waypoint.completionCriteria,
    metricLabel: waypoint.metricLabel,
    metricTarget: waypoint.metricTarget,
    metricBaseline: waypoint.metricBaseline,
    suggestedMoves: waypoint.moves ?? [],
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
  onPremiumRequired,
  initialPhase = 'intro',
  initialProposal = null,
  api = chartV2Api,
  introReplayMode,
  onIntroStarted,
  testID,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [introSkipRequest, setIntroSkipRequest] = useState(0);
  const requestIntroSkip = useCallback(() => setIntroSkipRequest(current => current + 1), []);
  // Seeded from the window width so the prefetch and the opening start on the first frame; layout corrects it below.
  const [introViewportWidth, setIntroViewportWidth] = useState<number | null>(width);
  const [introPreparation, setIntroPreparation] = useState<{ width: number; seen: boolean; artDecoded: boolean } | null>(null);
  const [introSurfaceWidth, setIntroSurfaceWidth] = useState<number | null>(null);
  // Set once the cold preparation cover has held for CHART_INTRO_TIMING.coverMax: the cover drops and the opening takes its reduced path.
  const [introCoverExpired, setIntroCoverExpired] = useState(false);
  const markIntroSurfaceReady = useCallback(() => {
    if (introViewportWidth !== null) setIntroSurfaceWidth(introViewportWidth);
  }, [introViewportWidth]);
  useEffect(() => {
    if (phase !== 'intro' || introCoverExpired) return undefined;
    const timer = setTimeout(() => {
      setIntroCoverExpired(true);
      if (__DEV__) console.warn('[chart-intro] cover cap reached; the opening takes its reduced path');
    }, CHART_INTRO_TIMING.coverMax);
    return () => clearTimeout(timer);
  }, [phase, introCoverExpired]);
  // The cover (and the held paper) shows until the art and the surface are ready, but never past the cap.
  const introCoverHeld = !introCoverExpired && (introViewportWidth === null || introPreparation?.width !== introViewportWidth || introSurfaceWidth !== introViewportWidth);
  const [startingContext, setStartingContext] = useState('');
  const [actualStartingPoint, setActualStartingPoint] = useState('');
  // The conversation stays mounted once opened, so going back from the review returns to the same conversation.
  const [askMounted, setAskMounted] = useState(false);
  const lastPlan = useRef<AskPlanInput | null>(null);
  // 1 = the opening is fully shown; it fades out as the conversation fades in.
  const introOpacity = useSharedValue(1);
  const askIn = useSharedValue(0);
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
  // DEFERRED: const [heroHeight, setHeroHeight] = useState(0);
  // DEFERRED: const [introArea, setIntroArea] = useState({ width: 0, height: 0 });
  const [panelMounted, setPanelMounted] = useState(initialPhase === 'review' || initialPhase === 'adjusting');
  const [exploring, setExploring] = useState(false);
  // One key per creation attempt, so a retried submit cannot create two Charts.
  const createKey = useRef(freshKey(`chart-create:${anchorId}`));
  const planStarted = useRef<number>(0);
  const stageRef = useRef<ViewInstance>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Review panel: 0 = risen over the map, 1 = below the screen.
  const panelOffset = useSharedValue(initialPhase === 'review' || initialPhase === 'adjusting' ? 0 : 1);
  const ctaOpacity = useSharedValue(initialPhase === 'revealed' ? 1 : 0);
  const explore = useSharedValue(0);
  const exploreDelta = useSharedValue(0);

  const hasVision = Boolean(vision && (vision.imageUrl || vision.description));
  const inStage = STAGE_PHASES.includes(phase);
  // Intro and the mapping stage share the etched cream-paper map; context and clarity stay on ink.
  const paper = phase === 'intro' || inStage || phase === 'ask';

  const onScreenLayout = useCallback((event: LayoutChangeEvent) => {
    if (phase !== 'intro') return;
    const measuredWidth = event.nativeEvent.layout.width;
    setIntroViewportWidth(current => current !== null && Math.abs(current - measuredWidth) < 0.5 ? current : measuredWidth);
  }, [phase]);

  // DEFERRED: cover-fit enlarged the art past the screen edges.
  useEffect(() => {
    if (phase === 'intro') return undefined;
    const table = buildRouteTable();
    warmChartMapResources(table, width, width * MAP_H / MAP_W);
    const activeHeight = Math.min(width * MAP_H / MAP_W, Math.max(240, height - insets.top - insets.bottom - 360));
    warmChartMapResources(table, width, activeHeight - 100);
  }, [phase, width, height, insets.top, insets.bottom]);

  useEffect(() => {
    if (phase !== 'intro') {
      setIntroPreparation(null);
      setIntroSurfaceWidth(null);
      return undefined;
    }
    if (introViewportWidth === null) return undefined;
    let active = true;
    const table = buildRouteTable();
    const mapHeight = introViewportWidth * MAP_H / MAP_W;
    const seenPromise = Promise.resolve().then(() => getChartIntroSeen()).catch(() => false);
    // Only the full-resolution base uses grain. The half-resolution ink pass
    // draws the landscape shader directly and needs no second grain texture.
    const artPromise = Promise.resolve().then(() => prepareChartMapIntroArt(table, introViewportWidth, mapHeight)).catch(() => false);
    void Promise.all([seenPromise, artPromise]).then(([seen, artDecoded]) => {
      if (active) setIntroPreparation({ width: introViewportWidth, seen, artDecoded });
    });
    return () => { active = false; };
  }, [phase, introViewportWidth]);

  useEffect(() => {
    const running = timers.current;
    return () => {
      running.forEach(clearTimeout);
      [panelOffset, ctaOpacity, explore, introOpacity, askIn].forEach((value) => cancelAnimation(value));
    };
  }, [askIn, ctaOpacity, explore, introOpacity, panelOffset]);

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

  /**
   * Plans a route from what the conversation produced. Photos in the conversation are already uploaded (they were sent
   * to Ask Chart by asset id), so nothing is uploaded here; a failure leaves the conversation exactly as it was.
   */
  const runPlan = useCallback(
    async (input: AskPlanInput) => {
      lastPlan.current = input;
      setStartingContext(input.startingContext ?? '');
      setActualStartingPoint(input.actualStartingPoint);
      const references: ChartReferenceWire[] = input.photoAssetIds.map((assetId, index) => ({ kind: 'photo', assetId, role: index === 0 ? 'start' : 'extra' }));
      setPhase('generating');
      setMappingKey((key) => key + 1);
      setGenerationMarkers(null);
      setError(null);
      planStarted.current = Date.now();
      trackChart('chart_generation_started', { hasVision, followUp: false, references: references.length });
      try {
        const response = await api.plan(anchorId, {
          idempotencyKey: freshKey(`chart-plan:${anchorId}`),
          startingContext: input.startingContext?.trim() || null,
          actualStartingPoint: input.actualStartingPoint.trim() || null,
          followUp: null,
          ...(references.length ? { references } : {}),
        });
        if (response.status === 'needs_context') {
          // The conversation always supplies a starting point, so this is unexpected: treat it as a failed attempt.
          trackChart('chart_generation_failed', { kind: 'needs_context' });
          setError(null);
          setPhase('failed');
          return;
        }
        acceptProposal(response.proposal);
        setGenerationMarkers(markersFor(toDraft(response.proposal)));
      } catch (caught) {
        const classified = classifyChartError(caught);
        if (classified.kind === 'premium_required' && onPremiumRequired) {
          // Not a failure: the conversation stays, and the paywall opens over it.
          setPhase('ask');
          onPremiumRequired();
          return;
        }
        trackChart('chart_generation_failed', { kind: classified.kind });
        setError(classified);
        setPhase('failed');
      }
    },
    [acceptProposal, anchorId, api, hasVision, onPremiumRequired]
  );

  const requestPlan = useCallback(
    (input: AskPlanInput, source: AskPlanSource) => {
      trackChart('chart_ask_plan_requested', { source, photos: input.photoAssetIds.length, hasVision });
      void runPlan(input);
    },
    [hasVision, runPlan]
  );

  /** Entrance → conversation: the opening fades away while the conversation settles in. */
  const enterAsk = useCallback(() => {
    trackChart('chart_creation_started', { hasVision });
    setAskMounted(true);
    if (reducedMotion) {
      introOpacity.value = 0;
      askIn.value = 1;
      setPhase('ask');
      return;
    }
    introOpacity.value = chartTiming(0, { duration: ASK_ENTRANCE.introOut, easing: CHART_EASING.exit });
    later(() => {
      setPhase('ask');
      askIn.value = chartTiming(1, { duration: ASK_ENTRANCE.askIn, easing: CHART_EASING.settle });
    }, ASK_ENTRANCE.introOut);
  }, [askIn, hasVision, introOpacity, reducedMotion]);

  // The finished map is already on screen; the cream review surface rises over it.
  const showReview = useCallback(() => {
    setPanelMounted(true);
    setPhase((current) => (current === 'generating' || current === 'failed' || current === 'ask' ? 'review' : current));
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
        actualStartingPoint: actualStartingPoint.trim() || null,
        draft: {
          destination: destination || identity.intention.slice(0, 140),
          waypoints: draft
            .filter((waypoint) => waypoint.title.trim())
            .map((waypoint) => ({
              title: waypoint.title,
              kind: waypoint.kind,
              progressMode: waypoint.progressMode,
            requirements: waypoint.requirements, completionCriteria: waypoint.completionCriteria,
              metricTarget: waypoint.metricTarget,
              metricBaseline: waypoint.metricBaseline,
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
      if (classified.kind === 'premium_required' && onPremiumRequired) return onPremiumRequired();
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
        actualStartingPoint: actualStartingPoint.trim() || null,
        proposalId: proposal?.proposalId ?? null,
        complexity: proposal?.complexity ?? null,
        routeScope: proposal?.routeScope,
        waypoints: waypoints.map((waypoint) => ({
          title: waypoint.title.trim(),
          rationale: waypoint.rationale,
          kind: waypoint.kind,
          progressMode: waypoint.progressMode,
    requirements: waypoint.requirements, completionCriteria: waypoint.completionCriteria,
          metricLabel: waypoint.metricLabel,
          metricTarget: waypoint.metricTarget,
          metricBaseline: waypoint.metricBaseline,
          suggestedMoves: waypoint.suggestedMoves,
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
      // "Looks right" is the confirmation; the First Waypoint reveal is the payoff, and it flows straight into the Chart.
      safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
      setPhase('revealed');
      if (reducedMotion) {
        panelOffset.value = 1;
        setPanelMounted(false);
        later(exploreChart, 320);
      } else {
        panelOffset.value = chartTiming(1, { duration: TT.panelOut, easing: CHART_EASING.deliberate });
        later(() => setPanelMounted(false), TT.panelOut + 40);
        // The map settles on the first waypoint for a beat, then rises into the permanent Chart.
        later(exploreChart, TT.panelOut + TT.revealCta + 500);
      }
    } catch (caught) {
      const classified = classifyChartError(caught);
      if (classified.code === 'ACTIVE_COURSE_EXISTS') {
        // Another device (or a lost response) already saved this Anchor's Chart.
        onExplore();
        return;
      }
      if (classified.kind === 'premium_required' && onPremiumRequired) {
        onPremiumRequired();
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
      // DEFERRED: exploreDelta.value = 0 ("the reusable world owns cover/camera projection"): ChartJourneyWorld did,
      // ChartMap does not. The stage draws the whole map top-aligned; the permanent Chart draws it CHART_MAP_TOP
      // below the safe area in a shorter viewport the camera centres. Rising by the difference lands every map
      // point (land, ink and the living weather, which share the camera) exactly where the Chart draws it.
      exploreDelta.value = chartMapScreenTop(width, height, insets.top, insets.bottom) - pageY;
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
      case 'ask':
        setPhase('intro');
        introOpacity.value = 1;
        askIn.value = 0;
        return true;
      case 'failed':
        setPhase('ask');
        return true;
      case 'adjusting':
        setPhase('review');
        return true;
      case 'review':
        setPanelMounted(false);
        panelOffset.value = 1;
        setPhase('ask');
        return true;
      case 'generating':
        return true; // Let the mapping finish; the request is already in flight.
      default:
        onBack();
        return true;
    }
  }, [askIn, introOpacity, onBack, panelOffset, phase]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  }, [goBack]);

  const namedCount = draft.filter((waypoint) => waypoint.title.trim()).length;
  const destinationLabel = destination || identity.intention;
  const reviewSupport = needsNaming ? CHART_COPY.review.outline : revised ? CHART_COPY.adjust.reviewSupport : chartReviewSupport(draft.length);

// DEFERRED:   const title =
// DEFERRED:     phase === 'intro'
// DEFERRED:       ? CHART_COPY.title
// DEFERRED:       : phase === 'generating'
// DEFERRED:         ? CHART_COPY.generation.headerTitle
// DEFERRED:         : phase === 'review'
// DEFERRED:           ? CHART_COPY.review.headerTitle
// DEFERRED:           : phase === 'adjusting'
// DEFERRED:             ? CHART_COPY.adjust.headerTitle
// DEFERRED:             : phase === 'revealed'
// DEFERRED:               ? CHART_COPY.revealed.headerTitle
// DEFERRED:               : CHART_COPY.creation.headerTitle;
// DEFERRED:
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
    generating: { headline: hasVision ? CHART_COPY.generation.headline : CHART_COPY.generation.neutralHeadline, support: '' },
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
  const showCourseReview = phase === 'review' || (phase === 'revealed' && panelMounted);
  const mapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: explore.value * exploreDelta.value }],
  }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, explore.value * 1.8) }));
  const introStyle = useAnimatedStyle(() => ({ opacity: introOpacity.value }));
  const askStyle = useAnimatedStyle(() => ({ opacity: askIn.value, transform: [{ translateY: (1 - askIn.value) * 10 }] }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value * (1 - Math.min(1, explore.value * 2.2)) }));

  return (
    <ChartInkScreen testID={testID ?? 'chart-creation'} paper={paper} onLayout={onScreenLayout}>
      {/* DEFERRED: <ChartTopBar title={title} onBack={phase === 'generating' || exploring ? undefined : goBack} identity={identity} tone={paper ? 'dark' : 'light'} /> */}
      {phase === 'ask' || phase === 'review' ? null : <Animated.View style={introStyle}><ChartMapHeader
        inline tone={paper ? 'paper' : 'ink'}
        categoryLabel={(identity.category ?? 'custom').toUpperCase()}
        category={identity.category} accent={panelAccent(identity.category)}
        visionImageUrl={null} hasVision={false}
        onBack={phase === 'generating' || exploring ? undefined : goBack}
        onOpenVision={onOpenVision}
        onBackgroundPress={phase === 'intro' ? requestIntroSkip : undefined}
      /></Animated.View>}

      {phase === 'intro' ? (
        <Animated.View style={[styles.flex, introStyle]} testID="chart-empty-state">
          {introViewportWidth !== null ? <ChartIntroOpening
            key={introViewportWidth}
            category={identity.category}
            categoryColor={getCategoryColor(identity.category)}
            reducedMotion={reducedMotion}
            replayMode={introReplayMode}
            preparing={introCoverHeld}
            onIntroSurfaceReady={markIntroSurfaceReady}
            initialSeen={introPreparation?.width === introViewportWidth ? introPreparation.seen : undefined}
            artReadyAtMount={introPreparation?.width === introViewportWidth && introPreparation.artDecoded}
            artPreparationSettledAtMount={introPreparation?.width === introViewportWidth || introCoverExpired}
            introWidth={introViewportWidth}
            skipRequest={introSkipRequest}
            onSequenceStart={onIntroStarted}
            onContinue={enterAsk}
          /> : null}
          {introCoverHeld ? <Pressable
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            accessible={false}
            onPress={requestIntroSkip}
            style={[StyleSheet.absoluteFill, styles.introPreparationCover]}
            testID="chart-intro-preparing"
          /> : null}
        </Animated.View>
      ) : null}

      {/* DEFERRED: the previous intro (road art + cream panel) is kept at the end of this file. */}

      {askMounted ? (
        <Animated.View style={[phase === 'ask' ? styles.flex : styles.hidden, askStyle]} pointerEvents={phase === 'ask' ? 'auto' : 'none'}>
          <ChartCreationAsk
            anchorId={anchorId}
            identity={identity}
            anchorArt={anchorArt}
            reducedMotion={reducedMotion}
            onBack={goBack}
            onPlan={requestPlan}
          />
        </Animated.View>
      ) : null}

      {/* DEFERRED: the previous follow-up screen (own ink screen) is kept at the end of this file; the clarity sheet now rises over the dimmed map. */}

      {phase === 'failed' ? (
        <ChartKeyboardFrame contentContainerStyle={styles.scroll}>
          <View style={styles.section} testID="chart-generation-failed">
            <Text accessibilityRole="header" style={styles.question}>
              {errorCopy(error)}
            </Text>
            <Text style={styles.support}>{CHART_COPY.errors.generationSupport}</Text>
            <ChartInkButton
              label={CHART_COPY.errors.retry}
              onPress={() => (lastPlan.current ? void runPlan(lastPlan.current) : setPhase('ask'))}
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

          {phase !== 'review' ? <Animated.View
            style={[styles.hero, styles.stageHero, heroStyle, chromeStyle, phase === 'revealed' && styles.hidden]}
            // DEFERRED: onLayout={(event) => setHeroHeight(event.nativeEvent.layout.height)}
            pointerEvents="none"
          >
            <Text accessibilityRole="header" style={[styles.display, styles.displayPaper, compact && shownHero !== 'generating' && styles.displayCompact]}>
              {heroCopy[shownHero].headline}
            </Text>
            {heroCopy[shownHero].support ? <Text style={[styles.support, styles.supportPaper, compact && shownHero !== 'generating' && styles.supportCompact]}>
              {heroCopy[shownHero].support}
            </Text> : null}
          </Animated.View> : null}

          {/* DEFERRED: measured heroHeight positioned this panel before staged copy finished changing. Flow layout owns the boundary now. */}
          {showCourseReview ? (
            <Animated.View style={[StyleSheet.absoluteFill, styles.reviewSurface, panelStyle]} pointerEvents={phase === 'review' ? 'auto' : 'none'}>
              <ChartCourseReviewScreen
                destination={destinationLabel}
                waypoints={draft}
                oneMove={oneMove}
                onOneMoveChange={setOneMove}
                onWaypointsChange={setDraft}
                onEdit={(kind) => trackChart(kind === 'add' ? 'chart_waypoint_added' : 'chart_waypoint_edited', { stage: 'review', kind })}
                guidance={proposal?.guidance && !needsNaming ? proposal.guidance : null}
                needsNaming={needsNaming}
                saveError={saveError}
                saving={saving}
                canConfirm={namedCount > 0 && (!needsNaming || namedCount >= draft.length)}
                onAdjust={() => setPhase('adjusting')}
                onConfirm={() => void save()}
                topInset={insets.top}
              />
            </Animated.View>
          ) : null}
          {panelMounted && phase === 'adjusting' ? (
            <Animated.View style={[styles.panelWrap, panelStyle]}>
              <ChartCreamPanel style={styles.reviewPanel}>
                <ChartKeyboardFrame
                  contentContainerStyle={styles.reviewScroll}
                  restingBottom={spacing[3]}
                  footer={null}
                >
                  <ChartAdjustPanel onSubmit={submitAdjust} loading={adjusting} error={adjustError} testID="chart-adjust-panel" />
                </ChartKeyboardFrame>
              </ChartCreamPanel>
            </Animated.View>
          ) : null}

          {/* DEFERRED: the separate "Explore your Chart" screen. "Looks right" now plays the First Waypoint reveal and flows into the Chart. */}
        </View>
      ) : null}
    </ChartInkScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  introPreparationCover: { backgroundColor: colors.canvas, zIndex: 10 },
  flexEnd: { flex: 1, justifyContent: 'flex-end' },
  hero: { paddingHorizontal: spacing[5], paddingTop: spacing[3], gap: spacing[2], zIndex: 1 },
  // DEFERRED: absolute stage hero required measuring text during the staged copy swap.
  stageHero: { flexShrink: 0 },
  display: { ...typography.displayMedium, fontFamily: CHART_MAP_TOKENS.serif, fontSize: 34, lineHeight: 38, color: colors.ink.text.primary },
  support: { ...typography.bodyLG, color: colors.ink.text.secondary },
  guidance: { ...typography.bodySM, color: colors.text.secondary, marginBottom: spacing[1] },
  displayCompact: { fontSize: 28, lineHeight: 32 },
  supportCompact: { ...typography.bodyMD },
  question: { ...typography.headingLG, fontFamily: CHART_MAP_TOKENS.serif, color: colors.ink.text.primary },
  introLandscape: { position: 'absolute', left: 0, bottom: 0 },
  hidden: { display: 'none' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,24,32,.45)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '16%' },
  sheet: { flex: 1, paddingTop: spacing[5] },
  sheetScroll: { gap: spacing[3], paddingBottom: spacing[3] },
  sheetQuestion: { ...typography.headingLG, fontFamily: CHART_MAP_TOKENS.serif, color: colors.text.primary },
  sheetSub: { ...typography.bodyMD, color: colors.text.primary, marginTop: spacing[2] },
  introMap: { position: 'absolute', bottom: 0 },
  introScrim: { position: 'absolute', left: 0, right: 0, top: -spacing[8], bottom: 0 },
  introCopy: { paddingHorizontal: spacing[5], gap: spacing[2] },
  displayPaper: { color: colors.text.primary },
  supportPaper: { color: colors.text.secondary },
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
  panelWrap: { flex: 1, marginTop: spacing[3] },
  reviewSurface: { zIndex: 5, backgroundColor: colors.canvas },
  reviewPanel: { flex: 1, paddingTop: spacing[4], borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default },
  reviewScroll: { paddingBottom: spacing[4] },
  revealFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing[5], paddingTop: spacing[3] },
  pressed: { opacity: 0.8 },
});

/* DEFERRED: previous intro block, replaced by the etched map.
{phase === 'intro' ? (
  <View style={styles.flex} testID="chart-empty-state">
    <View style={styles.hero}>
      <Text accessibilityRole="header" style={styles.display}>
        {CHART_COPY.empty.headline}
      </Text>
      <Text style={styles.support}>{CHART_COPY.empty.support}</Text>
    </View>
    <View style={styles.flexEnd}>
      <ChartJourneyWorld
        width={width}
        height={Math.max(260, height * .42)}
        category={identity.category}
        accessibilityLabel="A road toward the city"
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
*/

/* DEFERRED: previous follow-up screen, replaced by the clarity sheet over the map.
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
*/

/* DEFERRED: previous revealed-screen CTA, replaced by the automatic reveal.
          {phase === 'revealed' ? (
            <Animated.View style={[styles.revealFooter, { paddingBottom: insets.bottom + spacing[4] }, ctaStyle]}>
              <ChartInkButton
                label={CHART_COPY.revealed.cta}
                variant="outline"
                paper
                onPress={exploreChart}
                disabled={exploring}
                icon={<ArrowRight size={18} color={colors.text.primary} />}
                testID="chart-explore"
              />
            </Animated.View>
          ) : null}
*/
