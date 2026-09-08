import React, { useCallback, useEffect, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpRight, BookOpen, ChevronDown, CircleAlert, Eye, Link2, MoreHorizontal, RefreshCw, Sparkles, Zap } from 'lucide-react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useCourseLogStore } from '@/stores/courseLogStore';
import { startReflectionQueueSync } from '@/services/ReflectionService';
import { AnalyticsEvents, trackChartEventOnce } from '@/services/AnalyticsService';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import type { ChartPracticeMode } from '@/types/practice';
import { canViewChart } from '@/types/chart';
import type { ChartStackParamList, CourseDetail, CourseSummary, WaypointSummary } from '@/types/chart';
import { colors, typography } from '@/theme';
import { CourseMap } from './components/CourseMap';
import {
  ChartButton,
  ChartCard,
  ChartGhostButton,
  ChartIconButton,
  ChartKicker,
  ChartScreenFrame,
  ChartSection,
  ChartSyncNotice,
  LinearWaypointList,
  ReadOnlyNotice,
  formatDate,
} from './chartUi';

type ChartNavigation = NativeStackNavigationProp<ChartStackParamList>;
type ChartHomeRoute = RouteProp<ChartStackParamList, 'ChartHome'>;

const PRACTICE_MODES: Array<{ mode: ChartPracticeMode; label: string; description: string; color: string; icon: React.ReactNode }> = [
  { mode: 'focus', label: 'FOCUS', description: 'Lock onto the Anchor', color: colors.gold, icon: <Zap size={15} color={colors.gold} /> },
  { mode: 'visualize', label: 'VISUALIZE', description: 'See the outcome clearly', color: '#78B4D1', icon: <Eye size={15} color="#78B4D1" /> },
  { mode: 'deepPrime', label: 'DEEP PRIME', description: 'Go deeper', color: '#AD99D2', icon: <Sparkles size={15} color="#AD99D2" /> },
];

const EMPTY_STARS: Array<[number, number, number]> = [
  [18, 54, 0.8], [48, 116, 0.65], [82, 186, 0.7], [126, 78, 0.55], [154, 228, 0.75],
  [206, 52, 0.6], [242, 144, 0.75], [286, 92, 0.65], [332, 182, 0.8], [370, 48, 0.55],
  [24, 314, 0.65], [66, 386, 0.75], [112, 344, 0.55], [178, 410, 0.8], [224, 362, 0.6],
  [274, 438, 0.7], [316, 328, 0.55], [362, 398, 0.75], [42, 506, 0.6], [98, 570, 0.7],
  [168, 536, 0.55], [232, 612, 0.75], [302, 548, 0.65], [354, 638, 0.55], [16, 688, 0.7],
];

