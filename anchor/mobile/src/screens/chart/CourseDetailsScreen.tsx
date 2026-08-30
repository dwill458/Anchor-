import React, { useEffect } from 'react';
import { Alert, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCourseStore } from '@/stores/courseStore';
import { useToast } from '@/components/ToastProvider';
import type { ChartStackParamList } from '@/types/chart';
import { ChartButton, ChartCard, ChartScreenFrame, ChartStatusPill, ReadOnlyNotice, formatDate } from './chartUi';

type Navigation = NativeStackNavigationProp<ChartStackParamList, 'CourseDetails'>;
type DetailsRoute = RouteProp<ChartStackParamList, 'CourseDetails'>;

export const CourseDetailsScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<DetailsRoute>();
  const store = useCourseStore();
  const { error: showError } = useToast();
  const course = store.activeCourse?.id === route.params.courseId
    ? store.activeCourse
    : store.courses.find((item) => item.id === route.params.courseId) ?? null;

  useEffect(() => {
    if (!course || !('waypoints' in course)) void store.fetchCourseDetail(route.params.courseId);
  }, [course, route.params.courseId, store.fetchCourseDetail]);

  useEffect(() => {
    if (store.errorCode === 'COURSE_NOT_FOUND') {
      showError("That course isn’t available.");
      navigation.replace('ChartHome');
    }
  }, [navigation, showError, store.errorCode]);

  if (!course) {
    return <ChartScreenFrame title="Course details"><ChartCard><Text style={{ color: '#C0C0C0' }}>Loading the Course…</Text></ChartCard></ChartScreenFrame>;
  }

  const archive = () => {
    Alert.alert('Archive Course?', 'This keeps the journey in Completed & Archived Journeys and makes it read-only.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', onPress: () => void store.archiveCourse(course.id, course.version) },
    ]);
  };
  const restore = () => {
    void store.restoreCourse(course.id, course.version);
  };
  const remove = () => {
    Alert.alert('Delete Course?', 'This Course will be recoverable for 30 days through the server. It will not be permanently deleted from this device.', [
      { text: 'Keep Course', style: 'cancel' },
      { text: 'Delete Course', style: 'destructive', onPress: async () => {
        const deleted = await store.deleteCourse(course.id, course.version);
        if (deleted) navigation.navigate('ChartHome');
      } },
    ]);
  };

  return (
    <ChartScreenFrame title="Course details" subtitle="Manage the authoritative Course record.">
      <ChartCard emphasis>
        <ChartStatusPill status={course.status} />
        <Text style={{ color: '#F5F5DC', fontFamily: 'Cinzel-SemiBold', fontSize: 25 }}>{course.destinationText}</Text>
        <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 14 }}>Plotted {formatDate(course.plottedAt)}</Text>
        <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 14 }}>{course.waypointCount} waypoints · {course.reachedCount} reached</Text>
        <Text style={{ color: '#F5F5DC', fontFamily: 'Inter-Regular', fontSize: 15 }}>{course.destinationAnchorLink?.snapshot.intentionText ?? 'No destination Anchor linked'}</Text>
      </ChartCard>
      {course.status === 'ACTIVE' || course.status === 'DRAFT' ? (
        <ChartButton label="Edit Course" onPress={() => navigation.navigate('CourseEditor', { courseId: course.id })} />
      ) : null}
      <ChartButton label="Add Reflection" secondary disabled={!store.flags.chart_reflections_enabled} onPress={() => navigation.navigate('ReflectionComposer', { source: 'MANUAL_COURSE', promptType: 'COURSE_STATUS', promptVersion: 1, courseId: course.id, draftKey: `course:${course.id}:manual` })} />
      {course.status !== 'ARCHIVED' ? <ChartButton label="Archive Course" secondary onPress={archive} disabled={store.readOnly} /> : null}
      {course.status === 'ARCHIVED' ? <ChartButton label="Restore Course" onPress={restore} disabled={store.readOnly} /> : null}
      <ChartButton label="Delete Course" destructive secondary onPress={remove} disabled={store.readOnly} />
      <ChartButton label="Completed & Archived Journeys" secondary onPress={() => navigation.navigate('ChartHome')} />
      {store.errorCode ? <Text accessibilityLiveRegion="assertive" style={{ color: '#FFB1B1', fontFamily: 'Inter-Regular', fontSize: 14 }}>The requested Course action could not be completed.</Text> : null}
      {store.readOnly ? <ReadOnlyNotice reason={store.offline ? 'You are offline. Course mutations are disabled.' : 'This Course is currently read-only.'} /> : null}
    </ChartScreenFrame>
  );
};

export default CourseDetailsScreen;
