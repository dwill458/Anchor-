import { useMilestoneCelebrationStore } from '../milestoneCelebrationStore';
import type { MilestoneRecord } from '@/milestones/milestoneModel';
const store = () => useMilestoneCelebrationStore.getState();
const record = (id = 'm1', definitionId = 'commitment.practices.1'): MilestoneRecord => ({
  id, anchorId: 'a', definitionId, definitionVersion: 1, earnedAt: new Date().toISOString(), sourceKind: 'PRACTICE_COMPLETION', sourceEntityId: 's', metadata: {}, celebratedAt: null,
  presentationId: `reservation-${id}`, presentationExpiresAt: new Date(Date.now() + 90000).toISOString(),
});
beforeEach(() => store().reset());
it('cannot queue ten historical awards from a gallery read', () => {
  const history = Array.from({ length: 10 }, (_, i) => ({ ...record(String(i)), presentationId: undefined }));
  expect(store().enqueueAwards(history, 'u')).toBe(0);
  expect(store().queue).toEqual([]);
});
it('bounds the automatic queue to one featured reserved award', () => {
  expect(store().enqueueAwards([record(), record('m2')], 'u')).toBe(1);
  expect(store().enqueueAwards([record('m3')], 'u')).toBe(0);
  expect(store().queue).toHaveLength(1);
  expect(store().queue[0].transition).toBe(true);
});
it('does not queue expired reservations or actual acknowledged awards', () => {
  expect(store().enqueueAwards([{ ...record(), presentationExpiresAt: new Date(0).toISOString() }], 'u')).toBe(0);
  expect(store().enqueueAwards([{ ...record(), celebratedAt: new Date().toISOString() }], 'u')).toBe(0);
});
it('never requeues the same award after interruption', () => {
  store().enqueueAwards([record()], 'u'); store().shift('award:m1');
  expect(store().enqueueAwards([record()], 'u')).toBe(0);
});
it('preserves a single matching measured practice origin', () => {
  store().setOrigin({ sessionId: 's', anchorId: 'a', x: 120, y: 260 });
  expect(store().takeOrigin(record())).toEqual({ x: 120, y: 260 });
  expect(store().takeOrigin(record())).toBeUndefined();
});
it('keeps manual replay independent of automatic reservations and receipts', () => {
  const earned = { ...record(), presentationId: undefined, celebratedAt: new Date().toISOString() };
  store().requestReplay(earned); store().requestReplay(earned);
  expect(store().queue).toHaveLength(1);
  expect(store().queue[0]).toMatchObject({ mode: 'replay', accountId: null });
  store().shift(store().queue[0].key); store().requestReplay(earned);
  expect(store().queue).toHaveLength(1);
});
it('skips unknown definitions and clears presentation data on account reset', () => {
  expect(store().enqueueAwards([record('x', 'future.unknown')], 'u')).toBe(0);
  store().enqueueAwards([record()], 'u'); store().reset();
  expect(store().queue).toEqual([]); expect(store().seen).toEqual([]);
});
