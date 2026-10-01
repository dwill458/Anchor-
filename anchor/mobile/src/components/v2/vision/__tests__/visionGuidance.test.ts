import { visionDescriptionExample, visionDetailHint, visionDetailLevel } from '../visionGuidance';

describe('visionDetailHint', () => {
  it('is guidance, never a score', () => {
    expect(visionDetailHint('')).toBeNull();
    expect(visionDetailHint(Array(23).fill('word').join(' '))).toBe('23 words · Add a little more detail for stronger images');
    expect(visionDetailLevel(Array(30).fill('word').join(' '))).toBe('building');
    expect(visionDetailHint(Array(67).fill('word').join(' '))).toBe('67 words · Great detail');
  });
});

describe('visionDescriptionExample', () => {
  it('prefers the intention over the category', () => {
    expect(visionDescriptionExample('Anchor has ten thousand users', 'desire')).toMatch(/people using what I built/);
    expect(visionDescriptionExample('Run a marathon', 'custom')).toMatch(/run the loop/);
  });

  it('falls back to the category, then a neutral example', () => {
    expect(visionDescriptionExample('Be calm', 'spirituality')).toMatch(/quiet/);
    expect(visionDescriptionExample(undefined, 'unknown')).toMatch(/name the room, the light/);
  });

  it('reads "run for" as public life, not running', () => {
    expect(visionDescriptionExample('Run for president', 'career')).toMatch(/community hall/);
    expect(visionDescriptionExample('Run for president', 'career')).not.toMatch(/run the loop/);
  });
});
