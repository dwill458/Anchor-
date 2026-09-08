export const FIRST_RUN_FOCUS_SECONDS = 10;
/** Matches the locked intention-entry surface and the shared validator. */
export const FIRST_RUN_MAX_INTENTION_LENGTH = 100;
export type FirstRunDirection = 'work' | 'performance' | 'growth' | 'custom';
export const FIRST_RUN_DIRECTIONS: Array<{ id: FirstRunDirection; title: string; subtitle: string; example: string; accentCategory: string }> = [
  { id: 'work', title: 'Build something', subtitle: 'Work · Business · Creative', example: 'I share my work with confidence', accentCategory: 'career' },
  { id: 'performance', title: 'Perform better', subtitle: 'Sport · Competition · Execution', example: 'I perform with confidence under pressure', accentCategory: 'health' },
  { id: 'growth', title: 'Change something', subtitle: 'Growth · Habits · Confidence', example: 'I make time for what matters to me', accentCategory: 'health' },
  { id: 'custom', title: 'Something personal', subtitle: 'Define it yourself', example: 'I make steady progress on what I choose', accentCategory: 'custom' },
];
