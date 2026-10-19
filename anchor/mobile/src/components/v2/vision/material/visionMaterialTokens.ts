import type { ViewStyle } from 'react-native';

/**
 * Archival paper material tokens for the Vision scrapbook.
 *
 * Light falls from the top-left, so every shadow offsets right and down. Shadows
 * are plain React Native style objects: `shadow*` on iOS and `elevation` on Android.
 */

export const VISION_PAPER = {
  /** Archival paper base; sits between the cream canvas and the warm mount. */
  base: '#F4F1EA',
  /** Short warm-tan fibre flecks, drawn very faintly across the paper. */
  fibre: '#B39A6E',
  /** Grain specks. */
  grain: '#B9AB92',
  /** Faint warm foxing used for aged edges. */
  foxing: '#D8C7A6',
  /** Low-contrast warm mottling: soft, slightly deeper cream blotches across the sheet. */
  mottle: '#E2D2B2',
  /** Warm colour the sheet darkens toward at its edges (a light vignette, never a border). */
  edge: '#EFE6D4',
} as const;

export const VISION_PAPER_TEXTURE = {
  /** Number of grain specks per texture. */
  grainCount: 900,
  /** Number of short fibre flecks per texture. Each is nearly straight and independent of the others. */
  fibreCount: 260,
  /** Longest fibre fleck, in texture units (the unit square is 1000 wide): 60 is 6% of the sheet's width. */
  fibreMaxLength: 60,
  /** Number of soft mottle blotches per texture. */
  mottleCount: 36,
  /** Blotch radius range, in texture units. Blotches are filled and never stroked, so they never read as strands. */
  mottleMinRadius: 30,
  mottleMaxRadius: 110,
  grainOpacity: 0.4,
  grainStrokeWidth: 1.3,
  fibreOpacity: 0.07,
  fibreStrokeWidth: 1,
  mottleOpacity: 0.05,
  /** Opacity of the warm vignette at the very edge of the sheet. Zero at the centre. */
  vignetteOpacity: 0.5,
} as const;

/**
 * Shadow recipes. Contact is a tight shadow close to the paper; ambient is a
 * softer, wider spread that lifts the print off the board.
 */
export const VISION_SHADOW_LIGHT = {
  shadowColor: '#2A1E10',
} as const;

export const VISION_SHADOW = {
  contact: {
    ...VISION_SHADOW_LIGHT,
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.26,
    shadowRadius: 3,
    elevation: 2,
  },
  ambient: {
    ...VISION_SHADOW_LIGHT,
    shadowOffset: { width: 2, height: 9 },
    shadowOpacity: 0.14,
    shadowRadius: 15,
    elevation: 5,
  },
} as const satisfies Record<'contact' | 'ambient', ViewStyle>;

export type VisionTapeTone = 'cream' | 'kraft' | 'gold';

/** Translucent warm tape: the paper shows through, so the tape never reads as opaque plastic. */
export const VISION_TAPE = {
  height: 18,
  /** Maximum tilt for a tape strip, in degrees. */
  maxRotationDeg: 12,
  tones: {
    cream: { color: '#F3E7CB', opacity: 0.7 },
    kraft: { color: '#D9B98A', opacity: 0.6 },
    gold: { color: '#E2C98E', opacity: 0.6 },
  },
} as const satisfies {
  height: number;
  maxRotationDeg: number;
  tones: Record<VisionTapeTone, { color: string; opacity: number }>;
};

/** The printed mount around a photograph, the white border of a polaroid-like print. */
export const VISION_PHOTO = {
  mount: '#FBF9F4',
  /** Hairline on the mount so a pale print still reads against pale paper. */
  mountEdge: 'rgba(42, 30, 16, 0.08)',
  /** Inside the mount, the image window sits under a warm shadow line. */
  apertureShadow: 'rgba(42, 30, 16, 0.18)',
  /** Mount padding on the top and sides, as a fraction of the print width. */
  sidePadRatio: 0.035,
  /** Extra mount below the photo, for a handwritten caption. */
  captionBandRatio: 0.15,
  /** Largest tilt a photograph may take, in degrees. */
  maxRotationDeg: 6,
  /** Placeholder aspect when no image dimensions are known yet (width / height). */
  fallbackAspect: 1,
} as const;

export const VISION_ROTATION = {
  photoMaxDeg: VISION_PHOTO.maxRotationDeg,
  tapeMaxDeg: VISION_TAPE.maxRotationDeg,
} as const;

/** Caption faces, all reused from the existing Vision type system. */
export const VISION_CAPTION_FONTS = {
  handwritten: 'Allison-Regular',
  serif: 'EBGaramond-Regular',
  serifItalic: 'EBGaramond-Italic',
  sans: 'Inter-Regular',
} as const;

export const VISION_CAPTION_COLOR = '#3A2E20';

/** Clamps a requested photograph tilt into the allowed range, so |deg| never exceeds the limit. */
export function clampPhotoRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.max(-VISION_ROTATION.photoMaxDeg, Math.min(VISION_ROTATION.photoMaxDeg, deg));
}

/** Clamps a tape tilt into the allowed range. */
export function clampTapeRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.max(-VISION_ROTATION.tapeMaxDeg, Math.min(VISION_ROTATION.tapeMaxDeg, deg));
}
