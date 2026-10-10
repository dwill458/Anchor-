import { useMemo } from 'react';
import type { VisionNote } from '@/adapters/v2/vision';
import { VisionNoteRenderer, VISION_NOTE_STYLE_IDS } from './notes';

/** Read-only bridge: the Notes feature owns its model, materials and renderer. */
export function useVisionEditorialNotes(notes?: readonly VisionNote[]) {
  return useMemo(() => (notes ?? [])
    .filter(note => note.content.text.trim() && VISION_NOTE_STYLE_IDS.some(style => style === note.presentation.styleId))
    .sort((a, b) => a.presentation.layerOrder - b.presentation.layerOrder || a.id.localeCompare(b.id))
    .map(note => ({
      id: note.id,
      render: ({ width, height }: { width: number; height: number }) => {
        const text = note.content.text.trim().replace(/\s+/g, ' ');
        // Keep a readable excerpt instead of scaling long personal text to tiny type.
        const characters = Array.from(text);
        const readableBudget = Math.max(12, Math.min(90,
          Math.floor(Math.max(20, width - 28) / 10) * Math.floor(Math.max(26, height - 24) / 26)));
        const excerpt = characters.length > readableBudget ? `${characters.slice(0, readableBudget - 1).join('').trimEnd()}…` : text;
        return <VisionNoteRenderer styleId={note.presentation.styleId} text={excerpt}
          width={width} height={height} scrollText={false} testID={`vision-preview-note-${note.id}`} />;
      },
    })), [notes]);
}
