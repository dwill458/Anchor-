import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
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
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { ArrivalScope, ContentSwap, Reveal } from '@/components/v2/motion';
import { V2SheetModal } from '@/components/v2/primitives/V2SheetModal';
import { ChartAdjustPanel, type ChartAdjustRequest } from '@/components/v2/chart/ChartAdjustPanel';
import { ChartRouteEditor, type DraftWaypoint } from '@/components/v2/chart/ChartRouteEditor';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { trackChart, useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { chartV2Api, classifyChartError, freshKey, type ChartProposal } from '@/services/v2/chartV2Api';
import { liveWaypoints } from '@/adapters/v2/chart/chartV2Model';
import { routeWasRevised } from '@/components/v2/chart/chartRouteRevision';
import { useChartRouteRevisionStore } from '@/stores/v2/chartRouteRevisionStore';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
const ETCHED_MAP_IMAGE = require('@/../assets/chart/chart-landscape-master.webp');
import type { CourseDetail, WaypointSummary } from '@/types/chart';
import { CenteredMessage } from './V2ChartScreen';
import { useChartContext } from './chartScreenSupport';

type Params = { anchorId: string };

function fromWaypoint(waypoint: WaypointSummary): DraftWaypoint {
  const reached = Boolean(waypoint.reachedAt) || waypoint.state === 'REACHED' || waypoint.state === 'SKIPPED';
  return {
    key: waypoint.id,
    id: waypoint.id,
    title: waypoint.title,
    rationale: waypoint.description,
    kind: waypoint.kind ?? 'MILESTONE',
    progressMode: waypoint.progressMode,
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
      const existingId = byTitle.get(waypoint.title.trim().toLowerCase()) ?? null;
      if (existingId) byTitle.delete(waypoint.title.trim().toLowerCase());
      return {
        key: existingId ?? waypoint.clientKey,
        id: existingId,
        title: waypoint.title,
        rationale: waypoint.rationale,
        kind: waypoint.kind,
        progressMode: waypoint.progressMode,
        metricLabel: waypoint.metricLabel,
        metricTarget: waypoint.metricTarget,
        metricBaseline: waypoint.metricBaseline,
      };
    });
  return [...history.map(fromWaypoint), ...proposed];
}

