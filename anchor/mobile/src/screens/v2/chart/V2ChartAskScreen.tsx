import React, { useCallback, useEffect, useRef } from 'react';
import { Alert, StatusBar } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { AskChartView } from '@/components/v2/chart/ask/AskChartView';
import { AskActionUnavailable, AskProposalCard } from '@/components/v2/chart/ask/AskProposalCard';
import { askAccent } from '@/components/v2/chart/ask/askChartTheme';
import { useAskMedia } from '@/components/v2/chart/ask/useAskMedia';
import type { AskStarter } from '@/components/v2/chart/ask/AskStarters';
import { CHART_COPY } from '@/constants/v2/chartCopy';
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

  const shown = useRef(new Set<string>());
  useEffect(() => {
    for (const message of ask.state.messages) {
      if (message.action?.type === 'ADD_MOVES' && message.action.status === 'PENDING' && !shown.current.has(message.id)) {
        shown.current.add(message.id);
        trackChart('chat_proposal_shown', { moves: message.action.moves.length });
      }
    }
  }, [ask.state.messages]);

  const proposals = useAskProposals({
    anchorId,
    onConflict: () => { Alert.alert('', 'This changed elsewhere. Reopening your chart.'); goBack(); },
    courseId,
    commitChart: chart.commitChart,
    markAction: ask.markAction,
    onMovesApplied: () => goBack(),
    onReviewRoute: message =>
      navigation.navigate('V2ChartAdjust', { anchorId, proposalId: message.action.routeProposalId, askMessageId: message.id }),
  });

  // Where the person is on the Chart: the move they are on, and the waypoint it belongs to.
  const course = chart.data?.chart ?? null;
  const currentMove = course?.moves?.find(move => move.id === course.currentMoveId && move.status === 'ACTIVE') ?? null;
  const currentWaypoint = course?.waypoints?.find(waypoint => waypoint.id === (currentMove?.waypointId ?? course.currentWaypointId)) ?? null;
  const contextLine = currentWaypoint ? CHART_COPY.ask.contextLine(currentWaypoint.title, currentMove?.title ?? null) : null;
  const starterCopy = CHART_COPY.ask.starters;
  const starters = React.useMemo<AskStarter[]>(() => {
    if (!course) return [];
    const list: AskStarter[] = [];
    if (currentMove) list.push({ key: 'break', label: starterCopy.breakDown, onPress: () => ask.send(starterCopy.breakDown, { skill: 'BREAK_DOWN', targetMoveId: currentMove.id }) });
    list.push({ key: 'week', label: starterCopy.planWeek, onPress: () => ask.send(starterCopy.planWeek, { skill: 'PLAN_WEEK' }) });
    if (currentMove) list.push({ key: 'another', label: starterCopy.anotherWay, onPress: () => ask.send(starterCopy.anotherWay, { skill: 'ANOTHER_APPROACH', targetMoveId: currentMove.id }) });
    return list;
  }, [ask, course, currentMove, starterCopy]);

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
        contextLine={contextLine}
        starters={prompt ? undefined : starters}
        testID="v2-chart-ask"
      />
    </>
  );
}
