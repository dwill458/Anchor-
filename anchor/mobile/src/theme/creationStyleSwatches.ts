/**
 * Preview swatches for the creation flow's style chips.
 *
 * There are no per-style preview images in the repo yet, so a chip shows a two-tone gradient taken
 * from the style's own `paletteLane` ("mineral blue, oxblood, moss…"). When real previews exist the
 * chip's `previewSource` prop takes over and this file is no longer used.
 */

const NAMED: Record<string, string> = {
  parchment: '#E3D6BC',
  smoked: '#6E6558',
  silver: '#C4C8CE',
  platinum: '#D6D8DC',
  cyan: '#9CCBD0',
  graphite: '#4A4D52',
  moon: '#C6CCDC',
  indigo: '#2C2F5C',
  cold: '#C7D0DD',
  pearl: '#ECE7DF',
  soft: '#CFD6E2',
  amber: '#D7A24A',
  charcoal: '#2B2D31',
  teal: '#2F7C80',
  mineral: '#5C7690',
  blue: '#5E7FA8',
  oxblood: '#6F2A2F',
  moss: '#5E6B3E',
  plum: '#5A3550',
  saffron: '#E0A93B',
  black: '#16171A',
  bone: '#EDE6D6',
  iron: '#8E3B2C',
  gold: '#C9A24A',
  antique: '#B08D3E',
  umber: '#6B4A2B',
  soot: '#262421',
  bronze: '#9C6B3A',
  midnight: '#161A33',
  violet: '#6A4C93',
  navy: '#1B2540',
  ash: '#8A8A86',
  stone: '#8C8A83',
  ember: '#D4672A',
  copper: '#B2603A',
  coal: '#1E1D1D',
  orange: '#D4672A',
  red: '#9B3A3A',
  burgundy: '#4A1A26',
  warm: '#D79A55',
  green: '#4F8068',
  aqua: '#7FC4C0',
  seafoam: '#9BD0BE',
  slate: '#5A6A7E',
  gray: '#8A8A86',
  grey: '#8A8A86',
  white: '#F1ECE2',
  ivory: '#F0E9D8',
  brass: '#B79643',
  oxidized: '#3F7F73',
  lavender: '#B7A8D6',
  opal: '#D9E4E8',
  rose: '#B77A86',
  dusty: '#B88A8E',
  celestial: '#4C6FA5',
  cobalt: '#2F4F9E',
  glass: '#2C3036',
  smoke: '#706E6C',
  pale: '#CBD6DA',
  dark: '#222428',
  star: '#EAE6D8',
  gas: '#6E5AA0',
  flare: '#E8C877',
  pinprick: '#E8C877',
  muted: '#8F8672',
  dusted: '#9C7C55',
  faint: '#B5BDC4',
  rare: '#C9A24A',
  optional: '#4F8D8A',
};

/** Deterministic fallback so an unrecognised lane still gets a stable, tasteful pair. */
function fallbackPair(lane: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < lane.length; i += 1) hash = (hash * 31 + lane.charCodeAt(i)) >>> 0;
  const a = ['#3A4A5F', '#5A4A3A', '#3F5A4E', '#5A3F52'][hash % 4];
  const b = ['#D9CFBE', '#CBD3DC', '#D8C9B0', '#C8D4C9'][(hash >> 3) % 4];
  return [a, b];
}

export interface StyleSwatch {
  /** Gradient start (top) and end (bottom). */
  from: string;
  to: string;
  /** Whether the gradient reads as dark, so a light line sits on it. */
  dark: boolean;
}

const luminance = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

export function swatchForLane(paletteLane: string): StyleSwatch {
  const found: string[] = [];
  paletteLane
    .toLowerCase()
    .split(/[\s,]+/)
    .forEach((word) => {
      const color = NAMED[word.replace(/[^a-z]/g, '')];
      if (color && !found.includes(color)) found.push(color);
    });

  const [from, to] = found.length >= 2 ? [found[0], found[1]] : found.length === 1 ? [found[0], found[0]] : fallbackPair(paletteLane);
  const dark = (luminance(from) + luminance(to)) / 2 < 0.5;
  return { from, to, dark };
}
