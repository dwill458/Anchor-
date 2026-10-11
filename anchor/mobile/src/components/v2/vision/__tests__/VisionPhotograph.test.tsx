import React from 'react';
import { Image } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { VisionPhotograph } from '../VisionPhotograph';

describe('VisionPhotograph readiness', () => {
  it('downsamples both native layers while retaining a wide uploaded photograph', () => {
    const view = render(<VisionPhotograph source={{ uri: 'https://assets.test/wide.jpg' }} displayAspect={0.76} uploaded />);
    const [backdrop, foreground] = view.UNSAFE_getAllByType(Image);
    expect(backdrop.props.resizeMethod).toBe('resize');
    expect(foreground.props.resizeMethod).toBe('resize');
    act(() => foreground.props.onLoad({ nativeEvent: { source: { width: 600, height: 300 } } }));
    expect(view.UNSAFE_getAllByType(Image)[1].props.resizeMode).toBe('contain');
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
