import React, { useCallback, useEffect, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpRight, BookOpen, ChevronDown, CircleAlert, Eye, Link2, MoreHorizontal, RefreshCw, Sparkles, Zap } from 'lucide-react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { startReflectionQueueSync } from '@/services/ReflectionService';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import type { ChartStackParamList, CourseDetail, CourseSummary } from '@/types/chart';
import { CourseMap } from './components/CourseMap';
import {
  ChartButton,
  ChartCard,
  ChartScreenFrame,
  ChartStatusPill,
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
    case 'FEATURE_DISABLED':
      return 'Chart is currently read-only.';
    case 'MIGRATION_REQUIRED':
      return 'Chart needs to finish preparing your account.';
    case 'COURSE_VERSION_CONFLICT':
      return 'This Course changed elsewhere. Your view has been refreshed.';
    case 'COURSE_NOT_FOUND':
      return 'That Course is no longer available.';
    case 'NETWORK':
      return 'Chart could not refresh. Cached data remains available.';
    default:
      return 'Chart could not refresh. Try again.';
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
  <View>
    <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 12 }}>Destination Anchor</Text>
    <Text style={{ color: '#F5F5DC', fontFamily: 'Inter-SemiBold', fontSize: 15, marginTop: 4 }}>
      {course.destinationAnchorLink?.snapshot.intentionText ?? 'No Anchor linked yet'}
    </Text>
  </View>
);

