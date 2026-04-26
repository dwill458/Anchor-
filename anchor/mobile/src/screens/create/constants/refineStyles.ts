import type { AIStyle } from '@/types';

export type RefineStyleCategory =
  | 'GEOMETRIC'
  | 'ORGANIC'
  | 'MYSTIC'
  | 'MODERN'
  | 'LUMINOUS';

export type RefineStyleIconName =
  | 'Target'
  | 'Zap'
  | 'Compass'
  | 'Waves'
  | 'Crown'
  | 'Sparkles'
  | 'Sliders'
  | 'Cloud'
  | 'Flame'
  | 'Repeat'
  | 'ShieldCheck'
  | 'Palette';

export interface RefineStyleOption {
  id: AIStyle;
  title: string;
  category: RefineStyleCategory;
  iconName: RefineStyleIconName;
  shortDescription?: string;
  recommendedForFirstAnchor?: boolean;
}

export const FREE_VISIBLE_STYLE_COUNT = 4;

export const REFINE_STYLES: RefineStyleOption[] = [
  {
    id: 'architectural_trace',
    title: 'Architectural Trace',
    category: 'GEOMETRIC',
    iconName: 'Sliders',
    shortDescription: 'Drafted precision and measured balance.',
    recommendedForFirstAnchor: true,
  },
  {
    id: 'ink_brush',
    title: 'Ink Brush',
    category: 'ORGANIC',
    iconName: 'Zap',
    shortDescription: 'Fluid, expressive movement.',
  },
  {
    id: 'sacred_geometry',
    title: 'Sacred Geometry',
    category: 'MYSTIC',
    iconName: 'Compass',
    shortDescription: 'Structured symbolic precision.',
    recommendedForFirstAnchor: true,
  },
  {
    id: 'watercolor',
    title: 'Watercolor',
    category: 'ORGANIC',
    iconName: 'Waves',
    shortDescription: 'Soft tonal atmosphere.',
  },
  {
    id: 'gold_leaf',
    title: 'Gold Leaf',
    category: 'LUMINOUS',
    iconName: 'Crown',
    shortDescription: 'Luxurious luminous finish.',
  },
  {
    id: 'cosmic',
    title: 'Cosmic',
    category: 'MYSTIC',
    iconName: 'Sparkles',
    shortDescription: 'Orbital celestial energy.',
  },
  {
    id: 'lunar_etch',
    title: 'Lunar Etch',
    category: 'LUMINOUS',
    iconName: 'Crown',
    shortDescription: 'Silver etching under moonlit contrast.',
  },
  {
    id: 'aurora_glow',
    title: 'Aurora Glow',
    category: 'LUMINOUS',
    iconName: 'Cloud',
    shortDescription: 'Atmospheric color bloom.',
  },
  {
    id: 'ember_trace',
    title: 'Ember Trace',
    category: 'LUMINOUS',
    iconName: 'Flame',
    shortDescription: 'Warm ember edge lighting.',
  },
  {
    id: 'resonance_rings',
    title: 'Resonance Rings',
    category: 'MYSTIC',
    iconName: 'Repeat',
    shortDescription: 'Pulses radiating through layered rings.',
  },
  {
    id: 'monolith_ink',
    title: 'Monolith Ink',
    category: 'MODERN',
    iconName: 'ShieldCheck',
    shortDescription: 'Grounded heavy-line authority.',
  },
  {
    id: 'celestial_grid',
    title: 'Celestial Grid',
    category: 'GEOMETRIC',
    iconName: 'Palette',
    shortDescription: 'Constellation-inspired symmetry.',
  },
];
