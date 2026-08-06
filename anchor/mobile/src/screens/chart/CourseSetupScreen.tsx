import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCourseStore } from '@/stores/courseStore';
import { useAuthStore } from '@/stores/authStore';
import { chartApiClient, getChartErrorCode } from '@/services/ChartApiClient';
import { AnalyticsEvents, trackChartEventOnce } from '@/services/AnalyticsService';
import type { ChartStackParamList, CoursePlanQuota } from '@/types/chart';
import { ChartButton, ChartCard, ChartScreenFrame, ReadOnlyNotice } from './chartUi';

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
  const createKey = useRef(keyFor('course-create')).current;
  const plannerKey = useRef(keyFor('plan-generate')).current;
  const [destinationText, setDestinationText] = useState('');
  const [waypoints, setWaypoints] = useState<DraftWaypoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [quota, setQuota] = useState<CoursePlanQuota | null>(null);

  const plannerSurfaceVisible = store.flags.chart_ai_planner_enabled;

  useEffect(() => {
    if (!accountId) return;
    trackChartEventOnce(AnalyticsEvents.COURSE_SETUP_STARTED, accountId, route.key, {
      entry_source: route.params?.fromProposalId ? 'planner_proposal' : 'chart_home',
      from_proposal: Boolean(route.params?.fromProposalId),
    });
  }, [accountId, route.key, route.params?.fromProposalId]);

  const loadQuota = useCallback(async () => {
    if (!plannerSurfaceVisible || store.offline) {
      setQuota(null);
      return;
    }
    try {
      const result = await chartApiClient.getCoursePlanQuota();
      setQuota(result.data);
    } catch {
      // Unknown quota is not permission to generate; the button stays enabled
      // only so the server can answer, and the server still decides.
      setQuota(null);
    }
  }, [plannerSurfaceVisible, store.offline]);

  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);

  const addWaypoint = () => {
    if (waypoints.length >= 7) return;
    setWaypoints((current) => [...current, { title: '', description: '' }]);
  };

  const updateWaypoint = (index: number, updates: Partial<DraftWaypoint>) => {
    setWaypoints((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item)));
  };

  const save = async (publish: boolean) => {
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
    trackChartEventOnce(AnalyticsEvents.MANUAL_COURSE_CREATION_REQUESTED, accountId, createKey, {
      entry_source: route.params?.fromProposalId ? 'planner_proposal' : 'manual_setup',
      from_proposal: Boolean(route.params?.fromProposalId),
    });
    const course = await store.createManualCourse({
      idempotencyKey: createKey,
      destinationText: destination,
      fromProposalId: route.params?.fromProposalId,
      waypoints: waypoints.map((waypoint) => ({
        title: waypoint.title.trim(),
        ...(waypoint.description.trim() ? { description: waypoint.description.trim() } : {}),
      })),
    });
    if (!course) {
      setSaving(false);
      setFieldError(store.errorCode === 'ACTIVE_COURSE_EXISTS' ? 'An active Course already exists. Archive it before publishing another.' : 'The Course could not be saved.');
      return;
    }
    trackChartEventOnce(AnalyticsEvents.MANUAL_COURSE_CREATED, accountId, course.id, {
      course_state: course.status,
      waypoint_count: course.waypointCount,
      from_proposal: Boolean(route.params?.fromProposalId),
      server_confirmed: true,
    });
    let next = course;
    if (publish) {
      const published = await store.publishCourse(course.id, course.version);
      if (!published) {
        setSaving(false);
        setFieldError(store.errorCode === 'ACTIVE_COURSE_EXISTS' ? 'An active Course already exists. Archive it before publishing another.' : 'The Course could not be published.');
        return;
      }
      next = published;
    }
    setSaving(false);
    if (next.status === 'ACTIVE') {
      navigation.navigate('ChartHome');
    } else {
      navigation.navigate('CourseEditor', { courseId: next.id });
    }
  };

  const generatePlan = async () => {
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
    trackChartEventOnce(AnalyticsEvents.CHART_PLANNER_GENERATION_REQUESTED, accountId, plannerKey, {
      entry_source: 'course_setup',
      offline: false,
    });
    try {
      const result = await chartApiClient.generateCoursePlan({
        destinationText: destination,
        idempotencyKey: plannerKey,
        // Anchors are always used as context; reflections only where the user
        // granted consent on the reflection itself.
        includeReflections: true,
      });
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
      setSaving(false);
    }
  };

  return (
    <ChartScreenFrame title="Plot Your Course" subtitle="Set a destination, then give it a path.">
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
          Add the steps that make the destination real. The server will determine lifecycle state after publishing.
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
            disabled={saving || store.offline || quota?.eligible === false}
            hint="Creates a proposal for review. It will not change your Course."
          />
        </ChartCard>
      ) : null}
      <ChartButton label="Save draft" onPress={() => void save(false)} disabled={saving || store.readOnly} />
      <ChartButton label="Publish Course" secondary onPress={() => void save(true)} disabled={saving || store.readOnly || waypoints.length === 0} />
    </ChartScreenFrame>
  );
};

export default CourseSetupScreen;
