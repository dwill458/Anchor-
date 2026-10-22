import type { CreationSoundKey } from '@/services/CreationSounds';

/**
 * Locked milestone sound mapping (Anchor_Milestone_Sounds_FINAL). Each of the 20 milestones maps to
 * one tier sound. Played once at the earn moment only; never on replay or on opening a screen.
 * Keyed by server-matching definition id, so every id here must exist in the registry (tested).
 */
export type MilestoneSoundTier = 1 | 2 | 3;

export const MILESTONE_SOUND_TIER: Readonly<Record<string, MilestoneSoundTier>> = {
  // Tier 1 — quiet: firsts and entry points
  'vision.first': 1,
  'commitment.practices.1': 1,
  'strength.building': 1,
  'journey.waypoint.first': 1,
  // Tier 2 — established: accumulation and mid-journey proof
  'strength.established': 2,
  'commitment.practices.10': 2,
  'strength.reinforced': 2,
  'commitment.practices.30': 2,
  'commitment.minutes.100': 2,
  'journey.halfway': 2,
  'vision.board.complete': 2,
  'vision.visualize.1': 2,
  // Tier 3 — major: arrival and integration
  'strength.integrated': 3,
  'strength.full': 3,
  'commitment.practices.100': 3,
  'commitment.minutes.500': 3,
  'journey.destination': 3,
  'journey.goal': 3,
  'vision.visualize.10': 3,
  'vision.visualize.30': 3,
};

const TIER_SOUND: Record<MilestoneSoundTier, CreationSoundKey> = {
  1: 'milestoneT1Quiet',
  2: 'milestoneT2Established',
  3: 'milestoneT3Major',
};

export function milestoneSoundKey(definitionId: string): CreationSoundKey | undefined {
  const tier = MILESTONE_SOUND_TIER[definitionId];
  return tier ? TIER_SOUND[tier] : undefined;
}
