import React from 'react';
import { render } from '@testing-library/react-native';
import { Circle, Path } from 'react-native-svg';
import { MilestoneArtwork } from '../MilestoneArtwork';
import { ART_SIZE, motifPrimitives } from '@/milestones/artGeometry';
import { MILESTONE_SPECS, type MilestoneMotif } from '@/milestones/registry';

const MOTIFS: MilestoneMotif[] = [
  'energyRings', 'stones', 'sealedStar', 'hourglass', 'lotusStar', 'waypoint', 'ridge', 'summit', 'sunrise',
];

describe('artGeometry', () => {
  it('draws something finite and inside the canvas for every motif and tier', () => {
    for (const motif of MOTIFS) {
      for (const tier of [1, 2, 3, 4, 5]) {
        const prims = motifPrimitives(motif, tier);
        expect(prims.length).toBeGreaterThan(0);
        for (const prim of prims) {
          if (prim.kind === 'circle') {
            expect(prim.cx - prim.r).toBeGreaterThanOrEqual(0);
            expect(prim.cx + prim.r).toBeLessThanOrEqual(ART_SIZE);
            expect(prim.cy - prim.r).toBeGreaterThanOrEqual(0);
            expect(prim.cy + prim.r).toBeLessThanOrEqual(ART_SIZE);
          } else {
            expect(prim.d).not.toMatch(/NaN|undefined|Infinity/);
          }
        }
      }
    }
  });

  it('develops the energy rings with tier: one more ring per level', () => {
    const rings = (tier: number) => motifPrimitives('energyRings', tier).filter((p) => p.kind === 'path').length;
    expect([1, 2, 3, 4, 5].map(rings)).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic', () => {
    expect(motifPrimitives('lotusStar', 4)).toEqual(motifPrimitives('lotusStar', 4));
  });
});

describe('MilestoneArtwork', () => {
  it('renders every registered milestone as earned and locked', () => {
    for (const spec of MILESTONE_SPECS) {
      const earned = render(<MilestoneArtwork definitionId={spec.id} state="earned" size={64} />);
      expect(earned.getByTestId('milestone-artwork-earned')).toBeTruthy();
      expect(earned.queryByTestId('milestone-artwork-fallback')).toBeNull();
      earned.unmount();
      const locked = render(<MilestoneArtwork definitionId={spec.id} state="locked" size={64} />);
      expect(locked.getByTestId('milestone-artwork-locked')).toBeTruthy();
      locked.unmount();
    }
  });

  it('labels locked artwork as locked for assistive tech', () => {
    const { getByLabelText } = render(<MilestoneArtwork definitionId="strength.established" state="locked" size={64} />);
    expect(getByLabelText('Established artwork, locked')).toBeTruthy();
  });

  it('never fills locked artwork: it is an outline', () => {
    const { UNSAFE_getAllByType } = render(<MilestoneArtwork definitionId="commitment.practices.1" state="locked" size={64} />);
    const shapes = [...UNSAFE_getAllByType(Circle), ...UNSAFE_getAllByType(Path)].filter(shape => !shape.props.testID?.startsWith('emblem-'));
    // Skip the plate (a Rect) and gradient defs; every drawn motif shape has fill none.
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) expect(shape.props.fill).toBe('none');
  });

  it('draws earned strength artwork in the Anchor category colour', () => {
    const { UNSAFE_getAllByType } = render(
      <MilestoneArtwork definitionId="strength.building" state="earned" size={64} categoryColor="#CE6091" />,
    );
    const strokes = UNSAFE_getAllByType(Path).map((p) => p.props.stroke);
    expect(strokes).toContain('#CE6091');
  });

  it('shows a clearly marked fallback for a milestone this version does not know', () => {
    const { getByTestId } = render(<MilestoneArtwork definitionId="future.unknown" state="earned" size={64} />);
    expect(getByTestId('milestone-artwork-fallback')).toBeTruthy();
  });
});
