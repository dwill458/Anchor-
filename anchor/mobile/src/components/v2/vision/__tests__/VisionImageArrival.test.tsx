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
