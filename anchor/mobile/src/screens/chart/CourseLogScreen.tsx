import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useAuthStore } from '@/stores/authStore';
import { useCourseLogStore } from '@/stores/courseLogStore';
import type { ChartStackParamList, CourseLogEntry } from '@/types/chart';
import { ChartButton, ChartCard, ChartScreenFrame, formatDate } from './chartUi';
import { colors, spacing, typography } from '@/theme';

type Nav = NativeStackNavigationProp<ChartStackParamList, 'CourseLog'>;
type Route = RouteProp<ChartStackParamList, 'CourseLog'>;

const EVENT_COPY: Record<CourseLogEntry['eventType'], string> = {
  COURSE_CREATED: 'Course created.', DESTINATION_CHANGED: 'Destination updated.', WAYPOINT_ADDED: 'Waypoint added.', WAYPOINT_REORDERED: 'Waypoints reordered.', DESTINATION_ANCHOR_LINKED: 'Destination Anchor linked.', WAYPOINT_ANCHOR_LINKED: 'Waypoint Anchor linked.', PRACTICE_COMPLETED: 'Practice completed.', REFLECTION_ADDED: 'Reflection added', WAYPOINT_REACHED: 'Waypoint reached.', WAYPOINT_SKIPPED: 'Waypoint skipped.', WAYPOINT_CANCELLED: 'Waypoint removed from the course.', WAYPOINT_BLOCKED: 'Waypoint needs a new Anchor.', WAYPOINT_UNBLOCKED: 'Waypoint is available again.', COURSE_COMPLETED: 'Destination reached.', COURSE_ARCHIVED: 'Course archived.', COURSE_RESTORED: 'Course restored.',
};

function eventCopy(entry: CourseLogEntry): string {
  const title = typeof entry.snapshot?.waypointTitle === 'string' ? entry.snapshot.waypointTitle : null;
  if (title && entry.eventType === 'WAYPOINT_REACHED') return `${title} reached.`;
  if (title && entry.eventType === 'WAYPOINT_SKIPPED') return `${title} skipped.`;
  if (title && entry.eventType === 'WAYPOINT_BLOCKED') return `${title} needs a new Anchor.`;
  if (entry.eventType === 'PRACTICE_COMPLETED' && entry.practiceSession) return `Completed a ${entry.practiceSession.practiceMode} practice.`;
  return EVENT_COPY[entry.eventType];
}

export const CourseLogScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const store = useCourseLogStore();
  useEffect(() => { void store.bind(accountId, route.params.courseId); }, [accountId, route.params.courseId]);
  const entries = useMemo(() => route.params.waypointId ? store.entries.filter((entry) => entry.waypointId === route.params.waypointId) : store.entries, [route.params.waypointId, store.entries]);
  return (
    <ChartScreenFrame title="Course Log" subtitle="A private, chronological record of this course." scroll={false}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={store.refreshing} onRefresh={() => void store.refresh()} tintColor={colors.gold} />}
        onEndReached={() => void store.loadMore()}
        onEndReachedThreshold={0.35}
        accessibilityLabel="Course Log, chronological entries"
        ListEmptyComponent={store.loading ? <ActivityIndicator color={colors.gold} /> : <ChartCard><Text style={styles.muted}>There are no entries to show yet.</Text></ChartCard>}
        ListFooterComponent={store.loading && entries.length ? <Text accessibilityLiveRegion="polite" style={styles.muted}>Loading more entries…</Text> : store.errorCode ? <ChartButton label="Retry" secondary onPress={() => void store.refresh()} /> : null}
        renderItem={({ item }) => <CourseLogRow entry={item} onEdit={() => item.reflection && navigation.navigate('ReflectionComposer', { source: 'MANUAL_COURSE', promptType: item.reflection.promptType, promptVersion: 1, courseId: route.params.courseId, reflectionId: item.reflection.id, draftKey: `reflection:${item.reflection.id}` })} />}
      />
    </ChartScreenFrame>
  );
};

const CourseLogRow: React.FC<{ entry: CourseLogEntry; onEdit: () => void }> = ({ entry, onEdit }) => {
  const reflection = entry.reflection;
  const structured = reflection?.structuredContent as { whatHelped?: string; whatLearned?: string } | null;
  const released = entry.anchorLink?.anchorAvailable === false;
  return <ChartCard>
    <Text style={styles.event} accessibilityLabel={`${eventCopy(entry)} ${formatDate(entry.occurredAt)}`}>{eventCopy(entry)}</Text>
    <Text style={styles.date}>{formatDate(entry.occurredAt)}</Text>
    {entry.practiceSession ? <Text style={styles.muted}>{Math.round(entry.practiceSession.completedDurationSeconds / 60)} min</Text> : null}
    {reflection ? <View style={styles.reflection}><Text style={styles.prompt}>{reflection.promptType.replace(/_/g, ' ')}</Text>{reflection.body ? <Text style={styles.body}>{reflection.body}</Text> : null}{structured?.whatHelped ? <><Text style={styles.structuredLabel}>What helped</Text><Text style={styles.body}>{structured.whatHelped}</Text></> : null}{structured?.whatLearned ? <><Text style={styles.structuredLabel}>What I learned</Text><Text style={styles.body}>{structured.whatLearned}</Text></> : null}{reflection.moodAfter ? <Text style={styles.muted}>{reflection.moodAfter.toLowerCase()}</Text> : null}<Pressable accessibilityRole="button" accessibilityLabel="Edit reflection" onPress={onEdit}><Text style={styles.edit}>Edit reflection</Text></Pressable></View> : entry.eventType === 'REFLECTION_ADDED' ? <Text accessibilityLabel="Reflection added. Content deleted." style={styles.muted}>Reflection added</Text> : null}
    {released ? <View style={styles.released}><Text style={styles.muted}>Released Anchor.</Text>{entry.anchorLink?.snapshot.enhancedImageUrl ? <Image source={{ uri: entry.anchorLink.snapshot.enhancedImageUrl }} style={styles.image} accessibilityLabel="Released Anchor" /> : null}</View> : null}
  </ChartCard>;
};

const styles = StyleSheet.create({ list: { gap: spacing.sm, paddingBottom: 120 }, event: { ...typography.bodyBold, color: colors.text.primary }, date: { ...typography.caption, color: colors.text.secondary }, muted: { ...typography.caption, color: colors.text.secondary }, reflection: { gap: spacing.xs, marginTop: spacing.xs }, prompt: { ...typography.caption, color: colors.gold }, body: { ...typography.body, color: colors.text.primary }, structuredLabel: { ...typography.caption, color: colors.text.secondary, marginTop: spacing.xs }, edit: { ...typography.caption, color: colors.gold, minHeight: 44, paddingTop: spacing.sm }, released: { gap: spacing.xs, marginTop: spacing.sm }, image: { width: 56, height: 56, borderRadius: 8 } });

export default CourseLogScreen;
