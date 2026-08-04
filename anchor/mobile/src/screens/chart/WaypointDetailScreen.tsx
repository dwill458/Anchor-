import React, { useEffect, useRef, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCourseStore } from '@/stores/courseStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { usePracticeEntry } from '@/hooks/usePracticeEntry';
import { AnalyticsEvents, trackChartEventOnce } from '@/services/AnalyticsService';
import { resolveChartFeatureFlags } from '@/types/chart';
import { AnchorSelectorSheet } from '@/screens/practice/components/AnchorSelectorSheet';
import type { Anchor } from '@/types';
import type { ChartStackParamList } from '@/types/chart';
import { ChartButton, ChartCard, ChartScreenFrame, ChartStatusPill, ReadOnlyNotice } from './chartUi';

type Navigation = NativeStackNavigationProp<ChartStackParamList, 'WaypointDetail'>;
type WaypointRoute = RouteProp<ChartStackParamList, 'WaypointDetail'>;

function linkKey(): string {
  return `chart-waypoint-link-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const WaypointDetailScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<WaypointRoute>();
  const store = useCourseStore();
  const activeAnchors = useAnchorStore((state) => state.getActiveAnchors());
  const subscriptionStatus = useAuthStore((state) => state.user?.subscriptionStatus ?? 'free');
  const { navigateToVault } = useTabNavigation();
  const { startPractice, isNavigationLocked } = usePracticeEntry();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const course = store.activeCourse?.id === route.params.courseId ? store.activeCourse : null;
  const waypoint = course?.waypoints.find((item) => item.id === route.params.waypointId);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const requestKey = useRef(linkKey()).current;
  const completionKey = useRef(linkKey()).current;
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!course) void store.fetchCourseDetail(route.params.courseId);
  }, [course, route.params.courseId, store.fetchCourseDetail]);

  useEffect(() => {
    if (course && !waypoint) navigation.replace('ChartHome');
    if (!course && store.errorCode === 'COURSE_NOT_FOUND') navigation.replace('ChartHome');
  }, [course, navigation, store.errorCode, waypoint]);

  useEffect(() => {
    if (!accountId || !course || !waypoint) return;
    trackChartEventOnce(AnalyticsEvents.WAYPOINT_VIEWED, accountId, route.key, {
      course_state: course.status,
      waypoint_state: waypoint.state,
      waypoint_position: waypoint.position,
    });
  }, [accountId, course, route.key, waypoint]);

  if (!course || !waypoint) {
    return <ChartScreenFrame title="Waypoint" subtitle="Loading the latest waypoint…"><ChartCard><Text style={{ color: '#C0C0C0' }}>The waypoint is being verified.</Text></ChartCard></ChartScreenFrame>;
  }

  const selectAnchor = async (anchor: Anchor, acknowledgedReuse = false) => {
    trackChartEventOnce(AnalyticsEvents.WAYPOINT_ANCHOR_ACTION_SELECTED, accountId, `${route.key}:${anchor.id}`, {
      entry_source: acknowledgedReuse ? 'reuse_confirmed' : 'waypoint_detail',
      waypoint_state: waypoint?.state,
    });
    const existing = [course.destinationAnchorLink, ...course.waypoints.map((item) => item.anchorLink)]
      .find((link) => link?.anchorId === anchor.id && link.id !== waypoint.anchorLink?.id);
    if (existing && !acknowledgedReuse) {
      Alert.alert(
        'Anchor already linked',
        `This Anchor is already linked to ${existing.snapshot.intentionText}. Reusing it means both waypoints strengthen the same thread.`,
        [
          { text: 'Choose another', style: 'cancel' },
          { text: 'Reuse Anchor', onPress: () => void selectAnchor(anchor, true) },
        ],
      );
      return;
    }
    const result = await store.linkAnchor(route.params.courseId, {
      idempotencyKey: requestKey,
      expectedCourseVersion: course.version,
      anchorId: anchor.id,
      role: 'WAYPOINT_PRIMARY',
      waypointId: waypoint.id,
      ...(waypoint.anchorLink ? { replaceLinkId: waypoint.anchorLink.id } : {}),
      ...(acknowledgedReuse ? { acknowledgedReuse: true } : {}),
    });
    setSelectorVisible(false);
    if (!result) return;
  };

  const complete = async () => {
    if (!accountId || completing || waypoint.state !== 'CURRENT') return;
    trackChartEventOnce(AnalyticsEvents.WAYPOINT_COMPLETION_STARTED, accountId, completionKey, {
      course_state: course.status,
      waypoint_state: waypoint.state,
    });
    setCompleting(true);
    const result = await store.completeWaypoint(course.id, waypoint.id, {
      idempotencyKey: completionKey,
      expectedCourseVersion: course.version,
    });
    setCompleting(false);
    if (!result) return;
    trackChartEventOnce(AnalyticsEvents.WAYPOINT_COMPLETED, accountId, result.completionEventId, {
      course_state: result.course.status,
      waypoint_state: 'REACHED',
      server_confirmed: true,
    });
    if (result.courseCompleted) {
      trackChartEventOnce(AnalyticsEvents.COURSE_COMPLETED, accountId, result.course.id, {
        course_state: 'COMPLETED',
        waypoint_count: result.course.waypointCount,
        server_confirmed: true,
      });
      navigation.replace('CourseCompletion', { courseId: course.id });
      return;
    }
    navigation.replace('ChartHome');
  };

  const isBlocked = waypoint.state === 'BLOCKED';
  const launchWaypointPractice = async () => {
    if (!accountId || !resolveChartFeatureFlags(useAuthStore.getState().user?.chartFlags).chart_enabled) {
      Alert.alert('Practice unavailable', 'Chart practice is not available right now.');
      return;
    }
    // Re-fetch before crossing the practice boundary. Course state—not a
    // stale screen—is authoritative for current waypoint and live link checks.
    const fresh = await store.fetchCourseDetail(course.id);
    const freshWaypoint = fresh?.waypoints.find((item) => item.id === waypoint.id);
    const linkedAnchorId = freshWaypoint?.anchorLink?.anchorId;
    const linkedAnchor = linkedAnchorId
      ? activeAnchors.find((item) => item.id === linkedAnchorId)
      : undefined;
    if (
      !fresh ||
      fresh.currentWaypointId !== waypoint.id ||
      freshWaypoint?.state !== 'CURRENT' ||
      !linkedAnchor ||
      linkedAnchor.isReleased ||
      linkedAnchor.archivedAt ||
      linkedAnchor.userId !== accountId
    ) {
      Alert.alert('Practice unavailable', 'This waypoint or its linked Anchor changed. Refresh the Chart and try again.');
      return;
    }
    const started = startPractice({
      mode: 'focus',
      anchorId: linkedAnchor.id,
      source: 'chart_waypoint_detail',
      chartContext: {
        courseId: fresh.id,
        waypointId: freshWaypoint.id,
        practiceEntrySource: 'chart_waypoint_detail',
        accountId,
      },
    });
    if (started) {
      trackChartEventOnce(AnalyticsEvents.CHART_PRACTICE_STARTED, accountId, `${fresh.id}:${freshWaypoint.id}`, {
        entry_source: 'waypoint_detail',
        practice_mode: 'focus',
        course_state: fresh.status,
        waypoint_state: freshWaypoint.state,
      });
    }
  };
  return (
    <>
      <ChartScreenFrame title="Waypoint detail" subtitle={`Position ${waypoint.position}`}>
        <ChartCard emphasis>
          <ChartStatusPill status={waypoint.state} />
          <Text style={{ color: '#F5F5DC', fontFamily: 'Cinzel-SemiBold', fontSize: 27 }}>{waypoint.title}</Text>
          {waypoint.description ? <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22 }}>{waypoint.description}</Text> : null}
        </ChartCard>
        <ChartCard>
          <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>LINKED ANCHOR</Text>
          <Text style={{ color: '#F5F5DC', fontFamily: 'Inter-Regular', fontSize: 15 }}>{waypoint.anchorLink?.snapshot.intentionText ?? 'No Anchor linked'}</Text>
          {isBlocked ? <Text style={{ color: '#FFB1B1', fontFamily: 'Inter-Regular', fontSize: 14 }}>Blocked because the linked Anchor is unavailable.</Text> : null}
          {waypoint.state === 'CURRENT' && waypoint.anchorLink?.anchorAvailable ? (
            <ChartButton label="Practice with this Anchor" onPress={() => void launchWaypointPractice()} disabled={isNavigationLocked || store.loading} />
          ) : null}
          {waypoint.state === 'CURRENT' ? (
            <ChartButton label={completing ? 'Completing…' : 'Mark waypoint complete'} secondary onPress={() => void complete()} disabled={completing || store.readOnly || isBlocked} />
          ) : null}
          <ChartButton label="Link an Existing Anchor" onPress={() => setSelectorVisible(true)} disabled={store.readOnly} />
          {subscriptionStatus === 'free' ? (
            <ChartButton label="Create a New Anchor" secondary onPress={() => Alert.alert('Anchor creation unavailable', 'Link an existing Anchor first, or upgrade to create a new one.')} />
          ) : (
            <ChartButton label="Create a New Anchor" secondary onPress={() => navigateToVault('CreateAnchor')} />
          )}
        </ChartCard>
        <ChartButton label="Course Log" secondary onPress={() => navigation.navigate('CourseLog', { courseId: course.id, waypointId: waypoint.id })} />
        {store.readOnly ? <ReadOnlyNotice reason={store.offline ? 'You are offline. Anchor links are disabled.' : 'Anchor links are currently read-only.'} /> : null}
      </ChartScreenFrame>
      <AnchorSelectorSheet visible={selectorVisible} anchors={activeAnchors} onSelect={(anchor) => void selectAnchor(anchor)} onClose={() => setSelectorVisible(false)} />
    </>
  );
};

export default WaypointDetailScreen;
