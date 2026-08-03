import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { chartApiClient, getChartErrorCode } from '@/services/ChartApiClient';
import { useCourseStore } from '@/stores/courseStore';
import type { ChartStackParamList, CoursePlanProposal } from '@/types/chart';
import {
  ChartButton,
  ChartCard,
  ChartScreenFrame,
  ReadOnlyNotice,
} from './chartUi';

type Navigation = NativeStackNavigationProp<
  ChartStackParamList,
  'AIPlanReview'
>;
type ReviewRoute = RouteProp<ChartStackParamList, 'AIPlanReview'>;

function keyFor(): string {
  return `chart-plan-accept-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const AIPlanReviewScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<ReviewRoute>();
  const store = useCourseStore();
  const acceptKey = useRef(keyFor()).current;
  const [proposal, setProposal] = useState<CoursePlanProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (store.offline) {
      setLoading(false);
      setError('You are offline. Connect to review this plan.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await chartApiClient.getCoursePlan(
        route.params.proposalId,
      );
      setProposal(result.data);
    } catch (cause) {
      const code = getChartErrorCode(cause);
      setError(
        code === 'FEATURE_DISABLED'
          ? 'AI planning is currently unavailable.'
          : 'This plan is unavailable or no longer current.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [route.params.proposalId, store.offline]);

  const accept = async () => {
    if (!proposal || store.offline || !store.flags.chart_write_enabled) return;
    setAccepting(true);
    setError(null);
    try {
      await chartApiClient.acceptCoursePlan(proposal.proposalId, acceptKey);
      await store.refresh();
      navigation.navigate('ChartHome');
    } catch (cause) {
      const code = getChartErrorCode(cause);
      setError(
        code === 'ACTIVE_COURSE_EXISTS'
          ? 'An active Course already exists. Review it before accepting another plan.'
          : 'This plan could not be accepted. Refresh and try again.',
      );
    } finally {
      setAccepting(false);
    }
  };

  return (
    <ChartScreenFrame
      title="Plan review"
      subtitle="This is a suggestion. Nothing changes until you accept it."
    >
      {loading ? (
        <ChartCard>
          <Text style={{ color: '#C0C0C0' }}>Loading suggested plan…</Text>
        </ChartCard>
      ) : null}
      {error ? (
        <ChartCard>
          <Text
            accessibilityLiveRegion="assertive"
            style={{ color: '#FFB1B1' }}
          >
            {error}
          </Text>
          <ChartButton
            label="Retry"
            secondary
            onPress={() => void load()}
            disabled={store.offline}
          />
        </ChartCard>
      ) : null}
      {proposal ? (
        <>
          <ChartCard emphasis>
            <Text
              style={{
                color: '#D4AF37',
                fontFamily: 'Inter-SemiBold',
                fontSize: 13,
              }}
            >
              DESTINATION
            </Text>
            <Text
              style={{
                color: '#F5F5DC',
                fontFamily: 'Cinzel-SemiBold',
                fontSize: 22,
              }}
            >
              {proposal.destinationInterpretation}
            </Text>
            {proposal.generationSource === 'deterministic_fallback' ? (
              <Text style={{ color: '#C0C0C0', fontSize: 14 }}>
                A simple planning outline is shown because a suggested plan was
                not available.
              </Text>
            ) : null}
          </ChartCard>
          <ChartCard>
            <Text
              style={{
                color: '#D4AF37',
                fontFamily: 'Inter-SemiBold',
                fontSize: 13,
              }}
            >
              SUGGESTED WAYPOINTS
            </Text>
            {proposal.waypoints.map((waypoint, index) => (
              <View
                key={waypoint.clientKey}
                accessibilityLabel={`Waypoint ${index + 1}: ${waypoint.title}`}
                style={{ gap: 4, paddingVertical: 8 }}
              >
                <Text
                  style={{
                    color: '#F5F5DC',
                    fontFamily: 'Inter-SemiBold',
                    fontSize: 16,
                  }}
                >
                  {index + 1}. {waypoint.title}
                </Text>
                <Text
                  style={{ color: '#C0C0C0', fontSize: 14, lineHeight: 20 }}
                >
                  {waypoint.description}
                </Text>
              </View>
            ))}
          </ChartCard>
          {store.offline ? (
            <ReadOnlyNotice reason="You are offline. Acceptance is unavailable until you reconnect." />
          ) : null}
          <ChartButton
            label="Accept plan and create Course"
            onPress={() => void accept()}
            disabled={
              accepting || store.offline || !store.flags.chart_write_enabled
            }
            hint="Creates a Course only after this explicit action."
          />
          <ChartButton
            label="Back without changes"
            secondary
            onPress={() => navigation.goBack()}
            disabled={accepting}
          />
        </>
      ) : null}
    </ChartScreenFrame>
  );
};

export default AIPlanReviewScreen;
