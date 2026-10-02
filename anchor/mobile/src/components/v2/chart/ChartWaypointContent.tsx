import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Anchor, Check, ChevronRight, Pencil } from 'lucide-react-native';
import { formatMetricNumber } from '@/adapters/v2/chart/chartV2Model';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import type { ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import type { UseAnchorChartResult, WaypointReachResult } from '@/hooks/v2/chart/useAnchorChart';
import { useSessionStore } from '@/stores/sessionStore';
import { localDateString } from '@/utils/primingAnalytics';
import { CHART_MAP_REDUCED_FADE, CHART_MAP_TIMING } from './chartMotion';
import type { HighWaterMap, WaypointProgressInput } from './map/chartMapContracts';
import { CHART_MAP_TOKENS as T } from './map/chartMapTokens';
import { isWaypointReady, progressValueRow, toProgressInput, waypointFraction } from './map/chartProgress';
import { CHART_PANEL_COPY as COPY, daysOnCourse, isDayClosed, practicedToday } from './map/chartRhythm';
import { ChartBrushBar } from './panel/ChartBrushBar';
import { ChartConfirmSheet } from './panel/ChartConfirmSheet';
import { ChartMovesManager } from './panel/ChartMovesManager';
import {
  ArrivalCard,
  CommitCard,
  CourseLogCard,
  DayClosedCard,
  DestinationCard,
  MoveListRow,
  OneMoveCard,
  PanelButton,
  PanelCard,
  ProgressChips,
} from './panel/ChartPanelCards';
import { panelAccent } from './panel/chartPanelColors';
import { buildChartLogRows } from './panel/chartPanelLog';
import { useChartProgressBump } from './panel/useChartProgressBump';

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
  Partial<Pick<UseAnchorChartResult, 'setCurrentMove'>>;

type VisionLike = { imageUrl: string | null; description: string | null } | null;

type Props = {
  view: ChartViewModel;
  waypointId: string;
  chart: ChartActions;
  category: string | null | undefined;
  reducedMotion: boolean;
  actionError: string | null;
  bottomInset: number;
  onBack: () => void;
  onReached: (result: WaypointReachResult) => void;
  /** Progress inputs for every waypoint (baseline-aware). Falls back to what the view itself knows. */
  inputs?: WaypointProgressInput[];
  /** Presentation-only high-water marks (the route never retreats). */
  hw?: HighWaterMap;
  /** The clock; tests pass a fixed one. */
  now?: Date;
  /** Overrides the session store's "practiced today". */
  practiced?: boolean;
  vision?: VisionLike;
  onOpenVision?: () => void;
  onOpenLog?: () => void;
  onRelease?: () => void;
  onOpenPractice?: (mode: 'focus' | 'deep_prime') => void;
  /** Completes a move through the orchestrator (so the route can extend). Defaults to chart.completeMove. */
  onCompleteMove?: (moveId: string) => Promise<boolean>;
  /** Shows the "Look how far you've come." commit card for this waypoint number. */
  commit?: { number: number } | null;
  onCommitDismiss?: () => void;
  /** Keeps the day-closed card back until the route has finished extending. */
  dayClosedHold?: boolean;
  /** The destination is reached: the panel becomes the arrival panel. */
  arrived?: boolean;
  /** 'reveal' on the first open after creation: waypoint 1 reads YOUR COURSE BEGINS HERE. */
  entrance?: 'reveal' | 'open';
  testID?: string;
};

const ERROR_TONE = '#E7A19C';

/** Crossfade when the panel switches waypoint. Reduced motion: a 180 ms fade, no movement. */
function useCrossfade(key: string, reducedMotion: boolean) {
  const opacity = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    opacity.value = 0;
    opacity.value = withTiming(1, {
      duration: reducedMotion ? CHART_MAP_REDUCED_FADE : CHART_MAP_TIMING.waypointTap.panelCrossfade,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    });
  }, [key, reducedMotion, opacity]);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

