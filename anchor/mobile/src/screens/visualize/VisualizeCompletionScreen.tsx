import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/types';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePostPrimeTraceStore } from '@/stores/postPrimeTraceStore';
import { markPostPrimeTraceAttemptStarted } from '@/utils/postPrimeTraceEligibility';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { colors as themeColors, typography } from '@/theme';
import { useChartPracticeReturn } from '@/hooks/useChartPracticeReturn';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { calculatePracticeCompleteResult } from '@/utils/practiceCompletionCoordinator';
import { SessionCompletionScreen } from '@/screens/practice/SessionCompletionScreen';
import { PRACTICE_COMPLETION_PRESETS } from '@/screens/practice/practiceCompletionPresets';

type Props = NativeStackScreenProps<RootStackParamList, 'VisualizeCompletion'>;

const colors = {
  ...themeColors,
  gold: '#D4AF37',
  goldBright: '#F0CB6A',
  goldDim: '#8a6f23',
  goldLine: 'rgba(212,175,55,0.28)',
  bone: '#F5F0E8',
  boneSoft: 'rgba(245,240,232,0.62)',
  boneFaint: 'rgba(245,240,232,0.34)',
};

export const VisualizeCompletionScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const returnToChart = useChartPracticeReturn(navigation);
  const {
    navigateToSanctuary: canonicalNavigateToSanctuary,
    navigateToVault,
    returnToAnchorDetail: canonicalReturnToAnchorDetail,
  } = useTabNavigation();
  const navigateToSanctuary = canonicalNavigateToSanctuary ?? (() => navigateToVault());
  const returnToAnchorDetail =
    canonicalReturnToAnchorDetail ??
    ((anchorId: string) => navigateToVault('AnchorDetail', { anchorId }));

  const anchor = useAnchorStore((state) =>
    state.getAnchorById(route.params.anchorId),
  );
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const practiceHistory = useSessionStore((state) => state.practiceHistory);
  const completedSession = practiceHistory.find(
    (session) => session.id === route.params.sessionId,
  );

  const [nextAction, setNextAction] = useState('');
  const [saved, setSaved] = useState(false);

  const threadStrengthSensitivity = useSettingsStore(
    (state) => state.threadStrengthSensitivity,
  );
  const restDays = useSettingsStore((state) => state.restDays);

  const practiceCompleteResult = useMemo(
    () =>
      calculatePracticeCompleteResult({
        anchorId: route.params.anchorId,
        anchorLocalId: anchor?.localId,
        practiceMode: 'visualize',
        practiceHistory,
        accountId,
        completedSessionId: route.params.sessionId,
        newRecord: completedSession,
        sensitivity: threadStrengthSensitivity,
        restDays,
        returnTo: route.params.returnTo,
        returnTarget: route.params.returnTarget,
        source: route.params.practiceEntrySource,
        chartContext: route.params.chartContext,
      }),
    [
      accountId,
      anchor?.localId,
      completedSession,
      practiceHistory,
      restDays,
      route.params.anchorId,
      route.params.chartContext,
      route.params.practiceEntrySource,
      route.params.returnTarget,
      route.params.returnTo,
      route.params.sessionId,
      threadStrengthSensitivity,
    ],
  );
  const beginPostPrimeTraceFlow = usePostPrimeTraceStore((state) => state.beginFlow);
  const activeFlow = usePostPrimeTraceStore((state) => state.activeFlow);
  const [pendingPostPrimeFlowId, setPendingPostPrimeFlowId] = useState<string | null>(null);

  const handleBeginPostPrimeTrace = useCallback(async () => {
    await markPostPrimeTraceAttemptStarted();

    const flowId = beginPostPrimeTraceFlow(route.params.anchorId);
    setPendingPostPrimeFlowId(flowId);

    navigation.navigate('ManualReinforcement', {
      source: 'post_prime_trace',
      anchorId: route.params.anchorId,
    });
  }, [beginPostPrimeTraceFlow, navigation, route.params.anchorId]);

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
      AnalyticsService.track('post_prime_trace_completed', {
        anchor_id: route.params.anchorId,
        session_duration_seconds: route.params.durationSeconds,
      });
    }
  }, [activeFlow, pendingPostPrimeFlowId, route.params.anchorId, route.params.durationSeconds]);

  const allowsNextAction = route.params.durationSeconds >= 180;

  const returnToOrigin = () => {
    useAnchorStore.getState?.()?.updateAnchor?.(route.params.anchorId, {
      threadStrength: practiceCompleteResult.newThreadStrength,
    });

    (navigation as any).replace('PracticeComplete', practiceCompleteResult);
  };

  const handleVisualizeAgain = () => {
    AnalyticsService.track(
      AnalyticsEvents.VISUALIZE_PRACTICE_AGAIN_SELECTED,
      { anchor_id: route.params.anchorId },
    );
    navigation.replace('VisualizeSession', {
      anchorId: route.params.anchorId,
      durationSeconds: route.params.durationSeconds,
      sceneText: route.params.sceneText ?? completedSession?.sceneSnapshot ?? '',
      guidanceVoice: (completedSession?.guidanceVoice as any) ?? 'female',
      backgroundAudio: (completedSession?.backgroundAudio as any) ?? 'ambient',
      returnTo: route.params.returnTo === 'chart' ? 'chart' : 'practice',
      returnTarget: route.params.returnTarget,
      chartContext: route.params.chartContext,
      practiceMode: route.params.practiceMode ?? 'visualize',
      practiceEntrySource: route.params.practiceEntrySource,
    });
  };

  const saveNextAction = async () => {
    if (!accountId || !nextAction.trim()) return;
    Keyboard.dismiss();
    await PracticeCompletionService.saveNextAction({
      accountId,
      sessionId: route.params.sessionId,
      nextAction: nextAction.trim(),
    });
    setSaved(true);
    AnalyticsService.track(AnalyticsEvents.VISUALIZE_NEXT_ACTION_SAVED, {
      session_id: route.params.sessionId,
      anchor_id: route.params.anchorId,
      duration_seconds: route.params.durationSeconds,
      sync_outcome: 'queued',
    });
  };

  const preset = PRACTICE_COMPLETION_PRESETS.visualize;

  const carryCard = allowsNextAction ? (
    <View style={styles.carryCard}>
      <Text style={styles.carryLabel}>TAKE IT FORWARD</Text>
      <Text style={styles.carryQuestion}>
        What is one action you can take now that matches what you rehearsed?
      </Text>
      {saved ? (
        <View style={styles.nextSavedPill}>
          <Check size={14} color={colors.gold} />
          <Text style={styles.nextSavedText}>{nextAction}</Text>
        </View>
      ) : (
        <View style={styles.inputWrap}>
          <TextInput
            placeholder={'"Send the meeting outline before 9:00 AM."'}
            placeholderTextColor="rgba(245,240,232,0.28)"
            value={nextAction}
            onChangeText={setNextAction}
            style={styles.nextInput}
          />
          <Pressable
            disabled={!nextAction.trim()}
            onPress={() => void saveNextAction()}
            style={[styles.saveActionBtn, !nextAction.trim() && styles.saveActionDisabled]}
          >
            <Text style={styles.saveActionText}>SAVE ACTION</Text>
          </Pressable>
        </View>
      )}
    </View>
  ) : undefined;

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
    <View style={styles.container}>
      <SessionCompletionScreen
        practiceMode="visualize"
        anchor={anchor}
        durationSeconds={route.params.durationSeconds}
        threadDelta={practiceCompleteResult.newThreadStrength - practiceCompleteResult.previousThreadStrength}
        eyebrow={preset.eyebrow}
        headline={preset.headline}
        accentColor={preset.accentColor}
        repeatLabel={preset.repeatLabel}
        onContinue={returnToOrigin}
        onRepeat={handleVisualizeAgain}
        secondaryAction={traceSecondaryAction}
        belowStatsContent={carryCard}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  ghostBtnText: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    letterSpacing: 0.4,
    color: colors.boneSoft,
  },
  carryCard: {
    width: '100%',
    marginTop: 16,
    gap: 10,
    alignItems: 'center',
  },
  carryLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: 9,
    letterSpacing: 2.8,
    color: colors.gold,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  carryQuestion: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 15.5,
    color: colors.boneSoft,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  nextInput: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
    backgroundColor: 'rgba(245,240,232,0.04)',
    color: colors.bone,
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 16,
    textAlign: 'center',
  },
  saveActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  saveActionDisabled: {
    opacity: 0.35,
  },
  saveActionText: {
    fontFamily: typography.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: colors.goldBright,
    textTransform: 'uppercase',
  },
  nextSavedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  nextSavedText: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 16,
    color: colors.bone,
  },
});
