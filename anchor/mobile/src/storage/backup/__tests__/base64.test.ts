import { randomBytes } from 'node:crypto';
import { base64ToBytes, bytesToBase64 } from '../base64';

describe('base64 archive I/O', () => {
  it('round-trips every remainder length against Node base64', () => {
    for (let length = 0; length < 40; length++) {
      const bytes = new Uint8Array(randomBytes(length));
      const text = bytesToBase64(bytes);
      expect(text).toBe(Buffer.from(bytes).toString('base64'));
      expect(Buffer.from(base64ToBytes(text)).equals(Buffer.from(bytes))).toBe(true);
    }
  });

  it('rejects malformed input', () => {
    expect(() => base64ToBytes('abc')).toThrow('Invalid base64');
    expect(() => base64ToBytes('ab!d')).toThrow('Invalid base64');
  });
});
