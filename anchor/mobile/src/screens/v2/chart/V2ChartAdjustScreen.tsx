import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { ArrivalScope, ContentSwap, Reveal } from '@/components/v2/motion';
import { V2ConfirmSheet } from '@/components/v2/primitives/V2ConfirmSheet';
import { ChartCourseReviewScreen, ChartDestinationCard } from '@/components/v2/chart/ChartCourseReviewScreen';
import { ChartAdjustPanel, type ChartAdjustRequest } from '@/components/v2/chart/ChartAdjustPanel';
import type { DraftWaypoint } from '@/components/v2/chart/ChartRouteEditor';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { trackChart, useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { chartV2Api, classifyChartError, freshKey, type ChartProposal } from '@/services/v2/chartV2Api';
import { askChartApi } from '@/services/v2/askChartApi';
import { liveWaypoints } from '@/adapters/v2/chart/chartV2Model';
import { routeWasRevised } from '@/components/v2/chart/chartRouteRevision';
import { useChartRouteRevisionStore } from '@/stores/v2/chartRouteRevisionStore';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import type { CourseDetail, WaypointSummary } from '@/types/chart';
import { CenteredMessage } from './V2ChartScreen';
import { useChartContext } from './chartScreenSupport';

type Params = {
  anchorId: string;
  /** Open straight on a route Ask Chart prepared, ready to review. Nothing changes until the person applies it. */
  proposalId?: string;
  /** The Ask Chart message that proposed it, so it can be marked applied once the server has saved the route. */
  askMessageId?: string;
};

function fromWaypoint(waypoint: WaypointSummary): DraftWaypoint {
  const reached = Boolean(waypoint.reachedAt) || waypoint.state === 'REACHED' || waypoint.state === 'SKIPPED';
  return {
    key: waypoint.id,
    id: waypoint.id,
    title: waypoint.title,
    rationale: waypoint.description,
    kind: waypoint.kind ?? 'MILESTONE',
    progressMode: waypoint.progressMode,
    requirements: waypoint.requirements, completionCriteria: waypoint.completionCriteria,
    metricLabel: waypoint.metric?.label ?? null,
    metricTarget: waypoint.metric?.target ?? null,
    metricBaseline: waypoint.metric?.baseline ?? null,
    locked: reached,
  };
}

/** The live route as an editable draft: reached waypoints first, locked. */
export function draftFromCourse(course: CourseDetail): DraftWaypoint[] {
  return liveWaypoints(course).map(fromWaypoint);
}

/**
 * Revised route = locked history + the proposal's waypoints ahead. A proposed
 * waypoint that keeps an existing title keeps that waypoint's id, so its Moves
 * and progress stay attached.
 */
export function draftFromProposal(course: CourseDetail, proposal: ChartProposal): DraftWaypoint[] {
  const history = liveWaypoints(course).filter((waypoint) => waypoint.reachedAt || waypoint.state === 'REACHED' || waypoint.state === 'SKIPPED');
  const ahead = liveWaypoints(course).filter((waypoint) => !history.includes(waypoint));
  const byTitle = new Map(ahead.map((waypoint) => [waypoint.title.trim().toLowerCase(), waypoint.id]));
  const historyTitles = new Set(history.map((waypoint) => waypoint.title.trim().toLowerCase()));
  const proposed: DraftWaypoint[] = proposal.waypoints
    .filter((waypoint) => !historyTitles.has(waypoint.title.trim().toLowerCase()))
    .map((waypoint) => {
      let existingId = byTitle.get(waypoint.title.trim().toLowerCase()) ?? null;
      const existing = ahead.find(w => w.id === existingId);
      const mergedRequirements = (waypoint.requirements ?? []).map(r => existing?.requirements?.find(old => old.title.trim().toLowerCase() === r.title.trim().toLowerCase()) ?? r);
      if (existing?.metric?.current != null && (existing.metric.target !== waypoint.metricTarget || existing.metric.baseline !== waypoint.metricBaseline || existing.metric.label !== waypoint.metricLabel)) existingId = null;
      if (existing?.requirements?.some(r => r.completed && !mergedRequirements.some(next => next.id === r.id && next.completed))) existingId = null;
      if (existingId) byTitle.delete(waypoint.title.trim().toLowerCase());
      const sameAsBefore = existing ? existing.description === waypoint.rationale && (existing.kind ?? 'MILESTONE') === waypoint.kind : false;
      return {
        change: existingId ? (sameAsBefore ? undefined : 'changed') : 'added',
        key: existingId ?? waypoint.clientKey,
        id: existingId,
        title: waypoint.title,
        rationale: waypoint.rationale,
        kind: waypoint.kind,
        progressMode: waypoint.progressMode,
    requirements: mergedRequirements, completionCriteria: waypoint.completionCriteria,
        metricLabel: waypoint.metricLabel,
        metricTarget: waypoint.metricTarget,
        metricBaseline: waypoint.metricBaseline,
        suggestedMoves: (waypoint.moves ?? []).map((move) => ({ title: move.title, rationale: move.rationale })),
      };
    });
  const keptIds = new Set(proposed.map((waypoint) => waypoint.id).filter(Boolean));
  // Dropped waypoints stay in the list, struck through, until the person confirms the route.
  const removed: DraftWaypoint[] = ahead
    .filter((waypoint) => !keptIds.has(waypoint.id))
    .map((waypoint) => ({ ...fromWaypoint(waypoint), key: `removed-${waypoint.id}`, locked: false, change: 'removed' as const }));
  return [...history.map(fromWaypoint), ...proposed, ...removed];
}

/** Titles of waypoints with progress that this draft drops, for the rewrite confirmation. */
export function affectedWaypointTitles(course: CourseDetail, draft: DraftWaypoint[]): string[] {
  const kept = new Set(draft.filter((waypoint) => waypoint.change !== 'removed').map((waypoint) => waypoint.id).filter(Boolean));
  return liveWaypoints(course)
    .filter((waypoint) => !waypoint.reachedAt && waypoint.state !== 'REACHED' && waypoint.state !== 'SKIPPED' && !kept.has(waypoint.id))
    .filter((waypoint) => waypoint.id === course.currentWaypointId || waypoint.metric?.current != null || waypoint.requirements?.some((r) => r.completed) || course.moves?.some((move) => move.waypointId === waypoint.id && move.status === 'COMPLETED'))
    .map((waypoint) => waypoint.title);
}

export function V2ChartAdjustScreen() {
  const route = useRoute<RouteProp<Record<string, Params>, string>>();
  const navigation = useNavigation<any>();
  const anchorId = route.params?.anchorId ?? '';
  const proposalParam = route.params?.proposalId;
  const askMessageId = route.params?.askMessageId;
  const insets = useSafeAreaInsets();
  const reducedMotion = useV2ReduceMotion();
  const chart = useAnchorChart(anchorId);
  const context = useChartContext(anchorId, chart.data);
  const course = chart.data?.chart ?? null;
  const [phase, setPhase] = useState<'ask' | 'review'>('ask');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftWaypoint[]>([]);
  const [proposal, setProposal] = useState<ChartProposal | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [confirmRewrite, setConfirmRewrite] = useState(false);
  const [affectedTitles, setAffectedTitles] = useState<string[]>([]);
  const [oneMove, setOneMove] = useState('');
  const applyKey = useRef(freshKey(`chart-apply:${anchorId}`));
  // A route Ask Chart prepared opens straight on the review.
  const [loadingProposal, setLoadingProposal] = useState(Boolean(proposalParam));
  const proposalLoaded = useRef(false);

  const categoryColor = getCategoryColor(context.identity?.category ?? 'custom');

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('V2Chart', { anchorId }));

  const editedAhead = useMemo(() => draft.filter((waypoint) => !waypoint.locked && waypoint.change !== 'removed' && waypoint.title.trim()), [draft]);

  // The heading and panel are staged in once, when the route first appears. Asking and reviewing then swap in place.
  const ready = Boolean(course && (course.status === 'ACTIVE' || (course.status === 'COMPLETED' && course.routeScope === 'NEXT_STRETCH')));
  const arrived = useRef(false);
  const animateArrival = !arrived.current;
  useEffect(() => {
    if (ready) arrived.current = true;
  }, [ready]);

  useEffect(() => {
    if (!proposalParam || !course || proposalLoaded.current) return;
    proposalLoaded.current = true;
    chartV2Api
      .getProposal(course.id, proposalParam)
      .then((loaded) => {
        setProposal(loaded);
        setOneMove(loaded.suggestedOneMove?.title ?? '');
        setDraft(draftFromProposal(course, loaded));
        setReason('ASK_CHART');
        setPhase('review');
      })
      .catch(() => setError(CHART_COPY.errors.adjust))
      .finally(() => setLoadingProposal(false));
  }, [course, proposalParam]);

  if (!course || (course.status !== 'ACTIVE' && !(course.status === 'COMPLETED' && course.routeScope === 'NEXT_STRETCH'))) {
    return (
      <View testID="v2-chart-adjust-missing" style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" animated />
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={12} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Adjust Route</Text>
          <View style={styles.headerSpacer} />
        </View>
        <CenteredMessage title={chart.loading ? '' : CHART_COPY.errors.load} />
      </View>
    );
  }

  // A route Ask Chart prepared is being fetched: show the quiet screen, not the question it replaces.
  if (loadingProposal) {
    return (
      <View testID="v2-chart-adjust-loading" style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" animated />
      </View>
    );
  }

  const ask = async ({ reason: chosen, detail }: ChartAdjustRequest) => {
    setLoading(true);
    setError(null);
    trackChart('chart_adjustment_requested', {
      courseId: course.id,
      reason: chosen,
      stage: 'active',
      hasDetail: Boolean(detail?.trim()),
    });
    try {
      const response = await chartV2Api.adjust(anchorId, {
        idempotencyKey: freshKey(`chart-adjust:${course.id}`),
        reason: chosen,
        detail,
        courseId: course.id,
      });
      if (response.status === 'proposal') {
        setProposal(response.proposal);
        setOneMove(response.proposal.suggestedOneMove?.title ?? '');
        setDraft(draftFromProposal(course, response.proposal));
        setReason(chosen);
        if (response.proposal.generation.fallbackUsed) trackChart('chart_fallback_used', { stage: 'adjust' });
        setPhase('review');
      }
    } catch (caught) {
      const classified = classifyChartError(caught);
      setError(classified.kind === 'offline' ? CHART_COPY.errors.offline : CHART_COPY.errors.adjust);
    } finally {
      setLoading(false);
    }
  };

  const editDirectly = () => {
    setProposal(null);
    setOneMove('');
    setReason('MANUAL');
    setDraft(draftFromCourse(course));
    setPhase('review');
  };

  const handleArchive = () => {
    Alert.alert(CHART_COPY.archive.confirmTitle, CHART_COPY.archive.confirmBody, [
      { text: CHART_COPY.archive.cancel, style: 'cancel' },
      {
        text: CHART_COPY.archive.confirmCta,
        style: 'destructive',
        onPress: () => {
          setLoading(true);
          void chart.archiveChart().then((ok) => {
            setLoading(false);
            if (ok) back();
            else setError(CHART_COPY.archive.error);
          });
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(CHART_COPY.delete.confirmTitle, CHART_COPY.delete.confirmBody, [
      { text: CHART_COPY.delete.cancel, style: 'cancel' },
      {
        text: CHART_COPY.delete.confirmCta,
        style: 'destructive',
        onPress: () => {
          setLoading(true);
          void chart.deleteChart().then((ok) => {
            setLoading(false);
            if (ok) back();
            else setError(CHART_COPY.delete.error);
          });
        },
      },
    ]);
  };

  const apply = async (confirm: boolean) => {
    if (editedAhead.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const updated = await chartV2Api.applyRoute(course.id, {
        expectedCourseVersion: proposal?.baseCourseVersion ?? course.version,
        routeScope: proposal?.routeScope,
        destinationText: reason === 'CHANGE_DESTINATION' ? proposal?.destination : undefined,
        oneMove: proposal?.suggestedOneMove ? { ...proposal.suggestedOneMove, title: oneMove.trim() || proposal.suggestedOneMove.title } : undefined,
        idempotencyKey: applyKey.current,
        waypoints: editedAhead.map((waypoint) => ({
          id: waypoint.id ?? null,
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
        proposalId: proposal?.proposalId ?? null,
        adjustmentReason: reason,
        confirmRewrite: confirm,
      });
      // One quiet "route revised" signal for the Chart, only for a revision that was saved AND changed the route (never a
      // cancel, a failure or a no-op apply). It goes out before the new Chart is published, so the Chart holds the revised
      // markers back until it plays the scene.
      if (routeWasRevised(course, updated)) useChartRouteRevisionStore.getState().signal(anchorId, updated.id);
      const revised = routeWasRevised(course, updated);
      chart.commitChart(updated);
      trackChart('chart_route_adjusted', { reason: reason ?? 'MANUAL', stage: 'active', waypointCount: editedAhead.length });
      setConfirmRewrite(false);
      if (askMessageId) void askChartApi.routeApplied(course.id, askMessageId).catch(() => undefined);
      if (revised) {
        // The route is saved: confirm it. (A no-op apply changed nothing, so it simply returns.)
        navigation.replace('V2ChartRouteUpdated', {
          anchorId,
          change: { kind: 'ROUTE_REVISED', aheadCount: editedAhead.length, firstTitle: editedAhead[0]?.title.trim() ?? null },
          source: askMessageId ? 'ask' : 'adjust',
        });
      } else {
        back();
      }
    } catch (caught) {
      const classified = classifyChartError(caught);
      if (classified.kind === 'confirmation_required') {
        // Name the waypoint with progress that changes: the server's list first, the draft as a fallback.
        const fromServer = (classified.details as { affectedTitles?: unknown } | undefined)?.affectedTitles;
        setAffectedTitles(Array.isArray(fromServer) && fromServer.length ? (fromServer as string[]) : affectedWaypointTitles(course, draft));
        setConfirmRewrite(true);
      } else if (classified.kind === 'conflict') {
        applyKey.current = freshKey(`chart-apply:${anchorId}`);
        await chart.refresh();
        setError(CHART_COPY.errors.action);
        setPhase('ask');
      } else {
        setError(classified.kind === 'offline' ? CHART_COPY.errors.offline : CHART_COPY.errors.action);
      }
    } finally {
      setApplying(false);
    }
  };

  const reviewing = phase === 'review';
  const guidance = [
    proposal?.guidance,
    reason === 'CHANGE_DESTINATION' && proposal ? `Proposed destination: ${proposal.destination}` : null,
  ].filter(Boolean).join(' ') || null;

  return (
    <View testID="v2-chart-adjust" style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" animated />

      <View style={styles.header}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={reviewing ? () => setPhase('ask') : back}
            hitSlop={12}
            style={styles.backButton}
            testID="chart-adjust-back"
          >
            <ChevronLeft size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Adjust Route</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {reviewing ? (
        // The same screen as the first route, in edit mode. Its footer (Keep route / Use this route) is its own layout box.
        <ChartCourseReviewScreen
          mode="edit"
          testID="chart-adjust-review"
          destination={course.destinationText ?? ''}
          waypoints={draft}
          oneMove={oneMove}
          onOneMoveChange={setOneMove}
          onWaypointsChange={setDraft}
          guidance={guidance}
          saveError={error}
          saving={applying}
          canConfirm={editedAhead.length > 0}
          onAdjust={back}
          onConfirm={() => void apply(false)}
          topInset={0}
          reducedMotion={reducedMotion}
        />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[6] }]}
            showsVerticalScrollIndicator={false}
          >
            <ContentSwap contentKey={phase}>
              <ArrivalScope animate={animateArrival}>
                <Reveal order={0}>
                  <View style={styles.hero}>
                    <ChartDestinationCard destination={course.destinationText ?? ''} compact />
                    <Text accessibilityRole="header" style={styles.displayHeading}>
                      What should we change?
                    </Text>
                    <Text style={styles.support}>Tell Anchor what feels too difficult, too easy, or missing. Use your own words.</Text>
                  </View>
                </Reveal>

                <Reveal order={1}>
                  <View style={styles.panelContainer}>
                    <ChartAdjustPanel
                      onSubmit={(request) => void ask(request)}
                      loading={loading}
                      error={error}
                      protectedNote
                      categoryColor={categoryColor}
                      testID="chart-adjust-active"
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Edit the route yourself"
                      onPress={editDirectly}
                      style={styles.manual}
                      testID="chart-adjust-manual"
                    >
                      <Text style={styles.manualText}>Edit the route yourself</Text>
                    </Pressable>
                    <View style={styles.dangerZone}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Archive this route"
                        onPress={handleArchive}
                        style={styles.secondaryAction}
                        testID="chart-adjust-archive"
                      >
                        <Text style={styles.secondaryActionText}>Archive this route</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Delete this route"
                        onPress={handleDelete}
                        style={styles.secondaryAction}
                        testID="chart-adjust-delete"
                      >
                        <Text style={[styles.secondaryActionText, styles.destructiveText]}>Delete this route</Text>
                      </Pressable>
                    </View>
                  </View>
                </Reveal>
              </ArrivalScope>
            </ContentSwap>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* A modal bottom sheet in its own layer: solid surface, dimmed scrim, stacked buttons. Scrim tap and swipe down keep the route. */}
      <V2ConfirmSheet
        visible={confirmRewrite}
        onClose={() => setConfirmRewrite(false)}
        title={CHART_COPY.adjust.rewriteTitle}
        message={CHART_COPY.adjust.rewriteBody(affectedTitles)}
        confirmLabel={CHART_COPY.adjust.rewriteConfirm}
        cancelLabel={CHART_COPY.adjust.keep}
        loading={applying}
        onConfirm={() => void apply(true)}
        testID="chart-rewrite-confirm"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
    backgroundColor: colors.canvas,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  backButton: {
    padding: spacing[1],
  },
  headerTitle: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 24,
    lineHeight: 28,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 32,
  },
  metaContainer: {
    marginTop: spacing[1],
    marginBottom: spacing[3],
    gap: 4,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryText: {
    ...typography.labelSM,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  headerDestination: {
    ...typography.bodySM,
    color: colors.text.secondary,
    lineHeight: 19,
  },
  mapStripContainer: {
    height: 72,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.border.subtle,
  },
  mapStrip: {
    width: '100%',
    height: '100%',
  },
  content: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  hero: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  displayHeading: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 24,
    lineHeight: 28,
    color: colors.text.primary,
  },
  support: {
    ...typography.bodyMD,
    color: colors.text.secondary,
  },
  panelContainer: {
    gap: spacing[4],
  },
  manual: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  manualText: {
    ...typography.labelMD,
    color: colors.text.secondary,
    textDecorationLine: 'underline',
  },
  dangerZone: {
    marginTop: spacing[6],
    paddingTop: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
    alignItems: 'center',
    gap: spacing[2],
  },
  secondaryAction: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionText: {
    ...typography.labelMD,
    color: colors.text.secondary,
  },
  destructiveText: {
    color: colors.semantic.error,
  },
  note: {
    ...typography.bodySM,
    color: colors.text.secondary,
    marginTop: spacing[3],
  },
  error: {
    ...typography.bodySM,
    color: colors.semantic.error,
    marginTop: spacing[2],
  },
  reviewCtaContainer: {
    paddingTop: spacing[4],
  },
  sheet: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
    gap: spacing[3],
  },
  sheetTitle: {
    ...typography.headingLG,
    color: colors.text.primary,
  },
  sheetBody: {
    ...typography.bodyMD,
    color: colors.text.secondary,
  },
});
