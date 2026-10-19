/**
 * Client-side milestone registry: display copy and presentation specs for every milestone the
 * server can award. The SERVER owns whether one is earned (backend `milestones/registry.ts`);
 * ids here must match it exactly (a parity test enforces this). Versioned so copy or artwork can
 * change without touching what a user already earned. No React or native imports: this file is
 * pure data so it can be shared by the collection, detail, celebration and replay surfaces.
 */

export const MILESTONE_REGISTRY_VERSION = 1;

export type MilestoneFamily = 'strength' | 'commitment' | 'journey';

/** Vector motif the artwork component draws. See docs/progress-redesign/ASSET_SPEC.md. */
export type MilestoneMotif =
  | 'energyRings'
  | 'stones'
  | 'sealedStar'
  | 'hourglass'
  | 'lotusStar'
  | 'waypoint'
  | 'ridge'
  | 'summit'
  | 'sunrise';

/** Matches the celebration coordinator's levels (2 = standard, 3 = significant, 4 = major). */
export type MilestoneCelebrationLevel = 2 | 3 | 4;

export interface MilestoneSpec {
  id: string;
  family: MilestoneFamily;
  version: number;
  title: string;
  /** Short, true description shown on the detail screen. */
  description: string;
  /** The condition, stated plainly. Shown for locked and earned milestones. */
  unlock: string;
  /** Shown while locked when the full condition should stay a quiet discovery. */
  lockedHint?: string;
  art: {
    motif: MilestoneMotif;
    /** 1 to 5: how developed the motif is (more rings, more stones). Never implies earned. */
    tier: 1 | 2 | 3 | 4 | 5;
    /** Strength artwork wears the Anchor's category colour; others use the shared material. */
    usesCategoryColor: boolean;
  };
  celebration: {
    level: MilestoneCelebrationLevel;
    durationMs: number;
    /** How the artwork arrives. Shared structure, meaningful variation. */
    reveal: 'bloom' | 'engrave' | 'rise';
  };
  /** Keys into v2Haptics and CreationSounds. Played once per celebration, never on replay unless asked. */
  haptic: 'confirmation' | 'completion';
  sound: 'practiceComplete' | 'bloom' | 'seal' | 'revealSettle';
  /** Replay runs the same scene in non-awarding mode: no store, API or reward writes. */
  replay: { allowed: true; awarding: false };
}

const replay = { allowed: true, awarding: false } as const;

const strength = (
  id: string,
  title: string,
  threshold: number,
  tier: MilestoneSpec['art']['tier'],
  level: MilestoneCelebrationLevel,
  durationMs: number,
): MilestoneSpec => ({
  id,
  family: 'strength',
  version: 1,
  title,
  description:
    threshold === 100
      ? 'Your Thread reached Full Strength. Strength can ease with time, but this stays earned.'
      : `Your Thread reached ${title} (${threshold}). Strength can ease with time, but this stays earned.`,
  unlock: `Reach ${threshold} Thread Strength.`,
  art: { motif: 'energyRings', tier, usesCategoryColor: true },
  celebration: { level, durationMs, reveal: 'bloom' },
  haptic: threshold >= 90 ? 'completion' : 'confirmation',
  sound: 'bloom',
  replay,
});

const commitment = (
  id: string,
  title: string,
  description: string,
  unlock: string,
  motif: MilestoneMotif,
  tier: MilestoneSpec['art']['tier'],
  level: MilestoneCelebrationLevel,
): MilestoneSpec => ({
  id,
  family: 'commitment',
  version: 1,
  title,
  description,
  unlock,
  art: { motif, tier, usesCategoryColor: false },
  celebration: { level, durationMs: level >= 3 ? 4200 : 3200, reveal: 'engrave' },
  haptic: level >= 3 ? 'completion' : 'confirmation',
  sound: 'practiceComplete',
  replay,
});

