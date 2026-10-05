
import { ScrollView } from 'react-native';
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
  it('keeps Begin and recovery outside the scrolling setup controls', () => {
    const view = setup();
    const scroll = view.UNSAFE_getByType(ScrollView);
    expect(scroll.findAll((node: { props: Record<string, unknown> }) => node.props.accessibilityLabel === 'Begin Visualize')).toHaveLength(0);
    expect(scroll.findAll((node: { props: Record<string, unknown> }) => node.props.accessibilityLabel === 'Sound').length).toBeGreaterThan(0);
    expect(scroll.findAll((node: { props: Record<string, unknown> }) => node.props.testID === 'v2-visualize-prepare-vision').length).toBeGreaterThan(0);
    act(() => mockPreparation.onPreparationIssue('Image could not load.'));
    expect(scroll.findAll((node: { props: Record<string, unknown> }) => node.props.accessibilityLabel === 'Retry Vision')).toHaveLength(0);
    expect(view.getByText('Retry Vision')).toBeTruthy();
  });

  it('guards Begin until the exact textures and mark geometry are ready', () => {
    jest.useFakeTimers();
    try {
      const view = setup();
      expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(true);
      fireEvent.press(view.getByLabelText('Begin Visualize'));
      act(() => { jest.advanceTimersByTime(1500); });
      expect(view.onBegin).not.toHaveBeenCalled();
      expect(mockPreparation.prepareOnly).toBe(true);
      act(() => mockPreparation.onPrepared(prepared));
      expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(false);
      fireEvent.press(view.getByLabelText('1 min'));
      fireEvent.press(view.getByLabelText('Begin Visualize'));
      fireEvent.press(view.getByLabelText('Begin Visualize'));
      act(() => { jest.advanceTimersByTime(1500); });
      expect(view.onBegin).toHaveBeenCalledTimes(1);
      expect(view.onBegin).toHaveBeenCalledWith(expect.objectContaining({ durationSeconds: 60, prepared: expect.objectContaining({ ...prepared, beginAtMs: expect.any(Number) }) }));
      expect(view.queryByText(/DEV/)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('offers 1, 3 and 10 minutes every time, defaulting to 3, and carries the choice into the session', () => {
    jest.useFakeTimers();
    try {
      for (const [label, seconds] of [['1 min', 60], ['3 min', 180], ['10 min', 600]] as const) {
        const view = setup();
        expect(view.getByLabelText('3 min, selected')).toBeTruthy();
        act(() => mockPreparation.onPrepared(prepared));
        fireEvent.press(view.getByLabelText(label.startsWith('3') ? '3 min, selected' : label));
        fireEvent.press(view.getByLabelText('Begin Visualize'));
        act(() => { jest.advanceTimersByTime(1500); });
        expect(view.onBegin).toHaveBeenCalledWith(expect.objectContaining({ durationSeconds: seconds }));
        view.unmount();
      }
    } finally {
      jest.useRealTimers();
    }
  });

  it('locks the settings once Begin is pressed, and starts the session from where the collage is on screen', () => {
    jest.useFakeTimers();
    try {
      const view = setup();
      act(() => mockPreparation.onPrepared(prepared));
      fireEvent.press(view.getByLabelText('Begin Visualize'));
      expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(true);
      fireEvent.press(view.getByLabelText('10 min'));
      act(() => { jest.advanceTimersByTime(1500); });
      expect(view.onBegin).toHaveBeenCalledWith(expect.objectContaining({ durationSeconds: 180 }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the real intention and category, and is the cream Practice setup', () => {
    const view = setup();
    expect(view.getByText('Step into your Vision')).toBeTruthy();
    expect(view.getByText('Step into the moments you’ve created and let them feel real.')).toBeTruthy();
    expect(view.getByText('VISUALIZE')).toBeTruthy();
    expect(view.getByText('My real intention')).toBeTruthy();
    expect(view.getByLabelText('Back to Practice')).toBeTruthy();
    expect(view.getByText('Practice')).toBeTruthy();
    expect(view.getByText('HOW LONG?')).toBeTruthy();
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
  it('keeps Begin disabled after a photo failure and clears the error only after readiness', () => {
    const view = setup();
    act(() => {
      mockPreparation.onPreparationIssue('One image could not load.');
    });
    expect(view.queryByText('Continue with available images')).toBeNull();
    expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(true);
    act(() => mockPreparation.onPrepared(prepared));
    expect(view.queryByText('One image could not load.')).toBeNull();
    expect(view.queryByText('Continue with available images')).toBeNull();
    expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(false);
  });

});
