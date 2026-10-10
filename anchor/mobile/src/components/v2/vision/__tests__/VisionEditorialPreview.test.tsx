import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { VisionEditorialPreview } from '../VisionEditorialPreview';
import { VisionBoardPreview } from '../VisionBoardPreview';

jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => true }));
const photos = Array.from({ length: 6 }, (_, i) => ({ id: `photo-${i}`, imageUrl: `https://vision.test/${i}.jpg` }));

describe('VisionEditorialPreview', () => {
  it.each([1, 2, 3])('renders exactly %i real images without empty template frames', count => {
    const view = render(<VisionEditorialPreview tiles={photos.slice(0, count)} testID="preview" />);
    for (let i = 0; i < count; i++) expect(view.getByTestId(`preview-image-${i}`)).toBeTruthy();
    expect(view.queryByTestId(`preview-image-${count}`)).toBeNull();
  });

  it('details represents five real images and respects the featured image', () => {
    const view = render(<VisionEditorialPreview tiles={photos} variant="details" featuredTileId="photo-2" imageTestID="hero" testID="preview" />);
    expect(view.getByTestId('hero').props.source.uri).toBe(photos[2].imageUrl);
    [0, 1, 3, 4].forEach(i => expect(view.getByTestId(`preview-image-${i}`)).toBeTruthy());
    expect(view.queryByTestId('preview-image-5')).toBeNull();
  });

  it('contains unknown photos then fits extreme portrait/landscape print bounds without changing the canvas', () => {
    const view = render(<VisionEditorialPreview tiles={photos.slice(0, 3)} testID="preview" />);
    const image = view.getByTestId('preview-image-0');
    const before = StyleSheet.flatten(image.props.style);
    expect(image.props.resizeMode).toBe('contain');
    for (const source of [{ width: 300, height: 1200 }, { width: 1600, height: 300 }]) {
      fireEvent(image, 'load', { nativeEvent: { source } });
      const print = StyleSheet.flatten(view.getByTestId('preview-image-0-print').props.style);
      expect((print.width - 8) / (print.height - 8)).toBeCloseTo(source.width / source.height, 5);
      expect(StyleSheet.flatten(view.getByTestId('preview-image-0').props.style)).toEqual(before);
    }
  });

  it('does not reserve a giant empty photo canvas for note-only Visions', () => {
    const view = render(<VisionEditorialPreview tiles={[]} noteElements={[{ id: 'real', render: () => <Text>Actual personal note</Text> }]} />);
    expect(view.getByText('Actual personal note')).toBeTruthy();
    expect(view.queryByText('Your Vision has no images yet')).toBeNull();
  });

  it('reuses decoded image URLs on signing refresh and uses the fresh URL if the original fails', () => {
    const original = 'https://vision.test/photo.jpg?X-Amz-Signature=old';
    const refreshed = 'https://vision.test/photo.jpg?X-Amz-Signature=new';
    const view = render(<VisionEditorialPreview tiles={[{ id: 'signed', imageUrl: original }]} testID="preview" />);
    view.rerender(<VisionEditorialPreview tiles={[{ id: 'signed', imageUrl: refreshed }]} testID="preview" />);
    expect(view.getByTestId('preview-image-0').props.source.uri).toBe(original);
    fireEvent(view.getByTestId('preview-image-0'), 'error', {});
    expect(view.getByTestId('preview-image-0').props.source.uri).toBe(refreshed);
  });

  it('recovers when an unavailable image URI changes and preserves navigation during failure', () => {
    const open = jest.fn();
    const view = render(<VisionBoardPreview tiles={photos} testID="preview" onPress={open} />);
    fireEvent(view.getByTestId('preview-image-0'), 'error', {});
    expect(view.getByText('Image unavailable')).toBeTruthy();
    expect(view.getByTestId('preview-image-1')).toBeTruthy();
    fireEvent.press(view.getByTestId('preview'));
    expect(open).toHaveBeenCalledTimes(1);
    view.rerender(<VisionBoardPreview tiles={[{ ...photos[0], imageUrl: photos[1].imageUrl }]} testID="preview" />);
    expect(view.getByTestId('preview-image-0').props.source.uri).toBe(photos[1].imageUrl);
  });

  it('accepts real optional styled note renderers, one on Home and two on Details', () => {
    const renderNote = jest.fn(({ width, height }) => <Text>{`Real note ${width > 0 && height > 0}`}</Text>);
    const notes = [0, 1, 2].map(i => ({ id: `note-${i}`, render: renderNote }));
    const view = render(<VisionEditorialPreview tiles={photos} noteElements={notes} />);
    expect(view.getAllByText('Real note true')).toHaveLength(1);
    view.rerender(<VisionEditorialPreview tiles={photos} variant="details" noteElements={notes} />);
    expect(view.getAllByText('Real note true')).toHaveLength(2);
    expect(renderNote).toHaveBeenCalledWith(expect.objectContaining({ height: 112 }));
  });

  it('exposes a labeled navigation target and respects reduced motion', () => {
    const open = jest.fn();
    const view = render(<VisionEditorialPreview tiles={photos} onPress={open} accessibilityLabel="View my Vision" reduceMotion testID="preview" />);
    expect(view.getByRole('button', { name: 'View my Vision' })).toBeTruthy();
    fireEvent.press(view.getByTestId('preview'));
    expect(open).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('preview-image-0').props.fadeDuration).toBe(0);
    expect(view.UNSAFE_root.findAll((node: { props: { entering?: unknown } }) => node.props.entering !== undefined)).toHaveLength(0);
  });
});
