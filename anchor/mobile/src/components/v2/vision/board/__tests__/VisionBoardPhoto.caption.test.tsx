import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { VisionBoardPhoto } from '../VisionBoardPhoto';
import { planCaption } from '../visionCaptionLayout';

const mockGestures: Record<string, any> = {};
jest.mock('react-native-gesture-handler', () => {
  const make = (kind: string) => {
    const callbacks: Record<string, any> = {};
    const gesture: any = new Proxy(callbacks, { get: (target, key: string) => {
      if (key === 'callbacks') return target;
      return (value: any) => { target[key] = value; return gesture; };
    } });
    mockGestures[kind] = gesture;
    return gesture;
  };
  return { GestureDetector: ({ children }: any) => children, Gesture: {
    Pan: () => make('pan'), Tap: () => make('tap'), LongPress: () => make('hold'),
    Race: (...items: any[]) => items, Simultaneous: (...items: any[]) => items,
  } };
});
jest.mock('react-native-reanimated', () => ({
  ...require('@/__tests__/mocks/reactNativeReanimated').default, runOnJS: (fn: any) => fn,
}));
let mockFocalFrame: any = null;
jest.mock('../../VisionPhotograph', () => ({ VisionPhotograph: (props: any) => {
  const { Image } = require('react-native');
  mockFocalFrame = props.focalFrame;
  return <Image {...props} testID="board-image" />;
} }));
jest.mock('../../VisionImageEdge', () => ({ VisionImageEdge: () => null }));

const REST = 1 / 1.7;
/** A print as the board lays it out: scene px, at renderScale 1.7. */
const rectFor = (displayWidth: number, aspect: number) => ({ x: 0, y: 0, width: displayWidth / REST, height: displayWidth / REST / aspect, rotation: 0, zIndex: 1, frame: 0 });
const sharedFor = (rect: any): any => ({ order: { value: ['p1'] }, slots: { value: [rect] }, dragging: { value: '' }, cameraScale: { value: REST }, layoutVersion: { value: 0 } });

function mount(caption: string | undefined, rect: any, extra: Record<string, unknown> = {}) {
  return render(<VisionBoardPhoto sceneId="p1" testID="photo" imageUrl="https://x.test/a.jpg" caption={caption} accessibilityLabel="Photo" initialRect={rect}
    entering={false} exiting={false} shared={sharedFor(rect)} reduceMotion interactive dragEnabled={false} materialMode="photographic" displayScale={REST}
    onCaptionEdit={jest.fn()} {...extra} />);
}
const captionStyle = (view: ReturnType<typeof render>) => StyleSheet.flatten(view.getByTestId('photo-caption').props.style);

