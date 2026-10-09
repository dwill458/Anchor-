
import { render, fireEvent, screen } from '@testing-library/react-native';
import { VisionBoardPreview } from '../VisionBoardPreview';

const tiles = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, imageUrl: `https://assets.test/${i}.jpg` }));

describe('VisionBoardPreview', () => {
  it('uses every real photo across board pages and opens Vision', () => {
    const open = jest.fn();
    render(<VisionBoardPreview tiles={tiles} statement="My real future" onPress={open} testID="board" />);
    expect(screen.getByTestId('board-image-0').props.source).toEqual({ uri: tiles[0].imageUrl });
    expect(screen.queryByTestId('board-image-1')).toBeNull();
    fireEvent.press(screen.getByTestId('board'));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('keeps a single photo singular and never fabricates missing imagery', () => {
    const view = render(<VisionBoardPreview tiles={[tiles[0]]} statement="A real intention" testID="board" />);
    expect(screen.getByTestId('board-image-0')).toBeTruthy();
    expect(screen.queryByTestId('board-image-1')).toBeNull();
    view.rerender(<VisionBoardPreview tiles={[]} statement="Words only" testID="board" />);
    expect(screen.queryByTestId('board-image-0')).toBeNull();
    expect(screen.getByText('Words only')).toBeTruthy();
  });
  it('uses the first available image when the earliest scene has no resolved URL', () => {
    const unresolvedFirst = [
      { id: 'pending', imageUrl: null },
      { id: 'resolved', imageUrl: 'https://assets.test/resolved.jpg' },
    ];
    render(<VisionBoardPreview tiles={unresolvedFirst} testID="board" />);
    expect(screen.getByTestId('board-image-1').props.source).toEqual({ uri: 'https://assets.test/resolved.jpg' });
    expect(screen.queryByText('Your Vision has no images yet')).toBeNull();
  });
  it('reserves geometry and exposes a failed image honestly', () => {
    const view = render(<VisionBoardPreview tiles={tiles} testID="board" />);
    fireEvent(view.getByTestId('board-image-0'), 'error', { nativeEvent: { error: 'offline' } });
    expect(view.getByText('Image unavailable. Tap to retry.')).toBeTruthy();
    expect(view.getByTestId('board').props.accessibilityLabel).toBe('Vision image unavailable. Tap to retry.');
    const style = require('react-native').StyleSheet.flatten(view.getByTestId('board').props.style);
    expect(style.height).toBeGreaterThan(0);
    fireEvent.press(view.getByTestId('board'));
    expect(view.getByTestId('board-image-0').props.source).toEqual({ uri: tiles[0].imageUrl });
    view.rerender(<VisionBoardPreview tiles={[{ id: 'new', imageUrl: 'https://new.test/photo.jpg' }]} testID="board" />);
    expect(view.getByTestId('board-image-0').props.source.uri).toBe('https://new.test/photo.jpg');
  });

});
