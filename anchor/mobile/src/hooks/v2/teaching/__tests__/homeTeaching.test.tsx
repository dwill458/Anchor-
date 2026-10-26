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

it.each(['focus', 'deep_prime', 'visualize'] as const)('keeps %s eligible without changing the approved static copy', mode => {
  const { TEACHING_COPY } = require('@/constants/v2/teachingCopy');
  expect(homeTeachingBeats({ ...ready, mode })).toEqual(['home.today']);
  expect(TEACHING_COPY.beats['home.today']).toEqual({
    title: 'Start here each day.',
    body: 'Today suggests one meaningful action to help you move forward with your Anchor.',
  });
  expect(TEACHING_COPY.common.gotIt).toBe('Got it');
});
