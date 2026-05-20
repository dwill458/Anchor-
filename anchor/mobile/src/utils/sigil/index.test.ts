import { distillIntention, generateAbstractSigil, generateAllVariants, VARIANT_METADATA } from './index';

describe('sigil index exports', () => {
  it('exports all expected functions and objects', () => {
    expect(distillIntention).toBeDefined();
    expect(typeof distillIntention).toBe('function');

    expect(generateAbstractSigil).toBeDefined();
    expect(typeof generateAbstractSigil).toBe('function');

    expect(generateAllVariants).toBeDefined();
    expect(typeof generateAllVariants).toBe('function');

    expect(VARIANT_METADATA).toBeDefined();
    expect(typeof VARIANT_METADATA).toBe('object');
  });
});
