import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import type { VisionNote } from '@/adapters/v2/vision';
import { getVisionNotePreset, VISION_NOTE_STYLE_IDS } from '../notes';
import { useVisionEditorialNotes } from '../useVisionEditorialNotes';

function Host({ notes }: { notes: VisionNote[] }) {
  const elements = useVisionEditorialNotes(notes);
  return <View>{elements.map(note => <View key={note.id}>{note.render({ width: 200, height: 110 })}</View>)}</View>;
}
const note = (text: string, styleId = VISION_NOTE_STYLE_IDS[0]): VisionNote => ({
  id: 'n1', visionId: 'v1', content: { text }, createdAt: '', updatedAt: '',
  presentation: { styleId, x: 0, y: 0, width: 1, height: 1, rotation: 0, scale: 1, layerOrder: 0 },
});
describe('read-only Notes preview bridge', () => {
  it('renders real content through the selected material renderer', () => {
    const view = render(<Host notes={[note('A real personal intention')]} />);
    expect(view.getByText('A real personal intention', { includeHiddenElements: true })).toBeTruthy();
    expect(view.getByTestId('vision-preview-note-n1').props.accessibilityLabel).toBe('A real personal intention');
    expect(StyleSheet.flatten(view.getByText('A real personal intention', { includeHiddenElements: true }).props.style).fontFamily)
      .toBe(getVisionNotePreset(VISION_NOTE_STYLE_IDS[0]).fontFamily);
  });
  it('uses a readable excerpt for long text and omits unsupported or empty notes', () => {
    const view = render(<Host notes={[note('Real content '.repeat(20))]} />);
    expect(view.getByTestId('vision-preview-note-n1').props.accessibilityLabel.length).toBeLessThanOrEqual(51);
    expect(view.getByTestId('vision-preview-note-n1').props.accessibilityLabel.endsWith('…')).toBe(true);
    view.rerender(<Host notes={[note('  '), note('Future style', 'unknown' as never)]} />);
    expect(view.queryByTestId('vision-preview-note-n1')).toBeNull();
  });
});
