import { homeTeachingBeats } from '../homeTeaching';
const ready = { hasAnchor: true, todayReady: true, doneToday: false, mode: 'focus' as const, hasCompletedPractice: false };
it('offers only Today before the first completed practice', () => {
  expect(homeTeachingBeats(ready)).toEqual(['home.today']);
});
it.each([
  { hasAnchor: false }, { todayReady: false }, { doneToday: true },
  { mode: 'release' as const }, { hasCompletedPractice: true },
])('withholds Today for %o', change => {
  expect(homeTeachingBeats({ ...ready, ...change })).toEqual([]);
});

it.each([
  ['focus', 30, 'Focus, 30 sec', 'Focus, 30 seconds'],
  ['deep_prime', 300, 'Deep Focus, 5 min', 'Deep Focus, 5 minutes'],
  ['visualize', 180, 'Visualize, 3 min', 'Visualize, 3 minutes'],
  ['focus', undefined, 'Focus', 'Focus'],
] as const)('uses real card mode and duration: %s %s', (mode, seconds, visual, spoken) => {
  const { homeTodayTeachingCopy } = require('../homeTeaching');
  expect(homeTodayTeachingCopy(mode, seconds)).toEqual({
    title: 'Start here each day.',
    body: `Each day Anchor suggests one practice. Today: ${visual}.`,
    accessibilityLabel: `Start here each day. Each day Anchor suggests one practice. Today: ${spoken}.`,
  });
});
