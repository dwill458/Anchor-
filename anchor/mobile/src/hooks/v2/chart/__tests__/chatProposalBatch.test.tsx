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
