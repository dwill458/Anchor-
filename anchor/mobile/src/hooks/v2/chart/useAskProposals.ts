import { useCallback, useRef, useState } from 'react';
import { askChartApi, type AskAction } from '@/services/v2/askChartApi';
import { classifyChartError } from '@/services/v2/chartV2Api';
import { trackChart } from '@/hooks/v2/chart/useAnchorChart';
import { setChatAppliedBatch } from './chatAppliedBatch';
import { useAuthStore } from '@/stores/authStore';
import { refreshChartAfterProposal } from '@/hooks/v2/chart/useAnchorChart';
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
  /**
   * Called only after the server has saved the moves or plans. `timedMoveIds` are the applied moves that now have
   * a date and a time, so a reminder can be offered for them; `remindTime` is the earliest of those times.
   */
  onMovesApplied: (result: {
    added: number;
    waypointTitle: string | null;
    titles: string[];
    messageId: string;
    timedMoveIds: string[];
    remindTime: string | null;
  }) => void;
  /** A route revision is reviewed and applied on the existing route-review screen. */
  onReviewRoute: (message: AskUiMessage & { action: AskAction }) => void;
  onConflict?: () => void;
  anchorId?: string;
  api?: Api;
};

/**
 * Approving, dismissing and reviewing what Ask Chart proposes. The only thing sent to the server is the person's
 * decision: it applies exactly what it stored. Nothing is shown as saved until the server confirms it.
 */
export function useAskProposals({ courseId, commitChart, markAction, onMovesApplied, onReviewRoute, onConflict, anchorId, api = askChartApi }: Options) {
  const locks = useRef(new Set<string>());
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
      if (!courseId || !action || (action.type !== 'ADD_MOVES' && action.type !== 'PLAN_MOVES') || locks.current.has(message.id)) return;
      locks.current.add(message.id);
      setOne<ProposalBusy>(setBusy, message.id, 'approving');
      setOne<ProposalFailure>(setFailures, message.id, null);
      try {
        const result = await api.approve(courseId, message.id);
        const accountId = useAuthStore.getState().user?.id ?? null;
        const planned = action.type === 'PLAN_MOVES' ? (action.plans ?? []).map(plan => plan.moveId) : [];
        const applied = action.type === 'PLAN_MOVES'
          ? (result.chart.moves ?? []).filter(move => planned.includes(move.id))
          : (result.chart.moves ?? []).filter(move => move.batchId === result.batchId).sort((a, b) => a.position - b.position);
        const first = applied[0];
        if (result.batchId && first) {
          setChatAppliedBatch({ accountId, courseId, batchId: result.batchId, firstMoveId: first.id, ...(planned.length ? { moveIds: planned } : {}) });
        }
        const timed = applied.filter(move => move.status === 'ACTIVE' && move.plan?.date && move.plan?.time && !move.plan.remind);
        const remindTime = timed.map(move => move.plan!.time!).sort()[0] ?? null;
        markAction(message.id, 'APPLIED');
        trackChart('chat_proposal_applied', { moves: result.added });
        trackChart('ask_chart_proposal_applied', { type: action.type, moves: result.added });
        onMovesApplied({
          added: result.added,
          waypointTitle: action.waypointTitle,
          titles: action.type === 'PLAN_MOVES' ? (action.plans ?? []).map(plan => plan.title) : action.moves.map(move => move.title),
          messageId: message.id,
          timedMoveIds: timed.map(move => move.id),
          remindTime,
        });
      } catch (caught) {
        const error = classifyChartError(caught);
        if (error.code === 'SYNC_CONFLICT') {
          trackChart('chat_proposal_conflict');
          trackChart('ask_chart_proposal_failed', { kind: error.kind, stale: false });
          try { await refreshChartAfterProposal(courseId, anchorId); } catch { /* return to Chart even if offline */ }
          onConflict?.();
          return;
        }
        const stale = error.code === 'PROPOSAL_STALE' || error.code === 'PROPOSAL_UNAVAILABLE';
        setOne<ProposalFailure>(setFailures, message.id, stale ? 'stale' : error.kind === 'offline' ? 'offline' : 'failed');
        trackChart('ask_chart_proposal_failed', { kind: error.kind, stale });
      } finally {
        locks.current.delete(message.id);
        setOne<ProposalBusy>(setBusy, message.id, null);
      }
    },
    [api, commitChart, courseId, markAction, onMovesApplied, onConflict, anchorId, setOne]
  );

  const dismiss = useCallback(
    async (message: AskUiMessage) => {
      if (!courseId || !message.action || locks.current.has(message.id)) return;
      locks.current.add(message.id);
      setOne<ProposalBusy>(setBusy, message.id, 'dismissing');
      try {
        await api.dismiss(courseId, message.id);
        markAction(message.id, 'DISMISSED');
        setOne<ProposalFailure>(setFailures, message.id, null);
      } catch {
        setOne<ProposalFailure>(setFailures, message.id, 'failed');
      } finally {
        locks.current.delete(message.id);
        setOne<ProposalBusy>(setBusy, message.id, null);
      }
    },
    [api, courseId, markAction, setOne]
  );

  const review = useCallback(
    (message: AskUiMessage) => {
      if (message.action?.type === 'REVISE_ROUTE' && message.action.routeProposalId) onReviewRoute(message as AskUiMessage & { action: AskAction });
    },
    [onReviewRoute]
  );

  return { busy, failures, approve, dismiss, review };
}
