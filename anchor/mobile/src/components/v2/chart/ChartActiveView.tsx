import { chartTypography as typography } from './chartTypography';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import {
  Anchor,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Flag,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Star,
  WifiOff,
  X,
} from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { V2SheetModal } from '@/components/v2/primitives/V2SheetModal';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import type { ChartViewModel, ChartWaypointView } from '@/adapters/v2/chart/chartV2Model';
import { formatMetricNumber } from '@/adapters/v2/chart/chartV2Model';
import type { UseAnchorChartResult, WaypointReachResult } from '@/hooks/v2/chart/useAnchorChart';
import { colors, getCategoryColor, radii, spacing } from '@/theme/v2';
import { useSessionStore } from '@/stores/sessionStore';
import { ChartEyebrow, ChartInkButton, ChartInkCard, ChartInkScreen, type ChartIdentity } from './ChartChrome';

export function travelledFraction(view: { reachedCount: number; total: number; isFinished: boolean }): number {
  if (view.isFinished) return 1;
  if (!view.total || view.total <= 0) return 0;
  return Math.min(1, Math.max(0, view.reachedCount / view.total));
}
import type { ChartAnchorArt, ChartMarker } from './ChartLandscape';
import { ChartJourneyWorld } from './ChartJourneyWorld';
import { getJourneyRouteProgress } from './chartJourneyGeometry';
import { useChartJourneyCamera } from './useChartJourneyCamera';
import { ChartCompletionPanel } from './ChartDestinationReached';
import { ChartWaypointContent } from './ChartWaypointContent';
import {
  CHART_CAMERA_TIMING,
  CHART_EASING,
  CHART_PROGRESS_TIMING as PT,
  CHART_TRANSITION_TIMING as TT,
  chartTiming,
} from './chartMotion';
import type { MoveSummary } from '@/types/chart';

export type ChartVisionPreview = {
  imageUrl: string | null;
  description: string | null;
  title: string | null;
};

export type ChartCelebration = {
  completedTitle: string;
  nextTitle: string | null;
  /** Route fraction the Anchor travels from (before the reach). */
  fromFraction: number;
};

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
  chartActions?: Pick<
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
  >;
  initialWaypointId?: string | null;
  onWaypointReached?: (result: WaypointReachResult, previousReachedCount: number, total: number) => void;
  onSpatialModeChange?: (focused: boolean) => void;
  onCompleteMove: (moveId: string) => Promise<boolean>;
  onOpenVision: () => void;
  onOpenPractice?: () => void;
  onOpenLog: () => void;
  onAdjust: () => void;
  onRelease?: () => void;
  actionError: string | null;
  entrance?: 'reveal' | 'open';
  testID?: string;
};

const SERIF_MEDIUM = 'EBGaramond-Medium';
const SERIF_REGULAR = 'EBGaramond-Regular';

const ENTRY_CARDS = 4;
const ENTRY_TOTAL = TT.cardIn + TT.cardStagger * (ENTRY_CARDS - 1);

