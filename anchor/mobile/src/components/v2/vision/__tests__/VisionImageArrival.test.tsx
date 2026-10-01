import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { VisionImageArrivalProvider, useVisionImageArrival } from '../VisionImageArrival';
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
