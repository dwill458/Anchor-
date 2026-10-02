import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import {
  ARRIVAL_DISSOLVE_MS, ARRIVAL_LAND_WAIT_MS, ARRIVAL_SAVE_WAIT_MS, ARRIVAL_SOURCE_WAIT_MS,
  VisionImageArrivalProvider, useVisionImageArrival,
} from '../VisionImageArrival';
function Flow() {
  const arrival = useVisionImageArrival()!;
  const [saved, setSaved] = useState(false);
  return <>
    <Text>{saved ? 'Saved overview' : 'Choose image'}</Text>
    <Pressable testID="choose" onPress={() => arrival.begin('https://cdn/selected.jpg', { x: 20, y: 140, width: 300, height: 315 })} />
    <Pressable testID="save" onPress={() => { arrival.resolve('https://cdn/persisted.jpg'); setSaved(true); }} />
    <Pressable testID="cancel" onPress={arrival.cancel} />
  </>;
}
it('keeps the selected photograph mounted through persistence and a content-mode change', () => {
  const view = render(<VisionImageArrivalProvider><Flow /></VisionImageArrivalProvider>);
  fireEvent.press(view.getByTestId('choose'));
  expect(view.getByTestId('vision-arrival-image', { includeHiddenElements: true }).props.source.uri).toBe('https://cdn/selected.jpg');
  fireEvent.press(view.getByTestId('save'));
  expect(view.getByText('Saved overview')).toBeTruthy();
  expect(view.getByTestId('vision-arrival-image', { includeHiddenElements: true }).props.source.uri).toBe('https://cdn/persisted.jpg');
  fireEvent.press(view.getByTestId('cancel'));
  expect(view.queryByTestId('vision-arrival-image', { includeHiddenElements: true })).toBeNull();
});
it('clears a failed image without hiding the saved content', () => {
  const view = render(<VisionImageArrivalProvider><Flow /></VisionImageArrivalProvider>);
  fireEvent.press(view.getByTestId('choose'));
  fireEvent.press(view.getByTestId('save'));
  fireEvent(view.getByTestId('vision-arrival-image', { includeHiddenElements: true }), 'error');
  expect(view.queryByTestId('vision-arrival-image', { includeHiddenElements: true })).toBeNull();
  expect(view.getByText('Saved overview')).toBeTruthy();
});

/** Steps time so effects scheduled by one timer are flushed before the next fires. */
const advance = (ms: number) => { for (let spent = 0; spent < ms; spent += 50) act(() => { jest.advanceTimersByTime(50); }); };

describe('the flight can never strand the person on the chosen photograph', () => {
  const overlay = (view: ReturnType<typeof render>) => view.queryByTestId('vision-arrival-image', { includeHiddenElements: true });
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('gives way to the stage when the save never reports back', () => {
    const view = render(<VisionImageArrivalProvider><Flow /></VisionImageArrivalProvider>);
    fireEvent.press(view.getByTestId('choose'));
    advance(ARRIVAL_SAVE_WAIT_MS - 100);
    expect(overlay(view)).not.toBeNull();
    advance(150);
    expect(overlay(view)).toBeNull();
  });

  it('dissolves when the saved image is never found on the board', () => {
    const view = render(<VisionImageArrivalProvider><Flow /></VisionImageArrivalProvider>);
    fireEvent.press(view.getByTestId('choose'));
    fireEvent.press(view.getByTestId('save'));
    advance(ARRIVAL_LAND_WAIT_MS - 100);
    expect(overlay(view)).not.toBeNull();
    advance(ARRIVAL_LAND_WAIT_MS + ARRIVAL_DISSOLVE_MS + 600);
    expect(overlay(view)).toBeNull();
    expect(view.getByText('Saved overview')).toBeTruthy();
  });

  it('clears after landing even if the animation callback never fires', () => {
    const view = render(<VisionImageArrivalProvider><LandFlow /></VisionImageArrivalProvider>);
    fireEvent.press(view.getByTestId('choose'));
    fireEvent.press(view.getByTestId('save'));
    fireEvent.press(view.getByTestId('land'));
    advance(3000);
    expect(overlay(view)).toBeNull();
  });

  it('starts the flight even when the source image never reports a load', () => {
    const view = render(<VisionImageArrivalProvider><LandFlow /></VisionImageArrivalProvider>);
    fireEvent.press(view.getByTestId('choose'));
    fireEvent.press(view.getByTestId('save'));
    fireEvent.press(view.getByTestId('land'));
    expect(overlay(view)).not.toBeNull();
    advance(ARRIVAL_SOURCE_WAIT_MS + 2000);
    expect(overlay(view)).toBeNull();
  });
});

function LandFlow() {
  const arrival = useVisionImageArrival()!;
  return <>
    <Pressable testID="choose" onPress={() => arrival.begin('https://cdn/selected.jpg', { x: 20, y: 140, width: 300, height: 315 })} />
    <Pressable testID="save" onPress={() => arrival.resolve('https://cdn/persisted.jpg')} />
    <Pressable testID="land" onPress={() => arrival.land('https://cdn/persisted.jpg', { x: 20, y: 300, width: 200, height: 240 })} />
  </>;
}

function AnchorFlow() {
  const arrival = useVisionImageArrival()!;
  return <>
    <Text testID="in-flight">{arrival.anchorInFlight ? 'flying' : 'idle'}</Text>
    <Pressable testID="choose-with-anchor" onPress={() => arrival.begin('https://cdn/selected.jpg', { x: 20, y: 140, width: 300, height: 315 },
      { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10" stroke="#000"/></svg>', category: 'desire', rect: { x: 160, y: 60, width: 76, height: 76 } })} />
    <Pressable testID="land-anchor" onPress={() => arrival.landAnchor({ x: 120, y: 420, width: 90, height: 90 })} />
    <Pressable testID="choose-plain" onPress={() => arrival.begin('https://cdn/selected.jpg', { x: 20, y: 140, width: 300, height: 315 })} />
  </>;
}

it('carries the real Anchor with the chosen photograph until the board reports where it holds it', () => {
  const view = render(<VisionImageArrivalProvider><AnchorFlow /></VisionImageArrivalProvider>);
  expect(view.getByTestId('in-flight').props.children).toBe('idle');
  expect(view.queryByTestId('vision-arrival-anchor', { includeHiddenElements: true })).toBeNull();
  fireEvent.press(view.getByTestId('choose-with-anchor'));
  expect(view.getByTestId('vision-arrival-anchor', { includeHiddenElements: true })).toBeTruthy();
  expect(view.getByTestId('in-flight').props.children).toBe('flying');
  fireEvent.press(view.getByTestId('land-anchor'));
  expect(view.getByTestId('in-flight').props.children).toBe('idle');
  expect(view.getByTestId('vision-arrival-anchor', { includeHiddenElements: true })).toBeTruthy();
});

it('shows no Anchor layer when the choice carries none', () => {
  const view = render(<VisionImageArrivalProvider><AnchorFlow /></VisionImageArrivalProvider>);
  fireEvent.press(view.getByTestId('choose-plain'));
  expect(view.queryByTestId('vision-arrival-anchor', { includeHiddenElements: true })).toBeNull();
  expect(view.getByTestId('in-flight').props.children).toBe('idle');
});
