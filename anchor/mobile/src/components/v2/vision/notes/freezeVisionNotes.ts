import type { VisionNote } from '@/adapters/v2/vision';

/** A running Visualize board keeps the exact note content and geometry it began with. */
export function freezeVisionNotes(notes: readonly VisionNote[] = []): VisionNote[] {
  return notes.map(note => ({ ...note, content: { ...note.content }, presentation: { ...note.presentation } }));
}
