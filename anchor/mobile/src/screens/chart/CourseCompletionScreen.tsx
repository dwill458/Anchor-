import React, { useEffect } from 'react';
import { BackHandler, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCourseStore } from '@/stores/courseStore';
import type { ChartStackParamList } from '@/types/chart';
import { ChartButton, ChartCard, ChartScreenFrame } from './chartUi';

type Navigation = NativeStackNavigationProp<ChartStackParamList, 'CourseCompletion'>;
type CompletionRoute = RouteProp<ChartStackParamList, 'CourseCompletion'>;

export const CourseCompletionScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<CompletionRoute>();
  const store = useCourseStore();
  const course = store.activeCourse?.id === route.params.courseId ? store.activeCourse : null;
  const allowLeaveRef = React.useRef(false);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (!allowLeaveRef.current) event.preventDefault();
  }), [navigation]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (course && course.status !== 'COMPLETED') {
      allowLeaveRef.current = true;
      navigation.replace('ChartHome');
    }
    if (!course) void store.fetchCourseDetail(route.params.courseId);
  }, [course, navigation, route.params.courseId, store.fetchCourseDetail]);

  if (!course || course.status !== 'COMPLETED') {
    return <ChartScreenFrame title="Course complete"><ChartCard><Text style={{ color: '#C0C0C0' }}>Verifying the Course state…</Text></ChartCard></ChartScreenFrame>;
  }

  return (
    <ChartScreenFrame title="Course complete" subtitle="Completion is confirmed by the server.">
      <ChartCard emphasis>
        <Text style={{ color: '#F5F5DC', fontFamily: 'Cinzel-SemiBold', fontSize: 30 }}>You reached your destination.</Text>
        <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22 }}>{course.destinationText}</Text>
      </ChartCard>
      <ChartButton label="View Your Journey" onPress={() => {
        allowLeaveRef.current = true;
        navigation.replace('CompletedJourney', { courseId: course.id });
      }} />
      <ChartButton label="Add Reflection" secondary disabled={!store.flags.chart_reflections_enabled} onPress={() => navigation.navigate('ReflectionComposer', { source: 'COURSE_COMPLETION', promptType: 'FINAL_REFLECTION', promptVersion: 1, courseId: course.id, draftKey: `course:${course.id}:completion` })} />
      <ChartButton label="Plot What Comes Next" secondary onPress={() => {
        allowLeaveRef.current = true;
        navigation.replace('CourseSetup');
      }} />
    </ChartScreenFrame>
  );
};

export default CourseCompletionScreen;
