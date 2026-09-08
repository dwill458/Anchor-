import type { Anchor } from '@/types';

let counter = 0;

export function makeAnchor(overrides: Partial<Anchor> = {}): Anchor {
  counter += 1;
  const id = overrides.id ?? `anchor-${counter}`;
  const now = new Date('2026-09-01T12:00:00.000Z');
  return {
    id,
    localId: id,
    userId: 'user-1',
    intentionText: `Intention ${counter}`,
    category: 'career',
    distilledLetters: ['N', 'T', 'C'],
    baseSigilSvg: '<svg viewBox="0 0 10 10"><path d="M1 1L9 9"/></svg>',
    structureVariant: 'balanced',
    isCharged: false,
    activationCount: 0,
    threadStrength: 50,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
