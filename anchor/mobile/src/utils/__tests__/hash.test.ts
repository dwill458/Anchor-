import { hash32FNV1a, sha256Hex, stableIndex } from '@/utils/hash';

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

describe('sha256Hex', () => {
  it('returns standard SHA-256 hex digests', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes Firebase Apple sign-in nonces without mutating the raw nonce', () => {
    const rawNonce = 'VSyd3BpAoDS_5ynN2eBp-VFjxy.uo3mJX';

    expect(sha256Hex(rawNonce)).toBe('6fce9f9b78998705d52446bfbb8de103816e7ffc6758a5a2d959b947001f94af');
    expect(rawNonce).toBe('VSyd3BpAoDS_5ynN2eBp-VFjxy.uo3mJX');
  });
});
