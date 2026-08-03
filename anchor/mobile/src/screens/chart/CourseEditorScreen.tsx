import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useCourseStore } from '@/stores/courseStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { AnchorSelectorSheet } from '@/screens/practice/components/AnchorSelectorSheet';
import type { Anchor } from '@/types';
import type { ChartStackParamList, CourseAnchorRole, WaypointSummary } from '@/types/chart';
import { ChartButton, ChartCard, ChartScreenFrame, ChartStatusPill, ReadOnlyNotice } from './chartUi';

type EditorRoute = RouteProp<ChartStackParamList, 'CourseEditor'>;

const inputStyle = {
  borderRadius: 12,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.14)',
  backgroundColor: 'rgba(255,255,255,0.05)',
  color: '#F5F5DC',
  fontFamily: 'Inter-Regular',
  fontSize: 15,
  paddingHorizontal: 12,
  paddingVertical: 10,
};

function actionKey(prefix: string): string {
  return `chart-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const isTerminalWaypoint = (waypoint: WaypointSummary): boolean =>
  waypoint.state === 'REACHED' || waypoint.state === 'SKIPPED' || waypoint.state === 'CANCELLED';

export const CourseEditorScreen: React.FC = () => {
  const route = useRoute<EditorRoute>();
  const store = useCourseStore();
  const activeAnchors = useAnchorStore((state) => state.getActiveAnchors());
  const subscriptionStatus = useAuthStore((state) => state.user?.subscriptionStatus ?? 'free');
  const { navigateToVault } = useTabNavigation();
  const course = store.activeCourse?.id === route.params.courseId ? store.activeCourse : null;
  const [destinationText, setDestinationText] = useState('');
  const [selector, setSelector] = useState<{ role: CourseAnchorRole; waypointId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newWaypointTitle, setNewWaypointTitle] = useState('');
  const [newWaypointDescription, setNewWaypointDescription] = useState('');
  const addWaypointKey = useRef(actionKey('waypoint-add')).current;

  useEffect(() => {
    if (!course) void store.fetchCourseDetail(route.params.courseId);
  }, [course, route.params.courseId, store.fetchCourseDetail]);

  useEffect(() => {
    if (course) setDestinationText(course.destinationText);
  }, [course]);

  const nonTerminal = useMemo(
    () => course?.waypoints.filter((waypoint) => !isTerminalWaypoint(waypoint)) ?? [],
    [course?.waypoints],
  );

  const saveDestination = async () => {
    if (!course || destinationText.trim().length < 1 || destinationText.trim().length > 140) {
      setError('Destination must be between 1 and 140 characters.');
      return;
    }
    setError(null);
    const updated = await store.updateCourse(route.params.courseId, {
      expectedCourseVersion: course.version,
      destinationText: destinationText.trim(),
    });
    if (!updated) setError('The destination could not be saved.');
  };

  const editWaypoint = async (waypoint: WaypointSummary, title: string, description: string) => {
    if (!course || isTerminalWaypoint(waypoint)) return;
    const updated = await store.editWaypoint(route.params.courseId, waypoint.id, {
      expectedCourseVersion: course.version,
      title: title.trim(),
      description: description.trim() || null,
    });
    if (!updated) setError('The waypoint could not be saved.');
  };

  const moveWaypoint = async (waypoint: WaypointSummary, direction: -1 | 1) => {
    if (!course || isTerminalWaypoint(waypoint)) return;
    const index = nonTerminal.findIndex((item) => item.id === waypoint.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= nonTerminal.length) return;
    const ordered = [...nonTerminal];
    [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
    const updated = await store.reorderWaypoints(route.params.courseId, {
      expectedCourseVersion: course.version,
      orderedWaypointIds: ordered.map((item) => item.id),
    });
    if (!updated) setError('The waypoint order could not be saved.');
  };

  const addWaypoint = async () => {
    if (!course || !newWaypointTitle.trim() || course.waypoints.length >= 7) return;
    const updated = await store.addWaypoint(route.params.courseId, {
      idempotencyKey: addWaypointKey,
      expectedCourseVersion: course.version,
      title: newWaypointTitle.trim(),
      ...(newWaypointDescription.trim() ? { description: newWaypointDescription.trim() } : {}),
    });
    if (!updated) {
      setError('The waypoint could not be added.');
      return;
    }
    setNewWaypointTitle('');
    setNewWaypointDescription('');
  };

  const submitAnchor = async (anchor: Anchor, acknowledgedReuse = false) => {
    if (!course || !selector) return;
    const currentLink = selector.role === 'DESTINATION'
      ? course.destinationAnchorLink
      : course.waypoints.find((waypoint) => waypoint.id === selector.waypointId)?.anchorLink;
    const result = await store.linkAnchor(route.params.courseId, {
      idempotencyKey: actionKey('anchor-link'),
      expectedCourseVersion: course.version,
      anchorId: anchor.id,
      role: selector.role,
      ...(selector.waypointId ? { waypointId: selector.waypointId } : {}),
      ...(currentLink ? { replaceLinkId: currentLink.id } : {}),
      ...(acknowledgedReuse ? { acknowledgedReuse: true } : {}),
    });
    setSelector(null);
    if (!result) setError('The Anchor could not be linked. Choose another Anchor and try again.');
  };

  const handleAnchorSelect = (anchor: Anchor) => {
    if (!course || !selector) return;
    const existing = [
      course.destinationAnchorLink,
      ...course.waypoints.map((waypoint) => waypoint.anchorLink),
    ].find((link) => link?.anchorId === anchor.id);
    const currentLink = selector.role === 'DESTINATION'
      ? course.destinationAnchorLink
      : course.waypoints.find((waypoint) => waypoint.id === selector.waypointId)?.anchorLink;
    const targetIsExisting = existing && currentLink?.id === existing.id;
    if (existing && !targetIsExisting) {
      Alert.alert(
        'Anchor already linked',
        `This Anchor is already linked to ${existing.snapshot.intentionText}. Reusing it means both waypoints strengthen the same thread.`,
        [
          { text: 'Choose another', style: 'cancel' },
          { text: 'Reuse Anchor', onPress: () => void submitAnchor(anchor, true) },
        ],
      );
      return;
    }
    void submitAnchor(anchor);
  };

  if (!course) {
    return (
      <ChartScreenFrame title="Course editor" subtitle="Loading the latest Course…">
        <ChartCard><Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 15 }}>The authoritative Course is loading.</Text></ChartCard>
      </ChartScreenFrame>
    );
  }

  return (
    <>
      <ChartScreenFrame title="Course editor" subtitle="Server state remains authoritative after every change.">
        <ChartCard>
          <ChartStatusPill status={course.status} />
          <TextInput
            value={destinationText}
            onChangeText={setDestinationText}
            maxLength={140}
            style={inputStyle}
            accessibilityLabel="Edit Course destination"
            multiline
          />
          <ChartButton label="Save destination" onPress={() => void saveDestination()} disabled={store.readOnly} hint={store.readOnly ? 'Course editing is disabled.' : undefined} />
        </ChartCard>
        <ChartCard>
          <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>DESTINATION ANCHOR</Text>
          <Text style={{ color: '#F5F5DC', fontFamily: 'Inter-Regular', fontSize: 15 }}>{course.destinationAnchorLink?.snapshot.intentionText ?? 'No Anchor linked'}</Text>
          <ChartButton label="Link destination Anchor" secondary onPress={() => setSelector({ role: 'DESTINATION' })} disabled={store.readOnly} />
        </ChartCard>
        <ChartCard>
          <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>WAYPOINTS</Text>
          {course.waypoints.map((waypoint, index) => (
            <View key={waypoint.id} style={{ gap: 8, paddingTop: 8, opacity: isTerminalWaypoint(waypoint) ? 0.66 : 1 }}>
              <Text style={{ color: '#9E9E9E', fontFamily: 'Inter-Regular', fontSize: 12 }}>Waypoint {index + 1} · {waypoint.state}</Text>
              <TextInput
                defaultValue={waypoint.title}
                editable={!isTerminalWaypoint(waypoint) && !store.readOnly}
                maxLength={60}
                style={inputStyle}
                accessibilityLabel={`Edit waypoint ${index + 1} title`}
                onEndEditing={(event) => void editWaypoint(waypoint, event.nativeEvent.text, waypoint.description ?? '')}
              />
              <TextInput
                defaultValue={waypoint.description ?? ''}
                editable={!isTerminalWaypoint(waypoint) && !store.readOnly}
                maxLength={400}
                style={inputStyle}
                accessibilityLabel={`Edit waypoint ${index + 1} description`}
                onEndEditing={(event) => void editWaypoint(waypoint, waypoint.title, event.nativeEvent.text)}
              />
              <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 13 }}>{waypoint.anchorLink?.snapshot.intentionText ?? 'No Anchor linked'}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><ChartButton label="Link Anchor" secondary onPress={() => setSelector({ role: 'WAYPOINT_PRIMARY', waypointId: waypoint.id })} disabled={isTerminalWaypoint(waypoint) || store.readOnly} /></View>
                <View style={{ flex: 1 }}><ChartButton label="Move up" secondary onPress={() => void moveWaypoint(waypoint, -1)} disabled={isTerminalWaypoint(waypoint) || store.readOnly || index === 0} /></View>
                <View style={{ flex: 1 }}><ChartButton label="Move down" secondary onPress={() => void moveWaypoint(waypoint, 1)} disabled={isTerminalWaypoint(waypoint) || store.readOnly || index >= nonTerminal.length - 1} /></View>
              </View>
              {isTerminalWaypoint(waypoint) ? <Text style={{ color: '#9E9E9E', fontFamily: 'Inter-Regular', fontSize: 12 }}>Terminal rows are read-only.</Text> : null}
            </View>
          ))}
          {course.status === 'DRAFT' && course.waypoints.length < 7 ? (
            <View style={{ gap: 8, paddingTop: 12 }}>
              <TextInput value={newWaypointTitle} onChangeText={setNewWaypointTitle} maxLength={60} placeholder="New waypoint title" placeholderTextColor="rgba(192,192,192,0.55)" style={inputStyle} accessibilityLabel="New waypoint title" />
              <TextInput value={newWaypointDescription} onChangeText={setNewWaypointDescription} maxLength={400} placeholder="Description (optional)" placeholderTextColor="rgba(192,192,192,0.55)" style={inputStyle} accessibilityLabel="New waypoint description" multiline />
              <ChartButton label="Add waypoint" secondary onPress={() => void addWaypoint()} disabled={store.readOnly || newWaypointTitle.trim().length === 0} />
            </View>
          ) : null}
        </ChartCard>
        {course.status === 'DRAFT' && course.waypoints.length > 0 ? (
          <ChartButton label="Publish Course" onPress={() => void store.publishCourse(course.id, course.version)} disabled={store.readOnly} />
        ) : null}
        {subscriptionStatus === 'free' ? (
          <ChartButton label="Create a New Anchor" secondary onPress={() => Alert.alert('Anchor creation unavailable', 'Link an existing Anchor first, or upgrade to create a new one.')} />
        ) : (
          <ChartButton label="Create a New Anchor" secondary onPress={() => navigateToVault('CreateAnchor')} />
        )}
        {error ? <Text accessibilityLiveRegion="assertive" style={{ color: '#FFB1B1', fontFamily: 'Inter-Regular', fontSize: 14 }}>{error}</Text> : null}
        {store.readOnly ? <ReadOnlyNotice reason={store.offline ? 'You are offline. Course mutations are disabled.' : 'Course editing is disabled by the current Chart state.'} /> : null}
      </ChartScreenFrame>
      <AnchorSelectorSheet
        visible={selector !== null}
        anchors={activeAnchors}
        selectedAnchorId={undefined}
        onSelect={handleAnchorSelect}
        onClose={() => setSelector(null)}
      />
    </>
  );
};

export default CourseEditorScreen;
