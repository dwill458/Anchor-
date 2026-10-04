import React from 'react';
import { render } from '@testing-library/react-native';
import { useSharedValue } from 'react-native-reanimated';

import { CircularAnchorRenderer, type CircularAnchorEntrance } from '../CircularAnchorRenderer';
import { generateTrueSigil } from '@/utils/sigil/traditional-generator';
import { distillIntention } from '@/utils/sigil/distillation';
import { CATEGORY_TO_TIER } from '@/types';

const SVG = generateTrueSigil(distillIntention('I am present with children').finalLetters, CATEGORY_TO_TIER.family, 'balanced').svg;

function Harness({ drawing, imageUrl, expression }: { drawing: boolean; imageUrl?: string; expression?: 'foil' }) {
  const ground = useSharedValue(0);
  const draw = useSharedValue(0);
  const entrance: CircularAnchorEntrance = { ground, draw, drawing };
  return <CircularAnchorRenderer svg={SVG} imageUrl={imageUrl} category="career" expression={expression} size={200} appearance="paper" entrance={entrance} />;
}

describe('CircularAnchorRenderer entrance', () => {
  it('traces a vector mark with a recorded expression while the line is drawing', () => {
    const tree = render(<Harness drawing expression="foil" />);
    // The traced path carries an animated dash; a static path does not.
    const traced = tree.UNSAFE_root.findAll((node: { props: { strokeDasharray?: unknown } }) => Array.isArray(node.props?.strokeDasharray));
    expect(traced.length).toBeGreaterThan(0);
  });

  it('draws the mark statically once the line has landed, keeping the same layers', () => {
    const tree = render(<Harness drawing={false} expression="foil" />);
    const traced = tree.UNSAFE_root.findAll((node: { props: { strokeDasharray?: unknown } }) => Array.isArray(node.props?.strokeDasharray));
    expect(traced).toHaveLength(0);
  });

  it('never draws a finished image or an expression-less mark; it only settles them in', () => {
    const withImage = render(<Harness drawing imageUrl="https://example.test/coin.png" expression="foil" />);
    expect(withImage.UNSAFE_root.findAll((node: { props: { strokeDasharray?: unknown } }) => Array.isArray(node.props?.strokeDasharray))).toHaveLength(0);
    const legacy = render(<Harness drawing />);
    expect(legacy.UNSAFE_root.findAll((node: { props: { strokeDasharray?: unknown } }) => Array.isArray(node.props?.strokeDasharray))).toHaveLength(0);
  });
});
