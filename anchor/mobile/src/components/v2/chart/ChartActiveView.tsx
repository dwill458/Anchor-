import { useCelebrationActive } from '@/hooks/v2/teaching/useCelebrationActive';
import type { ViewInstance } from 'react-native';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { WifiOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { V2SheetModal } from '@/components/v2/primitives/V2SheetModal';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import type { ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import type { UseAnchorChartResult, WaypointReachResult } from '@/hooks/v2/chart/useAnchorChart';
import { useAuthStore } from '@/stores/authStore';
import { useChartHighWater } from '@/hooks/v2/chart/chartHighWater';
import { useChartOpenedToday } from '@/hooks/v2/chart/chartLastOpened';
import { beginGuidanceAction } from '@/hooks/v2/guidance/guidanceActions';
import { useGuidanceHost } from '@/hooks/v2/guidance/useGuidanceHost';
import { discoverGuidance, replayGuidance } from '@/hooks/v2/guidance/guidanceRuntime';
import { useCelebrationReduceMotion } from '@/hooks/useCelebrationReduceMotion';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { isRouteRevisionFresh, useChartRouteRevisionStore } from '@/stores/v2/chartRouteRevisionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { safeHaptics } from '@/utils/haptics';
import { syncChartNotifications } from '@/services/notifications/chartNotifications';
import { colors, getCategoryColor, radii, spacing } from '@/theme/v2';
import type { CourseDetail, MoveSummary, WaypointSummary } from '@/types/chart';
import { ChartInkButton, ChartInkCard, type ChartIdentity } from './ChartChrome';
import type { ChartAnchorArt } from './ChartLandscape';
import { chartTypography as typography } from './chartTypography';
import { CHART_EASING, CHART_MAP_REDUCED_FADE, CHART_MAP_TIMING } from './chartMotion';
import { ChartMap } from './map/ChartMap';
// DEFERRED: import { ChartScallop } from './map/ChartScallop';
import type { ChartMapMarker, ChartMarkerRenderState, ChartRouteRevision, SequenceSpec } from './map/chartMapContracts';
import { buildRouteTable, waypointPlacement } from './map/chartMapGeometry';
import {
  laterSequence, moveCheckSequence, moveHoldArc, moveHoldSequence, openSequence, reachSequence, routeRevisedSequence, summitSequence, waypointTapSequence,
  type ChartBeat,
} from './map/chartMapSequences';
import { ChartSummitPanel } from './ChartSummitPanel';
import { useScreenFocused } from './map/ChartMapWeather';
import { peekChartWeatherHandoff } from './map/chartWeatherHandoff';
import { ChartWeatherVeilPrimer } from './map/ChartWeatherNativeVeil';
import { CHART_MAP_TOKENS as T } from './map/chartMapTokens';
import { nextHighWater, routeRevealArc, toProgressInput } from './map/chartProgress';
import { useChartMapAnimState } from './map/useChartMapAnimState';
import { routeAdjustEvidence } from './map/chartRhythm';
import { useChartSequencer } from './map/useChartSequencer';
import { ChartMapHeader } from './panel/ChartMapHeader';
import { panelAccent } from './panel/chartPanelColors';
// DEFERRED: import { ChartWaypointContent } from './ChartWaypointContent';
import { ChartSheet, chartSheetDetents, type ChartSheetHandle, type ChartSheetDetent, type ChartSheetViewport } from './sheet/ChartSheet';
import { ChartSheetContent } from './sheet/ChartSheetContent';
import { ChartOneMoveTeaching } from './sheet/ChartOneMoveTeaching';
import type { ChartOneMoveTargetRefs } from './sheet/chartOneMoveTypes';
import { chartMapScreenTop } from './map/ChartWeatherHold';
import { ChartConfirmSheet } from './panel/ChartConfirmSheet';
import { ChartReachBeat } from './ChartReachBeat';
import { useChartSound } from './useChartSound';
import { useMilestonePresentationHold } from '@/hooks/v2/milestones/useMilestonePresentationHold';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';

export type ChartVisionPreview = { imageUrl: string | null; description: string | null; title: string | null };

export type ChartCelebration = {
  completedTitle: string;
  nextTitle: string | null;
  /** Route fraction the Anchor travels from (before the reach). */
  fromFraction: number;
};

type ChartActions = Pick<
  UseAnchorChartResult,
  | 'busy'
  | 'addMove'
  | 'acceptMove'
  | 'completeMove'
  | 'dismissMove'
  | 'suggestMoves'
  | 'updateProgress'
  | 'reachWaypoint'
  | 'editWaypoint'
  | 'removeWaypoint'
> &
  Partial<Pick<UseAnchorChartResult, 'setCurrentMove' | 'archiveChart' | 'deleteChart'>>;

type Props = {
  view: ChartViewModel;
  identity: ChartIdentity;
  anchorArt: ChartAnchorArt | null;
  vision: ChartVisionPreview | null;
  stale: boolean;
  busyKey: string | null;
  reducedMotion: boolean;
  celebration: ChartCelebration | null;
  onCelebrationDone: () => void;
  /** A confirmed reach has finished its scene and normal completion feedback. */
  onMilestoneBoundary?: (waypointId: string) => void;
  onBack: () => void;
  onOpenWaypoint?: (waypointId: string) => void;
  chartActions?: ChartActions;
  initialWaypointId?: string | null;
  onWaypointReached?: (result: WaypointReachResult, previousReachedCount: number, total: number) => void;
  onSpatialModeChange?: (focused: boolean) => void;
  onCompleteMove: (moveId: string) => Promise<boolean>;
  onOpenVision: () => void;
  onOpenLog: () => void;
  onAdjust: () => void;
  onRelease?: () => void;
  actionError: string | null;
  /**
   * How the screen was reached. 'reveal' continues straight from the creation
   * reveal (the map is already in place, so it is not redrawn: the open runs as
   * instant state changes and only the panel arrives); 'open' is an ordinary
   * visit (the route draws once, the flag settles, the camera lands).
   */
  entrance?: 'reveal' | 'open';
  /** Focus (recommendedMode 'focus') or Deep Focus ('deep_prime') from the day-closed card. */
  onOpenPractice?: (mode: 'focus' | 'deep_prime') => void;
  /** Opens the existing Anchor Details screen from the sheet. */
  onOpenAnchor?: () => void;
  /** Opens Ask Chart from the sheet ("Help me move forward"). */
  onAskChart?: () => void;
  /** The Anchor's stored Thread Strength (0–100) for the sheet's Anchor card. */
  threadStrength?: number | null;
  /** The raw Course: the view drops each metric's baseline, which the progress rules need. */
  course?: CourseDetail;
  testID?: string;
};

/** Travelled fraction: the Anchor sits at the last reached waypoint (0 = START). */
export function travelledFraction(view: Pick<ChartViewModel, 'reachedCount' | 'total' | 'isFinished'>): number {
  if (view.total === 0) return 0;
  if (view.isFinished) return 1;
  return Math.min(1, view.reachedCount / view.total);
}

/** Used when a host (the dev lab) renders the view without live actions: the panel stays read-only. */
const NO_ACTIONS: ChartActions = {
  busy: null,
  addMove: async () => false,
  acceptMove: async () => false,
  completeMove: async () => false,
  dismissMove: async () => false,
  suggestMoves: async () => 'failed',
  updateProgress: async () => false,
  reachWaypoint: async () => null,
  editWaypoint: async () => false,
  removeWaypoint: async () => false,
  archiveChart: async () => false,
  deleteChart: async () => false,
};

/** A move-check that has been sent and is waiting for the server's new Chart. */
type PendingMove = { baseline: number; moveId: string };
/** `filled`: the reached marker has filled (the scene's 1000 ms beat); until then it stays open. */
type Ceremony = { index: number; advanced: boolean; filled: boolean; isLast: boolean };

/** Celebration levels (celebrationStore): a waypoint reach outranks a checked move. */
export const CHART_SUMMIT_SCENE_LEVEL = 4;
export const CHART_WAYPOINT_SCENE_LEVEL = 3;
export const CHART_MOVE_SCENE_LEVEL = 2;
export const CHART_ROUTE_REVISED_SCENE_LEVEL = 1;
/** One scene id per waypoint: every entry point that reaches it resolves to the same id, so it plays once. */
export const chartWaypointSceneId = (waypointId: string) => `chart-waypoint:${waypointId}`;
export const chartMoveSceneId = (moveId: string) => `chart-move:${moveId}`;
/** The summit is the one scene for the whole Chart (its final waypoint never also plays a waypoint scene). */
export const chartSummitSceneId = (courseId: string) => `chart-summit:${courseId}`;
/** One scene per saved revision (the signal's nonce). */
export const chartRouteRevisedSceneId = (nonce: number) => `chart-route-revised:${nonce}`;
type ReachEvent = { index: number; result: WaypointReachResult; previousReachedCount: number; total: number };

/** Waits this long for the server's new Chart before giving up on the day-closed hold. */
const DAY_CLOSED_HOLD_FALLBACK_MS = 1500;
/** The open waits at most this long for the stored "opened today" day, then plays the full open. */
const OPEN_DECIDE_MAX_MS = 150;

export function ChartActiveView({
  view,
  identity,
  anchorArt,
  vision,
  stale,
  reducedMotion,
  celebration,
  onCelebrationDone,
  onMilestoneBoundary,
  onBack,
  onOpenWaypoint,
  chartActions,
  initialWaypointId = null,
  onWaypointReached,
  onSpatialModeChange,
  onCompleteMove,
  onOpenVision,
  onOpenLog,
  onAdjust,
  onRelease,
  actionError,
  entrance = 'open',
  onOpenPractice,
  onOpenAnchor,
  onAskChart,
  threadStrength,
  course,
  testID,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // DEFERRED: const mapHeight = Math.min(width * 1180 / 852, Math.max(240, height - insets.top - insets.bottom - 360));
  const sheetRef = useRef<ChartSheetHandle>(null);
  const detentRef = useRef<ChartSheetDetent>('hidden');
  const frame = useMemo(() => ({ mode: 'fullBleed' as const, artTop: chartMapScreenTop(width, height, insets.top, insets.bottom) }), [width, height, insets.top, insets.bottom]);
  const sheetPositions = chartSheetDetents(height, insets.top, insets.bottom);
  const categoryColor = getCategoryColor(identity.category);
  const accent = useMemo(() => panelAccent(identity.category), [identity.category]);

  /* ---- map state -------------------------------------------------- */
  const table = useMemo(() => buildRouteTable(), []);
  const placement = useMemo(() => waypointPlacement(Math.max(1, view.total)), [view.total]);
  const currentIndex = view.isFinished ? -1 : view.currentIndex;
  /* ---- open choice: first open of the day, or a later one (presentation-only marker) ---- */
  const opened = useChartOpenedToday(view.courseId);
  const markOpened = opened.markOpened;
  // Known synchronously (session memory) when this Chart was already opened today: start settled, never closed.
  const startsSettled = entrance === 'reveal' || reducedMotion || (opened.loaded && opened.openedToday);
  // "Explore your Chart": the creation stage's map continues here unchanged: the same cover, closed = 0, and the
  // shared drift clock. Read once, before the first frame. The ink is never handed off (route honesty).
  const revealHandoff = useRef(entrance === 'reveal' ? peekChartWeatherHandoff() : null).current;
  // Every open but the reveal and Reduce Motion starts under closed cover (the frame-one veil shows the same) and
  // parts it; the open's pushed-in camera is set from the first render, because the native veil frames from it.
  // DEFERRED: closed: startsSettled ? 0 : 1 (a later visit opened already parted, under a closed-cover veil).
  const startsClosed = entrance !== 'reveal' && !reducedMotion;
  const pushedIn = !startsSettled && currentIndex >= 0;
  const anim = useChartMapAnimState({
    // DEFERRED: revealArc: revealHandoff?.inkArc ?? 0 (the reveal kept creation's inked first leg, which the next
    // day's open then drew back from real progress: the route retreated overnight).
    revealArc: 0,
    flagIndex: Math.max(0, currentIndex),
    closed: startsClosed ? 1 : 0,
    camera: pushedIn ? CHART_MAP_TIMING.open.startCamera : undefined,
  });
  // The open waits for the map's first drawn frame (ChartMap onShown), so it starts exactly as the veil goes.
  const [mapShown, setMapShown] = useState(false);
  const onMapShown = useCallback(() => setMapShown(true), []);
  const baseRunner = useChartSequencer(reducedMotion);
  const sequenceBusy = useSharedValue(false);
  const [swapRevision, setSwapRevision] = useState(0);
  const sequenceSerial = useRef(0);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const runner = useMemo(() => ({
    ...baseRunner,
    run: (spec: SequenceSpec) => {
      const serial = ++sequenceSerial.current;
      sequenceBusy.value = true;
      const onEnd = spec.onEnd;
      return baseRunner.run({ ...spec, onEnd: () => {
        onEnd?.();
        if (serial === sequenceSerial.current) { sequenceBusy.value = false; if (mounted.current) setSwapRevision(value => value + 1); }
      } }).finally(() => {
        if (serial === sequenceSerial.current && sequenceBusy.value) { sequenceBusy.value = false; if (mounted.current) setSwapRevision(value => value + 1); }
      });
    },
  }), [baseRunner, sequenceBusy]);

  /* ---- sound + haptics ---------------------------------------------- */
  const sound = useChartSound(reducedMotion);
  const hapticsOn = useSettingsStore((state) => state.hapticIntensity > 0);
  const hapticsRef = useRef(hapticsOn);
  hapticsRef.current = hapticsOn;
  const soundRef = useRef(sound);
  soundRef.current = sound;
  // Celebration scenes (waypoint reached, move done) follow the single celebration Reduce Motion source.
  const sceneReduced = useCelebrationReduceMotion() || reducedMotion;
  /**
   * Beat -> sound (+ haptic). `inkMs` is the length of the pen stroke at this call site; `waypointNumber` picks the
   * pitch of the waypoint note. A reached waypoint has one haptic (the `note` beat's Light), a checked move has one
   * (the tap's Light, in ChartWaypointContent), the summit has one (the `summit` beat's Heavy, at the flag) and a revised
   * route has one (the `pop` beat's Light, and no sound at all). `check` and `stamp` are sound only: nothing in the
   * Chart gives a Medium haptic any more.
   */
  const beatHandler = useCallback(
    (inkMs: number, waypointNumber = 1) => (beat: ChartBeat) => {
      const s = soundRef.current;
      const haptics = hapticsRef.current;
      if (beat === 'open') s.open();
      else if (beat === 'ink') s.ink(inkMs);
      else if (beat === 'inkHold') s.inkHold();
      else if (beat === 'note') {
        s.note(waypointNumber);
        if (haptics) void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
      } else if (beat === 'flag') {
        s.flag();
        if (haptics) void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
      } else if (beat === 'check') {
        s.check();
      } else if (beat === 'stamp') {
        s.stamp();
      } else if (beat === 'wind') s.wind();
      else if (beat === 'hush') s.hush(CHART_MAP_TIMING.summit.stillHold);
      else if (beat === 'summit') {
        // The flag plants: the one Heavy haptic of the summit, with the thud and the chord.
        s.summit();
        if (haptics) void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (beat === 'pop') {
        // A revised route is a plan: one Light haptic and no sound at all.
        if (haptics) void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    []
  );
  // The entrance owns the air bed. Losing focus also stops it, including mid-opening.
  const focused = useScreenFocused();
  const milestoneFocused = useRef(focused);
  milestoneFocused.current = focused;
  useEffect(() => {
    if (!focused) {
      sound.stopAir();
      return undefined;
    }
    return () => sound.stopAir();
  }, [focused, sound]);

  /* ---- progress (server data + presentation-only high-water) ------- */
  const rawMetrics = useMemo(() => {
    const byId = new Map<string, WaypointSummary['metric']>();
    for (const waypoint of course?.waypoints ?? []) byId.set(waypoint.id, waypoint.metric ?? null);
    return byId;
  }, [course]);
  const inputs = useMemo(
    () => view.waypoints.map((waypoint) => toProgressInput(waypoint, rawMetrics.get(waypoint.id))),
    [view.waypoints, rawMetrics]
  );
  const [sheetDetent, setSheetDetent] = useState<ChartSheetDetent>('hidden');
  const celebrationActive = useCelebrationActive();
  const [teachingViewportRevision, setTeachingViewportRevision] = useState(0);
  const [openingFinished, setOpeningFinished] = useState(false);
  const trackedOneMoveIdRef = useRef<string | null>(null);
  useEffect(() => {
    const moveId = view.oneMove?.id ?? null;
    if (moveId && trackedOneMoveIdRef.current !== moveId) {
      trackedOneMoveIdRef.current = moveId;
      AnalyticsService.track(AnalyticsEvents.ONE_MOVE_OPENED, { course_id: view.courseId, waypoint_id: view.oneMove?.waypointId ?? undefined, has_one_move: true });
    }
  }, [view.courseId, view.oneMove?.id, view.oneMove?.waypointId]);
  const oneMoveRowRef = useRef<ViewInstance>(null);
  const oneMoveCircleRef = useRef<ViewInstance>(null);
  const oneMoveBodyRef = useRef<ViewInstance>(null);
  const oneMoveViewportRef = useRef<ChartSheetViewport | null>(null);
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const teachingTargets: ChartOneMoveTargetRefs = { rowRef: oneMoveRowRef, circleRef: oneMoveCircleRef, bodyRef: oneMoveBodyRef };
  const onTeachingViewportLayout = useCallback(() => setTeachingViewportRevision(value => value + 1), []);
  const requestTeachingVisibility = useCallback(() => sheetRef.current?.snapTo(sheetDetent === 'half' ? 'full' : 'half'), [sheetDetent]);
  const highWater = useChartHighWater(undefined, view.courseId);
  const commitHighWater = highWater.commit;
  // Reveal targets use the in-memory max immediately; nothing is persisted until the stored map has loaded
  // (so a slow read can never overwrite marks, and guests simply keep the in-memory map).
  const hwLoaded = highWater.loaded;
  const effectiveHw = useMemo(() => nextHighWater(highWater.map, inputs), [highWater.map, inputs]);
  useEffect(() => {
    if (hwLoaded && effectiveHw !== highWater.map) commitHighWater(effectiveHw);
  }, [hwLoaded, effectiveHw, highWater.map, commitHighWater]);

  const revealTarget = useMemo(
    () => routeRevealArc({ inputs, currentIndex: view.currentIndex, isFinished: view.isFinished, hw: effectiveHw, placement, table }),
    [inputs, view.currentIndex, view.isFinished, effectiveHw, placement, table]
  );
  const revealTargetRef = useRef(revealTarget);
  revealTargetRef.current = revealTarget;

  const allMoves = useMemo<MoveSummary[]>(() => course?.moves ?? view.waypoints.flatMap((waypoint) => waypoint.moves), [course, view.waypoints]);
  const completedMoves = useMemo(() => view.waypoints.reduce((sum, waypoint) => sum + waypoint.moves.filter((move) => move.status === 'COMPLETED').length, 0), [view.waypoints]);
  const completedMovesRef = useRef(completedMoves);
  completedMovesRef.current = completedMoves;

  /* ---- interaction state ------------------------------------------ */
  const initialIndex = useMemo(() => {
    const found = initialWaypointId ? view.waypoints.findIndex((waypoint) => waypoint.id === initialWaypointId) : -1;
    return found >= 0 ? found : Math.max(0, Math.min(view.total - 1, view.currentIndex));
    // The first render decides; later focus changes come from taps.
  }, []);
  const [viewIdx, setViewIdx] = useState(initialIndex);
  // A route-list row selects its marker and aims the camera without swapping the panel or moving the sheet.
  const [routeFocusIdx, setRouteFocusIdx] = useState<number | null>(null);
  const [arrived, setArrived] = useState(view.isFinished);
  const [commit, setCommit] = useState<{ number: number } | null>(null);
  const [ceremony, setCeremony] = useState<Ceremony | null>(null);
  const [dayHold, setDayHold] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showStillRight, setShowStillRight] = useState(false);
  const [reachEvent, setReachEvent] = useState<ReachEvent | null>(null);

  const zoomedRef = useRef(false);
  const openedRef = useRef(false);
  const reachingRef = useRef(false);
  const reachIdRef = useRef<{ index: number; previousReachedCount: number } | null>(null);
  /** Reach requests in flight per waypoint: a second entry point for the same waypoint shares the first's request. */
  const reachRequestsRef = useRef(new Map<string, Promise<WaypointReachResult | null>>());
  /** Waypoint scenes begun on this mount (ids). A waypoint's scene never plays twice, whichever entry point reports it. */
  const reachScenesRef = useRef(new Set<string>());
  /** Coordinator scene ids this view has requested and not yet finished (waypoint, move). */
  const waypointSceneRef = useRef<string | null>(null);
  const moveSceneRef = useRef<string | null>(null);
  const summitSceneRef = useRef<string | null>(null);
  const routeSceneRef = useRef<string | null>(null);
  /** A reach ceremony (waypoint scene or arrival) has begun and not yet finished. */
  const ceremonyLiveRef = useRef(false);
  const lastArcRef = useRef(0);
  const courseIdRef = useRef(view.courseId);
  const placementSigRef = useRef(`${placement.n}|${view.waypoints.map((waypoint) => waypoint.id).join(',')}`);
  const pendingMoveRef = useRef<PendingMove | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrationRef = useRef(celebration);
  celebrationRef.current = celebration;
  const viewIdxRef = useRef(viewIdx);
  viewIdxRef.current = viewIdx;

  /* ---- celebration coordinator ------------------------------------- */
  // A tap lands the waypoint scene on its settled state, only while it is the active skippable scene.
  const reachSceneId = ceremony && !ceremony.isLast && view.waypoints[ceremony.index]
    ? chartWaypointSceneId(view.waypoints[ceremony.index].id)
    : null;
  // The summit is skippable too (S1): the same Skip button lands it settled.
  const summitSceneId = chartSummitSceneId(view.courseId);
  const sceneSkippable = useCelebrationStore((state) => Boolean(
    state.active?.skippable && (state.active.id === summitSceneId || (reachSceneId !== null && state.active.id === reachSceneId))
  ));
  // Leaving the Chart mid-scene releases the coordinator (an active scene is cleared, a waiting one is removed).
  useEffect(() => () => {
    const store = useCelebrationStore.getState();
    if (waypointSceneRef.current) store.finish(waypointSceneRef.current);
    if (moveSceneRef.current) store.finish(moveSceneRef.current);
    if (summitSceneRef.current) store.finish(summitSceneRef.current);
    if (routeSceneRef.current) store.finish(routeSceneRef.current);
    waypointSceneRef.current = null;
    moveSceneRef.current = null;
    summitSceneRef.current = null;
    routeSceneRef.current = null;
  }, []);

  /* ---- summit + route-revised presentation state --------------------- */
  // Summit (S1): the cream completion panel takes the sheet's place; the flag planted at the X stays once arrived.
  const [summitPanel, setSummitPanel] = useState(false);
  const [flagPlanted, setFlagPlanted] = useState(false);
  const summitPanelProgress = useSharedValue(0);
  // Route revised (R1): rests at 1 (the settled pencil route), so an unrevised Chart draws as ever.
  const revisionOut = useSharedValue(1);
  const revisionPen = useSharedValue(1);
  const revisionPencil = useSharedValue(1);
  const revision = useMemo<ChartRouteRevision>(() => ({ out: revisionOut, pen: revisionPen, pencil: revisionPencil }), [revisionOut, revisionPen, revisionPencil]);
  /** A saved revision is waiting to play (or playing): the revised markers ahead of the current one stay back until the new waypoint appears. */
  const [reviseHold, setReviseHold] = useState(false);

// DEFERRED:   const panel = useSharedValue(0);
// DEFERRED:   const showPanel = useCallback(() => {
// DEFERRED:     panel.value = withTiming(1, {
// DEFERRED:       duration: reducedMotion ? CHART_MAP_REDUCED_FADE : CHART_MAP_TIMING.open.panel,
// DEFERRED:       easing: Easing.out(Easing.cubic),
// DEFERRED:       reduceMotion: ReduceMotion.Never,
// DEFERRED:     });
// DEFERRED:   }, [panel, reducedMotion]);
// DEFERRED:   const panelStyle = useAnimatedStyle(() => ({
// DEFERRED:     opacity: panel.value,
// DEFERRED:     transform: [{ translateY: reducedMotion ? 0 : (1 - panel.value) * 12 }],
// DEFERRED:   }));
// DEFERRED:
  const showPanel = useCallback(() => sheetRef.current?.snapTo('peek'), []);

  /** Static end states for a Chart that is already finished when it opens. */
  const settleArrived = useCallback(() => {
    anim.glyph.value = 1;
    anim.goldDot.value = 1;
    anim.fog.value = 1;
    anim.coverArc.value = table.total;
    anim.flagOpacity.value = 0;
  }, [anim, table]);

  /* ---- open -------------------------------------------------------- */
  // The reveal hand-off map is already on screen (creation stays over it until this map has drawn), so
  // nothing fades in and the flag never leaves its waypoint.
  useLayoutEffect(() => {
    // DEFERRED: anim.mapOpacity.value = 0 for every entrance. With living weather the map is gated on the
    // weather being ready and frame one is full cloud cover, so only the instant paths fade the map in.
    // DEFERRED: the reveal entrance faded the map in over 180 ms too.
    // DEFERRED: if (startsSettled && entrance !== 'reveal') anim.mapOpacity.value = 0; Reduce Motion now opens under
    // the frame-one veil, which cross-fades away over the finished map (never a fade from bare paper).
    if (entrance === 'reveal') {
      anim.closed.value = 0;
      anim.coverArc.value = Math.max(revealTarget, revealHandoff?.coverArc ?? 0);
    }
    // DEFERRED: anim.flagOpacity.value = 0 for every entrance.
    if (entrance !== 'reveal' || currentIndex < 0) anim.flagOpacity.value = 0;
    if (!startsSettled && currentIndex >= 0) {
      // Frame one matches the loading hold: closed weather under the open's pushed-in camera.
      const start = CHART_MAP_TIMING.open.startCamera;
      anim.camera.cx.value = start.cx;
      anim.camera.cy.value = start.cy;
      anim.camera.s.value = start.s;
    }
    // Mount-only: the open sequence owns these values from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim]);

  // The open waits for the stored "opened today" day, but never more than OPEN_DECIDE_MAX_MS.
  const [openTimedOut, setOpenTimedOut] = useState(false);
  useEffect(() => {
    if (opened.loaded) return undefined;
    const timer = setTimeout(() => setOpenTimedOut(true), OPEN_DECIDE_MAX_MS);
    return () => clearTimeout(timer);
  }, [opened.loaded]);
  // DEFERRED: const openReady = opened.loaded || openTimedOut;
  const openReady = (opened.loaded || openTimedOut) && mapShown;
  const openedTodayRef = useRef(false);
  openedTodayRef.current = opened.loaded && opened.openedToday;

  useEffect(() => {
    if (!openReady || openedRef.current) return undefined;
    openedRef.current = true;
    let cancelled = false;
    const reveal = entrance === 'reveal';
    // DEFERRED: const revealTo = reveal ? Math.max(revealTarget, revealHandoff?.inkArc ?? 0) : revealTarget;
    // The ink is always real progress, on every entrance.
    const revealTo = revealTarget;
    lastArcRef.current = revealTo;
    if (view.isFinished) settleArrived();
    const instant = reducedMotion || reveal;
    const later = !instant && openedTodayRef.current;
    markOpened();
    const context = {
      anim,
      placement,
      revealTo,
      currentIndex,
      reducedMotion: instant,
      onPanel: showPanel,
    };
    // DEFERRED: fadeIn: reveal ? false : undefined. No entrance fades the map in from paper any more: the reveal
    // continues creation's map and every other open starts under the frame-one veil.
    const spec = later
      ? laterSequence({ ...context, reducedMotion, partFromClosed: true })
      : openSequence({
          ...context,
          onBeat: instant ? undefined : beatHandler(CHART_MAP_TIMING.open.route),
          coverTo: reveal ? revealHandoff?.coverArc : undefined,
          fadeIn: false,
        });
    zoomedRef.current = false;
    if (!instant && focused) soundRef.current.startAir();
    void runner.run(spec).then(() => {
      // Both finishing and cancelling the opening settle its promise. Never carry ambience into reading/editing.
      soundRef.current.stopAir();
      // A deep link to another waypoint lands there after the map has opened.
      if (cancelled) return;
      const target = viewIdxRef.current;
      if (instant || view.isFinished || target === currentIndex) { setOpeningFinished(true); return; }
      zoomedRef.current = true;
      void runner.run(waypointTapSequence({ anim, point: placement.points[target] ?? null, toOverview: false, reducedMotion: false })).then(() => setOpeningFinished(true));
    });
    return () => {
      soundRef.current.stopAir();
      cancelled = true;
      openedRef.current = false;
    };
    // Runs once per mount, as soon as the open can be chosen: later changes are driven by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openReady]);

  useEffect(() => { if (view.completedMoveCount > 0) discoverGuidance(accountId ?? 'guest', 'chart.next_move'); }, [accountId, view.completedMoveCount]);
  const chartGuidance = useGuidanceHost({ screenId: 'chart', accountId, contextKey: view.courseId, targetKey: view.oneMove?.id, targetRevision: teachingViewportRevision,
    eligible: view.oneMove && !view.isFinished && view.completedMoveCount === 0 ? ['chart.next_move'] : [],
    isFocused: focused,
    blocked: celebrationActive || dayHold || !oneMoveRowRef.current || !oneMoveCircleRef.current || !oneMoveBodyRef.current || !openingFinished || !openedRef.current || runner.isBusy() || reachingRef.current || Boolean(ceremony || reachEvent || confirmOpen || menuOpen) || (sheetDetent !== 'peek' && sheetDetent !== 'half'),
  });
  const teachingVisible = Boolean(chartGuidance.presentation);
  const teachingReplayVersion = Number(chartGuidance.presentation?.token ?? 0);
  const replayTeaching = useCallback(() => { void replayGuidance(accountId ?? 'guest', 'chart.next_move'); }, [accountId]);
  const markTeachingShown = chartGuidance.markShown;
  const dismissTeaching = chartGuidance.dismiss;

  /* ---- route follows server data ---------------------------------- */
  useEffect(() => {
    if (!openedRef.current || reachingRef.current || arrived) return;
    // Adding or removing waypoints re-spaces the route: re-anchor the drawn arc to the new target
    // (progress itself never retreats; the high-water map holds it in fraction space).
    const sig = `${placement.n}|${view.waypoints.map((waypoint) => waypoint.id).join(',')}`;
    if (sig !== placementSigRef.current) {
      placementSigRef.current = sig;
      anim.revealArc.value = revealTarget;
      anim.coverArc.value = revealTarget;
      lastArcRef.current = revealTarget;
      return;
    }
    const pending = pendingMoveRef.current;
    const moved = Boolean(pending && completedMoves > pending.baseline);
    const from = lastArcRef.current;
    const changed = Math.abs(revealTarget - from) >= 0.5;
    if (!moved && !changed) return;
    if (moved) pendingMoveRef.current = null;
    lastArcRef.current = Math.max(from, revealTarget);
    if (!moved && revealTarget < from) {
      // The drawn route never retreats (a lowered metric only changes the number); only a different course may start shorter.
      if (courseIdRef.current !== view.courseId) {
        courseIdRef.current = view.courseId;
        anim.revealArc.value = revealTarget;
        anim.coverArc.value = revealTarget;
      } else {
        lastArcRef.current = from;
      }
      return;
    }
    if (moved) sheetRef.current?.snapTo('peek');
    if (moved && pending && currentIndex >= 0 && moveHoldArc(placement, currentIndex) !== null) {
      // One Move done (M1, L2): ink along the current leg, never past its 90% hold. It goes through the coordinator,
      // so it waits behind a higher scene (a waypoint reach) and starts when promoted.
      const sceneId = chartMoveSceneId(pending.moveId);
      const legIndex = currentIndex;
      const finishScene = () => {
        if (moveSceneRef.current === sceneId) moveSceneRef.current = null;
        useCelebrationStore.getState().finish(sceneId);
      };
      const start = () => {
        const spec = moveHoldSequence({
          anim,
          placement,
          legIndex,
          fromArc: anim.revealArc.value,
          // Real progress (already capped at the hold): exactly the hold when the move fills the leg.
          toArc: Math.max(anim.revealArc.value, revealTargetRef.current),
          reducedMotion: sceneReduced,
          onDayClosed: () => { setDayHold(false); if (mounted.current) setSwapRevision(value => value + 1); },
          onBeat: beatHandler(CHART_MAP_TIMING.moveHold.route),
        });
        spec.onEnd = finishScene;
        void runner.run(spec).finally(finishScene);
      };
      moveSceneRef.current = sceneId;
      const outcome = useCelebrationStore.getState().request(CHART_MOVE_SCENE_LEVEL, sceneId, {
        // Registered under the skippable threshold on purpose: the move scene is never skippable.
        durationMs: CHART_MAP_TIMING.moveHold.settleAt,
        onStart: start,
        onSkip: () => runner.skip(),
      });
      if (outcome === 'play') start();
      return;
    }
    void runner.run(
      moveCheckSequence({
        anim,
        fromArc: anim.revealArc.value,
        toArc: Math.max(anim.revealArc.value, revealTarget),
        reducedMotion,
        onDayClosed: moved ? () => { setDayHold(false); if (mounted.current) setSwapRevision(value => value + 1); } : undefined,
        // Only a checked move sounds; a route that changes for any other reason extends quietly.
        onBeat: moved ? beatHandler(CHART_MAP_TIMING.moveCheck.route) : undefined,
      })
    );
  }, [revealTarget, completedMoves, arrived, anim, runner, reducedMotion, sceneReduced, view.courseId, view.waypoints, placement, currentIndex, beatHandler]);

  // The flag stands on the current waypoint whenever the server moves it outside a ceremony.
  useEffect(() => {
    if (!openedRef.current || reachingRef.current || arrived || currentIndex < 0) return;
    anim.flagIndex.value = currentIndex;
  }, [currentIndex, arrived, anim]);

  // A Chart that finishes without a ceremony here (opened elsewhere) settles at arrival.
  useEffect(() => {
    if (!view.isFinished || arrived || reachingRef.current || reachEvent) return;
    settleArrived();
    anim.revealArc.value = table.total;
    anim.coverArc.value = table.total;
    setArrived(true);
  }, [view.isFinished, arrived, reachEvent, settleArrived, anim, table]);

  /* ---- spatial mode ------------------------------------------------ */
  const offCurrent = !arrived && currentIndex >= 0 && viewIdx !== currentIndex;
  const lastSpatial = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastSpatial.current === offCurrent) return;
    lastSpatial.current = offCurrent;
    onSpatialModeChange?.(offCurrent);
  }, [offCurrent, onSpatialModeChange]);

  const focusOn = useCallback(
    (index: number) => {
      zoomedRef.current = true;
      if (reducedMotion) return;
      void runner.run(waypointTapSequence({ anim, point: placement.points[index] ?? null, toOverview: false, reducedMotion }));
    },
    [anim, placement, reducedMotion, runner]
  );
  const goOverview = useCallback(() => {
    setRouteFocusIdx(null);
    zoomedRef.current = false;
    if (reducedMotion) return;
    void runner.run(waypointTapSequence({ anim, point: null, toOverview: true, reducedMotion }));
  }, [anim, reducedMotion, runner]);

  const backToCurrent = useCallback(() => {
    const target = Math.max(0, currentIndex);
    setRouteFocusIdx(null);
    setViewIdx(target);
    sheetRef.current?.snapTo('peek');
    goOverview();
  }, [currentIndex, goOverview]);

  useEffect(() => {
    if (!offCurrent) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheetRef.current?.collapse()) return true;
      backToCurrent();
      return true;
    });
    return () => subscription.remove();
  }, [offCurrent, backToCurrent]);

  const handleMarkerPress = (index: number) => {
    const waypoint = view.waypoints[index];
    if (!waypoint) return;
    if (!chartActions && onOpenWaypoint) {
      onOpenWaypoint(waypoint.id);
      return;
    }
    if (runner.isBusy()) {
      // Any tap while a sequence runs is a pure skip (it never also selects or zooms).
      runner.skip();
      return;
    }
    if (arrived) return;
    // DEFERRED: const same = viewIdx === index && zoomedRef.current;
    // DEFERRED: setViewIdx(index);
    // DEFERRED: if (same) goOverview();
    // DEFERRED: else focusOn(index);
    sheetRef.current?.snapTo('peek');
    setRouteFocusIdx(null);
    if (index === currentIndex) backToCurrent();
    else { setViewIdx(index); focusOn(index); }
  };

  /** Route-list row tap: same camera call and marker highlight as a marker tap, but the sheet and its panel stay put. */
  const focusRouteWaypoint = (index: number) => {
    if (!view.waypoints[index]) return;
    if (runner.isBusy()) {
      runner.skip();
      return;
    }
    if (arrived) return;
    setRouteFocusIdx(index);
    focusOn(index);
  };

  const handleMapPress = () => {
    if (runner.isBusy()) {
      runner.skip();
      return;
    }
    if (offCurrent) { backToCurrent(); return; }
    if (sheetRef.current?.collapse()) return;
    if (arrived) {
      // Arrival leaves the camera at overview; stay defensive and never leave it zoomed.
      if (zoomedRef.current) goOverview();
      return;
    }
    if (zoomedRef.current) goOverview();
    else focusOn(viewIdx);
  };

  /* ---- move check -------------------------------------------------- */
  const handleCompleteMove = async (moveId: string): Promise<boolean> => {
    const confirmGuidance = beginGuidanceAction(accountId ?? 'guest', 'chart.next_move', 'target:circle');
    const guidanceAccount = accountId ?? 'guest';
    sheetRef.current?.snapTo('peek');
    const pending: PendingMove = { baseline: completedMovesRef.current, moveId };
    pendingMoveRef.current = pending;
    setDayHold(true);
    let ok = false;
    try {
      ok = await onCompleteMove(moveId);
    } catch {
      ok = false;
    }
    if (!ok) {
      if (pendingMoveRef.current === pending) pendingMoveRef.current = null;
      setDayHold(false);
    } else {
      // The route extends only once the server's new Chart arrives; never wait forever for it.
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = setTimeout(() => {
        if (pendingMoveRef.current === pending) {
          pendingMoveRef.current = null;
          setDayHold(false);
        }
      }, DAY_CLOSED_HOLD_FALLBACK_MS);
    }
    confirmGuidance(ok);
    if (ok) discoverGuidance(guidanceAccount, 'chart.next_move');
    return ok;
  };
  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  /* ---- reach ceremony --------------------------------------------- */
  const panelActions: ChartActions = useMemo(() => {
    const base = chartActions ?? NO_ACTIONS;
    return {
      ...base,
      reachWaypoint: (waypointId: string) => {
        // The sheet's Mark button and the menu both land here: while one request for this waypoint is in flight,
        // the other shares it instead of sending a second one.
        const inFlight = reachRequestsRef.current.get(waypointId);
        if (inFlight) return inFlight;
        const request = (async () => {
          sheetRef.current?.snapTo('peek');
          const index = view.waypoints.findIndex((waypoint) => waypoint.id === waypointId);
          reachingRef.current = true;
          reachIdRef.current = { index, previousReachedCount: view.reachedCount };
          let result: WaypointReachResult | null = null;
          try {
            result = await base.reachWaypoint(waypointId);
          } finally {
            // A failed reach plays nothing and leaves the route where it was.
            if (!result && !ceremonyLiveRef.current) {
              reachingRef.current = false;
              reachIdRef.current = null;
            }
          }
          return result;
        })();
        reachRequestsRef.current.set(waypointId, request);
        const clear = () => {
          if (reachRequestsRef.current.get(waypointId) === request) reachRequestsRef.current.delete(waypointId);
        };
        request.then(clear, clear);
        return request;
      },
    };
  }, [chartActions, view.waypoints, view.reachedCount]);

  const handleReached = (result: WaypointReachResult) => {
    const ids = reachIdRef.current;
    if (!ids) {
      onWaypointReached?.(result, view.reachedCount, view.total);
      return;
    }
    setReachEvent({ index: ids.index, result, previousReachedCount: ids.previousReachedCount, total: view.total });
  };

  const pendingMilestoneBoundary = useRef<string | null>(null);
  const milestoneBoundaryRef = useRef(onMilestoneBoundary);
  milestoneBoundaryRef.current = onMilestoneBoundary;

  useEffect(() => {
    if (!reachEvent) return;
    const { index, result, previousReachedCount, total } = reachEvent;
    // Play only once the server's new Chart shows the waypoint reached.
    if (!(view.isFinished || view.waypoints[index]?.state === 'completed')) return;
    setReachEvent(null);
    const isLast = result.destinationReached || index >= total - 1;
    const waypointId = view.waypoints[index]?.id ?? String(index);
    // The final waypoint is the summit (S1), one scene for the whole Chart; every other waypoint is W1. The two are
    // mutually exclusive by construction: a summit never requests a waypoint scene, and a waypoint scene never a summit.
    const sceneId = isLast ? chartSummitSceneId(view.courseId) : chartWaypointSceneId(waypointId);
    // The sheet's Mark button, the menu and a replayed report all end up here: a waypoint's ceremony begins once per
    // mount. A repeat changes nothing and never leaves the route frozen behind a ceremony that is not running.
    if (reachScenesRef.current.has(sceneId)) {
      if (!ceremonyLiveRef.current) {
        reachingRef.current = false;
        reachIdRef.current = null;
      }
      return;
    }
    reachScenesRef.current.add(sceneId);
    ceremonyLiveRef.current = true;
    const notify = () => onWaypointReached?.(result, previousReachedCount, total);
    const finish = (completed = false) => {
      const finishedHere = ceremonyLiveRef.current;
      ceremonyLiveRef.current = false;
      reachingRef.current = false;
      reachIdRef.current = null;
      lastArcRef.current = revealTargetRef.current;
      setCeremony(null);
      if (waypointSceneRef.current === sceneId) {
        waypointSceneRef.current = null;
        useCelebrationStore.getState().finish(sceneId);
      }
      if (summitSceneRef.current === sceneId) {
        summitSceneRef.current = null;
        useCelebrationStore.getState().finish(sceneId);
      }
      if (completed && finishedHere && mounted.current && milestoneFocused.current) {
        if (isLast) milestoneBoundaryRef.current?.(waypointId);
        else pendingMilestoneBoundary.current = waypointId;
      }
    };
    const start = () => {
      ceremonyLiveRef.current = true;
      sheetRef.current?.snapTo('peek');
      setCeremony({ index, advanced: false, filled: isLast, isLast });
      zoomedRef.current = !isLast && !sceneReduced;
      let spec: SequenceSpec;
      if (isLast) {
        // Summit (S1). Lands settled on skip: flag planted, artwork shown, map inked, cream panel up, the Heavy haptic
        // and chord played once.
        spec = summitSequence({
          anim,
          placement,
          table,
          index,
          reducedMotion: sceneReduced,
          panel: summitPanelProgress,
          onBeat: beatHandler(CHART_MAP_TIMING.summit.route),
          onFlag: () => { if (mounted.current) setFlagPlanted(true); },
          onPanel: () => {
            sheetRef.current?.snapTo('hidden');
            if (mounted.current) setSummitPanel(true);
          },
          onArrived: () => {
            setArrived(true);
            setSwapRevision(value => value + 1);
            setViewIdx(Math.max(0, total - 1));
            notify();
          },
        });
      } else {
        spec = reachSequence({
          anim,
          placement,
          index,
          endArc: placement.arcs[index] ?? revealTargetRef.current,
          nextRevealArc: revealTargetRef.current,
          reducedMotion: sceneReduced,
          onBeat: beatHandler(CHART_MAP_TIMING.reach.route, view.waypoints[index]?.number ?? index + 1),
          onStamp: () => setCeremony((current) => (current ? { ...current, filled: true } : current)),
          onAdvance: () => setCeremony((current) => (current ? { ...current, advanced: true } : current)),
          onCommitCard: () => {
            setViewIdx(index + 1);
            setCommit({ number: index + 1 });
            setSwapRevision(value => value + 1);
            notify();
          },
        });
      }
      spec.onEnd = () => finish(true);
      // Reset on onEnd AND after the run settles, so a skipped or interrupted ceremony can never leave the route frozen.
      void runner.run(spec).finally(() => {
        if (reachingRef.current) finish();
      });
    };
    if (isLast) {
      // Summit (S1, L4, skippable). It outranks everything, so a waypoint scene still playing lands settled first. Under
      // Reduce Motion it is registered short, so it is never skippable.
      summitSceneRef.current = sceneId;
      const outcome = useCelebrationStore.getState().request(CHART_SUMMIT_SCENE_LEVEL, sceneId, {
        durationMs: sceneReduced ? CHART_MAP_TIMING.summit.reducedMs : CHART_MAP_TIMING.summit.settleAt,
        onStart: start,
        onSkip: () => runner.skip(),
      });
      if (outcome === 'play') start();
      return;
    }
    // Waypoint reached (W1, L3, skippable). The reached state is already real (server data); a scene that has to
    // wait behind a higher one keeps the marker open and plays when the coordinator starts it, so it is never lost.
    waypointSceneRef.current = sceneId;
    setCeremony({ index, advanced: false, filled: false, isLast });
    const outcome = useCelebrationStore.getState().request(CHART_WAYPOINT_SCENE_LEVEL, sceneId, {
      durationMs: sceneReduced ? CHART_MAP_REDUCED_FADE : CHART_MAP_TIMING.reach.settleAt,
      onStart: start,
      // Lands settled: ink drawn, marker filled, label and next step shown, the note and Light haptic played once.
      onSkip: () => runner.skip(),
    });
    if (outcome === 'play') start();
  }, [reachEvent, view, anim, placement, table, reducedMotion, sceneReduced, runner, onWaypointReached, beatHandler]);

  // Three quiet weeks is evidence the course may need adjusting: offer the one Adjust Route flow once per open.
  useEffect(() => {
    if (routeAdjustEvidence(view, new Date()) === 'stalled') setShowStillRight(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- route revised (R1) ------------------------------------------ */
  // Adjust Route fires one signal per SAVED revision that actually changed the route (never for cancel, failure, a no-op
  // apply, or creation). The Chart takes it once, when it is focused again, and plays the quiet scene (L1, never
  // skippable). If the coordinator drops it (another celebration is playing) or the Chart is busy, the new route simply
  // shows settled: the route is never lost.
  const pendingRevision = useChartRouteRevisionStore((state) => state.pending);
  const revisionIsMine = Boolean(pendingRevision && pendingRevision.courseId === view.courseId && isRouteRevisionFresh(pendingRevision));
  const waypointIds = useMemo(() => view.waypoints.map((waypoint) => waypoint.id), [view.waypoints]);
  /** The waypoint ids as they were before the pending revision: kept current until a revision is signalled. */
  const knownIdsRef = useRef<string[]>(waypointIds);
  const reviseHoldRef = useRef(false);
  reviseHoldRef.current = reviseHold;
  useEffect(() => {
    if (useChartRouteRevisionStore.getState().pending || reviseHoldRef.current) return;
    knownIdsRef.current = waypointIds;
  }, [waypointIds]);
  useEffect(() => {
    if (!pendingRevision || pendingRevision.courseId !== view.courseId) return;
    const store = useChartRouteRevisionStore.getState();
    if (!isRouteRevisionFresh(pendingRevision)) {
      store.consume(pendingRevision.nonce);
      return;
    }
    // From the moment a saved revision is known, the revised markers ahead stay back until the new waypoint appears.
    setReviseHold(true);
    if (!focused) return;
    if (!store.consume(pendingRevision.nonce)) return;
    const settleNow = () => {
      revisionOut.value = 1;
      revisionPen.value = 1;
      revisionPencil.value = 1;
      knownIdsRef.current = waypointIds;
      setReviseHold(false);
    };
    const idle = openedRef.current && openingFinished && !runner.isBusy() && !reachingRef.current && !ceremony && !reachEvent && pendingMoveRef.current === null;
    if (!idle) {
      settleNow();
      return;
    }
    const sceneId = chartRouteRevisedSceneId(pendingRevision.nonce);
    routeSceneRef.current = sceneId;
    const outcome = useCelebrationStore.getState().request(CHART_ROUTE_REVISED_SCENE_LEVEL, sceneId, {
      // Registered under the skippable threshold on purpose: the route-revised scene is never skippable.
      durationMs: CHART_MAP_TIMING.routeRevised.registeredMs,
      // Lands settled: the pencil route, the new waypoint shown, the one Light haptic played if it had not been.
      onSkip: () => runner.skip(),
    });
    if (outcome === 'duplicate') return;
    if (outcome === 'dropped') {
      routeSceneRef.current = null;
      settleNow();
      return;
    }
    const finishScene = () => {
      if (routeSceneRef.current === sceneId) routeSceneRef.current = null;
      knownIdsRef.current = waypointIds;
      if (mounted.current) setReviseHold(false);
      useCelebrationStore.getState().finish(sceneId);
    };
    const known = new Set(knownIdsRef.current);
    const added = waypointIds.findIndex((id) => !known.has(id));
    const spec = routeRevisedSequence({
      anim,
      revision,
      reducedMotion: sceneReduced,
      popIndex: added >= 0 ? added : null,
      onPop: () => { if (mounted.current) setReviseHold(false); },
      onBeat: beatHandler(0),
    });
    spec.onEnd = finishScene;
    void runner.run(spec).finally(finishScene);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRevision, focused, openingFinished, ceremony, reachEvent, swapRevision, view.courseId]);

  /* ---- commit ("I'm committed") ----------------------------------- */
  // A reach reported by the screen (legacy `reached` route param) shows the same card. It plays no scene of its own
  // (no note, no haptic), and waits while the coordinator has one playing, so only one celebration is ever on screen.
  const celebrationPlaying = useCelebrationStore((state) => state.active !== null);
  const handledCommitCelebration = useRef<ChartCelebration | null>(null);
  useMilestonePresentationHold(focused && (!openingFinished || Boolean(ceremony) || Boolean(reachEvent) || Boolean(commit)));
  useEffect(() => {
    if (!celebration || handledCommitCelebration.current === celebration || reachingRef.current || celebrationPlaying || commit) return;
    if (arrived) {
      if (!openingFinished || !focused) return;
      handledCommitCelebration.current = celebration;
      const waypointId = view.waypoints[view.waypoints.length - 1]?.id;
      if (waypointId) milestoneBoundaryRef.current?.(waypointId);
      onCelebrationDone();
      return;
    }
    handledCommitCelebration.current = celebration;
    setCommit({ number: Math.max(1, view.reachedCount) });
  }, [celebration, celebrationPlaying, commit, arrived, focused, openingFinished, onCelebrationDone, view.reachedCount, view.waypoints]);

  const dismissCommit = () => {
    const finished = celebrationRef.current;
    setCommit(null);
    setSwapRevision(value => value + 1);
    const waypointId = pendingMilestoneBoundary.current ?? (finished ? view.waypoints[Math.max(0, view.reachedCount - 1)]?.id : null);
    pendingMilestoneBoundary.current = waypointId;
    if (finished) {
      onCelebrationDone();
      // Only when the course shows evidence it may need adjusting; the card opens the one Adjust Route flow.
      if (finished.nextTitle && routeAdjustEvidence(view, new Date()) === 'ahead') setShowStillRight(true);
    }
  };

  const onChartContentApplied = (showingCommit: boolean) => {
    const waypointId = pendingMilestoneBoundary.current;
    if (showingCommit || !waypointId) return;
    pendingMilestoneBoundary.current = null;
    if (milestoneFocused.current) milestoneBoundaryRef.current?.(waypointId);
  };

  /* ---- notifications (fire and forget; never prompts) -------------- */
  const anchorId = view.anchorId;
  const oneMoveTitle = view.oneMove?.title ?? null;
  useEffect(() => {
    if (!anchorId) return;
    void syncChartNotifications({
      anchorId,
      courseId: view.courseId,
      accountId,
      view: { destination: view.destination, oneMove: oneMoveTitle ? { title: oneMoveTitle } : null },
      moves: allMoves,
    });
  }, [anchorId, accountId, view.courseId, view.version, view.destination, oneMoveTitle, allMoves, completedMoves]);

  /* ---- markers ----------------------------------------------------- */
  const markers: ChartMapMarker[] = useMemo(
    () =>
      view.waypoints.map((waypoint, index) => {
        let state: ChartMarkerRenderState = waypoint.state === 'completed' ? 'done' : waypoint.state === 'current' ? 'current' : 'upcoming';
        if (ceremony) {
          // The reached marker stays open until the scene's marker-fill beat (the server already says reached).
          if (index === ceremony.index) state = ceremony.filled ? 'done' : 'current';
          else if (index === ceremony.index + 1 && !ceremony.advanced) state = 'upcoming';
        } else if (reachEvent && index === reachEvent.index) {
          // Reported but not yet playing: no one-frame flash of the filled marker before the scene starts.
          state = 'current';
        }
        const word = state === 'done' ? 'reached' : state === 'current' ? 'current' : 'upcoming';
        return {
          id: waypoint.id,
          index,
          number: waypoint.number,
          title: waypoint.title,
          state,
          selected: !arrived && index === (routeFocusIdx ?? viewIdx),
          accessibilityLabel: `Waypoint ${waypoint.number}: ${waypoint.title}, ${word}`,
        };
      }),
    [view.waypoints, ceremony, reachEvent, arrived, viewIdx, routeFocusIdx]
  );

  // Route revised (R1): until the new waypoint appears, the revised markers ahead of the current one stay back.
  const markersShown = useMemo(
    () => (reviseHold || revisionIsMine ? markers.filter((marker) => marker.state !== 'upcoming') : markers),
    [markers, reviseHold, revisionIsMine]
  );
  // The Anchor's real artwork stands at the summit from the moment the destination is reached (and on a finished Chart).
  const summitArt = anchorArt && (arrived || ceremony?.isLast) ? anchorArt : null;

  const isContentLocked = useCallback(() => runner.isBusy() || reachingRef.current || pendingMoveRef.current !== null, [runner]);
  const onDetentChange = useCallback((detent: ChartSheetDetent) => {
    const previous = detentRef.current;
    detentRef.current = detent;
    setSheetDetent(detent);
    // The entrance/ceremonies own their cameras. A drag never writes camera values.
    if (previous === 'hidden' || runner.isBusy()) return;
    // A peek settle can finish just after the waypoint flight. Keep its selected focus.
    if (detent === 'peek' && offCurrent) return;
    const overview = detent === 'half' || detent === 'full';
    const target = overview ? .96 : 1;
    anim.camera.cx.value = withTiming(426, { duration: reducedMotion ? 180 : 420, easing: CHART_EASING.deliberate, reduceMotion: ReduceMotion.Never });
    anim.camera.cy.value = withTiming(590, { duration: reducedMotion ? 180 : 420, easing: CHART_EASING.deliberate, reduceMotion: ReduceMotion.Never });
    anim.camera.s.value = withTiming(target, { duration: reducedMotion ? 180 : 420, easing: CHART_EASING.deliberate, reduceMotion: ReduceMotion.Never });
    zoomedRef.current = false;
  }, [anim, offCurrent, reducedMotion, runner]);

  const categoryLabel = (identity.category ?? 'custom').toUpperCase();
  const panelWaypointId = view.waypoints[Math.min(viewIdx, view.waypoints.length - 1)]?.id ?? '';
  const currentWaypoint = view.waypoints.find((w) => w.state === 'current') ?? view.waypoints[0] ?? null;
  const targetWaypoint = (viewIdx >= 0 && view.waypoints[viewIdx]?.state === 'current') ? view.waypoints[viewIdx] : currentWaypoint;

  const handleArchive = () => {
    setMenuOpen(false);
    Alert.alert(CHART_COPY.archive.confirmTitle, CHART_COPY.archive.confirmBody, [
      { text: CHART_COPY.archive.cancel, style: 'cancel' },
      {
        text: CHART_COPY.archive.confirmCta,
        style: 'destructive',
        onPress: () => {
          void panelActions.archiveChart?.();
        },
      },
    ]);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    Alert.alert(CHART_COPY.delete.confirmTitle, CHART_COPY.delete.confirmBody, [
      { text: CHART_COPY.delete.cancel, style: 'cancel' },
      {
        text: CHART_COPY.delete.confirmCta,
        style: 'destructive',
        onPress: () => {
          void panelActions.deleteChart?.();
        },
      },
    ]);
  };

// DEFERRED:       <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }} showsVerticalScrollIndicator={false} style={styles.scroll}>
// DEFERRED:         <View style={{ width, paddingTop: insets.top + 100, backgroundColor: T.paper }}>
// DEFERRED:           {/* Header first in the tree so TalkBack reads Back, Chart and the menu before the markers; it is absolutely positioned above the map. */}
// DEFERRED:           <ChartMapHeader
// DEFERRED:             categoryLabel={categoryLabel}
// DEFERRED:             category={identity.category}
// DEFERRED:             accent={accent}
// DEFERRED:             visionImageUrl={vision?.imageUrl ?? null}
// DEFERRED:             hasVision={Boolean(vision)}
// DEFERRED:             onBack={offCurrent ? backToCurrent : onBack}
// DEFERRED:             onMenu={() => setMenuOpen(true)}
// DEFERRED:             onOpenVision={onOpenVision}
// DEFERRED:           />
// DEFERRED:           <ChartMap
// DEFERRED:             testID="chart-hero-map"
// DEFERRED:             width={width}
// DEFERRED:             height={mapHeight - 100}
// DEFERRED:             table={table}
// DEFERRED:             placement={placement}
// DEFERRED:             anim={anim}
// DEFERRED:             markers={markers}
// DEFERRED:             categoryColor={categoryColor}
// DEFERRED:             category={identity.category ?? undefined}
// DEFERRED:             reducedMotion={reducedMotion}
// DEFERRED:             arrived={arrived}
// DEFERRED:             clouds
// DEFERRED:             weather="living"
// DEFERRED:             continuous={entrance === 'reveal'}
// DEFERRED:             onShown={onMapShown}
// DEFERRED:             onMarkerPress={handleMarkerPress}
// DEFERRED:             onMapPress={handleMapPress}
// DEFERRED:           />
// DEFERRED:           {ceremony && !ceremony.isLast && view.waypoints[ceremony.index] ? (
// DEFERRED:             <ChartReachBeat
// DEFERRED:               visible={!ceremony.advanced}
// DEFERRED:               number={view.waypoints[ceremony.index].number}
// DEFERRED:               title={view.waypoints[ceremony.index].title}
// DEFERRED:               category={identity.category}
// DEFERRED:               reducedMotion={reducedMotion}
// DEFERRED:             />
// DEFERRED:           ) : null}
// DEFERRED:           <View style={styles.scallop} pointerEvents="none">
// DEFERRED:             <ChartScallop width={width} color={T.ink} testID="chart-scallop" />
// DEFERRED:           </View>
// DEFERRED:         </View>
// DEFERRED:
// DEFERRED:         <Animated.View style={panelStyle}>
// DEFERRED:           {stale ? (
// DEFERRED:             <View style={styles.offline} accessibilityLiveRegion="polite">
// DEFERRED:               <WifiOff size={14} color={T.muted} />
// DEFERRED:               <Text style={styles.offlineText}>{CHART_COPY.active.offline}</Text>
// DEFERRED:             </View>
// DEFERRED:           ) : null}
// DEFERRED:           {showStillRight ? (
// DEFERRED:             <ChartInkCard testID="chart-still-right" style={styles.stillRight}>
// DEFERRED:               <Text style={styles.cardTitle}>{CHART_COPY.adjust.stillRight}</Text>
// DEFERRED:               <View style={styles.row}>
// DEFERRED:                 <ChartInkButton label={CHART_COPY.adjust.keep} variant="outline" onPress={() => setShowStillRight(false)} style={styles.flex} />
// DEFERRED:                 <ChartInkButton
// DEFERRED:                   label={CHART_COPY.review.adjust}
// DEFERRED:                   onPress={() => {
// DEFERRED:                     setShowStillRight(false);
// DEFERRED:                     onAdjust();
// DEFERRED:                   }}
// DEFERRED:                   style={styles.flex}
// DEFERRED:                 />
// DEFERRED:               </View>
// DEFERRED:             </ChartInkCard>
// DEFERRED:           ) : null}
// DEFERRED:           <ChartWaypointContent
// DEFERRED:             view={view}
// DEFERRED:             waypointId={panelWaypointId}
// DEFERRED:             chart={panelActions}
// DEFERRED:             category={identity.category}
// DEFERRED:             reducedMotion={reducedMotion}
// DEFERRED:             actionError={actionError}
// DEFERRED:             bottomInset={insets.bottom}
// DEFERRED:             onBack={backToCurrent}
// DEFERRED:             onReached={handleReached}
// DEFERRED:             inputs={inputs}
// DEFERRED:             hw={effectiveHw}
// DEFERRED:             vision={vision}
// DEFERRED:             onOpenVision={onOpenVision}
// DEFERRED:             onOpenLog={onOpenLog}
// DEFERRED:             onRelease={onRelease ?? onAdjust}
// DEFERRED:             onOpenPractice={onOpenPractice}
// DEFERRED:             onCompleteMove={handleCompleteMove}
// DEFERRED:             commit={commit}
// DEFERRED:             onCommitDismiss={dismissCommit}
// DEFERRED:             dayClosedHold={dayHold}
// DEFERRED:             arrived={arrived}
// DEFERRED:             entrance={entrance}
// DEFERRED:           />
// DEFERRED:         </Animated.View>
// DEFERRED:       </ScrollView>

  return (
    <View testID={testID ?? 'chart-active'} style={styles.screen}>
      <StatusBar barStyle="dark-content" animated />
      {/* Keeps the cloud bitmaps decoded for the next open's frame-one veil. */}
      <ChartWeatherVeilPrimer />
      <ChartMapHeader categoryLabel={categoryLabel} category={identity.category} accent={accent} visionImageUrl={vision?.imageUrl ?? null} hasVision={Boolean(vision)} onBack={offCurrent ? backToCurrent : onBack} onMenu={() => setMenuOpen(true)} onOpenVision={onOpenVision} />
      <ChartMap testID="chart-hero-map" width={width} height={height} frame={frame} table={table} placement={placement} anim={anim} markers={markersShown} categoryColor={categoryColor} category={identity.category ?? undefined} reducedMotion={reducedMotion} arrived={arrived} clouds weather="living" continuous={entrance === 'reveal'} onShown={onMapShown} revision={revision} summitArt={summitArt} plantedFlag={flagPlanted} onMarkerPress={handleMarkerPress} onMapPress={handleMapPress} />
      {ceremony && !ceremony.isLast && view.waypoints[ceremony.index] ? <ChartReachBeat visible={ceremony.filled && !ceremony.advanced} number={view.waypoints[ceremony.index].number} title={view.waypoints[ceremony.index].title} category={identity.category} reducedMotion={reducedMotion} bottom={height - sheetPositions.peek + 12} /> : null}
      <ChartSheet ref={sheetRef} reducedMotion={reducedMotion} busy={sequenceBusy} onDetentChange={onDetentChange} overlay={<ChartOneMoveTeaching visible={teachingVisible && !celebrationActive} replayVersion={teachingReplayVersion} reducedMotion={reducedMotion} detent={sheetDetent} targets={teachingTargets} viewportRef={oneMoveViewportRef} viewportLayoutRevision={teachingViewportRevision} onRequestVisible={requestTeachingVisibility} onReady={markTeachingShown} onVisible={markTeachingShown} onHidden={chartGuidance.markHidden} onDismiss={dismissTeaching} />}>
        <ChartSheetContent view={view} waypointId={panelWaypointId} chart={panelActions} category={identity.category} reducedMotion={reducedMotion} actionError={actionError} bottomInset={insets.bottom} onBack={backToCurrent} onReached={handleReached} inputs={inputs} hw={effectiveHw} vision={vision} onOpenVision={onOpenVision} onOpenLog={onOpenLog} onRelease={onRelease ?? onAdjust} onOpenPractice={onOpenPractice} anchorArt={anchorArt} onOpenAnchor={onOpenAnchor} onAskChart={onAskChart} threadStrength={threadStrength} onCompleteMove={handleCompleteMove} oneMoveRowRef={oneMoveRowRef} oneMoveCircleRef={oneMoveCircleRef} oneMoveBodyRef={oneMoveBodyRef} scrollViewportRef={oneMoveViewportRef} onScrollViewportLayout={onTeachingViewportLayout} onReplayTeaching={replayTeaching} commit={commit} onCommitDismiss={dismissCommit} onContentApplied={onChartContentApplied} dayClosedHold={dayHold} arrived={arrived} entrance={entrance} stale={stale} viewWaypoint={focusRouteWaypoint} onExpandSheet={() => { if (!runner.isBusy()) sheetRef.current?.snapTo('full'); }} swapRevision={swapRevision} isContentLocked={isContentLocked} stillRight={showStillRight ? <ChartInkCard testID="chart-still-right" style={styles.stillRight}><Text style={styles.cardTitle}>{CHART_COPY.adjust.stillRight}</Text><View style={styles.row}><ChartInkButton label={CHART_COPY.adjust.keep} variant="outline" onPress={() => setShowStillRight(false)} style={styles.flex} /><ChartInkButton label={CHART_COPY.review.adjust} onPress={() => { setShowStillRight(false); onAdjust(); }} style={styles.flex} /></View></ChartInkCard> : null} />
      </ChartSheet>

      {/* Only while the waypoint scene is the active skippable scene: a tap lands it on its settled state. */}
      {sceneSkippable ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Skip" testID="chart-waypoint-skip" style={StyleSheet.absoluteFill}
          onPress={() => { useCelebrationStore.getState().skip(); }} />
      ) : null}

      {/* The end of the summit scene: the existing cream completion panel, above the Skip button so its two actions stay tappable. */}
      {summitPanel ? <ChartSummitPanel progress={summitPanelProgress} view={view} vision={vision} reducedMotion={sceneReduced} onViewJourney={onOpenLog} onRelease={onRelease ?? onAdjust} /> : null}

      <V2SheetModal visible={menuOpen} onClose={() => setMenuOpen(false)} reduceMotion={reducedMotion} testID="chart-menu">
        <View style={styles.menu}>
          <MenuItem label={CHART_COPY.review.adjust} onPress={() => { setMenuOpen(false); onAdjust(); }} />
          <MenuItem label={CHART_COPY.active.courseLogCta} onPress={() => { setMenuOpen(false); onOpenLog(); }} />
          <MenuItem label={CHART_COPY.active.viewVision} onPress={() => { setMenuOpen(false); onOpenVision(); }} />
          {!arrived && targetWaypoint && targetWaypoint.state !== 'completed' ? (
            <MenuItem
              label="Mark waypoint reached"
              testID="chart-mark-waypoint"
              onPress={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
            />
          ) : null}
          <MenuItem
            label={CHART_COPY.archive.menuItem}
            testID="chart-archive-menu-item"
            onPress={handleArchive}
          />
          <MenuItem
            label={CHART_COPY.delete.menuItem}
            testID="chart-delete-menu-item"
            destructive
            onPress={handleDelete}
          />
        </View>
      </V2SheetModal>

      <ChartConfirmSheet
        visible={confirmOpen}
        title={targetWaypoint?.title ?? ''}
        accent={accent}
        reducedMotion={reducedMotion}
        busy={panelActions.busy === `reach:${targetWaypoint?.id}`}
        onYes={async () => {
          setConfirmOpen(false);
          if (targetWaypoint) {
            const result = await panelActions.reachWaypoint(targetWaypoint.id);
            if (result) handleReached(result);
          }
        }}
        onNotYet={() => setConfirmOpen(false)}
      />
    </View>
  );
}

function MenuItem({
  label,
  onPress,
  testID,
  destructive,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.menuText, destructive && styles.menuTextDestructive]}>{label}</Text>
    </Pressable>
  );
}

export { ChartMetricBar as MetricBar } from './ChartMetricBar';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: T.paper },
  scroll: { backgroundColor: T.ink },
  scallop: { position: 'absolute', left: 0, right: 0, bottom: -1 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[5], paddingTop: spacing[3], backgroundColor: T.ink },
  offlineText: { fontFamily: T.sans, fontSize: 13, color: T.muted },
  stillRight: { marginHorizontal: spacing[4], marginTop: spacing[3], backgroundColor: T.panel, borderColor: T.line },
  cardTitle: { ...typography.headingSM, fontFamily: T.serif, color: T.light, marginBottom: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[3] },
  menu: { paddingHorizontal: spacing[5], paddingBottom: spacing[4], backgroundColor: T.panel, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  menuItem: { minHeight: 52, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line },
  menuText: { ...typography.labelLG, color: T.light },
  menuTextDestructive: { color: colors.semantic.error },
});

// DEFERRED: ===== Previous ChartActiveView (ChartJourneyWorld hero, cream cards, celebration banner); replaced by the treasure-map composition above and kept for reference =====
// DEFERRED: import { chartTypography as typography } from './chartTypography';
// DEFERRED: import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// DEFERRED: import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
// DEFERRED: import { useSafeAreaInsets } from 'react-native-safe-area-context';
// DEFERRED: import Animated, { cancelAnimation, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
// DEFERRED: import { ArrowRight, Check, ChevronRight, Flag, MoreHorizontal, WifiOff } from 'lucide-react-native';
// DEFERRED: import { V2SheetModal } from '@/components/v2/primitives/V2SheetModal';
// DEFERRED: import { VisionHeaderRow, VisionIdentity } from '@/components/v2/vision/VisionChrome';
// DEFERRED: import { CHART_COPY } from '@/constants/v2/chartCopy';
// DEFERRED: import type { ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
// DEFERRED: import type { UseAnchorChartResult, WaypointReachResult } from '@/hooks/v2/chart/useAnchorChart';
// DEFERRED: import { colors, getCategoryColor, radii, spacing } from '@/theme/v2';
// DEFERRED: import { ChartEyebrow, ChartInkButton, ChartInkCard, ChartInkScreen, type ChartIdentity } from './ChartChrome';
// DEFERRED: import type { ChartAnchorArt, ChartMarker } from './ChartLandscape';
// DEFERRED: import { ChartJourneyWorld } from './ChartJourneyWorld';
// DEFERRED: import { getJourneyRouteProgress } from './chartJourneyGeometry';
// DEFERRED: import { useChartJourneyCamera } from './useChartJourneyCamera';
// DEFERRED: import { ChartCompletionPanel } from './ChartDestinationReached';
// DEFERRED: import { ChartMetricBar } from './ChartMetricBar';
// DEFERRED: // DEFERRED: import { ChartWaypointContent } from './ChartWaypointContent';
// DEFERRED: import { ChartSheet, chartSheetDetents, type ChartSheetHandle, type ChartSheetDetent } from './sheet/ChartSheet';
// DEFERRED: import { ChartSheetContent } from './sheet/ChartSheetContent';
// DEFERRED: import { chartMapScreenTop } from './map/ChartWeatherHold';
// DEFERRED: import { CHART_CAMERA_TIMING, CHART_EASING, CHART_PROGRESS_TIMING as PT, CHART_TRANSITION_TIMING as TT, chartTiming } from './chartMotion';
// DEFERRED:
// DEFERRED: export type ChartVisionPreview = { imageUrl: string | null; description: string | null; title: string | null };
// DEFERRED:
// DEFERRED: export type ChartCelebration = {
// DEFERRED:   completedTitle: string;
// DEFERRED:   nextTitle: string | null;
// DEFERRED:   /** Route fraction the Anchor travels from (before the reach). */
// DEFERRED:   fromFraction: number;
// DEFERRED: };
// DEFERRED:
// DEFERRED: type Props = {
// DEFERRED:   view: ChartViewModel;
// DEFERRED:   identity: ChartIdentity;
// DEFERRED:   anchorArt: ChartAnchorArt | null;
// DEFERRED:   vision: ChartVisionPreview | null;
// DEFERRED:   stale: boolean;
// DEFERRED:   busyKey: string | null;
// DEFERRED:   reducedMotion: boolean;
// DEFERRED:   celebration: ChartCelebration | null;
// DEFERRED:   onCelebrationDone: () => void;
// DEFERRED:   onBack: () => void;
// DEFERRED:   onOpenWaypoint?: (waypointId: string) => void;
// DEFERRED:   chartActions?: Pick<
// DEFERRED:     UseAnchorChartResult,
// DEFERRED:     | 'busy'
// DEFERRED:     | 'addMove'
// DEFERRED:     | 'acceptMove'
// DEFERRED:     | 'completeMove'
// DEFERRED:     | 'dismissMove'
// DEFERRED:     | 'suggestMoves'
// DEFERRED:     | 'updateProgress'
// DEFERRED:     | 'reachWaypoint'
// DEFERRED:     | 'editWaypoint'
// DEFERRED:     | 'removeWaypoint'
// DEFERRED:   >;
// DEFERRED:   initialWaypointId?: string | null;
// DEFERRED:   onWaypointReached?: (result: WaypointReachResult, previousReachedCount: number, total: number) => void;
// DEFERRED:   onSpatialModeChange?: (focused: boolean) => void;
// DEFERRED:   onCompleteMove: (moveId: string) => Promise<boolean>;
// DEFERRED:   onOpenVision: () => void;
// DEFERRED:   onOpenLog: () => void;
// DEFERRED:   onAdjust: () => void;
// DEFERRED:   onRelease?: () => void;
// DEFERRED:   actionError: string | null;
// DEFERRED:   /**
// DEFERRED:    * How the screen was reached. 'reveal' continues straight from the creation
// DEFERRED:    * reveal (the map is already in place, so only the content arrives); 'open'
// DEFERRED:    * is an ordinary visit (the route settles once, then everything is still).
// DEFERRED:    */
// DEFERRED:   entrance?: 'reveal' | 'open';
// DEFERRED:   testID?: string;
// DEFERRED: };
// DEFERRED:
// DEFERRED: /** Content cards arrive in order with a restrained stagger. */
// DEFERRED: const ENTRY_CARDS = 4;
// DEFERRED: const ENTRY_TOTAL = TT.cardIn + TT.cardStagger * (ENTRY_CARDS - 1);
// DEFERRED:
// DEFERRED: function EntryCard({ index, entry, children }: { index: number; entry: SharedValue<number>; children: React.ReactNode }) {
// DEFERRED:   const style = useAnimatedStyle(() => {
// DEFERRED:     const local = Math.max(0, Math.min(1, (entry.value * ENTRY_TOTAL - index * TT.cardStagger) / TT.cardIn));
// DEFERRED:     return { opacity: local, transform: [{ translateY: (1 - local) * 10 }] };
// DEFERRED:   });
// DEFERRED:   return <Animated.View style={style}>{children}</Animated.View>;
// DEFERRED: }
// DEFERRED:
// DEFERRED: /** Travelled fraction: the Anchor sits at the last reached waypoint (0 = START). */
// DEFERRED: export function travelledFraction(view: Pick<ChartViewModel, 'reachedCount' | 'total' | 'isFinished'>): number {
// DEFERRED:   if (view.total === 0) return 0;
// DEFERRED:   if (view.isFinished) return 1;
// DEFERRED:   return Math.min(1, view.reachedCount / view.total);
// DEFERRED: }
// DEFERRED:
// DEFERRED: export function ChartActiveView({
// DEFERRED:   view,
// DEFERRED:   identity,
// DEFERRED:   anchorArt,
// DEFERRED:   vision,
// DEFERRED:   stale,
// DEFERRED:   busyKey,
// DEFERRED:   reducedMotion,
// DEFERRED:   celebration,
// DEFERRED:   onCelebrationDone,
// DEFERRED:   onBack,
// DEFERRED:   onOpenWaypoint,
// DEFERRED:   chartActions,
// DEFERRED:   initialWaypointId = null,
// DEFERRED:   onWaypointReached,
// DEFERRED:   onSpatialModeChange,
// DEFERRED:   onCompleteMove,
// DEFERRED:   onOpenVision,
// DEFERRED:   onOpenLog,
// DEFERRED:   onAdjust,
// DEFERRED:   onRelease,
// DEFERRED:   actionError,
// DEFERRED:   entrance = 'open',
// DEFERRED:   testID,
// DEFERRED: }: Props) {
// DEFERRED:   const { width, height } = useWindowDimensions();
// DEFERRED:   const insets = useSafeAreaInsets();
// DEFERRED:   const categoryColor = getCategoryColor(identity.category);
// DEFERRED:   const target = getJourneyRouteProgress(view.total, view.current ? view.currentIndex : -1, view.current?.metric?.fraction, view.isFinished);
// DEFERRED:   const journey = useChartJourneyCamera(view.courseId, target, reducedMotion);
// DEFERRED:   const [arrivalSettled, setArrivalSettled] = useState(view.isFinished);
// DEFERRED:   const finishArrival = useCallback(() => setArrivalSettled(true), []);
// DEFERRED:   useAnimatedReaction(() => journey.progress.value, (value, previous) => {
// DEFERRED:     if (view.isFinished && value >= .9999 && previous !== value) runOnJS(finishArrival)();
// DEFERRED:   }, [view.isFinished, finishArrival]);
// DEFERRED:   useEffect(() => { if (view.isFinished && reducedMotion) setArrivalSettled(true); }, [view.isFinished, reducedMotion]);
// DEFERRED:   const entry = useSharedValue(reducedMotion ? 1 : 0);
// DEFERRED:   const [menuOpen, setMenuOpen] = useState(false);
// DEFERRED:   const [headerHeight, setHeaderHeight] = useState(insets.top + 116);
// DEFERRED:   const [checkingMove, setCheckingMove] = useState<string | null>(null);
// DEFERRED:   const [showStillRight, setShowStillRight] = useState(false);
// DEFERRED:   const bannerOpacity = useSharedValue(0);
// DEFERRED:   const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
// DEFERRED:   const scrollRef = useRef<ScrollView>(null);
// DEFERRED:   const cameraProgress = useSharedValue(initialWaypointId ? 1 : 0);
// DEFERRED:   const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(initialWaypointId);
// DEFERRED:   const [spatialMode, setSpatialMode] = useState<'chart' | 'focusing' | 'waypoint' | 'returning'>(initialWaypointId ? 'waypoint' : 'chart');
// DEFERRED:
// DEFERRED:   const finishFocus = useCallback(() => setSpatialMode('waypoint'), []);
// DEFERRED:   const finishReturn = useCallback(() => {
// DEFERRED:     setSelectedWaypointId(null);
// DEFERRED:     setSpatialMode('chart');
// DEFERRED:     onSpatialModeChange?.(false);
// DEFERRED:   }, [onSpatialModeChange]);
// DEFERRED:
// DEFERRED:   useAnimatedReaction(
// DEFERRED:     () => cameraProgress.value,
// DEFERRED:     (current, previous) => {
// DEFERRED:       if (previous === null) return;
// DEFERRED:       if (current >= 0.999 && previous < 0.999) runOnJS(finishFocus)();
// DEFERRED:       if (current <= 0.001 && previous > 0.001) runOnJS(finishReturn)();
// DEFERRED:     },
// DEFERRED:     [finishFocus, finishReturn]
// DEFERRED:   );
// DEFERRED:
// DEFERRED:   const focusWaypoint = (waypointId: string) => {
// DEFERRED:     if (spatialMode !== 'chart') return;
// DEFERRED:     if (!chartActions) {
// DEFERRED:       onOpenWaypoint?.(waypointId);
// DEFERRED:       return;
// DEFERRED:     }
// DEFERRED:     setSelectedWaypointId(waypointId);
// DEFERRED:     setSpatialMode('focusing');
// DEFERRED:     onSpatialModeChange?.(true);
// DEFERRED:     scrollRef.current?.scrollTo({ y: 0, animated: false });
// DEFERRED:     if (reducedMotion) {
// DEFERRED:       cameraProgress.value = 1;
// DEFERRED:       finishFocus();
// DEFERRED:       return;
// DEFERRED:     }
// DEFERRED:     cameraProgress.value = chartTiming(1, { duration: CHART_CAMERA_TIMING.focus, easing: CHART_EASING.deliberate });
// DEFERRED:   };
// DEFERRED:
// DEFERRED:   const returnToChart = () => {
// DEFERRED:     if (!selectedWaypointId || spatialMode === 'returning') return;
// DEFERRED:     setSpatialMode('returning');
// DEFERRED:     scrollRef.current?.scrollTo({ y: 0, animated: false });
// DEFERRED:     if (reducedMotion) {
// DEFERRED:       cameraProgress.value = 0;
// DEFERRED:       finishReturn();
// DEFERRED:       return;
// DEFERRED:     }
// DEFERRED:     cameraProgress.value = chartTiming(0, { duration: CHART_CAMERA_TIMING.return, easing: CHART_EASING.deliberate });
// DEFERRED:   };
// DEFERRED:
// DEFERRED:   useEffect(() => {
// DEFERRED:     if (!selectedWaypointId) return undefined;
// DEFERRED:     const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
// DEFERRED:       returnToChart();
// DEFERRED:       return true;
// DEFERRED:     });
// DEFERRED:     return () => subscription.remove();
// DEFERRED:   }, [selectedWaypointId, spatialMode]);
// DEFERRED:
// DEFERRED:   useEffect(() => () => cancelAnimation(cameraProgress), [cameraProgress]);
// DEFERRED:
// DEFERRED:   useEffect(() => {
// DEFERRED:     if (!selectedWaypointId || view.waypoints.some((waypoint) => waypoint.id === selectedWaypointId)) return;
// DEFERRED:     cancelAnimation(cameraProgress);
// DEFERRED:     cameraProgress.value = 0;
// DEFERRED:     setSelectedWaypointId(null);
// DEFERRED:     setSpatialMode('chart');
// DEFERRED:     onSpatialModeChange?.(false);
// DEFERRED:   }, [cameraProgress, onSpatialModeChange, selectedWaypointId, view.waypoints]);
// DEFERRED:
// DEFERRED:   useEffect(() => {
// DEFERRED:     if (!journey.ready) return;
// DEFERRED:     entry.value = reducedMotion ? 1 : chartTiming(1, { duration: ENTRY_TOTAL, easing: CHART_EASING.settle });
// DEFERRED:     return () => cancelAnimation(entry);
// DEFERRED:   }, [journey.ready, reducedMotion, entry]);
// DEFERRED:
// DEFERRED:   useEffect(() => {
// DEFERRED:     if (!celebration) return;
// DEFERRED:     bannerOpacity.value = reducedMotion ? 1 : chartTiming(1, { duration: PT.banner });
// DEFERRED:     celebrationTimer.current = setTimeout(() => {
// DEFERRED:       bannerOpacity.value = chartTiming(0, { duration: 300 });
// DEFERRED:       if (celebration.nextTitle) setShowStillRight(true);
// DEFERRED:       onCelebrationDone();
// DEFERRED:     }, reducedMotion ? PT.bannerHoldReduced : PT.bannerHold);
// DEFERRED:     return () => { if (celebrationTimer.current) clearTimeout(celebrationTimer.current); };
// DEFERRED:   }, [celebration, reducedMotion, onCelebrationDone, bannerOpacity]);
// DEFERRED:
// DEFERRED:   const bannerStyle = useAnimatedStyle(() => ({ opacity: bannerOpacity.value }));
// DEFERRED:   const waypointContentStyle = useAnimatedStyle(() => ({ opacity: cameraProgress.value }));
// DEFERRED:
// DEFERRED:   const markers: ChartMarker[] = useMemo(
// DEFERRED:     () =>
// DEFERRED:       view.waypoints.map((waypoint) => ({
// DEFERRED:         id: waypoint.id,
// DEFERRED:         number: waypoint.number,
// DEFERRED:         state: waypoint.state,
// DEFERRED:         accessibilityLabel: waypoint.accessibilityLabel,
// DEFERRED:       })),
// DEFERRED:     [view.waypoints]
// DEFERRED:   );
// DEFERRED:
// DEFERRED:   const current = view.current;
// DEFERRED:   const oneMove = view.oneMove;
// DEFERRED:   const mapSummary = current
// DEFERRED:     ? `Chart map. Waypoint ${current.number} of ${view.total} is current: ${current.title}. Destination: ${view.destination}.`
// DEFERRED:     : `Chart map. Destination: ${view.destination}.`;
// DEFERRED:
// DEFERRED:   const completeOneMove = async () => {
// DEFERRED:     if (!oneMove || checkingMove) return;
// DEFERRED:     setCheckingMove(oneMove.id);
// DEFERRED:     await onCompleteMove(oneMove.id);
// DEFERRED:     setCheckingMove(null);
// DEFERRED:   };
// DEFERRED:
// DEFERRED:   return (
// DEFERRED:     <ChartInkScreen testID={testID ?? 'chart-active'}>
// DEFERRED:       <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: selectedWaypointId ? 0 : insets.bottom + spacing[8] }} showsVerticalScrollIndicator={false}>
// DEFERRED:         <View>
// DEFERRED:           <ChartJourneyWorld
// DEFERRED:             width={width}
// DEFERRED:             height={Math.max(280, Math.min(height * .55, height - headerHeight - 160))}
// DEFERRED:             category={identity.category}
// DEFERRED:             markers={markers}
// DEFERRED:             progress={journey.progress}
// DEFERRED:             inspectionBlend={cameraProgress}
// DEFERRED:             selectedMarkerId={selectedWaypointId}
// DEFERRED:             onReady={journey.onReady}
// DEFERRED:             onMarkerPress={focusWaypoint}
// DEFERRED:             accessibilityLabel={mapSummary}
// DEFERRED:             style={{ marginTop: headerHeight }}
// DEFERRED:             testID="chart-hero-map"
// DEFERRED:           />
// DEFERRED:           <View style={[styles.overlayHeader, { paddingTop: insets.top }]} onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
// DEFERRED:             <VisionHeaderRow
// DEFERRED:               title={CHART_COPY.title}
// DEFERRED:               onBack={selectedWaypointId ? returnToChart : onBack}
// DEFERRED:               tone="light"
// DEFERRED:               utility={
// DEFERRED:                 <Pressable accessibilityRole="button" accessibilityLabel="Chart options" hitSlop={8} onPress={() => setMenuOpen(true)}>
// DEFERRED:                   <MoreHorizontal size={22} color={colors.ink.text.primary} />
// DEFERRED:                 </Pressable>
// DEFERRED:               }
// DEFERRED:             />
// DEFERRED:             <View style={styles.identity}>
// DEFERRED:               <VisionIdentity intention={identity.intention} category={identity.category} art={identity.art} imageUrl={identity.imageUrl} tone="light" size={48} />
// DEFERRED:             </View>
// DEFERRED:           </View>
// DEFERRED:         </View>
// DEFERRED:
// DEFERRED:         {view.isFinished && !selectedWaypointId ? (
// DEFERRED:           arrivalSettled ? <ChartCompletionPanel view={view} vision={vision} onViewJourney={onOpenLog} onRelease={onRelease ?? onAdjust} /> : <View style={styles.transitionSpace} />
// DEFERRED:         ) : selectedWaypointId && (spatialMode === 'waypoint' || spatialMode === 'returning') && chartActions ? (
// DEFERRED:           <Animated.View style={waypointContentStyle}>
// DEFERRED:           <ChartWaypointContent
// DEFERRED:             view={view}
// DEFERRED:             waypointId={selectedWaypointId}
// DEFERRED:             chart={chartActions}
// DEFERRED:             category={identity.category}
// DEFERRED:             reducedMotion={reducedMotion}
// DEFERRED:             actionError={actionError}
// DEFERRED:             bottomInset={insets.bottom}
// DEFERRED:             onBack={returnToChart}
// DEFERRED:             onReached={(result) => {
// DEFERRED:               onWaypointReached?.(result, view.reachedCount, view.total);
// DEFERRED:               returnToChart();
// DEFERRED:             }}
// DEFERRED:           />
// DEFERRED:           </Animated.View>
// DEFERRED:         ) : spatialMode === 'focusing' ? (
// DEFERRED:           <View style={styles.transitionSpace} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
// DEFERRED:         ) : (
// DEFERRED:         <View style={styles.body}>
// DEFERRED:           {/* Below the map, so the Anchor's travel along the route stays visible. */}
// DEFERRED:           {celebration ? (
// DEFERRED:             <Animated.View style={[styles.celebration, bannerStyle]} accessibilityLiveRegion="assertive" testID="chart-waypoint-reached">
// DEFERRED:               <ChartEyebrow color="#F2E6CB">{CHART_COPY.labels.waypointReached}</ChartEyebrow>
// DEFERRED:               <Text style={styles.celebrationTitle}>{celebration.completedTitle}</Text>
// DEFERRED:               {celebration.nextTitle ? (
// DEFERRED:                 <View style={styles.celebrationNext}>
// DEFERRED:                   <ChartEyebrow>{CHART_COPY.labels.next}</ChartEyebrow>
// DEFERRED:                   <Text style={styles.celebrationNextTitle}>{celebration.nextTitle}</Text>
// DEFERRED:                 </View>
// DEFERRED:               ) : null}
// DEFERRED:             </Animated.View>
// DEFERRED:           ) : null}
// DEFERRED:           {stale ? (
// DEFERRED:             <View style={styles.offline} accessibilityLiveRegion="polite">
// DEFERRED:               <WifiOff size={14} color={colors.text.secondary} />
// DEFERRED:               <Text style={styles.offlineText}>{CHART_COPY.active.offline}</Text>
// DEFERRED:             </View>
// DEFERRED:           ) : null}
// DEFERRED:
// DEFERRED:           {current ? (
// DEFERRED:             <EntryCard index={0} entry={entry}>
// DEFERRED:               <Pressable
// DEFERRED:                 accessibilityRole="button"
// DEFERRED:                 accessibilityLabel={`Current waypoint, ${current.number} of ${view.total}: ${current.title}${current.metric ? `, ${current.metric.display}` : ''}. Open waypoint.`}
// DEFERRED:                 onPress={() => focusWaypoint(current.id)}
// DEFERRED:                 testID="chart-current-waypoint"
// DEFERRED:               >
// DEFERRED:                 <View style={styles.compactSection}>
// DEFERRED:                   <View style={styles.cardHeader}>
// DEFERRED:                     <ChartEyebrow tone="cream">{CHART_COPY.labels.currentWaypoint}</ChartEyebrow>
// DEFERRED:                     <Text style={styles.position}>{view.positionLabel}</Text>
// DEFERRED:                   </View>
// DEFERRED:                   <Text style={styles.waypointTitle}>{current.title}</Text>
// DEFERRED:                   {current.metric ? <ChartMetricBar metric={current.metric} color={categoryColor} tone="cream" /> : null}
// DEFERRED:                   {!current.metric && current.rationale ? (
// DEFERRED:                     <Text style={styles.rationale} numberOfLines={2}>
// DEFERRED:                       {current.rationale}
// DEFERRED:                     </Text>
// DEFERRED:                   ) : null}
// DEFERRED:                 </View>
// DEFERRED:               </Pressable>
// DEFERRED:             </EntryCard>
// DEFERRED:           ) : null}
// DEFERRED:
// DEFERRED:           {showStillRight ? (
// DEFERRED:             <ChartInkCard testID="chart-still-right">
// DEFERRED:               <Text style={styles.cardTitle}>{CHART_COPY.adjust.stillRight}</Text>
// DEFERRED:               <View style={styles.row}>
// DEFERRED:                 <ChartInkButton label={CHART_COPY.adjust.keep} variant="outline" onPress={() => setShowStillRight(false)} style={styles.flex} />
// DEFERRED:                 <ChartInkButton
// DEFERRED:                   label={CHART_COPY.adjust.adjustAhead}
// DEFERRED:                   onPress={() => {
// DEFERRED:                     setShowStillRight(false);
// DEFERRED:                     onAdjust();
// DEFERRED:                   }}
// DEFERRED:                   style={styles.flex}
// DEFERRED:                 />
// DEFERRED:               </View>
// DEFERRED:             </ChartInkCard>
// DEFERRED:           ) : null}
// DEFERRED:
// DEFERRED:           <EntryCard index={1} entry={entry}>
// DEFERRED:             <View style={[styles.compactSection, styles.primarySection]} testID="chart-one-move">
// DEFERRED:               <ChartEyebrow tone="cream">{CHART_COPY.labels.oneMove}</ChartEyebrow>
// DEFERRED:               {oneMove ? (
// DEFERRED:                 <View style={styles.moveRow}>
// DEFERRED:                   <Pressable
// DEFERRED:                     accessibilityRole="checkbox"
// DEFERRED:                     accessibilityState={{ checked: checkingMove === oneMove.id, busy: busyKey === `move:${oneMove.id}` }}
// DEFERRED:                     accessibilityLabel={`Complete move: ${oneMove.title}`}
// DEFERRED:                     onPress={() => void completeOneMove()}
// DEFERRED:                     hitSlop={10}
// DEFERRED:                     style={[styles.checkbox, checkingMove === oneMove.id && styles.checkboxOn]}
// DEFERRED:                     testID="chart-one-move-check"
// DEFERRED:                   >
// DEFERRED:                     {checkingMove === oneMove.id ? <Check size={14} color={colors.ink.base} strokeWidth={3} /> : null}
// DEFERRED:                   </Pressable>
// DEFERRED:                   <Text style={styles.moveTitle}>{oneMove.title}</Text>
// DEFERRED:                   <Pressable
// DEFERRED:                     accessibilityRole="button"
// DEFERRED:                     accessibilityLabel="Open waypoint moves"
// DEFERRED:                     onPress={() => current && focusWaypoint(current.id)}
// DEFERRED:                     hitSlop={8}
// DEFERRED:                     style={styles.arrowButton}
// DEFERRED:                   >
// DEFERRED:                     <ArrowRight size={16} color={colors.text.primary} />
// DEFERRED:                   </Pressable>
// DEFERRED:                 </View>
// DEFERRED:               ) : (
// DEFERRED:                 <Pressable
// DEFERRED:                   accessibilityRole="button"
// DEFERRED:                   accessibilityLabel={CHART_COPY.active.noMoveCta}
// DEFERRED:                   onPress={() => current && focusWaypoint(current.id)}
// DEFERRED:                   style={styles.moveEmpty}
// DEFERRED:                   testID="chart-one-move-empty"
// DEFERRED:                 >
// DEFERRED:                   <Text style={styles.moveEmptyText}>{CHART_COPY.active.noMove}</Text>
// DEFERRED:                   <ChevronRight size={18} color={colors.text.secondary} />
// DEFERRED:                 </Pressable>
// DEFERRED:               )}
// DEFERRED:               {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
// DEFERRED:             </View>
// DEFERRED:           </EntryCard>
// DEFERRED:
// DEFERRED:           <EntryCard index={2} entry={entry}>
// DEFERRED:             <View style={styles.compactSection} testID="chart-destination">
// DEFERRED:               <ChartEyebrow tone="cream">{CHART_COPY.labels.yourDestination}</ChartEyebrow>
// DEFERRED:               <View style={styles.destinationRow}>
// DEFERRED:                 {vision?.imageUrl ? (
// DEFERRED:                   <Image source={{ uri: vision.imageUrl }} style={styles.destinationThumb} accessibilityIgnoresInvertColors accessibilityLabel="Your Vision" />
// DEFERRED:                 ) : (
// DEFERRED:                   <View style={[styles.destinationMark, { borderColor: categoryColor }]}>
// DEFERRED:                     <Flag size={18} color={categoryColor} />
// DEFERRED:                   </View>
// DEFERRED:                 )}
// DEFERRED:                 <View style={styles.flex}>
// DEFERRED:                   <Text style={styles.destinationTitle}>{view.destination}</Text>
// DEFERRED:                   {vision?.description ? (
// DEFERRED:                     <Text style={styles.destinationDescription} numberOfLines={2}>
// DEFERRED:                       {vision.description}
// DEFERRED:                     </Text>
// DEFERRED:                   ) : null}
// DEFERRED:                   {vision ? (
// DEFERRED:                     <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.active.viewVision} onPress={onOpenVision} style={styles.inlineLink} testID="chart-view-vision">
// DEFERRED:                       <Text style={styles.inlineLinkText}>{CHART_COPY.active.viewVision}</Text>
// DEFERRED:                       <ArrowRight size={14} color={colors.text.primary} />
// DEFERRED:                     </Pressable>
// DEFERRED:                   ) : null}
// DEFERRED:                 </View>
// DEFERRED:               </View>
// DEFERRED:             </View>
// DEFERRED:           </EntryCard>
// DEFERRED:
// DEFERRED:           <EntryCard index={3} entry={entry}>
// DEFERRED:             <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.active.courseLogCta} onPress={onOpenLog} testID="chart-course-log">
// DEFERRED:               <View style={styles.logRow}>
// DEFERRED:                 <View style={styles.flex}>
// DEFERRED:                   <ChartEyebrow tone="cream">{CHART_COPY.labels.courseLog}</ChartEyebrow>
// DEFERRED:                   <Text style={styles.logText}>
// DEFERRED:                     {view.reachedCount} of {view.total} waypoints · {view.completedMoveCount} move{view.completedMoveCount === 1 ? '' : 's'} completed
// DEFERRED:                   </Text>
// DEFERRED:                 </View>
// DEFERRED:                 <ChevronRight size={18} color={colors.text.secondary} />
// DEFERRED:               </View>
// DEFERRED:             </Pressable>
// DEFERRED:           </EntryCard>
// DEFERRED:         </View>
// DEFERRED:         )}
// DEFERRED:       </ScrollView>
// DEFERRED:
// DEFERRED:       <V2SheetModal visible={menuOpen} onClose={() => setMenuOpen(false)} reduceMotion={reducedMotion} testID="chart-menu">
// DEFERRED:         <View style={styles.menu}>
// DEFERRED:           <MenuItem label={CHART_COPY.review.adjust} onPress={() => { setMenuOpen(false); onAdjust(); }} />
// DEFERRED:           <MenuItem label={CHART_COPY.active.courseLogCta} onPress={() => { setMenuOpen(false); onOpenLog(); }} />
// DEFERRED:           {vision ? <MenuItem label={CHART_COPY.active.viewVision} onPress={() => { setMenuOpen(false); onOpenVision(); }} /> : null}
// DEFERRED:         </View>
// DEFERRED:       </V2SheetModal>
// DEFERRED:     </ChartInkScreen>
// DEFERRED:   );
// DEFERRED: }
// DEFERRED:
// DEFERRED: function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
// DEFERRED:   return (
// DEFERRED:     <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}>
// DEFERRED:       <Text style={styles.menuText}>{label}</Text>
// DEFERRED:     </Pressable>
// DEFERRED:   );
// DEFERRED: }
// DEFERRED:
// DEFERRED: export { ChartMetricBar as MetricBar } from './ChartMetricBar';
// DEFERRED:
// DEFERRED: const styles = StyleSheet.create({
// DEFERRED:   flex: { flex: 1 },
// DEFERRED:   overlayHeader: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: spacing[5] },
// DEFERRED:   identity: { paddingTop: spacing[2] },
// DEFERRED:   celebration: {
// DEFERRED:     padding: spacing[4],
// DEFERRED:     borderRadius: radii.lg,
// DEFERRED:     backgroundColor: 'rgba(14, 21, 28, 0.88)',
// DEFERRED:     borderWidth: StyleSheet.hairlineWidth,
// DEFERRED:     borderColor: 'rgba(242, 230, 203, 0.35)',
// DEFERRED:     gap: spacing[1],
// DEFERRED:   },
// DEFERRED:   celebrationTitle: { ...typography.headingLG, color: colors.ink.text.primary },
// DEFERRED:   celebrationNext: { marginTop: spacing[2], gap: 2 },
// DEFERRED:   celebrationNextTitle: { ...typography.bodyMD, color: colors.ink.text.primary },
// DEFERRED:   body: { paddingHorizontal: spacing[5], paddingBottom: spacing[5], gap: 0, backgroundColor: colors.canvas, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
// DEFERRED:   compactSection: {
// DEFERRED:     paddingVertical: spacing[5],
// DEFERRED:     borderBottomWidth: StyleSheet.hairlineWidth,
// DEFERRED:     borderBottomColor: colors.border.subtle,
// DEFERRED:   },
// DEFERRED:   primarySection: { paddingVertical: spacing[6] },
// DEFERRED:   transitionSpace: { minHeight: 240 },
// DEFERRED:   offline: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[1] },
// DEFERRED:   offlineText: { ...typography.bodySM, color: colors.text.secondary },
// DEFERRED:   cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
// DEFERRED:   position: { ...typography.labelMD, color: colors.text.secondary },
// DEFERRED:   waypointTitle: { ...typography.headingLG, fontFamily: 'BricolageGrotesque-SemiBold', color: colors.text.primary, marginTop: spacing[2] },
// DEFERRED:   rationale: { ...typography.bodySM, color: colors.text.secondary, marginTop: spacing[1] },
// DEFERRED:   cardTitle: { ...typography.headingSM, color: colors.text.primary, marginBottom: spacing[3] },
// DEFERRED:   row: { flexDirection: 'row', gap: spacing[3] },
// DEFERRED:   moveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[3] },
// DEFERRED:   checkbox: {
// DEFERRED:     width: 24,
// DEFERRED:     height: 24,
// DEFERRED:     borderRadius: 6,
// DEFERRED:     borderWidth: 1.5,
// DEFERRED:     borderColor: colors.text.secondary,
// DEFERRED:     alignItems: 'center',
// DEFERRED:     justifyContent: 'center',
// DEFERRED:   },
// DEFERRED:   checkboxOn: { backgroundColor: '#F2E6CB', borderColor: '#F2E6CB' },
// DEFERRED:   moveTitle: { flex: 1, ...typography.bodyLG, fontFamily: 'Figtree-Regular', color: colors.text.primary },
// DEFERRED:   arrowButton: {
// DEFERRED:     width: 36,
// DEFERRED:     height: 36,
// DEFERRED:     borderRadius: 18,
// DEFERRED:     borderWidth: 1,
// DEFERRED:     borderColor: colors.border.subtle,
// DEFERRED:     alignItems: 'center',
// DEFERRED:     justifyContent: 'center',
// DEFERRED:   },
// DEFERRED:   moveEmpty: { flexDirection: 'row', alignItems: 'center', marginTop: spacing[3], minHeight: 44 },
// DEFERRED:   moveEmptyText: { flex: 1, ...typography.bodyMD, color: colors.text.secondary },
// DEFERRED:   error: { ...typography.bodySM, color: '#E7A19C', marginTop: spacing[2] },
// DEFERRED:   destinationRow: { flexDirection: 'row', gap: spacing[4], marginTop: spacing[3] },
// DEFERRED:   destinationThumb: { width: 86, height: 86, borderRadius: radii.md, borderWidth: 1, borderColor: 'rgba(242, 230, 203, 0.4)' },
// DEFERRED:   destinationMark: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
// DEFERRED:   destinationTitle: { ...typography.headingSM, color: colors.text.primary },
// DEFERRED:   destinationDescription: { ...typography.bodySM, color: colors.text.secondary, marginTop: 4 },
// DEFERRED:   inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[2], minHeight: 32 },
// DEFERRED:   inlineLinkText: { ...typography.labelMD, color: colors.text.primary },
// DEFERRED:   logRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[2], paddingVertical: spacing[3], minHeight: 56 },
// DEFERRED:   logText: { ...typography.bodySM, color: colors.text.secondary, marginTop: 4 },
// DEFERRED:   menu: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
// DEFERRED:   menuItem: { minHeight: 52, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle },
// DEFERRED:   menuText: { ...typography.labelLG, color: colors.text.primary },
// DEFERRED: });
