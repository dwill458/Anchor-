import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';

const mockDownload = jest.fn();
jest.mock('@/hooks/useDownloadAnchor', () => ({
  useDownloadAnchor: () => ({ downloadAnchor: mockDownload, isLoading: false, error: null }),
}));

import { ExportAnchorSheet } from '../ExportAnchorSheet';
import { ExportPreviewRenderer, resolveExportLayout, exportTextColor, EXPORT_DIMENSIONS } from '../ExportPreviewRenderer';

const renderSheet = (props = {}) =>
  render(
    <ExportAnchorSheet
      isVisible
      onClose={jest.fn()}
      sigilSvg="<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>"
      intention="I am the owner of dope regal"
      {...props}
    />,
  );

beforeEach(() => {
  mockDownload.mockReset();
  mockDownload.mockResolvedValue({ uri: 'file:///saved.png', size: 1 });
});

describe('ExportAnchorSheet', () => {
  it('lists Format, Resolution, Background and Intention in order, with the 2.0 copy', () => {
    renderSheet();
    expect(screen.getByText('Export anchor')).toBeTruthy();
    const labels = ['FORMAT', 'RESOLUTION', 'BACKGROUND', 'INTENTION'];
    labels.forEach((label) => expect(screen.getByText(label)).toBeTruthy());
    ['Square', 'Wallpaper', 'Print', 'Standard', 'Card', 'Clear', 'Text', 'None'].forEach((label) =>
      expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeTruthy(),
    );
    expect(screen.getByText('Save to Camera Roll')).toBeTruthy();
    expect(screen.getByText('PNG · 1170 × 2532 · Saved to Photos')).toBeTruthy();
  });

  it('shows the repo dimensions, not the prototype placeholders, for Print', () => {
    renderSheet();
    fireEvent.press(screen.getByLabelText('Print, 300 DPI'));
    expect(screen.getByText('PNG · 2400 × 2400 · Saved to Photos')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(/^High-res/));
    expect(screen.getByText('PNG · 7200 × 7200 · Saved to Photos')).toBeTruthy();
  });

  it('previews Card, and a checkerboard for Clear', () => {
    renderSheet();
    expect(screen.getByLabelText(/card background/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Clear'));
    expect(screen.getByLabelText(/transparent background/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('None'));
    expect(screen.getByLabelText(/anchor only/)).toBeTruthy();
  });

  it('exports with the chosen background and intention, and reports a summary to the host', async () => {
    const onSaved = jest.fn();
    const onClose = jest.fn();
    renderSheet({ onSaved, onClose });
    fireEvent.press(screen.getByLabelText('Clear'));
    fireEvent.press(screen.getByLabelText('None'));
    fireEvent.press(screen.getByLabelText('Save to Camera Roll'));
    await waitFor(() => expect(mockDownload).toHaveBeenCalled());
    const [, format, resolution, background, showIntention] = mockDownload.mock.calls[0];
    expect([format, resolution, background, showIntention]).toEqual(['wallpaper', 'standard', 'clear', false]);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.stringContaining('transparent')));
    expect(onSaved.mock.calls[0][0]).toContain('anchor only');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('export layout', () => {
  it('puts the anchor high with text beneath, or centred alone', () => {
    const withText = resolveExportLayout(1000, 2000, true);
    const alone = resolveExportLayout(1000, 2000, false);
    expect(withText.anchorTop).toBeCloseTo(360, 5);
    expect(withText.textTop).toBeGreaterThan(withText.anchorTop + withText.anchor);
    expect(alone.anchorTop).toBeCloseTo((2000 - alone.anchor) / 2, 5);
  });

  it('uses ink text on the card and light text on clear', () => {
    expect(exportTextColor('card')).toBe('#121A22');
    expect(exportTextColor('clear')).toBe('#F4F1E9');
  });

  it('renders a transparent canvas for Clear, cream for Card, at the real export size', () => {
    const { w, h } = EXPORT_DIMENSIONS.wallpaper.standard;
    const clear = render(
      <ExportPreviewRenderer format="wallpaper" resolution="standard" background="clear" showIntention intention="Words" />,
    );
    const clearRoot = clear.toJSON();
    if (!clearRoot || Array.isArray(clearRoot)) throw new Error('Expected a single clear export root.');
    expect(clearRoot.props.style).toMatchObject({ width: w, height: h, backgroundColor: 'transparent' });
    const card = render(
      <ExportPreviewRenderer format="wallpaper" resolution="standard" background="card" showIntention={false} />,
    );
    const cardRoot = card.toJSON();
    if (!cardRoot || Array.isArray(cardRoot)) throw new Error('Expected a single card export root.');
    expect(cardRoot.props.style).toMatchObject({ backgroundColor: '#F4F1E9' });
  });

  it('omits the text when the intention is None', () => {
    render(<ExportPreviewRenderer format="square" resolution="standard" background="card" showIntention={false} intention="Hidden words" />);
    expect(screen.queryByText('Hidden words')).toBeNull();
  });
});
