/**
 * FNV-1a 32-bit hash for deterministic, cross-platform selection.
 */
export function hash32FNV1a(input: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

export function stableIndex(seed: string, length: number): number {
  if (length <= 0) {
    return 0;
  }

  return hash32FNV1a(seed) % length;
}
