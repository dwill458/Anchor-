import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { PracticeStackParamList } from '@/types';
import { useAnchorStore } from '@/stores/anchorStore';
import { usePracticeEntry } from '@/hooks/usePracticeEntry';
import { usePostPrimeTraceStore } from '@/stores/postPrimeTraceStore';
import { markPostPrimeTraceAttemptStarted } from '@/utils/postPrimeTraceEligibility';
import { AnalyticsService } from '@/services/AnalyticsService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import { typography } from '@/theme';
import { SessionCompletionScreen } from '@/screens/practice/SessionCompletionScreen';
import { PRACTICE_COMPLETION_PRESETS } from '@/screens/practice/practiceCompletionPresets';

type NavigationProp = NativeStackNavigationProp<PracticeStackParamList, 'FocusCompletion'>;
type RouteProps = RouteProp<PracticeStackParamList, 'FocusCompletion'>;

export const FocusCompletionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { durationSeconds, ...result } = route.params;
  const {
    anchorId,
    previousThreadStrength,
    newThreadStrength,
    source,
    chartContext,
  } = result;

  const anchor = useAnchorStore((state) => state.getAnchorById(anchorId));
  const { startPractice } = usePracticeEntry();
  const preset = PRACTICE_COMPLETION_PRESETS.focus;

  const beginPostPrimeTraceFlow = usePostPrimeTraceStore((state) => state.beginFlow);
  const activeFlow = usePostPrimeTraceStore((state) => state.activeFlow);
  const [pendingPostPrimeFlowId, setPendingPostPrimeFlowId] = useState<string | null>(null);

  const handleBeginPostPrimeTrace = useCallback(async () => {
    await markPostPrimeTraceAttemptStarted();

    const flowId = beginPostPrimeTraceFlow(anchorId);
    setPendingPostPrimeFlowId(flowId);

    navigation.navigate('ManualReinforcement', {
      source: 'post_prime_trace',
      anchorId,
    });
  }, [anchorId, beginPostPrimeTraceFlow, navigation]);

  useEffect(() => {
    if (!pendingPostPrimeFlowId) {
      return;
    }

    if (
      !activeFlow ||
      activeFlow.flowId !== pendingPostPrimeFlowId ||
      activeFlow.result === 'pending'
    ) {
      return;
    }

    const completedPostPrimeTrace = activeFlow.result === 'completed';

    usePostPrimeTraceStore.getState().clearFlow(pendingPostPrimeFlowId);
    setPendingPostPrimeFlowId(null);

    if (completedPostPrimeTrace) {
      FrictionAnalytics.completeFlow('activation', {
        anchor_id: anchorId,
        result: 'post_prime_trace_completed',
        session_duration_seconds: durationSeconds,
      });
      AnalyticsService.track('post_prime_trace_completed', {
        anchor_id: anchorId,
        session_duration_seconds: durationSeconds,
      });
    }
  }, [activeFlow, anchorId, durationSeconds, pendingPostPrimeFlowId]);

  const handleContinue = useCallback(() => {
    navigation.replace('PracticeComplete', result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, result]);

  const handleRepeat = useCallback(() => {
    startPractice({
      mode: 'focus',
      anchorId,
      source: source ?? 'practice_focus_card',
      durationSeconds,
      chartContext,
    });
  }, [anchorId, chartContext, durationSeconds, source, startPractice]);

  const traceSecondaryAction = anchor ? (
    <TouchableOpacity
      style={styles.traceSecondaryBtn}
      onPress={handleBeginPostPrimeTrace}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Trace"
      testID="post-prime-trace-button"
    >
      <Text style={styles.traceSecondaryText}>Trace</Text>
    </TouchableOpacity>
  ) : undefined;

  return (
    <View style={styles.wrapper}>
      <SessionCompletionScreen
        practiceMode="focus"
        anchor={anchor}
        durationSeconds={durationSeconds}
        threadDelta={newThreadStrength - previousThreadStrength}
        eyebrow={preset.eyebrow}
        headline={preset.headline}
        accentColor={preset.accentColor}
        repeatLabel={preset.repeatLabel}
        onContinue={handleContinue}
        onRepeat={handleRepeat}
        secondaryAction={traceSecondaryAction}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  traceSecondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  traceSecondaryText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
