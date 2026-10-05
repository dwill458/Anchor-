import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { WifiOff } from 'lucide-react-native';
import { V2SheetModal } from '@/components/v2/primitives/V2SheetModal';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import type { ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import type { UseAnchorChartResult, WaypointReachResult } from '@/hooks/v2/chart/useAnchorChart';
import { useAuthStore } from '@/stores/authStore';
import { useChartHighWater } from '@/hooks/v2/chart/chartHighWater';
import { syncChartNotifications } from '@/services/notifications/chartNotifications';
import { colors, getCategoryColor, radii, spacing } from '@/theme/v2';
import type { CourseDetail, MoveSummary, WaypointSummary } from '@/types/chart';
import { ChartInkButton, ChartInkCard, type ChartIdentity } from './ChartChrome';
import type { ChartAnchorArt } from './ChartLandscape';
import { chartTypography as typography } from './chartTypography';
import { CHART_MAP_REDUCED_FADE, CHART_MAP_TIMING } from './chartMotion';
import { ChartMap } from './map/ChartMap';
import { ChartScallop } from './map/ChartScallop';
import type { ChartMapMarker, ChartMarkerRenderState, SequenceSpec } from './map/chartMapContracts';
import { buildRouteTable, waypointPlacement } from './map/chartMapGeometry';
import { arrivalSequence, moveCheckSequence, openSequence, reachSequence, waypointTapSequence } from './map/chartMapSequences';
import { CHART_MAP_TOKENS as T } from './map/chartMapTokens';
import { nextHighWater, routeRevealArc, toProgressInput } from './map/chartProgress';
import { useChartMapAnimState } from './map/useChartMapAnimState';
import { routeAdjustEvidence } from './map/chartRhythm';
import { useChartSequencer } from './map/useChartSequencer';
import { ChartMapHeader } from './panel/ChartMapHeader';
import { panelAccent } from './panel/chartPanelColors';
import { ChartWaypointContent } from './ChartWaypointContent';
import { ChartConfirmSheet } from './panel/ChartConfirmSheet';
import { ChartReachBeat } from './ChartReachBeat';

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
type PendingMove = { baseline: number };
type Ceremony = { index: number; advanced: boolean; isLast: boolean };
type ReachEvent = { index: number; result: WaypointReachResult; previousReachedCount: number; total: number };

/** Waits this long for the server's new Chart before giving up on the day-closed hold. */
const DAY_CLOSED_HOLD_FALLBACK_MS = 1500;

export function ChartActiveView({
  view,
  identity,
  vision,
  stale,
  reducedMotion,
  celebration,
  onCelebrationDone,
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
  course,
  testID,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mapHeight = Math.min(width * 1180 / 852, Math.max(240, height - insets.top - insets.bottom - 360));
  const categoryColor = getCategoryColor(identity.category);
  const accent = useMemo(() => panelAccent(identity.category), [identity.category]);

  /* ---- map state -------------------------------------------------- */
  const table = useMemo(() => buildRouteTable(), []);
  const placement = useMemo(() => waypointPlacement(Math.max(1, view.total)), [view.total]);
  const currentIndex = view.isFinished ? -1 : view.currentIndex;
  const anim = useChartMapAnimState({ revealArc: 0, flagIndex: Math.max(0, currentIndex) });
  const runner = useChartSequencer(reducedMotion);

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
  const accountId = useAuthStore((state) => state.user?.id ?? null);
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
  const lastArcRef = useRef(0);
  const courseIdRef = useRef(view.courseId);
  const placementSigRef = useRef(`${placement.n}|${view.waypoints.map((waypoint) => waypoint.id).join(',')}`);
  const pendingMoveRef = useRef<PendingMove | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrationRef = useRef(celebration);
  celebrationRef.current = celebration;
  const viewIdxRef = useRef(viewIdx);
  viewIdxRef.current = viewIdx;

  const panel = useSharedValue(0);
  const showPanel = useCallback(() => {
    panel.value = withTiming(1, {
      duration: reducedMotion ? CHART_MAP_REDUCED_FADE : CHART_MAP_TIMING.open.panel,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    });
  }, [panel, reducedMotion]);
  const panelStyle = useAnimatedStyle(() => ({
    opacity: panel.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - panel.value) * 12 }],
  }));

  /** Static end states for a Chart that is already finished when it opens. */
  const settleArrived = useCallback(() => {
    anim.glyph.value = 1;
    anim.goldDot.value = 1;
    anim.fog.value = 1;
    anim.flagOpacity.value = 0;
  }, [anim]);

  /* ---- open -------------------------------------------------------- */
  useLayoutEffect(() => {
    // Nothing flashes before the open sequence fades the map in.
    anim.mapOpacity.value = 0;
    anim.flagOpacity.value = 0;
  }, [anim]);

  useEffect(() => {
    if (openedRef.current) return undefined;
    openedRef.current = true;
    let cancelled = false;
    lastArcRef.current = revealTarget;
    if (view.isFinished) settleArrived();
    const instant = reducedMotion || entrance === 'reveal';
    const spec = openSequence({
      anim,
      placement,
      revealTo: revealTarget,
      currentIndex,
      reducedMotion: instant,
      onPanel: showPanel,
    });
    zoomedRef.current = false;
    void runner.run(spec).then(() => {
      // A deep link to another waypoint lands there after the map has opened.
      if (cancelled) return;
      const target = viewIdxRef.current;
      if (instant || view.isFinished || target === currentIndex) return;
      zoomedRef.current = true;
      void runner.run(waypointTapSequence({ anim, point: placement.points[target] ?? null, toOverview: false, reducedMotion: false }));
    });
    return () => {
      cancelled = true;
      openedRef.current = false;
    };
    // Runs once per mount: later changes are driven by the effects below.
  }, []);

  /* ---- route follows server data ---------------------------------- */
  useEffect(() => {
    if (!openedRef.current || reachingRef.current || arrived) return;
    // Adding or removing waypoints re-spaces the route: re-anchor the drawn arc to the new target
    // (progress itself never retreats; the high-water map holds it in fraction space).
    const sig = `${placement.n}|${view.waypoints.map((waypoint) => waypoint.id).join(',')}`;
    if (sig !== placementSigRef.current) {
      placementSigRef.current = sig;
      anim.revealArc.value = revealTarget;
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
      } else {
        lastArcRef.current = from;
      }
      return;
    }
    void runner.run(
      moveCheckSequence({
        anim,
        fromArc: anim.revealArc.value,
        toArc: Math.max(anim.revealArc.value, revealTarget),
        reducedMotion,
        onDayClosed: moved ? () => setDayHold(false) : undefined,
      })
    );
  }, [revealTarget, completedMoves, arrived, anim, runner, reducedMotion, view.courseId, view.waypoints, placement.n]);

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
    zoomedRef.current = false;
    if (reducedMotion) return;
    void runner.run(waypointTapSequence({ anim, point: null, toOverview: true, reducedMotion }));
  }, [anim, reducedMotion, runner]);

  const backToCurrent = useCallback(() => {
    const target = Math.max(0, currentIndex);
    setViewIdx(target);
    focusOn(target);
  }, [currentIndex, focusOn]);

  useEffect(() => {
    if (!offCurrent) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
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
    const same = viewIdx === index && zoomedRef.current;
    setViewIdx(index);
    if (same) goOverview();
    else focusOn(index);
  };

  const handleMapPress = () => {
    if (runner.isBusy()) {
      runner.skip();
      return;
    }
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
    const pending: PendingMove = { baseline: completedMovesRef.current };
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
      reachWaypoint: async (waypointId: string) => {
        const index = view.waypoints.findIndex((waypoint) => waypoint.id === waypointId);
        reachingRef.current = true;
        reachIdRef.current = { index, previousReachedCount: view.reachedCount };
        let result: WaypointReachResult | null = null;
        try {
          result = await base.reachWaypoint(waypointId);
        } finally {
          // A failed reach plays nothing and leaves the route where it was.
          if (!result) {
            reachingRef.current = false;
            reachIdRef.current = null;
          }
        }
        return result;
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

  useEffect(() => {
    if (!reachEvent) return;
    const { index, result, previousReachedCount, total } = reachEvent;
    // Play only once the server's new Chart shows the waypoint reached.
    if (!(view.isFinished || view.waypoints[index]?.state === 'completed')) return;
    setReachEvent(null);
    const isLast = result.destinationReached || index >= total - 1;
    const notify = () => onWaypointReached?.(result, previousReachedCount, total);
    const finish = () => {
      reachingRef.current = false;
      reachIdRef.current = null;
      lastArcRef.current = revealTargetRef.current;
      setCeremony(null);
    };
    setCeremony({ index, advanced: false, isLast });
    zoomedRef.current = !isLast && !reducedMotion;
    let spec: SequenceSpec;
    if (isLast) {
      spec = arrivalSequence({
        anim,
        placement,
        table,
        index,
        reducedMotion,
        onArrived: () => {
          setArrived(true);
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
        reducedMotion,
        onAdvance: () => setCeremony((current) => (current ? { ...current, advanced: true } : current)),
        onCommitCard: () => {
          setViewIdx(index + 1);
          setCommit({ number: index + 1 });
          notify();
        },
      });
    }
    spec.onEnd = finish;
    // Reset on onEnd AND after the run settles, so a skipped or interrupted ceremony can never leave the route frozen.
    void runner.run(spec).finally(() => {
      if (reachingRef.current) finish();
    });
  }, [reachEvent, view, anim, placement, table, reducedMotion, runner, onWaypointReached]);

  // Three quiet weeks is evidence the course may need adjusting: offer the one Adjust Route flow once per open.
  useEffect(() => {
    if (routeAdjustEvidence(view, new Date()) === 'stalled') setShowStillRight(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- commit ("I'm committed") ----------------------------------- */
  // A reach reported by the screen (legacy `reached` route param) shows the same card.
  useEffect(() => {
    if (!celebration || reachingRef.current || commit || arrived) return;
    setCommit({ number: Math.max(1, view.reachedCount) });
  }, [celebration, commit, arrived, view.reachedCount]);

  const dismissCommit = () => {
    const finished = celebrationRef.current;
    setCommit(null);
    if (finished) {
      onCelebrationDone();
      // Only when the course shows evidence it may need adjusting; the card opens the one Adjust Route flow.
      if (finished.nextTitle && routeAdjustEvidence(view, new Date()) === 'ahead') setShowStillRight(true);
    }
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
          if (index === ceremony.index) state = 'done';
          else if (index === ceremony.index + 1 && !ceremony.advanced) state = 'upcoming';
        }
        const word = state === 'done' ? 'reached' : state === 'current' ? 'current' : 'upcoming';
        return {
          id: waypoint.id,
          index,
          number: waypoint.number,
          title: waypoint.title,
          state,
          selected: !arrived && index === viewIdx,
          accessibilityLabel: `Waypoint ${waypoint.number}: ${waypoint.title}, ${word}`,
        };
      }),
    [view.waypoints, ceremony, arrived, viewIdx]
  );

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

  return (
    <View testID={testID ?? 'chart-active'} style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={T.paper} animated />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }} showsVerticalScrollIndicator={false} style={styles.scroll}>
        <View style={{ width, paddingTop: insets.top + 100, backgroundColor: T.paper }}>
          {/* Header first in the tree so TalkBack reads Back, Chart and the menu before the markers; it is absolutely positioned above the map. */}
          <ChartMapHeader
            categoryLabel={categoryLabel}
            category={identity.category}
            accent={accent}
            visionImageUrl={vision?.imageUrl ?? null}
            hasVision={Boolean(vision)}
            onBack={offCurrent ? backToCurrent : onBack}
            onMenu={() => setMenuOpen(true)}
            onOpenVision={onOpenVision}
          />
          <ChartMap
            testID="chart-hero-map"
            width={width}
            height={mapHeight - 100}
            table={table}
            placement={placement}
            anim={anim}
            markers={markers}
            categoryColor={categoryColor}
            category={identity.category ?? undefined}
            reducedMotion={reducedMotion}
            arrived={arrived}
            clouds
            onMarkerPress={handleMarkerPress}
            onMapPress={handleMapPress}
          />
          {ceremony && !ceremony.isLast && view.waypoints[ceremony.index] ? (
            <ChartReachBeat
              visible={!ceremony.advanced}
              number={view.waypoints[ceremony.index].number}
              title={view.waypoints[ceremony.index].title}
              category={identity.category}
              reducedMotion={reducedMotion}
            />
          ) : null}
          <View style={styles.scallop} pointerEvents="none">
            <ChartScallop width={width} color={T.ink} testID="chart-scallop" />
          </View>
        </View>

        <Animated.View style={panelStyle}>
          {stale ? (
            <View style={styles.offline} accessibilityLiveRegion="polite">
              <WifiOff size={14} color={T.muted} />
              <Text style={styles.offlineText}>{CHART_COPY.active.offline}</Text>
            </View>
          ) : null}
          {showStillRight ? (
            <ChartInkCard testID="chart-still-right" style={styles.stillRight}>
              <Text style={styles.cardTitle}>{CHART_COPY.adjust.stillRight}</Text>
              <View style={styles.row}>
                <ChartInkButton label={CHART_COPY.adjust.keep} variant="outline" onPress={() => setShowStillRight(false)} style={styles.flex} />
                <ChartInkButton
                  label={CHART_COPY.review.adjust}
                  onPress={() => {
                    setShowStillRight(false);
                    onAdjust();
                  }}
                  style={styles.flex}
                />
              </View>
            </ChartInkCard>
          ) : null}
          <ChartWaypointContent
            view={view}
            waypointId={panelWaypointId}
            chart={panelActions}
            category={identity.category}
            reducedMotion={reducedMotion}
            actionError={actionError}
            bottomInset={insets.bottom}
            onBack={backToCurrent}
            onReached={handleReached}
            inputs={inputs}
            hw={effectiveHw}
            vision={vision}
            onOpenVision={onOpenVision}
            onOpenLog={onOpenLog}
            onRelease={onRelease ?? onAdjust}
            onOpenPractice={onOpenPractice}
            onCompleteMove={handleCompleteMove}
            commit={commit}
            onCommitDismiss={dismissCommit}
            dayClosedHold={dayHold}
            arrived={arrived}
            entrance={entrance}
          />
        </Animated.View>
      </ScrollView>

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
  screen: { flex: 1, backgroundColor: T.ink },
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
// DEFERRED: import { ChartWaypointContent } from './ChartWaypointContent';
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
