import { render, fireEvent } from '@testing-library/react-native';
import { VisionBoardPreview } from '../VisionBoardPreview';

jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => true }));
const tiles = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, imageUrl: `https://assets.test/${i}.jpg` }));

describe('VisionBoardPreview compatibility', () => {
  it('shows three real photos and preserves Vision navigation', () => {
    const open = jest.fn();
    const view = render(<VisionBoardPreview tiles={tiles} statement="My real future" onPress={open} testID="board" />);
    [0, 1, 2].forEach(index => expect(view.getByTestId(`board-image-${index}`).props.source).toEqual({ uri: tiles[index].imageUrl }));
    expect(view.queryByTestId('board-image-3')).toBeNull();
    fireEvent.press(view.getByTestId('board'));
    expect(open).toHaveBeenCalledTimes(1);
  });
  it('keeps a single photo singular and preserves the statement when empty', () => {
    const view = render(<VisionBoardPreview tiles={[tiles[0]]} statement="A real intention" testID="board" />);
    expect(view.getByTestId('board-image-0')).toBeTruthy();
    expect(view.queryByTestId('board-image-1')).toBeNull();
    view.rerender(<VisionBoardPreview tiles={[]} statement="Words only" testID="board" />);
    expect(view.queryByTestId('board-image-0')).toBeNull();
    expect(view.getByText('Words only')).toBeTruthy();
  });
  it('skips unresolved images without reordering the remainder', () => {
    const view = render(<VisionBoardPreview tiles={[{ id: 'pending', imageUrl: null }, { id: 'resolved', imageUrl: 'https://assets.test/resolved.jpg' }]} testID="board" />);
    expect(view.getByTestId('board-image-1').props.source).toEqual({ uri: 'https://assets.test/resolved.jpg' });
    expect(view.queryByText('Your Vision has no images yet')).toBeNull();
  });
  it('keeps supporting images and navigation available when the hero fails', () => {
    const open = jest.fn();
    const view = render(<VisionBoardPreview tiles={tiles} onPress={open} testID="board" />);
    fireEvent(view.getByTestId('board-image-0'), 'error', {});
    expect(view.getByText('Image unavailable')).toBeTruthy();
    expect(view.getByTestId('board-image-1')).toBeTruthy();
    fireEvent.press(view.getByTestId('board'));
    expect(open).toHaveBeenCalledTimes(1);
  });
});
