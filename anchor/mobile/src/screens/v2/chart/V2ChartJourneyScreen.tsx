import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  ChartColumn,
  Check,
  ChevronLeft,
  Flag,
} from 'lucide-react-native';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { v2PracticeModeTitle } from '@/constants/v2/practice';
import { formatJourneyDate } from '@/adapters/v2/chart/chartV2Model';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { chartApiClient } from '@/services/ChartApiClient';
import { courseLogEventCopy } from '@/screens/chart/courseLogPresentation';
import { colors, getCategoryColor, getPracticeColor, spacing, typography } from '@/theme/v2';
import { useSessionStore } from '@/stores/sessionStore';
import { daysOnCourse } from '@/adapters/v2/chart/chartDayRhythm';
import { getCachedCourseEvents, getRecordedCourseEvents, type CourseEventRecord } from '@/stores/v2/chartEventStore';
import { ModeIcon } from '@/components/v2/practice/V2PracticeModeRow';
import { CourseLogRouteStrip } from '@/components/v2/chart/CourseLogRouteStrip';
import type { CourseLogEntry } from '@/types/chart';
import { useChartContext } from './chartScreenSupport';
import {
  buildCourseLogDays,
  courseLogTotals,
  formatCourseDuration,
  practiceModeKey,
  shortDate,
  type CourseLogRow,
} from './courseLogModel';

type Params = { anchorId: string };

/** Events that tell the story of the course; bookkeeping events stay out. COURSE_CREATED is the "Course started" row. */
const STORY_EVENTS = new Set<CourseLogEntry['eventType']>([
  'WAYPOINT_REACHED',
  'MOVE_COMPLETED',
  'ROUTE_ADJUSTED',
  'DESTINATION_CHANGED',
  'COURSE_COMPLETED',
  'REFLECTION_ADDED',
  'PRACTICE_COMPLETED',
]);

const SERIF = 'EBGaramond-Medium';
const SERIF_ITALIC = 'EBGaramond-Italic';
const LINE = colors.line;
const GOLD = '#D8A94A';

