import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';

const mockRecords = jest.fn();
let mockStatus = 'ready';
jest.mock('@/hooks/v2/milestones/useAnchorMilestones', () => ({
  useAnchorMilestones: (anchorId: string) => ({
    records: mockRecords(anchorId),
    pendingCelebrations: [],
    status: mockStatus,
    refresh: jest.fn(),
    markCelebrated: jest.fn(),
  }),
}));

import { V2MilestoneCollectionScreen } from '../V2MilestoneCollectionScreen';
import { V2MilestoneDetailScreen } from '../V2MilestoneDetailScreen';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { MILESTONE_SPECS } from '@/milestones/registry';
import type { MilestoneRecord } from '@/milestones/milestoneModel';

const rec = (id: string, definitionId: string, earnedAt: string, metadata: unknown = {}): MilestoneRecord => ({
  id,
  anchorId: 'a1',
  definitionId,
  definitionVersion: 1,
  earnedAt,
  sourceKind: 'PRACTICE_COMPLETION',
  sourceEntityId: null,
  metadata,
  celebratedAt: '2026-10-01T00:00:00Z',
});

const EARNED = [
  rec('m1', 'commitment.practices.1', '2026-08-01T12:00:00.000Z'),
  rec('m2', 'strength.established', '2026-10-01T12:00:00.000Z', { strength: 52 }),
];

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = 'ready';
  mockRecords.mockReturnValue(EARNED);
  useMilestoneCelebrationStore.getState().reset();
});

