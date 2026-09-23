import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { ChartEyebrow, ChartInkCard, ChartInkScreen, ChartTopBar } from '@/components/v2/chart/ChartChrome';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { formatJourneyDate } from '@/adapters/v2/chart/chartV2Model';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { chartApiClient } from '@/services/ChartApiClient';
import { courseLogEventCopy } from '@/screens/chart/courseLogPresentation';
import { colors, spacing, typography } from '@/theme/v2';
import type { CourseLogEntry } from '@/types/chart';
import { useChartContext } from './chartScreenSupport';

type Params = { anchorId: string };

/** Events that tell the story of the journey; bookkeeping events stay out. */
const STORY_EVENTS = new Set<CourseLogEntry['eventType']>([
  'COURSE_CREATED',
  'WAYPOINT_REACHED',
  'MOVE_COMPLETED',
  'ROUTE_ADJUSTED',
  'DESTINATION_CHANGED',
  'COURSE_COMPLETED',
  'REFLECTION_ADDED',
]);

export function V2ChartJourneyScreen() {
  const route = useRoute<RouteProp<Record<string, Params>, string>>();
  const navigation = useNavigation<any>();
  const anchorId = route.params?.anchorId ?? '';
  const insets = useSafeAreaInsets();
  const chart = useAnchorChart(anchorId);
  const context = useChartContext(anchorId, chart.data);
  const view = chart.view;
  const courseId = view?.courseId ?? null;
  const [log, setLog] = useState<CourseLogEntry[] | null>(null);
  const [logError, setLogError] = useState(false);

  useEffect(() => {
    if (!courseId) return undefined;
    const controller = new AbortController();
    setLogError(false);
    chartApiClient
      .getCourseLog(courseId, { limit: 100 }, controller.signal)
      .then((result) => setLog(result.data))
      .catch(() => {
        if (!controller.signal.aborted) setLogError(true);
      });
    return () => controller.abort();
  }, [courseId]);

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('V2Chart', { anchorId }));
  const story = (log ?? []).filter((entry) => STORY_EVENTS.has(entry.eventType));

  return (
    <ChartInkScreen testID="v2-chart-journey">
      <ChartTopBar title={CHART_COPY.labels.courseLog.charAt(0) + CHART_COPY.labels.courseLog.slice(1).toLowerCase()} onBack={back} identity={context.identity} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[6] }]}>
        {view ? (
          <ChartInkCard>
            <ChartEyebrow>{CHART_COPY.labels.yourDestination}</ChartEyebrow>
            <Text style={styles.destination}>{view.destination}</Text>
            <View style={styles.route}>
              {view.waypoints.map((waypoint) => (
                <View
                  key={waypoint.id}
                  style={styles.routeRow}
                  accessible
                  accessibilityLabel={`${waypoint.accessibilityLabel}${waypoint.reachedAt ? `, ${formatJourneyDate(waypoint.reachedAt)}` : ''}`}
                >
                  <View style={[styles.dot, waypoint.state === 'completed' && styles.dotDone, waypoint.state === 'current' && styles.dotCurrent]}>
                    {waypoint.state === 'completed' ? <Check size={10} color={colors.ink.base} strokeWidth={3} /> : null}
                  </View>
                  <Text style={[styles.routeTitle, waypoint.state === 'upcoming' && styles.routeAhead]} numberOfLines={2}>
                    {waypoint.title}
                  </Text>
                  {waypoint.reachedAt ? <Text style={styles.date}>{formatJourneyDate(waypoint.reachedAt)}</Text> : null}
                </View>
              ))}
            </View>
          </ChartInkCard>
        ) : null}

        <ChartEyebrow style={styles.logLabel}>{CHART_COPY.labels.courseLog}</ChartEyebrow>
        {!log && !logError ? <ActivityIndicator color={colors.ink.text.secondary} /> : null}
        {logError ? <Text style={styles.muted}>{CHART_COPY.errors.loadSupport}</Text> : null}
        {story.map((entry) => (
          <View key={entry.id} style={styles.logRow}>
            <Text style={styles.logText}>{courseLogEventCopy(entry)}</Text>
            <Text style={styles.date}>{formatJourneyDate(entry.occurredAt)}</Text>
          </View>
        ))}

        {chart.data?.history.length ? (
          <>
            <ChartEyebrow style={styles.logLabel}>EARLIER ROUTES</ChartEyebrow>
            {chart.data.history.map((summary) => (
              <View key={summary.id} style={styles.logRow}>
                <Text style={styles.logText}>{summary.destinationText}</Text>
                <Text style={styles.date}>
                  {summary.status === 'COMPLETED' ? `Reached ${formatJourneyDate(summary.completedAt) ?? ''}` : `${summary.reachedCount} of ${summary.waypointCount}`}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </ChartInkScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[3], gap: spacing[3] },
  destination: { ...typography.headingMD, color: colors.ink.text.primary, marginTop: spacing[2] },
  route: { marginTop: spacing[4], gap: spacing[3] },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: 'rgba(242, 230, 203, 0.5)', alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: '#F2E6CB', borderColor: '#F2E6CB' },
  dotCurrent: { borderColor: '#F2E6CB', borderWidth: 3 },
  routeTitle: { flex: 1, ...typography.bodyMD, color: colors.ink.text.primary },
  routeAhead: { color: colors.ink.text.secondary },
  date: { ...typography.caption, color: colors.ink.text.tertiary },
  logLabel: { marginTop: spacing[3], paddingHorizontal: spacing[1] },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink.hairline,
  },
  logText: { flex: 1, ...typography.bodyMD, color: colors.ink.text.primary },
  muted: { ...typography.bodySM, color: colors.ink.text.secondary },
});
