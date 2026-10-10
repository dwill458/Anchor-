import type { VisionNoteStyleId } from '@/adapters/v2/vision';
import type { NoteAssetKey } from '@/assets/vision/notes/noteAssets';

export type VisionNoteFamily = 'sticky' | 'paper' | 'editorial';
export type VisionNoteAssetKey = NoteAssetKey;

export interface VisionNotePreset {
  id: VisionNoteStyleId;
  label: string;
  family: VisionNoteFamily;
  surfaceColor: string;
  inkColor: string;
  borderColor?: string;
  fontFamily: 'Allison-Regular' | 'EBGaramond-Regular' | 'EBGaramond-Italic' | 'Inter-Regular' | 'Inter-SemiBold';
  fontSize: number;
  lineHeight: number;
  rotation: number;
  surfaceAsset?: VisionNoteAssetKey;
  /** Fraction reserved for artwork so text stays on its quiet field. */
  textInsetBottom?: number;
  ruled?: boolean;
  shadow: 'soft' | 'none';
}

/** The exact 20 material choices; one native renderer owns their geometry and behavior. */
export const VISION_NOTE_PRESETS: readonly VisionNotePreset[] = [
  { id: 'sticky_blush_pink', label: 'Blush Pink', family: 'sticky', surfaceColor: '#F2C8C9', inkColor: '#4B3030', fontFamily: 'Allison-Regular', fontSize: 29, lineHeight: 35, rotation: -2, shadow: 'soft' },
  { id: 'sticky_butter_yellow', label: 'Butter Yellow', family: 'sticky', surfaceColor: '#F4DF98', inkColor: '#423817', fontFamily: 'Allison-Regular', fontSize: 29, lineHeight: 35, rotation: 2, shadow: 'soft' },
  { id: 'sticky_sky_blue', label: 'Sky Blue', family: 'sticky', surfaceColor: '#C9E4E9', inkColor: '#243C43', fontFamily: 'Allison-Regular', fontSize: 29, lineHeight: 35, rotation: -1, shadow: 'soft' },
  { id: 'sticky_sage_green', label: 'Sage Green', family: 'sticky', surfaceColor: '#D1DECA', inkColor: '#2D3B2B', fontFamily: 'Allison-Regular', fontSize: 29, lineHeight: 35, rotation: 1.5, shadow: 'soft' },
  { id: 'sticky_lavender', label: 'Lavender', family: 'sticky', surfaceColor: '#DDD4E9', inkColor: '#3A3045', fontFamily: 'Allison-Regular', fontSize: 29, lineHeight: 35, rotation: -2.5, shadow: 'soft' },
  { id: 'sticky_peach', label: 'Peach', family: 'sticky', surfaceColor: '#F1D0B8', inkColor: '#50382C', fontFamily: 'Allison-Regular', fontSize: 29, lineHeight: 35, rotation: 1, shadow: 'soft' },
  { id: 'sticky_warm_ivory', label: 'Warm Ivory', family: 'sticky', surfaceColor: '#F4EBD5', inkColor: '#3C372D', fontFamily: 'Allison-Regular', fontSize: 29, lineHeight: 35, rotation: -1.5, shadow: 'soft' },
  { id: 'sticky_rose_lined', label: 'Rose Lined', family: 'sticky', surfaceColor: '#F5C9CB', inkColor: '#493235', fontFamily: 'Allison-Regular', fontSize: 28, lineHeight: 34, rotation: 0, ruled: true, shadow: 'soft' },
  { id: 'paper_ivory_torn', label: 'Ivory Torn', family: 'paper', surfaceColor: '#F5F0E3', inkColor: '#34332E', fontFamily: 'Allison-Regular', fontSize: 27, lineHeight: 34, rotation: -1, surfaceAsset: 'tornPaper', shadow: 'soft' },
  { id: 'paper_aged_parchment', label: 'Aged Parchment', family: 'paper', surfaceColor: '#D6C5A5', inkColor: '#40372B', fontFamily: 'Allison-Regular', fontSize: 27, lineHeight: 34, rotation: 1, surfaceAsset: 'handmadePaper', shadow: 'soft' },
  { id: 'paper_handmade_cream', label: 'Handmade Cream', family: 'paper', surfaceColor: '#EEE5D3', inkColor: '#34332E', fontFamily: 'Allison-Regular', fontSize: 27, lineHeight: 34, rotation: -0.5, surfaceAsset: 'handmadePaper', shadow: 'soft' },
  { id: 'paper_blush_torn', label: 'Blush Torn', family: 'paper', surfaceColor: '#E9D4D0', inkColor: '#493834', fontFamily: 'Allison-Regular', fontSize: 27, lineHeight: 34, rotation: 1.5, surfaceAsset: 'tornPaper', shadow: 'soft' },
  { id: 'paper_sage_handmade', label: 'Sage Handmade', family: 'paper', surfaceColor: '#D1D8C8', inkColor: '#303B2E', fontFamily: 'Allison-Regular', fontSize: 27, lineHeight: 34, rotation: -1.5, surfaceAsset: 'handmadePaper', shadow: 'soft' },
  { id: 'paper_white_deckled', label: 'White Deckled', family: 'paper', surfaceColor: '#F7F5EF', inkColor: '#34332E', fontFamily: 'Allison-Regular', fontSize: 27, lineHeight: 34, rotation: 0.5, surfaceAsset: 'tornPaper', shadow: 'soft' },
  { id: 'editorial_classic_cream', label: 'Classic Cream', family: 'editorial', surfaceColor: '#F4F1E9', inkColor: '#24251F', fontFamily: 'EBGaramond-Regular', fontSize: 21, lineHeight: 29, rotation: 0, shadow: 'none' },
  { id: 'editorial_powder_blue', label: 'Powder Blue', family: 'editorial', surfaceColor: '#DFE7E7', inkColor: '#243B43', fontFamily: 'EBGaramond-Regular', fontSize: 21, lineHeight: 29, rotation: 0, borderColor: '#9BAEB1', shadow: 'none' },
  { id: 'editorial_minimal_quote', label: 'Minimal Quote', family: 'editorial', surfaceColor: '#F3E7CA', inkColor: '#3C3427', fontFamily: 'Inter-SemiBold', fontSize: 16, lineHeight: 23, rotation: 0, borderColor: '#C8B27D', shadow: 'none' },
  { id: 'editorial_botanical_shadow', label: 'Botanical Shadow', family: 'editorial', surfaceColor: '#F7EEE0', inkColor: '#29382A', fontFamily: 'EBGaramond-Italic', fontSize: 22, lineHeight: 29, rotation: 0, surfaceAsset: 'botanicalShadow', shadow: 'none' },
  { id: 'editorial_coastal_illustration', label: 'Coastal Illustration', family: 'editorial', surfaceColor: '#FCF4E6', inkColor: '#24383C', fontFamily: 'EBGaramond-Italic', fontSize: 22, lineHeight: 29, rotation: 0, surfaceAsset: 'coastalIllustration', textInsetBottom: 0.3, shadow: 'none' },
  { id: 'editorial_atmospheric_landscape', label: 'Atmospheric Landscape', family: 'editorial', surfaceColor: '#F9ECD9', inkColor: '#3D3730', fontFamily: 'EBGaramond-Regular', fontSize: 22, lineHeight: 29, rotation: 0, surfaceAsset: 'atmosphericLandscape', textInsetBottom: 0.3, shadow: 'none' },
];

