import { visionCueGuidance, visionDescriptionExample, visionDetailHint, visionDetailLevel } from '../visionGuidance';

describe('visionDetailHint', () => {
  it('is guidance, never a score', () => {
    expect(visionDetailHint('')).toBeNull();
    expect(visionDetailHint(Array(23).fill('word').join(' '))).toBe('23 words · Add a little more detail for stronger images');
    expect(visionDetailLevel(Array(30).fill('word').join(' '))).toBe('building');
    expect(visionDetailHint(Array(67).fill('word').join(' '))).toBe('67 words · Great detail');
  });
});

describe('visionDescriptionExample', () => {
  it('is written around the person’s own intention', () => {
    const example = visionDescriptionExample('I am the owner of dope ass regal', 'desire');
    expect(example).toContain('I am the owner of dope ass regal');
    expect(example).toMatch(/place I built/);
    expect(example).not.toMatch(/Tuesday|coffee/);
  });

  it('reads the intention before the category', () => {
    expect(visionDescriptionExample('Anchor has ten thousand users', 'desire')).toMatch(/people who use what I built/);
    expect(visionDescriptionExample('Run a marathon', 'custom')).toMatch(/moving without holding back/);
  });

  it('falls back to the category, then a neutral seed, still quoting the intention', () => {
    expect(visionDescriptionExample('Be calm', 'spirituality')).toMatch(/Be calm.*quiet/);
    expect(visionDescriptionExample(undefined, 'unknown')).toMatch(/somewhere specific/);
  });

  it('reads "run for" as public life, not running', () => {
    expect(visionDescriptionExample('Run for president', 'career')).toMatch(/packed room/);
    expect(visionDescriptionExample('Run for president', 'career')).not.toMatch(/moving without/);
  });
});

describe('visionCueGuidance', () => {
  it('asks a question about this Anchor, for every chip', () => {
    for (const key of ['where', 'doing', 'feel'] as const) {
      const cue = visionCueGuidance(key, 'I am the owner of dope ass regal', 'desire');
      expect(cue.question.endsWith('?')).toBe(true);
      expect(cue.hint.length).toBeGreaterThan(0);
    }
    expect(visionCueGuidance('where', 'I am the owner of dope ass regal', 'desire').question).toMatch(/dope ass regal/);
  });

  it('shortens a long intention and copes with none', () => {
    const long = visionCueGuidance('where', 'I run a company that employs two hundred people across five countries and nobody is stressed', 'career');
    expect(long.question).toMatch(/…”/);
    expect(visionCueGuidance('feel', undefined, undefined).question).toMatch(/\?$/);
  });
});
