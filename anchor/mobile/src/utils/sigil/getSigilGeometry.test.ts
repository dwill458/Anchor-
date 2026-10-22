import { PlanetaryTier } from '@/types';
import { getGridConfig } from './gridRegistry';
import { generateTrueSigil, getSigilGeometry, letterToNumber } from './traditional-generator';

const CASES: Array<[string[], PlanetaryTier]> = [
  [['C', 'L', 'S', 'T', 'H', 'D'], PlanetaryTier.SATURN],
  [['F', 'N', 'D', 'R', 'P', 'C'], PlanetaryTier.JUPITER],
  [['B', 'L', 'D', 'M', 'V', 'Y', 'K'], PlanetaryTier.MARS],
  [['S', 'T', 'R', 'N', 'G', 'H'], PlanetaryTier.SUN],
  [['W', 'Q', 'X', 'Z', 'J'], PlanetaryTier.VENUS],
];

describe('getSigilGeometry', () => {
  it.each(CASES)('matches the generated SVG path exactly for %j on %s', (letters, tier) => {
    const geometry = getSigilGeometry(letters, tier, 'balanced');
    const { svg } = generateTrueSigil(letters, tier, 'balanced');

    const [first, ...rest] = geometry.points;
    const rebuilt = rest.reduce((d, p) => `${d} L ${p.x},${p.y}`, `M ${first.x},${first.y}`);

    expect(rebuilt).toBe(geometry.pathData);
    expect(svg).toContain(`d="${rebuilt}"`);
    expect(svg).toContain(`stroke-width="${geometry.strokeWidth}"`);
  });

  it('exposes the tier grid, not a fixed 6x6', () => {
    CASES.forEach(([letters, tier]) => {
      const geometry = getSigilGeometry(letters, tier);
      expect(geometry.gridConfig).toBe(getGridConfig(tier));
    });
    expect(getGridConfig(PlanetaryTier.SATURN).size).toBe(3);
    expect(getGridConfig(PlanetaryTier.VENUS).size).toBe(7);
  });

  it('reports the number each letter was actually mapped to, per tier', () => {
    const saturn = getSigilGeometry(['S', 'T'], PlanetaryTier.SATURN);
    // Saturn reduces by repeated digit sum — S(19) -> 1, T(20) -> 2.
    expect(saturn.letterNumbers).toEqual([
      { letter: 'S', number: letterToNumber('S', 9) },
      { letter: 'T', number: letterToNumber('T', 9) },
    ]);
    expect(saturn.letterNumbers[0].number).toBe(1);

    const sun = getSigilGeometry(['S', 'T'], PlanetaryTier.SUN);
    expect(sun.letterNumbers).toEqual([
      { letter: 'S', number: 19 },
      { letter: 'T', number: 20 },
    ]);
  });

  it('keeps the per-point cell so repeated cells can be detected', () => {
    // On Saturn, J(10)->1 and S(19)->1 land in the same cell.
    const geometry = getSigilGeometry(['J', 'S'], PlanetaryTier.SATURN);
    expect(geometry.points[0].cell).toBe(geometry.points[1].cell);
  });
});