export function ChartWaypointContent({
  view,
  waypointId,
  chart,
  category,
  reducedMotion,
  actionError,
  bottomInset,
  onBack,
  onReached,
  inputs,
  hw,
  now: nowProp,
  practiced: practicedProp,
  vision = null,
  onOpenVision,
  onOpenLog,
  onRelease,
  onOpenPractice,
  onCompleteMove,
  commit = null,
  onCommitDismiss,
  dayClosedHold = false,
  arrived = false,
  entrance = 'open',
  testID,
}: Props) {
  const waypoint = view.waypoints.find((item) => item.id === waypointId) ?? null;
  const accent = useMemo(() => panelAccent(category), [category]);
  // The clock refreshes when the app returns to the foreground and at the next local midnight, so a day-closed
  // card never outlives the day it closed.
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    if (nowProp) return undefined;
    const current = new Date();
    const nextMidnight = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1, 0, 0, 1).getTime();
    const timer = setTimeout(() => setClockTick((value) => value + 1), Math.max(1000, nextMidnight - current.getTime()));
    return () => clearTimeout(timer);
  }, [nowProp, clockTick]);
  useEffect(() => {
    if (nowProp) return undefined;
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') setClockTick((value) => value + 1);
    });
    return () => subscription.remove();
  }, [nowProp]);
  const now = useMemo(() => nowProp ?? new Date(), [nowProp, view.version, clockTick]);
  const todayPractice = useSessionStore((state) => state.todayPractice);
  const practiced = practicedProp ?? practicedToday(todayPractice, now);

  const [expanded, setExpanded] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [dayClosedDismissed, setDayClosedDismissed] = useState(false);
  const [checkingMove, setCheckingMove] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [rationaleDraft, setRationaleDraft] = useState('');
  const [progressDraft, setProgressDraft] = useState<string | null>(null);
  const [progressSheetOpen, setProgressSheetOpen] = useState(false);
  const [sheetProgressVal, setSheetProgressVal] = useState('');
  const [editWaypointModalOpen, setEditWaypointModalOpen] = useState(false);

  const input = useMemo<WaypointProgressInput | null>(() => {
    if (!waypoint) return null;
    return inputs?.find((item) => item.id === waypoint.id) ?? toProgressInput(waypoint);
  }, [inputs, waypoint]);
  const mark = (waypoint && hw?.[waypoint.id]) || 0;

  const bump = useChartProgressBump({
    waypointId,
    currentValue: input?.metric?.current ?? 0,
    version: view.version,
    updateProgress: chart.updateProgress,
  });

  const fade = useCrossfade(`${waypointId}:${waypoint?.state ?? ''}:${arrived}`, reducedMotion);

  // A new completion re-closes the day (and a new day or waypoint starts fresh), so "Do another move now"
  // only hides the card until one of these changes.
  const completedCount = view.waypoints.reduce((sum, item) => sum + item.moves.filter((move) => move.status === 'COMPLETED').length, 0);
  const dateKey = localDateString(now);
  useEffect(() => {
    setDayClosedDismissed(false);
  }, [completedCount, waypointId, dateKey]);

  if (!waypoint || !input) return null;

  const isCurrent = waypoint.state === 'current';
  const isReached = waypoint.state === 'completed';
  const relation: 'upcoming' | 'reached' | 'current' = isReached ? 'reached' : isCurrent ? 'current' : 'upcoming';
  const editable = !isReached;
  const courseBegins = entrance === 'reveal' && isCurrent && waypoint.number === 1 && !arrived;
  const label = arrived ? COPY.labels.arrived : courseBegins ? CHART_COPY.labels.courseBegins : isReached ? COPY.labels.reached : isCurrent ? COPY.labels.current : COPY.labels.upcoming;

  const oneMoveId = view.oneMove?.id ?? null;
  const allMoves = view.waypoints.flatMap((item) => item.moves);
  const incompleteMoves = waypoint.moves.filter((move) => move.status !== 'COMPLETED');
  const starred = incompleteMoves.find((move) => move.id === oneMoveId || move.isCurrent);
  const heroMove = starred ?? incompleteMoves[0] ?? null;
  const otherMoves = waypoint.moves.filter((move) => !heroMove || move.id !== heroMove.id);
  // After a completion the server has already moved the One Move on, so "a next move exists" means a One Move exists.
  const hasNextMove = Boolean(heroMove);

  // The bar follows the same p as the drawn route.
  const p = relation === 'reached' ? 1 : relation === 'upcoming' ? 0 : waypointFraction(input, mark).p;
  const ready = isCurrent && isWaypointReady(input, mark);

  // Optimistic chip taps change the number on screen only; the route waits for the server.
  const shownInput: WaypointProgressInput = input.metric
    ? { ...input, metric: { ...input.metric, current: bump.shownValue } }
    : input;
  const valueRow = progressValueRow(shownInput, relation, mark, waypoint.metric?.label ?? null);
  const valueText = valueRow ? `${valueRow.strong} ${valueRow.span}` : null;

  const dayClosed = isCurrent && !dayClosedDismissed && !dayClosedHold && isDayClosed(allMoves, now);

  const completeMove = async (moveId: string) => {
    if (checkingMove) return;
    setCheckingMove(moveId);
    try {
      await (onCompleteMove ?? chart.completeMove)(moveId);
    } finally {
      setCheckingMove(null);
    }
  };

  const promote = (moveId: string) => {
    if (chart.setCurrentMove) void chart.setCurrentMove(moveId);
    else void chart.acceptMove(moveId, { makeCurrent: true });
  };

  const startEdit = () => {
    setTitleDraft(waypoint.title);
    setRationaleDraft(waypoint.rationale ?? '');
    setEditing((value) => !value);
  };

  const saveEdit = async () => {
    const title = titleDraft.trim();
    if (!title) return;
    const ok = await chart.editWaypoint(waypoint.id, { title, rationale: rationaleDraft.trim() || null });
    if (ok) setEditing(false);
  };

  // Exact entry stays available: tap the number to type it (the chips are for quick nudges).
  const adjustSheetProgress = (delta: number) => {
    const cur = parseFloat(sheetProgressVal) || 0;
    setSheetProgressVal(String(Math.max(0, cur + delta)));
  };

  const handleSaveProgressSheet = async () => {
    const val = parseFloat(sheetProgressVal);
    if (!isNaN(val) && val >= 0) {
      await chart.updateProgress(waypoint.id, val);
      setProgressSheetOpen(false);
    }
  };

  const saveProgress = async () => {
    if (progressDraft === null) return;
    const value = progressDraft.trim() === '' ? null : Number(progressDraft.replace(/,/g, ''));
    if (value !== null && (!Number.isFinite(value) || value < 0)) return;
    if (await chart.updateProgress(waypoint.id, value)) setProgressDraft(null);
  };

  const reach = async () => {
    setConfirmOpen(false);
    const result = await chart.reachWaypoint(waypoint.id);
    if (result) onReached(result);
  };

  const noop = () => undefined;
  const barLabel = `${waypoint.title}, ${Math.round(p * 100)}%`;

  const body = (
    <>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: accent.text }]}>{label}</Text>
        <View style={styles.labelEnd}>
          <Text style={styles.position}>{COPY.position(arrived ? view.total : waypoint.number, view.total)}</Text>
          {editable && !arrived ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={CHART_COPY.waypoint.edit}
              accessibilityState={{ expanded: editing }}
              onPress={startEdit}
              style={styles.editButton}
              testID="chart-edit-waypoint-button"
            >
              <Pencil size={16} color={T.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {arrived ? (
        <>
          <Text accessibilityRole="header" style={styles.title}>{COPY.arrivedTitle}</Text>
          <Text style={styles.why}>{view.destination}</Text>
          <ArrivalCard accent={accent} vision={vision} onOpenVision={onOpenVision ?? noop} onRelease={onRelease ?? noop} />
        </>
      ) : (
        <>
          {editing ? (
            <View style={styles.editBlock}>
              <TextInput value={titleDraft} onChangeText={setTitleDraft} maxLength={60} accessibilityLabel="Waypoint title" placeholderTextColor={T.muted} style={styles.editTitle} />
              <TextInput
                value={rationaleDraft}
                onChangeText={setRationaleDraft}
                maxLength={400}
                multiline
                placeholder="Why this matters"
                placeholderTextColor={T.muted}
                accessibilityLabel="Why this waypoint matters"
                style={styles.editRationale}
              />
              <View style={styles.row}>
                <PanelButton label="Cancel" accent={accent} onPress={() => setEditing(false)} style={styles.flex} />
                <PanelButton label="Save" variant="primary" accent={accent} loading={chart.busy === `wp-edit:${waypoint.id}`} onPress={() => void saveEdit()} style={styles.flex} />
              </View>
              {!isCurrent && view.total > 1 ? (
                <PanelButton
                  label={CHART_COPY.waypoint.remove}
                  variant="link"
                  accent={accent}
                  onPress={async () => {
                    if (await chart.removeWaypoint(waypoint.id)) onBack();
                  }}
                />
              ) : null}
            </View>
          ) : (
            <>
              <Text accessibilityRole="header" style={styles.title}>{waypoint.title}</Text>
              {waypoint.rationale ? <Text style={styles.why}>{waypoint.rationale}</Text> : null}
            </>
          )}

          <ChartBrushBar fraction={p} color={accent.fill} reducedMotion={reducedMotion} accessibilityLabel={barLabel} testID="chart-waypoint-bar" />
          {valueRow ? (
            isCurrent && input.metric && progressDraft !== null ? (
              <View style={styles.progressRow}>
                <TextInput
                  value={progressDraft}
                  onChangeText={setProgressDraft}
                  keyboardType="decimal-pad"
                  autoFocus
                  accessibilityLabel={`Current ${waypoint.metric?.label ?? 'value'}`}
                  placeholder="0"
                  placeholderTextColor={T.muted}
                  style={styles.progressInput}
                />
                <PanelButton label="Save" variant="primary" accent={accent} loading={chart.busy === `progress:${waypoint.id}`} onPress={() => void saveProgress()} />
              </View>
            ) : isCurrent && input.metric ? (
              <View style={styles.progressDataRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={CHART_COPY.waypoint.progress}
                  accessibilityHint={valueText ?? undefined}
                  onPress={() => {
                    setSheetProgressVal(waypoint.metric?.current != null ? String(waypoint.metric.current) : '0');
                    setProgressSheetOpen(true);
                  }}
                  style={styles.valueRow}
                  testID="chart-waypoint-progress"
                >
                  <Text style={styles.valueStrong}>{valueRow.strong}</Text>
                  {valueRow.span ? <Text style={styles.valueSpan}>{valueRow.span}</Text> : null}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Update progress"
                  onPress={() => {
                    setSheetProgressVal(waypoint.metric?.current != null ? String(waypoint.metric.current) : '0');
                    setProgressSheetOpen(true);
                  }}
                  style={styles.updateProgressButton}
                  testID="chart-update-progress-button"
                >
                  <Text style={[styles.updateProgressText, { color: accent.text }]}>Update progress →</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.valueRow} accessible accessibilityLabel={valueText ?? undefined} testID="chart-waypoint-value">
                <Text style={styles.valueStrong}>{valueRow.strong}</Text>
                {valueRow.span ? <Text style={styles.valueSpan}>{valueRow.span}</Text> : null}
              </View>
            )
          ) : null}

          {isCurrent && commit ? <CommitCard accent={accent} number={commit.number} onCommit={onCommitDismiss ?? noop} /> : null}

          {isCurrent ? (
            <>
              {dayClosed ? (
                <DayClosedCard
                  accent={accent}
                  practiced={practiced}
                  hasNext={hasNextMove}
                  onFocus={() => onOpenPractice?.('focus')}
                  onDeepFocus={() => onOpenPractice?.('deep_prime')}
                  onAnother={() => setDayClosedDismissed(true)}
                />
              ) : null}
              {!dayClosed ? (
                <OneMoveCard
                  accent={accent}
                  variant={heroMove ? 'move' : waypoint.moves.some((move) => move.status === 'COMPLETED') && incompleteMoves.length === 0 ? 'allDone' : 'empty'}
                  title={heroMove?.title ?? null}
                  emptyLabel={CHART_COPY.active.noMove}
                  checked={Boolean(heroMove && checkingMove === heroMove.id)}
                  busy={Boolean(heroMove && chart.busy === `move:${heroMove.id}`)}
                  expanded={expanded}
                  reducedMotion={reducedMotion}
                  otherMovesCount={otherMoves.length}
                  onCheck={() => heroMove && void completeMove(heroMove.id)}
                  onToggle={() => setExpanded((value) => !value)}
                >
                  {otherMoves.map((move) => (
                    <MoveListRow
                      key={move.id}
                      move={move}
                      accent={accent}
                      isOneMove={move.id === oneMoveId}
                      canComplete={move.status === 'ACTIVE'}
                      canPromote={move.status === 'ACTIVE'}
                      busy={chart.busy === `move:${move.id}` || chart.busy === `move-current:${move.id}`}
                      onComplete={() => void completeMove(move.id)}
                      onPromote={() => promote(move.id)}
                      onRemove={() => void chart.dismissMove(move.id)}
                    />
                  ))}
                  <ChartMovesManager waypoint={waypoint} isCurrent oneMoveId={oneMoveId} accent={accent} chart={chart} />
                </OneMoveCard>
              ) : null}
              {!dayClosed ? (
                <View style={styles.practiceRowContainer}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={practiced ? 'Practiced today' : 'Practice today'}
                    onPress={() => onOpenPractice?.(practiced ? 'deep_prime' : 'focus')}
                    style={styles.practiceRow}
                    testID="chart-practice-row"
                  >
                    <View style={[styles.practiceIconFrame, { borderColor: `${accent.fill}40` }]}>
                      <Anchor size={18} color={accent.text} />
                    </View>
                    <View style={styles.flex}>
                      {practiced ? (
                        <View style={styles.practicedTodayTitleRow}>
                          <Text style={[styles.practiceTitle, styles.practiceTitleDone]}>Practiced today</Text>
                          <Check size={16} color={accent.text} strokeWidth={2.5} style={styles.practiceCheckIcon} />
                        </View>
                      ) : (
                        <>
                          <Text style={styles.practiceTitle}>Practice today</Text>
                          <Text style={styles.practiceSubtext}>Keep your anchor strong</Text>
                        </>
                      )}
                    </View>
                    <ChevronRight size={18} color={T.muted} />
                  </Pressable>
                </View>
              ) : null}
              {actionError ? <Text accessibilityLiveRegion="polite" style={styles.error} testID="chart-action-error">{actionError}</Text> : null}
            </>
          ) : (
            <>
              <PanelCard style={styles.readOnly}>
                {waypoint.moves.map((move) => (
                  <MoveListRow
                    key={move.id}
                    move={move}
                    accent={accent}
                    isOneMove={false}
                    canComplete={false}
                    canPromote={false}
                    busy={false}
                    onComplete={noop}
                    onPromote={noop}
                    onRemove={noop}
                  />
                ))}
                {editable ? <ChartMovesManager waypoint={waypoint} isCurrent={false} oneMoveId={oneMoveId} accent={accent} chart={chart} /> : null}
              </PanelCard>
              {actionError ? <Text accessibilityLiveRegion="polite" style={styles.error} testID="chart-action-error">{actionError}</Text> : null}
              <PanelButton label={COPY.back} accent={accent} onPress={onBack} testID="chart-back-to-current" style={styles.cta} />
            </>
          )}
        </>
      )}

      {!arrived ? <DestinationCard accent={accent} destination={view.destination} vision={vision} onOpenVision={onOpenVision ?? noop} /> : null}
      <CourseLogCard
        accent={accent}
        days={daysOnCourse(view.plottedAt, now)}
        rows={buildChartLogRows(view, now)}
        expanded={logOpen}
        onToggle={() => setLogOpen((value) => !value)}
        onOpenLog={onOpenLog ?? noop}
      />
    </>
  );

  return (
    <View testID={testID ?? 'chart-waypoint-content'} style={[styles.root, { paddingBottom: bottomInset + 24 }]}>
      <Animated.View style={[styles.stack, fade]} testID={isCurrent && !arrived ? 'chart-current-waypoint' : 'chart-panel-body'}>
        {body}
      </Animated.View>
      <V2SheetModal
        visible={progressSheetOpen}
        onClose={() => setProgressSheetOpen(false)}
        reduceMotion={reducedMotion}
        scrimColor="rgba(0, 0, 0, 0.65)"
        testID="chart-progress-sheet"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetAvoidance}
        >
          <View style={[styles.sheetSurface, { paddingBottom: Math.max(bottomInset, 20) + 16 + V2_SHEET_SKIRT, marginBottom: -V2_SHEET_SKIRT }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Update progress</Text>
            {waypoint?.metric ? (
              <Text style={styles.sheetSubtitle}>
                Target: {formatMetricNumber(waypoint.metric.target)}{waypoint.metric.label ? ` ${waypoint.metric.label}` : ''}
              </Text>
            ) : null}
            <TextInput
              value={sheetProgressVal}
              onChangeText={setSheetProgressVal}
              keyboardType="decimal-pad"
              style={styles.sheetInput}
              accessibilityLabel={waypoint?.metric?.label ? `Current ${waypoint.metric.label}` : 'Current progress value'}
              testID="chart-progress-input"
            />
            <View style={styles.chipsRow}>
              <Pressable
                testID="chart-sheet-chip--10"
                onPress={() => adjustSheetProgress(-10)}
                style={[styles.sheetChip, styles.sheetChipQuiet]}
                accessibilityRole="button"
                accessibilityLabel="Decrease by 10"
              >
                <Text style={styles.sheetChipTextQuiet}>-10</Text>
              </Pressable>
              <Pressable
                testID="chart-sheet-chip-+10"
                onPress={() => adjustSheetProgress(10)}
                style={styles.sheetChip}
                accessibilityRole="button"
                accessibilityLabel="Increase by 10"
              >
                <Text style={styles.sheetChipText}>+10</Text>
              </Pressable>
              <Pressable
                testID="chart-sheet-chip-+50"
                onPress={() => adjustSheetProgress(50)}
                style={styles.sheetChip}
                accessibilityRole="button"
                accessibilityLabel="Increase by 50"
              >
                <Text style={styles.sheetChipText}>+50</Text>
              </Pressable>
              <Pressable
                testID="chart-sheet-chip-+100"
                onPress={() => adjustSheetProgress(100)}
                style={styles.sheetChip}
                accessibilityRole="button"
                accessibilityLabel="Increase by 100"
              >
                <Text style={styles.sheetChipText}>+100</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save progress"
              onPress={handleSaveProgressSheet}
              disabled={chart.busy === `progress:${waypoint.id}`}
              style={[styles.sheetSaveButton, { backgroundColor: accent.fill }]}
              testID="chart-save-progress"
            >
              <Text style={[styles.sheetSaveButtonText, { color: accent.onFill }]}>
                {chart.busy === `progress:${waypoint.id}` ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </V2SheetModal>

      <V2SheetModal
        visible={editWaypointModalOpen}
        onClose={() => setEditWaypointModalOpen(false)}
        reduceMotion={reducedMotion}
        testID="chart-edit-waypoint-modal"
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Edit Waypoint</Text>
          <TextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            maxLength={60}
            accessibilityLabel="Waypoint title"
            placeholderTextColor={T.muted}
            style={styles.editTitle}
          />
          <TextInput
            value={rationaleDraft}
            onChangeText={setRationaleDraft}
            maxLength={400}
            multiline
            placeholder="Why this matters"
            placeholderTextColor={T.muted}
            accessibilityLabel="Why this waypoint matters"
            style={styles.editRationale}
          />
          <V2Button size="large" onPress={async () => { await saveEdit(); setEditWaypointModalOpen(false); }}>
            Save
          </V2Button>
        </View>
      </V2SheetModal>

      <ChartConfirmSheet
        visible={confirmOpen}
        title={waypoint.title}
        accent={accent}
        reducedMotion={reducedMotion}
        busy={chart.busy === `reach:${waypoint.id}`}
        onYes={() => void reach()}
        onNotYet={() => setConfirmOpen(false)}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  practiceRowContainer: { marginVertical: 4 },
  practiceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, backgroundColor: T.panel, borderWidth: 1, borderColor: T.line, borderRadius: 16 },
  practiceIconFrame: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)' },
  practicedTodayTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  practiceTitle: { fontFamily: T.sansStrong, fontSize: 15, color: T.light },
  practiceTitleDone: { color: T.muted },
  practiceCheckIcon: { marginTop: 1 },
  practiceSubtext: { fontFamily: T.sans, fontSize: 13, color: T.muted, marginTop: 2 },
  sheetAvoidance: { width: '100%', justifyContent: 'flex-end' },
  sheetSurface: {
    backgroundColor: T.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: T.line,
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 16,
    overflow: 'hidden',
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.2)', alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontFamily: T.serif, fontSize: 24, lineHeight: 28, color: T.light, textAlign: 'center' },
  sheetSubtitle: { fontFamily: T.sans, fontSize: 14, color: T.muted, textAlign: 'center', marginTop: -8 },
  sheetInput: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: 'rgba(0, 0, 0, 0.2)', color: T.light, paddingHorizontal: 16, fontFamily: T.sansStrong, fontSize: 18, textAlign: 'center' },
  chipsRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  sheetChip: { flex: 1, height: 42, borderRadius: 21, borderWidth: 1, borderColor: T.line, backgroundColor: 'rgba(255, 255, 255, 0.08)', alignItems: 'center', justifyContent: 'center' },
  sheetChipQuiet: { borderColor: 'rgba(255, 255, 255, 0.06)', backgroundColor: 'rgba(255, 255, 255, 0.03)' },
  sheetChipText: { fontFamily: T.sansStrong, fontSize: 14, color: T.light },
  sheetChipTextQuiet: { fontFamily: T.sansStrong, fontSize: 14, color: T.muted },
  sheetSaveButton: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  sheetSaveButtonText: { fontFamily: T.sansStrong, fontSize: 16 },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  progressDataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  updateProgressButton: { borderWidth: 1, borderColor: T.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  updateProgressText: { fontFamily: T.sansStrong, fontSize: 12 },
  flex: { flex: 1 },
  root: { backgroundColor: T.ink, paddingTop: 10, paddingHorizontal: 16 },
  stack: { gap: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  labelEnd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontFamily: T.sansStrong, fontSize: 11, letterSpacing: 1.8 },
  position: { fontFamily: T.sansStrong, fontSize: 11, letterSpacing: 1.8, color: T.muted },
  editButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginVertical: -10, marginRight: -12 },
  title: { fontFamily: T.serif, fontSize: 30, lineHeight: 33, color: T.light },
  why: { fontFamily: T.sans, fontSize: 14, lineHeight: 20, color: T.muted },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 44 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressInput: { flex: 1, fontFamily: T.sans, fontSize: 16, color: T.light, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 12, minHeight: 44 },
  valueStrong: { fontFamily: T.serif, fontSize: 24, color: T.light, fontVariant: ['tabular-nums'] },
  valueSpan: { flexShrink: 1, textAlign: 'right', fontFamily: T.sans, fontSize: 12, color: T.muted },
  cta: { minHeight: 48, alignSelf: 'stretch' },
  error: { fontFamily: T.sans, fontSize: 13, lineHeight: 18, color: ERROR_TONE },
  readOnly: { paddingVertical: 6 },
  row: { flexDirection: 'row', gap: 8 },
  editBlock: { gap: 10 },
  editTitle: { fontFamily: T.serif, fontSize: 26, color: T.light, borderBottomWidth: 1, borderBottomColor: T.line, paddingVertical: 8 },
  editRationale: { fontFamily: T.sans, fontSize: 15, color: T.light, borderWidth: 1, borderColor: T.line, borderRadius: 12, padding: 12, minHeight: 72, textAlignVertical: 'top' },
});

