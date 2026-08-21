import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCourseStore } from '@/stores/courseStore';
import type { ChartStackParamList, CourseDetail } from '@/types/chart';
import { ChartButton, ChartCard, ChartGhostButton, ChartKicker, ChartScreenFrame, ChartStatusPill, formatDate } from './chartUi';
import { CourseMap } from './components/CourseMap';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

type Navigation = NativeStackNavigationProp<ChartStackParamList, 'CompletedJourney'>;
type JourneyRoute = RouteProp<ChartStackParamList, 'CompletedJourney'>;

function elapsedJourney(plottedAt: string, completedAt: string | null): string | null {
  if (!completedAt) return null;
  const elapsedMs = new Date(completedAt).getTime() - new Date(plottedAt).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  const days = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.max(1, Math.floor(elapsedMs / (60 * 60 * 1000)));
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

export const CompletedJourneyScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<JourneyRoute>();
  const store = useCourseStore();
  const reducedMotion = useReduceMotionEnabled();
  const course = store.activeCourse?.id === route.params.courseId
    ? store.activeCourse
    : store.courses.find((item) => item.id === route.params.courseId) ?? null;
  const detail = course && 'waypoints' in course ? (course as CourseDetail) : null;

  useEffect(() => {
    if (!course || !('waypoints' in course)) void store.fetchCourseDetail(route.params.courseId);
  }, [course, route.params.courseId, store.fetchCourseDetail]);

  if (!course) return <ChartScreenFrame title="Completed journey"><ChartCard><Text style={{ color: '#C0C0C0' }}>Loading the journey…</Text></ChartCard></ChartScreenFrame>;

  const elapsed = elapsedJourney(course.plottedAt, course.completedAt);

  return (
    <ChartScreenFrame title="Completed journey" subtitle="A read-only record of the path you took.">
      <ChartCard emphasis>
        <ChartStatusPill status={course.status} />
        <Text style={{ color: '#F5F5DC', fontFamily: 'Cinzel-SemiBold', fontSize: 25 }}>{course.destinationText}</Text>
        <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15 }}>Reached {course.completedAt ? formatDate(course.completedAt) : 'date unavailable'}.</Text>
        <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15 }}>{course.reachedCount} of {course.waypointCount} waypoints reached.</Text>
        {elapsed ? <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15 }}>Journey time · {elapsed}</Text> : null}
        {course.startingContext ? (
          <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 21 }}>Starting from · {course.startingContext}</Text>
        ) : null}
      </ChartCard>
      {detail ? (
        <CourseMap
          courseId={course.id}
          destinationText={course.destinationText}
          waypoints={detail.waypoints}
          currentWaypointId={null}
          reachedCount={course.reachedCount}
          completed
          reducedMotion={reducedMotion}
          orientation="horizontal"
          onWaypointPress={(waypointId) => navigation.navigate('WaypointDetail', { courseId: course.id, waypointId })}
        />
      ) : null}
      {detail ? detail.waypoints.map((waypoint, index) => (
        <ChartCard key={waypoint.id}>
          <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>WAYPOINT {index + 1}</Text>
          <Text style={{ color: '#F5F5DC', fontFamily: 'Inter-SemiBold', fontSize: 17 }}>{waypoint.title}</Text>
          <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 14 }}>{waypoint.state.replace('_', ' ')}</Text>
          {waypoint.reachedAt ? <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 14 }}>Reached {formatDate(waypoint.reachedAt)}</Text> : null}
          {waypoint.anchorLink ? (
            <>
              <ChartKicker>HISTORICAL ANCHOR</ChartKicker>
              <Text style={{ color: '#F5F5DC', fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20 }}>“{waypoint.anchorLink.snapshot.intentionText}”</Text>
            </>
          ) : null}
        </ChartCard>
      )) : null}
      <ChartGhostButton label="Open Course Log and Practice Evidence" onPress={() => navigation.navigate('CourseLog', { courseId: course.id })} color="#D4AF37" />
      <ChartButton label="Plot What Comes Next" onPress={() => navigation.navigate('CourseSetup')} disabled={store.readOnly} />
    </ChartScreenFrame>
  );
};

export default CompletedJourneyScreen;