function errorCopy(code: string | null): string {
  switch (code) {
    case 'FEATURE_DISABLED': return 'Chart is currently read-only.';
    case 'MIGRATION_REQUIRED': return 'Chart needs to finish preparing your account.';
    case 'COURSE_VERSION_CONFLICT': return 'This Course changed elsewhere. Your view has been refreshed.';
    case 'COURSE_NOT_FOUND': return 'That Course is no longer available.';
    case 'NETWORK': return 'Chart could not refresh. Cached data remains available.';
    case 'STALE': return 'This Chart is out of date. Refresh before making a change.';
    default: return 'Chart could not refresh. Try again.';
  }
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function logEntryText(entry: { eventType: string; practiceSession?: { practiceMode: string } | null; reflection?: { body?: string | null; structuredContent?: { whatHelped?: string; whatLearned?: string } | null } | null }): { meta: string; text: string } {
  const mode = entry.practiceSession?.practiceMode?.replace(/_/g, ' ').toUpperCase();
  const structured = entry.reflection?.structuredContent;
  const reflectionText = entry.reflection?.body?.trim() || structured?.whatHelped?.trim() || structured?.whatLearned?.trim();
  return {
    meta: `${entry.eventType.replace(/_/g, ' ')}${mode ? ` · ${mode}` : ''}`,
    text: reflectionText || 'A Course update was recorded here.',
  };
}

const EmptyChartArt: React.FC = () => (
  <View style={styles.emptyArt} pointerEvents="none">
    <Svg width="100%" height="100%" viewBox="0 0 390 720" preserveAspectRatio="none" style={styles.emptyStarfield}>
      {EMPTY_STARS.map(([cx, cy, r]) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="rgba(245,240,232,0.3)" opacity={0.5} />)}
    </Svg>
    <Svg width={380} height={380} viewBox="0 0 380 380" style={styles.emptyGlowSvg}>
      <Defs>
        <RadialGradient id="emptyChartGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#3E2C5B" stopOpacity={0.3} />
          <Stop offset="68%" stopColor="#3E2C5B" stopOpacity={0} />
          <Stop offset="100%" stopColor="#3E2C5B" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="190" cy="190" r="190" fill="url(#emptyChartGlow)" />
    </Svg>
    <Svg width={322} height={72} viewBox="0 0 322 72" style={styles.emptyRouteSvg}>
      <G>
        <Path d="M 5 46 L 80 28 L 160 51 L 240 22 L 317 34" fill="none" stroke="rgba(245,240,232,0.14)" strokeWidth="1" strokeDasharray="3 6" strokeLinecap="round" />
        <Circle cx="5" cy="46" r="4.5" fill="none" stroke="rgba(245,240,232,0.22)" strokeWidth="1" />
        <Circle cx="80" cy="28" r="4.5" fill="none" stroke="rgba(245,240,232,0.22)" strokeWidth="1" />
        <Circle cx="160" cy="51" r="4.5" fill="none" stroke="rgba(245,240,232,0.22)" strokeWidth="1" />
        <Circle cx="240" cy="22" r="4.5" fill="none" stroke="rgba(245,240,232,0.22)" strokeWidth="1" />
        <Circle cx="317" cy="34" r="4.5" fill="none" stroke="rgba(245,240,232,0.22)" strokeWidth="1" />
      </G>
    </Svg>
  </View>
);

const AnchorArt: React.FC<{ waypoint: WaypointSummary }> = ({ waypoint }) => {
  const imageUrl = waypoint.anchorLink?.snapshot.enhancedImageUrl;
  return (
    <View style={styles.anchorArt}>
      <View style={styles.anchorGlow} />
      <View style={styles.anchorRing}>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.anchorImage} /> : <Text style={styles.anchorPlaceholder}>Anchor</Text>}
      </View>
    </View>
  );
};

