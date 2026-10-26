import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ChartOneMoveTeaching } from '../ChartOneMoveTeaching';

function target(y: number, height: number) {
  return { current: { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(20, y, 300, height) } } as never;
}

function renderTeaching({ y = 300, targetHeight = 60, detent = 'half', onRequestVisible = jest.fn() }: { y?: number; targetHeight?: number; detent?: 'peek' | 'half' | 'full'; onRequestVisible?: jest.Mock } = {}) {
  let measureCount = 0;
  const screen = render(<ChartOneMoveTeaching
    visible
    replayVersion={0}
    reducedMotion={false}
    detent={detent}
    targets={{ rowRef: target(y, targetHeight), circleRef: target(y, 44), bodyRef: target(y, 50) }}
    viewportRef={target(240, 400)}
    measureInWindow={(_node, callback) => {
      measureCount += 1;
      const step = (measureCount - 1) % 3;
      if (step === 0) callback(0, 0, 390, 844);
      else if (step === 1) callback(0, 240, 390, 400);
      else callback(20, y, 300, targetHeight);
    }}
    onRequestVisible={onRequestVisible}
    onReady={jest.fn()}
    onDismiss={jest.fn()}
  />);
  return { ...screen, onRequestVisible };
}

it('mounts a measurement root, then presents one accurate lesson with Got it', async () => {
  const screen = renderTeaching();
  const measureRoot = screen.getByTestId('chart-one-move-teaching-measure');
  // The measurement host must exist before any target measurement can be requested.
  expect(measureRoot).toBeTruthy();
  fireEvent(measureRoot, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
  await waitFor(() => expect(screen.getByTestId('chart-one-move-teaching')).toBeTruthy());
  expect(screen.getByText('One small step for today.')).toBeTruthy();
  expect(screen.queryByText('1 of 3')).toBeNull();
  expect(screen.queryByText('Next')).toBeNull();
  expect(screen.getByTestId('chart-teaching-target-hole').props.pointerEvents).toBe('none');
  expect(screen.getByTestId('chart-one-move-teaching').props.pointerEvents).toBe('box-none');
  fireEvent.press(screen.getByText('Got it'));
});

it('asks the sheet to rise when the peek scroll viewport clips a target still inside the window', async () => {
  const onRequestVisible = jest.fn();
  const screen = renderTeaching({ y: 700, targetHeight: 60, detent: 'peek', onRequestVisible });
  fireEvent(screen.getByTestId('chart-one-move-teaching-measure'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
  await waitFor(() => expect(onRequestVisible).toHaveBeenCalledTimes(1));
  expect(screen.queryByTestId('chart-one-move-teaching')).toBeNull();
});

it('keeps polling a queued measurement until a late row ref mounts', async () => {
  const lateRow = { current: null as null | { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void } };
  const onReady = jest.fn();
  const screen = render(<ChartOneMoveTeaching
    visible
    replayVersion={0}
    reducedMotion
    detent="half"
    targets={{ rowRef: lateRow as never, circleRef: target(300, 44), bodyRef: target(300, 50) }}
    viewportRef={target(0, 844)}
    measureInWindow={(_node, callback) => callback(0, 0, 390, 844)}
    onRequestVisible={jest.fn()}
    onReady={onReady}
    onDismiss={jest.fn()}
  />);
  fireEvent(screen.getByTestId('chart-one-move-teaching-measure'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
  expect(screen.queryByTestId('chart-one-move-teaching')).toBeNull();
  lateRow.current = { measureInWindow: callback => callback(20, 300, 300, 60) };
  await waitFor(() => expect(screen.getByTestId('chart-one-move-teaching')).toBeTruthy(), { timeout: 700 });
  expect(onReady).toHaveBeenCalled();
});

it('bounds sheet-visibility requests and spotlights the visible intersection for an oversized target', async () => {
  let detent: 'half' | 'full' = 'full';
  let measureCount = 0;
  const onRequestVisible = jest.fn();
  const onReady = jest.fn();
  const props = () => <ChartOneMoveTeaching
    visible
    replayVersion={0}
    reducedMotion
    detent={detent}
    targets={{ rowRef: target(300, 900), circleRef: target(300, 44), bodyRef: target(300, 50) }}
    viewportRef={target(240, 400)}
    measureInWindow={(_node, callback) => {
      measureCount += 1;
      const step = (measureCount - 1) % 3;
      if (step === 0) callback(0, 0, 390, 844);
      else if (step === 1) callback(0, 240, 390, 400);
      else callback(20, 300, 300, 900);
    }}
    onRequestVisible={onRequestVisible}
    onReady={onReady}
    onDismiss={jest.fn()}
  />;
  const screen = render(props());
  fireEvent(screen.getByTestId('chart-one-move-teaching-measure'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
  await waitFor(() => expect(onRequestVisible).toHaveBeenCalledTimes(1));
  detent = 'half';
  screen.rerender(props());
  await waitFor(() => expect(onRequestVisible).toHaveBeenCalledTimes(2));
  detent = 'full';
  screen.rerender(props());
  await waitFor(() => expect(screen.getByTestId('chart-one-move-teaching')).toBeTruthy());
  expect(onRequestVisible).toHaveBeenCalledTimes(2);
  expect(onReady).toHaveBeenCalled();
});

it('records the lesson once even when the sheet measures again', async () => {
  const onReady = jest.fn();
  const targets = { rowRef: target(300, 60), circleRef: target(300, 44), bodyRef: target(300, 50) };
  const viewportRef = target(0, 844);
  const measureInWindow = (_node: unknown, callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 0, 390, 844);
  const props = { visible: true, replayVersion: 0, reducedMotion: true, detent: 'half' as const, targets, viewportRef, measureInWindow, onReady, onRequestVisible: jest.fn(), onDismiss: jest.fn() };
  const tree = render(<ChartOneMoveTeaching {...props} viewportLayoutRevision={0} />);
  fireEvent(tree.getByTestId('chart-one-move-teaching-measure'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
  await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
  tree.rerender(<ChartOneMoveTeaching {...props} viewportLayoutRevision={1} />);
  await waitFor(() => expect(tree.getByTestId('chart-one-move-teaching')).toBeTruthy());
  expect(onReady).toHaveBeenCalledTimes(1);
});
