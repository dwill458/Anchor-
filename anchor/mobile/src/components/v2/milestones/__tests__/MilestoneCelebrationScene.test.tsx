import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockHaptic = jest.fn();
const mockSound = jest.fn();
jest.mock('@/hooks/v2/haptics', () => ({
  v2Haptics: { confirmation: () => mockHaptic('confirmation'), completion: () => mockHaptic('completion') },
}));
jest.mock('@/services/CreationSounds', () => ({
  playCreationSound: (key: string) => mockSound(key),
}));

import { MilestoneCelebrationScene } from '../MilestoneCelebrationScene';
import type { MilestoneRecord } from '@/milestones/milestoneModel';
import { APPROVED_MILESTONE_ASSETS } from '@/milestones/approvedAssets';
import { approvedMotionDuration } from '@/milestones/approvedMotion';

const rec = (definitionId: string, metadata: unknown = {}): MilestoneRecord => ({
  id: 'm1',
  anchorId: 'a1',
  definitionId,
  definitionVersion: 1,
  earnedAt: '2026-10-14T12:00:00.000Z',
  sourceKind: 'PRACTICE_COMPLETION',
  sourceEntityId: null,
  metadata,
  celebratedAt: null,
});

describe('MilestoneCelebrationScene', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
  afterEach(() => jest.useRealTimers());

  it('shows the real title, description, and recorded value', () => {
    const { getByText, getByTestId } = render(
      <MilestoneCelebrationScene record={rec('strength.established', { strength: 52 })} mode="award" onContinue={jest.fn()} />,
    );
    expect(getByTestId('milestone-celebration-title').props.children).toBe('Established');
    expect(getByText(/reached Established \(50\)/)).toBeTruthy();
    expect(getByText('Thread Strength was 52 when you reached it.')).toBeTruthy();
    expect(getByText('MILESTONE · THREAD STRENGTH')).toBeTruthy();
  });

  it('plays exactly one haptic and one sound, even across re-renders', () => {
    const { rerender } = render(<MilestoneCelebrationScene record={rec('strength.reinforced')} mode="award" onContinue={jest.fn()} />);
    rerender(<MilestoneCelebrationScene record={rec('strength.reinforced')} mode="award" categoryColor="#CE6091" onContinue={jest.fn()} />);
    act(() => jest.advanceTimersByTime(2000));
    expect(mockHaptic).toHaveBeenCalledTimes(1);
    expect(mockHaptic).toHaveBeenCalledWith('completion');
    expect(mockSound).toHaveBeenCalledTimes(1);
    expect(mockSound).toHaveBeenCalledWith('milestoneT2Established');
  });

  it('uses the registry’s own haptic and sound per family', () => {
    render(<MilestoneCelebrationScene record={rec('commitment.practices.1')} mode="award" onContinue={jest.fn()} />);
    act(() => jest.advanceTimersByTime(2000));
    expect(mockHaptic).toHaveBeenCalledWith('confirmation');
    expect(mockSound).toHaveBeenCalledWith('milestoneT1Quiet');
  });

  it('still shows everything under Reduce Motion', () => {
    const { getByTestId, getByText } = render(
      <MilestoneCelebrationScene record={rec('journey.halfway')} mode="award" reducedMotion onContinue={jest.fn()} />,
    );
    expect(getByTestId('milestone-celebration-art')).toBeTruthy();
    expect(getByText('Halfway')).toBeTruthy();
  });

  it('labels a replay and says it changes nothing', () => {
    const { getByText } = render(<MilestoneCelebrationScene record={rec('journey.goal')} mode="replay" onContinue={jest.fn()} />);
    expect(getByText('REPLAY · JOURNEY')).toBeTruthy();
    expect(getByText('Replaying doesn’t change your progress.')).toBeTruthy();
    expect(getByText(/^Earned /)).toBeTruthy();
  });

  it('continues from the button and from the close control', () => {
    const onContinue = jest.fn();
    const { getByTestId } = render(<MilestoneCelebrationScene record={rec('commitment.minutes.100')} mode="award" onContinue={onContinue} />);
    fireEvent.press(getByTestId('milestone-celebration-continue'));
    fireEvent.press(getByTestId('milestone-celebration-close'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('cancels pending cues on navigation interruption', () => {
    const view = render(<MilestoneCelebrationScene record={rec('commitment.practices.1')} mode="award" onContinue={jest.fn()} />);
    view.unmount();
    act(() => jest.runAllTimers());
    expect(mockSound).not.toHaveBeenCalled();
    expect(mockHaptic).not.toHaveBeenCalled();
  });

  it('stops a playing sound when the presentation leaves', () => {
    const stop = jest.fn();
    mockSound.mockReturnValueOnce({ stop });
    const view = render(<MilestoneCelebrationScene record={rec('commitment.practices.1')} mode="award" onContinue={jest.fn()} />);
    act(() => jest.advanceTimersByTime(1600));
    view.unmount();
    expect(stop).toHaveBeenCalledWith(80);
  });

  it('settles into static artwork and omits traveling light with reduced motion', () => {
    const view = render(<MilestoneCelebrationScene record={rec('commitment.practices.1')} mode="replay" reducedMotion onContinue={jest.fn()} />);
    expect(view.getByText('Back to Milestones')).toBeTruthy();
    expect(view.queryByTestId('milestone-light-stream')).toBeNull();
    expect(view.getByTestId('milestone-artwork-earned')).toBeTruthy();
    expect(view.getByTestId('milestone-artwork-locked')).toBeTruthy();
    act(() => jest.advanceTimersByTime(320));
    expect(view.queryByTestId('milestone-artwork-locked')).toBeNull();
    expect(view.getByTestId('milestone-artwork-earned')).toBeTruthy();
  });

  it.each(['strength.building', 'commitment.practices.1', 'journey.goal', 'vision.first'])('keeps one stable artwork tree mounted through the finite %s reveal', definitionId => {
    const view = render(<MilestoneCelebrationScene record={rec(definitionId)} mode="replay" onContinue={jest.fn()} />);
    expect(view.getByTestId(`approved-reveal-${definitionId}`)).toBeTruthy();
    act(() => jest.advanceTimersByTime(approvedMotionDuration(APPROVED_MILESTONE_ASSETS[definitionId])));
    // No renderer swap at settle: the same animated tree stays mounted, holding its final values.
    expect(view.getByTestId(`approved-reveal-${definitionId}`)).toBeTruthy();
    expect(view.queryByTestId('milestone-light-stream')).toBeNull();
  });

  it('renders nothing, and cues nothing, for a milestone it has no definition for', () => {
    const { toJSON } = render(<MilestoneCelebrationScene record={rec('future.unknown')} mode="award" onContinue={jest.fn()} />);
    expect(toJSON()).toBeNull();
    expect(mockHaptic).not.toHaveBeenCalled();
    expect(mockSound).not.toHaveBeenCalled();
  });
});
