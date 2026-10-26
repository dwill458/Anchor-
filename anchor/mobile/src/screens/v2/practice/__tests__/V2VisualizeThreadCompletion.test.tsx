import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { V2PracticeSessionScreen } from '../V2PracticeSessionScreen';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

let mockCinematic: any;
let mockCompletion: any;
jest.mock('../visualize/V2CinematicSessionScreen', () => ({
  V2CinematicSessionScreen: (props: any) => {
    mockCinematic = props;
    return require('react').createElement(require('react-native').Text, null, 'Cinematic');
  },
}));
const mockRecordVisionView = jest.fn();
jest.mock('@/hooks/v2/vision', () => ({ useV2Vision: () => ({
  state: { state: 'ready' }, tiles: [], description: 'Saved Vision', vision: { id: 'v1' }, recordVisionView: mockRecordVisionView,
}) }));
jest.mock('../focus', () => ({
  V2FocusActiveScreen: () => null,
  V2FocusCompleteScreen: (props: any) => {
    mockCompletion = props;
    return require('react').createElement(require('react-native').Pressable, { accessibilityLabel: 'Thread Done', onPress: props.onDone },
      require('react').createElement(require('react-native').Text, null, props.practiceTitle + ' complete'));
  },
}));
const anchor = makeAnchor({ id: 'a1', userId: 'u1', threadStrength: 20 });
const record: any = { id: 's1', plannedDurationSeconds: 60, completedDurationSeconds: 65, threadStrengthBefore: 20, threadStrengthAfter: 24, syncState: 'synced' };

beforeEach(() => {
  mockRecordVisionView.mockClear();
  useAuthStore.setState({ user: { id: 'u1' } as any });
  useAnchorStore.setState({ anchors: [anchor] });
  useSessionStore.setState({ practiceHistory: [record] });
});

it('enters the existing Thread completion and returns saved mode/duration to Today only on Done', () => {
  const onCompleted = jest.fn();
  const view = render(<V2PracticeSessionScreen anchorId="a1" mode="visualize" durationSeconds={60}
    source="practice_hub" onBack={jest.fn()} onCompleted={onCompleted} onFocusAgain={jest.fn()} />);
  expect(view.getByText('Cinematic')).toBeTruthy();
  act(() => mockCinematic.onContinue({ record, saved: true }));
  expect(view.getByText('Visualize complete')).toBeTruthy();
  expect(mockCompletion.beforeStrength).toBe(20);
  expect(mockCompletion.afterStrength).toBe(24);
  expect(onCompleted).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText('Thread Done'));
  fireEvent.press(view.getByLabelText('Thread Done'));
  expect(onCompleted).toHaveBeenCalledTimes(1);
  expect(onCompleted).toHaveBeenCalledWith({ mode: 'visualize', durationSeconds: 65, saved: true });
});

it('reports failed persistence truthfully instead of showing a saved reinforcement', () => {
  const onCompleted = jest.fn();
  const view = render(<V2PracticeSessionScreen anchorId="a1" mode="visualize" durationSeconds={180}
    source="practice_hub" onBack={jest.fn()} onCompleted={onCompleted} onFocusAgain={jest.fn()} />);
  act(() => mockCinematic.onContinue({ record: null, saved: false }));
  expect(mockCompletion.sessionSaved).toBe(false);
  fireEvent.press(view.getByLabelText('Thread Done'));
  expect(onCompleted).toHaveBeenCalledWith({ mode: 'visualize', durationSeconds: 200, saved: false });
});

it('marks the Vision seen today when a Visualize session starts, whichever way the person arrived, and only once', () => {
  const view = render(<V2PracticeSessionScreen anchorId="a1" mode="visualize" durationSeconds={180}
    source="practice_hub" onBack={jest.fn()} onCompleted={jest.fn()} onFocusAgain={jest.fn()} />);
  expect(mockRecordVisionView).toHaveBeenCalledTimes(1);
  view.rerender(<V2PracticeSessionScreen anchorId="a1" mode="visualize" durationSeconds={180}
    source="practice_hub" onBack={jest.fn()} onCompleted={jest.fn()} onFocusAgain={jest.fn()} />);
  expect(mockRecordVisionView).toHaveBeenCalledTimes(1);
});
