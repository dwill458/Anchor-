import React, { useMemo } from 'react';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { useAskChart } from '@/hooks/v2/chart/useAskChart';
import { draftPlanInput } from '@/hooks/v2/chart/askChartState';
import type { AskChartApi, AskPlanInput } from '@/services/v2/askChartApi';
import type { ChartAnchorArt } from '../ChartLandscape';
import type { ChartIdentity } from '../ChartChrome';
import { AskChartView } from './AskChartView';
import { useAskMedia } from './useAskMedia';

const COPY = CHART_COPY.ask;

export type AskPlanSource = 'assistant_ready' | 'draft_early';

type Props = {
  anchorId: string;
  identity: ChartIdentity;
  anchorArt: ChartAnchorArt | null;
  reducedMotion: boolean;
  onBack: () => void;
  /** The person asked for a route (the assistant said it was ready, or they asked for a draft early). */
  onPlan: (input: AskPlanInput, source: AskPlanSource) => void;
  api?: AskChartApi;
  testID?: string;
};

/**
 * Creation: the cream conversation that replaces the old starting-point screen. It knows the Anchor, the intention
 * and the Vision already, greets the person from them, and hands a plan request to the existing planner once there
 * is enough to plan from, or sooner when asked.
 */
export function ChartCreationAsk({ anchorId, identity, anchorArt, reducedMotion, onBack, onPlan, api, testID }: Props) {
  const ask = useAskChart({ anchorId, api, reducedMotion });
  // Voice, photos and the composer text. The composer clears only once a message has been accepted for sending.
  const media = useAskMedia({ ask, anchorId, category: identity.category, reducedMotion });

  const { planInput } = ask;
  const hasGreeting = ask.state.messages.some(message => message.role === 'ASSISTANT');
  const primaryAction = useMemo(
    () => (planInput ? { label: COPY.buildRoute, onPress: () => onPlan(planInput, 'assistant_ready'), testID: 'ask-build-route' } : null),
    [onPlan, planInput]
  );
  const secondaryAction = useMemo(
    () =>
      !planInput && !ask.busy && (hasGreeting || ask.state.status === 'load_failed' || ask.state.openingFailed)
        ? { label: COPY.draftNow, onPress: () => onPlan(draftPlanInput(ask.state.messages, identity.intention), 'draft_early'), testID: 'ask-draft-now' }
        : null,
    [ask.busy, ask.state.messages, ask.state.openingFailed, ask.state.status, hasGreeting, identity.intention, onPlan, planInput]
  );

  return (
    <AskChartView
      ask={ask}
      intention={identity.intention}
      category={identity.category}
      anchorArt={anchorArt}
      reducedMotion={reducedMotion}
      onBack={onBack}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      {...media}
      testID={testID ?? 'chart-ask'}
    />
  );
}
