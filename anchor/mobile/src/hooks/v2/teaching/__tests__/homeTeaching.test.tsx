import { homeTeachingBeats } from '../homeTeaching';
const ready = { hasAnchor: true, todayReady: true, doneToday: false, mode: 'focus' as const, hasCompletedPractice: false };
it('offers Today before the first completed practice without auto-offering the Anchor tip', () => {
  expect(homeTeachingBeats(ready)).toEqual(['home.today']);
});
it('offers the Thread Strength glow beat after the first completed practice', () => {
  expect(homeTeachingBeats({ ...ready, hasCompletedPractice: true })).toEqual(['home.glow']);
});
it('offers nothing without an Anchor', () => {
  expect(homeTeachingBeats({ ...ready, hasAnchor: false })).toEqual([]);
});
it('orders Home beats by priority: glow, progress moved, swipe, then Today', () => {
  expect(homeTeachingBeats({ ...ready, hasCompletedPractice: true, hasVision: true, anchorCount: 2 })).toEqual([
    'home.glow',
    'home.thread',
    'home.swipe',
  ]);
});
it('includes a requested Show me beat first', () => {
  expect(homeTeachingBeats({ ...ready, requestedBeat: 'home.anchor' })).toEqual(['home.anchor', 'home.today']);
});
it.each([
  { todayReady: false }, { doneToday: true }, { mode: 'release' as const },
])('withholds Today for %o before practice', change => {
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

it('keeps the Anchor tip copy within the teaching copy rules', () => {
  const { TEACHING_COPY } = require('@/constants/v2/teachingCopy');
  const { title, body } = TEACHING_COPY.beats['home.anchor'];
  expect(title.length).toBeLessThanOrEqual(32);
  expect(body.length).toBeLessThanOrEqual(120);
  expect(`${title} ${body}`).not.toMatch(/sigil|ritual|charge|deep prime|streak|grace|did you know|\bwill\b|\balways\b|\d/i);
});
it('registers the Home follow-through beats in priority order before Today', () => {
  const { GUIDANCE_REGISTRY, guidanceForBeat } = require('@/constants/v2/guidanceRegistry');
  expect(guidanceForBeat('home.anchor')).toMatchObject({ id: 'home.open_anchor', surface: 'bubble', followThrough: true });
  const ids = GUIDANCE_REGISTRY.map((def: { id: string }) => def.id);
  expect(ids.indexOf('home.thread_glow')).toBeLessThan(ids.indexOf('home.progress_moved'));
  expect(ids.indexOf('home.progress_moved')).toBeLessThan(ids.indexOf('home.swipe_anchors'));
  expect(ids.indexOf('home.swipe_anchors')).toBeLessThan(ids.indexOf('today.recommended'));
});
