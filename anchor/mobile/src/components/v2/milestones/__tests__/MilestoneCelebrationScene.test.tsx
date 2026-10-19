import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

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
  beforeEach(() => jest.clearAllMocks());

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
    expect(mockHaptic).toHaveBeenCalledTimes(1);
    expect(mockHaptic).toHaveBeenCalledWith('completion');
    expect(mockSound).toHaveBeenCalledTimes(1);
    expect(mockSound).toHaveBeenCalledWith('bloom');
  });

  it('uses the registry’s own haptic and sound per family', () => {
    render(<MilestoneCelebrationScene record={rec('commitment.practices.1')} mode="award" onContinue={jest.fn()} />);
    expect(mockHaptic).toHaveBeenCalledWith('confirmation');
    expect(mockSound).toHaveBeenCalledWith('practiceComplete');
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
    expect(onContinue).toHaveBeenCalledTimes(2);
  });

  it('renders nothing, and cues nothing, for a milestone it has no definition for', () => {
    const { toJSON } = render(<MilestoneCelebrationScene record={rec('future.unknown')} mode="award" onContinue={jest.fn()} />);
    expect(toJSON()).toBeNull();
    expect(mockHaptic).not.toHaveBeenCalled();
    expect(mockSound).not.toHaveBeenCalled();
  });
});
