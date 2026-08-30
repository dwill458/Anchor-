export const JOURNEY_MILESTONE_IDS = {
  firstAnchor: 'journey.first_anchor',
  firstPrime: 'journey.first_prime',
  firstRelease: 'journey.first_release',
} as const;

export const JOURNEY_TEACHING_CONTENT_ID_BY_MILESTONE = {
  [JOURNEY_MILESTONE_IDS.firstAnchor]: 'milestone_first_anchor_v1',
  [JOURNEY_MILESTONE_IDS.firstPrime]: 'milestone_first_charge_v1',
  [JOURNEY_MILESTONE_IDS.firstRelease]: 'milestone_first_burn_v1',
} as const;

export type JourneyMilestoneId =
  (typeof JOURNEY_MILESTONE_IDS)[keyof typeof JOURNEY_MILESTONE_IDS];
export type MilestoneId = JourneyMilestoneId;

export interface MilestoneDefinition {
  id: MilestoneId;
  version: number;
  category: 'journey';
  presentation: 'forge' | 'toast' | 'push' | 'none';
  name: string;
  legacyTeachingId?: string;
}

export const MILESTONE_DEFINITIONS: Record<MilestoneId, MilestoneDefinition> = {
  'journey.first_anchor': {
    id: 'journey.first_anchor',
    version: 1,
    category: 'journey',
    presentation: 'toast',
    name: 'First Anchor',
    legacyTeachingId:
      JOURNEY_TEACHING_CONTENT_ID_BY_MILESTONE[JOURNEY_MILESTONE_IDS.firstAnchor],
  },
  'journey.first_prime': {
    id: 'journey.first_prime',
    version: 1,
    category: 'journey',
    presentation: 'toast',
    name: 'First Prime',
    legacyTeachingId:
      JOURNEY_TEACHING_CONTENT_ID_BY_MILESTONE[JOURNEY_MILESTONE_IDS.firstPrime],
  },
  'journey.first_release': {
    id: 'journey.first_release',
    version: 1,
    category: 'journey',
    presentation: 'toast',
    name: 'First Release',
    legacyTeachingId:
      JOURNEY_TEACHING_CONTENT_ID_BY_MILESTONE[JOURNEY_MILESTONE_IDS.firstRelease],
  },
};

export function isMilestoneId(value: unknown): value is MilestoneId {
  return typeof value === 'string' && value in MILESTONE_DEFINITIONS;
}