// DEFERRED: ===== Previous cream-panel ChartWaypointContent (replaced by the ink panel above; kept for reference) =====
// DEFERRED: import { chartTypography as typography } from './chartTypography';
// DEFERRED: import React, { useState } from 'react';
// DEFERRED: import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// DEFERRED: import { Check, Pencil, Plus, Sparkles, Star, X } from 'lucide-react-native';
// DEFERRED: import { V2Button } from '@/components/v2/primitives/V2Button';
// DEFERRED: import { V2SheetModal } from '@/components/v2/primitives/V2SheetModal';
// DEFERRED: import { CHART_COPY } from '@/constants/v2/chartCopy';
// DEFERRED: import type { ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
// DEFERRED: import type { UseAnchorChartResult, WaypointReachResult } from '@/hooks/v2/chart/useAnchorChart';
// DEFERRED: import { colors, getCategoryColor, radii, spacing } from '@/theme/v2';
// DEFERRED: import type { MoveSummary } from '@/types/chart';
// DEFERRED: import { ChartCreamPanel, ChartEyebrow } from './ChartChrome';
// DEFERRED: import { ChartMetricBar } from './ChartMetricBar';
// DEFERRED: 
// DEFERRED: type Props = {
// DEFERRED:   view: ChartViewModel;
// DEFERRED:   waypointId: string;
// DEFERRED:   chart: Pick<
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
// DEFERRED:   category: string | null | undefined;
// DEFERRED:   reducedMotion: boolean;
// DEFERRED:   actionError: string | null;
// DEFERRED:   bottomInset: number;
// DEFERRED:   onBack: () => void;
// DEFERRED:   onReached: (result: WaypointReachResult) => void;
// DEFERRED: };
// DEFERRED: 
// DEFERRED: export function ChartWaypointContent({
// DEFERRED:   view,
// DEFERRED:   waypointId,
// DEFERRED:   chart,
// DEFERRED:   category,
// DEFERRED:   reducedMotion,
// DEFERRED:   actionError,
// DEFERRED:   bottomInset,
// DEFERRED:   onBack,
// DEFERRED:   onReached,
// DEFERRED: }: Props) {
// DEFERRED:   const waypoint = view.waypoints.find((item) => item.id === waypointId) ?? null;
// DEFERRED:   const [newMove, setNewMove] = useState('');
// DEFERRED:   const [editing, setEditing] = useState(false);
// DEFERRED:   const [titleDraft, setTitleDraft] = useState('');
// DEFERRED:   const [rationaleDraft, setRationaleDraft] = useState('');
// DEFERRED:   const [progressDraft, setProgressDraft] = useState<string | null>(null);
// DEFERRED:   const [confirmOpen, setConfirmOpen] = useState(false);
// DEFERRED:   const [suggestState, setSuggestState] = useState<'idle' | 'unavailable'>('idle');
// DEFERRED: 
// DEFERRED:   if (!waypoint) return null;
// DEFERRED: 
// DEFERRED:   const isCurrent = waypoint.state === 'current';
// DEFERRED:   const editable = waypoint.state !== 'completed';
// DEFERRED:   const oneMoveId = view.oneMove?.id ?? null;
// DEFERRED:   const categoryColor = getCategoryColor(category);
// DEFERRED: 
// DEFERRED:   const submitMove = async () => {
// DEFERRED:     const title = newMove.trim();
// DEFERRED:     if (!title) return;
// DEFERRED:     if (await chart.addMove(waypoint.id, title, { makeCurrent: isCurrent && !oneMoveId })) setNewMove('');
// DEFERRED:   };
// DEFERRED: 
// DEFERRED:   const saveEdit = async () => {
// DEFERRED:     const title = titleDraft.trim();
// DEFERRED:     if (!title) return;
// DEFERRED:     const ok = await chart.editWaypoint(waypoint.id, { title, rationale: rationaleDraft.trim() || null });
// DEFERRED:     if (ok) setEditing(false);
// DEFERRED:   };
// DEFERRED: 
// DEFERRED:   const saveProgress = async () => {
// DEFERRED:     if (progressDraft === null) return;
// DEFERRED:     const value = progressDraft.trim() === '' ? null : Number(progressDraft.replace(/,/g, ''));
// DEFERRED:     if (value !== null && (!Number.isFinite(value) || value < 0)) return;
// DEFERRED:     if (await chart.updateProgress(waypoint.id, value)) setProgressDraft(null);
// DEFERRED:   };
// DEFERRED: 
// DEFERRED:   const reach = async () => {
// DEFERRED:     setConfirmOpen(false);
// DEFERRED:     const result = await chart.reachWaypoint(waypoint.id);
// DEFERRED:     if (result) onReached(result);
// DEFERRED:   };
// DEFERRED: 
// DEFERRED:   const suggest = async () => {
// DEFERRED:     const outcome = await chart.suggestMoves(waypoint.id);
// DEFERRED:     setSuggestState(outcome === 'ok' ? 'idle' : 'unavailable');
// DEFERRED:   };
// DEFERRED: 
// DEFERRED:   return (
// DEFERRED:     <View testID="chart-waypoint-content">
// DEFERRED:       <View style={styles.header}>
// DEFERRED:         <View style={styles.headerRow}>
// DEFERRED:           <Pressable accessibilityRole="button" accessibilityLabel="Back to Chart" onPress={onBack} hitSlop={10} style={styles.back}>
// DEFERRED:             <Text style={styles.backText}>Back to Chart</Text>
// DEFERRED:           </Pressable>
// DEFERRED:           {editable ? (
// DEFERRED:             <Pressable
// DEFERRED:               accessibilityRole="button"
// DEFERRED:               accessibilityLabel={CHART_COPY.waypoint.edit}
// DEFERRED:               hitSlop={10}
// DEFERRED:               onPress={() => {
// DEFERRED:                 setTitleDraft(waypoint.title);
// DEFERRED:                 setRationaleDraft(waypoint.rationale ?? '');
// DEFERRED:                 setEditing((value) => !value);
// DEFERRED:               }}
// DEFERRED:               style={styles.editButton}
// DEFERRED:             >
// DEFERRED:               <Pencil size={18} color={colors.ink.text.primary} />
// DEFERRED:             </Pressable>
// DEFERRED:           ) : null}
// DEFERRED:         </View>
// DEFERRED:         <Text style={styles.position}>
// DEFERRED:           Waypoint {waypoint.number} of {view.total}
// DEFERRED:           {waypoint.state === 'completed' ? ' · reached' : ''}
// DEFERRED:         </Text>
// DEFERRED:         {editing ? (
// DEFERRED:           <View style={styles.editBlock}>
// DEFERRED:             <TextInput value={titleDraft} onChangeText={setTitleDraft} maxLength={60} accessibilityLabel="Waypoint title" style={styles.editTitle} />
// DEFERRED:             <TextInput
// DEFERRED:               value={rationaleDraft}
// DEFERRED:               onChangeText={setRationaleDraft}
// DEFERRED:               maxLength={400}
// DEFERRED:               multiline
// DEFERRED:               placeholder="Why this matters"
// DEFERRED:               placeholderTextColor={colors.ink.text.tertiary}
// DEFERRED:               accessibilityLabel="Why this waypoint matters"
// DEFERRED:               style={styles.editRationale}
// DEFERRED:             />
// DEFERRED:             <View style={styles.row}>
// DEFERRED:               <V2Button variant="secondary" onPress={() => setEditing(false)} style={styles.flex}>Cancel</V2Button>
// DEFERRED:               <V2Button onPress={() => void saveEdit()} loading={chart.busy === `wp-edit:${waypoint.id}`} style={styles.flex}>Save</V2Button>
// DEFERRED:             </View>
// DEFERRED:             {!isCurrent && view.total > 1 ? (
// DEFERRED:               <Pressable
// DEFERRED:                 accessibilityRole="button"
// DEFERRED:                 accessibilityLabel={CHART_COPY.waypoint.remove}
// DEFERRED:                 onPress={async () => {
// DEFERRED:                   if (await chart.removeWaypoint(waypoint.id)) onBack();
// DEFERRED:                 }}
// DEFERRED:                 style={styles.remove}
// DEFERRED:               >
// DEFERRED:                 <Text style={styles.removeText}>{CHART_COPY.waypoint.remove}</Text>
// DEFERRED:               </Pressable>
// DEFERRED:             ) : null}
// DEFERRED:           </View>
// DEFERRED:         ) : (
// DEFERRED:           <>
// DEFERRED:             <Text accessibilityRole="header" style={styles.title}>{waypoint.title}</Text>
// DEFERRED:             {waypoint.rationale ? <Text style={styles.rationale}>{waypoint.rationale}</Text> : null}
// DEFERRED:           </>
// DEFERRED:         )}
// DEFERRED:         {waypoint.metric ? (
// DEFERRED:           <View>
// DEFERRED:             <ChartMetricBar metric={waypoint.metric} color={categoryColor} />
// DEFERRED:             {isCurrent ? (
// DEFERRED:               progressDraft === null ? (
// DEFERRED:                 <Pressable
// DEFERRED:                   accessibilityRole="button"
// DEFERRED:                   accessibilityLabel={CHART_COPY.waypoint.progress}
// DEFERRED:                   onPress={() => setProgressDraft(waypoint.metric?.current != null ? String(waypoint.metric.current) : '')}
// DEFERRED:                   style={styles.inlineAction}
// DEFERRED:                   testID="chart-waypoint-progress"
// DEFERRED:                 >
// DEFERRED:                   <Text style={styles.inlineActionText}>{CHART_COPY.waypoint.progress}</Text>
// DEFERRED:                 </Pressable>
// DEFERRED:               ) : (
// DEFERRED:                 <View style={styles.progressRow}>
// DEFERRED:                   <TextInput
// DEFERRED:                     value={progressDraft}
// DEFERRED:                     onChangeText={setProgressDraft}
// DEFERRED:                     keyboardType="decimal-pad"
// DEFERRED:                     autoFocus
// DEFERRED:                     accessibilityLabel={`Current ${waypoint.metric.label ?? 'value'}`}
// DEFERRED:                     style={styles.progressInput}
// DEFERRED:                     placeholder="0"
// DEFERRED:                   />
// DEFERRED:                   <V2Button size="compact" onPress={() => void saveProgress()} loading={chart.busy === `progress:${waypoint.id}`}>Save</V2Button>
// DEFERRED:                 </View>
// DEFERRED:               )
// DEFERRED:             ) : null}
// DEFERRED:           </View>
// DEFERRED:         ) : null}
// DEFERRED:       </View>
// DEFERRED: 
// DEFERRED:       <ChartCreamPanel style={[styles.panel, { paddingBottom: bottomInset + spacing[4] }]}>
// DEFERRED:         {waypoint.moves.length > 0 ? (
// DEFERRED:           <View style={styles.section}>
// DEFERRED:             <ChartEyebrow tone="cream">{CHART_COPY.labels.yourMoves}</ChartEyebrow>
// DEFERRED:             {waypoint.moves.map((move) => (
// DEFERRED:               <MoveRow
// DEFERRED:                 key={move.id}
// DEFERRED:                 move={move}
// DEFERRED:                 isOneMove={move.id === oneMoveId}
// DEFERRED:                 busy={chart.busy === `move:${move.id}`}
// DEFERRED:                 canPromote={isCurrent && move.status === 'ACTIVE' && move.id !== oneMoveId}
// DEFERRED:                 onComplete={() => void chart.completeMove(move.id)}
// DEFERRED:                 onPromote={() => void chart.acceptMove(move.id, { makeCurrent: true })}
// DEFERRED:                 onRemove={() => void chart.dismissMove(move.id)}
// DEFERRED:               />
// DEFERRED:             ))}
// DEFERRED:           </View>
// DEFERRED:         ) : null}
// DEFERRED: 
// DEFERRED:         {editable ? (
// DEFERRED:           <View style={styles.section}>
// DEFERRED:             <ChartEyebrow tone="cream">{CHART_COPY.labels.suggestedMoves}</ChartEyebrow>
// DEFERRED:             {waypoint.suggestedMoves.map((move) => (
// DEFERRED:               <View key={move.id} style={styles.suggestion}>
// DEFERRED:                 <Pressable
// DEFERRED:                   accessibilityRole="button"
// DEFERRED:                   accessibilityLabel={`Add suggested move: ${move.title}`}
// DEFERRED:                   onPress={() => void chart.acceptMove(move.id, { makeCurrent: isCurrent && !oneMoveId })}
// DEFERRED:                   style={styles.suggestionAccept}
// DEFERRED:                 >
// DEFERRED:                   <View style={styles.checkboxEmpty} />
// DEFERRED:                   <Text style={styles.moveText}>{move.title}</Text>
// DEFERRED:                 </Pressable>
// DEFERRED:                 <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss suggestion: ${move.title}`} hitSlop={8} onPress={() => void chart.dismissMove(move.id)}>
// DEFERRED:                   <X size={16} color={colors.text.secondary} />
// DEFERRED:                 </Pressable>
// DEFERRED:               </View>
// DEFERRED:             ))}
// DEFERRED:             {waypoint.suggestedMoves.length === 0 ? (
// DEFERRED:               <Pressable
// DEFERRED:                 accessibilityRole="button"
// DEFERRED:                 accessibilityLabel={CHART_COPY.waypoint.suggest}
// DEFERRED:                 onPress={() => void suggest()}
// DEFERRED:                 disabled={chart.busy === `suggest:${waypoint.id}`}
// DEFERRED:                 style={styles.suggestButton}
// DEFERRED:                 testID="chart-suggest-moves"
// DEFERRED:               >
// DEFERRED:                 <Sparkles size={16} color={colors.text.primary} />
// DEFERRED:                 <Text style={styles.suggestText}>{chart.busy === `suggest:${waypoint.id}` ? 'Finding moves…' : CHART_COPY.waypoint.suggest}</Text>
// DEFERRED:               </Pressable>
// DEFERRED:             ) : null}
// DEFERRED:             {suggestState === 'unavailable' ? <Text style={styles.hint}>{CHART_COPY.waypoint.suggestUnavailable}</Text> : null}
// DEFERRED:             <View style={styles.addRow}>
// DEFERRED:               <Plus size={18} color={colors.text.primary} />
// DEFERRED:               <TextInput
// DEFERRED:                 value={newMove}
// DEFERRED:                 onChangeText={setNewMove}
// DEFERRED:                 placeholder={CHART_COPY.waypoint.addMove}
// DEFERRED:                 placeholderTextColor={colors.text.tertiary}
// DEFERRED:                 maxLength={120}
// DEFERRED:                 returnKeyType="done"
// DEFERRED:                 onSubmitEditing={() => void submitMove()}
// DEFERRED:                 accessibilityLabel={CHART_COPY.waypoint.addMove}
// DEFERRED:                 style={styles.addInput}
// DEFERRED:                 testID="chart-add-move"
// DEFERRED:               />
// DEFERRED:               {newMove.trim() ? (
// DEFERRED:                 <Pressable accessibilityRole="button" accessibilityLabel="Save move" onPress={() => void submitMove()} hitSlop={8}>
// DEFERRED:                   <Check size={18} color={colors.text.primary} />
// DEFERRED:                 </Pressable>
// DEFERRED:               ) : null}
// DEFERRED:             </View>
// DEFERRED:           </View>
// DEFERRED:         ) : null}
// DEFERRED: 
// DEFERRED:         {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
// DEFERRED:         {isCurrent ? (
// DEFERRED:           <V2Button
// DEFERRED:             size="large"
// DEFERRED:             onPress={() => setConfirmOpen(true)}
// DEFERRED:             loading={chart.busy === `reach:${waypoint.id}`}
// DEFERRED:             testID="chart-mark-waypoint"
// DEFERRED:             accessibilityLabel={CHART_COPY.waypoint.markComplete}
// DEFERRED:             style={styles.primary}
// DEFERRED:           >
// DEFERRED:             {CHART_COPY.waypoint.markComplete}
// DEFERRED:           </V2Button>
// DEFERRED:         ) : null}
// DEFERRED:       </ChartCreamPanel>
// DEFERRED: 
// DEFERRED:       <V2SheetModal visible={confirmOpen} onClose={() => setConfirmOpen(false)} reduceMotion={reducedMotion} testID="chart-reach-confirm">
// DEFERRED:         <View style={styles.sheet}>
// DEFERRED:           <Text accessibilityRole="header" style={styles.sheetTitle}>
// DEFERRED:             {waypoint.isDestination ? `${CHART_COPY.labels.destinationReached.charAt(0)}${CHART_COPY.labels.destinationReached.slice(1).toLowerCase()}?` : CHART_COPY.waypoint.confirmTitle}
// DEFERRED:           </Text>
// DEFERRED:           <Text style={styles.sheetBody}>{waypoint.isDestination ? view.destination : CHART_COPY.waypoint.confirmBody}</Text>
// DEFERRED:           <V2Button size="large" onPress={() => void reach()} testID="chart-reach-yes">{CHART_COPY.waypoint.confirmCta}</V2Button>
// DEFERRED:           <V2Button variant="tertiary" onPress={() => setConfirmOpen(false)}>{CHART_COPY.waypoint.notYet}</V2Button>
// DEFERRED:         </View>
// DEFERRED:       </V2SheetModal>
// DEFERRED:     </View>
// DEFERRED:   );
// DEFERRED: }
// DEFERRED: 
// DEFERRED: function MoveRow({ move, isOneMove, busy, canPromote, onComplete, onPromote, onRemove }: {
// DEFERRED:   move: MoveSummary;
// DEFERRED:   isOneMove: boolean;
// DEFERRED:   busy: boolean;
// DEFERRED:   canPromote: boolean;
// DEFERRED:   onComplete: () => void;
// DEFERRED:   onPromote: () => void;
// DEFERRED:   onRemove: () => void;
// DEFERRED: }) {
// DEFERRED:   const done = move.status === 'COMPLETED';
// DEFERRED:   return (
// DEFERRED:     <View style={styles.moveRow}>
// DEFERRED:       <Pressable
// DEFERRED:         accessibilityRole="checkbox"
// DEFERRED:         accessibilityState={{ checked: done, disabled: done || busy, busy }}
// DEFERRED:         accessibilityLabel={`${isOneMove ? 'One Move: ' : ''}${move.title}`}
// DEFERRED:         disabled={done || busy}
// DEFERRED:         onPress={onComplete}
// DEFERRED:         hitSlop={8}
// DEFERRED:         style={[styles.checkbox, done && styles.checkboxDone]}
// DEFERRED:       >
// DEFERRED:         {done ? <Check size={13} color={colors.text.inverse} strokeWidth={3} /> : null}
// DEFERRED:       </Pressable>
// DEFERRED:       <Text style={[styles.moveText, done && styles.moveDone]}>{move.title}</Text>
// DEFERRED:       {isOneMove ? <Star size={14} color={colors.semantic.warning} fill={colors.semantic.warning} accessibilityLabel="One Move" /> : null}
// DEFERRED:       {canPromote ? (
// DEFERRED:         <Pressable accessibilityRole="button" accessibilityLabel={`Make "${move.title}" your One Move`} hitSlop={8} onPress={onPromote}>
// DEFERRED:           <Star size={14} color={colors.text.tertiary} />
// DEFERRED:         </Pressable>
// DEFERRED:       ) : null}
// DEFERRED:       {!done ? (
// DEFERRED:         <Pressable accessibilityRole="button" accessibilityLabel={`Remove move: ${move.title}`} hitSlop={8} onPress={onRemove}>
// DEFERRED:           <X size={14} color={colors.text.tertiary} />
// DEFERRED:         </Pressable>
// DEFERRED:       ) : null}
// DEFERRED:     </View>
// DEFERRED:   );
// DEFERRED: }
// DEFERRED: 
// DEFERRED: const styles = StyleSheet.create({
// DEFERRED:   flex: { flex: 1 },
// DEFERRED:   row: { flexDirection: 'row', gap: spacing[3] },
// DEFERRED:   header: { paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[6], gap: spacing[2] },
// DEFERRED:   headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
// DEFERRED:   back: { minHeight: 44, justifyContent: 'center' },
// DEFERRED:   backText: { ...typography.labelMD, color: colors.ink.text.primary },
// DEFERRED:   editButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
// DEFERRED:   position: { ...typography.labelMD, color: colors.ink.text.secondary },
// DEFERRED:   title: { ...typography.displayMedium, fontSize: 32, lineHeight: 36, color: colors.ink.text.primary },
// DEFERRED:   rationale: { ...typography.bodyLG, color: colors.ink.text.secondary },
// DEFERRED:   editBlock: { gap: spacing[3] },
// DEFERRED:   editTitle: { ...typography.headingLG, color: colors.ink.text.primary, borderBottomWidth: 1, borderBottomColor: colors.ink.hairlineStrong, paddingVertical: spacing[2] },
// DEFERRED:   editRationale: { ...typography.bodyMD, color: colors.ink.text.primary, borderWidth: 1, borderColor: colors.ink.hairlineStrong, borderRadius: radii.md, padding: spacing[3], minHeight: 72, textAlignVertical: 'top' },
// DEFERRED:   remove: { minHeight: 44, justifyContent: 'center' },
// DEFERRED:   removeText: { ...typography.labelMD, color: '#E7A19C' },
// DEFERRED:   inlineAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginTop: spacing[1] },
// DEFERRED:   inlineActionText: { ...typography.labelMD, color: colors.ink.text.primary, textDecorationLine: 'underline' },
// DEFERRED:   progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[2] },
// DEFERRED:   progressInput: { flex: 1, ...typography.bodyLG, color: colors.ink.text.primary, borderWidth: 1, borderColor: colors.ink.hairlineStrong, borderRadius: radii.md, paddingHorizontal: spacing[3], minHeight: 44 },
// DEFERRED:   panel: { flexGrow: 1, gap: spacing[4] },
// DEFERRED:   section: { gap: spacing[2] },
// DEFERRED:   moveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 44 },
// DEFERRED:   checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: colors.text.secondary, alignItems: 'center', justifyContent: 'center' },
// DEFERRED:   checkboxDone: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
// DEFERRED:   checkboxEmpty: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border.strong },
// DEFERRED:   moveText: { flex: 1, ...typography.bodyMD, color: colors.text.primary },
// DEFERRED:   moveDone: { color: colors.text.secondary, textDecorationLine: 'line-through' },
// DEFERRED:   suggestion: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 44 },
// DEFERRED:   suggestionAccept: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 44 },
// DEFERRED:   suggestButton: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 44, paddingHorizontal: spacing[3], borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, alignSelf: 'flex-start' },
// DEFERRED:   suggestText: { ...typography.labelMD, color: colors.text.primary },
// DEFERRED:   hint: { ...typography.bodySM, color: colors.text.secondary },
// DEFERRED:   addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderWidth: 1, borderColor: colors.border.default, borderRadius: radii.md, paddingHorizontal: spacing[3], backgroundColor: colors.surface, marginTop: spacing[2] },
// DEFERRED:   addInput: { flex: 1, ...typography.bodyMD, color: colors.text.primary, minHeight: 46 },
// DEFERRED:   error: { ...typography.bodySM, color: colors.semantic.error },
// DEFERRED:   primary: { marginTop: 'auto' },
// DEFERRED:   sheet: { paddingHorizontal: spacing[5], paddingBottom: spacing[5], gap: spacing[3] },
// DEFERRED:   sheetTitle: { ...typography.headingLG, color: colors.text.primary },
// DEFERRED:   sheetBody: { ...typography.bodyMD, color: colors.text.secondary },
// DEFERRED: });
