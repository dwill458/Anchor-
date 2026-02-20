import { hash32FNV1a, stableIndex } from '@/utils/hash';

describe('hash32FNV1a', () => {
  it('returns deterministic hash values for known seeds', () => {
    expect(hash32FNV1a('trace_hint_seed')).toBe(1135828842);
    expect(hash32FNV1a('career:v1:abc:user-1:trace_hint')).toBe(4070849324);
    expect(hash32FNV1a('career:v1:abc:user-1:trace_hint')).toBe(
      hash32FNV1a('career:v1:abc:user-1:trace_hint')
    );
  });
});

describe('stableIndex', () => {
  it('returns a value in range when length > 0', () => {
    for (let length = 1; length <= 8; length += 1) {
      const index = stableIndex(`seed-${length}`, length);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(length);
    }
  });

  it('returns 0 when length <= 0', () => {
    expect(stableIndex('seed', 0)).toBe(0);
    expect(stableIndex('seed', -5)).toBe(0);
  });
});
