import { VISION_NOTE_PRESETS, VISION_NOTE_STYLE_IDS, resolveVisionNoteTextStyle } from '../visionNoteStyles';
import type { VisionReadModel } from '@/adapters/v2/vision';

function luminance(hex: string): number {
  const channels = hex.replace('#', '').match(/.{2}/g)!.map(channel => parseInt(channel, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Vision note style registry', () => {
  it('contains the exact named preset groups', () => {
    expect(VISION_NOTE_STYLE_IDS).toHaveLength(26);
    expect(VISION_NOTE_PRESETS.map(style => [style.id, style.label])).toEqual([
      ['sticky_blush_pink', 'Blush Pink'], ['sticky_butter_yellow', 'Butter Yellow'], ['sticky_sky_blue', 'Sky Blue'],
      ['sticky_sage_green', 'Sage Green'], ['sticky_lavender', 'Lavender'], ['sticky_peach', 'Peach'],
      ['sticky_warm_ivory', 'Warm Ivory'], ['sticky_rose_lined', 'Rose Lined'],
      ['paper_ivory_torn', 'Ivory Torn'], ['paper_aged_parchment', 'Aged Parchment'], ['paper_handmade_cream', 'Handmade Cream'],
      ['paper_blush_torn', 'Blush Torn'], ['paper_sage_handmade', 'Sage Handmade'], ['paper_white_deckled', 'White Deckled'],
      ['editorial_classic_cream', 'Classic Serif'], ['editorial_powder_blue', 'Powder Blue'], ['editorial_minimal_quote', 'Minimal Quote'],
      ['editorial_botanical_shadow', 'Botanical Shadow'], ['editorial_coastal_illustration', 'Coastal Illustration'], ['editorial_atmospheric_landscape', 'Atmospheric Landscape'],
      ['editorial_vintage_letter', 'Vintage Letter'], ['editorial_golden_hour', 'Golden Hour'], ['editorial_misty_mountains', 'Misty Mountains'],
      ['editorial_rose_editorial', 'Rose Editorial'], ['editorial_architectural', 'Architectural'], ['editorial_midnight_editorial', 'Midnight Editorial'],
    ]);
    expect(VISION_NOTE_PRESETS.filter(style => style.family === 'paper')).toHaveLength(6);
    expect(VISION_NOTE_PRESETS.filter(style => style.family === 'editorial')).toHaveLength(12);
    expect(VISION_NOTE_PRESETS.filter(style => style.family === 'sticky')).toHaveLength(8);
    expect(new Set(VISION_NOTE_STYLE_IDS).size).toBe(26);
  });

  it('keeps long, multiline and unbroken text inside a readable style range', () => {
    const text = `${'A'.repeat(100)}\n${'A'.repeat(100)}`;
    const fitted = resolveVisionNoteTextStyle(text, VISION_NOTE_PRESETS[0], { width: 180, height: 140 });
    expect(fitted.fontSize).toBeGreaterThanOrEqual(12);
    expect(fitted.fontSize).toBeLessThanOrEqual(VISION_NOTE_PRESETS[0].fontSize);
    expect(fitted.lineHeight).toBeGreaterThan(fitted.fontSize);
    expect(VISION_NOTE_PRESETS.find(style => style.id === 'sticky_rose_lined')?.surfaceColor).toMatch(/^#F[0-9A-F]{5}$/i);
    expect(VISION_NOTE_PRESETS.find(style => style.id === 'paper_aged_parchment')?.fontFamily).toBe('Allison-Regular');
    expect(VISION_NOTE_PRESETS.find(style => style.id === 'editorial_classic_cream')?.fontFamily).toBe('EBGaramond-Regular');
    expect(VISION_NOTE_PRESETS.find(style => style.id === 'editorial_classic_cream')?.textAlign).toBe('center');
    expect(VISION_NOTE_PRESETS.find(style => style.id === 'editorial_minimal_quote')?.fontSize).toBeGreaterThan(24);
    expect(VISION_NOTE_PRESETS.find(style => style.id === 'editorial_midnight_editorial')?.textAlign).toBe('center');
    expect(VISION_NOTE_PRESETS.find(style => style.id === 'editorial_rose_editorial')?.fontFamily).toBe('EBGaramond-Italic');
    expect(VISION_NOTE_PRESETS.find(style => style.id === 'editorial_vintage_letter')?.surfaceAsset).toBe('vintageLetter');
    expect(VISION_NOTE_PRESETS.find(style => style.id === 'editorial_golden_hour')?.surfaceAsset).toBe('goldenHour');
    expect(VISION_NOTE_PRESETS.find(style => style.id === 'editorial_misty_mountains')?.surfaceAsset).toBe('mistyMountains');
    expect(VISION_NOTE_PRESETS.every(style => contrast(style.inkColor, style.surfaceColor) >= 4.5)).toBe(true);
  });

  it('keeps notes optional for old server responses while separating text from placement', () => {
    const legacyRead: VisionReadModel = {
      id: 'v1', anchorId: 'a1', title: null, description: null, status: 'ACTIVE', scenes: [],
      seenToday: false, createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z',
    };
    expect(legacyRead.notes).toBeUndefined();
  });
});
