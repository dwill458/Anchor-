import { CATEGORY_TO_TIER, type AnchorCategory } from '@/types';
import { buildDrawnGeometry, DRAWN_FIT_SIZE, type DrawnPoint } from '@/utils/sigil/drawnGeometry';
import { generateTrueSigil, getSigilGeometry } from '@/utils/sigil/traditional-generator';
import { distillIntention } from '@/utils/sigil/distillation';
import type { CreationMode } from './creationFlowConfig';
import {
  buildDrawnHero,
  buildIntentLayout,
  buildMapLayout,
  fitHero,
  type DrawnHero,
  type MeasureText,
} from './geometry';
import type { HeroShape, SceneContext } from './scenes/sceneTypes';
import { buildCreationTimeline } from './useCreationTimeline';

export interface SceneContextInput {
  intentionText: string;
  category: AnchorCategory;
  source: 'typed' | 'drawn';
  entry: 'glide' | 'fade';
  mode: CreationMode;
  reduceMotion: boolean;
  measure: MeasureText;
  /** Where the field's glyphs start, in design px. */
  field?: { x: number; y: number; width: number; lineHeight: number };
  /** The finished drawing (draw path, after Done). */
  drawnStrokes?: DrawnPoint[][];
}

export interface BuiltFlow {
  context: SceneContext;
  /** The structure sent for styling and saved with the anchor. */
  baseSigilSvg: string;
  distilledLetters: string[];
}

const EMPTY_HERO: HeroShape = { strokes: [], vertices: [] };

/**
 * Everything the scenes need, derived from the real pipeline: `distillIntention` for the letters,
 * `getSigilGeometry` for the tier grid and points (or `buildDrawnGeometry` for a drawing). The
 * SVG returned is the one that is sent for styling.
 */
export function buildSceneContext(input: SceneContextInput): BuiltFlow {
  const isDrawn = input.source === 'drawn';
  const distillation = distillIntention(input.intentionText);
  const finalLetters = distillation.finalLetters;
  const tier = CATEGORY_TO_TIER[input.category] ?? CATEGORY_TO_TIER.custom;

  const layout = buildIntentLayout({
    text: input.intentionText,
    finalLetters,
    measure: input.measure,
    field: input.field,
  });
  const timeline = buildCreationTimeline({ mode: input.mode, n: finalLetters.length, drawn: isDrawn });

  if (isDrawn) {
    const strokes = input.drawnStrokes ?? [];
    const geometry = buildDrawnGeometry(strokes);
    let hero: HeroShape = EMPTY_HERO;
    let drawn: DrawnHero | null = null;
    if (geometry.strokeCount > 0) {
      drawn = buildDrawnHero(geometry, strokes, DRAWN_FIT_SIZE);
      hero = { strokes: drawn.strokes, vertices: drawn.vertices };
    }

    return {
      context: {
        layout,
        map: null,
        hero,
        drawn,
        timeline,
        letterCount: finalLetters.length,
        isDrawn: true,
        reduceMotion: input.reduceMotion,
        entry: input.entry,
      },
      baseSigilSvg: geometry.baseSigilSvg,
      distilledLetters: finalLetters,
    };
  }

  const geometry = getSigilGeometry(finalLetters, tier, 'balanced');
  const map = buildMapLayout(geometry, finalLetters);
  const fit = fitHero(map.points.map((pt) => ({ x: pt.x, y: pt.y })));

  return {
    context: {
      layout,
      map,
      hero: { strokes: [fit.points], vertices: fit.points },
      drawn: null,
      timeline,
      letterCount: finalLetters.length,
      isDrawn: false,
      reduceMotion: input.reduceMotion,
      entry: input.entry,
    },
    baseSigilSvg: generateTrueSigil(finalLetters, tier, 'balanced').svg,
    distilledLetters: finalLetters,
  };
}
