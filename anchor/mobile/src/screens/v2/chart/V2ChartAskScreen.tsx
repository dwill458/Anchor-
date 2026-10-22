import React, { useCallback, useEffect, useRef } from 'react';
import { StatusBar } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { AskChartView } from '@/components/v2/chart/ask/AskChartView';
import { AskActionUnavailable, AskProposalCard } from '@/components/v2/chart/ask/AskProposalCard';
import { askAccent } from '@/components/v2/chart/ask/askChartTheme';
import { useAskMedia } from '@/components/v2/chart/ask/useAskMedia';
import type { AskUiMessage } from '@/hooks/v2/chart/askChartState';
import { trackChart, useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { useAskChart } from '@/hooks/v2/chart/useAskChart';
import { useAskProposals } from '@/hooks/v2/chart/useAskProposals';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import type { AskSkill } from '@/services/v2/askChartApi';
import { useChartContext } from './chartScreenSupport';

export type V2ChartAskRouteParams = {
  anchorId: string;
  /** Start the conversation with this message instead of the greeting (e.g. "Break this move down"). */
  prompt?: { text: string; skill?: AskSkill; targetMoveId?: string | null };
  source?: string;
};

/**
 * Ongoing Ask Chart: the same cream conversation as creation, for an Anchor that already has a Chart. Suggestions
 * appear as cards; approving one saves it on the server, publishes the saved Chart to the shared cache, and only then
 * shows the Route Updated confirmation.
 */
export function V2ChartAskScreen() {
  const route = useRoute<RouteProp<Record<string, V2ChartAskRouteParams>, string>>();
  const navigation = useNavigation<any>();
  const { anchorId, prompt, source } = route.params;
  const reducedMotion = useV2ReduceMotion();
  const chart = useAnchorChart(anchorId);
  const context = useChartContext(anchorId, chart.data);
  const ask = useAskChart({ anchorId, reducedMotion, greet: !prompt });
  const courseId = chart.data?.chart?.id ?? null;

  useEffect(() => {
    trackChart('ask_chart_opened', { source: source ?? 'direct', seeded: Boolean(prompt) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A seeded conversation sends its first message once, and only into an empty conversation.
  const seeded = useRef(false);
  useEffect(() => {
    if (!prompt || seeded.current || ask.state.status !== 'ready' || ask.state.messages.length > 0) return;
    seeded.current = true;
    ask.send(prompt.text, { skill: prompt.skill, targetMoveId: prompt.targetMoveId ?? null });
  }, [ask, prompt]);

  // Coming back from the route review (or Route Updated): pick up a revision that was applied there.
  const firstFocus = useRef(true);
  const syncActions = ask.syncActions;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else void syncActions();
    }, [syncActions])
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const identity = context.identity ?? { intention: chart.data?.anchor.intentionText ?? '', category: chart.data?.anchor.category ?? null };
  const accent = askAccent(identity.category);
  const media = useAskMedia({ ask, anchorId, category: identity.category, reducedMotion });

  const proposals = useAskProposals({
    courseId,
    commitChart: chart.commitChart,
    markAction: ask.markAction,
    onMovesApplied: ({ added, waypointTitle }) =>
      navigation.navigate('V2ChartRouteUpdated', { anchorId, change: { kind: 'MOVES_ADDED', count: added, waypointTitle }, source: 'ask' }),
    onReviewRoute: message =>
      navigation.navigate('V2ChartAdjust', { anchorId, proposalId: message.action.routeProposalId, askMessageId: message.id }),
  });

  const mediaExtra = media.renderExtra;
  const renderExtra = useCallback(
    (message: AskUiMessage) => (
      <>
        {message.action ? (
          <AskProposalCard
            message={message}
            accent={accent}
            busy={proposals.busy[message.id] ?? null}
            error={proposals.failures[message.id] ?? null}
            reducedMotion={reducedMotion}
            onApprove={() => void proposals.approve(message)}
            onDismiss={() => void proposals.dismiss(message)}
            onReview={() => proposals.review(message)}
          />
        ) : null}
        {message.actionUnavailable && !message.action ? <AskActionUnavailable /> : null}
        {mediaExtra(message)}
      </>
    ),
    [accent, mediaExtra, proposals, reducedMotion]
  );

  return (
    <>
      <StatusBar barStyle="dark-content" animated />
      <AskChartView
        ask={ask}
        intention={identity.intention}
        category={identity.category}
        anchorArt={context.anchorArt}
        reducedMotion={reducedMotion}
        onBack={goBack}
        {...media}
        renderExtra={renderExtra}
        testID="v2-chart-ask"
      />
    </>
  );
}
