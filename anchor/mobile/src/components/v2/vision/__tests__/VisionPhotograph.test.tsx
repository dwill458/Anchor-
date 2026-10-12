import React from 'react';
import { Image } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { VisionPhotograph } from '../VisionPhotograph';

describe('VisionPhotograph readiness', () => {
  it('retains a wide upload in one downsampled image without a blurred duplicate', () => {
    const view = render(<VisionPhotograph source={{ uri: 'https://assets.test/wide.jpg' }} displayAspect={0.76} uploaded />);
    const [foreground] = view.UNSAFE_getAllByType(Image);
    expect(view.UNSAFE_getAllByType(Image)).toHaveLength(1);
    expect(foreground.props.resizeMode).toBe('contain');
    expect(foreground.props.resizeMethod).toBe('resize');
    act(() => foreground.props.onLoad({ nativeEvent: { source: { width: 600, height: 300 } } }));
    expect(view.UNSAFE_getAllByType(Image)[0].props.resizeMode).toBe('contain');
  });
  it('fits the measured aperture rather than a stale requested aspect without resizing the print', () => {
    const onLayout = jest.fn();
    const view = render(<VisionPhotograph source={{ uri: 'https://assets.test/portrait.jpg' }} displayAspect={1.36} uploaded onLayout={onLayout} style={{ width: 200, height: 300 }} />);
    let foreground = view.UNSAFE_getAllByType(Image)[0];
    act(() => foreground.props.onLoad({ nativeEvent: { source: { width: 2000, height: 3000 } } }));
    expect(view.UNSAFE_getAllByType(Image)[0].props.resizeMode).toBe('contain');
    const event = { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 300 } } };
    act(() => view.UNSAFE_getAllByType(Image)[0].props.onLayout(event));
    foreground = view.UNSAFE_getAllByType(Image)[0];
    expect(foreground.props.resizeMode).toBe('cover');
    expect(onLayout).toHaveBeenCalledWith(event);
  });
  it('settles an upload after its only image decodes and resets fitting for a replacement', async () => {
    const onAssetReady = jest.fn();
    const view = render(<VisionPhotograph source={{ uri: 'https://assets.test/one.jpg' }} displayAspect={1.36} uploaded onAssetReady={onAssetReady} />);
    act(() => view.UNSAFE_getAllByType(Image)[0].props.onLoad({ nativeEvent: { source: { width: 4032, height: 3024 } } }));
    expect(view.UNSAFE_getAllByType(Image)[0].props.resizeMode).toBe('cover');
    await waitFor(() => expect(onAssetReady).toHaveBeenCalledTimes(1));
    view.rerender(<VisionPhotograph source={{ uri: 'https://assets.test/two.jpg' }} displayAspect={1.36} uploaded onAssetReady={onAssetReady} />);
    expect(view.UNSAFE_getAllByType(Image)[0].props.resizeMode).toBe('contain');
    act(() => view.UNSAFE_getAllByType(Image)[0].props.onError({ nativeEvent: { error: 'unavailable' } }));
    await waitFor(() => expect(onAssetReady).toHaveBeenCalledTimes(2));
  });
  it('reports readiness only after the foreground and blurred backdrop settle', async () => {
    const onAssetReady = jest.fn();
    const view = render(<VisionPhotograph source={{ uri: 'https://assets.test/board.jpg' }} displayAspect={1.2} onAssetReady={onAssetReady} />);
    const [backdrop, foreground] = view.UNSAFE_getAllByType(Image);

    act(() => backdrop.props.onLoad?.({ nativeEvent: { source: { width: 1200, height: 1000 } } }));
    expect(onAssetReady).not.toHaveBeenCalled();
    act(() => foreground.props.onLoad?.({ nativeEvent: { source: { width: 1200, height: 1000 } } }));

    await waitFor(() => expect(onAssetReady).toHaveBeenCalledTimes(1));
  });

  it('treats a failed layer as settled while preserving the foreground error callback', async () => {
    const onAssetReady = jest.fn();
    const onError = jest.fn();
    const view = render(<VisionPhotograph source={{ uri: 'https://assets.test/board.jpg' }} displayAspect={1.2} onAssetReady={onAssetReady} onError={onError} />);
    const [backdrop, foreground] = view.UNSAFE_getAllByType(Image);

    act(() => backdrop.props.onError?.({ nativeEvent: { error: 'failed' } }));
    expect(onAssetReady).not.toHaveBeenCalled();
    act(() => foreground.props.onError?.({ nativeEvent: { error: 'failed' } }));
    expect(onError).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onAssetReady).toHaveBeenCalledTimes(1));
  });
});
