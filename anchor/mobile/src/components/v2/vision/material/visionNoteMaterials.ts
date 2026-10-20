import type { VisionNoteStyleId } from '@/adapters/v2/vision';
import type { VisionMaterialId } from '@/assets/vision/materials/manifest';

/** Presentation mapping only. Persisted style IDs and existing choices remain valid. */
export const visionNoteMaterials: Partial<Record<VisionNoteStyleId, VisionMaterialId>> = {
  sticky_blush_pink: 'sticky-blush-pink',
  sticky_butter_yellow: 'sticky-butter-yellow',
  sticky_sky_blue: 'sticky-sky-blue',
  sticky_sage_green: 'sticky-sage-green',
  sticky_lavender: 'sticky-lavender',
  sticky_peach: 'sticky-peach',
  sticky_warm_ivory: 'sticky-warm-ivory',
  sticky_rose_lined: 'sticky-rose-lined',
  paper_ivory_torn: 'paper-ivory-rough',
  paper_aged_parchment: 'paper-warm-beige',
  paper_handmade_cream: 'paper-cream-fiber',
  paper_blush_torn: 'paper-torn-edge',
  paper_sage_handmade: 'paper-cream-fiber',
  paper_white_deckled: 'paper-torn-edge',
  editorial_classic_cream: 'editorial-classic-ivory',
  editorial_powder_blue: 'editorial-oyster',
  editorial_minimal_quote: 'editorial-warm-cream',
  editorial_rose_editorial: 'editorial-soft-parchment',
  editorial_architectural: 'editorial-oyster',
  editorial_midnight_editorial: 'editorial-classic-ivory',
};

/** Preserve additional saved colour choices without flattening the photographed paper grain. */
export const visionNoteMaterialTints: Partial<Record<VisionNoteStyleId, { color: string; opacity: number }>> = {
  paper_blush_torn: { color: '#D9A5A0', opacity: 0.22 },
  paper_sage_handmade: { color: '#91AA87', opacity: 0.22 },
  editorial_powder_blue: { color: '#9CBAC7', opacity: 0.2 },
  editorial_rose_editorial: { color: '#D9A5A0', opacity: 0.2 },
  editorial_midnight_editorial: { color: '#263442', opacity: 0.98 },
};
