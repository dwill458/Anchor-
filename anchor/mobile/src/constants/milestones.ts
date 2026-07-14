import type { MarkName, RankName } from '@/utils/progression';

export const RANK_MILESTONE_ID_BY_NAME = {
  Initiate: 'rank.initiate',
  Practitioner: 'rank.practitioner',
  Architect: 'rank.architect',
  Sovereign: 'rank.sovereign',
} as const satisfies Record<RankName, string>;

export const MARK_MILESTONE_ID_BY_NAME = {
  'First Return Mark': 'mark.first_return',
  'Steady Thread Mark': 'mark.steady_thread',
  'Discipline Mark': 'mark.discipline',
  'Constancy Mark': 'mark.constancy',
} as const satisfies Record<MarkName, string>;

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

export const NOTIFICATION_MILESTONE_IDS = {
  sessions3: 'notification.sessions_3',
  sessions7: 'notification.sessions_7',
  sessions30: 'notification.sessions_30',
  threadStrength100: 'notification.thread_strength_100',
} as const;

export type RankMilestoneId =
  (typeof RANK_MILESTONE_ID_BY_NAME)[keyof typeof RANK_MILESTONE_ID_BY_NAME];
export type MarkMilestoneId =
  (typeof MARK_MILESTONE_ID_BY_NAME)[keyof typeof MARK_MILESTONE_ID_BY_NAME];
export type JourneyMilestoneId =
  (typeof JOURNEY_MILESTONE_IDS)[keyof typeof JOURNEY_MILESTONE_IDS];
export type NotificationMilestoneId =
  (typeof NOTIFICATION_MILESTONE_IDS)[keyof typeof NOTIFICATION_MILESTONE_IDS];
export type MilestoneId =
  | RankMilestoneId
  | MarkMilestoneId
  | JourneyMilestoneId
  | NotificationMilestoneId;

export interface MilestoneDefinition {
  id: MilestoneId;
  version: number;
  category: 'rank' | 'mark' | 'journey' | 'notification';
  presentation: 'forge' | 'toast' | 'push' | 'none';
  name: string;
  legacyTeachingId?: string;
}

export const MILESTONE_DEFINITIONS: Record<MilestoneId, MilestoneDefinition> = {
  'rank.initiate': {
    id: 'rank.initiate',
    version: 1,
    category: 'rank',
    presentation: 'none',
    name: 'Initiate',
  },
  'rank.practitioner': {
    id: 'rank.practitioner',
    version: 1,
    category: 'rank',
    presentation: 'forge',
    name: 'Practitioner',
  },
  'rank.architect': {
    id: 'rank.architect',
    version: 1,
    category: 'rank',
    presentation: 'forge',
    name: 'Architect',
  },
  'rank.sovereign': {
    id: 'rank.sovereign',
    version: 1,
    category: 'rank',
    presentation: 'forge',
    name: 'Sovereign',
  },
  'mark.first_return': {
    id: 'mark.first_return',
    version: 1,
    category: 'mark',
    presentation: 'forge',
    name: 'First Return Mark',
  },
  'mark.steady_thread': {
    id: 'mark.steady_thread',
    version: 1,
    category: 'mark',
    presentation: 'forge',
    name: 'Steady Thread Mark',
  },
  'mark.discipline': {
    id: 'mark.discipline',
    version: 1,
    category: 'mark',
    presentation: 'forge',
    name: 'Discipline Mark',
  },
  'mark.constancy': {
    id: 'mark.constancy',
    version: 1,
    category: 'mark',
    presentation: 'forge',
    name: 'Constancy Mark',
  },
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
  'notification.sessions_3': {
    id: 'notification.sessions_3',
    version: 1,
    category: 'notification',
    presentation: 'push',
    name: '3 Sessions',
  },
  'notification.sessions_7': {
    id: 'notification.sessions_7',
    version: 1,
    category: 'notification',
    presentation: 'push',
    name: '7 Sessions',
  },
  'notification.sessions_30': {
    id: 'notification.sessions_30',
    version: 1,
    category: 'notification',
    presentation: 'push',
    name: '30 Sessions',
  },
  'notification.thread_strength_100': {
    id: 'notification.thread_strength_100',
    version: 1,
    category: 'notification',
    presentation: 'push',
    name: 'Thread Strength 100',
  },
};

export function isMilestoneId(value: unknown): value is MilestoneId {
  return typeof value === 'string' && value in MILESTONE_DEFINITIONS;
}

export function rankMilestoneId(rankName: RankName): RankMilestoneId {
  return RANK_MILESTONE_ID_BY_NAME[rankName];
}

export function markMilestoneId(markName: MarkName): MarkMilestoneId {
  return MARK_MILESTONE_ID_BY_NAME[markName];
}