export const VISION_NOTE_STYLE_IDS: readonly VisionNoteStyleId[] = VISION_NOTE_PRESETS.map(style => style.id);
export const VISION_NOTE_FAMILIES: readonly VisionNoteFamily[] = ['sticky', 'paper', 'editorial'];
/** User-visible limit counts Unicode code points, so emoji are never split. */
export const VISION_NOTE_MAX_CHARS = 200;
export const VISION_NOTE_STYLE_TRANSITION_MS = 240;

export function getVisionNotePreset(styleId: VisionNoteStyleId): VisionNotePreset {
  return VISION_NOTE_PRESETS.find(style => style.id === styleId)!;
}

export function resolveVisionNoteTextStyle(text: string, preset: Pick<VisionNotePreset, 'fontSize' | 'lineHeight'>, size: { width: number; height: number }) {
  const width = Math.max(24, size.width - 28);
  const baseFontSize = preset.fontSize;
  const charsPerLine = Math.max(1, Math.floor(width / (baseFontSize * 0.56)));
  const visualLines = text.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(Array.from(line).length / charsPerLine)), 0);
  const availableLines = Math.max(1, Math.floor(Math.max(12, size.height - 24) / preset.lineHeight));
  const scale = Math.min(1, Math.sqrt(availableLines / Math.max(1, visualLines)));
  const fontSize = Math.max(12, Math.floor(baseFontSize * scale));
  return { fontSize, lineHeight: Math.max(16, Math.ceil(fontSize * (preset.lineHeight / baseFontSize))) };
}
