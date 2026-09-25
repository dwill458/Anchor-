import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { ArrowRight, Check, ChevronRight, Flag, MoreHorizontal, WifiOff } from 'lucide-react-native';
import { V2SheetModal } from '@/components/v2/primitives/V2SheetModal';
import { VisionHeaderRow, VisionIdentity } from '@/components/v2/vision/VisionChrome';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import type { ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import { ChartEyebrow, ChartInkButton, ChartInkCard, ChartInkScreen, type ChartIdentity } from './ChartChrome';
import { ChartLandscape, type ChartAnchorArt, type ChartMarker } from './ChartLandscape';
import { CHART_WINDOWS } from './chartRouteGeometry';
import { CHART_EASING, CHART_PROGRESS_TIMING as PT, CHART_TRANSITION_TIMING as TT, chartDelay, chartTiming } from './chartMotion';

export type ChartVisionPreview = { imageUrl: string | null; description: string | null; title: string | null };

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
  onOpenWaypoint: (waypointId: string) => void;
  onCompleteMove: (moveId: string) => Promise<boolean>;
  onOpenVision: () => void;
  onOpenLog: () => void;
  onAdjust: () => void;
  actionError: string | null;
  /**
   * How the screen was reached. 'reveal' continues straight from the creation
   * reveal (the map is already in place, so only the content arrives); 'open'
   * is an ordinary visit (the route settles once, then everything is still).
   */
  entrance?: 'reveal' | 'open';
  testID?: string;
};

/** Content cards arrive in order with a restrained stagger. */
const ENTRY_CARDS = 4;
const ENTRY_TOTAL = TT.cardIn + TT.cardStagger * (ENTRY_CARDS - 1);

