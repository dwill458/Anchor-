import { useMemo } from 'react';
import type { VisionNote } from '@/adapters/v2/vision';
import { VisionNoteRenderer, VISION_NOTE_STYLE_IDS } from './notes';

/** Read-only bridge: the Notes feature owns its model, materials and renderer. */
export function useVisionEditorialNotes(notes?: readonly VisionNote[]) {
  return useMemo(() => (notes ?? [])
    .filter(note => !note.isArchived && note.content.text.trim() && VISION_NOTE_STYLE_IDS.some(style => style === note.presentation.styleId))
    .sort((a, b) => a.presentation.layerOrder - b.presentation.layerOrder || a.id.localeCompare(b.id))
    .map(note => ({
      id: note.id,
      render: ({ width, height }: { width: number; height: number }) => {
        const text = note.content.text.trim().replace(/\s+/g, ' ');
        // Keep a readable excerpt instead of scaling long personal text to tiny type.
        const characters = Array.from(text);
        const readableBudget = Math.max(18, Math.min(90,
          Math.floor(Math.max(20, width - 28) / 10) * Math.floor(Math.max(26, height - 24) / 26)));
        const rawSlice = characters.slice(0, readableBudget - 1).join('').trimEnd();
        const splitsMidWord = characters.length > readableBudget
          && characters[readableBudget - 2] !== ' '
          && characters[readableBudget - 1] !== ' ';
        const lastSpace = splitsMidWord ? rawSlice.lastIndexOf(' ') : -1;
        const clipped = lastSpace >= Math.min(8, Math.floor(rawSlice.length * 0.5))
          ? rawSlice.slice(0, lastSpace).trimEnd()
          : rawSlice;
        const excerpt = characters.length > readableBudget ? `${clipped}…` : text;
        return <VisionNoteRenderer styleId={note.presentation.styleId} fontId={note.presentation.fontId} text={excerpt}
          width={width} height={height} compact scrollText={false} testID={`vision-preview-note-${note.id}`} />;
      },
    })), [notes]);
}
