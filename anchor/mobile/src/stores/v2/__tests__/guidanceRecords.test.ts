import { createGuidanceRecords, guidanceStorageKey, mergeGuidanceRecords } from '../guidanceRecords';
import { emptyGuidanceRecord } from '../guidanceCoordinator';
jest.mock('@/stores/encryptedPersistStorage', () => ({ encryptedPersistStorage: {} }));
const storage = () => { const values = new Map<string, string>(); return { values, getItem: jest.fn(async (key: string) => values.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }), removeItem: jest.fn(async (key: string) => { values.delete(key); }) }; };
it.each([
 ['home.today', 'today.recommended'], ['practice.today', 'today.recommended'],
 ['practice.switch', 'practice.switch_anchor'], ['vision.second', 'vision.lead_image'], ['progress.thread', 'progress.levels'],
])('migrates %s without importing retired beats', async (beat, id) => {
 const s = storage(); s.values.set(`anchor:v2:teach:${beat}:a`, '1'); s.values.set('anchor:v2:teach:home.thread:a', '1');
 const data = await createGuidanceRecords(s).load('a'); expect(data.records[id].outcome).toBe('acknowledged'); expect(data.records['thread.glow']).toBeUndefined();
});
it('migrates whisper as displayed and Chart as acknowledged', async () => {
 const s = storage(); s.values.set('guest:teach:vision.first', '1'); s.values.set('guest:chart-taught', '1');
 const data = await createGuidanceRecords(s).load('guest'); expect(data.records['vision.first_photo'].displayCount).toBe(1); expect(data.records['chart.next_move'].outcome).toBe('acknowledged');
});
it('promotes guest history once across simultaneous account reads and a fresh process', async () => {
 const s = storage(); s.values.set('guest:teach:home.today', '1'); const repo = createGuidanceRecords(s);
 const [a,b] = await Promise.all([repo.load('a'), repo.load('b')]); expect(a.records['today.recommended'].outcome).toBe('acknowledged'); expect(b.records).toEqual({});
 expect((await createGuidanceRecords(s).load('c')).records).toEqual({});
});
it('preserves guest history when the promotion write fails', async () => {
 const s = storage(); s.values.set('guest:teach:home.today', '1'); s.setItem.mockRejectedValueOnce(new Error('locked'));
 await expect(createGuidanceRecords(s).load('a')).rejects.toThrow('locked'); expect(s.values.get('guest:teach:home.today')).toBe('1');
});
it('settled wins over unsettled and earlier first display survives promotion', () => {
 const a = { records: { x: { ...emptyGuidanceRecord(), firstDisplayedAt: '2026-10-25', displayCount: 1 } }, discovery: {} };
 const g = { records: { x: { ...emptyGuidanceRecord(), outcome: 'dismissed' as const, firstDisplayedAt: '2026-10-26' } }, discovery: {} };
 expect(mergeGuidanceRecords(a,g).records.x).toMatchObject({ outcome: 'dismissed', firstDisplayedAt: '2026-10-25', displayCount: 1 });
});
it('fails closed on malformed records and unavailable storage', async () => {
 const s = storage(); s.values.set(guidanceStorageKey('guest'), '{bad'); await expect(createGuidanceRecords(s).load('guest')).rejects.toThrow();
 s.getItem.mockRejectedValueOnce(new Error('keystore')); await expect(createGuidanceRecords(s).load('a')).rejects.toThrow('keystore');
});
it('serializes snapshots so replay cannot be overwritten by older writes', async () => {
 const s = storage(); const repo = createGuidanceRecords(s); await repo.load('guest');
 repo.save('guest', { records: { x: { ...emptyGuidanceRecord(), outcome: 'acknowledged' } }, discovery: {} });
 repo.save('guest', { records: {}, discovery: {} }); await repo.flush();
 expect(JSON.parse(s.values.get(guidanceStorageKey('guest'))!).records).toEqual({});
});
it('persists replay intent so retained legacy per-course flags cannot undo a replay', async () => {
 const s = storage(); const repo = createGuidanceRecords(s); await repo.load('a');
 repo.save('a', { records: {}, discovery: {}, replayedIds: ['chart.next_move'] }); await repo.flush();
 expect((await createGuidanceRecords(s).load('a')).replayedIds).toContain('chart.next_move');
});

it('persists glow display and variant through restart and promotes guest discovery only once', async () => {
 const s = storage(); const repo = createGuidanceRecords(s); await repo.load('guest');
 repo.save('guest', { records: { 'thread.glow': { ...emptyGuidanceRecord(), variant: 'A', displayCount: 1, presentAttempts: 1 } }, discovery: { 'thread.glow': '2026-10-26' } });
 await repo.flush();
 const restarted = createGuidanceRecords(s);
 const a = await restarted.load('account-a');
 expect(a.records['thread.glow']).toMatchObject({ variant: 'A', displayCount: 1 });
 expect(a.discovery['thread.glow']).toBe('2026-10-26');
 expect((await restarted.load('account-b')).records['thread.glow']).toBeUndefined();
 expect((await createGuidanceRecords(s).load('account-a')).records['thread.glow'].displayCount).toBe(1);
});