export const ChartHomeScreen: React.FC = () => {
  const navigation = useNavigation<ChartNavigation>();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const serverFlags = useAuthStore((state) => state.user?.chartFlags);
  const authOffline = useAuthStore((state) => state.isOfflineMode);
  const { registerTabNav } = useTabNavigation();
  const store = useCourseStore();
  const reducedMotion = useReduceMotionEnabled();

  useEffect(() => {
    if (!accountId) return;
    store.setFeatureFlags(serverFlags);
    store.bindAccount(accountId);
    void store.hydrateAndRefresh(accountId);
  }, [accountId, serverFlags, store.bindAccount, store.hydrateAndRefresh, store.setFeatureFlags]);

  useEffect(() => {
    // ChartHome is the stack root, so its navigation object is the correct
    // target for cross-tab pushes and deep links.
    registerTabNav(2, navigation);
    return () => registerTabNav(2, null);
  }, [navigation, registerTabNav]);

  const course = useMemo<CourseDetail | CourseSummary | null>(() => {
    if (store.activeCourse) return store.activeCourse;
    return (
      store.courses.find((item) => item.status === 'DRAFT') ??
      store.courses.find((item) => item.status === 'ACTIVE') ??
      null
    );
  }, [store.activeCourse, store.courses]);
  const hasCache = Boolean(course || store.courses.length);
  const historicalCourses = store.courses.filter((item) => item.status === 'COMPLETED' || item.status === 'ARCHIVED');
  const offline = authOffline || store.offline;
  const disabledReason = offline
    ? 'You are offline. Cached Chart data is available, but changes are disabled.'
    : !store.flags.chart_write_enabled
      ? 'Chart is readable while editing is disabled.'
      : undefined;

  const retry = useCallback(() => {
    if (accountId) void store.hydrateAndRefresh(accountId);
  }, [accountId, store.hydrateAndRefresh]);

  if (!accountId || !store.flags.chart_enabled) {
    return (
      <ChartScreenFrame title="Chart" subtitle="Where am I going?">
        <ChartCard>
          <Text style={{ color: '#F5F5DC', fontFamily: 'Inter-SemiBold', fontSize: 18 }}>Chart is unavailable</Text>
          <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22 }}>
            Chart will appear here when it is enabled for your account.
          </Text>
        </ChartCard>
      </ChartScreenFrame>
    );
  }

  if (store.migrationRequired) {
    return (
      <ChartScreenFrame title="Chart" subtitle="Where am I going?">
        <ChartCard emphasis>
          <Text style={{ color: '#F5F5DC', fontFamily: 'Cinzel-SemiBold', fontSize: 22 }}>Chart isn’t ready yet.</Text>
          <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22 }}>
            Your account needs one more preparation step before Courses can open.
          </Text>
          <ChartButton label="Tap to retry" onPress={retry} disabled={store.refreshing} />
        </ChartCard>
      </ChartScreenFrame>
    );
  }

  if ((store.loading || store.initializationStatus === 'hydrating') && !hasCache) {
    return (
      <ChartScreenFrame title="Chart" subtitle="Where am I going?">
        <LoadingSpinner message="Loading Chart" />
      </ChartScreenFrame>
    );
  }

  if (!course && !hasCache && store.errorCode) {
    return (
      <ChartScreenFrame title="Chart" subtitle="Where am I going?">
        <ChartCard emphasis>
          <Text accessibilityLiveRegion="assertive" style={{ color: '#FFB1B1', fontFamily: 'Inter-SemiBold', fontSize: 17 }}>
            {errorCopy(store.errorCode)}
          </Text>
          <ChartButton label="Retry" onPress={retry} />
        </ChartCard>
      </ChartScreenFrame>
    );
  }

  if (!course) {
    return (
      <ChartScreenFrame title="Chart" subtitle="Where am I going?">
        <ChartCard emphasis>
          <Text style={{ color: '#F5F5DC', fontFamily: 'Cinzel-SemiBold', fontSize: 28 }}>Plot Your Course</Text>
          <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 16, lineHeight: 24 }}>
            Define where you are going, then give the next meaningful step a place to begin.
          </Text>
          <ChartButton label="Plot Your Course" onPress={() => navigation.navigate('CourseSetup')} />
          {store.flags.chart_ai_planner_enabled ? (
            <Text style={{ color: '#9E9E9E', fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 18 }}>
              AI planning is available from the setup flow when a proposal is ready.
            </Text>
          ) : null}
        </ChartCard>
        {historicalCourses.length > 0 ? (
          <ChartCard>
            <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>COMPLETED & ARCHIVED JOURNEYS</Text>
            {historicalCourses.map((item) => (
              <ChartButton
                key={item.id}
                label={`${item.status === 'COMPLETED' ? 'Completed' : 'Archived'} · ${item.destinationText}`}
                secondary
                onPress={() => {
                  if (item.status === 'COMPLETED') {
                    navigation.navigate('CompletedJourney', { courseId: item.id });
                  } else {
                    navigation.navigate('CourseDetails', { courseId: item.id });
                  }
                }}
              />
            ))}
          </ChartCard>
        ) : null}
        {disabledReason ? <ReadOnlyNotice reason={disabledReason} /> : null}
      </ChartScreenFrame>
    );
  }

  const detail = 'waypoints' in course ? course : null;
  const needsRepair = course.needsRepair === true;
  const isDraft = course.status === 'DRAFT';
  const isActive = course.status === 'ACTIVE';
  const isCompleted = course.status === 'COMPLETED';
  const isArchived = course.status === 'ARCHIVED';
  const currentWaypoint = detail?.waypoints.find((waypoint) => waypoint.id === detail.currentWaypointId);

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
          <ChartStatusPill status="DRAFT" />
          <Text style={{ color: '#F5F5DC', fontFamily: 'Cinzel-SemiBold', fontSize: 25 }}>{course.destinationText}</Text>
          <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15 }}>{course.waypointCount} waypoint{course.waypointCount === 1 ? '' : 's'} plotted</Text>
          <ChartButton label="Continue editing" onPress={() => navigation.navigate('CourseEditor', { courseId: course.id })} />
          <ChartButton label="Publish Course" secondary onPress={() => void store.publishCourse(course.id, course.version)} disabled={store.readOnly || course.waypointCount === 0} hint={store.readOnly ? disabledReason : undefined} />
        </ChartCard>
      ) : null}
      {isActive ? (
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
              <ChartCard>
                <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>PRACTICE</Text>
                <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22 }}>Practice actions will connect here when that flow lands.</Text>
              </ChartCard>
              <ChartCard>
                <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>COURSE PROGRESS</Text>
                <Text style={{ color: '#F5F5DC', fontFamily: 'Inter-SemiBold', fontSize: 20 }}>{course.reachedCount} of {course.waypointCount} reached</Text>
                <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15 }}>Destination: {course.destinationText}</Text>
              </ChartCard>
              <ChartCard>
                <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>ROUTE MAP</Text>
                <CourseMap
                  courseId={course.id}
                  destinationText={course.destinationText}
                  waypoints={detail.waypoints}
                  currentWaypointId={detail.currentWaypointId}
                  reachedCount={course.reachedCount}
                  completed={false}
                  reducedMotion={reducedMotion}
                  onWaypointPress={(waypointId) => navigation.navigate('WaypointDetail', { courseId: course.id, waypointId })}
                />
                <Text style={{ color: '#9E9E9E', fontFamily: 'Inter-Regular', fontSize: 12 }}>The linear list below is the comprehension surface.</Text>
              </ChartCard>
              <ChartCard>
                <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>COURSE LOG</Text>
                <Text style={{ color: '#9E9E9E', fontFamily: 'Inter-Regular', fontSize: 14 }}>Course Log will appear here when its workstream lands.</Text>
                <ChartButton label="Open Course Log" secondary onPress={() => navigation.navigate('CourseLog', { courseId: course.id })} />
              </ChartCard>
              <ChartCard>
                <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>COURSE OBSERVATION</Text>
                <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 14 }}>{course.observations?.[0]?.text ?? 'Observations will appear as the Course gathers history.'}</Text>
              </ChartCard>
              <LinearWaypointList
                waypoints={detail.waypoints}
                currentWaypointId={detail.currentWaypointId}
                onOpen={(waypoint) => navigation.navigate('WaypointDetail', { courseId: course.id, waypointId: waypoint.id })}
              />
              <ChartButton label="Manage Course" secondary onPress={() => navigation.navigate('CourseDetails', { courseId: course.id })} />
            </>
          ) : null}
        </>
      ) : null}
      {isCompleted ? (
        <ChartCard emphasis>
          <ChartStatusPill status="COMPLETED" />
          <Text style={{ color: '#F5F5DC', fontFamily: 'Cinzel-SemiBold', fontSize: 25 }}>Destination reached</Text>
          <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15 }}>Completed {course.completedAt ? formatDate(course.completedAt) : 'date unavailable'}.</Text>
          <ChartButton label="Open completed journey" onPress={() => navigation.navigate('CompletedJourney', { courseId: course.id })} />
          <ChartButton label="Plot What Comes Next" secondary onPress={() => navigation.navigate('CourseSetup')} disabled={store.readOnly} hint={disabledReason} />
        </ChartCard>
      ) : null}
      {isArchived ? (
        <ChartCard emphasis>
          <ChartStatusPill status="ARCHIVED" />
          <Text style={{ color: '#F5F5DC', fontFamily: 'Cinzel-SemiBold', fontSize: 25 }}>{course.destinationText}</Text>
          <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15 }}>Read-only archived journey.</Text>
          <ChartButton label="Restore Course" onPress={() => void store.restoreCourse(course.id, course.version)} disabled={store.readOnly} hint={disabledReason} />
          <ChartButton label="Open Course details" secondary onPress={() => navigation.navigate('CourseDetails', { courseId: course.id })} />
        </ChartCard>
      ) : null}
      {!isDraft && !isActive && !isCompleted && !isArchived ? null : null}
      {historicalCourses.length > 0 ? (
        <ChartCard>
          <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>COMPLETED & ARCHIVED JOURNEYS</Text>
          {historicalCourses.map((item) => (
              <ChartButton
                key={item.id}
                label={`${item.status === 'COMPLETED' ? 'Completed' : 'Archived'} · ${item.destinationText}`}
                secondary
                onPress={() => {
                  if (item.status === 'COMPLETED') {
                    navigation.navigate('CompletedJourney', { courseId: item.id });
                  } else {
                    navigation.navigate('CourseDetails', { courseId: item.id });
                  }
                }}
              />
            ))}
        </ChartCard>
      ) : null}
      {disabledReason && !needsRepair ? <ReadOnlyNotice reason={disabledReason} /> : null}
      <ChartCard>
        <DestinationAnchor course={course} />
      </ChartCard>
    </ChartScreenFrame>
  );
};

export default ChartHomeScreen;
