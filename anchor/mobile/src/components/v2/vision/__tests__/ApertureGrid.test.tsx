import React from 'react';
import { render } from '@testing-library/react-native';
import { ApertureGrid } from '../ApertureGrid';
import { GhostVisionComposition } from '../GhostVisionComposition';
import { RealVisionComposition } from '../RealVisionComposition';
import { Text, View } from 'react-native';

describe('ApertureGrid & Vision Compositions', () => {
  it('renders ApertureGrid with hero and 2 stack slots for 3 items', () => {
    const items = ['tile-1', 'tile-2', 'tile-3'];
    const { getByTestId, getByText } = render(
      <ApertureGrid
        items={items}
        height={250}
        renderTile={(item, index, isHero) => (
          <View testID={`tile-${index}`}>
            <Text>{item} {isHero ? '(hero)' : ''}</Text>
          </View>
        )}
      />,
    );

    expect(getByTestId('v2-aperture-grid')).toBeTruthy();
    expect(getByText('tile-1 (hero)')).toBeTruthy();
    expect(getByText('tile-2')).toBeTruthy();
    expect(getByText('tile-3')).toBeTruthy();
  });

  it('renders bottom strip when item count exceeds 3', () => {
    const items = ['t1', 't2', 't3', 't4', 't5'];
    const { getByText } = render(
      <ApertureGrid
        items={items}
        height={250}
        renderTile={(item, index, isHero) => (
          <View testID={`tile-${index}`}>
            <Text>{item} {isHero ? '(hero)' : ''}</Text>
          </View>
        )}
      />,
    );

    expect(getByText('t1 (hero)')).toBeTruthy();
    expect(getByText('t4')).toBeTruthy();
    expect(getByText('t5')).toBeTruthy();
  });

  it('GhostVisionComposition renders empty placeholder composition', () => {
    const { getByTestId } = render(<GhostVisionComposition />);
    expect(getByTestId('ghost-vision-composition')).toBeTruthy();
  });

  it('GhostVisionComposition supports compact mode', () => {
    const { getByTestId } = render(<GhostVisionComposition compact count={3} />);
    expect(getByTestId('ghost-vision-composition')).toBeTruthy();
  });

  it('RealVisionComposition renders real vision tiles and marks hero', () => {
    const mockTiles = [
      { id: 't1', sceneId: 's1', imageUrl: 'https://example.com/1.jpg', prompt: 'Desk', sortOrder: 0, isHero: true },
      { id: 't2', sceneId: 's2', imageUrl: 'https://example.com/2.jpg', prompt: 'Window', sortOrder: 1, isHero: false },
      { id: 't3', sceneId: 's3', imageUrl: 'https://example.com/3.jpg', prompt: 'Studio', sortOrder: 2, isHero: false },
    ];

    const { getByTestId } = render(
      <RealVisionComposition tiles={mockTiles} featuredTileId="t1" category="Career" />,
    );
    expect(getByTestId('real-vision-composition')).toBeTruthy();
  });
});
