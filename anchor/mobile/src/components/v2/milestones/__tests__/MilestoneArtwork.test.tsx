import React from 'react';
import { render } from '@testing-library/react-native';
import { Circle, Path } from 'react-native-svg';
import { MilestoneArtwork } from '../MilestoneArtwork';
import { ART_SIZE, motifPrimitives } from '@/milestones/artGeometry';
import { MILESTONE_SPECS, type MilestoneMotif } from '@/milestones/registry';
import { APPROVED_MILESTONE_ASSETS, type SvgNode } from '@/milestones/approvedAssets';
import { namespaceSvgAttrs } from '@/milestones/approvedAssetsRenderer';

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

  it('renders the approved embossed locked geometry and suppresses the gold highlight', () => {
    const { UNSAFE_getAllByType } = render(<MilestoneArtwork definitionId="commitment.practices.1" state="locked" size={64} />);
    const shapes = [...UNSAFE_getAllByType(Circle), ...UNSAFE_getAllByType(Path)].filter(shape => !shape.props.testID?.startsWith('emblem-'));
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes.some(shape => shape.props.fill?.includes('url(#'))).toBe(true);
    const walk = (node: SvgNode): SvgNode[] => [node, ...node.children.flatMap(walk)];
    const nodes = walk(APPROVED_MILESTONE_ASSETS['commitment.practices.1'].locked);
    expect(nodes.find(node => node.attrs.id?.endsWith('__highlight'))?.children).toEqual([]);
  });

  it('preserves the approved palette instead of recolouring geometry at runtime', () => {
    const { UNSAFE_getAllByType } = render(
      <MilestoneArtwork definitionId="strength.building" state="earned" size={64} categoryColor="#CE6091" />,
    );
    const strokes = [...UNSAFE_getAllByType(Path), ...UNSAFE_getAllByType(Circle)].map((p) => p.props.stroke);
    expect(strokes).toContain('#13222C');
    expect(strokes).not.toContain('#CE6091');
  });

  it('shows a clearly marked fallback for a milestone this version does not know', () => {
    const { getByTestId } = render(<MilestoneArtwork definitionId="future.unknown" state="earned" size={64} />);
    expect(getByTestId('milestone-artwork-fallback')).toBeTruthy();
  });
});

describe('approved vector package', () => {
  const walk = (node: SvgNode): SvgNode[] => [node, ...node.children.flatMap(walk)];

  it('maps all 20 registry IDs to both intact SVG variants with complete internal references', () => {
    expect(Object.keys(APPROVED_MILESTONE_ASSETS).sort()).toEqual(MILESTONE_SPECS.map(s => s.id).sort());
    for (const asset of Object.values(APPROVED_MILESTONE_ASSETS)) {
      for (const state of ['earned', 'locked'] as const) {
        expect(asset[state].attrs.viewBox).toBe('0 0 256 256');
        expect(asset.sourceSha256[state]).toMatch(/^[a-f0-9]{64}$/);
        const nodes = walk(asset[state]);
        const ids = nodes.flatMap(node => node.attrs.id ? [node.attrs.id] : []);
        expect(new Set(ids).size).toBe(ids.length);
        for (const node of nodes) {
          expect(['image', 'text', 'filter', 'script', 'style']).not.toContain(node.tag);
          for (const value of Object.values(node.attrs)) {
            for (const reference of value.matchAll(/url\(#([^)]*)\)/g)) expect(ids).toContain(reference[1]);
          }
        }
        for (const layer of asset.manifest.layers) expect(ids).toContain(layer.id);
      }
    }
  });

  it('namespaces instance IDs and references without changing other attributes', () => {
    expect(namespaceSvgAttrs({ id: 'orb', fill: 'url(#gradient)', d: 'M1 2L3 4' }, 'a')).toEqual({
      id: 'a-orb', fill: 'url(#a-gradient)', d: 'M1 2L3 4',
    });
  });
});
