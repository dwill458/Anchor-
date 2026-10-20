import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { VisionPreviewCard } from '../VisionPreviewCard';

const photos = Array.from({ length: 10 }, (_, i) => ({ id: `photo-${i}`, imageUrl: `https://vision.test/${i}.jpg` }));
const prints = (view: { queryAllByTestId: (matcher: RegExp) => unknown[] }) => view.queryAllByTestId(/^card-print-\d+$/);

describe('VisionPreviewCard: home variant', () => {
  it('shows the title, the real item count and the photographs in one press target', () => {
    const open = jest.fn();
    const view = render(<VisionPreviewCard variant="home" tiles={photos.slice(0, 3)} testID="card" onPress={open}
      accessibilityLabel="Enter your Vision" viewAllLabel="View all Vision" imageTestID="card-hero" />);
    expect(view.getByText('Your Vision')).toBeTruthy();
    expect(view.getByText('3 items')).toBeTruthy();
    expect(prints(view)).toHaveLength(3);
    expect(view.getByTestId('card-hero').props.source.uri).toBe(photos[0].imageUrl);
    fireEvent.press(view.getByRole('button', { name: 'Enter your Vision' }));
    fireEvent.press(view.getByLabelText('View all Vision'));
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('gives the count the singular form for a single item', () => {
    const view = render(<VisionPreviewCard variant="home" tiles={photos.slice(0, 1)} testID="card" />);
    expect(view.getByText('1 item')).toBeTruthy();
  });

  it('captions the statement, including when it repeats the intention shown on Home', () => {
    const view = render(<VisionPreviewCard variant="home" tiles={[]} statement="A quiet studio" statementTestID="card-title"
      intentionText="Build momentum" testID="card" />);
    expect(view.getByTestId('card-title').props.children).toBe('A quiet studio');
    const repeated = render(<VisionPreviewCard variant="home" tiles={[]} statement="build  momentum" statementTestID="repeat"
      intentionText="Build momentum" testID="card2" />);
    expect(repeated.getByTestId('repeat').props.children).toBe('build  momentum');
  });

  it('can be disabled without a press target', () => {
    const view = render(<VisionPreviewCard variant="home" tiles={photos.slice(0, 1)} testID="card" />);
    expect(view.getByTestId('card').props.accessibilityState?.disabled ?? false).toBe(true);
  });
});

describe('VisionPreviewCard: details variant', () => {
  it('keeps the View Vision link and caption, and hides the header the host already shows', () => {
    const open = jest.fn();
    const view = render(<VisionPreviewCard variant="details" tiles={photos.slice(0, 2)} title={null} statement="Calm, unhurried"
      accent="#CE6091" testID="card" accessibilityLabel="Vision" onPress={open} />);
    expect(view.queryByText('Vision')).toBeNull();
    expect(view.getByText('Calm, unhurried')).toBeTruthy();
    expect(view.getByText('View Vision', { exact: false })).toBeTruthy();
    expect(prints(view)).toHaveLength(2);
    expect(StyleSheet.flatten(view.getByTestId('card-footer').props.style)).toMatchObject({ marginTop: 8 });
    expect(view.queryByTestId('card-chevron')).toBeNull();
    fireEvent.press(view.getByLabelText('Vision'));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('shows the count in place of the caption when there is no caption', () => {
    const view = render(<VisionPreviewCard variant="details" tiles={photos.slice(0, 4)} title={null} testID="card" />);
    expect(view.getByText('4 items')).toBeTruthy();
    expect(prints(view)).toHaveLength(3);
  });
});

describe('VisionPreviewCard: progress variant', () => {
  it('shows the heading, count and up to three thumbnails with no overflow at three photographs', () => {
    const open = jest.fn();
    const view = render(<VisionPreviewCard variant="progress" tiles={photos.slice(0, 3)} testID="card" onPress={open} accessibilityLabel="View Vision" />);
    expect(view.getByText('Vision')).toBeTruthy();
    expect(view.getByText('3 items')).toBeTruthy();
    [0, 1, 2].forEach(index => expect(view.getByTestId(`card-thumb-${index}`)).toBeTruthy());
    expect(view.queryByTestId('card-overflow')).toBeNull();
    expect(view.queryByText(/^\+\d+$/)).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'View Vision' }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('computes +N from the real photograph total: 8 photographs show +5', () => {
    const view = render(<VisionPreviewCard variant="progress" tiles={photos.slice(0, 8)} testID="card" />);
    expect(view.getByText('+5')).toBeTruthy();
    expect(view.getByTestId('card-overflow')).toBeTruthy();
    expect(view.getByText('8 items')).toBeTruthy();
  });

  it('counts notes toward items but not toward the overflow', () => {
    const view = render(<VisionPreviewCard variant="progress" tiles={photos.slice(0, 3)} noteCount={4} testID="card" />);
    expect(view.getByText('7 items')).toBeTruthy();
    expect(view.queryByText(/^\+\d+$/)).toBeNull();
  });

  it('does not navigate when no press handler is supplied', () => {
    const view = render(<VisionPreviewCard variant="progress" tiles={photos.slice(0, 1)} testID="card" />);
    expect(view.getByTestId('card').props.accessibilityState?.disabled ?? false).toBe(true);
  });
});

describe('VisionPreviewCard: states', () => {
  it('renders a neutral empty paper card for a Vision without photographs, with no fake imagery', () => {
    const view = render(<VisionPreviewCard variant="home" tiles={[]} testID="card" />);
    expect(view.getByText('No items yet')).toBeTruthy();
    expect(prints(view)).toHaveLength(0);
  });

  it('renders notes-only as an item count with no photographs', () => {
    const view = render(<VisionPreviewCard variant="details" tiles={[]} noteCount={2} title={null} testID="card" />);
    expect(view.getByText('2 items')).toBeTruthy();
    expect(prints(view)).toHaveLength(0);
  });

  it('ignores tiles without an image URL, so a missing thumbnail is never counted', () => {
    const view = render(<VisionPreviewCard variant="progress" tiles={[{ id: 'a', imageUrl: null }, { id: 'b', imageUrl: '' }, photos[0]]} testID="card" />);
    expect(view.getByText('1 item')).toBeTruthy();
    expect(view.getByTestId('card-thumb-0')).toBeTruthy();
    expect(view.queryByTestId('card-thumb-1')).toBeNull();
  });

  it.each([1, 2, 3])('draws %i print(s) for %i photograph(s) on Home', count => {
    const view = render(<VisionPreviewCard variant="home" tiles={photos.slice(0, count)} testID="card" />);
    expect(prints(view)).toHaveLength(count);
  });

  it('caps Home at three prints for larger Visions and still counts every photograph', () => {
    const view = render(<VisionPreviewCard variant="home" tiles={photos.slice(0, 8)} testID="card" />);
    expect(prints(view)).toHaveLength(3);
    expect(view.getByText('8 items')).toBeTruthy();
  });

  it('falls back to the first photograph when the featured one has been deleted', () => {
    const view = render(<VisionPreviewCard variant="home" tiles={photos.slice(0, 2)} featuredTileId="deleted" imageTestID="card-hero" testID="card" />);
    expect(view.getByTestId('card-hero').props.source.uri).toBe(photos[0].imageUrl);
  });

  it('keeps a failed photograph on neutral paper without crashing, in print and thumbnail forms', () => {
    const home = render(<VisionPreviewCard variant="home" tiles={photos.slice(0, 1)} imageTestID="card-hero" testID="card" />);
    fireEvent(home.getByTestId('card-hero'), 'error', {});
    expect(home.queryByTestId('card-hero')).toBeNull();
    expect(prints(home)).toHaveLength(1);

    const progress = render(<VisionPreviewCard variant="progress" tiles={photos.slice(0, 2)} testID="card" />);
    fireEvent(progress.getByTestId('card-thumb-0-image'), 'error', {});
    expect(progress.queryByTestId('card-thumb-0-image')).toBeNull();
    expect(progress.getByTestId('card-thumb-0')).toBeTruthy();
  });
});