describe('V2MilestoneCollectionScreen', () => {
  it('does not present false locked states or a zero-earned total during reconciliation', () => {
    mockRecords.mockReturnValue([]); mockStatus = 'loading';
    const view = render(<V2MilestoneCollectionScreen anchorId="a1" />);
    expect(view.getByText('Updating milestones…')).toBeTruthy();
    expect(view.queryByTestId('v2-milestone-collection-item-strength.full')).toBeNull();
    expect(view.queryByText(`0 of ${MILESTONE_SPECS.length} earned`)).toBeNull();
  });
  it('keeps cached earned content available offline without declaring other milestones locked', () => {
    mockStatus = 'offline';
    const view = render(<V2MilestoneCollectionScreen anchorId="a1" />);
    expect(view.getByTestId('v2-milestone-collection-item-strength.established')).toBeTruthy();
    expect(view.queryByTestId('v2-milestone-collection-item-strength.full')).toBeNull();
  });
  it('reads the milestones of the Anchor it was opened for', () => {
    render(<V2MilestoneCollectionScreen anchorId="a1" />);
    expect(mockRecords).toHaveBeenCalledWith('a1');
  });

  it('shows how many are earned and draws every earned one before every locked one', () => {
    const { getByTestId, getByText } = render(<V2MilestoneCollectionScreen anchorId="a1" />);
    expect(getByText(`2 of ${MILESTONE_SPECS.length} earned`)).toBeTruthy();
    expect(within(getByTestId('v2-milestone-collection-item-strength.established')).getByText('Established')).toBeTruthy();
    expect(getByTestId('v2-milestone-collection-item-strength.established')).toBeTruthy();
  });

  it('marks locked milestones Locked and never gives them a date', () => {
    const { getByTestId } = render(<V2MilestoneCollectionScreen anchorId="a1" />);
    expect(getByTestId('v2-milestone-collection-meta-strength.full').props.children).toBe('Locked');
    expect(getByTestId('v2-milestone-collection-item-strength.full').props.accessibilityLabel).toBe('Full Strength, locked');
    expect(getByTestId('v2-milestone-collection-item-strength.established').props.accessibilityLabel).toMatch(/^Established, earned/);
  });

  it('filters by family', () => {
    const { queryByTestId, getByText } = render(<V2MilestoneCollectionScreen anchorId="a1" />);
    fireEvent.press(getByText('Strength'));
    expect(queryByTestId('v2-milestone-collection-item-strength.building')).toBeTruthy();
    expect(queryByTestId('v2-milestone-collection-item-commitment.practices.1')).toBeNull();
    fireEvent.press(getByText('Commitment'));
    expect(queryByTestId('v2-milestone-collection-item-commitment.practices.1')).toBeTruthy();
    expect(queryByTestId('v2-milestone-collection-item-strength.building')).toBeNull();
    fireEvent.press(getByText('Journey'));
    expect(queryByTestId('v2-milestone-collection-item-journey.halfway')).toBeTruthy();
  });

  it('shows everything locked, honestly, for an Anchor with nothing earned', () => {
    mockRecords.mockReturnValue([]);
    const { getByText, getByTestId } = render(<V2MilestoneCollectionScreen anchorId="a1" />);
    expect(getByText(`0 of ${MILESTONE_SPECS.length} earned`)).toBeTruthy();
    expect(getByTestId('v2-milestone-collection-meta-commitment.practices.1').props.children).toBe('Locked');
  });

  it('opens a milestone and goes back', () => {
    const onOpen = jest.fn();
    const onBack = jest.fn();
    const { getByTestId } = render(<V2MilestoneCollectionScreen anchorId="a1" onOpenMilestone={onOpen} onBack={onBack} />);
    fireEvent.press(getByTestId('v2-milestone-collection-item-strength.full'));
    expect(onOpen).toHaveBeenCalledWith('strength.full');
    fireEvent.press(getByTestId('v2-milestone-collection-back'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('V2MilestoneDetailScreen', () => {
  it('shows an earned milestone: family, condition, date, recorded value, description and Replay', () => {
    const { getByTestId, getByText } = render(<V2MilestoneDetailScreen anchorId="a1" definitionId="strength.established" />);
    expect(getByTestId('v2-milestone-detail-title').props.children).toBe('Established');
    expect(getByText('THREAD STRENGTH')).toBeTruthy();
    expect(getByTestId('v2-milestone-detail-status')).toBeTruthy();
    expect(getByText('EARNED')).toBeTruthy();
    expect(getByTestId('v2-milestone-detail-condition').props.children).toBe('Reach 50 Thread Strength.');
    expect(getByTestId('v2-milestone-detail-date').props.children).toMatch(/2026/);
    expect(getByTestId('v2-milestone-detail-value').props.children).toBe('Thread Strength was 52 when you reached it.');
    expect(getByTestId('v2-milestone-detail-art-earned')).toBeTruthy();
    expect(getByTestId('v2-milestone-detail-replay')).toBeTruthy();
  });

  it('shows a locked milestone as locked: outline art, how to unlock, no date, value or Replay', () => {
    const { getByTestId, getByText, queryByTestId } = render(<V2MilestoneDetailScreen anchorId="a1" definitionId="strength.full" />);
    expect(getByText('LOCKED')).toBeTruthy();
    expect(getByTestId('v2-milestone-detail-art-locked')).toBeTruthy();
    expect(queryByTestId('v2-milestone-detail-art-earned')).toBeNull();
    expect(getByText('HOW TO UNLOCK')).toBeTruthy();
    expect(getByTestId('v2-milestone-detail-condition').props.children).toBe('Reach 100 Thread Strength.');
    expect(queryByTestId('v2-milestone-detail-date')).toBeNull();
    expect(queryByTestId('v2-milestone-detail-value')).toBeNull();
    expect(queryByTestId('v2-milestone-detail-replay')).toBeNull();
  });

  it('keeps the goal milestone a quiet discovery while it is locked', () => {
    const { getByTestId } = render(<V2MilestoneDetailScreen anchorId="a1" definitionId="journey.goal" />);
    expect(getByTestId('v2-milestone-detail-condition').props.children).toBe('A milestone for when this intention comes true.');
  });

  it('Replay only queues a non-awarding celebration and changes no record', () => {
    const { getByTestId } = render(<V2MilestoneDetailScreen anchorId="a1" definitionId="commitment.practices.1" />);
    fireEvent.press(getByTestId('v2-milestone-detail-replay'));
    const queue = useMilestoneCelebrationStore.getState().queue;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ mode: 'replay', accountId: null });
    expect(queue[0].record.id).toBe('m1');
    expect(mockRecords).toHaveReturnedWith(EARNED);
  });

  it('does not queue a second replay while one is waiting', () => {
    const { getByTestId } = render(<V2MilestoneDetailScreen anchorId="a1" definitionId="commitment.practices.1" />);
    fireEvent.press(getByTestId('v2-milestone-detail-replay'));
    fireEvent.press(getByTestId('v2-milestone-detail-replay'));
    expect(useMilestoneCelebrationStore.getState().queue).toHaveLength(1);
  });

  it('is clear about a milestone from a newer app version', () => {
    const onBack = jest.fn();
    const { getByTestId, getByText } = render(<V2MilestoneDetailScreen anchorId="a1" definitionId="future.unknown" onBack={onBack} />);
    expect(getByTestId('v2-milestone-detail-unknown')).toBeTruthy();
    fireEvent.press(getByText('Go Back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('reads the Anchor it was opened for', () => {
    render(<V2MilestoneDetailScreen anchorId="a1" definitionId="strength.established" />);
    expect(mockRecords).toHaveBeenCalledWith('a1');
  });
});
