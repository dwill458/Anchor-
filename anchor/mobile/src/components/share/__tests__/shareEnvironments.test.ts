import { balancedBreak, classifyIntention, layoutIntention } from '../intentionTypography';
import { getShareEnvironment, resolveComposition, resolveShareStyleId, STYLE_SHARE_BACKGROUNDS } from '../shareEnvironments';
import { resolveEnvironmentGeometry } from '../environmentLayout';
import { getAllStyles } from '@/screens/create/flow/creationStyles';

describe('share environments', () => {
  it('has one curated environment and art direction for every Anchor 2.0 style', () => {
    for (const style of getAllStyles()) {
      expect(STYLE_SHARE_BACKGROUNDS[style.id]?.length).toBeGreaterThanOrEqual(1);
      const env = getShareEnvironment(style.id);
      expect(env.source).not.toBeNull();
      expect(env.id).toBe(style.id);
    }
  });

  it('falls back to a neutral ground, never to the Anchor, for an unknown style', () => {
    const env = getShareEnvironment('not-a-style');
    expect(env.source).toBeNull();
    expect(getShareEnvironment(null).source).toBeNull();
  });

  it('resolves new, legacy and generation-style names to one id', () => {
    expect(resolveShareStyleId(['velvet-ember'])).toBe('velvet-ember');
    expect(resolveShareStyleId(['velvet_ember_v2'])).toBe('velvet-ember');
    expect(resolveShareStyleId(['clay_v2'])).toBe('mineral-wash');
    expect(resolveShareStyleId(['watercolor'])).toBe('joybrush');
    expect(resolveShareStyleId([undefined, 'gilt_v2'])).toBe('gilt');
    expect(resolveShareStyleId([undefined, null])).toBeNull();
  });

  it('makes the Anchor clearly smaller in Editorial than in Style, on the same environment', () => {
    for (const style of getAllStyles()) {
      const env = getShareEnvironment(style.id);
      const s = resolveComposition(env, 'style').anchorScale;
      const e = resolveComposition(env, 'editorial').anchorScale;
      expect(s).toBeGreaterThanOrEqual(0.45);
      expect(s).toBeLessThanOrEqual(0.55);
      expect(e).toBeGreaterThanOrEqual(0.2);
      expect(e).toBeLessThanOrEqual(0.28);
    }
  });

  it('keeps editorial text below the Anchor and above the brand zone for short, medium and long intentions', () => {
    const intentions = [
      'I am financially free',
      'I am building a business that supports my family',
      'I am becoming a calm, present and patient parent who listens first, speaks kindly and shows up fully every single day',
    ];
    for (const style of getAllStyles()) {
      const env = getShareEnvironment(style.id);
      for (const intention of intentions) {
        for (const kind of ['style', 'editorial'] as const) {
          const geo = resolveEnvironmentGeometry(env, kind, { intention, categoryLabel: 'Family', stateLabel: 'Building' }, 1080);
          expect(geo.text.top).toBeGreaterThanOrEqual(geo.anchorCy + geo.diameter / 2);
          expect(geo.meta.top).toBeLessThanOrEqual(1920 * 0.86);
        }
      }
    }
  });
});

describe('intention typography', () => {
  it('classifies by length', () => {
    expect(classifyIntention('I am financially free')).toBe('statement');
    expect(classifyIntention('I am building a business that supports my family')).toBe('manifesto');
    expect(classifyIntention('one two three four five six seven eight nine ten eleven twelve thirteen')).toBe('longform');
  });

  it('breaks a short intention into balanced lines, not one wide line', () => {
    expect(balancedBreak('I AM FINANCIALLY FREE', 12)).toEqual(['I AM', 'FINANCIALLY', 'FREE']);
  });

  it('breaks a medium intention into a rhythmic block without altering the words', () => {
    const lines = balancedBreak('I AM BUILDING A BUSINESS THAT SUPPORTS MY FAMILY', 18);
    expect(lines).toEqual(['I AM BUILDING', 'A BUSINESS THAT', 'SUPPORTS MY FAMILY']);
  });

  it('never truncates or rewords, at any length', () => {
    for (const text of [
      'I am a great dad',
      'I am financially free',
      'I am building a business that supports my family',
      'I am becoming a calm, present and patient parent who listens first, speaks kindly and shows up fully every single day',
    ]) {
      const layout = layoutIntention(text, classifyIntention(text), 734);
      const joined = layout.lines.join(' ');
      expect(joined.toLowerCase()).toBe(text.toLowerCase());
    }
  });

  it('keeps short intentions big and long ones readable', () => {
    const short = layoutIntention('I am a great dad', 'statement', 734);
    const long = layoutIntention('I am becoming a calm, present and patient parent who listens first, speaks kindly and shows up fully every single day', 'longform', 734);
    expect(short.fontSize).toBeGreaterThanOrEqual(100);
    expect(long.fontSize).toBeGreaterThanOrEqual(48);
    expect(long.uppercase).toBe(false);
  });
});

describe('editorial quotes and brand contrast', () => {
  it('frames short and medium intentions in smart quotes, set with the words', () => {
    const short = layoutIntention('I am financially free', 'statement', 734, { quote: true });
    expect(short.lines[0].startsWith('“')).toBe(true);
    expect(short.lines[short.lines.length - 1].endsWith('”')).toBe(true);
    expect(short.lines.join(' ')).not.toContain('"');
    const already = layoutIntention('“I am free”', 'statement', 734, { quote: true });
    expect(already.lines.join(' ').match(/“/g)).toHaveLength(1);
  });

  it('does not quote longform editorial intentions', () => {
    const geo = resolveEnvironmentGeometry(
      getShareEnvironment('paper'),
      'editorial',
      { intention: 'I am becoming a calm, present and patient parent who listens first, speaks kindly and shows up fully every single day', categoryLabel: 'Family', stateLabel: null },
      1080,
    );
    expect(geo.text.layout.lines.join(' ')).not.toContain('“');
  });

  it('picks a brand mark with real contrast on every environment', () => {
    const { contrastRatio, mixHex } = require('../colorMath');
    for (const style of getAllStyles()) {
      const env = getShareEnvironment(style.id);
      const { brand } = require('../environmentLayout').environmentPalette(env);
      const mark = brand.ground === 'dark' ? '#F4EDE0' : '#14162B';
      expect(contrastRatio(mark, mixHex(env.base, brand.wash, 0.6))).toBeGreaterThan(4.5);
    }
  });
});
