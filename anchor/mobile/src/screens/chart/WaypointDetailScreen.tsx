import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Eye, Sparkles, Zap } from 'lucide-react-native';
import { useCourseStore } from '@/stores/courseStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useChartJourneyStore } from '@/stores/chartJourneyStore';
import { usePracticeEntry } from '@/hooks/usePracticeEntry';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { AnalyticsEvents, trackChartEventOnce } from '@/services/AnalyticsService';
import { AnchorSelectorSheet } from '@/screens/practice/components/AnchorSelectorSheet';
import type { Anchor } from '@/types';
import type { PracticeEntryMode } from '@/types/practice';
import type { ChartStackParamList, CompleteWaypointResponse } from '@/types/chart';
import { colors, typography } from '@/theme';
import { ChartButton, ChartCard, ChartGhostButton, ChartKicker, ChartScreenFrame, ChartSheetHandle, ChartStatusPill, ReadOnlyNotice } from './chartUi';
import { useChartPostPracticeReflection } from './useChartPostPracticeReflection';

type Navigation = NativeStackNavigationProp<ChartStackParamList, 'WaypointDetail'>;
type WaypointRoute = RouteProp<ChartStackParamList, 'WaypointDetail'>;

type MutationIntent = { signature: string; key: string };
type CompletionIntent = MutationIntent & { reflectionKey: string };

