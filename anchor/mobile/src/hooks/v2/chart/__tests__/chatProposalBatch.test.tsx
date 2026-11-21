jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ trackChart: jest.fn(), refreshChartAfterProposal: (courseId: string, anchorId?: string | null) => mockRefresh(courseId, anchorId) }));
jest.mock('@/services/v2/askChartApi', () => ({ askChartApi: {} }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: Object.assign(() => null, { getState: () => ({ user: null }) }) }));
jest.mock('react-native-reanimated', () => require('@/__tests__/mocks/reactNativeReanimated').default);
const mockRefresh = jest.fn(async (..._args: any[]) => undefined);
import React from 'react';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { AskProposalCard } from '@/components/v2/chart/ask/AskProposalCard';
import { useAskProposals } from '../useAskProposals';
import { ChartRequestError } from '@/services/v2/chartV2Api';

const action = { type: 'ADD_MOVES', status: 'PENDING', summary: 'A plan', waypointTitle: null, moves: [{ title: 'First', rationale: 'Private detail' }, { title: 'Second' }, { title: 'Third' }] };
const message = { id: 'm', action } as any;
const accent = { text: '#000', border: '#000' } as any;
const props = { message, accent, busy: null, error: null, reducedMotion: true, onApprove: jest.fn(), onDismiss: jest.fn(), onReview: jest.fn() } as const;

test('renders all move titles in order with detail collapsed and supports one move', () => {
  const screen = render(<AskProposalCard {...props} />);
  expect(screen.getByText('First')).toBeTruthy();
  expect(screen.getByText('Second')).toBeTruthy();
  expect(screen.getByText('Third')).toBeTruthy();
  expect(screen.getByText('Private detail').props.numberOfLines).toBe(1);
  screen.rerender(<AskProposalCard {...props} message={{ ...message, action: { ...action, moves: [action.moves[0]] } }} />);
  expect(screen.getByText('First')).toBeTruthy();
  expect(screen.queryByText('Second')).toBeNull();
});

test('applies once before navigating, including a single move', async () => {
  let resolve!: (value: any) => void;
  const approve = jest.fn(() => new Promise<any>(r => { resolve = r; }));
  const applied = jest.fn();
  const hook = renderHook(() => useAskProposals({ courseId: 'c', commitChart: jest.fn(), markAction: jest.fn(), onMovesApplied: applied, onReviewRoute: jest.fn(), api: { approve, dismiss: jest.fn() } }));
  act(() => { void hook.result.current.approve({ ...message, action: { ...action, moves: [action.moves[0]] } }); void hook.result.current.approve(message); });
  expect(approve).toHaveBeenCalledTimes(1);
  expect(applied).not.toHaveBeenCalled();
  await act(async () => resolve({ chart: { moves: [] }, added: 1 }));
  expect(applied).toHaveBeenCalledTimes(1);
});

test('conflict refreshes before returning', async () => {
  const conflict = jest.fn();
  const hook = renderHook(() => useAskProposals({ courseId: 'c', anchorId: 'a', commitChart: jest.fn(), markAction: jest.fn(), onMovesApplied: jest.fn(), onReviewRoute: jest.fn(), onConflict: conflict, api: { approve: jest.fn().mockRejectedValue(new ChartRequestError('conflict', 'SYNC_CONFLICT')), dismiss: jest.fn() } }));
  await act(async () => { await hook.result.current.approve(message); });
  expect(mockRefresh).toHaveBeenCalledWith('c', 'a');
  expect(conflict).toHaveBeenCalledTimes(1);
  expect(mockRefresh.mock.invocationCallOrder[0]).toBeLessThan(conflict.mock.invocationCallOrder[0]);
});
import { ChartOneMoveRow } from '@/components/v2/chart/ChartOneMoveRow';
import { setChatAppliedBatch } from '../chatAppliedBatch';

test('undo appears for the active batch and hides when its first move is completed', async () => {
  const undoProposal = jest.fn().mockResolvedValue({ chart: {} });
  const api = require('@/services/v2/askChartApi').askChartApi;
  api.undoProposal = undoProposal;
  setChatAppliedBatch({ accountId: null, courseId: 'c', batchId: 'b', firstMoveId: 'first' });
  const rowProps = { accent: { text: '#000' } as any, move: { id: 'first', courseId: 'c', batchId: 'b', title: 'First', status: 'ACTIVE' } as any, waypointTitle: 'Waypoint', checked: false, busy: false, reducedMotion: true, onCheck: jest.fn() };
  const screen = render(<ChartOneMoveRow {...rowProps} />);
  expect(screen.getByText('Updated from chat')).toBeTruthy();
  expect(screen.getByTestId('chat-proposal-undo')).toBeTruthy();
  screen.rerender(<ChartOneMoveRow {...rowProps} firstBatchMoveCompleted />);
  expect(screen.queryByTestId('chat-proposal-undo')).toBeNull();
  screen.rerender(<ChartOneMoveRow {...rowProps} />);
  fireEvent.press(screen.getByTestId('chat-proposal-undo'));
  await waitFor(() => expect(undoProposal).toHaveBeenCalledWith('c', 'b'));
  await waitFor(() => expect(screen.queryByText('Updated from chat')).toBeNull());
});

