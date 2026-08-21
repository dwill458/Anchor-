import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCourseStore } from '@/stores/courseStore';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useChartJourneyStore } from '@/stores/chartJourneyStore';
import { chartApiClient, getChartErrorCode } from '@/services/ChartApiClient';
import { AnalyticsEvents, trackChartEventOnce } from '@/services/AnalyticsService';
import type { ChartStackParamList, CoursePlanQuota } from '@/types/chart';
import { ChartButton, ChartCard, ChartScreenFrame, ReadOnlyNotice } from './chartUi';
import { CoursePlotting } from './components/CoursePlotting';
import { MOTION } from './chartTokens';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

type Navigation = NativeStackNavigationProp<ChartStackParamList, 'CourseSetup'>;
type SetupRoute = RouteProp<ChartStackParamList, 'CourseSetup'>;

type DraftWaypoint = { title: string; description: string };

const inputStyle = {
  borderRadius: 12,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.14)',
  backgroundColor: 'rgba(255,255,255,0.05)',
  color: '#F5F5DC',
  fontFamily: 'Inter-Regular',
  fontSize: 16,
  paddingHorizontal: 14,
  paddingVertical: 12,
};

function keyFor(prefix: string): string {
  return `chart-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function keyForIntent(
  holder: React.MutableRefObject<{ fingerprint: string; key: string } | null>,
  prefix: string,
  fingerprint: string,
): string {
  if (holder.current?.fingerprint !== fingerprint) {
    holder.current = { fingerprint, key: keyFor(prefix) };
  }
  return holder.current.key;
}

/**
 * Holds until the plotting ceremony has had its full run. The pending timer is
 * parked on `timer` so unmounting clears it rather than orphaning it.
 */
function settleCeremony(
  startedAt: number,
  timer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
): Promise<void> {
  const remaining = MOTION.plottingCeremony - (Date.now() - startedAt);
  if (remaining <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    timer.current = setTimeout(() => {
      timer.current = null;
      resolve();
    }, remaining);
  });
}

/**
 * Restates a server decision. Every branch is driven by a typed code or a safe
 * denial reason — never by a client-side entitlement or quota calculation.
 */
function planDenialMessage(code: string | undefined): string {
  switch (code) {
    case 'PLANNER_QUOTA_EXCEEDED':
      return 'You have used all of your suggested plans for now. You can still build a Course yourself.';
    case 'PLANNER_NOT_ENTITLED':
      return 'Suggested plans are not available on your current plan. You can still build a Course yourself.';
    case 'PLANNER_UNAVAILABLE':
    case 'FEATURE_DISABLED':
      return 'Suggested plans are unavailable right now. You can still build a Course yourself.';
    default:
      return 'The suggested plan could not be generated. Try again when you are ready.';
  }
}

function quotaNotice(quota: CoursePlanQuota): string | null {
  if (quota.eligible) {
    return quota.remaining === 1
      ? '1 suggested plan left.'
      : `${quota.remaining} suggested plans left.`;
  }
  switch (quota.reason) {
    case 'quota_exhausted':
      return 'No suggested plans left right now.';
    case 'not_entitled':
    case 'entitlement_expired':
      return 'Suggested plans are not available on your current plan.';
    default:
      return 'Suggested plans are unavailable right now.';
  }
}

export const CourseSetupScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<SetupRoute>();
  const store = useCourseStore();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const journey = useChartJourneyStore();
  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const reduceMotion = useReduceMotionEnabled();
  const createIntentRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const plannerIntentRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const [destinationText, setDestinationText] = useState('');
  const [currentReality, setCurrentReality] = useState('');
  const [waypoints, setWaypoints] = useState<DraftWaypoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [quota, setQuota] = useState<CoursePlanQuota | null>(null);
  const [plotting, setPlotting] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const mounted = useRef(true);
  const ceremonyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredAccountRef = useRef<string | null>(null);
  const [formAccountId, setFormAccountId] = useState<string | null>(accountId);
  const formAccountIdRef = useRef<string | null>(accountId);
  const observedAccountIdRef = useRef<string | null>(accountId);
  const accountGenerationRef = useRef(0);
  const routeOwnerAccountIdRef = useRef<string | null>(accountId);

  // Invalidate async work during render, before effects have a chance to reset
  // the form. Zustand auth updates can re-render this mounted stack without
  // remounting CourseSetup, so an effect-only generation bump leaves a window
  // where account A's response can be applied to account B.
  if (observedAccountIdRef.current !== accountId) {
    observedAccountIdRef.current = accountId;
    accountGenerationRef.current += 1;
  }
  if (routeOwnerAccountIdRef.current == null && accountId) {
    routeOwnerAccountIdRef.current = accountId;
  }
  formAccountIdRef.current = formAccountId;

  const isActiveSetupAccount = useCallback((expectedAccountId: string, generation: number) => (
    mounted.current &&
    accountGenerationRef.current === generation &&
    observedAccountIdRef.current === expectedAccountId &&
    formAccountIdRef.current === expectedAccountId &&
    useAuthStore.getState().user?.id === expectedAccountId &&
    useChartJourneyStore.getState().accountId === expectedAccountId
  ), []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (ceremonyTimer.current) clearTimeout(ceremonyTimer.current);
      if (draftPersistTimer.current) clearTimeout(draftPersistTimer.current);
    };
  }, []);

  const plannerSurfaceVisible = store.flags.chart_ai_planner_enabled;

  useEffect(() => {
    if (draftPersistTimer.current) {
      clearTimeout(draftPersistTimer.current);
      draftPersistTimer.current = null;
    }
    if (ceremonyTimer.current) {
      clearTimeout(ceremonyTimer.current);
      ceremonyTimer.current = null;
    }
    restoredAccountRef.current = null;
    createIntentRef.current = null;
    plannerIntentRef.current = null;
    formAccountIdRef.current = accountId;
    setFormAccountId(accountId);
    setDestinationText('');
    setCurrentReality('');
    setWaypoints([]);
    setFieldError(null);
    setQuota(null);
    setSaving(false);
    setPlotting(false);
    setRestoring(true);
    if (accountId) void journey.bindAccount(accountId);
  }, [accountId, journey.bindAccount]);

  useEffect(() => {
    if (
      !accountId ||
      formAccountId !== accountId ||
      !journey.hydrated ||
      journey.accountId !== accountId ||
      restoredAccountRef.current === accountId
    ) return;
    restoredAccountRef.current = accountId;
    const expectedAccountId = accountId;
    const generation = accountGenerationRef.current;
    const routeBelongsToAccount = routeOwnerAccountIdRef.current === expectedAccountId;
    const restore = async () => {
      const fromProposalId = routeBelongsToAccount ? route.params?.fromProposalId : undefined;
      if (fromProposalId) {
        try {
          const result = await chartApiClient.getCoursePlan(fromProposalId);
          if (!isActiveSetupAccount(expectedAccountId, generation)) return;
          setDestinationText(result.data.destinationInterpretation);
          setCurrentReality(result.data.startingContext ?? '');
          setWaypoints(result.data.waypoints.map((item) => ({
            title: item.title,
            description: item.description,
          })));
          useChartJourneyStore.getState().replaceSetupDraft({
            destinationText: result.data.destinationInterpretation,
            currentReality: result.data.startingContext ?? '',
            waypoints: result.data.waypoints.map((item) => ({ title: item.title, description: item.description })),
            fromProposalId,
            seedAnchorId: useChartJourneyStore.getState().setupDraft?.seedAnchorId ?? route.params?.seedAnchorId ?? null,
          });
        } catch {
          if (isActiveSetupAccount(expectedAccountId, generation)) {
            setFieldError('This proposal is no longer available. You can continue with a fresh Course.');
          }
        }
      } else if (routeBelongsToAccount && route.params?.seedAnchorId) {
        const seed = getAnchorById(route.params.seedAnchorId);
        if (seed && !seed.isReleased && !seed.archivedAt) {
          if (!isActiveSetupAccount(expectedAccountId, generation)) return;
          setDestinationText(seed.intentionText.slice(0, 140));
          setCurrentReality('');
          setWaypoints([]);
          useChartJourneyStore.getState().replaceSetupDraft({
            destinationText: seed.intentionText.slice(0, 140),
            currentReality: '',
            waypoints: [],
            fromProposalId: null,
            seedAnchorId: seed.id,
          });
        }
      } else {
        const activeDraft = useChartJourneyStore.getState().setupDraft;
        if (activeDraft && isActiveSetupAccount(expectedAccountId, generation)) {
          setDestinationText(activeDraft.destinationText);
          setCurrentReality(activeDraft.currentReality);
          setWaypoints(activeDraft.waypoints);
        }
      }
      if (isActiveSetupAccount(expectedAccountId, generation)) setRestoring(false);
    };
    void restore();
  }, [accountId, formAccountId, getAnchorById, isActiveSetupAccount, journey.accountId, journey.hydrated, route.params?.fromProposalId, route.params?.seedAnchorId]);

  useEffect(() => {
    if (
      !accountId ||
      formAccountId !== accountId ||
      restoredAccountRef.current !== accountId ||
      restoring ||
      journey.accountId !== accountId
    ) return;
    const expectedAccountId = accountId;
    const generation = accountGenerationRef.current;
    if (draftPersistTimer.current) clearTimeout(draftPersistTimer.current);
    draftPersistTimer.current = setTimeout(() => {
      draftPersistTimer.current = null;
      if (!isActiveSetupAccount(expectedAccountId, generation)) return;
      const activeJourney = useChartJourneyStore.getState();
      activeJourney.updateSetupDraft({
        destinationText,
        currentReality,
        waypoints,
        fromProposalId: routeOwnerAccountIdRef.current === expectedAccountId
          ? route.params?.fromProposalId ?? null
          : null,
        seedAnchorId: routeOwnerAccountIdRef.current === expectedAccountId
          ? route.params?.seedAnchorId ?? activeJourney.setupDraft?.seedAnchorId ?? null
          : activeJourney.setupDraft?.seedAnchorId ?? null,
      });
    }, 250);
    return () => {
      if (draftPersistTimer.current) {
        clearTimeout(draftPersistTimer.current);
        draftPersistTimer.current = null;
      }
    };
  }, [accountId, currentReality, destinationText, formAccountId, isActiveSetupAccount, journey.accountId, restoring, route.params?.fromProposalId, route.params?.seedAnchorId, waypoints]);

  useEffect(() => {
    if (!accountId) return;
    trackChartEventOnce(AnalyticsEvents.COURSE_SETUP_STARTED, accountId, route.key, {
      entry_source: routeOwnerAccountIdRef.current === accountId && route.params?.fromProposalId
        ? 'planner_proposal'
        : 'chart_home',
      from_proposal: routeOwnerAccountIdRef.current === accountId && Boolean(route.params?.fromProposalId),
    });
  }, [accountId, route.key, route.params?.fromProposalId]);

  const loadQuota = useCallback(async () => {
    const expectedAccountId = useAuthStore.getState().user?.id;
    const generation = accountGenerationRef.current;
    if (!expectedAccountId || !isActiveSetupAccount(expectedAccountId, generation)) return;
    if (!plannerSurfaceVisible || store.offline) {
      setQuota(null);
      return;
    }
    try {
      const result = await chartApiClient.getCoursePlanQuota();
      if (isActiveSetupAccount(expectedAccountId, generation)) setQuota(result.data);
    } catch {
      // Unknown quota is not permission to generate; the button stays enabled
      // only so the server can answer, and the server still decides.
      if (isActiveSetupAccount(expectedAccountId, generation)) setQuota(null);
    }
  }, [isActiveSetupAccount, plannerSurfaceVisible, store.offline]);

  useEffect(() => {
    void loadQuota();
  }, [accountId, journey.accountId, loadQuota]);

  const addWaypoint = () => {
    if (waypoints.length >= 7) return;
    setWaypoints((current) => [...current, { title: '', description: '' }]);
  };

  const updateWaypoint = (index: number, updates: Partial<DraftWaypoint>) => {
    setWaypoints((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item)));
  };

  const removeWaypoint = (index: number) => {
    setWaypoints((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const moveWaypoint = (index: number, direction: -1 | 1) => {
    setWaypoints((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async (publish: boolean) => {
    if (!accountId) return;
    const expectedAccountId = accountId;
    const generation = accountGenerationRef.current;
    if (!isActiveSetupAccount(expectedAccountId, generation)) return;
    const destination = destinationText.trim();
    const invalidWaypoint = waypoints.find((waypoint) => waypoint.title.trim().length === 0);
    if (destination.length < 1 || destination.length > 140) {
      setFieldError('Destination must be between 1 and 140 characters.');
      return;
    }
    if (invalidWaypoint) {
      setFieldError('Each waypoint needs a title before saving.');
      return;
    }
    if (publish && waypoints.length === 0) {
      setFieldError('Add at least one waypoint before publishing.');
      return;
    }
    setFieldError(null);
    setSaving(true);
    const createFingerprint = JSON.stringify({
      destination,
      currentReality: currentReality.trim(),
      waypoints: waypoints.map((item) => ({ title: item.title.trim(), description: item.description.trim() })),
      fromProposalId: routeOwnerAccountIdRef.current === expectedAccountId
        ? route.params?.fromProposalId ?? null
        : null,
    });
    const createKey = keyForIntent(createIntentRef, 'course-create', createFingerprint);
    trackChartEventOnce(AnalyticsEvents.MANUAL_COURSE_CREATION_REQUESTED, accountId, createKey, {
      entry_source: routeOwnerAccountIdRef.current === expectedAccountId && route.params?.fromProposalId
        ? 'planner_proposal'
        : 'manual_setup',
      from_proposal: routeOwnerAccountIdRef.current === expectedAccountId && Boolean(route.params?.fromProposalId),
      supplied_current_reality: currentReality.trim().length > 0,
    });
    const course = await store.createManualCourse({
      idempotencyKey: createKey,
      destinationText: destination,
      ...(currentReality.trim() ? { currentReality: currentReality.trim() } : {}),
      fromProposalId: routeOwnerAccountIdRef.current === expectedAccountId
        ? route.params?.fromProposalId
        : undefined,
      waypoints: waypoints.map((waypoint) => ({
        title: waypoint.title.trim(),
        ...(waypoint.description.trim() ? { description: waypoint.description.trim() } : {}),
      })),
    });
    if (!isActiveSetupAccount(expectedAccountId, generation)) return;
    if (!course) {
      setSaving(false);
      setFieldError(store.errorCode === 'ACTIVE_COURSE_EXISTS' ? 'An active Course already exists. Archive it before publishing another.' : 'The Course could not be saved.');
      return;
    }
    trackChartEventOnce(AnalyticsEvents.MANUAL_COURSE_CREATED, accountId, course.id, {
      course_state: course.status,
      waypoint_count: course.waypointCount,
      from_proposal: routeOwnerAccountIdRef.current === expectedAccountId && Boolean(route.params?.fromProposalId),
      server_confirmed: true,
    });
    let next = course;
    if (publish) {
      const published = await store.publishCourse(course.id, course.version);
      if (!isActiveSetupAccount(expectedAccountId, generation)) return;
      if (!published) {
        setSaving(false);
        setFieldError(store.errorCode === 'ACTIVE_COURSE_EXISTS' ? 'An active Course already exists. Archive it before publishing another.' : 'The Course could not be published.');
        return;
      }
      next = published;
    }
    setSaving(false);
    if (draftPersistTimer.current) {
      clearTimeout(draftPersistTimer.current);
      draftPersistTimer.current = null;
    }
    useChartJourneyStore.getState().clearSetupDraft();
    if (next.status === 'ACTIVE' && next.currentWaypointId) {
      navigation.replace('WaypointActivation', { courseId: next.id, waypointId: next.currentWaypointId });
    } else if (next.status === 'ACTIVE') {
      navigation.replace('ChartHome');
    } else {
      navigation.navigate('CourseEditor', { courseId: next.id });
    }
  };

  const generatePlan = async () => {
    if (!accountId) return;
    const expectedAccountId = accountId;
    const generation = accountGenerationRef.current;
    if (restoring || !isActiveSetupAccount(expectedAccountId, generation)) return;
    const destination = destinationText.trim();
    if (destination.length < 1 || destination.length > 140) {
      setFieldError('Enter a destination before generating a plan.');
      return;
    }
    if (store.offline || !store.flags.chart_ai_planner_enabled) {
      setFieldError(store.offline ? 'You are offline. Plan generation is unavailable.' : 'AI planning is currently unavailable.');
      return;
    }
    setFieldError(null);
    setSaving(true);
    setPlotting(true);
    const ceremonyStartedAt = Date.now();
    const plannerFingerprint = JSON.stringify({
      destination,
      currentReality: currentReality.trim(),
      includeReflections: true,
    });
    const plannerKey = keyForIntent(plannerIntentRef, 'plan-generate', plannerFingerprint);
    trackChartEventOnce(AnalyticsEvents.CHART_PLANNER_GENERATION_REQUESTED, accountId, plannerKey, {
      entry_source: 'course_setup',
      offline: false,
      supplied_current_reality: currentReality.trim().length > 0,
    });
    try {
      const result = await chartApiClient.generateCoursePlan({
        destinationText: destination,
        ...(currentReality.trim() ? { currentReality: currentReality.trim() } : {}),
        idempotencyKey: plannerKey,
        // Anchors are always used as context; reflections only where the user
        // granted consent on the reflection itself.
        includeReflections: true,
      });
      if (!isActiveSetupAccount(expectedAccountId, generation)) return;
      // The plotting ceremony is choreography, not a spinner. Let it finish its
      // run before the proposal replaces it, so a fast server does not produce
      // a flash. A slow server simply means no extra wait.
      if (!reduceMotion) await settleCeremony(ceremonyStartedAt, ceremonyTimer);
      if (!isActiveSetupAccount(expectedAccountId, generation)) return;
      navigation.navigate('AIPlanReview', {
        courseId: null,
        proposalId: result.data.proposalId,
      });
      const fallback = result.data.generationSource === 'deterministic_fallback';
      trackChartEventOnce(
        fallback ? AnalyticsEvents.CHART_PLANNER_FALLBACK_USED : AnalyticsEvents.CHART_PLANNER_GENERATION_SUCCEEDED,
        accountId,
        result.data.proposalId,
        {
          generation_source: result.data.generationSource,
          fallback_used: fallback,
          server_confirmed: true,
        },
      );
    } catch (cause) {
      if (!isActiveSetupAccount(expectedAccountId, generation)) return;
      // The server owns this decision. The client only restates it; it never
      // re-derives eligibility or a remaining count of its own.
      const code = getChartErrorCode(cause);
      const denialReason = code === 'PLANNER_QUOTA_EXCEEDED'
        ? 'quota_exhausted'
        : code === 'PLANNER_NOT_ENTITLED'
          ? 'not_entitled'
          : 'planner_unavailable';
      trackChartEventOnce(AnalyticsEvents.CHART_PLANNER_GENERATION_DENIED, accountId, plannerKey, {
        denial_reason: denialReason,
        error_category: code ?? 'unknown',
        quota_remaining: quota?.remaining,
        quota_limit: quota?.limit,
        server_confirmed: true,
      });
      if (code === 'PLANNER_QUOTA_EXCEEDED') {
        trackChartEventOnce(AnalyticsEvents.CHART_PLANNER_QUOTA_REACHED, accountId, plannerKey, {
          denial_reason: 'quota_exhausted',
          quota_remaining: 0,
          quota_limit: quota?.limit,
          server_confirmed: true,
        });
      }
      setFieldError(planDenialMessage(code));
      void loadQuota();
    } finally {
      if (isActiveSetupAccount(expectedAccountId, generation)) {
        setPlotting(false);
        setSaving(false);
      }
    }
  };

  // A mounted Chart stack can survive an account change. Never render the old
  // account's controlled input values during the reset/rehydration render.
  if (formAccountId !== accountId) {
    return (
      <ChartScreenFrame title="Plot Your Course" subtitle="Restoring this account's Course draft.">
        <Text accessibilityLiveRegion="polite" style={{ color: '#C0C0C0' }}>Restoring your Course draft…</Text>
      </ChartScreenFrame>
    );
  }

  // The ceremony covers the form rather than replacing it, so the in-flight
  // request keeps its idempotency key and no second generation can be started.
  const setupForm = (
    <ChartScreenFrame title="Plot Your Course" subtitle="Name the result, then the reality you are starting from.">
      <ChartCard>
        <Text
          style={{
            color: '#D4AF37',
            fontFamily: 'Inter-SemiBold',
            fontSize: 13,
          }}
        >
          DESTINATION
        </Text>
        <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20 }}>
          Describe the real outcome you are working toward.
        </Text>
        <TextInput
          value={destinationText}
          onChangeText={setDestinationText}
          maxLength={140}
          placeholder="Where are you going?"
          placeholderTextColor="rgba(192,192,192,0.55)"
          style={inputStyle}
          accessibilityLabel="Course destination"
          multiline
        />
        <Text
          style={{
            color: '#9E9E9E',
            fontFamily: 'Inter-Regular',
            fontSize: 12,
          }}
        >
          {destinationText.length}/140
        </Text>
      </ChartCard>

      <ChartCard>
        <Text style={{ color: '#D4AF37', fontFamily: 'Inter-SemiBold', fontSize: 13 }}>
          CURRENT REALITY · OPTIONAL
        </Text>
        <Text style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20 }}>
          Where are you now? This can be numeric or qualitative and helps make the first Waypoint believable.
        </Text>
        <TextInput
          value={currentReality}
          onChangeText={setCurrentReality}
          maxLength={500}
          placeholder="For example: I currently have 43 active users."
          placeholderTextColor="rgba(192,192,192,0.55)"
          style={[inputStyle, { minHeight: 82 }]}
          accessibilityLabel="Current reality"
          accessibilityHint="Optional starting context for this Course"
          multiline
        />
        <Text style={{ color: '#9E9E9E', fontFamily: 'Inter-Regular', fontSize: 12 }}>
          {currentReality.length}/500
        </Text>
      </ChartCard>

      <ChartCard>
        <Text
          style={{
            color: '#D4AF37',
            fontFamily: 'Inter-SemiBold',
            fontSize: 13,
          }}
        >
          WAYPOINTS · {waypoints.length}/7
        </Text>
        <Text
          style={{
            color: '#C0C0C0',
            fontFamily: 'Inter-Regular',
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          Add observable results—not a task list. You can rename, remove, and reorder every Waypoint before publishing.
        </Text>
        {waypoints.map((waypoint, index) => (
          <View key={`waypoint-${index}`} style={{ gap: 8, paddingTop: 8 }}>
            <TextInput
              value={waypoint.title}
              onChangeText={(title) => updateWaypoint(index, { title })}
              maxLength={60}
              placeholder={`Waypoint ${index + 1} title`}
              placeholderTextColor="rgba(192,192,192,0.55)"
              style={inputStyle}
              accessibilityLabel={`Waypoint ${index + 1} title`}
            />
            <TextInput
              value={waypoint.description}
              onChangeText={(description) => updateWaypoint(index, { description })}
              maxLength={400}
              placeholder="Description (optional)"
              placeholderTextColor="rgba(192,192,192,0.55)"
              style={[inputStyle, { minHeight: 48 }]}
              accessibilityLabel={`Waypoint ${index + 1} description`}
              multiline
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <ChartButton
                label="Move up"
                secondary
                onPress={() => moveWaypoint(index, -1)}
                disabled={index === 0 || store.readOnly}
              />
              <ChartButton
                label="Move down"
                secondary
                onPress={() => moveWaypoint(index, 1)}
                disabled={index === waypoints.length - 1 || store.readOnly}
              />
              <ChartButton
                label="Remove"
                secondary
                onPress={() => removeWaypoint(index)}
                disabled={store.readOnly}
              />
            </View>
          </View>
        ))}
        <ChartButton
          label="Add waypoint"
          secondary
          onPress={addWaypoint}
          disabled={waypoints.length >= 7 || store.readOnly}
          hint={store.readOnly ? 'Chart changes are currently disabled.' : undefined}
        />
      </ChartCard>

      {fieldError ? (
        <Text
          accessibilityLiveRegion="assertive"
          style={{
            color: '#FFB1B1',
            fontFamily: 'Inter-Regular',
            fontSize: 14,
          }}
        >
          {fieldError}
        </Text>
      ) : null}
      {store.readOnly ? <ReadOnlyNotice reason={store.offline ? 'You are offline. Course setup is disabled until you reconnect.' : 'Course setup is currently read-only.'} /> : null}
      {plannerSurfaceVisible ? (
        <ChartCard>
          {quota ? (
            <Text
              accessibilityLabel="Suggested plan availability"
              style={{ color: '#C0C0C0', fontFamily: 'Inter-Regular', fontSize: 13 }}
            >
              {quotaNotice(quota)}
            </Text>
          ) : null}
          <ChartButton
            label="Generate suggested plan"
            secondary
            onPress={() => void generatePlan()}
            // A server-reported ineligibility disables the control, but the
            // server re-decides on every request either way.
            disabled={saving || restoring || store.offline || quota?.eligible === false}
            hint="Creates a proposal for review. It will not change your Course."
          />
        </ChartCard>
      ) : null}
      {restoring ? <Text accessibilityLiveRegion="polite" style={{ color: '#C0C0C0' }}>Restoring your Course draft…</Text> : null}
      <ChartButton label="Save draft" onPress={() => void save(false)} disabled={saving || restoring || store.readOnly} />
      <ChartButton label="Publish Course" secondary onPress={() => void save(true)} disabled={saving || store.readOnly || waypoints.length === 0} />
    </ChartScreenFrame>
  );

  if (!plotting) return setupForm;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {setupForm}
      </View>
      <CoursePlotting destination={destinationText.trim()} />
    </View>
  );
};

export default CourseSetupScreen;