function formatEntryTime(dateString: string): string {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** A reflection attached to the session's own course-log record. Local session records carry none. */
function reflectionNote(entry: CourseLogEntry): string | null {
  const reflection = entry.reflection;
  if (!reflection) return null;
  const structured = reflection.structuredContent as { whatHelped?: string; whatLearned?: string } | null;
  const text = reflection.body?.trim() || structured?.whatLearned?.trim() || structured?.whatHelped?.trim() || '';
  return text || null;
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
  const [logHasMore, setLogHasMore] = useState(false);
  const [logError, setLogError] = useState(false);
  // After a successful Retry the banner reads "Up to date." for 900ms, then goes away.
  const [bannerOk, setBannerOk] = useState(false);
  const okTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recordedEvents, setRecordedEvents] = useState<CourseEventRecord[]>(() =>
    courseId ? getCachedCourseEvents(courseId) : []
  );

  const categoryColor = getCategoryColor(context.identity?.category ?? 'custom');

  /** One load, used by the first fetch and by Retry. Resolves true on success. */
  const loadLog = useCallback(
    async (id: string, signal?: AbortSignal): Promise<boolean> => {
      try {
        const result = await chartApiClient.getCourseLog(id, { limit: 100 }, signal);
        if (signal?.aborted) return false;
        setLog(result.data);
        setLogHasMore(Boolean(result.pagination?.hasMore));
        setLogError(false);
        return true;
      } catch {
        if (!signal?.aborted) setLogError(true);
        return false;
      }
    },
    []
  );

  useEffect(() => {
    if (!courseId) return undefined;
    const controller = new AbortController();
    setLogError(false);
    void loadLog(courseId, controller.signal);
    return () => controller.abort();
  }, [courseId, loadLog]);

  useEffect(() => () => { if (okTimer.current) clearTimeout(okTimer.current); }, []);

  const retry = useCallback(async () => {
    if (!courseId) return;
    if (await loadLog(courseId)) {
      setBannerOk(true);
      if (okTimer.current) clearTimeout(okTimer.current);
      okTimer.current = setTimeout(() => setBannerOk(false), 900);
    }
  }, [courseId, loadLog]);

  useEffect(() => {
    if (!courseId) return;
    setRecordedEvents(getCachedCourseEvents(courseId));
    let mounted = true;
    getRecordedCourseEvents(courseId).then((evts) => {
      if (mounted) setRecordedEvents(evts);
    });
    return () => {
      mounted = false;
    };
  }, [courseId]);

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('V2Chart', { anchorId }));

  // Retrieve practice history for this anchor from session store
  const practiceHistory = useSessionStore((s) => s.practiceHistory);

  // Assemble the rows: sessions (server record + this device's history) and the course's own story events.
  const rows = useMemo<CourseLogRow[]>(() => {
    const items: CourseLogRow[] = [];
    const sessionNear = (timestamp: string, mode: string, windowMs: number) =>
      items.some((i) => i.kind === 'session' && i.mode === mode && Math.abs(new Date(i.timestamp).getTime() - new Date(timestamp).getTime()) < windowMs);

    // 1. Backend log. Practice sessions here carry the person's reflection, when they wrote one.
    for (const entry of (log ?? []).filter((e) => STORY_EVENTS.has(e.eventType))) {
      if (entry.eventType === 'PRACTICE_COMPLETED') {
        const mode = practiceModeKey(entry.practiceSession?.practiceMode);
        items.push({
          id: entry.practiceSession?.id ?? entry.id,
          timestamp: entry.occurredAt,
          kind: 'session',
          title: v2PracticeModeTitle(mode),
          mode,
          seconds: entry.practiceSession?.completedDurationSeconds ?? 0,
          note: reflectionNote(entry),
        });
      } else if (entry.eventType === 'MOVE_COMPLETED') {
        const moveTitle = typeof entry.snapshot?.moveTitle === 'string' ? entry.snapshot.moveTitle : null;
        items.push({ id: entry.id, timestamp: entry.occurredAt, kind: 'event', eventType: 'MOVE_COMPLETED', title: moveTitle ?? 'Move completed', detail: moveTitle ? 'Completed' : null });
      } else if (entry.eventType === 'WAYPOINT_REACHED') {
        const wpTitle = typeof entry.snapshot?.waypointTitle === 'string' ? entry.snapshot.waypointTitle : null;
        items.push({ id: entry.id, timestamp: entry.occurredAt, kind: 'event', eventType: 'WAYPOINT_REACHED', title: wpTitle ?? 'Waypoint reached', detail: wpTitle ? 'Reached' : null });
      } else {
        items.push({ id: entry.id, timestamp: entry.occurredAt, kind: 'event', eventType: 'OTHER', title: courseLogEventCopy(entry) });
      }
    }

    // 2. Local recorded events (Move completed, Progress updated)
    for (const evt of recordedEvents) {
      if (evt.type === 'MOVE_COMPLETED') {
        const alreadyPresent = items.some(
          (i) => i.id === evt.id || (i.eventType === 'MOVE_COMPLETED' && Math.abs(new Date(i.timestamp).getTime() - new Date(evt.timestamp).getTime()) < 10000)
        );
        if (!alreadyPresent) {
          items.push({ id: evt.id, timestamp: evt.timestamp, kind: 'event', eventType: 'MOVE_COMPLETED', title: 'Move completed', detail: evt.payload?.moveTitle ?? 'Completed move' });
        }
      } else if (evt.type === 'PROGRESS_UPDATED') {
        const delta = evt.payload?.delta;
        const unit = evt.payload?.unit ?? 'users';
        const deltaStr = delta != null ? (delta > 0 ? `+${delta}` : `${delta}`) : null;
        const rangeStr = evt.payload?.from != null && evt.payload?.to != null ? `${evt.payload.from} → ${evt.payload.to} ${unit}.` : null;
        items.push({ id: evt.id, timestamp: evt.timestamp, kind: 'event', eventType: 'PROGRESS_UPDATED', title: 'Progress updated', detail: [rangeStr, deltaStr ? `${deltaStr} ${unit}` : null].filter(Boolean).join(' ') || null });
      }
    }

    // 3. This device's practice history for the anchor, unless the server record already has the session
    const matchingSessions = practiceHistory.filter(
      (sess) => sess.anchorId === anchorId || sess.anchorLocalId === anchorId || sess.anchorServerId === anchorId
    );
    for (const session of matchingSessions) {
      const mode = practiceModeKey(session.practiceMode);
      if (items.some((i) => i.id === session.id) || sessionNear(session.completedAt, mode, 5000)) continue;
      items.push({ id: session.id, timestamp: session.completedAt, kind: 'session', title: v2PracticeModeTitle(mode), mode, seconds: session.completedDurationSeconds ?? 0, note: null });
    }
    return items;
  }, [log, recordedEvents, practiceHistory, anchorId]);

  // NOTE (open decision): move, waypoint and progress events stay on the thread as plain rows (no session count or time). The prototype lists sessions only.
  const days = useMemo(() => buildCourseLogDays(rows, new Date()), [rows]);
  const totals = useMemo(() => courseLogTotals(rows), [rows]);
  const startedAt = useMemo(() => {
    const created = (log ?? []).find((e) => e.eventType === 'COURSE_CREATED')?.occurredAt;
    const iso = view?.plottedAt ?? created ?? null;
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d.getTime()) ? shortDate(d) : null;
  }, [log, view?.plottedAt]);

  const hasData = rows.length > 0;
  const bannerVisible = logError || bannerOk;
  const currentWaypoint = view?.current ?? null;
  const countLabel = totals.sessions === 1 ? CHART_COPY.log.sessionOne : CHART_COPY.log.sessionMany;
  // A paged, not fully loaded list cannot honestly state a total time.
  const listMeta = totals.sessions
    ? [countLabel.replace('{n}', String(totals.sessions)), logHasMore ? null : formatCourseDuration(totals.seconds)].filter(Boolean).join(' · ')
    : '';

  const renderTile = (row: CourseLogRow) => {
    if (row.kind === 'session' && row.mode) {
      const color = getPracticeColor(row.mode);
      // The mode colour at ~14% on the page cream.
      return (
        <View style={[styles.tile, { backgroundColor: `${color}24` }]} testID={`course-log-tile-${row.mode}`}>
          <ModeIcon mode={row.mode} color={color} size={22} />
        </View>
      );
    }
    const Icon = row.eventType === 'WAYPOINT_REACHED' ? Flag : row.eventType === 'PROGRESS_UPDATED' ? ChartColumn : Check;
    return (
      <View style={[styles.tile, { backgroundColor: `${categoryColor}1F` }]}>
        <Icon size={20} color={categoryColor} strokeWidth={1.8} />
      </View>
    );
  };

  return (
    <View testID="v2-chart-journey" style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" animated />

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

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[6] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaContainer}>
          <View style={styles.categoryPill}>
            <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
            <Text style={[styles.categoryText, { color: categoryColor }]}>
              {context.identity?.category ? context.identity.category.toUpperCase() : 'DESIRE'}
            </Text>
          </View>
          {view?.destination ? (
            <Text style={styles.headerDestination} numberOfLines={2}>
              {view.destination}
            </Text>
          ) : null}
        </View>

        {view ? (
          <>
            <CourseLogRouteStrip total={view.total} reachedCount={view.reachedCount} title={currentWaypoint?.title ?? null} />
            <View style={styles.statsRow}>
              <Text style={styles.statsDays}>
                {(() => {
                  const count = daysOnCourse(view.plottedAt, new Date());
                  return `${count} ${count === 1 ? 'day' : 'days'} on course`;
                })()}
              </Text>
              <Text style={styles.statsProgress}>
                {view.reachedCount} of {view.total} reached
              </Text>
            </View>
          </>
        ) : null}

        {bannerVisible ? (
          <View style={[styles.banner, !hasData && !bannerOk && styles.bannerEmpty]} testID="course-log-banner" accessibilityLiveRegion="polite">
            <View style={styles.bannerDot} />
            <Text style={styles.bannerText}>{bannerOk ? CHART_COPY.log.upToDate : CHART_COPY.log.error}</Text>
            {!bannerOk ? (
              <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.log.retry} onPress={() => void retry()} style={styles.retry} testID="course-log-retry">
                <Text style={styles.retryText}>{CHART_COPY.log.retry}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!log && !logError ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.text.secondary} />
          </View>
        ) : null}

        {hasData || !logError ? (
          <>
            <View style={styles.listHead}>
              <Text style={styles.listTitle} accessibilityRole="header">{CHART_COPY.log.sessions}</Text>
              {listMeta ? <Text style={styles.listMeta} testID="course-log-total">{listMeta}</Text> : null}
            </View>

            <View style={styles.thread} testID="course-log-thread">
              <View style={styles.threadLine} pointerEvents="none" />
              {days.map((day) => (
                <View key={day.key}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayLabel}>{day.label}</Text>
                    <Text style={styles.dayMeta} testID={`course-log-day-${day.key}`}>{day.meta}</Text>
                  </View>
                  {day.rows.map((row) => {
                    const duration = row.kind === 'session' && row.seconds ? formatCourseDuration(row.seconds) : '';
                    return (
                      <View
                        key={row.id}
                        style={styles.entry}
                        accessible
                        accessibilityRole="text"
                        accessibilityLabel={`${row.title}. ${duration} ${row.detail ?? ''} ${row.note ?? ''} ${formatEntryTime(row.timestamp)}`}
                        testID="course-log-row"
                      >
                        <View style={styles.tileRing}>{renderTile(row)}</View>
                        <View style={styles.entryMain}>
                          <Text style={styles.entryTitle}>
                            {row.title}
                            {duration ? <Text style={styles.entryDuration}>{`  ${duration}`}</Text> : null}
                          </Text>
                          {row.detail ? <Text style={styles.entryDetail}>{row.detail}</Text> : null}
                        </View>
                        <Text style={styles.timeText}>{formatEntryTime(row.timestamp)}</Text>
                        {row.note ? <Text style={styles.entryNote} numberOfLines={2} testID="course-log-note">{row.note}</Text> : null}
                      </View>
                    );
                  })}
                </View>
              ))}
              {startedAt ? (
                <View style={styles.start} testID="course-log-started">
                  <View style={styles.startDotWrap}><View style={styles.startDotRing}><View style={styles.startDot} /></View></View>
                  <Text style={styles.startText}>{CHART_COPY.log.courseStarted.replace('{date}', startedAt)}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

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
  screen: { flex: 1, backgroundColor: colors.canvas },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  backButton: { padding: spacing[1] },
  headerTitle: { fontFamily: SERIF, fontSize: 24, lineHeight: 28, color: colors.text.primary },
  headerSpacer: { width: 32 },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[1] },
  metaContainer: { marginBottom: spacing[3], gap: 4 },
  categoryPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  categoryDot: { width: 6, height: 6, borderRadius: 3 },
  categoryText: { ...typography.labelSM, fontSize: 11, letterSpacing: 0.6 },
  headerDestination: { ...typography.bodySM, color: colors.text.secondary, lineHeight: 19 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[3], marginTop: spacing[3], paddingHorizontal: spacing[1] },
  statsDays: { ...typography.labelMD, flexShrink: 1, color: colors.text.primary },
  statsProgress: { ...typography.labelMD, flexShrink: 1, textAlign: 'right', color: colors.text.secondary },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing[4], paddingVertical: 11, paddingLeft: 14, paddingRight: 8, backgroundColor: '#EAE1CE', borderRadius: 12 },
  bannerEmpty: { marginTop: spacing[6], paddingVertical: spacing[4] },
  bannerDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: GOLD },
  bannerText: { ...typography.bodySM, flex: 1, minWidth: 0, color: colors.text.primary },
  retry: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  retryText: { ...typography.labelMD, color: colors.text.primary },
  loadingContainer: { paddingVertical: spacing[4], alignItems: 'center' },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing[3], marginTop: spacing[6], paddingTop: spacing[4], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  listTitle: { fontFamily: SERIF, fontSize: 21, lineHeight: 26, color: colors.text.primary },
  listMeta: { ...typography.caption, flexShrink: 1, textAlign: 'right', color: colors.text.secondary },
  thread: { position: 'relative', marginTop: spacing[1] },
  // One continuous line behind every tile; each tile's cream ring makes it pass behind.
  threadLine: { position: 'absolute', left: 23.25, width: 1.5, top: 44, bottom: 18, backgroundColor: LINE },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing[2], paddingTop: spacing[5], paddingBottom: spacing[2], paddingLeft: 60 },
  dayLabel: { fontFamily: SERIF, fontSize: 16, lineHeight: 22, color: colors.text.primary },
  dayMeta: { ...typography.caption, flexShrink: 1, textAlign: 'right', color: colors.text.secondary },
  entry: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingVertical: 6 },
  tileRing: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  entryMain: { flex: 1, minWidth: 0, marginLeft: 12 },
  entryTitle: { fontFamily: SERIF, fontSize: 18, lineHeight: 24, color: colors.text.primary },
  entryDuration: { ...typography.bodySM, fontSize: 14, color: colors.text.secondary },
  entryDetail: { ...typography.bodySM, color: colors.text.secondary, marginTop: 2 },
  timeText: { ...typography.caption, marginLeft: 8, color: colors.text.secondary },
  entryNote: { width: '100%', paddingLeft: 60, marginTop: 2, fontFamily: SERIF_ITALIC, fontSize: 14.5, lineHeight: 20, color: colors.text.secondary },
  start: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing[5] },
  startDotWrap: { width: 48, alignItems: 'center', justifyContent: 'center' },
  startDotRing: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  startDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD },
  startText: { ...typography.bodySM, marginLeft: 12, color: colors.text.secondary },
  historySection: { marginTop: spacing[6], paddingTop: spacing[4], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.subtle },
  historyLabel: { ...typography.labelSM, color: colors.text.secondary, marginBottom: spacing[2] },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle },
  historyText: { flex: 1, ...typography.bodyMD, color: colors.text.primary },
  historyDate: { ...typography.caption, color: colors.text.tertiary },
});