describe('caption readability on the Vision board', () => {
  it.each([['hero', 0.64 * 374, 1.18], ['flank', 0.34 * 374, 1.05], ['320pt phone flank', 0.34 * 296, 1.05]])('shows a short caption at 14-16 displayed points on the %s print', (_name, displayWidth, aspect) => {
    const view = mount('I did it.', rectFor(displayWidth as number, aspect as number));
    const style = captionStyle(view);
    const displayed = style.fontSize * REST;
    expect(displayed).toBeGreaterThanOrEqual(14 - 1e-6); expect(displayed).toBeLessThanOrEqual(16 + 1e-6);
  });
  it('uses the sturdier handwriting, not the hairline script', () => {
    const view = mount('I did it.', rectFor(0.64 * 374, 1.18));
    expect(captionStyle(view).fontFamily).toBe('Caveat-SemiBold');
  });
  it('accounts for the camera scale: the scene font is the displayed size divided by it', () => {
    const rect = rectFor(0.64 * 374, 1.18), plan = planCaption('I did it.', 0.64 * 374, (0.64 * 374 / 1.18) * 0.22)!;
    expect(captionStyle(mount('I did it.', rect)).fontSize).toBeCloseTo(plan.fontSize / REST, 5);
  });
  it('wraps a long caption onto as many lines as it needs and never truncates it', () => {
    const long = 'We built the house with the big garden and the long table for everyone we love.';
    const view = mount(long, rectFor(0.34 * 374, 1.05));
    const text = view.getByTestId('photo-caption');
    expect(text.props.numberOfLines).toBeUndefined(); expect(text.props.ellipsizeMode).toBeUndefined();
    expect(text.props.children).toBe(long);
  });
  it('grows the paper under the print when the margin cannot hold the text, instead of clipping or covering the photograph', () => {
    const rect = rectFor(0.34 * 374, 1.05);
    const long = mount('We built the house with the big garden and the long table.', rect);
    const paper = long.getByTestId('photo-caption-paper');
    const plan = planCaption('We built the house with the big garden and the long table.', 0.34 * 374, (0.34 * 374 / 1.05) * 0.22)!;
    expect(plan.extra).toBeGreaterThan(0);
    expect(StyleSheet.flatten(paper.props.style).height).toBeCloseTo(rect.height * 0.22 + plan.extra / REST + 0.5, 3);
    // It is the frame's own bottom margin, stretched, starting where the photograph window ends.
    expect(StyleSheet.flatten(paper.props.style).top).toBeCloseTo(rect.height * 0.78 - 0.5, 3);
  });
  it('adds no paper when the caption fits the margin', () => {
    const view = mount('Home.', rectFor(0.64 * 374, 1.18));
    expect(view.queryByTestId('photo-caption-paper')).toBeNull();
  });
  it('stays legible and inside its box on a rotated print', () => {
    const view = mount('Sunday mornings.', { ...rectFor(0.34 * 374, 1.05), rotation: 4 });
    expect(captionStyle(view).fontSize * REST).toBeGreaterThanOrEqual(14 - 1e-6);
  });
  it('invites a caption on an empty one, and an empty caption adds no paper', () => {
    const view = mount(undefined, rectFor(0.34 * 374, 1.05));
    expect(view.getByText('Add caption')).toBeTruthy(); expect(view.queryByTestId('photo-caption-paper')).toBeNull();
  });
  it('leaves Visualize and the share image exactly as they were: the thin script on one line, at the old size', () => {
    const rect = rectFor(0.34 * 374, 1.05);
    const view = render(<VisionBoardPhoto sceneId="p1" testID="photo" imageUrl="https://x.test/a.jpg" caption="A long caption that stays on one line" accessibilityLabel="Photo"
      initialRect={rect} entering={false} exiting={false} shared={sharedFor(rect)} reduceMotion interactive dragEnabled={false} materialMode="photographic" onCaptionEdit={jest.fn()} />);
    const text = view.getByTestId('photo-caption');
    expect(text.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({ fontFamily: 'Allison-Regular', fontSize: 15 });
    expect(view.queryByTestId('photo-caption-paper')).toBeNull();
  });
});

describe('repositioning', () => {
  const FRAME_WINDOW = { width: 100, height: 100 };
  function mountForPan(onFocalCommit: jest.Mock, onDragActive = jest.fn(), focal: any = null) {
    const rect = { x: 0, y: 0, width: FRAME_WINDOW.width / 0.88, height: FRAME_WINDOW.height / 0.72, rotation: 0, zIndex: 1, frame: 0 };
    const view = render(<VisionBoardPhoto sceneId="p1" testID="photo" imageUrl="https://x.test/a.jpg" accessibilityLabel="Photo" initialRect={rect}
      entering={false} exiting={false} shared={sharedFor(rect)} reduceMotion interactive dragEnabled={false} materialMode="photographic" displayScale={REST}
      repositioning focal={focal} onFocalCommit={onFocalCommit} onDragActive={onDragActive} />);
    // The picture has loaded: a 2:3 portrait in a square window overflows vertically by half a window.
    act(() => { mockFocalFrame.aspect.value = 2 / 3; });
    return { view, rect };
  }
  it('dragging the picture down shows more of its top, within the window, and saves where it ends', () => {
    const onFocalCommit = jest.fn(), onDragActive = jest.fn();
    mountForPan(onFocalCommit, onDragActive, { x: 0.5, y: 0.5 });
    act(() => {
      mockGestures.pan.callbacks.onBegin();
      mockGestures.pan.callbacks.onStart();
      // The scene is drawn at 1 / REST times the screen, so 20 screen points is 20 / REST scene px... the finger value is in screen points.
      mockGestures.pan.callbacks.onUpdate({ translationX: 40, translationY: 20 * REST });
      mockGestures.pan.callbacks.onFinalize({}, true);
    });
    expect(onDragActive).toHaveBeenCalledWith(true); expect(onDragActive).toHaveBeenLastCalledWith(false);
    expect(onFocalCommit).toHaveBeenCalledTimes(1);
    const [, focal] = onFocalCommit.mock.calls[0];
    expect(focal.y).toBeLessThan(0.5); expect(focal.y).toBeGreaterThanOrEqual(0);
    expect(focal.x).toBe(0.5);                      // a portrait in a square window has no horizontal overflow to move along
  });
  it('clamps at the edges so a long drag can never reveal blank paper', () => {
    const onFocalCommit = jest.fn();
    mountForPan(onFocalCommit, jest.fn(), { x: 0.5, y: 0.5 });
    act(() => {
      mockGestures.pan.callbacks.onBegin(); mockGestures.pan.callbacks.onStart();
      mockGestures.pan.callbacks.onUpdate({ translationX: 0, translationY: 5000 });
      mockGestures.pan.callbacks.onFinalize({}, true);
    });
    expect(onFocalCommit.mock.calls[0][1].y).toBe(0);
    act(() => {
      mockGestures.pan.callbacks.onBegin(); mockGestures.pan.callbacks.onStart();
      mockGestures.pan.callbacks.onUpdate({ translationX: 0, translationY: -5000 });
      mockGestures.pan.callbacks.onFinalize({}, true);
    });
    expect(onFocalCommit.mock.calls[1][1].y).toBe(1);
  });
  it('a touch that never moves saves nothing, so the automatic position is not frozen by accident', () => {
    const onFocalCommit = jest.fn();
    mountForPan(onFocalCommit);
    act(() => { mockGestures.pan.callbacks.onBegin(); mockGestures.pan.callbacks.onFinalize({}, true); });
    expect(onFocalCommit).not.toHaveBeenCalled();
  });
  it('starts from the automatic position when nothing has been saved', () => {
    const onFocalCommit = jest.fn();
    mountForPan(onFocalCommit);
    act(() => {
      mockGestures.pan.callbacks.onBegin(); mockGestures.pan.callbacks.onStart();
      mockGestures.pan.callbacks.onUpdate({ translationX: 0, translationY: -1 });
      mockGestures.pan.callbacks.onFinalize({}, true);
    });
    // Automatic for a 2:3 photograph is near the top; a one-point upward drag moves just below that, not to a stray value.
    expect(onFocalCommit.mock.calls[0][1].y).toBeGreaterThan(0.05); expect(onFocalCommit.mock.calls[0][1].y).toBeLessThan(0.2);
  });
  it('lays the photograph out through the focal frame, upper-biased by default', () => {
    mountForPan(jest.fn());
    expect(mockFocalFrame.focalY.value).toBe(-1);   // "automatic": resolved to the upper-biased position at draw time
  });
});
