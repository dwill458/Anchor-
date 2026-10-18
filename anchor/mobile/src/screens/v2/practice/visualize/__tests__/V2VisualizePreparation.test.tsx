
import { ScrollView, StyleSheet, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { V2VisualizePrepareScreen } from '../V2VisualizePrepareScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

let mockPreparation: any;
let mockBoardSceneProps: any;
const mockUseBoardScene = jest.fn();
let mockReduceMotion = false;
jest.mock('../V2CinematicSessionScreen', () => ({
  V2CinematicSessionScreen: (props: any) => { mockPreparation = props; return null; },
}));
jest.mock('@/components/v2/practice/V2PracticeSetupLayout', () => {
  const React = require('react');
  const { Pressable, ScrollView, Text, View } = require('react-native');
  return { V2PracticeSetupLayout: ({ rootRef, testID, children, footer, overlay, onScrollViewportLayout }: any) => React.createElement(View,
    { ref: rootRef, testID }, React.createElement(Pressable, { accessibilityLabel: 'Back to Practice' }, React.createElement(Text, null, 'Practice')),
    React.createElement(ScrollView, { testID: testID ? `${testID}-scroll` : undefined, onLayout: (event: any) => onScrollViewportLayout?.(event.nativeEvent.layout.height) }, children), footer, overlay) };
});
jest.mock('@/hooks/v2', () => ({ ...jest.requireActual('@/hooks/v2'), useV2ReduceMotion: () => mockReduceMotion }));
jest.mock('@/components/v2/vision/board/VisionBoardScene', () => ({ VisionBoardScene: (props: any) => { mockBoardSceneProps = props; return null; } }));
jest.mock('@/components/v2/vision/board/useVisionBoardScene', () => ({ useVisionBoardScene: (...args: any[]) => { mockUseBoardScene(...args); return {}; } }));
let mockAudioReadiness: 'ready' | 'downloading' | 'failed' = 'ready';
const mockAudioRetry = jest.fn();
jest.mock('@/hooks/useRemoteAudioReady', () => ({
  useRemoteAudioReady: () => ({ readiness: mockAudioReadiness, retry: mockAudioRetry }),
}));
const anchor = makeAnchor({ id: 'a1', userId: 'u1', intentionText: 'My real intention' });
const tiles = [{ id: 'p1', sceneId: 'p1', imageUrl: 'https://example.com/photo.jpg', prompt: null, sortOrder: 0, isHero: true }];
const prepared: any = { anchor, statement: 'My saved Vision', visionId: 'v1', assets: { tiles, images: [{}] }, markLocal: {} };

function setup(notes?: any[], entry?: any, entitled?: boolean) {
  const onBegin = jest.fn();
  const view = render(<V2VisualizePrepareScreen anchor={anchor} statement="My saved Vision" visionId="v1"
    tiles={tiles} notes={notes} entry={entry} entitled={entitled} onBack={jest.fn()} onBegin={onBegin} />);
  fireEvent(view.getByTestId('v2-practice-prepare-visualize-scroll'), 'layout', { nativeEvent: { layout: { height: 640, width: 345, x: 0, y: 52 } } });
  fireEvent(view.getByTestId('v2-visualize-prepare-heading'), 'layout', { nativeEvent: { layout: { height: 138, width: 345, x: 0, y: 0 } } });
  return { ...view, onBegin };
}

/** The entry measures only after the Vision photos report as warmed; their prefetch settles on microtasks. */
async function flushPhotoWarm() {
  await act(async () => { for (let step = 0; step < 5; step += 1) await Promise.resolve(); });
}

describe('Visualize prepares behind its real setup board', () => {
  beforeEach(() => { mockBoardSceneProps = undefined; mockUseBoardScene.mockClear(); mockReduceMotion = false; });

  it('shows the full photo composition without rendering notes or the Anchor mark', () => {
    const note = { id: 'note-1', content: { text: 'A saved intention' }, presentation: { styleId: 'paper' } };
    setup([note]);

    expect(mockUseBoardScene).toHaveBeenCalledWith(tiles, expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }), 1, true);
    expect(mockBoardSceneProps.notes).toBeUndefined();
    expect(mockBoardSceneProps.showAnchorMark).toBe(false);
  });

  it('reuses the source scene dimensions to keep cold-entry photo viewports stable', () => {
    const entry = { anchorId: anchor.id, visionId: 'v1', tiles, notes: [],
      sourceFrame: { x: 12, y: 80, width: 360, height: 954, sceneWidth: 612, sceneHeight: 1621.8 } };
    setup([], entry);

    expect(mockUseBoardScene).toHaveBeenLastCalledWith(tiles, { width: 612, height: 1621.8 }, 1, true);
  });

  it('starts the source handoff when measured while keeping Begin gated on session preparation', async () => {
    jest.useFakeTimers();
    try {
    const note = { id: 'note-1', content: { text: 'A saved intention' }, presentation: { styleId: 'paper' } };
    const entry = { anchorId: anchor.id, visionId: 'v1', tiles, notes: [note], sourceFrame: { x: 12, y: 80, width: 320, height: 500 } };
    const measurements: Array<(x: number, y: number, width: number, height: number) => void> = [];
    jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(callback => {
      measurements.push(callback as (x: number, y: number, width: number, height: number) => void);
    });
    const view = setup([note], entry);
    await flushPhotoWarm();

    expect(view.getByTestId('v2-visualize-entry-overlay')).toBeTruthy();
    expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(true);
    expect(mockBoardSceneProps.notes).toEqual([note]);
    expect(mockUseBoardScene).toHaveBeenLastCalledWith(tiles, expect.anything(), 1, true);

    act(() => measurements.shift()?.(0, 0, 393, 852));
    act(() => measurements.shift()?.(20, 160, 320, 520));
    act(() => { jest.advanceTimersByTime(400); });
    expect(view.queryByTestId('v2-visualize-entry-overlay')).toBeNull();
    expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(true);

    act(() => mockPreparation.onPrepared(prepared));
    expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(false);
    expect(mockBoardSceneProps.notes).toBeUndefined();
    expect(mockBoardSceneProps.showIntentionCard).toBe(false);
    expect(mockUseBoardScene).toHaveBeenLastCalledWith(tiles, expect.anything(), 1, true);
    } finally {
      jest.useRealTimers();
      jest.restoreAllMocks();
    }
  });

  it('settles the source handoff immediately under reduced motion while keeping Begin gated', async () => {
    mockReduceMotion = true;
    const callbacks: Array<(x: number, y: number, width: number, height: number) => void> = [];
    jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(callback => {
      callbacks.push(callback as (x: number, y: number, width: number, height: number) => void);
    });
    const entry = { anchorId: anchor.id, visionId: 'v1', tiles, notes: [], sourceFrame: { x: 12, y: 80, width: 320, height: 500 } };
    const view = setup([], entry);
    await flushPhotoWarm();

    expect(view.getByTestId('v2-visualize-entry-overlay')).toBeTruthy();
    act(() => callbacks.shift()?.(0, 0, 393, 852));
    act(() => callbacks.shift()?.(20, 160, 320, 520));
    expect(view.queryByTestId('v2-visualize-entry-overlay')).toBeNull();
    expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(true);

    act(() => mockPreparation.onPrepared(prepared));
    expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(false);
    jest.restoreAllMocks();
  });

  it('holds the hidden session preparation until the entry has finished flying in', async () => {
    jest.useFakeTimers();
    try {
      const entry = { anchorId: anchor.id, visionId: 'v1', tiles, notes: [], sourceFrame: { x: 12, y: 80, width: 320, height: 500 } };
      const measurements: Array<(x: number, y: number, width: number, height: number) => void> = [];
      jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(callback => {
        measurements.push(callback as (x: number, y: number, width: number, height: number) => void);
      });
      mockPreparation = undefined;
      const view = setup([], entry);
      await flushPhotoWarm();
      expect(mockPreparation).toBeUndefined();

      act(() => measurements.shift()?.(0, 0, 393, 852));
      act(() => measurements.shift()?.(20, 160, 320, 520));
      expect(mockPreparation).toBeUndefined();

      act(() => { jest.advanceTimersByTime(400); });
      expect(view.queryByTestId('v2-visualize-entry-overlay')).toBeNull();
      expect(mockPreparation?.prepareOnly).toBe(true);
    } finally {
      jest.useRealTimers();
      jest.restoreAllMocks();
    }
  });

  it('keeps Begin and recovery outside the scrolling setup controls', () => {
    const view = setup();
    const scroll = view.getByTestId('v2-practice-prepare-visualize-scroll');
    expect(scroll.findAll((node: { props: Record<string, unknown> }) => node.props.accessibilityLabel === 'Begin Visualize')).toHaveLength(0);
    expect(scroll.findAll((node: { props: Record<string, unknown> }) => String(node.props.accessibilityLabel ?? '').startsWith('Sound:')).length).toBeGreaterThan(0);
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

  it('holds Begin until a downloaded guided track is on disk, and offers a retry when it fails', () => {
    try {
      mockAudioReadiness = 'downloading';
      const view = setup();
      act(() => mockPreparation.onPrepared(prepared));
      expect(view.getByText("Downloading this session's audio...")).toBeTruthy();
      expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(true);
      view.unmount();

      mockAudioReadiness = 'failed';
      const failed = setup();
      act(() => mockPreparation.onPrepared(prepared));
      expect(failed.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(true);
      fireEvent.press(failed.getByText('Retry download'));
      expect(mockAudioRetry).toHaveBeenCalled();
    } finally {
      mockAudioReadiness = 'ready';
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

  it('hands a non-entitled Begin to the paywall without fading or locking the setup chrome', () => {
    jest.useFakeTimers();
    try {
      const view = setup(undefined, undefined, false);
      act(() => mockPreparation.onPrepared(prepared));
      fireEvent.press(view.getByLabelText('Begin Visualize'));
      // The paywall path is immediate: no 360ms begin fade has to run first.
      expect(view.onBegin).toHaveBeenCalledTimes(1);
      const opacityOf = (id: string) => (StyleSheet.flatten(view.getByTestId(id).props.style) as any)?.opacity;
      act(() => { jest.advanceTimersByTime(1500); });
      // Returning from the paywall must find the intro exactly as it was left.
      expect(opacityOf('v2-visualize-prepare-heading')).not.toBe(0);
      expect(view.getByLabelText('Begin Visualize').props.accessibilityState.disabled).toBe(false);
      fireEvent.press(view.getByLabelText('Begin Visualize'));
      expect(view.onBegin).toHaveBeenCalledTimes(2);
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
