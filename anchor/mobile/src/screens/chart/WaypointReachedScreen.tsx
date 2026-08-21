import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useChartJourneyStore } from '@/stores/chartJourneyStore';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
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
  formatDate,
} from './chartUi';
import { CourseMap } from './components/CourseMap';
import { Ico } from './components/Ico';
import { C, F, ls } from './chartTokens';

type Navigation = NativeStackNavigationProp<ChartStackParamList, 'WaypointReached'>;
type ReachedRoute = RouteProp<ChartStackParamList, 'WaypointReached'>;

type LinkIntent = { signature: string; key: string };

function actionKey(prefix: string): string {
  return `chart-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const WaypointReachedScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<ReachedRoute>();
  const store = useCourseStore();
  const anchors = useAnchorStore((state) => state.getActiveAnchors());
  const capabilities = useAuthStore((state) => state.user?.chartCapabilities);
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const { navigateToVault } = useTabNavigation();
  const reduceMotion = useReduceMotionEnabled();
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const linkIntentRef = useRef<LinkIntent | null>(null);
  const anchorCreationInFlightRef = useRef(false);
  const course = store.activeCourse?.id === route.params.courseId ? store.activeCourse : null;
  const completedWaypoint = course?.waypoints.find((item) => item.id === route.params.completedWaypointId) ?? null;
  const nextWaypoint = course?.waypoints.find((item) => item.id === route.params.nextWaypointId) ?? null;
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
    if (
      !completedWaypoint ||
      completedWaypoint.state !== 'REACHED' ||
      !nextWaypoint ||
      nextWaypoint.state !== 'CURRENT' ||
      course.currentWaypointId !== nextWaypoint.id
    ) {
      navigation.replace('ChartHome');
    }
  }, [completedWaypoint, course, navigation, nextWaypoint]);

  const selectAnchor = async (anchor: Anchor, acknowledgedReuse = false) => {
    if (!course || !nextWaypoint) return;
    const existing = [
      course.destinationAnchorLink,
      ...course.waypoints.map((item) => item.anchorLink),
    ].find((link) => link?.anchorId === anchor.id && link.id !== nextWaypoint.anchorLink?.id);
    if (existing && !acknowledgedReuse) {
      Alert.alert(
        'Anchor already linked',
        'This Anchor already supports another point on this Course. Reuse it for the next Waypoint too?',
        [
          { text: 'Choose another', style: 'cancel' },
          { text: 'Reuse Anchor', onPress: () => void selectAnchor(anchor, true) },
        ],
      );
      return;
    }

    const signature = [
      course.id,
      nextWaypoint.id,
      String(course.version),
      anchor.id,
      nextWaypoint.anchorLink?.id ?? 'new',
      acknowledgedReuse ? 'reuse' : 'standard',
    ].join(':');
    if (linkIntentRef.current?.signature !== signature) {
      linkIntentRef.current = { signature, key: actionKey('reached-link') };
    }

    setActionError(null);
    let linked = false;
    try {
      linked = Boolean(await store.linkAnchor(course.id, {
        idempotencyKey: linkIntentRef.current.key,
        expectedCourseVersion: course.version,
        anchorId: anchor.id,
        role: 'WAYPOINT_PRIMARY',
        waypointId: nextWaypoint.id,
        ...(nextWaypoint.anchorLink ? { replaceLinkId: nextWaypoint.anchorLink.id } : {}),
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
    if (anchorCreationInFlightRef.current || !accountId || !course || !nextWaypoint || store.readOnly || !canCreateAnchor) return;
    anchorCreationInFlightRef.current = true;
    await useChartJourneyStore.getState().bindAccount(accountId);
    const activeUser = useAuthStore.getState().user;
    const latest = useCourseStore.getState().activeCourse;
    if (
      activeUser?.id !== accountId ||
      activeUser.chartCapabilities?.canCreateAnchor !== true ||
      useChartJourneyStore.getState().accountId !== accountId ||
      latest?.id !== course.id ||
      latest.currentWaypointId !== nextWaypoint.id ||
      latest.waypoints.find((item) => item.id === nextWaypoint.id)?.state !== 'CURRENT'
    ) {
      anchorCreationInFlightRef.current = false;
      setActionError('This Waypoint or account changed. Refresh Chart before creating its Anchor.');
      return;
    }
    if (!useChartJourneyStore.getState().beginAnchorCreation(
      course.id,
      nextWaypoint.id,
      course.version,
      nextWaypoint.anchorLink?.id ?? null,
      nextWaypoint.anchorLink?.anchorId ?? null,
    )) {
      anchorCreationInFlightRef.current = false;
      return;
    }
    trackChartEventOnce(AnalyticsEvents.WAYPOINT_ANCHOR_ACTION_SELECTED, accountId, `next:create:${course.id}:${nextWaypoint.id}`, {
      course_state: course.status,
      waypoint_state: nextWaypoint.state,
      action: 'create_new',
      after_completion: true,
    });
    navigateToVault('CreateAnchor', {
      chartHandoff: { courseId: course.id, waypointId: nextWaypoint.id },
    });
    setTimeout(() => { anchorCreationInFlightRef.current = false; }, 600);
  };

  if (!course || !completedWaypoint || !nextWaypoint) {
    return (
      <ChartScreenFrame title="WAYPOINT REACHED" subtitle="Verifying the completed and Current Waypoints…">
        <ChartCard><Text style={styles.muted}>The latest Course state is being verified.</Text></ChartCard>
      </ChartScreenFrame>
    );
  }

  const anchorLinked = Boolean(nextWaypoint.anchorLink?.anchorAvailable);

  return (
    <>
      <ChartScreenFrame title="WAYPOINT REACHED" subtitle="The Course moved forward only after the server confirmed it.">
        <View style={styles.confirmedMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ico k="check" s={25} c={C.ink} w={2} />
        </View>
        <View
          accessible
          accessibilityLabel={`Reached waypoint: ${completedWaypoint.title}. Next current waypoint: ${nextWaypoint.title}. ${anchorLinked ? 'Anchor linked.' : 'No Anchor linked yet.'}`}
          style={styles.routeSummary}
        >
          <CourseMap
            courseId={course.id}
            destinationText={course.destinationText}
            waypoints={course.waypoints}
            currentWaypointId={course.currentWaypointId}
            reachedCount={course.reachedCount}
            completed={false}
            reducedMotion={reduceMotion}
            orientation="horizontal"
            onWaypointPress={() => {}}
            advancement={{
              eventId: route.params.completionEventId,
              completedWaypointId: completedWaypoint.id,
              nextWaypointId: nextWaypoint.id,
              courseCompleted: false,
            }}
          />
          <Text style={styles.routeCopy}>{course.reachedCount} OF {course.waypointCount} WAYPOINTS REACHED</Text>
        </View>

        <ChartCard emphasis style={styles.reachedCard}>
          <View style={styles.statusRow}>
            <ChartStatusTag status={completedWaypoint.state} />
            {completedWaypoint.reachedAt ? <Text style={styles.date}>REACHED {formatDate(completedWaypoint.reachedAt).toUpperCase()}</Text> : null}
          </View>
          <Text accessibilityRole="header" style={styles.reachedTitle}>{completedWaypoint.title}</Text>
          <Text style={styles.confirmedCopy}>This Waypoint is now part of your Course history.</Text>
          {course.startingContext ? <Text style={styles.startingCopy}>Starting context · {course.startingContext}</Text> : null}
          {completedWaypoint.anchorLink?.anchorAvailable && completedWaypoint.anchorLink.anchorId ? (
            <ChartGhostButton
              label="Manage Reached Anchor in Sanctuary"
              onPress={() => navigateToVault('AnchorDetail', { anchorId: completedWaypoint.anchorLink!.anchorId! })}
              color={C.boneSoft}
            />
          ) : null}
        </ChartCard>

        <ChartHair centered />
        <ChartKicker color={C.lav}>NEXT WAYPOINT · NOW CURRENT</ChartKicker>
        <ChartCard style={styles.nextCard}>
          <ChartStatusTag status={nextWaypoint.state} />
          <Text accessibilityRole="header" style={styles.nextTitle}>{nextWaypoint.title}</Text>
          {nextWaypoint.description ? <Text style={styles.description}>{nextWaypoint.description}</Text> : null}
          <Text style={styles.guidance}>This is what you are working toward now.</Text>
        </ChartCard>

        {nextWaypoint.anchorLink ? (
          <ChartCard>
            <ChartKicker>NEXT WAYPOINT ANCHOR</ChartKicker>
            <Text style={styles.anchorQuote}>“{nextWaypoint.anchorLink.snapshot.intentionText}”</Text>
            <Text style={styles.anchorMeta}>{nextWaypoint.anchorLink.anchorAvailable ? 'LINKED TO CURRENT WAYPOINT' : 'ANCHOR UNAVAILABLE'}</Text>
          </ChartCard>
        ) : null}

        {anchorLinked ? (
          <>
            <ChartButton
              label="Continue to Next Waypoint"
              onPress={() => navigation.replace('WaypointDetail', { courseId: course.id, waypointId: nextWaypoint.id })}
            />
            <ChartButton label="Change Linked Anchor" secondary onPress={() => setSelectorVisible(true)} disabled={store.readOnly} />
            <ChartGhostButton label="Return to Chart" onPress={() => navigation.replace('ChartHome')} color={C.boneSoft} />
          </>
        ) : (
          <>
            <ChartButton
              label="Create Next Anchor"
              onPress={() => void beginAnchorCreation()}
              disabled={!canCreateAnchor || store.readOnly}
              hint={!canCreateAnchor ? 'Anchor creation is unavailable for this account.' : undefined}
            />
            <ChartButton label="Use Existing Anchor" secondary onPress={() => setSelectorVisible(true)} disabled={store.readOnly} />
            <ChartGhostButton
              label="Set Anchor Later"
              onPress={() => navigation.replace('WaypointDetail', { courseId: course.id, waypointId: nextWaypoint.id })}
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
        selectedAnchorId={nextWaypoint.anchorLink?.anchorId ?? undefined}
        onSelect={(anchor) => void selectAnchor(anchor)}
        onClose={() => setSelectorVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  confirmedMark: { alignSelf: 'center', width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: C.gold },
  routeSummary: { alignItems: 'center', gap: 8 },
  routeCopy: { fontFamily: F.bSemi, fontSize: 9.5, lineHeight: 14, letterSpacing: ls(9.5, 0.12), color: C.boneFaint },
  reachedCard: { gap: 11 },
  nextCard: { gap: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  date: { flexShrink: 1, fontFamily: F.bSemi, fontSize: 8.5, lineHeight: 13, letterSpacing: ls(8.5, 0.1), color: C.boneFaint, textAlign: 'right' },
  reachedTitle: { fontFamily: F.hSemi, fontSize: 28, lineHeight: 36, color: C.bone },
  nextTitle: { fontFamily: F.hSemi, fontSize: 24, lineHeight: 32, color: C.bone },
  confirmedCopy: { fontFamily: F.b, fontSize: 13, lineHeight: 20, color: C.boneSoft },
  startingCopy: { fontFamily: F.q, fontSize: 16, lineHeight: 22, color: C.boneSoft },
  description: { fontFamily: F.b, fontSize: 14, lineHeight: 21, color: C.boneSoft },
  guidance: { fontFamily: F.q, fontSize: 17, lineHeight: 23, color: C.lavSoft },
  anchorQuote: { fontFamily: F.q, fontSize: 17, lineHeight: 23, color: C.bone },
  anchorMeta: { fontFamily: F.bSemi, fontSize: 9.5, letterSpacing: ls(9.5, 0.12), color: C.gold },
  muted: { fontFamily: F.b, fontSize: 13, lineHeight: 20, color: C.boneSoft },
  error: { fontFamily: F.b, fontSize: 13, lineHeight: 20, color: C.danger },
});

export default WaypointReachedScreen;
