import React from 'react';
import { render } from '@testing-library/react-native';
import { VisionNoteRenderer } from '../VisionNoteRenderer';
import { VISION_NOTE_PRESETS } from '../visionNoteStyles';

describe('VisionNoteRenderer', () => {
  it.each(VISION_NOTE_PRESETS)('renders preset $id with its label and accessible live content', preset => {
    const view = render(<VisionNoteRenderer styleId={preset.id} text="A distinct note" width={220} height={150} compact />);
    expect(view.getByTestId('vision-note-renderer').props.accessibilityLabel).toBe('A distinct note');
    expect(view.UNSAFE_getByType(require('react-native').Text).props.children).toBe('A distinct note');
  });
  it.each(['sticky_blush_pink', 'paper_blush_torn', 'editorial_botanical_shadow'] as const)(
    'renders the selected %s style as native, accessible text', styleId => {
      const view = render(<VisionNoteRenderer styleId={styleId} text={'A thought\nfor later'} width={240} height={160} />);
      const note = view.getByTestId('vision-note-renderer');
      expect(note.props.accessible).toBe(true);
      expect(note.props.accessibilityLabel).toContain('A thought');
      expect(view.UNSAFE_getByType(require('react-native').Text).props.children).toBe('A thought\nfor later');
    },
  );

  it('uses the presentation geometry and explicit color overrides', () => {
    const view = render(<VisionNoteRenderer styleId="paper_aged_parchment" text="hello" width={210} height={130}
      presentation={{ x: 0.3, y: 0.4, width: 0.5, height: 0.2, rotation: -4, scale: 1.1, layerOrder: 4 }}
      colorOverride="#18212A" />);
    expect(view.getByTestId('vision-note-renderer').props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ width: 105, height: 26, left: 10.5, top: 39, zIndex: 4 }),
    ]));
  });

  it('retains every character in a long multiline note and enables scrolling for overflow', () => {
    const text = `${'LongWord'.repeat(25)}\n${'Another line\n'.repeat(15)}`;
    const view = render(<VisionNoteRenderer styleId="editorial_classic_cream" text={text} width={180} height={80} />);
    expect(view.getByTestId('vision-note-renderer').props.accessibilityLabel).toBe(text);
    expect(view.UNSAFE_getByType(require('react-native').Text).props.children).toBe(text);
    expect(view.UNSAFE_getByType(require('react-native').ScrollView).props.scrollEnabled).toBe(true);
  });
});