function EntryCard({ index, entry, children }: { index: number; entry: SharedValue<number>; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const local = Math.max(0, Math.min(1, (entry.value * ENTRY_TOTAL - index * TT.cardStagger) / TT.cardIn));
    return { opacity: local, transform: [{ translateY: (1 - local) * 10 }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function selectHeroAndOtherMoves(
  moves: MoveSummary[],
  oneMoveId?: string | null
): { heroMove: MoveSummary | null; otherMoves: MoveSummary[] } {
  const incompleteMoves = moves.filter((m) => m.status === 'ACTIVE' || m.status === 'SUGGESTED');
  if (incompleteMoves.length === 0) {
    return { heroMove: null, otherMoves: [] };
  }
  const starred = incompleteMoves.find((m) => m.isCurrent || (oneMoveId && m.id === oneMoveId));
  const heroMove = starred ?? incompleteMoves[0];
  const otherMoves = incompleteMoves.filter((m) => m.id !== heroMove.id);
  return { heroMove, otherMoves };
}

export function daysOnCourse(plottedAt?: string | null): number {
  if (!plottedAt) return 1;
  const plotted = new Date(plottedAt).getTime();
  if (isNaN(plotted)) return 1;
  const days = Math.floor((Date.now() - plotted) / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

export function ChartActiveView({
  view,
  identity,
  anchorArt,
  vision,
  stale,
  busyKey,
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
  onOpenPractice,
  onOpenLog,
  onAdjust,
  onRelease,
  actionError,
  entrance = 'open',
  testID,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const categoryColor = getCategoryColor(identity.category);
  const target = getJourneyRouteProgress(
    view.total,
    view.current ? view.currentIndex : -1,
    view.current?.metric?.fraction,
    view.isFinished
  );
  const journey = useChartJourneyCamera(view.courseId, target, reducedMotion);
  const [arrivalSettled, setArrivalSettled] = useState(view.isFinished);
  const finishArrival = useCallback(() => setArrivalSettled(true), []);

  useAnimatedReaction(
    () => journey.progress.value,
    (value, previous) => {
      if (view.isFinished && value >= 0.9999 && previous !== value) runOnJS(finishArrival)();
    },
    [view.isFinished, finishArrival]
  );

  useEffect(() => {
    if (view.isFinished && reducedMotion) setArrivalSettled(true);
  }, [view.isFinished, reducedMotion]);

  const entry = useSharedValue(reducedMotion ? 1 : 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(insets.top + 116);
  const [checkingMove, setCheckingMove] = useState<string | null>(null);
  const [showStillRight, setShowStillRight] = useState(false);

  // Phase 1 states
  const [expandedMoves, setExpandedMoves] = useState(false);
  const [newMoveText, setNewMoveText] = useState('');
  const [progressSheetOpen, setProgressSheetOpen] = useState(false);
  const [progressDraft, setProgressDraft] = useState('');
  const [editWaypointOpen, setEditWaypointOpen] = useState(false);
  const [editTitleDraft, setEditTitleDraft] = useState('');
  const [editRationaleDraft, setEditRationaleDraft] = useState('');
  const [confirmReachOpen, setConfirmReachOpen] = useState(false);

  // Check practice status today for this anchor
  const practiceHistory = useSessionStore((s) => s.practiceHistory);
  const isPracticedToday = useMemo(() => {
    if (!view.anchorId) return false;
    const today = new Date();
    return practiceHistory.some((session) => {
      const match =
        session.anchorId === view.anchorId ||
        session.anchorLocalId === view.anchorId ||
        session.anchorServerId === view.anchorId;
      if (!match) return false;
      const d = new Date(session.completedAt);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    });
  }, [practiceHistory, view.anchorId]);

  const bannerOpacity = useSharedValue(0);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const cameraProgress = useSharedValue(initialWaypointId ? 1 : 0);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(initialWaypointId);
  const [spatialMode, setSpatialMode] = useState<'chart' | 'focusing' | 'waypoint' | 'returning'>(
    initialWaypointId ? 'waypoint' : 'chart'
  );

  const finishFocus = useCallback(() => setSpatialMode('waypoint'), []);
  const finishReturn = useCallback(() => {
    setSelectedWaypointId(null);
    setSpatialMode('chart');
    onSpatialModeChange?.(false);
  }, [onSpatialModeChange]);

  useAnimatedReaction(
    () => cameraProgress.value,
    (current, previous) => {
      if (previous === null) return;
      if (current >= 0.999 && previous < 0.999) runOnJS(finishFocus)();
      if (current <= 0.001 && previous > 0.001) runOnJS(finishReturn)();
    },
    [finishFocus, finishReturn]
  );

  const focusWaypoint = (waypointId: string) => {
    if (spatialMode !== 'chart') return;
    if (!chartActions) {
      onOpenWaypoint?.(waypointId);
      return;
    }
    setSelectedWaypointId(waypointId);
    setSpatialMode('focusing');
    onSpatialModeChange?.(true);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (reducedMotion) {
      cameraProgress.value = 1;
      finishFocus();
      return;
    }
    cameraProgress.value = chartTiming(1, { duration: CHART_CAMERA_TIMING.focus, easing: CHART_EASING.deliberate });
  };

  const returnToChart = () => {
    if (!selectedWaypointId || spatialMode === 'returning') return;
    setSpatialMode('returning');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (reducedMotion) {
      cameraProgress.value = 0;
      finishReturn();
      return;
    }
    cameraProgress.value = chartTiming(0, { duration: CHART_CAMERA_TIMING.return, easing: CHART_EASING.deliberate });
  };

  useEffect(() => {
    if (!selectedWaypointId) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      returnToChart();
      return true;
    });
    return () => subscription.remove();
  }, [selectedWaypointId, spatialMode]);

  useEffect(() => () => cancelAnimation(cameraProgress), [cameraProgress]);

  useEffect(() => {
    if (!selectedWaypointId || view.waypoints.some((waypoint) => waypoint.id === selectedWaypointId)) return;
    cancelAnimation(cameraProgress);
    cameraProgress.value = 0;
    setSelectedWaypointId(null);
    setSpatialMode('chart');
    onSpatialModeChange?.(false);
  }, [cameraProgress, onSpatialModeChange, selectedWaypointId, view.waypoints]);

  useEffect(() => {
    if (!journey.ready) return;
    entry.value = reducedMotion ? 1 : chartTiming(1, { duration: ENTRY_TOTAL, easing: CHART_EASING.settle });
    return () => cancelAnimation(entry);
  }, [journey.ready, reducedMotion, entry]);

  useEffect(() => {
    if (!celebration) return;
    bannerOpacity.value = reducedMotion ? 1 : chartTiming(1, { duration: PT.banner });
    celebrationTimer.current = setTimeout(() => {
      bannerOpacity.value = chartTiming(0, { duration: 300 });
      if (celebration.nextTitle) setShowStillRight(true);
      onCelebrationDone();
    }, reducedMotion ? PT.bannerHoldReduced : PT.bannerHold);
    return () => {
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    };
  }, [celebration, reducedMotion, onCelebrationDone, bannerOpacity]);

  const bannerStyle = useAnimatedStyle(() => ({ opacity: bannerOpacity.value }));
  const waypointContentStyle = useAnimatedStyle(() => ({ opacity: cameraProgress.value }));

  const markers: ChartMarker[] = useMemo(
    () =>
      view.waypoints.map((waypoint) => ({
        id: waypoint.id,
        number: waypoint.number,
        state: waypoint.state,
        accessibilityLabel: waypoint.accessibilityLabel,
      })),
    [view.waypoints]
  );

  const current = view.current;
  const mapSummary = current
    ? `Chart map. Waypoint ${current.number} of ${view.total} is current: ${current.title}. Destination: ${view.destination}.`
    : `Chart map. Destination: ${view.destination}.`;

  const { heroMove, otherMoves } = useMemo(
    () => selectHeroAndOtherMoves(current?.moves ?? [], view.oneMove?.id),
    [current?.moves, view.oneMove?.id]
  );

  const completeMoveAction = async (moveId: string) => {
    if (checkingMove) return;
    setCheckingMove(moveId);
    await onCompleteMove(moveId);
    setCheckingMove(null);
  };

  const handleAddMove = async () => {
    if (!current || !newMoveText.trim()) return;
    const title = newMoveText.trim();
    setNewMoveText('');
    await chartActions?.addMove(current.id, title, { makeCurrent: false });
  };

  const handleSuggestMoves = async () => {
    if (!current) return;
    await chartActions?.suggestMoves(current.id);
  };

  const adjustProgressDraft = (delta: number) => {
    const currentVal = Number(progressDraft) || 0;
    const nextVal = Math.max(0, currentVal + delta);
    setProgressDraft(String(nextVal));
  };

  const handleSaveProgress = async () => {
    if (!current) return;
    const num = progressDraft.trim() === '' ? null : Number(progressDraft.replace(/,/g, ''));
    if (num !== null && (!Number.isFinite(num) || num < 0)) return;
    const ok = await chartActions?.updateProgress(current.id, num);
    setProgressSheetOpen(false);
    if (ok && num !== null && current.metric?.target && num >= current.metric.target) {
      setConfirmReachOpen(true);
    }
  };

  const handleSaveEditWaypoint = async () => {
    if (!current || !editTitleDraft.trim()) return;
    await chartActions?.editWaypoint(current.id, {
      title: editTitleDraft.trim(),
      rationale: editRationaleDraft.trim() || null,
    });
    setEditWaypointOpen(false);
  };

  return (
    <ChartInkScreen testID={testID ?? 'chart-active'}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: selectedWaypointId ? 0 : insets.bottom + spacing[8] }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <ChartJourneyWorld
            width={width}
            height={Math.max(280, Math.min(height * 0.55, height - headerHeight - 160))}
            category={identity.category}
            markers={markers}
            progress={journey.progress}
            inspectionBlend={cameraProgress}
            selectedMarkerId={selectedWaypointId}
            onReady={journey.onReady}
            onMarkerPress={focusWaypoint}
            accessibilityLabel={mapSummary}
            style={{ marginTop: headerHeight }}
            testID="chart-hero-map"
          />

          {/* Map Header with back, serif title, menu, category pill, and Vision Polaroid */}
          <View
            style={[styles.overlayHeader, { paddingTop: insets.top }]}
            onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
          >
            <View style={styles.topNavRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={selectedWaypointId ? returnToChart : onBack}
                hitSlop={10}
                style={styles.backButton}
              >
                <ChevronLeft size={24} color="#171717" />
              </Pressable>
              <Text style={styles.headerTitleSerif}>Chart</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chart options"
                hitSlop={10}
                onPress={() => setMenuOpen(true)}
                style={styles.menuButton}
              >
                <MoreHorizontal size={22} color="#171717" />
              </Pressable>
            </View>

            <View style={styles.mapHeaderMeta}>
              {/* Category label with dot */}
              <View style={styles.categoryPill}>
                <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
                <Text style={[styles.categoryText, { color: categoryColor }]}>
                  {identity.category ? identity.category.toUpperCase() : 'DESIRE'}
                </Text>
              </View>

              {/* Tappable Vision polaroid card */}
              {vision ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open Vision"
                  onPress={onOpenVision}
                  style={styles.polaroidCard}
                  testID="chart-polaroid-vision"
                >
                  {vision.imageUrl ? (
                    <Image source={{ uri: vision.imageUrl }} style={styles.polaroidImage} accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={[styles.polaroidImage, styles.polaroidPlaceholder]}>
                      <Flag size={14} color={categoryColor} />
                    </View>
                  )}
                  <Text style={styles.polaroidLabel}>VISION</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {view.isFinished && !selectedWaypointId ? (
          arrivalSettled ? (
            <ChartCompletionPanel view={view} vision={vision} onViewJourney={onOpenLog} onRelease={onRelease ?? onAdjust} />
          ) : (
            <View style={styles.transitionSpace} />
          )
        ) : selectedWaypointId && (spatialMode === 'waypoint' || spatialMode === 'returning') && chartActions ? (
          <Animated.View style={waypointContentStyle}>
            <ChartWaypointContent
              view={view}
              waypointId={selectedWaypointId}
              chart={chartActions}
              category={identity.category}
              reducedMotion={reducedMotion}
              actionError={actionError}
              bottomInset={insets.bottom}
              onBack={returnToChart}
              onReached={(result) => {
                onWaypointReached?.(result, view.reachedCount, view.total);
                returnToChart();
              }}
            />
          </Animated.View>
        ) : spatialMode === 'focusing' ? (
          <View style={styles.transitionSpace} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        ) : (
          <View style={styles.body}>
            {celebration ? (
              <Animated.View style={[styles.celebration, bannerStyle]} accessibilityLiveRegion="assertive" testID="chart-waypoint-reached">
                <ChartEyebrow color="#F2E6CB">{CHART_COPY.labels.waypointReached}</ChartEyebrow>
                <Text style={styles.celebrationTitle}>{celebration.completedTitle}</Text>
                {celebration.nextTitle ? (
                  <View style={styles.celebrationNext}>
                    <ChartEyebrow>{CHART_COPY.labels.next}</ChartEyebrow>
                    <Text style={styles.celebrationNextTitle}>{celebration.nextTitle}</Text>
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {stale ? (
              <View style={styles.offline} accessibilityLiveRegion="polite">
                <WifiOff size={14} color="rgba(244, 246, 250, 0.70)" />
                <Text style={styles.offlineText}>{CHART_COPY.active.offline}</Text>
              </View>
            ) : null}

            {/* 2. CURRENT WAYPOINT BLOCK */}
            {current ? (
              <EntryCard index={0} entry={entry}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Current waypoint, ${current.number} of ${view.total}: ${current.title}${current.metric ? `, ${current.metric.display}` : ''}. Open waypoint.`}
                  onPress={() => focusWaypoint(current.id)}
                  testID="chart-current-waypoint"
                >
                  <View style={styles.compactSection}>
                    <View style={styles.cardHeader}>
                      <ChartEyebrow color="rgba(242, 230, 203, 0.9)">{CHART_COPY.labels.currentWaypoint}</ChartEyebrow>
                      <View style={styles.headerRightRow}>
                        <Text style={styles.position}>{view.positionLabel}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={CHART_COPY.waypoint.edit}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            setEditTitleDraft(current.title);
                            setEditRationaleDraft(current.rationale ?? '');
                            setEditWaypointOpen(true);
                          }}
                          hitSlop={8}
                          style={styles.pencilButton}
                          testID="chart-edit-waypoint-button"
                        >
                          <Pencil size={14} color="rgba(244, 246, 250, 0.70)" />
                        </Pressable>
                      </View>
                    </View>
                    <Text style={styles.waypointTitle}>{current.title}</Text>
                    {current.rationale ? <Text style={styles.rationale}>{current.rationale}</Text> : null}

                    {/* 3. PROGRESS BLOCK */}
                    {current.metric ? (
                      <View style={styles.progressContainer}>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                backgroundColor: categoryColor,
                                width: `${Math.min(100, Math.max(0, current.metric.fraction !== null ? current.metric.fraction * 100 : 0))}%`,
                              },
                            ]}
                          />
                        </View>
                        <View style={styles.progressDataRow}>
                          <Text style={styles.progressValueText}>
                            <Text style={styles.progressCurrentNum}>
                              {current.metric.display}
                            </Text>
                            {current.metric.label ? (
                              <Text style={styles.progressTargetNum}>
                                {` ${current.metric.label}`}
                              </Text>
                            ) : null}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Update progress"
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              setProgressDraft(current.metric?.current != null ? String(current.metric.current) : '0');
                              setProgressSheetOpen(true);
                            }}
                            style={styles.updateProgressButton}
                            testID="chart-update-progress-button"
                          >
                            <Text style={styles.updateProgressText}>Update progress -{'>'}</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              </EntryCard>
            ) : null}

            {showStillRight ? (
              <ChartInkCard testID="chart-still-right">
                <Text style={styles.cardTitle}>{CHART_COPY.adjust.stillRight}</Text>
                <View style={styles.row}>
                  <ChartInkButton label={CHART_COPY.adjust.keep} variant="outline" onPress={() => setShowStillRight(false)} style={styles.flex} />
                  <ChartInkButton
                    label={CHART_COPY.adjust.adjustAhead}
                    onPress={() => {
                      setShowStillRight(false);
                      onAdjust();
                    }}
                    style={styles.flex}
                  />
                </View>
              </ChartInkCard>
            ) : null}

            {/* 4. ONE MOVE HERO CARD & EXPANDABLE LIST */}
            <EntryCard index={1} entry={entry}>
              <View style={[styles.compactSection, styles.primarySection]}>
                <ChartEyebrow color="rgba(242, 230, 203, 0.9)">{CHART_COPY.labels.oneMove}</ChartEyebrow>

                <View style={styles.heroCard} testID="chart-one-move">
                  {heroMove ? (
                    <View style={styles.heroRow}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: checkingMove === heroMove.id, busy: busyKey === `move:${heroMove.id}` }}
                        accessibilityLabel={`Complete move: ${heroMove.title}`}
                        onPress={() => void completeMoveAction(heroMove.id)}
                        hitSlop={10}
                        style={[styles.checkbox, checkingMove === heroMove.id && styles.checkboxOn]}
                        testID="chart-one-move-check"
                      >
                        {checkingMove === heroMove.id ? <Check size={14} color={colors.ink.base} strokeWidth={3} /> : null}
                      </Pressable>
                      <Text style={styles.heroMoveTitle}>{heroMove.title}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Open waypoint moves"
                        onPress={() => setExpandedMoves((prev) => !prev)}
                        hitSlop={8}
                        style={styles.arrowButton}
                      >
                        <ChevronRight size={18} color="rgba(244, 246, 250, 0.45)" />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={CHART_COPY.active.noMoveCta}
                      onPress={() => setExpandedMoves(true)}
                      style={styles.moveEmpty}
                      testID="chart-one-move-empty"
                    >
                      <Text style={styles.moveEmptyText}>{CHART_COPY.active.noMove}</Text>
                      <ChevronRight size={18} color="rgba(244, 246, 250, 0.70)" />
                    </Pressable>
                  )}
                </View>

                {/* Collapsible Other Moves */}
                {otherMoves.length > 0 || expandedMoves ? (
                  <View style={styles.otherMovesContainer}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Other moves, ${otherMoves.length} moves`}
                      onPress={() => setExpandedMoves((prev) => !prev)}
                      style={styles.otherMovesHeader}
                      testID="chart-other-moves-toggle"
                    >
                      <Text style={styles.otherMovesLabel}>Other moves · {otherMoves.length}</Text>
                      {expandedMoves ? (
                        <ChevronUp size={16} color="rgba(244, 246, 250, 0.60)" />
                      ) : (
                        <ChevronDown size={16} color="rgba(244, 246, 250, 0.60)" />
                      )}
                    </Pressable>

                    {expandedMoves ? (
                      <View style={styles.expandedMovesList}>
                        {otherMoves.map((move) => (
                          <View key={move.id} style={styles.otherMoveRow}>
                            <Pressable
                              accessibilityRole="checkbox"
                              accessibilityLabel={`Complete move: ${move.title}`}
                              onPress={() => void completeMoveAction(move.id)}
                              hitSlop={8}
                              style={[styles.checkbox, checkingMove === move.id && styles.checkboxOn]}
                            >
                              {checkingMove === move.id ? <Check size={12} color={colors.ink.base} strokeWidth={3} /> : null}
                            </Pressable>
                            <Text style={styles.otherMoveTitle}>{move.title}</Text>
                            <View style={styles.otherMoveActions}>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Set as hero move"
                                onPress={() => chartActions?.acceptMove(move.id, { makeCurrent: true })}
                                hitSlop={8}
                                style={styles.actionIcon}
                              >
                                <Star size={16} color="rgba(244, 246, 250, 0.50)" />
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Remove move: ${move.title}`}
                                onPress={() => chartActions?.dismissMove(move.id)}
                                hitSlop={8}
                                style={styles.actionIcon}
                              >
                                <X size={16} color="rgba(244, 246, 250, 0.50)" />
                              </Pressable>
                            </View>
                          </View>
                        ))}

                        {/* Add a move */}
                        <View style={styles.addMoveRow}>
                          <Plus size={16} color="rgba(244, 246, 250, 0.60)" />
                          <TextInput
                            value={newMoveText}
                            onChangeText={setNewMoveText}
                            placeholder={CHART_COPY.waypoint.addMove}
                            placeholderTextColor="rgba(244, 246, 250, 0.38)"
                            style={styles.addMoveInput}
                            returnKeyType="done"
                            onSubmitEditing={handleAddMove}
                            accessibilityLabel={CHART_COPY.waypoint.addMove}
                            testID="chart-add-move"
                          />
                          {newMoveText.trim() ? (
                            <Pressable onPress={handleAddMove} hitSlop={8}>
                              <Check size={16} color="#F4F6FA" />
                            </Pressable>
                          ) : null}
                        </View>

                        {/* Suggest moves */}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={CHART_COPY.waypoint.suggest}
                          onPress={handleSuggestMoves}
                          disabled={chartActions?.busy === `suggest:${current?.id}`}
                          style={styles.suggestMovesRow}
                          testID="chart-suggest-moves"
                        >
                          <Sparkles size={14} color={categoryColor} />
                          <Text style={[styles.suggestMovesText, { color: categoryColor }]}>
                            {chartActions?.busy === `suggest:${current?.id}` ? 'Finding moves…' : CHART_COPY.waypoint.suggest}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
              </View>
            </EntryCard>

            {/* 5. PRACTICE ROW */}
            <EntryCard index={2} entry={entry}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isPracticedToday ? 'Practiced today' : 'Practice today. Keep your anchor strong.'}
                onPress={onOpenPractice}
                style={styles.practiceRow}
                testID="chart-practice-row"
              >
                <View style={[styles.practiceIconFrame, { borderColor: `${categoryColor}50` }]}>
                  <Anchor size={18} color={categoryColor} />
                </View>
                <View style={styles.flex}>
                  {isPracticedToday ? (
                    <View style={styles.practicedTodayTitleRow}>
                      <Text style={styles.practiceTitle}>Practiced today</Text>
                      <Check size={15} color={categoryColor} strokeWidth={2.5} style={styles.practiceCheckIcon} />
                    </View>
                  ) : (
                    <>
                      <Text style={styles.practiceTitle}>Practice today</Text>
                      <Text style={styles.practiceSubtext}>Keep your anchor strong</Text>
                    </>
                  )}
                </View>
                <ChevronRight size={18} color="rgba(244, 246, 250, 0.45)" />
              </Pressable>
            </EntryCard>

            {/* 6. DESTINATION ROW */}
            <EntryCard index={3} entry={entry}>
              <View style={styles.destinationSection} testID="chart-destination">
                <ChartEyebrow color="rgba(242, 230, 203, 0.9)">{CHART_COPY.labels.yourDestination}</ChartEyebrow>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Destination: ${vision?.description ?? view.destination}. Open Vision.`}
                  onPress={onOpenVision}
                  style={styles.destinationRow}
                  testID={vision ? 'chart-view-vision' : undefined}
                >
                  <View style={[styles.destinationMark, { borderColor: `${categoryColor}50` }]}>
                    <Flag size={18} color={categoryColor} />
                  </View>
                  <Text style={styles.destinationTitle} numberOfLines={2}>
                    {vision?.description ?? view.destination}
                  </Text>
                  <ChevronRight size={18} color="rgba(244, 246, 250, 0.45)" />
                </Pressable>
              </View>

              {/* 7. COURSE LOG ROW */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Course log, ${daysOnCourse(view.plottedAt)} days on course`}
                onPress={onOpenLog}
                style={styles.courseLogRow}
                testID="chart-course-log"
              >
                <View style={styles.courseLogIconFrame}>
                  <BookOpen size={18} color="#F4F6FA" />
                </View>
                <Text style={styles.courseLogText}>
                  Course log · {daysOnCourse(view.plottedAt)} days on course
                </Text>
                <ChevronRight size={18} color="rgba(244, 246, 250, 0.45)" />
              </Pressable>
            </EntryCard>
          </View>
        )}
      </ScrollView>

      {/* Progress Bottom Sheet */}
      <V2SheetModal
        visible={progressSheetOpen}
        onClose={() => setProgressSheetOpen(false)}
        reduceMotion={reducedMotion}
        testID="chart-progress-sheet"
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Update progress</Text>
          {current?.metric ? (
            <Text style={styles.sheetSubtitle}>
              Target: {formatMetricNumber(current.metric.target)} {current.metric.label ?? ''}
            </Text>
          ) : null}
          <TextInput
            value={progressDraft}
            onChangeText={setProgressDraft}
            keyboardType="decimal-pad"
            style={styles.sheetInput}
            accessibilityLabel="Current progress value"
            testID="chart-progress-input"
          />
          <View style={styles.chipsRow}>
            <Pressable onPress={() => adjustProgressDraft(-10)} style={[styles.chip, styles.chipQuiet]}>
              <Text style={styles.chipTextQuiet}>-10</Text>
            </Pressable>
            <Pressable onPress={() => adjustProgressDraft(10)} style={styles.chip}>
              <Text style={styles.chipText}>+10</Text>
            </Pressable>
            <Pressable onPress={() => adjustProgressDraft(50)} style={styles.chip}>
              <Text style={styles.chipText}>+50</Text>
            </Pressable>
            <Pressable onPress={() => adjustProgressDraft(100)} style={styles.chip}>
              <Text style={styles.chipText}>+100</Text>
            </Pressable>
          </View>
          <V2Button size="large" onPress={handleSaveProgress} loading={chartActions?.busy === `progress:${current?.id}`}>
            Save
          </V2Button>
        </View>
      </V2SheetModal>

      {/* Edit Waypoint Modal */}
      <V2SheetModal
        visible={editWaypointOpen}
        onClose={() => setEditWaypointOpen(false)}
        reduceMotion={reducedMotion}
        testID="chart-edit-waypoint-modal"
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Edit Waypoint</Text>
          <TextInput
            value={editTitleDraft}
            onChangeText={setEditTitleDraft}
            placeholder="Waypoint title"
            placeholderTextColor="rgba(244, 246, 250, 0.38)"
            style={styles.sheetInput}
            maxLength={60}
            accessibilityLabel="Waypoint title"
          />
          <TextInput
            value={editRationaleDraft}
            onChangeText={setEditRationaleDraft}
            placeholder="Why this matters"
            placeholderTextColor="rgba(244, 246, 250, 0.38)"
            multiline
            style={[styles.sheetInput, styles.sheetTextarea]}
            maxLength={400}
            accessibilityLabel="Why this waypoint matters"
          />
          <V2Button size="large" onPress={handleSaveEditWaypoint} loading={chartActions?.busy === `wp-edit:${current?.id}`}>
            Save
          </V2Button>
        </View>
      </V2SheetModal>

      {/* Mark Waypoint Reached Confirm Modal */}
      <V2SheetModal
        visible={confirmReachOpen}
        onClose={() => setConfirmReachOpen(false)}
        reduceMotion={reducedMotion}
        testID="chart-reach-confirm-modal"
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>{CHART_COPY.waypoint.confirmTitle}</Text>
          <Text style={styles.sheetSubtitle}>{CHART_COPY.waypoint.confirmBody}</Text>
          <V2Button
            size="large"
            onPress={async () => {
              if (!current) return;
              setConfirmReachOpen(false);
              const result = await chartActions?.reachWaypoint(current.id);
              if (result) {
                onWaypointReached?.(result, view.reachedCount, view.total);
              }
            }}
            accessibilityLabel={CHART_COPY.waypoint.confirmCta}
            loading={chartActions?.busy === `reach:${current?.id}`}
          >
            {CHART_COPY.waypoint.confirmCta}
          </V2Button>
          <Pressable onPress={() => setConfirmReachOpen(false)} style={styles.cancelLink} hitSlop={10}>
            <Text style={styles.cancelLinkText}>{CHART_COPY.waypoint.notYet}</Text>
          </Pressable>
        </View>
      </V2SheetModal>

      {/* ••• Menu Sheet Modal */}
      <V2SheetModal visible={menuOpen} onClose={() => setMenuOpen(false)} reduceMotion={reducedMotion} testID="chart-menu">
        <View style={styles.menu}>
          <MenuItem
            label="Adjust route"
            onPress={() => {
              setMenuOpen(false);
              onAdjust();
            }}
          />
          <MenuItem
            label="View course log"
            onPress={() => {
              setMenuOpen(false);
              onOpenLog();
            }}
          />
          {vision ? (
            <MenuItem
              label="View Vision"
              onPress={() => {
                setMenuOpen(false);
                onOpenVision();
              }}
            />
          ) : null}
          {current ? (
            <MenuItem
              label="Mark waypoint reached"
              onPress={() => {
                setMenuOpen(false);
                setConfirmReachOpen(true);
              }}
            />
          ) : null}
        </View>
      </V2SheetModal>
    </ChartInkScreen>
  );
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}>
      <Text style={styles.menuText}>{label}</Text>
    </Pressable>
  );
}

export { ChartMetricBar as MetricBar } from './ChartMetricBar';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlayHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: spacing[5],
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleSerif: {
    fontFamily: SERIF_MEDIUM,
    fontSize: 22,
    color: '#171717',
    textAlign: 'center',
  },
  mapHeaderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing[2],
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  polaroidCard: {
    backgroundColor: '#FFFFFF',
    padding: 3,
    paddingBottom: 5,
    borderRadius: 3,
    width: 58,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
  },
  polaroidImage: {
    width: 52,
    height: 44,
    borderRadius: 2,
  },
  polaroidPlaceholder: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  polaroidLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 8,
    letterSpacing: 0.5,
    color: '#171717',
    textAlign: 'center',
    marginTop: 3,
  },
  celebration: {
    padding: spacing[4],
    borderRadius: radii.lg,
    backgroundColor: 'rgba(14, 21, 28, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(242, 230, 203, 0.35)',
    gap: spacing[1],
    marginBottom: spacing[3],
  },
  celebrationTitle: { ...typography.headingLG, color: colors.ink.text.primary },
  celebrationNext: { marginTop: spacing[2], gap: 2 },
  celebrationNextTitle: { ...typography.bodyMD, color: colors.ink.text.primary },
  body: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
    backgroundColor: colors.ink.base,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  compactSection: {
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.10)',
  },
  primarySection: { paddingVertical: spacing[5] },
  transitionSpace: { minHeight: 240 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[1], marginBottom: spacing[2] },
  offlineText: { ...typography.bodySM, color: 'rgba(244, 246, 250, 0.70)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRightRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  position: { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(244, 246, 250, 0.70)' },
  pencilButton: { padding: 4 },
  waypointTitle: {
    fontFamily: SERIF_MEDIUM,
    fontSize: 23,
    lineHeight: 29,
    color: colors.ink.text.primary,
    marginTop: spacing[2],
  },
  rationale: {
    fontFamily: 'Inter-Regular',
    fontSize: 13.5,
    lineHeight: 19,
    color: 'rgba(244, 246, 250, 0.70)',
    marginTop: spacing[1],
  },
  progressContainer: { marginTop: spacing[3] },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  progressValueText: { flexDirection: 'row', alignItems: 'baseline' },
  progressCurrentNum: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14.5,
    color: colors.ink.text.primary,
  },
  progressTargetNum: {
    fontFamily: 'Inter-Regular',
    fontSize: 13.5,
    color: 'rgba(244, 246, 250, 0.70)',
  },
  updateProgressButton: {
    borderWidth: 1,
    borderColor: 'rgba(244, 246, 250, 0.25)',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  updateProgressText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: colors.ink.text.primary,
  },
  cardTitle: { ...typography.headingSM, color: colors.ink.text.primary, marginBottom: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[3] },
  heroCard: {
    backgroundColor: colors.ink.raised,
    borderRadius: radii.lg,
    padding: spacing[4],
    marginTop: spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(244, 246, 250, 0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#F2E6CB', borderColor: '#F2E6CB' },
  heroMoveTitle: {
    flex: 1,
    fontFamily: SERIF_REGULAR,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink.text.primary,
  },
  arrowButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveEmpty: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  moveEmptyText: { flex: 1, ...typography.bodyMD, color: 'rgba(244, 246, 250, 0.70)' },
  otherMovesContainer: { marginTop: spacing[3] },
  otherMovesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  otherMovesLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: 'rgba(244, 246, 250, 0.70)',
  },
  expandedMovesList: {
    marginTop: spacing[2],
    gap: spacing[2],
  },
  otherMoveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radii.md,
  },
  otherMoveTitle: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.ink.text.primary,
  },
  otherMoveActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionIcon: { padding: 4 },
  addMoveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginTop: spacing[1],
  },
  addMoveInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: colors.ink.text.primary,
    padding: 0,
  },
  suggestMovesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
  },
  suggestMovesText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  error: { ...typography.bodySM, color: '#E7A19C', marginTop: spacing[2] },
  practiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.10)',
  },
  practiceIconFrame: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  practicedTodayTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  practiceTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: colors.ink.text.primary,
  },
  practiceCheckIcon: { marginTop: 1 },
  practiceSubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 12.5,
    color: 'rgba(244, 246, 250, 0.70)',
    marginTop: 2,
  },
  destinationSection: {
    paddingTop: spacing[4],
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  destinationMark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  destinationTitle: {
    flex: 1,
    fontFamily: SERIF_REGULAR,
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink.text.primary,
  },
  courseLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  courseLogIconFrame: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  courseLogText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: 'rgba(244, 246, 250, 0.85)',
  },
  sheetContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },
  sheetTitle: {
    fontFamily: SERIF_MEDIUM,
    fontSize: 22,
    color: colors.ink.text.primary,
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: 'rgba(244, 246, 250, 0.70)',
    textAlign: 'center',
  },
  sheetInput: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: colors.ink.raised,
    color: colors.ink.text.primary,
    paddingHorizontal: spacing[4],
    fontFamily: 'Inter-Regular',
    fontSize: 16,
  },
  sheetTextarea: {
    height: 96,
    paddingTop: spacing[3],
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'center',
  },
  chip: {
    flex: 1,
    height: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipQuiet: {
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  chipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: colors.ink.text.primary,
  },
  chipTextQuiet: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: 'rgba(244, 246, 250, 0.60)',
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  cancelLinkText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: 'rgba(244, 246, 250, 0.70)',
  },
  menu: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  menuItem: {
    minHeight: 52,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.10)',
  },
  menuText: { ...typography.labelLG, color: colors.ink.text.primary },
});
