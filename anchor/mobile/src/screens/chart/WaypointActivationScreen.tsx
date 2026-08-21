import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useChartJourneyStore } from '@/stores/chartJourneyStore';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { AnalyticsEvents, trackChartEventOnce } from '@/services/AnalyticsService';
import { AnchorSelectorSheet } from '@/screens/practice/components/AnchorSelectorSheet';
import type { Anchor } from '@/types';
import type { ChartStackParamList } from '@/types/chart';
import {
  ChartButton,
  ChartCard,
  ChartGhostButton,
  ChartHair,
  ChartKicker,
  ChartScreenFrame,
  ChartStatusTag,
  ReadOnlyNotice,
} from './chartUi';
import { MiniRoute } from './components/MiniRoute';
import { C, F, ls } from './chartTokens';

type Navigation = NativeStackNavigationProp<ChartStackParamList, 'WaypointActivation'>;
type ActivationRoute = RouteProp<ChartStackParamList, 'WaypointActivation'>;

type LinkIntent = { signature: string; key: string };

function actionKey(prefix: string): string {
  return `chart-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const WaypointActivationScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<ActivationRoute>();
  const store = useCourseStore();
  const anchors = useAnchorStore((state) => state.getActiveAnchors());
  const capabilities = useAuthStore((state) => state.user?.chartCapabilities);
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const { navigateToVault } = useTabNavigation();
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const linkIntentRef = useRef<LinkIntent | null>(null);
  const anchorCreationInFlightRef = useRef(false);
  const course = store.activeCourse?.id === route.params.courseId ? store.activeCourse : null;
  const waypoint = course?.waypoints.find((item) => item.id === route.params.waypointId) ?? null;
  const canCreateAnchor = capabilities?.canCreateAnchor === true;

  useEffect(() => {
    if (!course) void store.fetchCourseDetail(route.params.courseId);
  }, [course, route.params.courseId, store.fetchCourseDetail]);

  useEffect(() => {
    if (!course) return;
    if (course.status === 'COMPLETED') {
      navigation.replace('CourseCompletion', { courseId: course.id });
      return;
    }
    if (!waypoint || course.currentWaypointId !== waypoint.id || waypoint.state !== 'CURRENT') {
      navigation.replace('ChartHome');
    }
  }, [course, navigation, waypoint]);

  const selectAnchor = async (anchor: Anchor, acknowledgedReuse = false) => {
    if (!course || !waypoint) return;
    const existing = [
      course.destinationAnchorLink,
      ...course.waypoints.map((item) => item.anchorLink),
    ].find((link) => link?.anchorId === anchor.id && link.id !== waypoint.anchorLink?.id);
    if (existing && !acknowledgedReuse) {
      Alert.alert(
        'Anchor already linked',
        'This Anchor already supports another point on this Course. Reuse it here too?',
        [
          { text: 'Choose another', style: 'cancel' },
          { text: 'Reuse Anchor', onPress: () => void selectAnchor(anchor, true) },
        ],
      );
      return;
    }

    const signature = [
      course.id,
      waypoint.id,
      String(course.version),
      anchor.id,
      waypoint.anchorLink?.id ?? 'new',
      acknowledgedReuse ? 'reuse' : 'standard',
    ].join(':');
    if (linkIntentRef.current?.signature !== signature) {
      linkIntentRef.current = { signature, key: actionKey('activation-link') };
    }

    setActionError(null);
    let linked = false;
    try {
      linked = Boolean(await store.linkAnchor(course.id, {
        idempotencyKey: linkIntentRef.current.key,
        expectedCourseVersion: course.version,
        anchorId: anchor.id,
        role: 'WAYPOINT_PRIMARY',
        waypointId: waypoint.id,
        ...(waypoint.anchorLink ? { replaceLinkId: waypoint.anchorLink.id } : {}),
        ...(acknowledgedReuse ? { acknowledgedReuse: true } : {}),
      }));
    } catch {
      linked = false;
    }
    setSelectorVisible(false);
    if (!linked) {
      setActionError('The Anchor could not be linked. Review the latest Course and try again.');
      return;
    }
    linkIntentRef.current = null;
  };

  const beginAnchorCreation = async () => {
    if (anchorCreationInFlightRef.current || !accountId || !course || !waypoint || store.readOnly || !canCreateAnchor) return;
    anchorCreationInFlightRef.current = true;
    await useChartJourneyStore.getState().bindAccount(accountId);
    const activeUser = useAuthStore.getState().user;
    const latest = useCourseStore.getState().activeCourse;
    if (
      activeUser?.id !== accountId ||
      activeUser.chartCapabilities?.canCreateAnchor !== true ||
      useChartJourneyStore.getState().accountId !== accountId ||
      latest?.id !== course.id ||
      latest.currentWaypointId !== waypoint.id ||
      latest.waypoints.find((item) => item.id === waypoint.id)?.state !== 'CURRENT'
    ) {
      anchorCreationInFlightRef.current = false;
      setActionError('This Waypoint or account changed. Refresh Chart before creating its Anchor.');
      return;
    }
    if (!useChartJourneyStore.getState().beginAnchorCreation(
      course.id,
      waypoint.id,
      course.version,
      waypoint.anchorLink?.id ?? null,
      waypoint.anchorLink?.anchorId ?? null,
    )) {
      anchorCreationInFlightRef.current = false;
      return;
    }
    trackChartEventOnce(AnalyticsEvents.WAYPOINT_ANCHOR_ACTION_SELECTED, accountId, `activation:create:${course.id}:${waypoint.id}`, {
      course_state: course.status,
      waypoint_state: waypoint.state,
      action: 'create_new',
      activation: true,
    });
    navigateToVault('CreateAnchor', {
      chartHandoff: { courseId: course.id, waypointId: waypoint.id },
    });
    setTimeout(() => { anchorCreationInFlightRef.current = false; }, 600);
  };

  if (!course || !waypoint) {
    return (
      <ChartScreenFrame title="YOUR COURSE IS SET" subtitle="Loading the current Waypoint from your Course…">
        <ChartCard><Text style={styles.muted}>The latest Course state is being verified.</Text></ChartCard>
      </ChartScreenFrame>
    );
  }

  const anchorLinked = Boolean(waypoint.anchorLink?.anchorAvailable);
  const waypointNumber = course.waypoints.findIndex((item) => item.id === waypoint.id) + 1;

  return (
    <>
      <ChartScreenFrame
        title="YOUR COURSE IS SET"
        subtitle="Your first eligible Waypoint is now Current. No Practice starts until you choose it."
      >
        <View
          accessible
          accessibilityLabel={`Destination: ${course.destinationText}.${course.startingContext ? ` Starting context: ${course.startingContext}.` : ''} Current waypoint: ${waypoint.title}. ${anchorLinked ? 'Anchor linked.' : 'No Anchor linked yet.'}`}
          style={styles.routeSummary}
        >
          <MiniRoute waypoints={course.waypoints} size="medium" testID="activation-mini-route" />
          <Text style={styles.routeCopy}>DESTINATION · {course.destinationText}</Text>
          {course.startingContext ? <Text style={styles.startingCopy}>STARTING CONTEXT · {course.startingContext}</Text> : null}
        </View>

        <ChartHair centered />
        <ChartKicker color={C.lav}>FIRST WAYPOINT</ChartKicker>
        <ChartCard emphasis style={styles.waypointCard}>
          <View style={styles.statusRow}>
            <ChartStatusTag status={waypoint.state} />
            <Text style={styles.position}>WAYPOINT {waypointNumber}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.waypointTitle}>{waypoint.title}</Text>
          {waypoint.description ? <Text style={styles.description}>{waypoint.description}</Text> : null}
          <Text style={styles.guidance}>Give the next step a form you can return to.</Text>
        </ChartCard>

        {waypoint.anchorLink ? (
          <ChartCard>
            <ChartKicker>WAYPOINT ANCHOR</ChartKicker>
            <Text style={styles.anchorQuote}>“{waypoint.anchorLink.snapshot.intentionText}”</Text>
            <Text style={styles.anchorMeta}>{waypoint.anchorLink.anchorAvailable ? 'LINKED TO CURRENT WAYPOINT' : 'ANCHOR UNAVAILABLE'}</Text>
          </ChartCard>
        ) : null}

        {anchorLinked ? (
          <>
            <ChartButton
              label="Continue to Current Waypoint"
              onPress={() => navigation.replace('WaypointDetail', { courseId: course.id, waypointId: waypoint.id })}
            />
            <ChartButton label="Change Linked Anchor" secondary onPress={() => setSelectorVisible(true)} disabled={store.readOnly} />
            <ChartGhostButton label="Return to Chart" onPress={() => navigation.replace('ChartHome')} color={C.boneSoft} />
          </>
        ) : (
          <>
            <ChartButton
              label="Create Waypoint Anchor"
              onPress={() => void beginAnchorCreation()}
              disabled={!canCreateAnchor || store.readOnly}
              hint={!canCreateAnchor ? 'Anchor creation is unavailable for this account.' : undefined}
            />
            <ChartButton label="Use Existing Anchor" secondary onPress={() => setSelectorVisible(true)} disabled={store.readOnly} />
            <ChartGhostButton
              label="Set Anchor Later"
              onPress={() => navigation.replace('WaypointDetail', { courseId: course.id, waypointId: waypoint.id })}
              color={C.boneSoft}
            />
          </>
        )}

        {actionError ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{actionError}</Text> : null}
        {store.readOnly ? (
          <ReadOnlyNotice reason={store.offline ? 'You are offline. Course links are disabled.' : 'Course links are read-only right now.'} />
        ) : null}
      </ChartScreenFrame>
      <AnchorSelectorSheet
        visible={selectorVisible}
        anchors={anchors}
        selectedAnchorId={waypoint.anchorLink?.anchorId ?? undefined}
        onSelect={(anchor) => void selectAnchor(anchor)}
        onClose={() => setSelectorVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  routeSummary: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  routeCopy: { fontFamily: F.bSemi, fontSize: 9.5, lineHeight: 14, letterSpacing: ls(9.5, 0.12), color: C.boneFaint, textAlign: 'center' },
  startingCopy: { fontFamily: F.b, fontSize: 11.5, lineHeight: 17, color: C.boneSoft, textAlign: 'center' },
  waypointCard: { gap: 11 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  position: { fontFamily: F.bSemi, fontSize: 9.5, letterSpacing: ls(9.5, 0.12), color: C.boneFaint },
  waypointTitle: { fontFamily: F.hSemi, fontSize: 28, lineHeight: 36, color: C.bone },
  description: { fontFamily: F.b, fontSize: 14, lineHeight: 21, color: C.boneSoft },
  guidance: { fontFamily: F.q, fontSize: 17, lineHeight: 23, color: C.lavSoft },
  anchorQuote: { fontFamily: F.q, fontSize: 17, lineHeight: 23, color: C.bone },
  anchorMeta: { fontFamily: F.bSemi, fontSize: 9.5, letterSpacing: ls(9.5, 0.12), color: C.gold },
  muted: { fontFamily: F.b, fontSize: 13, lineHeight: 20, color: C.boneSoft },
  error: { fontFamily: F.b, fontSize: 13, lineHeight: 20, color: C.danger },
});

export default WaypointActivationScreen;
