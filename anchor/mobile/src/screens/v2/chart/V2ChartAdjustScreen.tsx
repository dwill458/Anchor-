import React, { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { V2SheetModal } from '@/components/v2/primitives/V2SheetModal';
import { ChartAdjustPanel, type ChartAdjustRequest } from '@/components/v2/chart/ChartAdjustPanel';
import { ChartCreamPanel, ChartInkScreen, ChartTopBar } from '@/components/v2/chart/ChartChrome';
import { ChartRouteEditor, type DraftWaypoint } from '@/components/v2/chart/ChartRouteEditor';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { trackChart, useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { chartV2Api, classifyChartError, freshKey, type ChartProposal } from '@/services/v2/chartV2Api';
import { liveWaypoints } from '@/adapters/v2/chart/chartV2Model';
import { colors, spacing, typography } from '@/theme/v2';
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
  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('V2Chart', { anchorId }));

  const editedAhead = useMemo(() => draft.filter((waypoint) => !waypoint.locked && waypoint.title.trim()), [draft]);

  if (!course || course.status !== 'ACTIVE') {
    return (
      <ChartInkScreen testID="v2-chart-adjust-missing">
        <ChartTopBar title={CHART_COPY.adjust.headerTitle} onBack={back} />
        <CenteredMessage title={chart.loading ? '' : CHART_COPY.errors.load} />
      </ChartInkScreen>
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
          metricLabel: waypoint.metricLabel,
          metricTarget: waypoint.metricTarget,
          metricBaseline: waypoint.metricBaseline,
        })),
        proposalId: proposal?.proposalId ?? null,
        adjustmentReason: reason,
        confirmRewrite: confirm,
      });
      chart.commitChart(updated);
      trackChart('chart_route_adjusted', { reason: reason ?? 'MANUAL', stage: 'active', waypointCount: editedAhead.length });
      setConfirmRewrite(false);
      back();
    } catch (caught) {
      const classified = classifyChartError(caught);
      if (classified.kind === 'confirmation_required') {
        setConfirmRewrite(true);
      } else if (classified.kind === 'conflict') {
        // The route changed elsewhere; start again from the server's version.
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
    <ChartInkScreen testID="v2-chart-adjust">
      <ChartTopBar title={CHART_COPY.adjust.headerTitle} onBack={phase === 'review' ? () => setPhase('ask') : back} identity={context.identity} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.hero}>
          <Text accessibilityRole="header" style={styles.display}>
            {phase === 'ask' ? CHART_COPY.adjust.headline : CHART_COPY.adjust.review}
          </Text>
          <Text style={styles.support}>{phase === 'ask' ? CHART_COPY.adjust.support : CHART_COPY.adjust.reviewSupport}</Text>
        </View>
        <ChartCreamPanel style={styles.panel}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing[4] }} showsVerticalScrollIndicator={false}>
            {phase === 'ask' ? (
              <>
                <ChartAdjustPanel onSubmit={(request) => void ask(request)} loading={loading} error={error} protectedNote testID="chart-adjust-active" />
                <Pressable accessibilityRole="button" accessibilityLabel="Edit the route yourself" onPress={editDirectly} style={styles.manual} testID="chart-adjust-manual">
                  <Text style={styles.manualText}>Edit the route yourself</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ChartRouteEditor waypoints={draft} onChange={setDraft} testID="chart-adjust-editor" />
                <Text style={styles.note}>{CHART_COPY.adjust.protected}</Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </>
            )}
          </ScrollView>
          {phase === 'review' ? (
            <View style={{ paddingBottom: insets.bottom + spacing[3], paddingTop: spacing[3] }}>
              <V2Button
                size="large"
                onPress={() => void apply(false)}
                loading={applying}
                disabled={editedAhead.length === 0}
                iconRight={<ArrowRight size={18} color={colors.text.inverse} />}
                testID="chart-adjust-apply"
              >
                {CHART_COPY.adjust.apply}
              </V2Button>
            </View>
          ) : (
            <View style={{ height: insets.bottom }} />
          )}
        </ChartCreamPanel>
      </KeyboardAvoidingView>

      <V2SheetModal visible={confirmRewrite} onClose={() => setConfirmRewrite(false)} reduceMotion={reducedMotion} testID="chart-rewrite-confirm">
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
    </ChartInkScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { paddingHorizontal: spacing[5], paddingTop: spacing[3], gap: spacing[2] },
  display: { ...typography.displayMedium, fontSize: 34, lineHeight: 38, color: colors.ink.text.primary },
  support: { ...typography.bodyLG, color: colors.ink.text.secondary },
  panel: { flex: 1, marginTop: spacing[5] },
  manual: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: spacing[3] },
  manualText: { ...typography.labelMD, color: colors.text.secondary, textDecorationLine: 'underline' },
  note: { ...typography.bodySM, color: colors.text.secondary, marginTop: spacing[3] },
  error: { ...typography.bodySM, color: colors.semantic.error, marginTop: spacing[2] },
  sheet: { paddingHorizontal: spacing[5], paddingBottom: spacing[5], gap: spacing[3] },
  sheetTitle: { ...typography.headingLG, color: colors.text.primary },
  sheetBody: { ...typography.bodyMD, color: colors.text.secondary },
});
