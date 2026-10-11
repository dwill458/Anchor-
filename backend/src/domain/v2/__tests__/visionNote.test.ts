import {
  VISION_NOTE_MAX_ACTIVE,
  VISION_NOTE_STYLE_IDS,
  CreateVisionNoteSchema,
  UpdateVisionNoteSchema,
} from '../vision';

const presentation = {
  styleId: 'sticky_blush_pink', x: 0.5, y: 0.5, width: 0.32, height: 0.28,
  rotation: 0, scale: 1, layerOrder: 0,
};

describe('Vision note contract', () => {
  it('exposes the 26 stable material ids and a separate active-note cap', () => {
    expect(VISION_NOTE_STYLE_IDS).toHaveLength(26);
    expect(new Set(VISION_NOTE_STYLE_IDS).size).toBe(26);
    expect(VISION_NOTE_STYLE_IDS).toContain('editorial_classic_cream');
    expect(VISION_NOTE_STYLE_IDS).toContain('editorial_midnight_editorial');
    expect(VISION_NOTE_MAX_ACTIVE).toBe(24);
  });

  it('accepts 200 Unicode code points without splitting astral characters', () => {
    const text = '🙂'.repeat(200);
    expect(CreateVisionNoteSchema.parse({ clientRequestId: '5df38ac6-8fd2-4fa7-b0c4-7ac440d2bf73', content: { text }, presentation }).content.text).toBe(text);
    expect(CreateVisionNoteSchema.safeParse({ clientRequestId: '5df38ac6-8fd2-4fa7-b0c4-7ac440d2bf73', content: { text: `${text}x` }, presentation }).success).toBe(false);
  });

  it('rejects blank text, unknown styles, and geometry outside the safe board bounds', () => {
    const clientRequestId = '5df38ac6-8fd2-4fa7-b0c4-7ac440d2bf73';
    expect(CreateVisionNoteSchema.safeParse({ clientRequestId, content: { text: ' \n ' }, presentation }).success).toBe(false);
    expect(CreateVisionNoteSchema.safeParse({ clientRequestId, content: { text: 'A note' }, presentation: { ...presentation, styleId: 'unknown' } }).success).toBe(false);
    expect(CreateVisionNoteSchema.safeParse({ clientRequestId, content: { text: 'A note' }, presentation: { ...presentation, width: 0.8 } }).success).toBe(false);
    expect(CreateVisionNoteSchema.safeParse({ clientRequestId, content: { text: 'A note' }, presentation: { ...presentation, x: 0.01 } }).success).toBe(false);
  });

  it('allows partial content and presentation updates only', () => {
    expect(UpdateVisionNoteSchema.parse({ content: { text: 'Updated copy' } })).toEqual({ content: { text: 'Updated copy' } });
    expect(UpdateVisionNoteSchema.parse({ presentation: { ...presentation, x: 0.6 } })).toEqual({ presentation: { ...presentation, x: 0.6 } });
    expect(UpdateVisionNoteSchema.safeParse({ unrelated: true }).success).toBe(false);
  });
});