const journey = (
  id: string,
  title: string,
  description: string,
  unlock: string,
  motif: MilestoneMotif,
  tier: MilestoneSpec['art']['tier'],
  level: MilestoneCelebrationLevel,
  lockedHint?: string,
): MilestoneSpec => ({
  id,
  family: 'journey',
  version: 1,
  title,
  description,
  unlock,
  lockedHint,
  art: { motif, tier, usesCategoryColor: false },
  celebration: { level, durationMs: level >= 4 ? 5200 : 3800, reveal: 'rise' },
  haptic: level >= 3 ? 'completion' : 'confirmation',
  sound: level >= 4 ? 'seal' : 'revealSettle',
  replay,
});

/** In display order within each family. */
export const MILESTONE_SPECS: readonly MilestoneSpec[] = [
  strength('strength.building', 'Building', 25, 1, 2, 3200),
  strength('strength.established', 'Established', 50, 2, 3, 4000),
  strength('strength.integrated', 'Integrated', 75, 3, 3, 4200),
  strength('strength.reinforced', 'Reinforced', 90, 4, 4, 4800),
  strength('strength.full', 'Full Strength', 100, 5, 4, 5200),

  commitment('commitment.practices.1', 'First Practice', 'The first time you came back to this intention on purpose.', 'Complete one practice.', 'sealedStar', 1, 2),
  commitment('commitment.practices.10', 'Ten Practices', 'Ten completed practices for this Anchor.', 'Complete 10 practices.', 'stones', 2, 2),
  commitment('commitment.practices.30', 'Thirty Practices', 'Thirty completed practices. Not in a row, just in total.', 'Complete 30 practices.', 'lotusStar', 3, 3),
  commitment('commitment.practices.100', 'One Hundred Practices', 'A hundred times you returned to this intention.', 'Complete 100 practices.', 'lotusStar', 5, 4),
  commitment('commitment.minutes.100', '100 Minutes', 'One hundred minutes of focused time with this Anchor.', 'Practice for 100 minutes in total.', 'hourglass', 2, 3),
  commitment('commitment.minutes.500', '500 Minutes', 'Five hundred minutes of focused time with this Anchor.', 'Practice for 500 minutes in total.', 'hourglass', 4, 4),

  journey('journey.waypoint.first', 'First Waypoint', 'You reached the first waypoint on your Chart.', 'Complete your first Chart waypoint.', 'waypoint', 1, 3),
  journey('journey.halfway', 'Halfway', 'Half of the waypoints on your Chart are behind you.', 'Complete half of your Chart’s waypoints.', 'ridge', 3, 3),
  journey('journey.destination', 'All Waypoints', 'Every waypoint on your Chart is complete.', 'Complete every waypoint on your Chart.', 'summit', 4, 4),
  journey('journey.goal', 'Goal Reached', 'You marked this intention as realized.', 'Mark your intention as completed.', 'sunrise', 5, 4, 'A milestone for when this intention comes true.'),
];

const BY_ID: ReadonlyMap<string, MilestoneSpec> = new Map(MILESTONE_SPECS.map((spec) => [spec.id, spec]));

export function getMilestoneSpec(definitionId: string): MilestoneSpec | undefined {
  return BY_ID.get(definitionId);
}

export const FAMILY_LABEL: Record<MilestoneFamily, string> = {
  strength: 'Thread Strength',
  commitment: 'Commitment',
  journey: 'Journey',
};

/** What the server recorded when it awarded the milestone, as one honest line. Null when it recorded nothing to show. */
export function describeEarnedValue(spec: MilestoneSpec, metadata: unknown): string | null {
  const data = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  const num = (key: string) => (typeof data[key] === 'number' ? (data[key] as number) : null);
  if (spec.family === 'strength') {
    const value = num('strength');
    return value === null ? null : `Thread Strength was ${value} when you reached it.`;
  }
  if (spec.id.startsWith('commitment.practices.')) {
    const count = num('practices');
    return count === null ? null : `Practice number ${count}.`;
  }
  if (spec.id.startsWith('commitment.minutes.')) {
    const minutes = num('minutes');
    return minutes === null ? null : `Passed ${minutes} total minutes.`;
  }
  if (spec.id === 'journey.halfway') {
    const total = num('waypointCount');
    return total === null ? null : `Your Chart had ${total} waypoints.`;
  }
  return null;
}