function actionKey(prefix: string): string {
  return `chart-waypoint-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const MODES: Array<{ mode: PracticeEntryMode; label: string; color: string; icon: React.ReactNode }> = [
  { mode: 'focus', label: 'FOCUS', color: colors.gold, icon: <Zap size={15} color={colors.gold} /> },
  { mode: 'visualize', label: 'VISUALIZE', color: '#78B4D1', icon: <Eye size={15} color="#78B4D1" /> },
  { mode: 'deepPrime', label: 'DEEP PRIME', color: '#AD99D2', icon: <Sparkles size={15} color="#AD99D2" /> },
];

export const WaypointDetailScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<WaypointRoute>();
  const store = useCourseStore();
  const activeAnchors = useAnchorStore((state) => state.getActiveAnchors());
  const chartCapabilities = useAuthStore((state) => state.user?.chartCapabilities);
  // Analytics dedupe is per account; a null id means no event is emitted.
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const { navigateToVault } = useTabNavigation();
  const { startPractice, isNavigationLocked } = usePracticeEntry();
  const reduceMotion = useReduceMotionEnabled();
  const course = store.activeCourse?.id === route.params.courseId ? store.activeCourse : null;
  const waypoint = course?.waypoints.find((item) => item.id === route.params.waypointId);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [completionVisible, setCompletionVisible] = useState(false);
  const [whatHelped, setWhatHelped] = useState('');
  const [whatLearned, setWhatLearned] = useState('');
  const [completing, setCompleting] = useState(false);
  const linkIntentRef = useRef<MutationIntent | null>(null);
  const anchorCreationInFlightRef = useRef(false);
  const completionIntentRef = useRef<CompletionIntent | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const refreshedPracticeSessionRef = useRef<string | null>(null);
  const launchedPracticeRef = useRef<string | null>(null);
  const canCreateAnchor = chartCapabilities?.canCreateAnchor === true;
  const canAddCompletionReflection =
    store.flags.chart_reflections_enabled === true &&
    chartCapabilities?.chartReflectionsEnabled === true &&
    chartCapabilities?.canCreateOrEditReflections === true;

  const launchPractice = useCallback((mode: PracticeEntryMode) => {
    const anchorId = waypoint?.anchorLink?.anchorId;
    if (!course || !waypoint || !anchorId || !waypoint.anchorLink?.anchorAvailable || store.readOnly || waypoint.state === 'BLOCKED') return;
    startPractice({ mode, anchorId, source: 'chart_waypoint_detail', intention: waypoint.anchorLink.snapshot.intentionText, chartContext: { courseId: course.id, waypointId: waypoint.id, courseVersion: course.version } });
  }, [course, startPractice, store.readOnly, waypoint]);

  useChartPostPracticeReflection({
    navigation,
    courseId: route.params.courseId,
    waypointId: route.params.waypointId,
    handoff: route.params.practiceReturn,
  });

  useFocusEffect(React.useCallback(() => {
    const sessionId = route.params.practiceReturn?.practiceSessionId;
    if (!sessionId || refreshedPracticeSessionRef.current === sessionId) return;
    refreshedPracticeSessionRef.current = sessionId;
    void store.fetchCourseDetail(route.params.courseId);
  }, [route.params.courseId, route.params.practiceReturn?.practiceSessionId, store.fetchCourseDetail]));

  useEffect(() => {
    if (!course) void store.fetchCourseDetail(route.params.courseId);
  }, [course, route.params.courseId, store.fetchCourseDetail]);

  useEffect(() => {
    if (course && !waypoint) navigation.replace('ChartHome');
    if (!course && store.errorCode === 'COURSE_NOT_FOUND') navigation.replace('ChartHome');
  }, [course, navigation, store.errorCode, waypoint]);

  useEffect(() => {
    const launchMode = route.params.launchMode;
    if (!launchMode || !course || !waypoint) return;
    const launchKey = `${course.id}:${waypoint.id}:${launchMode}`;
    if (launchedPracticeRef.current === launchKey) return;
    launchedPracticeRef.current = launchKey;
    navigation.setParams({ launchMode: undefined });
    launchPractice(launchMode);
  }, [course, launchPractice, navigation, route.params.launchMode, waypoint]);

  if (!course || !waypoint) {
    return <ChartScreenFrame title="WAYPOINT" subtitle="Loading the latest waypoint…"><ChartCard><Text style={styles.muted}>The waypoint is being verified.</Text></ChartCard></ChartScreenFrame>;
  }

  const selectAnchor = async (anchor: Anchor, acknowledgedReuse = false) => {
    const existing = [course.destinationAnchorLink, ...course.waypoints.map((item) => item.anchorLink)].find((link) => link?.anchorId === anchor.id && link.id !== waypoint.anchorLink?.id);
    if (existing && !acknowledgedReuse) {
      Alert.alert('Anchor already linked', `This Anchor is already linked to ${existing.snapshot.intentionText}. Reusing it means both waypoints strengthen the same thread.`, [
        { text: 'Choose another', style: 'cancel' },
        { text: 'Reuse Anchor', onPress: () => void selectAnchor(anchor, true) },
      ]);
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
      linkIntentRef.current = { signature, key: actionKey('link') };
    }
    setActionError(null);
    let linked = false;
    try {
      linked = Boolean(await store.linkAnchor(route.params.courseId, {
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
      setActionError('The Anchor could not be linked. Choose another Anchor and try again.');
      return;
    }
    linkIntentRef.current = null;
  };

  const beginAnchorCreation = async () => {
    if (anchorCreationInFlightRef.current || !accountId || !course || !waypoint || store.readOnly || !canCreateAnchor) return;
    anchorCreationInFlightRef.current = true;
    await useChartJourneyStore.getState().bindAccount(accountId);
    const latest = useCourseStore.getState().activeCourse;
    if (
      useAuthStore.getState().user?.id !== accountId ||
      useAuthStore.getState().user?.chartCapabilities?.canCreateAnchor !== true ||
      useChartJourneyStore.getState().accountId !== accountId ||
      latest?.id !== course.id ||
      latest.currentWaypointId !== waypoint.id ||
      latest.waypoints.find((item) => item.id === waypoint.id)?.state !== 'CURRENT'
    ) {
      anchorCreationInFlightRef.current = false;
      setActionError('This Waypoint changed. Refresh Chart before creating its Anchor.');
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
    trackChartEventOnce(AnalyticsEvents.WAYPOINT_ANCHOR_ACTION_SELECTED, accountId, `create:${course.id}:${waypoint.id}`, {
      course_state: course.status,
      waypoint_state: waypoint.state,
      action: 'create_new',
    });
    navigateToVault('CreateAnchor', {
      chartHandoff: { courseId: course.id, waypointId: waypoint.id },
    });
    setTimeout(() => { anchorCreationInFlightRef.current = false; }, 600);
  };

  const finishCompletion = async () => {
    if (completing || waypoint.state !== 'CURRENT') return;
    setActionError(null);
    const reflectionBody = { whatHelped: whatHelped.trim(), whatLearned: whatLearned.trim() };
    const includeReflection =
      canAddCompletionReflection &&
      Boolean(reflectionBody.whatHelped || reflectionBody.whatLearned);
    const signature = includeReflection
      ? JSON.stringify([course.id, waypoint.id, course.version, reflectionBody.whatHelped, reflectionBody.whatLearned])
      : JSON.stringify([course.id, waypoint.id, course.version, 'no-reflection']);
    if (completionIntentRef.current?.signature !== signature) {
      completionIntentRef.current = {
        signature,
        key: actionKey('complete'),
        reflectionKey: actionKey('completion-reflection'),
      };
    }
    const intent = completionIntentRef.current;

    if (accountId) {
      trackChartEventOnce(AnalyticsEvents.WAYPOINT_COMPLETION_STARTED, accountId, intent.key, {
        course_state: course.status,
        waypoint_state: waypoint.state,
      });
    }

    setCompleting(true);
    let result: CompleteWaypointResponse | null = null;
    try {
      result = await store.completeWaypoint(course.id, waypoint.id, {
        idempotencyKey: intent.key,
        expectedCourseVersion: course.version,
        ...(includeReflection ? {
          reflection: {
            idempotencyKey: intent.reflectionKey,
            promptType: 'WAYPOINT_COMPLETION' as const,
            promptVersion: 1,
            structuredContent: reflectionBody,
          },
        } : {}),
      });
    } catch {
      result = null;
    } finally {
      setCompleting(false);
    }
    if (!result) { setActionError('This waypoint could not be reached. The Course may have changed; refresh and try again.'); return; }

    if (accountId) {
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
      }
    }

    setCompletionVisible(false);
    if (result.courseCompleted) {
      navigation.replace('CourseCompletion', { courseId: course.id });
      return;
    }
    if (result.nextWaypoint) {
      navigation.replace('WaypointReached', {
        courseId: course.id,
        completedWaypointId: result.completedWaypoint.id,
        nextWaypointId: result.nextWaypoint.id,
        completionEventId: result.completionEventId,
      });
      return;
    }
    navigation.replace('ChartHome');
  };

  const skipWaypoint = async () => {
    setActionError(null);
    const result = await store.skipWaypoint(course.id, waypoint.id, { idempotencyKey: actionKey('skip'), expectedCourseVersion: course.version });
    if (!result) setActionError('This waypoint could not be skipped. Refresh and try again.');
    else navigation.replace('ChartHome');
  };

  const cancelWaypoint = async () => {
    setActionError(null);
    const result = await store.cancelWaypoint(course.id, waypoint.id, { idempotencyKey: actionKey('cancel'), expectedCourseVersion: course.version });
    if (!result) setActionError('This waypoint could not be removed. Refresh and try again.');
    else navigation.replace('ChartHome');
  };

  const isBlocked = waypoint.state === 'BLOCKED';
  const isTerminal = waypoint.state === 'REACHED' || waypoint.state === 'SKIPPED' || waypoint.state === 'CANCELLED';
  const canPractice = Boolean(waypoint.anchorLink?.anchorAvailable) && !isBlocked && !store.readOnly;

  return (
    <>
      <ChartScreenFrame title="WAYPOINT DETAIL" subtitle={`Position ${waypoint.position}`}>
        <ChartSheetHandle />
        <ChartKicker color={isBlocked ? colors.warning : waypoint.state === 'CURRENT' ? '#AD99D2' : colors.gold}>{waypoint.state}</ChartKicker>
        <View style={styles.titleRow}><Text style={styles.title}>{waypoint.title}</Text><ChartStatusPill status={waypoint.state} /></View>
        {waypoint.description ? <Text style={styles.description}>{waypoint.description}</Text> : null}
        {isBlocked ? <Text style={styles.blockedCopy}>This waypoint is blocked because its linked Anchor is unavailable.</Text> : null}

        {waypoint.anchorLink || waypoint.state === 'CURRENT' ? <>
          <ChartKicker style={styles.kickerSpacing}>LINKED ANCHOR</ChartKicker>
          <ChartCard style={styles.anchorCard}><Text style={styles.anchorQuote}>“{waypoint.anchorLink?.snapshot.intentionText ?? 'No Anchor linked yet'}”</Text><Text style={styles.anchorMeta}>{waypoint.anchorLink?.anchorAvailable ? 'LINKED ANCHOR' : 'ANCHOR UNAVAILABLE'}</Text></ChartCard>
        </> : null}

        <ChartKicker style={styles.kickerSpacing}>PRACTICE THIS WAYPOINT</ChartKicker>
        <View style={styles.modeRow}>{MODES.map((mode) => <ChartGhostButton key={mode.mode} label={mode.label} icon={mode.icon} color={mode.color} disabled={!canPractice || isNavigationLocked} onPress={() => launchPractice(mode.mode)} style={styles.modeButton} />)}</View>
        {!waypoint.anchorLink && waypoint.state === 'CURRENT' ? <Text style={styles.muted}>Link an Anchor to unlock practice. This waypoint can still be reached or skipped.</Text> : null}

        <ChartKicker style={styles.kickerSpacing}>LOG · {waypoint.title}</ChartKicker>
        <ChartGhostButton label="View full log →" onPress={() => navigation.navigate('CourseLog', { courseId: course.id, waypointId: waypoint.id })} color={colors.gold} />

        {!isTerminal && waypoint.state === 'CURRENT' ? <ChartButton label="Mark Waypoint Reached" onPress={() => { setActionError(null); setCompletionVisible(true); }} disabled={store.readOnly} /> : null}
        {!isTerminal && waypoint.state === 'CURRENT' ? <ChartButton label="Skip Waypoint" secondary onPress={() => Alert.alert('Skip waypoint?', 'This will be recorded in the Course Log and cannot be undone.', [{ text: 'Keep waypoint', style: 'cancel' }, { text: 'Skip waypoint', style: 'destructive', onPress: () => void skipWaypoint() }])} disabled={store.readOnly} /> : null}
        {!isTerminal && waypoint.state === 'UPCOMING' ? <ChartButton label="Remove from Course" secondary destructive onPress={() => Alert.alert('Remove waypoint?', 'This records the waypoint as cancelled. It cannot be restored.', [{ text: 'Keep waypoint', style: 'cancel' }, { text: 'Remove waypoint', style: 'destructive', onPress: () => void cancelWaypoint() }])} disabled={store.readOnly} /> : null}
        {actionError ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{actionError}</Text> : null}

        <ChartButton label="Link an Existing Anchor" secondary onPress={() => setSelectorVisible(true)} disabled={store.readOnly} />
        <ChartButton
          label="Create a New Anchor"
          secondary
          onPress={() => void beginAnchorCreation()}
          disabled={!canCreateAnchor || store.readOnly}
          hint={!canCreateAnchor ? 'Anchor creation is unavailable for this account.' : undefined}
        />
        {store.readOnly ? <ReadOnlyNotice reason={store.offline ? 'You are offline. Anchor links and Course mutations are disabled.' : 'Anchor links and Course mutations are currently read-only.'} /> : null}
      </ChartScreenFrame>
      <AnchorSelectorSheet visible={selectorVisible} anchors={activeAnchors} onSelect={(anchor) => void selectAnchor(anchor)} onClose={() => setSelectorVisible(false)} />
      <Modal
        visible={completionVisible}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => { if (!completing) setCompletionVisible(false); }}
      >
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.ceremony} accessibilityViewIsModal accessibilityLabel="Confirm waypoint completion">
              <View style={styles.sheetHandle} />
              <ChartKicker style={styles.ceremonyKicker}>CONFIRM WAYPOINT</ChartKicker>
              <Text accessibilityRole="header" style={styles.ceremonyTitle}>Mark “{waypoint.title}” reached?</Text>
              <Text style={styles.ceremonyLead}>Confirm only when this change has happened in the real world. Your Course moves forward after the server accepts it.</Text>
              {canAddCompletionReflection ? (
                <>
                  <Text style={styles.reflectionIntro}>You can add a private reflection with the same confirmation.</Text>
                  <Text style={styles.fieldLabel}>What helped you get here?</Text>
                  <TextInput
                    value={whatHelped}
                    onChangeText={setWhatHelped}
                    placeholder="Optional"
                    placeholderTextColor="rgba(245,240,232,0.28)"
                    style={styles.ceremonyInput}
                    multiline
                    editable={!completing}
                    accessibilityLabel="What helped you get here? Optional"
                  />
                  <Text style={styles.fieldLabel}>What did you learn?</Text>
                  <TextInput
                    value={whatLearned}
                    onChangeText={setWhatLearned}
                    placeholder="Optional"
                    placeholderTextColor="rgba(245,240,232,0.28)"
                    style={styles.ceremonyInput}
                    multiline
                    editable={!completing}
                    accessibilityLabel="What did you learn? Optional"
                  />
                </>
              ) : null}
              {actionError ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{actionError}</Text> : null}
              <ChartButton label="Confirm Reached" onPress={() => void finishCompletion()} disabled={completing} />
              <ChartGhostButton label="Cancel" onPress={() => setCompletionVisible(false)} disabled={completing} color="rgba(245,240,232,0.54)" />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: typography.fonts.headingSemiBold, fontSize: 27, lineHeight: 35, color: colors.bone },
  description: { fontFamily: typography.fonts.body, fontSize: 13, lineHeight: 20, color: 'rgba(245,240,232,0.74)' },
  blockedCopy: { fontFamily: typography.fonts.body, fontSize: 13, lineHeight: 20, color: colors.warning },
  kickerSpacing: { marginTop: 10 },
  anchorCard: { gap: 8, padding: 14 },
  anchorQuote: { fontFamily: 'CormorantGaramond-Italic', fontSize: 17, color: colors.bone },
  anchorMeta: { fontFamily: typography.fonts.headingSemiBold, fontSize: 9, letterSpacing: 1.2, color: 'rgba(212,175,55,0.72)' },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeButton: { flex: 1, minHeight: 64, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.015)', justifyContent: 'center' },
  muted: { fontFamily: typography.fonts.body, fontSize: 12, lineHeight: 18, color: 'rgba(245,240,232,0.44)' },
  error: { fontFamily: typography.fonts.body, fontSize: 13, lineHeight: 19, color: '#F0A0A0' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4,6,9,0.72)' },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  ceremony: { paddingHorizontal: 22, paddingTop: 11, paddingBottom: 28, gap: 10, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)', backgroundColor: '#141A21' },
  sheetHandle: { alignSelf: 'center', width: 34, height: 3, borderRadius: 2, backgroundColor: 'rgba(212,175,55,0.32)', marginBottom: 6 },
  ceremonyKicker: { alignSelf: 'center' },
  ceremonyTitle: { fontFamily: typography.fonts.headingSemiBold, fontSize: 27, lineHeight: 35, textAlign: 'center', color: colors.bone },
  ceremonyLead: { fontFamily: typography.fonts.body, fontSize: 13, lineHeight: 20, textAlign: 'center', color: 'rgba(245,240,232,0.72)', marginBottom: 5 },
  reflectionIntro: { fontFamily: 'CormorantGaramond-Italic', fontSize: 16, lineHeight: 22, textAlign: 'center', color: 'rgba(245,240,232,0.58)' },
  fieldLabel: { fontFamily: typography.fonts.body, fontSize: 12, color: 'rgba(245,240,232,0.55)' },
  ceremonyInput: { minHeight: 62, maxHeight: 110, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.025)', color: colors.bone, fontFamily: 'CormorantGaramond-Italic', fontSize: 16, textAlignVertical: 'top' },
});

export default WaypointDetailScreen;
