import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Anchor,
  ChartColumn,
  Check,
  ChevronLeft,
  Flag,
} from 'lucide-react-native';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { formatJourneyDate } from '@/adapters/v2/chart/chartV2Model';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { chartApiClient } from '@/services/ChartApiClient';
import { courseLogEventCopy } from '@/screens/chart/courseLogPresentation';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import { useSessionStore } from '@/stores/sessionStore';
import { chartArtFor } from '@/components/v2/chart/chartRouteGeometry';
import type { CourseLogEntry } from '@/types/chart';
import { useChartContext } from './chartScreenSupport';

type Params = { anchorId: string };

/** Events that tell the story of the course; bookkeeping events stay out. */
const STORY_EVENTS = new Set<CourseLogEntry['eventType']>([
  'COURSE_CREATED',
  'WAYPOINT_REACHED',
  'MOVE_COMPLETED',
  'ROUTE_ADJUSTED',
  'DESTINATION_CHANGED',
  'COURSE_COMPLETED',
  'REFLECTION_ADDED',
]);

type TimelineItem = {
  id: string;
  timestamp: string;
  type: 'PRACTICE' | 'MOVE_COMPLETED' | 'PROGRESS_UPDATED' | 'WAYPOINT_REACHED' | 'COURSE_CREATED' | 'OTHER';
  title: string;
  subtext?: string | null;
};

function daysOnCourse(plottedAt?: string | null): number {
  if (!plottedAt) return 0;
  const start = new Date(plottedAt).getTime();
  if (isNaN(start)) return 0;
  const diff = Date.now() - start;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function formatPracticeModeLabel(mode?: string | null): string {
  if (!mode) return 'Practice';
  const normalized = mode.toLowerCase().replace(/[\s_-]/g, '');
  if (normalized.includes('prime')) return 'Deep practice';
  if (normalized.includes('focus')) return 'Focus';
  if (normalized.includes('visual')) return 'Visualize';
  if (normalized.includes('release')) return 'Release';
  return 'Practice';
}

function formatPracticeDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '0m';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  return `${mins}m`;
}

function formatDayGutterLabel(dateString: string): string {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) return 'TODAY';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return 'YESTERDAY';
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return `${day} ${month}`;
}

