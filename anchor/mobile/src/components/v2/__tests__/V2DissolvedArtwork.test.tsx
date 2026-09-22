import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { V2DissolvedArtwork } from '@/components/v2/primitives';

describe('V2DissolvedArtwork', () => {
  it('renders the artwork under a dissolve that resolves into the given surface', () => {
    const { toJSON } = render(
      <V2DissolvedArtwork
        testID="art"
        source={{ uri: 'https://assets.test/art.png' }}
        surface="#0B0D11"
        fade={{ left: 0.4, bottom: 0.3 }}
      />,
    );
    expect(screen.getByTestId('art')).toBeTruthy();
    const json = JSON.stringify(toJSON());
    // Every stop paints the surface colour; nothing tints the artwork a different hue.
    expect(json).toContain('#0B0D11');
    expect(json).not.toContain('rgba(0,0,0');
  });
});