const PracticeModeButton: React.FC<{
  mode: (typeof PRACTICE_MODES)[number];
  disabled: boolean;
  onPress: () => void;
}> = ({ mode, disabled, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={`${mode.label}: ${mode.description}`}
    style={({ pressed }) => [styles.practiceMode, disabled && styles.disabled, pressed && styles.pressed]}
  >
    {mode.icon}
    <Text style={[styles.practiceModeLabel, { color: mode.color }]}>{mode.label}</Text>
  </Pressable>
);

const DestinationAnchor: React.FC<{ course: CourseDetail | CourseSummary }> = ({ course }) => (
  <View style={styles.destinationAnchorRow}>
    <Link2 size={14} color={colors.gold} />
    <Text style={styles.destinationAnchorText}>{course.destinationAnchorLink?.snapshot.intentionText ?? 'No destination Anchor linked'}</Text>
  </View>
);

export const ChartHomeScreen: React.FC = () => {
  const navigation = useNavigation<ChartNavigation>();
  const route = useRoute<ChartHomeRoute>();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const serverFlags = useAuthStore((state) => state.user?.chartFlags);
  const chartCapabilities = useAuthStore((state) => state.user?.chartCapabilities);
  const authOffline = useAuthStore((state) => state.isOfflineMode);
  const { registerTabNav } = useTabNavigation();
  const store = useCourseStore();
  const logStore = useCourseLogStore();
  const reducedMotion = useReduceMotionEnabled();

  useEffect(() => {
    if (!accountId || serverFlags == null) return;
    if (canViewChart(serverFlags, chartCapabilities)) {
      trackChartEventOnce(AnalyticsEvents.CHART_TAB_VIEWED, accountId, route.key, {
        entry_source: 'chart_tab',
      });
    } else {
      trackChartEventOnce(AnalyticsEvents.CHART_UNAVAILABLE_VIEWED, accountId, route.key, {
        entry_source: 'chart_tab',
        error_category: 'feature_unavailable',
        offline: authOffline,
      });
    }
  }, [accountId, authOffline, chartCapabilities, route.key, serverFlags]);

  useEffect(() => {
    if (!accountId || !canViewChart(serverFlags, chartCapabilities)) return;
    store.setFeatureFlags(serverFlags);
    store.bindAccount(accountId);
    void store.hydrateAndRefresh(accountId);
  }, [accountId, serverFlags, chartCapabilities, store.bindAccount, store.hydrateAndRefresh, store.setFeatureFlags]);

  useEffect(() => startReflectionQueueSync(), []);

  useEffect(() => {
    registerTabNav(2, navigation);
    return () => registerTabNav(2, null);
  }, [navigation, registerTabNav]);

  const course = useMemo<CourseDetail | CourseSummary | null>(() => {
    if (store.activeCourse) return store.activeCourse;
    return store.courses.find((item) => item.status === 'DRAFT') ?? store.courses.find((item) => item.status === 'ACTIVE') ?? null;
  }, [store.activeCourse, store.courses]);
  const detail = course && 'waypoints' in course ? course : null;

  useEffect(() => {
    if (!accountId || !detail?.id) return;
    void logStore.bind(accountId, detail.id);
  }, [accountId, detail?.id, logStore.bind]);

  const historicalCourses = store.courses.filter((item) => item.status === 'COMPLETED' || item.status === 'ARCHIVED');
  const hasCache = Boolean(course || store.courses.length);
  const offline = authOffline || store.offline;
  const readOnly = store.readOnly || offline || store.stale;

  const retry = useCallback(() => {
    if (accountId) void store.hydrateAndRefresh(accountId);
  }, [accountId, store.hydrateAndRefresh]);

  const openCourse = useCallback(() => {
    if (course) navigation.navigate('CourseDetails', { courseId: course.id });
  }, [course, navigation]);

  if (!accountId || !store.flags.chart_enabled) {
    return (
      <ChartScreenFrame title="CHART" subtitle="Know where you’re going.">
        <ChartCard emphasis><Text style={styles.emptyTitle}>Chart is unavailable</Text><Text style={styles.body}>Chart will appear here when it is enabled for your account.</Text></ChartCard>
      </ChartScreenFrame>
    );
  }

  if (store.migrationRequired) {
    return (
      <ChartScreenFrame title="CHART" subtitle="Know where you’re going.">
        <ChartCard emphasis><ChartKicker>Chart</ChartKicker><Text style={styles.emptyTitle}>Chart isn’t ready yet.</Text><Text style={styles.body}>Your account needs one more preparation step before Courses can open.</Text><ChartButton label="Tap to retry" onPress={retry} disabled={store.refreshing} /></ChartCard>
      </ChartScreenFrame>
    );
  }

  if ((store.loading || store.initializationStatus === 'hydrating') && !hasCache) {
    return <ChartScreenFrame title="CHART" subtitle="Know where you’re going."><LoadingSpinner message="Loading Chart" /></ChartScreenFrame>;
  }

  if (!course && !hasCache && store.errorCode) {
    return <ChartScreenFrame title="CHART" subtitle="Know where you’re going."><ChartCard emphasis><Text accessibilityLiveRegion="assertive" style={styles.error}>{errorCopy(store.errorCode)}</Text><ChartButton label="Retry" onPress={retry} /></ChartCard></ChartScreenFrame>;
  }

  if (!course) {
    return (
      <ChartScreenFrame title="CHART" scroll={false} headerTopInset={18}>
        <View style={styles.emptyState}>
          <EmptyChartArt />
          <Text style={styles.emptyTitle}>Where are you going?</Text>
          <Text style={[styles.body, styles.emptyBody]}>Set a destination. Anchor will help you plot the way there.</Text>
          <ChartButton label="Plot Your Course" onPress={() => navigation.navigate('CourseSetup')} />
          <ChartGhostButton label="Build it myself" onPress={() => navigation.navigate('CourseSetup')} style={styles.buildItButton} />
        </View>
        {historicalCourses.length > 0 ? <ChartCard><ChartKicker>Completed & Archived Journeys</ChartKicker>{historicalCourses.map((item) => <ChartGhostButton key={item.id} label={`${item.status === 'COMPLETED' ? 'Completed' : 'Archived'} · ${item.destinationText}`} onPress={() => item.status === 'COMPLETED' ? navigation.navigate('CompletedJourney', { courseId: item.id }) : navigation.navigate('CourseDetails', { courseId: item.id })} />)}</ChartCard> : null}
      </ChartScreenFrame>
    );
  }

  const currentWaypoint = detail?.waypoints.find((waypoint) => waypoint.id === detail.currentWaypointId) ?? null;
  const currentLogEntries = currentWaypoint
    ? logStore.entries.filter((entry) => !entry.waypointId || entry.waypointId === currentWaypoint.id).slice(0, 2)
    : [];
  const isActive = course.status === 'ACTIVE';
  const isDraft = course.status === 'DRAFT';
  const isCompleted = course.status === 'COMPLETED';
  const isArchived = course.status === 'ARCHIVED';

  const launchPractice = (mode: ChartPracticeMode) => {
    if (!detail || !currentWaypoint || !currentWaypoint.anchorLink?.anchorAvailable || readOnly) return;
    navigation.navigate('WaypointDetail', {
      courseId: detail.id,
      waypointId: currentWaypoint.id,
      launchMode: mode,
    });
  };

  useEffect(() => {
    if (!accountId || !course) return;
    trackChartEventOnce(AnalyticsEvents.COURSE_VIEWED, accountId, course.id, {
      course_state: course.status,
      waypoint_count: course.waypointCount,
    });
    if (course.needsRepair) {
      trackChartEventOnce(AnalyticsEvents.CHART_UNAVAILABLE_VIEWED, accountId, `repair:${course.id}`, {
        course_state: course.status,
        error_category: 'repair_required',
      });
    }
  }, [accountId, course]);

  return (
    <ChartScreenFrame
        title="CHART"
        subtitle="Know where you’re going."
        headerActions={
          <View style={styles.headerActions}>
            <ChartIconButton label="Chart menu" icon={<MoreHorizontal size={17} color={colors.gold} />} onPress={openCourse} />
          </View>
      }
    >
      {store.errorCode ? <View style={styles.inlineNotice}><CircleAlert size={15} color="#F0A0A0" /><Text accessibilityLiveRegion="assertive" style={styles.inlineNoticeText}>{errorCopy(store.errorCode)}</Text><Pressable onPress={retry} accessibilityRole="button"><RefreshCw size={15} color={colors.gold} /></Pressable></View> : null}
      {offline || store.stale ? <ChartSyncNotice lastSyncedAt={store.lastSyncedAt} offline={offline} onRetry={retry} /> : null}

      {isDraft ? (
        <ChartCard emphasis>
          <ChartKicker>YOUR COURSE · DRAFT</ChartKicker>
          <Text style={styles.courseTitle}>{course.destinationText.toUpperCase()}</Text>
          <Text style={styles.body}>{course.waypointCount} waypoint{course.waypointCount === 1 ? '' : 's'} plotted.</Text>
          <ChartButton label="Continue editing" onPress={() => navigation.navigate('CourseEditor', { courseId: course.id })} />
          <ChartButton label="Publish Course" secondary onPress={() => void store.publishCourse(course.id, course.version)} disabled={readOnly || course.waypointCount === 0} />
        </ChartCard>
      ) : null}

      {isActive && detail ? (
        <>
          <ChartSection style={styles.courseHeaderSection}>
            <ChartKicker>CURRENT COURSE</ChartKicker>
            <Pressable onPress={openCourse} accessibilityRole="button" accessibilityLabel="Open current course details" style={styles.courseTitleRow}>
              <Text style={styles.courseTitle}>{course.destinationText.toUpperCase()}</Text>
              <ChevronDown size={16} color={colors.gold} />
            </Pressable>
            <View style={styles.courseMetaRow}>
              <View style={styles.activeDestination}><View style={styles.activeDot} /><Text style={styles.metaGold}>Active destination</Text></View>
              <ChartGhostButton label="Course details" icon={<Link2 size={12} color={colors.gold} />} onPress={openCourse} color={colors.gold} />
            </View>
          </ChartSection>

          <ChartSection style={styles.routeSection}>
            <CourseMap
              courseId={course.id}
              destinationText={course.destinationText}
              waypoints={detail.waypoints}
              currentWaypointId={detail.currentWaypointId}
              reachedCount={course.reachedCount}
              completed={false}
              reducedMotion={reducedMotion}
              orientation="horizontal"
              onWaypointPress={(waypointId) => navigation.navigate('WaypointDetail', { courseId: course.id, waypointId })}
            />
            <Text style={styles.progress}>{course.reachedCount} of {course.waypointCount} waypoints reached</Text>
          </ChartSection>

          {currentWaypoint ? (
            <ChartSection style={styles.currentSection}>
              <ChartKicker color={currentWaypoint.state === 'BLOCKED' ? colors.warning : colors.practiceMode.focus.primary}>CURRENT WAYPOINT</ChartKicker>
              <View style={styles.currentTitleRow}><Text style={styles.currentTitle}>{currentWaypoint.title}</Text><View style={[styles.currentBadge, currentWaypoint.state === 'BLOCKED' && styles.blockedBadge]}><View style={[styles.currentBadgeDot, currentWaypoint.state === 'BLOCKED' && styles.blockedDot]} /><Text style={[styles.currentBadgeText, currentWaypoint.state === 'BLOCKED' && styles.blockedText]}>{currentWaypoint.state === 'BLOCKED' ? 'BLOCKED' : 'CURRENT'}</Text></View></View>
              {currentWaypoint.state === 'BLOCKED' ? <Text style={styles.currentDescription}>This waypoint is blocked because its linked Anchor is unavailable.</Text> : currentWaypoint.description ? <Text style={styles.currentDescription}>{currentWaypoint.description}</Text> : null}

              <ChartKicker style={styles.subKicker}>LINKED ANCHOR</ChartKicker>
              <ChartCard style={styles.anchorCard}>
                <AnchorArt waypoint={currentWaypoint} />
                <View style={styles.anchorCopy}>
                  <Text style={styles.anchorQuote}>“{currentWaypoint.anchorLink?.snapshot.intentionText ?? 'No Anchor linked yet'}”</Text>
                  <Text style={styles.anchorMeta}>{currentWaypoint.anchorLink?.anchorAvailable ? 'LINKED ANCHOR' : currentWaypoint.state === 'BLOCKED' ? 'ANCHOR UNAVAILABLE' : 'LINK AN ANCHOR TO PRACTICE'}</Text>
                </View>
                <ArrowUpRight size={15} color={colors.gold} />
              </ChartCard>
              {!currentWaypoint.anchorLink?.anchorAvailable ? <ChartButton label="Link an Existing Anchor" secondary onPress={() => navigation.navigate('WaypointDetail', { courseId: course.id, waypointId: currentWaypoint.id })} disabled={readOnly} /> : null}

              <ChartKicker style={styles.subKicker}>PRACTICE THIS WAYPOINT</ChartKicker>
              <View style={styles.practiceRow}>
                {PRACTICE_MODES.map((mode) => <PracticeModeButton key={mode.mode} mode={mode} disabled={readOnly || !currentWaypoint.anchorLink?.anchorAvailable || currentWaypoint.state === 'BLOCKED'} onPress={() => launchPractice(mode.mode)} />)}
              </View>

              <ChartKicker style={styles.subKicker}>COURSE LOG · {currentWaypoint.title}</ChartKicker>
              <ChartCard style={styles.logCard}>
                {currentLogEntries.length > 0 ? currentLogEntries.map((entry) => {
                  const copy = logEntryText(entry);
                  return <View key={entry.id} style={styles.logLine}><View style={styles.logDot} /><View style={styles.logEntryCopy}><Text style={styles.logMeta}>{formatShortDate(entry.occurredAt).toUpperCase()} · {copy.meta}</Text><Text style={styles.logQuote}>“{copy.text}”</Text></View></View>;
                }) : <Text style={styles.logEmpty}>{logStore.loading ? 'Loading Course Log…' : 'Your reflections will appear here.'}</Text>}
              </ChartCard>
              <View style={styles.logActions}><ChartGhostButton label="Add Reflection" icon={<BookOpen size={13} color={colors.gold} />} onPress={() => navigation.navigate('ReflectionComposer', { source: 'MANUAL_COURSE', promptType: 'COURSE_STATUS', promptVersion: 1, courseId: course.id, waypointId: currentWaypoint.id, draftKey: `course:${course.id}:${currentWaypoint.id}:manual` })} /><ChartGhostButton label="View full log →" onPress={() => navigation.navigate('CourseLog', { courseId: course.id })} color={colors.gold} /></View>

              <ChartKicker style={styles.subKicker}>COURSE GUIDANCE</ChartKicker>
              <ChartGhostButton label={course.observations?.[0]?.text ?? 'Your reflections will surface patterns here.'} onPress={() => navigation.navigate('CourseLog', { courseId: course.id })} color="rgba(245,240,232,0.62)" />
            </ChartSection>
          ) : null}

          <LinearWaypointList waypoints={detail.waypoints} currentWaypointId={detail.currentWaypointId} onOpen={(waypoint) => navigation.navigate('WaypointDetail', { courseId: course.id, waypointId: waypoint.id })} />
          <ChartGhostButton label="Manage Course" onPress={openCourse} icon={<MoreHorizontal size={14} color={colors.gold} />} color={colors.gold} />
        </>
      ) : null}

      {isCompleted ? (
        <ChartCard emphasis>
          <ChartKicker>DESTINATION REACHED</ChartKicker><Text style={styles.courseTitle}>{course.destinationText.toUpperCase()}</Text><Text style={styles.body}>Completion is confirmed by the server.</Text>
          {detail ? <CourseMap courseId={course.id} destinationText={course.destinationText} waypoints={detail.waypoints} currentWaypointId={null} reachedCount={course.reachedCount} completed reducedMotion={reducedMotion} orientation="horizontal" onWaypointPress={(waypointId) => navigation.navigate('WaypointDetail', { courseId: course.id, waypointId })} /> : null}
          <ChartButton label="Open completed journey" onPress={() => navigation.navigate('CompletedJourney', { courseId: course.id })} /><ChartButton label="Plot What Comes Next" secondary onPress={() => navigation.navigate('CourseSetup')} disabled={readOnly} />
        </ChartCard>
      ) : null}

      {isArchived ? <ChartCard emphasis><ChartKicker>ARCHIVED JOURNEY</ChartKicker><Text style={styles.courseTitle}>{course.destinationText.toUpperCase()}</Text><Text style={styles.body}>Read-only archived journey.</Text><ChartButton label="Restore Course" onPress={() => void store.restoreCourse(course.id, course.version)} disabled={readOnly} /><ChartButton label="Open Course details" secondary onPress={openCourse} /></ChartCard> : null}

      {course.needsRepair ? <ChartCard emphasis><ChartKicker color="#F0A0A0">REPAIR REQUIRED</ChartKicker><Text style={styles.body}>Chart needs to finish preparing this Course. Nothing was silently selected or repaired on this device.</Text><ChartButton label="Retry and refetch" onPress={retry} disabled={store.refreshing} /></ChartCard> : null}
      {historicalCourses.length > 0 ? <ChartCard><ChartKicker>COMPLETED & ARCHIVED JOURNEYS</ChartKicker>{historicalCourses.map((item) => <ChartGhostButton key={item.id} label={`${item.status === 'COMPLETED' ? 'Completed' : 'Archived'} · ${item.destinationText}`} onPress={() => item.status === 'COMPLETED' ? navigation.navigate('CompletedJourney', { courseId: item.id }) : navigation.navigate('CourseDetails', { courseId: item.id })} />)}</ChartCard> : null}
      {readOnly && !course.needsRepair ? <ReadOnlyNotice reason={offline ? 'You are offline. Cached Chart data is viewable; changes are disabled.' : store.stale ? 'This Chart is stale. Refresh before making a change.' : 'Chart changes are currently read-only.'} /> : null}
      <DestinationAnchor course={course} />
    </ChartScreenFrame>
  );
};

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: 8, marginTop: -2 },
  emptyState: { flex: 1, justifyContent: 'flex-end', paddingBottom: 60, gap: 12 },
  emptyArt: { position: 'absolute', left: -20, right: -20, top: 0, bottom: 0, overflow: 'visible' },
  emptyStarfield: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  emptyGlowSvg: { position: 'absolute', top: 130, alignSelf: 'center' },
  emptyRouteSvg: { position: 'absolute', top: 288, alignSelf: 'center' },
  emptyTitle: { fontFamily: typography.fonts.headingSemiBold, fontSize: 24, lineHeight: 31, letterSpacing: 0.72, color: colors.bone },
  emptyBody: { textAlign: 'center', paddingHorizontal: 34, color: 'rgba(245,240,232,0.62)' },
  body: { fontFamily: typography.fonts.body, fontSize: 13, lineHeight: 20, color: 'rgba(245,240,232,0.68)' },
  buildItButton: { alignSelf: 'center' },
  inlineNotice: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(240,160,160,0.22)', backgroundColor: 'rgba(120,30,30,0.12)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineNoticeText: { flex: 1, fontFamily: typography.fonts.body, fontSize: 12, lineHeight: 17, color: '#F0A0A0' },
  error: { fontFamily: typography.fonts.body, fontSize: 14, lineHeight: 20, color: '#F0A0A0' },
  courseHeaderSection: { gap: 8 },
  courseTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  courseTitle: { flex: 1, fontFamily: typography.fonts.headingSemiBold, fontSize: 19, lineHeight: 27, letterSpacing: 0.5, color: colors.bone },
  courseMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeDestination: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold, shadowColor: colors.gold, shadowOpacity: 0.8, shadowRadius: 7 },
  metaGold: { fontFamily: typography.fonts.body, fontSize: 11.5, color: colors.gold },
  routeSection: { marginHorizontal: -20, gap: 6 },
  progress: { paddingHorizontal: 20, fontFamily: typography.fonts.body, fontSize: 11.5, color: 'rgba(245,240,232,0.38)' },
  currentSection: { paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.18)', gap: 10 },
  currentTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  currentTitle: { fontFamily: typography.fonts.headingSemiBold, fontSize: 24, lineHeight: 31, color: colors.bone },
  currentBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 4 },
  currentBadgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#9B82D4', shadowColor: '#9B82D4', shadowOpacity: 0.8, shadowRadius: 5 },
  currentBadgeText: { fontFamily: typography.fonts.headingSemiBold, fontSize: 9.5, letterSpacing: 1.3, color: '#AD99D2' },
  blockedBadge: { borderColor: 'rgba(255,193,7,0.35)' },
  blockedDot: { backgroundColor: colors.warning },
  blockedText: { color: colors.warning },
  currentDescription: { fontFamily: typography.fonts.body, fontSize: 13, lineHeight: 20, color: 'rgba(245,240,232,0.78)' },
  currentMeta: { fontFamily: typography.fonts.body, fontSize: 10.5, color: 'rgba(245,240,232,0.36)' },
  subKicker: { marginTop: 10 },
  anchorCard: { flexDirection: 'row', alignItems: 'center', minHeight: 96, padding: 10, gap: 10 },
  anchorArt: { width: 82, height: 82, alignItems: 'center', justifyContent: 'center' },
  anchorGlow: { position: 'absolute', width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(62,44,91,0.54)', shadowColor: '#9B82D4', shadowOpacity: 0.28, shadowRadius: 16 },
  anchorRing: { width: 68, height: 68, borderRadius: 34, borderWidth: 1, borderColor: 'rgba(212,175,55,0.34)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(62,44,91,0.24)' },
  anchorImage: { width: 62, height: 62, borderRadius: 31 },
  anchorPlaceholder: { fontFamily: typography.fonts.body, fontSize: 12, color: 'rgba(245,240,232,0.36)' },
  anchorCopy: { flex: 1, gap: 8 },
  anchorQuote: { fontFamily: 'CormorantGaramond-Italic', fontSize: 17, lineHeight: 20, color: colors.bone },
  anchorMeta: { fontFamily: typography.fonts.headingSemiBold, fontSize: 9, letterSpacing: 1.2, color: 'rgba(212,175,55,0.7)' },
  practiceRow: { flexDirection: 'row', gap: 9 },
  practiceMode: { flex: 1, minHeight: 64, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.015)', alignItems: 'center', justifyContent: 'center', gap: 5 },
  practiceModeLabel: { fontFamily: typography.fonts.headingSemiBold, fontSize: 9.5, letterSpacing: 1.1 },
  disabled: { opacity: 0.38 },
  pressed: { transform: [{ scale: 0.98 }] },
  logCard: { padding: 10, gap: 12 },
  logLine: { flexDirection: 'row', gap: 10 },
  logEntryCopy: { flex: 1, gap: 2 },
  logDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(212,175,55,0.42)', marginTop: 4 },
  logMeta: { fontFamily: typography.fonts.headingSemiBold, fontSize: 9, letterSpacing: 1.1, color: 'rgba(245,240,232,0.34)' },
  logQuote: { fontFamily: 'CormorantGaramond-Italic', fontSize: 15, lineHeight: 19, color: 'rgba(245,240,232,0.62)', marginTop: 4 },
  logBody: { fontFamily: typography.fonts.body, fontSize: 11, color: 'rgba(155,130,212,0.8)', marginTop: 3 },
  logEmpty: { fontFamily: typography.fonts.body, fontSize: 12, lineHeight: 18, color: 'rgba(245,240,232,0.42)' },
  logActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  destinationAnchorRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 6, paddingBottom: 20 },
  destinationAnchorText: { flex: 1, fontFamily: typography.fonts.body, fontSize: 11, color: 'rgba(245,240,232,0.42)' },
});

export default ChartHomeScreen;
