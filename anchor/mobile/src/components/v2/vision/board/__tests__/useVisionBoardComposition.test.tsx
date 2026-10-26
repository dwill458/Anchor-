import React from 'react';
import { Dimensions, Text } from 'react-native';
import { act, render, renderHook } from '@testing-library/react-native';
import type { V2VisionTile, VisionNote } from '@/adapters/v2/vision';
import { composeVisionBoard } from '../visionBoardComposition';
import { useVisionBoardComposition } from '../useVisionBoardComposition';

const photographs: V2VisionTile[] = Array.from({ length: 4 }, (_, i) => ({
  id: `p${i}`, sceneId: `p${i}`, imageUrl: `https://cdn.test/persisted-${i}.jpg`,
  prompt: null, caption: `My persisted caption ${i}`, slotIndex: i, sortOrder: i, isHero: i === 0,
  focal: { x: .3, y: .7 },
}));
const note: VisionNote = {
  id: 'saved-note', visionId: 'vision', content: { text: 'A future worth seeing' },
  presentation: { styleId: 'paper_ivory_torn', fontId: 'classic', x: .5, y: .8, width: .2, height: .12, scale: 1, rotation: 0, layerOrder: 2 },
  layoutPositions: { EDITORIAL: { x: .4, y: 4.6 }, SCRAPBOOK: { x: .7, y: 4.8 } },
  createdAt: '', updatedAt: '',
};

describe('shared native caption measurement readiness used by board, Visualize and export hosts', () => {
  it.each(['CLASSIC', 'EDITORIAL', 'SCRAPBOOK'] as const)('keeps %s unready until native text callbacks settle, then publishes identical measured geometry', boardLayout => {
    const input = { tiles: photographs, notes: [note], width: 366, boardLayout };
    const before = JSON.stringify(input);
    const { result } = renderHook(() => useVisionBoardComposition(input));
    expect(result.current.ready).toBe(false);
    const measurements = render(result.current.measurementView);
    const measured: Record<string, number> = {};
    // Classic may discover additional label widths after the first measured
    // layout. Every discovered metric must settle before any host gets ready.
    for (let pass = 0; pass < 10 && !result.current.ready; pass += 1) {
      const pending = result.current.measurements.filter(metric => measured[metric.key] === undefined);
      expect(pending.length).toBeGreaterThan(0);
      const textNodes = measurements.UNSAFE_getAllByType(Text);
      act(() => {
        for (const node of textNodes) {
          const style = node.props.style;
          const key = JSON.stringify([node.props.children, style.width, style.fontSize, style.lineHeight, style.fontFamily]);
          measured[key] = style.lineHeight * 2;
          node.props.onTextLayout({ nativeEvent: { lines: [
            { y: 0, height: style.lineHeight }, { y: style.lineHeight, height: style.lineHeight },
          ] } });
        }
      });
      measurements.rerender(result.current.measurementView);
    }
    expect(result.current.ready).toBe(true);
    const expected = composeVisionBoard({ ...input, fontScale: Dimensions.get('window').fontScale, measured });
    expect(result.current.layout).toEqual(expected.layout);
    expect(result.current.notes).toEqual(expected.notes);
    expect(result.current.size).toEqual(expected.size);
    expect(result.current.order).toEqual(expected.order);
    expect(JSON.stringify(input)).toBe(before);
  });
});
