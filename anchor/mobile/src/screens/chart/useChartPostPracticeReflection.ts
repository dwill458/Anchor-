import { useEffect, useRef } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useReflectionDraftStore } from '@/stores/reflectionDraftStore';
import type { ChartStackParamList, ReflectionPromptType } from '@/types/chart';
import type {
  ChartPracticeCompletionHandoff,
  ChartPracticeMode,
} from '@/types/practice';

const PROMPT_BY_MODE: Readonly<Record<ChartPracticeMode, ReflectionPromptType>> = {
  focus: 'HOW_DO_YOU_FEEL_NOW',
  visualize: 'WHAT_STOOD_OUT',
  deepPrime: 'WHAT_FELT_STRONGEST',
};

export function chartPostPracticePrompt(mode: ChartPracticeMode): ReflectionPromptType {
  return PROMPT_BY_MODE[mode];
}

export function chartPostPracticeOfferKey(practiceSessionId: string): string {
  return `post-practice:${practiceSessionId}`;
}

type Navigation = NativeStackNavigationProp<ChartStackParamList, 'WaypointDetail'>;

export function useChartPostPracticeReflection(args: {
  navigation: Navigation;
  courseId: string;
  waypointId: string;
  handoff?: ChartPracticeCompletionHandoff;
}): void {
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const reflectionsEnabled = useCourseStore(
    (state) => state.flags.chart_reflections_enabled,
  );
  const draftAccountId = useReflectionDraftStore((state) => state.accountId);
  const hydrated = useReflectionDraftStore((state) => state.hydrated);
  const handledOfferKeys = useReflectionDraftStore((state) => state.handledOfferKeys);
  const bindAccount = useReflectionDraftStore((state) => state.bindAccount);
  const markOfferHandled = useReflectionDraftStore((state) => state.markOfferHandled);
  const presentingRef = useRef<string | null>(null);

  useEffect(() => {
    if (draftAccountId !== accountId) void bindAccount(accountId);
  }, [accountId, bindAccount, draftAccountId]);

  useEffect(() => {
    const handoff = args.handoff;
    if (!handoff || !accountId || draftAccountId !== accountId || !hydrated) return;

    const offerKey = chartPostPracticeOfferKey(handoff.practiceSessionId);
    if (handledOfferKeys.includes(offerKey)) {
      args.navigation.setParams({ practiceReturn: undefined });
      return;
    }
    if (presentingRef.current === offerKey) return;
    presentingRef.current = offerKey;

    void (async () => {
      try {
        // Persist before presenting. Re-render, focus, dismiss, or process
        // restart can then never hand off the same canonical session twice.
        await markOfferHandled(offerKey);
        args.navigation.setParams({ practiceReturn: undefined });
        if (!reflectionsEnabled) return;

        args.navigation.navigate('ReflectionComposer', {
          source: 'POST_PRACTICE',
          promptType: chartPostPracticePrompt(handoff.practiceMode),
          promptVersion: 1,
          courseId: args.courseId,
          waypointId: args.waypointId,
          practiceSessionId: handoff.practiceSessionId,
          anchorId: handoff.anchorId,
          draftKey: `reflection:${accountId}:post-practice:${handoff.practiceSessionId}`,
          autoPresented: true,
        });
      } catch {
        // The durable handled marker is the idempotency boundary. If secure
        // storage is unavailable, fail closed instead of risking a duplicate.
      } finally {
        presentingRef.current = null;
      }
    })();
  }, [
    accountId,
    args.courseId,
    args.handoff,
    args.navigation,
    args.waypointId,
    draftAccountId,
    handledOfferKeys,
    hydrated,
    markOfferHandled,
    reflectionsEnabled,
  ]);
}
