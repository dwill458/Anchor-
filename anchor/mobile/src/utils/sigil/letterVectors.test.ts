import { DENSE_VECTORS, BALANCED_VECTORS, MINIMAL_VECTORS } from './letterVectors';

describe('letterVectors', () => {
  it('contains DENSE_VECTORS dictionary with correct structure', () => {
    expect(DENSE_VECTORS).toBeDefined();
    expect(Object.keys(DENSE_VECTORS)).toHaveLength(26);
    expect(DENSE_VECTORS['A']).toContain('M');
    expect(DENSE_VECTORS['Z']).toContain('M');
  });

  it('contains BALANCED_VECTORS dictionary with correct structure', () => {
    expect(BALANCED_VECTORS).toBeDefined();
    expect(Object.keys(BALANCED_VECTORS)).toHaveLength(26);
    expect(BALANCED_VECTORS['A']).toContain('M');
    expect(BALANCED_VECTORS['Z']).toContain('M');
  });

  it('contains MINIMAL_VECTORS dictionary with correct structure', () => {
    expect(MINIMAL_VECTORS).toBeDefined();
    expect(Object.keys(MINIMAL_VECTORS)).toHaveLength(26);
    expect(MINIMAL_VECTORS['A']).toContain('M');
    expect(MINIMAL_VECTORS['Z']).toContain('M');
  });

  it('should only contain uppercase letters as keys', () => {
    const keys = Object.keys(DENSE_VECTORS);
    keys.forEach((key) => {
      expect(key).toMatch(/^[A-Z]$/);
    });
  });

  it('should map each key to a non-empty string path', () => {
    Object.values(DENSE_VECTORS).forEach((val) => {
      expect(typeof val).toBe('string');
      expect(val.length).toBeGreaterThan(0);
    });
    Object.values(BALANCED_VECTORS).forEach((val) => {
      expect(typeof val).toBe('string');
      expect(val.length).toBeGreaterThan(0);
    });
    Object.values(MINIMAL_VECTORS).forEach((val) => {
      expect(typeof val).toBe('string');
      expect(val.length).toBeGreaterThan(0);
    });
  });
});
