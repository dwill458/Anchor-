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
    id: 'minimal_line',
    title: 'Minimal Line',
    category: 'GEOMETRIC',
    iconName: 'Target',
    shortDescription: 'Crisp clarity and restraint.',
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
    id: 'obsidian_mono',
    title: 'Obsidian Mono',
    category: 'MODERN',
    iconName: 'Sliders',
    shortDescription: 'High-contrast monochrome depth.',
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
    id: 'echo_chamber',
    title: 'Echo Chamber',
    category: 'MYSTIC',
    iconName: 'Repeat',
    shortDescription: 'Layered cyclical resonance.',
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