export function V2ChartAdjustScreen() {
  const route = useRoute<RouteProp<Record<string, Params>, string>>();
  const navigation = useNavigation<any>();
  const anchorId = route.params?.anchorId ?? '';
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
  const applyKey = useRef(freshKey(`chart-apply:${anchorId}`));

  const categoryColor = getCategoryColor(context.identity?.category ?? 'custom');

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('V2Chart', { anchorId }));

  const editedAhead = useMemo(() => draft.filter((waypoint) => !waypoint.locked && waypoint.title.trim()), [draft]);

  // The heading and panel are staged in once, when the route first appears. Asking and reviewing then swap in place.
  const ready = Boolean(course && course.status === 'ACTIVE');
  const arrived = useRef(false);
  const animateArrival = !arrived.current;
  useEffect(() => {
    if (ready) arrived.current = true;
  }, [ready]);

  if (!course || course.status !== 'ACTIVE') {
    return (
      <View testID="v2-chart-adjust-missing" style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} animated />
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

  const ask = async ({ reason: chosen, detail }: ChartAdjustRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await chartV2Api.adjust(anchorId, {
        idempotencyKey: freshKey(`chart-adjust:${course.id}`),
        reason: chosen,
        detail,
        courseId: course.id,
      });
      if (response.status === 'proposal') {
        setProposal(response.proposal);
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
        expectedCourseVersion: course.version,
        idempotencyKey: applyKey.current,
        waypoints: editedAhead.map((waypoint) => ({
          id: waypoint.id ?? null,
          title: waypoint.title.trim(),
          rationale: waypoint.rationale,
          kind: waypoint.kind,
          progressMode: waypoint.progressMode,
          metricLabel: waypoint.metricLabel,
          metricTarget: waypoint.metricTarget,
          metricBaseline: waypoint.metricBaseline,
        })),
        proposalId: proposal?.proposalId ?? null,
        adjustmentReason: reason,
        confirmRewrite: confirm,
      });
      // One quiet "route revised" signal for the Chart, only for a revision that was saved AND changed the route (never a
      // cancel, a failure or a no-op apply). It goes out before the new Chart is published, so the Chart holds the revised
      // markers back until it plays the scene.
      if (routeWasRevised(course, updated)) useChartRouteRevisionStore.getState().signal(anchorId, updated.id);
      chart.commitChart(updated);
      trackChart('chart_route_adjusted', { reason: reason ?? 'MANUAL', stage: 'active', waypointCount: editedAhead.length });
      setConfirmRewrite(false);
      back();
    } catch (caught) {
      const classified = classifyChartError(caught);
      if (classified.kind === 'confirmation_required') {
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

  return (
    <View testID="v2-chart-adjust" style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} animated />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={phase === 'review' ? () => setPhase('ask') : back}
            hitSlop={12}
            style={styles.backButton}
            testID="chart-adjust-back"
          >
            <ChevronLeft size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Adjust Route</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.metaContainer}>
          <View style={styles.categoryPill}>
            <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
            <Text style={[styles.categoryText, { color: categoryColor }]}>
              {context.identity?.category ? context.identity.category.toUpperCase() : 'DESIRE'}
            </Text>
          </View>
          {course.destinationText ? (
            <Text style={styles.headerDestination} numberOfLines={2}>
              {course.destinationText}
            </Text>
          ) : null}
        </View>

        {/* Map strip below header */}
        <View style={styles.mapStripContainer}>
          <Image source={ETCHED_MAP_IMAGE} style={styles.mapStrip} resizeMode="cover" />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[6] }]}
          showsVerticalScrollIndicator={false}
        >
          <ContentSwap contentKey={phase}>
            <ArrivalScope animate={animateArrival}>
              <Reveal order={0}>
                {/* Headline section */}
                <View style={styles.hero}>
                  <Text accessibilityRole="header" style={styles.displayHeading}>
                    {phase === 'ask' ? 'Where does the route need to change?' : CHART_COPY.adjust.review}
                  </Text>
                  <Text style={styles.support}>
                    {phase === 'ask' ? CHART_COPY.adjust.support : CHART_COPY.adjust.reviewSupport}
                  </Text>
                </View>
              </Reveal>

              <Reveal order={1}>
                {phase === 'ask' ? (
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
                ) : (
                  <View style={styles.panelContainer}>
                    <ChartRouteEditor waypoints={draft} onChange={setDraft} testID="chart-adjust-editor" />
                    <Text style={styles.note}>{CHART_COPY.adjust.protected}</Text>
                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    <View style={styles.reviewCtaContainer}>
                      <V2Button
                        size="large"
                        onPress={() => void apply(false)}
                        loading={applying}
                        disabled={editedAhead.length === 0}
                        style={editedAhead.length > 0 && categoryColor ? { backgroundColor: categoryColor } : undefined}
                        iconRight={<ArrowRight size={18} color={colors.text.inverse} />}
                        testID="chart-adjust-apply"
                      >
                        {CHART_COPY.adjust.apply}
                      </V2Button>
                    </View>
                  </View>
                )}
              </Reveal>
            </ArrivalScope>
          </ContentSwap>
        </ScrollView>
      </KeyboardAvoidingView>

      <V2SheetModal
        visible={confirmRewrite}
        onClose={() => setConfirmRewrite(false)}
        reduceMotion={reducedMotion}
        testID="chart-rewrite-confirm"
      >
        <View style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.sheetTitle}>
            {CHART_COPY.adjust.rewriteTitle}
          </Text>
          <Text style={styles.sheetBody}>{CHART_COPY.adjust.rewriteBody}</Text>
          <V2Button size="large" onPress={() => void apply(true)} loading={applying} testID="chart-rewrite-yes">
            {CHART_COPY.adjust.rewriteConfirm}
          </V2Button>
          <V2Button variant="tertiary" onPress={() => setConfirmRewrite(false)}>
            {CHART_COPY.adjust.keep}
          </V2Button>
        </View>
      </V2SheetModal>
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
