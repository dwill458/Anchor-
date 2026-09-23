import type { AIStyle, AnchorCategory } from '@/types';
import { getRecommendedStyles } from '@/screens/create/constants/refineStyles';
import type { AnchorExpression } from '@/constants/v2/creation';

export type CreationExpressionOption = {
  expression: AnchorExpression;
  styleChoice?: AIStyle;
  name: string;
  descriptor: string;
  material: string;
  composition: string;
  icon: 'architectural' | 'etched' | 'ink' | 'foil' | 'monoline' | 'embossed';
};

/**
 * The creation rail uses the established production style library, but presents a small,
 * legible set of creative directions. The generated artwork is still produced by the existing
 * server pipeline; these values only select its named prompt/style.
 */
export const CREATION_EXPRESSION_OPTIONS: readonly CreationExpressionOption[] = [
  { expression: 'architectural', styleChoice: 'architectural_trace', name: 'Architectural Trace', descriptor: 'Measured geometry and quiet precision.', material: 'drafting ink', composition: 'centred stillpoint', icon: 'architectural' },
  { expression: 'etched', styleChoice: 'lunar_etch', name: 'Lunar Etch', descriptor: 'Moonlit silver engraving and depth.', material: 'fine engraving', composition: 'offset field', icon: 'etched' },
  { expression: 'ink', styleChoice: 'ink_brush', name: 'Ink Brush', descriptor: 'Gesture, grain, and open space.', material: 'sumi-e ink', composition: 'open void', icon: 'ink' },
  { expression: 'foil', styleChoice: 'gold_leaf', name: 'Gold Leaf', descriptor: 'Antique warmth with a precious surface.', material: 'gilded leaf', composition: 'centred stillpoint', icon: 'foil' },
  { expression: 'monoline', styleChoice: 'minimal_line', name: 'Minimal Line', descriptor: 'Clean linework and spacious restraint.', material: 'platinum line', composition: 'open void', icon: 'monoline' },
  { expression: 'embossed', styleChoice: 'monolith_ink', name: 'Monolith Ink', descriptor: 'Carved weight and grounded presence.', material: 'stone ink', composition: 'lower-anchored', icon: 'embossed' },
];

export function expressionOption(expression: AnchorExpression): CreationExpressionOption | undefined {
  return CREATION_EXPRESSION_OPTIONS.find((option) => option.expression === expression);
}

export function recommendedCreationExpressions(category?: AnchorCategory, intention = ''): CreationExpressionOption[] {
  const recommended = getRecommendedStyles(category, intention, 4).map((style) => style.generationStyle);
  const ranked = [...CREATION_EXPRESSION_OPTIONS].sort((a, b) => {
    const aIndex = a.styleChoice ? recommended.indexOf(a.styleChoice) : -1;
    const bIndex = b.styleChoice ? recommended.indexOf(b.styleChoice) : -1;
    return (aIndex < 0 ? 100 : aIndex) - (bIndex < 0 ? 100 : bIndex);
  });
  return ranked;
}
