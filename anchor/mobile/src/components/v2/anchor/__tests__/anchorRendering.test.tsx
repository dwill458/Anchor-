import React from 'react';
import { render } from '@testing-library/react-native';

import { AnchorMark } from '../AnchorMark';
import { CircularAnchorRenderer } from '../CircularAnchorRenderer';
import { measurePathData, parseAnchorStructure } from '../anchorStructure';
import { CREATION_EXPRESSION_SPECS, anchorExpressionOf, expressionSpec, mixHex, normalizeExpression } from '../anchorExpressions';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { ANCHOR_EXPRESSIONS, CREATION_EXPRESSIONS } from '@/constants/v2/creation';
import { describeTrueSigil, generateTrueSigil } from '@/utils/sigil/traditional-generator';
import { distillIntention } from '@/utils/sigil/distillation';
import { CATEGORY_TO_TIER, PlanetaryTier } from '@/types';

const letters = distillIntention('I am present with children').finalLetters;
const FOCUSED = generateTrueSigil(letters, CATEGORY_TO_TIER.family, 'balanced').svg;
const CONTAINED = generateTrueSigil(letters, PlanetaryTier.JUPITER, 'dense').svg;

/** Every `d` the renderer drew, in order. */
function drawnPathData(tree: ReturnType<typeof render>): string[] {
  return tree.UNSAFE_root.findAll((node: { type: unknown }) => node.type === ('Path' as never)).map((node: { props: { d: string } }) => node.props.d);
}

