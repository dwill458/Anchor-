import { useCallback, useState } from 'react';
import { askChartApi, type AskAction } from '@/services/v2/askChartApi';
import { classifyChartError } from '@/services/v2/chartV2Api';
import { trackChart } from '@/hooks/v2/chart/useAnchorChart';
import type { CourseDetail } from '@/types/chart';
import type { AskUiMessage } from './askChartState';

export type ProposalBusy = 'approving' | 'dismissing';
export type ProposalFailure = 'stale' | 'offline' | 'failed';

type Api = Pick<typeof askChartApi, 'approve' | 'dismiss'>;

type Options = {
  courseId: string | null;
  /** Publishes the saved Chart to the shared cache, so the Chart is already updated when the person goes back. */
  commitChart: (chart: CourseDetail) => void;
  /** The conversation's own state: marks a proposal applied or dismissed once the server has said so. */
  markAction: (messageId: string, status: 'APPLIED' | 'DISMISSED') => void;
  /** Called only after the server has saved the moves. */
  onMovesApplied: (result: { added: number; waypointTitle: string | null; titles: string[] }) => void;
  /** A route revision is reviewed and applied on the existing route-review screen. */
  onReviewRoute: (message: AskUiMessage & { action: AskAction }) => void;
  api?: Api;
};

/**
 * Approving, dismissing and reviewing what Ask Chart proposes. The only thing sent to the server is the person's
 * decision: it applies exactly what it stored. Nothing is shown as saved until the server confirms it.
 */
export function useAskProposals({ courseId, commitChart, markAction, onMovesApplied, onReviewRoute, api = askChartApi }: Options) {
  const [busy, setBusy] = useState<Record<string, ProposalBusy>>({});
  const [failures, setFailures] = useState<Record<string, ProposalFailure>>({});

  const setOne = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<Record<string, T>>>, id: string, value: T | null) => {
    setter(current => {
      const next = { ...current };
      if (value === null) delete next[id];
      else next[id] = value;
      return next;
    });
  }, []);

  const approve = useCallback(
    async (message: AskUiMessage) => {
      const action = message.action;
      if (!courseId || !action || action.type !== 'ADD_MOVES' || busy[message.id]) return;
      setOne<ProposalBusy>(setBusy, message.id, 'approving');
      setOne<ProposalFailure>(setFailures, message.id, null);
      try {
        const result = await api.approve(courseId, message.id);
        commitChart(result.chart);
        markAction(message.id, 'APPLIED');
        trackChart('ask_chart_proposal_applied', { type: action.type, moves: result.added });
        onMovesApplied({ added: result.added, waypointTitle: action.waypointTitle, titles: action.moves.map(move => move.title) });
      } catch (caught) {
        const error = classifyChartError(caught);
        const stale = error.code === 'PROPOSAL_STALE' || error.code === 'PROPOSAL_UNAVAILABLE';
        setOne<ProposalFailure>(setFailures, message.id, stale ? 'stale' : error.kind === 'offline' ? 'offline' : 'failed');
        trackChart('ask_chart_proposal_failed', { kind: error.kind, stale });
      } finally {
        setOne<ProposalBusy>(setBusy, message.id, null);
      }
    },
    [api, busy, commitChart, courseId, markAction, onMovesApplied, setOne]
  );

  const dismiss = useCallback(
    async (message: AskUiMessage) => {
      if (!courseId || !message.action || busy[message.id]) return;
      setOne<ProposalBusy>(setBusy, message.id, 'dismissing');
      try {
        await api.dismiss(courseId, message.id);
        markAction(message.id, 'DISMISSED');
        setOne<ProposalFailure>(setFailures, message.id, null);
      } catch {
        setOne<ProposalFailure>(setFailures, message.id, 'failed');
      } finally {
        setOne<ProposalBusy>(setBusy, message.id, null);
      }
    },
    [api, busy, courseId, markAction, setOne]
  );

  const review = useCallback(
    (message: AskUiMessage) => {
      if (message.action?.type === 'REVISE_ROUTE' && message.action.routeProposalId) onReviewRoute(message as AskUiMessage & { action: AskAction });
    },
    [onReviewRoute]
  );

  return { busy, failures, approve, dismiss, review };
}
