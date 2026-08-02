import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AnchorArtworkThumbnail } from '../AnchorArtworkThumbnail';

jest.mock('react-native-svg', () => ({
  SvgXml: ({ xml }: { xml: string }) => {
    const { Text } = require('react-native');
    return <Text testID="sigil-svg">{xml}</Text>;
  },
}));

const styles = StyleSheet.create({
  image: { width: 48, height: 48 },
  fallback: { width: 48, height: 48 },
});

describe('AnchorArtworkThumbnail', () => {
  const props = {
    imageUrl: 'https://cdn.example.com/anchor.png',
    sigilXml: '<svg><path /></svg>',
    imageStyle: styles.image,
    fallbackStyle: styles.fallback,
    fallbackSize: 36,
    testID: 'anchor-artwork',
  };

  it('shows the saved sigil after the remote artwork fails to load', () => {
    render(<AnchorArtworkThumbnail {...props} />);

    fireEvent(screen.getByTestId('anchor-artwork-image'), 'error');

    expect(screen.queryByTestId('anchor-artwork-image')).toBeNull();
    expect(screen.getByTestId('anchor-artwork-fallback')).toBeTruthy();
    expect(screen.getByTestId('sigil-svg').props.children).toBe(props.sigilXml);
  });

  it('tries again when the backend supplies a fresh signed URL', () => {
    const { rerender } = render(<AnchorArtworkThumbnail {...props} />);
    fireEvent(screen.getByTestId('anchor-artwork-image'), 'error');

    rerender(
      <AnchorArtworkThumbnail
        {...props}
        imageUrl="https://cdn.example.com/anchor-refreshed.png"
      />
    );

    expect(screen.getByTestId('anchor-artwork-image')).toBeTruthy();
    expect(screen.queryByTestId('anchor-artwork-fallback')).toBeNull();
  });

  it('uses the saved sigil when an anchor has no enhanced image', () => {
    render(<AnchorArtworkThumbnail {...props} imageUrl={undefined} />);

    expect(screen.queryByTestId('anchor-artwork-image')).toBeNull();
    expect(screen.getByTestId('anchor-artwork-fallback')).toBeTruthy();
  });
});
