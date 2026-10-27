import { homeTeachingBeats } from '../homeTeaching';
const ready = { hasAnchor: true, todayReady: true, doneToday: false, mode: 'focus' as const, hasCompletedPractice: false };
it('offers Today, then the Anchor tip, before the first completed practice', () => {
  expect(homeTeachingBeats(ready)).toEqual(['home.today', 'home.anchor']);
});
it('offers only the Anchor tip once Today is no longer eligible', () => {
  expect(homeTeachingBeats({ ...ready, hasCompletedPractice: true })).toEqual(['home.anchor']);
});
it('offers nothing without an Anchor', () => {
  expect(homeTeachingBeats({ ...ready, hasAnchor: false })).toEqual([]);
});
it.each([
  { todayReady: false }, { doneToday: true }, { mode: 'release' as const }, { hasCompletedPractice: true },
])('withholds Today for %o', change => {
  expect(homeTeachingBeats({ ...ready, ...change })).toEqual(['home.anchor']);
});

it.each(['focus', 'deep_prime', 'visualize'] as const)('keeps %s eligible without changing the approved static copy', mode => {
  const { TEACHING_COPY } = require('@/constants/v2/teachingCopy');
  expect(homeTeachingBeats({ ...ready, mode })).toEqual(['home.today', 'home.anchor']);
  expect(TEACHING_COPY.beats['home.today']).toEqual({
    title: 'Start here each day.',
    body: 'Today suggests one meaningful action to help you move forward with your Anchor.',
  });
  expect(TEACHING_COPY.common.gotIt).toBe('Got it');
});

it('keeps the Anchor tip copy within the teaching copy rules', () => {
  const { TEACHING_COPY } = require('@/constants/v2/teachingCopy');
  const { title, body } = TEACHING_COPY.beats['home.anchor'];
  expect(title.length).toBeLessThanOrEqual(32);
  expect(body.length).toBeLessThanOrEqual(120);
  expect(`${title} ${body}`).not.toMatch(/sigil|ritual|charge|deep prime|streak|grace|did you know|\bwill\b|\balways\b|\d/i);
});
it('registers the Anchor tip as a bubble that follows Today', () => {
  const { GUIDANCE_REGISTRY, guidanceForBeat } = require('@/constants/v2/guidanceRegistry');
  expect(guidanceForBeat('home.anchor')).toMatchObject({ id: 'home.open_anchor', surface: 'bubble' });
  const ids = GUIDANCE_REGISTRY.map((def: { id: string }) => def.id);
  expect(ids.indexOf('today.recommended')).toBeLessThan(ids.indexOf('home.open_anchor'));
});
