import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { VisionLayoutSheet } from '../VisionLayoutSheet';
import type { V2VisionTile } from '@/adapters/v2/vision';

const photograph = 'https://cdn.example.com/my-persisted-vision.jpg';
const tile: V2VisionTile = {
  id: 'scene-a', sceneId: 'scene-a', imageUrl: photograph, prompt: null, caption: 'My own studio',
  slotIndex: 0, sortOrder: 0, isHero: true, focal: { x: .2, y: .7 }, sourceType: 'USER_UPLOAD',
};
function props() {
  return {
    visible: true, current: 'CLASSIC' as const, onPreview: jest.fn(), onApply: jest.fn(), onClose: jest.fn(), busy: false,
    tiles: [tile], notes: [], intention: 'I build what matters', width: 296,
    art: { svg: '<svg viewBox="0 0 80 100"><path d="M10 10 L60 40 L20 90" stroke="black" fill="none"/></svg>' },
  };
}

describe('Vision layout selector applies only explicit choices', () => {
  it('marks the persisted layout and renders all three live photo previews', () => {
    const callbacks = props();
    const view = render(<VisionLayoutSheet {...callbacks} />);
    expect(view.getByTestId('vision-layout-CLASSIC').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('vision-layout-EDITORIAL').props.accessibilityState.selected).toBe(false);
    expect(view.getByTestId('vision-layout-SCRAPBOOK').props.accessibilityState.selected).toBe(false);
    expect(view.getAllByTestId('vision-board-photo-scene-a')).toHaveLength(3);
    const sources = view.UNSAFE_getAllByType(Image).map(node => node.props.source?.uri).filter(Boolean);
    expect(sources.filter(uri => uri === photograph)).toHaveLength(3);
    expect(callbacks.onPreview).not.toHaveBeenCalled();
    expect(callbacks.onApply).not.toHaveBeenCalled();
  });

  it('previews a selected layout before applying that exact choice', () => {
    const callbacks = props();
    const view = render(<VisionLayoutSheet {...callbacks} />);
    fireEvent.press(view.getByTestId('vision-layout-EDITORIAL'));
    expect(callbacks.onPreview).toHaveBeenCalledWith('EDITORIAL');
    expect(callbacks.onApply).not.toHaveBeenCalled();
    expect(view.getByTestId('vision-layout-EDITORIAL').props.accessibilityState.selected).toBe(true);
    fireEvent.press(view.getByTestId('vision-layout-apply'));
    expect(callbacks.onApply).toHaveBeenCalledTimes(1);
    expect(callbacks.onApply).toHaveBeenCalledWith('EDITORIAL');
  });

  it('cancels a preview through Keep without persisting it', () => {
    const callbacks = props();
    const view = render(<VisionLayoutSheet {...callbacks} />);
    fireEvent.press(view.getByTestId('vision-layout-SCRAPBOOK'));
    fireEvent.press(view.getByText('Keep Classic'));
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
    expect(callbacks.onApply).not.toHaveBeenCalled();
  });

  it('restores the persisted selection when a cancelled sheet opens again', () => {
    const callbacks = props();
    const view = render(<VisionLayoutSheet {...callbacks} />);
    fireEvent.press(view.getByTestId('vision-layout-SCRAPBOOK'));
    view.rerender(<VisionLayoutSheet {...callbacks} visible={false} />);
    view.rerender(<VisionLayoutSheet {...callbacks} visible />);
    expect(view.getByTestId('vision-layout-CLASSIC').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('vision-layout-SCRAPBOOK').props.accessibilityState.selected).toBe(false);
    expect(callbacks.onApply).not.toHaveBeenCalled();
  });

  it('blocks preview, apply, cancellation and scrim dismissal during a save', () => {
    const callbacks = props();
    const view = render(<VisionLayoutSheet {...callbacks} busy />);
    fireEvent.press(view.getByTestId('vision-layout-EDITORIAL'));
    fireEvent.press(view.getByTestId('vision-layout-apply'));
    fireEvent.press(view.getByText('Keep Classic'));
    fireEvent.press(view.getByLabelText('Keep current board layout'));
    expect(callbacks.onPreview).not.toHaveBeenCalled();
    expect(callbacks.onApply).not.toHaveBeenCalled();
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(view.getByText('Saving…')).toBeTruthy();
  });
});