function EntryCard({ index, entry, children }: { index: number; entry: SharedValue<number>; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const local = Math.max(0, Math.min(1, (entry.value * ENTRY_TOTAL - index * TT.cardStagger) / TT.cardIn));
    return { opacity: local, transform: [{ translateY: (1 - local) * 10 }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Travelled fraction: the Anchor sits at the last reached waypoint (0 = START). */
export function travelledFraction(view: Pick<ChartViewModel, 'reachedCount' | 'total' | 'isFinished'>): number {
  if (view.total === 0) return 0;
  if (view.isFinished) return 1;
  return Math.min(1, view.reachedCount / view.total);
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
  onCompleteMove,
  onOpenVision,
  onOpenLog,
  onAdjust,
  actionError,
  entrance = 'open',
  testID,
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const categoryColor = getCategoryColor(identity.category);
  const target = travelledFraction(view);
  // An ordinary visit settles the lit route from START; everything else starts where it is.
  const settleRoute = entrance === 'open' && !celebration && !reducedMotion && target > 0;
  const travelled = useSharedValue(celebration ? celebration.fromFraction : settleRoute ? 0 : target);
  const entry = useSharedValue(reducedMotion ? 1 : 0);
  const currentPulse = useSharedValue(0);
  const stretchReveal = useSharedValue(reducedMotion || !celebration ? 1 : 0);
  const engrave = useSharedValue(reducedMotion ? 1 : 0);
  const [engraveId, setEngraveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(insets.top + 116);
  const [checkingMove, setCheckingMove] = useState<string | null>(null);
  const [showStillRight, setShowStillRight] = useState(false);
  const bannerOpacity = useSharedValue(0);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Entry: the map is already present; the route settles, the current waypoint gets one
  // quiet ripple, and the content arrives in order. Then nothing moves until something changes.
  useEffect(() => {
    if (reducedMotion) return undefined;
    const settleMs = settleRoute ? PT.entryRoute : 0;
    if (settleRoute) {
      travelled.value = chartTiming(target, { duration: PT.entryRoute, easing: CHART_EASING.draw });
    }
    entry.value = chartDelay(entrance === 'reveal' ? 120 : 60, chartTiming(1, { duration: ENTRY_TOTAL, easing: CHART_EASING.settle }));
    if (!celebration) {
      currentPulse.value = chartDelay(settleMs + 240, chartTiming(1, { duration: 1100, easing: CHART_EASING.settle }));
    }
    return () => {
      [entry, currentPulse].forEach((value) => cancelAnimation(value));
    };
    // Entry runs once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Waypoint reached: the Anchor travels the stretch it just completed, the waypoint engraves,
  // the route behind it is established, and the next stretch draws in with the emphasis.
  const settledOnce = useRef(false);
  useEffect(() => {
    if (!celebration) {
      // The first pass belongs to the entry settle above; later target changes ease in place.
      if (settleRoute && !settledOnce.current) {
        settledOnce.current = true;
        return undefined;
      }
      travelled.value = reducedMotion ? target : chartTiming(target, { duration: 400, easing: CHART_EASING.settle });
      return undefined;
    }
    const reachedId = view.waypoints[Math.max(0, view.reachedCount - 1)]?.id ?? null;
    setEngraveId(reachedId);
    if (reducedMotion) {
      travelled.value = target;
      engrave.value = 1;
      stretchReveal.value = 1;
      bannerOpacity.value = chartTiming(1, { duration: 200 });
    } else {
      const arrive = PT.travelDelay + PT.travel;
      travelled.value = celebration.fromFraction;
      engrave.value = 0;
      stretchReveal.value = 0;
      travelled.value = chartDelay(PT.travelDelay, chartTiming(target, { duration: PT.travel, easing: CHART_EASING.deliberate }));
      engrave.value = chartDelay(arrive - 160, chartTiming(1, { duration: PT.engrave, easing: CHART_EASING.settle }));
      stretchReveal.value = chartDelay(arrive + PT.engrave * 0.5, chartTiming(1, { duration: PT.nextStretch, easing: CHART_EASING.draw }));
      currentPulse.value = 0;
      currentPulse.value = chartDelay(arrive + PT.engrave * 0.5 + PT.nextStretch * 0.8, chartTiming(1, { duration: 1100, easing: CHART_EASING.settle }));
      bannerOpacity.value = chartTiming(1, { duration: PT.banner });
    }
    celebrationTimer.current = setTimeout(() => {
      bannerOpacity.value = chartTiming(0, { duration: 300 });
      // Route evolution: a quiet check-in at a meaningful transition, never a nag.
      if (celebration.nextTitle) setShowStillRight(true);
      onCelebrationDone();
    }, reducedMotion ? PT.bannerHoldReduced : PT.bannerHold);
    return () => {
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebration, target]);

  const bannerStyle = useAnimatedStyle(() => ({ opacity: bannerOpacity.value }));

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
  const oneMove = view.oneMove;
  // The stretch being travelled now: from the Anchor's position to the current waypoint.
  const stretch = useMemo(
    () =>
      view.isFinished || view.total === 0
        ? null
        : { from: view.reachedCount / view.total, to: Math.min(1, (view.reachedCount + 1) / view.total) },
    [view.isFinished, view.reachedCount, view.total]
  );
  const mapSummary = current
    ? `Chart map. Waypoint ${current.number} of ${view.total} is current: ${current.title}. Destination: ${view.destination}.`
    : `Chart map. Destination: ${view.destination}.`;

  const completeOneMove = async () => {
    if (!oneMove || checkingMove) return;
    setCheckingMove(oneMove.id);
    await onCompleteMove(oneMove.id);
    setCheckingMove(null);
  };

  return (
    <ChartInkScreen testID={testID ?? 'chart-active'}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing[8] }} showsVerticalScrollIndicator={false}>
        <View>
          <ChartLandscape
            width={width}
            category={identity.category}
            window={CHART_WINDOWS.hero}
            markers={markers}
            travelled={travelled}
            stretch={stretch}
            stretchReveal={stretchReveal}
            engraveId={engraveId}
            engrave={engrave}
            currentPulse={currentPulse}
            anchorArt={anchorArt}
            destinationImageUrl={vision?.imageUrl ?? null}
            destinationLabel={view.destination}
            scrimTop
            scrimBottom={colors.ink.base}
            onMarkerPress={onOpenWaypoint}
            onDestinationPress={vision ? onOpenVision : undefined}
            accessibilityLabel={mapSummary}
            style={{ marginTop: Math.max(0, headerHeight - 28) }}
            testID="chart-hero-map"
          />
          <View style={[styles.overlayHeader, { paddingTop: insets.top }]} onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
            <VisionHeaderRow
              title={CHART_COPY.title}
              onBack={onBack}
              tone="light"
              utility={
                <Pressable accessibilityRole="button" accessibilityLabel="Chart options" hitSlop={8} onPress={() => setMenuOpen(true)}>
                  <MoreHorizontal size={22} color={colors.ink.text.primary} />
                </Pressable>
              }
            />
            <View style={styles.identity}>
              <VisionIdentity intention={identity.intention} category={identity.category} art={identity.art} imageUrl={identity.imageUrl} tone="light" size={48} />
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Below the map, so the Anchor's travel along the route stays visible. */}
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
              <WifiOff size={14} color={colors.ink.text.secondary} />
              <Text style={styles.offlineText}>{CHART_COPY.active.offline}</Text>
            </View>
          ) : null}

          {current ? (
            <EntryCard index={0} entry={entry}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Current waypoint, ${current.number} of ${view.total}: ${current.title}${current.metric ? `, ${current.metric.display}` : ''}. Open waypoint.`}
                onPress={() => onOpenWaypoint(current.id)}
                testID="chart-current-waypoint"
              >
                <ChartInkCard>
                  <View style={styles.cardHeader}>
                    <ChartEyebrow color="#F2E6CB">{CHART_COPY.labels.currentWaypoint}</ChartEyebrow>
                    <Text style={styles.position}>{view.positionLabel}</Text>
                  </View>
                  <Text style={styles.waypointTitle}>{current.title}</Text>
                  {current.metric ? <MetricBar metric={current.metric} color={categoryColor} /> : null}
                  {!current.metric && current.rationale ? (
                    <Text style={styles.rationale} numberOfLines={2}>
                      {current.rationale}
                    </Text>
                  ) : null}
                </ChartInkCard>
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

          <EntryCard index={1} entry={entry}>
            <ChartInkCard testID="chart-one-move">
              <ChartEyebrow color="#F2E6CB">{CHART_COPY.labels.oneMove}</ChartEyebrow>
              {oneMove ? (
                <View style={styles.moveRow}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: checkingMove === oneMove.id, busy: busyKey === `move:${oneMove.id}` }}
                    accessibilityLabel={`Complete move: ${oneMove.title}`}
                    onPress={() => void completeOneMove()}
                    hitSlop={10}
                    style={[styles.checkbox, checkingMove === oneMove.id && styles.checkboxOn]}
                    testID="chart-one-move-check"
                  >
                    {checkingMove === oneMove.id ? <Check size={14} color={colors.ink.base} strokeWidth={3} /> : null}
                  </Pressable>
                  <Text style={styles.moveTitle}>{oneMove.title}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open waypoint moves"
                    onPress={() => current && onOpenWaypoint(current.id)}
                    hitSlop={8}
                    style={styles.arrowButton}
                  >
                    <ArrowRight size={16} color={colors.ink.text.primary} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={CHART_COPY.active.noMoveCta}
                  onPress={() => current && onOpenWaypoint(current.id)}
                  style={styles.moveEmpty}
                  testID="chart-one-move-empty"
                >
                  <Text style={styles.moveEmptyText}>{CHART_COPY.active.noMove}</Text>
                  <ChevronRight size={18} color={colors.ink.text.secondary} />
                </Pressable>
              )}
              {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
            </ChartInkCard>
          </EntryCard>

          <EntryCard index={2} entry={entry}>
            <ChartInkCard testID="chart-destination">
              <ChartEyebrow>{CHART_COPY.labels.yourDestination}</ChartEyebrow>
              <View style={styles.destinationRow}>
                {vision?.imageUrl ? (
                  <Image source={{ uri: vision.imageUrl }} style={styles.destinationThumb} accessibilityIgnoresInvertColors accessibilityLabel="Your Vision" />
                ) : (
                  <View style={[styles.destinationMark, { borderColor: categoryColor }]}>
                    <Flag size={18} color={categoryColor} />
                  </View>
                )}
                <View style={styles.flex}>
                  <Text style={styles.destinationTitle}>{view.destination}</Text>
                  {vision?.description ? (
                    <Text style={styles.destinationDescription} numberOfLines={2}>
                      {vision.description}
                    </Text>
                  ) : null}
                  {vision ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.active.viewVision} onPress={onOpenVision} style={styles.inlineLink} testID="chart-view-vision">
                      <Text style={styles.inlineLinkText}>{CHART_COPY.active.viewVision}</Text>
                      <ArrowRight size={14} color={colors.ink.text.primary} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </ChartInkCard>
          </EntryCard>

          <EntryCard index={3} entry={entry}>
            <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.active.courseLogCta} onPress={onOpenLog} testID="chart-course-log">
              <View style={styles.logRow}>
                <View style={styles.flex}>
                  <ChartEyebrow>{CHART_COPY.labels.courseLog}</ChartEyebrow>
                  <Text style={styles.logText}>
                    {view.reachedCount} of {view.total} waypoints · {view.completedMoveCount} move{view.completedMoveCount === 1 ? '' : 's'} completed
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.ink.text.secondary} />
              </View>
            </Pressable>
          </EntryCard>
        </View>
      </ScrollView>

      <V2SheetModal visible={menuOpen} onClose={() => setMenuOpen(false)} reduceMotion={reducedMotion} testID="chart-menu">
        <View style={styles.menu}>
          <MenuItem label={CHART_COPY.review.adjust} onPress={() => { setMenuOpen(false); onAdjust(); }} />
          <MenuItem label={CHART_COPY.active.courseLogCta} onPress={() => { setMenuOpen(false); onOpenLog(); }} />
          {vision ? <MenuItem label={CHART_COPY.active.viewVision} onPress={() => { setMenuOpen(false); onOpenVision(); }} /> : null}
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

export function MetricBar({
  metric,
  color,
  tone = 'ink',
}: {
  metric: NonNullable<ChartViewModel['waypoints'][number]['metric']>;
  color: string;
  tone?: 'ink' | 'cream';
}) {
  const fraction = metric.fraction ?? 0;
  const onInk = tone === 'ink';
  return (
    <View
      style={styles.metric}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${metric.display}${metric.label ? ` ${metric.label}` : ''}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
    >
      <Text style={[styles.metricText, { color: onInk ? colors.ink.text.primary : colors.text.primary }]}>{metric.display}</Text>
      <View style={styles.metricRow}>
        <View style={[styles.metricTrack, { backgroundColor: onInk ? colors.ink.hairlineStrong : colors.border.subtle }]}>
          <View style={[styles.metricFill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
        </View>
        {metric.percentLabel ? (
          <Text style={[styles.metricPercent, { color: onInk ? colors.ink.text.secondary : colors.text.secondary }]}>{metric.percentLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlayHeader: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: spacing[5] },
  identity: { paddingTop: spacing[2] },
  celebration: {
    padding: spacing[4],
    borderRadius: radii.lg,
    backgroundColor: 'rgba(14, 21, 28, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(242, 230, 203, 0.35)',
    gap: spacing[1],
  },
  celebrationTitle: { ...typography.headingLG, color: colors.ink.text.primary },
  celebrationNext: { marginTop: spacing[2], gap: 2 },
  celebrationNextTitle: { ...typography.bodyMD, color: colors.ink.text.primary },
  body: { paddingHorizontal: spacing[4], gap: spacing[3], marginTop: -spacing[2] },
  offline: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[1] },
  offlineText: { ...typography.bodySM, color: colors.ink.text.secondary },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  position: { ...typography.labelMD, color: colors.ink.text.secondary },
  waypointTitle: { ...typography.headingLG, color: colors.ink.text.primary, marginTop: spacing[2] },
  rationale: { ...typography.bodySM, color: colors.ink.text.secondary, marginTop: spacing[1] },
  cardTitle: { ...typography.headingSM, color: colors.ink.text.primary, marginBottom: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[3] },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[3] },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.ink.text.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#F2E6CB', borderColor: '#F2E6CB' },
  moveTitle: { flex: 1, ...typography.bodyLG, color: colors.ink.text.primary },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.ink.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveEmpty: { flexDirection: 'row', alignItems: 'center', marginTop: spacing[3], minHeight: 44 },
  moveEmptyText: { flex: 1, ...typography.bodyMD, color: colors.ink.text.secondary },
  error: { ...typography.bodySM, color: '#E7A19C', marginTop: spacing[2] },
  destinationRow: { flexDirection: 'row', gap: spacing[4], marginTop: spacing[3] },
  destinationThumb: { width: 86, height: 86, borderRadius: radii.md, borderWidth: 1, borderColor: 'rgba(242, 230, 203, 0.4)' },
  destinationMark: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  destinationTitle: { ...typography.headingSM, color: colors.ink.text.primary },
  destinationDescription: { ...typography.bodySM, color: colors.ink.text.secondary, marginTop: 4 },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[2], minHeight: 32 },
  inlineLinkText: { ...typography.labelMD, color: colors.ink.text.primary },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[2], paddingVertical: spacing[3], minHeight: 56 },
  logText: { ...typography.bodySM, color: colors.ink.text.secondary, marginTop: 4 },
  metric: { marginTop: spacing[3], gap: spacing[2] },
  metricText: { ...typography.bodyMD },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  metricTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  metricFill: { height: 6, borderRadius: 3 },
  metricPercent: { ...typography.labelMD, minWidth: 38, textAlign: 'right' },
  menu: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  menuItem: { minHeight: 52, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle },
  menuText: { ...typography.labelLG, color: colors.text.primary },
});