describe('plans in chat proposals', () => {
  const NOW = new Date(2026, 10, 16, 10, 0);
  const planAction = {
    type: 'PLAN_MOVES', status: 'PENDING', summary: 'Your week', waypointId: 'w', waypointTitle: 'Mornings', moves: [],
    plans: [
      { moveId: 'a', title: 'Open the curtains', cue: 'After I wake up', date: '2026-11-17', time: '15:00' },
      { moveId: 'b', title: 'Drink the water', cue: null, date: '2026-11-19', time: null },
    ],
  };
  const planMessage = { id: 'plan-msg', action: planAction } as any;

  test('proposed moves show their plan chips, without a bell', () => {
    const withPlan = { ...action, moves: [{ title: 'First', rationale: null, cue: 'After lunch', date: '2026-11-16', time: '12:30' }, { title: 'Second', rationale: null, cue: null, date: null, time: null }] };
    const screen = render(<AskProposalCard {...props} now={NOW} message={{ ...message, action: withPlan }} />);
    expect(screen.getAllByTestId('ask-proposal-plan')).toHaveLength(1);
    expect(screen.getByText('After lunch')).toBeTruthy();
    expect(screen.getByText(/^Today · (12:30 PM|12:30)$/)).toBeTruthy();
    expect(screen.queryByText('Reminder on')).toBeNull();
  });

  test('a PLAN_MOVES card lists each move with its new plan and uses the plan labels', () => {
    const onApprove = jest.fn();
    const screen = render(<AskProposalCard {...props} now={NOW} message={planMessage} onApprove={onApprove} />);
    expect(screen.getAllByTestId('ask-proposal-plan-row')).toHaveLength(2);
    expect(screen.getByText('Open the curtains')).toBeTruthy();
    expect(screen.getByText(/^Tomorrow · (3:00 PM|15:00)$/)).toBeTruthy();
    expect(screen.getByText('Thu')).toBeTruthy();
    expect(screen.getByText('Use this plan')).toBeTruthy();
    expect(screen.getByText('Not now')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ask-proposal-approve'));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  test('the remind chip appears only with an offer, and reads "Reminder on" once set', () => {
    const applied = { ...planMessage, action: { ...planAction, status: 'APPLIED' } };
    const screen = render(<AskProposalCard {...props} now={NOW} message={applied} />);
    expect(screen.getByText('Plan saved to your Chart')).toBeTruthy();
    expect(screen.queryByTestId('ask-proposal-remind')).toBeNull();
    const onRemind = jest.fn();
    screen.rerender(<AskProposalCard {...props} now={NOW} message={applied} remind={{ time: '15:00', state: 'offer' }} onRemind={onRemind} />);
    expect(screen.getByText(/^Remind me at (3:00 PM|15:00)$/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('ask-proposal-remind'));
    expect(onRemind).toHaveBeenCalledTimes(1);
    screen.rerender(<AskProposalCard {...props} now={NOW} message={applied} remind={{ time: '15:00', state: 'on' }} onRemind={onRemind} />);
    expect(screen.getByTestId('ask-proposal-remind-on')).toBeTruthy();
  });

  test('applying PLAN_MOVES reports exactly the moves that now have a day and a time', async () => {
    const approve = jest.fn(async () => ({
      batchId: 'plan-msg',
      added: 0,
      chart: {
        moves: [
          { id: 'a', status: 'ACTIVE', position: 100, plan: { cue: 'After I wake up', date: '2026-11-17', time: '15:00', remind: false } },
          { id: 'b', status: 'ACTIVE', position: 200, plan: { cue: null, date: '2026-11-19', time: null, remind: false } },
          { id: 'c', status: 'ACTIVE', position: 300, plan: { cue: null, date: '2026-11-18', time: '09:00', remind: false } },
        ],
      },
    }));
    const applied = jest.fn();
    const hook = renderHook(() => useAskProposals({ courseId: 'c', commitChart: jest.fn(), markAction: jest.fn(), onMovesApplied: applied, onReviewRoute: jest.fn(), api: { approve, dismiss: jest.fn() } as any }));
    await act(async () => { await hook.result.current.approve(planMessage); });
    expect(applied).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'plan-msg', timedMoveIds: ['a'], remindTime: '15:00', titles: ['Open the curtains', 'Drink the water'] }));
  });

  test('applying moves with no time offers no reminder', async () => {
    const approve = jest.fn(async () => ({ batchId: 'm', added: 1, chart: { moves: [{ id: 'x', batchId: 'm', status: 'ACTIVE', position: 1, plan: { cue: 'After lunch', date: null, time: null, remind: false } }] } }));
    const applied = jest.fn();
    const hook = renderHook(() => useAskProposals({ courseId: 'c', commitChart: jest.fn(), markAction: jest.fn(), onMovesApplied: applied, onReviewRoute: jest.fn(), api: { approve, dismiss: jest.fn() } as any }));
    await act(async () => { await hook.result.current.approve(message); });
    expect(applied).toHaveBeenCalledWith(expect.objectContaining({ timedMoveIds: [], remindTime: null }));
  });

  test('undo shows on a move whose plan the batch changed', () => {
    const api = require('@/services/v2/askChartApi').askChartApi;
    api.undoProposal = jest.fn().mockResolvedValue({ chart: {} });
    setChatAppliedBatch({ accountId: null, courseId: 'c', batchId: 'plan-msg', firstMoveId: 'a', moveIds: ['a', 'b'] });
    const rowProps = { accent: { text: '#000' } as any, move: { id: 'a', courseId: 'c', batchId: null, title: 'Open the curtains', status: 'ACTIVE' } as any, waypointTitle: 'Waypoint', checked: false, busy: false, reducedMotion: true, onCheck: jest.fn() };
    const screen = render(<ChartOneMoveRow {...rowProps} />);
    expect(screen.getByTestId('chat-proposal-undo')).toBeTruthy();
    setChatAppliedBatch(null);
  });
});
