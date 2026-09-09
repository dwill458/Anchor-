/**
 * UI-F's presentation contract. Recommendation ordering belongs to the server;
 * this file intentionally contains no recommendation evaluator.
 */
export const V2_PRACTICE_MODES = ['focus', 'deep_prime', 'visualize', 'release'] as const;
export type V2PracticeMode = (typeof V2_PRACTICE_MODES)[number];

export type V2PracticeModeDefinition = {
  mode: V2PracticeMode;
  title: string;
  purpose: string;
  duration: string;
  accent: string;
  premium: boolean;
};

export const V2_PRACTICE_MODE_DEFINITIONS: readonly V2PracticeModeDefinition[] = [
  { mode: 'focus', title: 'Focus', purpose: 'Return to your Anchor with one clear breath.', duration: '10 sec · 30 sec · 60 sec', accent: '#3157D8', premium: false },
  { mode: 'deep_prime', title: 'Deep Prime', purpose: 'Settle into a longer, guided return.', duration: '2 min · 5 min · 10 min', accent: '#7C5CFA', premium: true },
  { mode: 'visualize', title: 'Visualize', purpose: 'Rehearse the future held in your Vision.', duration: '1 min · 3 min · 5 min', accent: '#3157D8', premium: true },
  { mode: 'release', title: 'Release', purpose: 'Close an intention when its work is complete.', duration: 'When ready', accent: '#F28A2E', premium: false },
];

export const V2_PRACTICE_MODE_BY_ID: Readonly<Record<V2PracticeMode, V2PracticeModeDefinition>> =
  Object.fromEntries(V2_PRACTICE_MODE_DEFINITIONS.map((definition) => [definition.mode, definition])) as Record<V2PracticeMode, V2PracticeModeDefinition>;

export const V2_PRACTICE_DURATIONS: Readonly<Record<Exclude<V2PracticeMode, 'release'>, readonly number[]>> = {
  focus: [10, 30, 60],
  deep_prime: [120, 300, 600],
  visualize: [60, 180, 300],
};

export type V2RecommendationAction = 'Focus' | 'Deep Prime' | 'Visualize' | 'Release';

export const V2_RECOMMENDATION_ACTION_TO_MODE: Readonly<Record<V2RecommendationAction, V2PracticeMode>> = {
  Focus: 'focus',
  'Deep Prime': 'deep_prime',
  Visualize: 'visualize',
  Release: 'release',
};

export const V2_RECOMMENDATION_WHY: Readonly<Record<V2PracticeMode, string>> = {
  release: 'Reached a meaningful milestone',
  visualize: 'Reconnect with your Vision today',
  deep_prime: 'Thread has softened over the last 7 days',
  focus: 'Daily reinforcement for your Anchor',
};

export function v2PracticeDurationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  return `${seconds / 60} min`;
}
