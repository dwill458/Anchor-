import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { V2HomeVisionSection } from '../V2HomeVisionSection';
import type { HomeVisionState } from '@/adapters/v2/home';

const vision: HomeVisionState = {
  state: 'ready', visionId: 'v1', title: 'A considered future', previewText: '', featuredTileId: 'second',
  tiles: [
    { id: 'first', sceneId: 's1', imageUrl: 'https://example.test/first.jpg', sortOrder: 0, isHero: false, prompt: null },
    { id: 'second', sceneId: 's2', imageUrl: 'https://example.test/second.jpg', sortOrder: 1, isHero: true, prompt: null },
  ],
};

describe('Home editorial Vision wiring', () => {
  it('uses the selected cover and keeps the intention beside a compact collage', () => {
    const view = render(<V2HomeVisionSection vision={vision} />);
    expect(view.getByTestId('v2-home-vision-image').props.source.uri).toBe('https://example.test/second.jpg');
    expect(view.getByTestId('v2-home-vision-title').props.children).toBe('A considered future');
  });

  it('keeps both the collage and View all on the existing destination', () => {
    const open = jest.fn();
    const view = render(<V2HomeVisionSection vision={vision} onOpenVision={open} />);
    fireEvent.press(view.getByTestId('v2-home-vision'));
    fireEvent.press(view.getByLabelText('View all Vision'));
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('preserves ready-only Home behavior', () => {
    const view = render(<V2HomeVisionSection vision={{ state: 'loading' }} />);
    expect(view.queryByText('Your Vision')).toBeNull();
    view.rerender(<V2HomeVisionSection vision={{ state: 'error', message: 'Offline' }} />);
    expect(view.queryByText('Your Vision')).toBeNull();
  });
});
