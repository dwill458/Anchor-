import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { VisionBoardPreview } from '../VisionBoardPreview';

const tiles = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, imageUrl: `https://assets.test/${i}.jpg` }));

describe('VisionBoardPreview', () => {
  it('uses every real photo across board pages and opens Vision', () => {
    const open = jest.fn();
    render(<VisionBoardPreview tiles={tiles} statement="My real future" onPress={open} testID="board" />);
    tiles.forEach((tile, i) => expect(screen.getByTestId(`board-image-${i}`).props.source).toEqual({ uri: tile.imageUrl }));
    fireEvent.press(screen.getByTestId('board'));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Vision board page 3 of 3')).toBeTruthy();
    expect(screen.getByTestId('board-image-0')).toBeTruthy();
    expect(screen.getByTestId('board-image-1')).toBeTruthy();
  });

  it('keeps a single photo singular and never fabricates missing imagery', () => {
    const view = render(<VisionBoardPreview tiles={[tiles[0]]} statement="A real intention" testID="board" />);
    expect(screen.getByTestId('board-image-0')).toBeTruthy();
    expect(screen.queryByTestId('board-image-1')).toBeNull();
    view.rerender(<VisionBoardPreview tiles={[]} statement="Words only" testID="board" />);
    expect(screen.queryByTestId('board-image-0')).toBeNull();
    expect(screen.getByText('Words only')).toBeTruthy();
  });
});
