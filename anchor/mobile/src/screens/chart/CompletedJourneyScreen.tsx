import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCourseStore } from '@/stores/courseStore';
import type { ChartStackParamList, CourseDetail } from '@/types/chart';
import { ChartButton, ChartCard, ChartScreenFrame, ChartStatusPill, formatDate } from './chartUi';

type Navigation = NativeStackNavigationProp<ChartStackParamList, 'CompletedJourney'>;
type JourneyRoute = RouteProp<ChartStackParamList, 'CompletedJourney'>;

export const CompletedJourneyScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<JourneyRoute>();
  const store = useCourseStore();
  const course = store.activeCourse?.id === route.params.courseId
    ? store.activeCourse
    : store.courses.find((item) => item.id === route.params.courseId) ?? null;
  const detail = course && 'waypoints' in course ? (course as CourseDetail) : null;

  useEffect(() => {
    if (!course || !('waypoints' in course)) void store.fetchCourseDetail(route.params.courseId);
  }, [course, route.params.courseId, store.fetchCourseDetail]);

  if (!course) return <ChartScreenFrame title="Completed journey"><ChartCard><Text style={{ color: '#C0C0C0' }}>Loading the journey…</Text></ChartCard></ChartScreenFrame>;

  return (
    <ChartScreenFrame title="Completed journey" subtitle="A read-only record of the path you took.">
      <ChartCard emphasis>
        <ChartStatusPill status={course.status} />
        <Text style={{ color: '#F5F5DC', fontFamily: 'Cinzel-SemiBold', fontSize: 25 }}>{course.destinationText}</Text>
        <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15 }}>Reached {course.completedAt ? formatDate(course.completedAt) : 'date unavailable'}.</Text>
        <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15 }}>{course.reachedCount} of {course.waypointCount} waypoints reached.</Text>
      </ChartCard>
      {detail ? detail.waypoints.map((waypoint, index) => (
        <ChartCard key={waypoint.id}>
          <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>WAYPOINT {index + 1}</Text>
          <Text style={{ color: '#F5F5DC', fontFamily: 'Inter-SemiBold', fontSize: 17 }}>{waypoint.title}</Text>
          <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 14 }}>{waypoint.state.replace('_', ' ')}</Text>
        </ChartCard>
      )) : null}
      <ChartButton label="Plot What Comes Next" onPress={() => navigation.navigate('CourseSetup')} disabled={store.readOnly} />
    </ChartScreenFrame>
  );
};

export default CompletedJourneyScreen;
