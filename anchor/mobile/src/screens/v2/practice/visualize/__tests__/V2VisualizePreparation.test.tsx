import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { V2VisualizePrepareScreen } from '../V2VisualizePrepareScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

let mockPreparation: any;
jest.mock('../V2CinematicSessionScreen', () => ({
  V2CinematicSessionScreen: (props: any) => { mockPreparation = props; return null; },
}));
jest.mock('@/components/v2/vision/board/VisionBoardScene', () => ({ VisionBoardScene: () => null }));
jest.mock('@/components/v2/vision/board/useVisionBoardScene', () => ({ useVisionBoardScene: () => ({}) }));
const anchor = makeAnchor({ id: 'a1', userId: 'u1', intentionText: 'My real intention' });
const tiles = [{ id: 'p1', sceneId: 'p1', imageUrl: 'https://example.com/photo.jpg', prompt: null, sortOrder: 0, isHero: true }];
const prepared: any = { anchor, statement: 'My saved Vision', visionId: 'v1', assets: { tiles, images: [{}] }, markLocal: {} };

function setup() {
  const onBegin = jest.fn();
  const view = render(<V2VisualizePrepareScreen anchor={anchor} statement="My saved Vision" visionId="v1"
    tiles={tiles} onBack={jest.fn()} onBegin={onBegin} />);
  return { ...view, onBegin };
}

describe('Visualize prepares behind its real setup board', () => {
  it('guards Begin until the exact textures and mark geometry are ready', () => {
    const view = setup();
    expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(view.getByLabelText('Begin Visualize'));
    expect(view.onBegin).not.toHaveBeenCalled();
    expect(mockPreparation.prepareOnly).toBe(true);
    act(() => mockPreparation.onPrepared(prepared));
    expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(view.getByLabelText('1 min'));
    fireEvent.press(view.getByLabelText('Begin Visualize'));
    fireEvent.press(view.getByLabelText('Begin Visualize'));
    expect(view.onBegin).toHaveBeenCalledTimes(1);
    expect(view.onBegin).toHaveBeenCalledWith(expect.objectContaining({ durationSeconds: 60, prepared: expect.objectContaining({ ...prepared, beginAtMs: expect.any(Number) }) }));
    expect(view.queryByText(/DEV/)).toBeNull();
  });

  it('keeps the board mounted through image failure and rebuilds preparation on Retry', () => {
    const view = setup();
    const previous = mockPreparation;
    act(() => mockPreparation.onPreparationIssue('Image could not load.'));
    expect(view.getByTestId('v2-visualize-prepare-vision')).toBeTruthy();
    expect(view.getByText('Image could not load.')).toBeTruthy();
    fireEvent.press(view.getByText('Retry Vision'));
    expect(mockPreparation).not.toBe(previous);
    expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(true);
    act(() => mockPreparation.onPrepared(prepared));
    expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(false);
  });
  it('preserves recovery with available real images and clears the error after readiness', () => {
    const view = setup();
    const useImages = jest.fn();
    act(() => {
      mockPreparation.onPreparationIssue('One image could not load.');
      mockPreparation.onAvailableImages(useImages);
    });
    fireEvent.press(view.getByText('Continue with available images'));
    expect(useImages).toHaveBeenCalledTimes(1);
    act(() => mockPreparation.onPrepared(prepared));
    expect(view.queryByText('One image could not load.')).toBeNull();
    expect(view.queryByText('Continue with available images')).toBeNull();
    expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(false);
  });

});
