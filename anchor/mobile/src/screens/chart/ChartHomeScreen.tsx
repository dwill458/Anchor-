import React, { useCallback, useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { canViewChart } from '@/types/chart';
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
  const chartCapabilities = useAuthStore((state) => state.user?.chartCapabilities);
  const authOffline = useAuthStore((state) => state.isOfflineMode);
  const { registerTabNav } = useTabNavigation();
  const store = useCourseStore();
  const reducedMotion = useReduceMotionEnabled();

  useEffect(() => {
    if (!accountId || !canViewChart(serverFlags, chartCapabilities)) return;
    store.setFeatureFlags(serverFlags);
    store.bindAccount(accountId);
    void store.hydrateAndRefresh(accountId);
  }, [accountId, serverFlags, chartCapabilities, store.bindAccount, store.hydrateAndRefresh, store.setFeatureFlags]);

  useEffect(() => startReflectionQueueSync(), []);

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
    <ChartScreenFrame title="Chart" subtitle="Where am I going?">
      {store.errorCode ? (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,110,110,0.12)' }} accessibilityLiveRegion="assertive">
          <Text style={{ color: '#FFB1B1', fontFamily: 'Inter-Regular', fontSize: 13 }}>{errorCopy(store.errorCode)}</Text>
        </View>
      ) : null}
      <ChartSyncNotice lastSyncedAt={store.lastSyncedAt} offline={offline} onRetry={retry} />
      {needsRepair ? (
        <ChartCard emphasis>
          <Text style={{ color: '#FFB1B1', fontFamily: 'Inter-SemiBold', fontSize: 18 }}>Chart needs attention</Text>
          <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22 }}>
            This Course has a structural issue on the server. Nothing was silently selected or repaired on this device.
          </Text>
          <ChartButton label="Retry and refetch" onPress={retry} disabled={store.refreshing} />
        </ChartCard>
      ) : null}
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
          <ChartCard emphasis>
            <Text style={{ color: '#9E9E9E', fontFamily: 'Inter-Regular', fontSize: 12, letterSpacing: 1 }}>CURRENT WAYPOINT</Text>
            <Text style={{ color: '#F5F5DC', fontFamily: 'Cinzel-SemiBold', fontSize: 29 }}>{currentWaypoint?.title ?? 'Awaiting the next step'}</Text>
            <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22 }}>
              {currentWaypoint?.state === 'BLOCKED'
                ? 'Blocked — the linked Anchor is unavailable.'
                : 'What must become true next?'}
            </Text>
            {currentWaypoint ? (
              <ChartButton label="Open current waypoint" onPress={() => navigation.navigate('WaypointDetail', { courseId: course.id, waypointId: currentWaypoint.id })} />
            ) : null}
          </ChartCard>
          {detail ? (
            <>
              <ChartCard>
                <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>WAYPOINT ANCHOR</Text>
                <Text style={{ color: '#F5F5DC', fontFamily: 'Inter-Regular', fontSize: 15 }}>
                  {currentWaypoint?.anchorLink?.snapshot.intentionText ?? 'No Anchor linked'}
                </Text>
                {currentWaypoint?.state === 'BLOCKED' ? (
                  <ChartButton label="Link an Existing Anchor" secondary onPress={() => navigation.navigate('WaypointDetail', { courseId: course.id, waypointId: currentWaypoint.id })} disabled={store.readOnly} hint={disabledReason} />
                ) : null}
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