function formatDayKey(dateString: string): string {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatEntryTime(dateString: string): string {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

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

  const categoryColor = getCategoryColor(context.identity?.category ?? 'custom');

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

  // Retrieve practice history for this anchor from session store
  const practiceHistory = useSessionStore((s) => s.practiceHistory);

  // Assemble unified timeline
  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    // 1. Add story events from backend log
    const story = (log ?? []).filter((entry) => STORY_EVENTS.has(entry.eventType));
    for (const entry of story) {
      if (entry.eventType === 'MOVE_COMPLETED') {
        const moveTitle = typeof entry.snapshot?.moveTitle === 'string' ? entry.snapshot.moveTitle : null;
        items.push({
          id: entry.id,
          timestamp: entry.occurredAt,
          type: 'MOVE_COMPLETED',
          title: 'Move completed',
          subtext: moveTitle ?? 'Completed move',
        });
      } else if (entry.eventType === 'WAYPOINT_REACHED') {
        const wpTitle = typeof entry.snapshot?.waypointTitle === 'string' ? entry.snapshot.waypointTitle : null;
        items.push({
          id: entry.id,
          timestamp: entry.occurredAt,
          type: 'WAYPOINT_REACHED',
          title: 'Waypoint reached',
          subtext: wpTitle ?? 'Reached waypoint',
        });
      } else if (entry.eventType === 'COURSE_CREATED') {
        items.push({
          id: entry.id,
          timestamp: entry.occurredAt,
          type: 'COURSE_CREATED',
          title: 'Course created',
          subtext: 'Five waypoints plotted toward your destination.',
        });
      } else if (entry.eventType === 'PRACTICE_COMPLETED') {
        const mode = entry.practiceSession?.practiceMode ?? 'focus';
        const durationSec = entry.practiceSession?.completedDurationSeconds ?? 0;
        items.push({
          id: entry.id,
          timestamp: entry.occurredAt,
          type: 'PRACTICE',
          title: 'Practice session',
          subtext: `Practice completed. ${formatPracticeDuration(durationSec)} · ${formatPracticeModeLabel(mode)}`,
        });
      } else {
        items.push({
          id: entry.id,
          timestamp: entry.occurredAt,
          type: 'OTHER',
          title: courseLogEventCopy(entry),
          subtext: null,
        });
      }
    }

    // 2. Add local practice history for this anchor
    const matchingSessions = practiceHistory.filter(
      (s) =>
        s.anchorId === anchorId ||
        s.anchorLocalId === anchorId ||
        s.anchorServerId === anchorId
    );

    for (const session of matchingSessions) {
      // Deduplicate if already present by approximate time or id
      const alreadyPresent = items.some(
        (i) => i.id === session.id || Math.abs(new Date(i.timestamp).getTime() - new Date(session.completedAt).getTime()) < 5000
      );
      if (!alreadyPresent) {
        items.push({
          id: session.id,
          timestamp: session.completedAt,
          type: 'PRACTICE',
          title: 'Practice session',
          subtext: `Practice completed. ${formatPracticeDuration(session.completedDurationSeconds)} · ${formatPracticeModeLabel(session.practiceMode)}`,
        });
      }
    }

    // Sort newest first
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // If completely empty, provide fallback Course created item
    if (items.length === 0) {
      items.push({
        id: 'course-created-default',
        timestamp: view?.plottedAt ?? new Date().toISOString(),
        type: 'COURSE_CREATED',
        title: 'Course created',
        subtext: 'Five waypoints plotted toward your destination.',
      });
    }

    return items;
  }, [log, practiceHistory, anchorId, view?.plottedAt]);

  const renderIcon = (type: TimelineItem['type']) => {
    switch (type) {
      case 'PRACTICE':
        return <Anchor size={14} color={categoryColor} />;
      case 'MOVE_COMPLETED':
        return <Check size={14} color={categoryColor} strokeWidth={2.5} />;
      case 'PROGRESS_UPDATED':
        return <ChartColumn size={14} color={categoryColor} />;
      case 'COURSE_CREATED':
        return <Flag size={14} color="#D4AF37" />;
      case 'WAYPOINT_REACHED':
        return <Flag size={14} color={categoryColor} />;
      default:
        return <Check size={14} color={colors.text.secondary} />;
    }
  };

  return (
    <View testID="v2-chart-journey" style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} animated />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={back}
            hitSlop={12}
            style={styles.backButton}
            testID="chart-course-log-back"
          >
            <ChevronLeft size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Course log</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.categoryPill}>
            <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
            <Text style={[styles.categoryText, { color: categoryColor }]}>
              {context.identity?.category ? context.identity.category.toUpperCase() : 'DESIRE'}
            </Text>
          </View>
          {view?.destination ? (
            <Text style={styles.headerDestination} numberOfLines={1}>
              {view.destination}
            </Text>
          ) : null}
        </View>

        {/* Cropped map strip of chart art below header */}
        <View style={styles.mapStripContainer}>
          <Image source={chartArtFor(context.identity?.category).source} style={styles.mapStrip} resizeMode="cover" />
        </View>

        {/* Right under map: "N days on course" left-aligned, "n of total" right-aligned */}
        {view ? (
          <View style={styles.statsRow}>
            <Text style={styles.statsDays}>
              {daysOnCourse(view.plottedAt)} days on course
            </Text>
            <Text style={styles.statsProgress}>
              {view.reachedCount} of {view.total}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Unified timeline */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[6] }]}
        showsVerticalScrollIndicator={false}
      >
        {!log && !logError ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.text.secondary} />
          </View>
        ) : null}
        {logError ? (
          <Text style={styles.errorText}>{CHART_COPY.errors.loadSupport}</Text>
        ) : null}

        <View style={styles.timeline}>
          {timelineItems.map((item, index) => {
            const dayKey = formatDayKey(item.timestamp);
            const prevItem = index > 0 ? timelineItems[index - 1] : null;
            const prevDayKey = prevItem ? formatDayKey(prevItem.timestamp) : null;
            const isFirstOfDay = dayKey !== prevDayKey;
            const gutterLabel = isFirstOfDay ? formatDayGutterLabel(item.timestamp) : '';

            return (
              <View
                key={item.id}
                style={styles.timelineRow}
                accessible
                accessibilityRole="text"
                accessibilityLabel={`${item.title}. ${item.subtext ?? ''} ${gutterLabel} ${formatEntryTime(item.timestamp)}`}
              >
                {/* Left Gutter: Date label on first entry of day */}
                <View style={styles.gutter}>
                  {isFirstOfDay ? (
                    <Text style={styles.gutterDateText}>{gutterLabel}</Text>
                  ) : null}
                </View>

                {/* Vertical rail with Icon node */}
                <View style={styles.railColumn}>
                  <View style={[styles.railLineTop, index === 0 && styles.railLineHidden]} />
                  <View style={[styles.nodeCircle, { borderColor: `${categoryColor}40` }]}>
                    {renderIcon(item.type)}
                  </View>
                  <View style={[styles.railLineBottom, index === timelineItems.length - 1 && styles.railLineHidden]} />
                </View>

                {/* Content */}
                <View style={styles.entryContent}>
                  <Text style={styles.entryTitle}>{item.title}</Text>
                  {item.subtext ? (
                    <Text style={styles.entrySubtext}>{item.subtext}</Text>
                  ) : null}
                </View>

                {/* Time right-aligned */}
                <View style={styles.timeColumn}>
                  <Text style={styles.timeText}>{formatEntryTime(item.timestamp)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {chart.data?.history.length ? (
          <View style={styles.historySection}>
            <Text style={styles.historyLabel}>EARLIER ROUTES</Text>
            {chart.data.history.map((summary) => (
              <View key={summary.id} style={styles.historyRow}>
                <Text style={styles.historyText}>{summary.destinationText}</Text>
                <Text style={styles.historyDate}>
                  {summary.status === 'COMPLETED'
                    ? `Reached ${formatJourneyDate(summary.completedAt) ?? ''}`
                    : `${summary.reachedCount} of ${summary.waypointCount}`}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[1],
    marginBottom: spacing[3],
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
    flex: 1,
    ...typography.bodySM,
    color: colors.text.secondary,
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[2],
    paddingHorizontal: spacing[1],
  },
  statsDays: {
    ...typography.labelMD,
    color: colors.text.primary,
  },
  statsProgress: {
    ...typography.labelMD,
    color: colors.text.secondary,
  },
  content: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  loadingContainer: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  errorText: {
    ...typography.bodySM,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing[3],
  },
  timeline: {
    marginTop: spacing[2],
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 56,
  },
  gutter: {
    width: 58,
    paddingTop: 4,
    paddingRight: spacing[2],
  },
  gutterDateText: {
    ...typography.labelSM,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.text.secondary,
  },
  railColumn: {
    width: 32,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  railLineTop: {
    width: 1.5,
    height: 6,
    backgroundColor: '#DCD7CD',
  },
  railLineBottom: {
    flex: 1,
    width: 1.5,
    backgroundColor: '#DCD7CD',
  },
  railLineHidden: {
    backgroundColor: 'transparent',
  },
  nodeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.canvas,
    borderWidth: 1.5,
    borderColor: '#DCD7CD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryContent: {
    flex: 1,
    paddingLeft: spacing[2],
    paddingRight: spacing[2],
    paddingTop: 3,
    paddingBottom: spacing[4],
  },
  entryTitle: {
    ...typography.bodyMD,
    color: colors.text.primary,
    fontWeight: '600',
  },
  entrySubtext: {
    ...typography.bodySM,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 18,
  },
  timeColumn: {
    width: 60,
    paddingTop: 4,
    alignItems: 'flex-end',
  },
  timeText: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontSize: 11,
  },
  historySection: {
    marginTop: spacing[6],
    paddingTop: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
  },
  historyLabel: {
    ...typography.labelSM,
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  historyText: {
    flex: 1,
    ...typography.bodyMD,
    color: colors.text.primary,
  },
  historyDate: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
});