describe('describeTrueSigil', () => {
  it('exposes the same path the SVG draws, letter by letter', () => {
    const formation = describeTrueSigil(letters, PlanetaryTier.VENUS, 'balanced');
    expect(formation.svg).toBe(generateTrueSigil(letters, PlanetaryTier.VENUS, 'balanced').svg);
    expect(formation.gridSize).toBe(7);
    expect(formation.gridCells).toHaveLength(49);
    expect(formation.vertices.map((vertex) => vertex.letter)).toEqual(letters);
    const rebuilt = formation.vertices.map((v, i) => `${i === 0 ? 'M' : 'L'} ${v.x},${v.y}`).join(' ');
    expect(formation.pathData).toBe(rebuilt);
    expect(formation.svg).toContain(`d="${formation.pathData}"`);
  });

  it('places each vertex within reach of its own letter\'s grid cell', () => {
    const formation = describeTrueSigil(letters, PlanetaryTier.MARS, 'balanced');
    for (const vertex of formation.vertices) {
      expect(Math.abs(vertex.x - vertex.cell.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(vertex.y - vertex.cell.y)).toBeLessThanOrEqual(2);
    }
  });
});

describe('parseAnchorStructure', () => {
  it('reads a generated structure into its mark stroke', () => {
    const structure = parseAnchorStructure(FOCUSED)!;
    expect(structure).not.toBeNull();
    expect(structure.viewBox).toBe('0 0 100 100');
    expect(structure.strokes).toHaveLength(1);
    expect(structure.strokes[0].role).toBe('mark');
    expect(structure.strokes[0].vertices).toHaveLength(letters.length);
    expect(structure.strokes[0].length).toBeGreaterThan(0);
  });

  it('separates the hand-drawn perimeter from the mark', () => {
    const structure = parseAnchorStructure(CONTAINED)!;
    expect(structure.strokes.map((stroke) => stroke.role)).toEqual(['perimeter', 'mark']);
  });

  it('caches by SVG string so browsing never re-parses', () => {
    expect(parseAnchorStructure(FOCUSED)).toBe(parseAnchorStructure(FOCUSED));
  });

  it('refuses SVG it does not understand instead of reinterpreting it', () => {
    expect(parseAnchorStructure('<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>')).toBeNull();
    expect(parseAnchorStructure('<svg viewBox="0 0 100 100"><path d="m 10 10 l 5 5" stroke="red"/></svg>')).toBeNull();
    expect(parseAnchorStructure('<svg viewBox="0 0 100 100"><g transform="scale(2)"><path d="M 1 1 L 2 2"/></g></svg>')).toBeNull();
    expect(parseAnchorStructure('<svg viewBox="0 0 100 100"><path d="M 1 1 L 2 2 Z" fill="#000"/></svg>')).toBeNull();
  });

  it('measures straight and curved path data', () => {
    expect(measurePathData('M 0,0 L 3,4')?.length).toBeCloseTo(5);
    expect(measurePathData('M 0 0 Q 5 0 10 0')?.vertices).toBeNull();
    expect(measurePathData('M 0 0 Q 5 0 10 0')?.length).toBeCloseTo(10, 1);
  });
});

describe('expressions', () => {
  it('offers the curated rail in order, each with a label and description', () => {
    expect(CREATION_EXPRESSION_SPECS.map((spec) => spec.id)).toEqual([...CREATION_EXPRESSIONS]);
    for (const spec of CREATION_EXPRESSION_SPECS) {
      expect(spec.label).toBeTruthy();
      expect(spec.description).toBeTruthy();
      expect(spec.layers.length).toBeGreaterThan(0);
    }
  });

  it('resolves every stored expression, including legacy spellings, to a renderable treatment', () => {
    for (const expression of ANCHOR_EXPRESSIONS) expect(expressionSpec(expression).layers.length).toBeGreaterThan(0);
    expect(normalizeExpression('cutpaper')).toBe('cut_paper');
    expect(normalizeExpression('nonsense')).toBe('original');
    expect(anchorExpressionOf({ classifierMeta: { v2Expression: 'foil' } })).toBe('foil');
    expect(anchorExpressionOf({})).toBe('original');
  });

  it('mixes colours linearly', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('AnchorMark', () => {
  it.each(ANCHOR_EXPRESSIONS)('draws the stored geometry unchanged in %s', (expression) => {
    const structure = parseAnchorStructure(CONTAINED)!;
    const stored = new Set(structure.strokes.map((stroke) => stroke.d));
    const tree = render(<AnchorMark svg={CONTAINED} category="career" expression={expression} size={240} />);
    const drawn = drawnPathData(tree);
    const spec = expressionSpec(expression);
    // Every layer redraws every stored stroke, byte for byte.
    const structural = drawn.filter((d) => stored.has(d));
    expect(structural).toHaveLength(spec.layers.length * structure.strokes.length);
    // The only other path an expression may add is the architectural construction guide.
    const extra = drawn.filter((d) => !stored.has(d));
    expect(extra).toHaveLength(spec.construction ? 1 : 0);
  });

  it('falls back to the stored SVG when the structure is not one it understands', () => {
    const legacy = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="currentColor"/></svg>';
    const tree = render(<AnchorMark svg={legacy} category="career" expression="foil" size={100} />);
    expect(tree.UNSAFE_root.findAll((node: { type: unknown }) => node.type === ('SvgXml' as never))).toHaveLength(1);
  });

  it('draws the same geometry at thumbnail size, only thicker', () => {
    const large = render(<AnchorMark svg={FOCUSED} category="career" size={240} />);
    const thumb = render(<AnchorMark svg={FOCUSED} category="career" size={40} />);
    expect(drawnPathData(thumb)).toEqual(drawnPathData(large));
    const width = (tree: ReturnType<typeof render>) => tree.UNSAFE_root.findAll((node: { type: unknown }) => node.type === ('Path' as never))[0].props.strokeWidth;
    expect(width(thumb)).toBeGreaterThan(width(large));
  });
});

describe('CircularAnchorRenderer + anchorRenderProps', () => {
  const anchor = { baseSigilSvg: FOCUSED, reinforcedSigilSvg: undefined, enhancedImageUrl: undefined, category: 'career' as const, classifierMeta: { v2Expression: 'etched' } };

  it('renders the kept expression wherever an Anchor is shown', () => {
    const tree = render(<CircularAnchorRenderer {...anchorRenderProps(anchor)} size="hero" />);
    expect(tree.UNSAFE_root.findAll((node: { type: unknown }) => node.type === ('SvgXml' as never))).toHaveLength(0);
    expect(drawnPathData(tree).length).toBe(expressionSpec('etched').layers.length);
  });

  it('keeps Anchors without a recorded expression on the stored SVG', () => {
    const props = anchorRenderProps({ ...anchor, classifierMeta: undefined });
    expect(props.expression).toBeUndefined();
    const tree = render(<CircularAnchorRenderer {...props} size="hero" />);
    expect(tree.UNSAFE_root.findAll((node: { type: unknown }) => node.type === ('SvgXml' as never))).toHaveLength(1);
  });
});
