import { WeeklyRecapV2 } from '../../../domain/v2/weeklyRecap';
import { RecapReader, SnapshotRow, SnapshotStore, WeeklyRecapError, WeeklyRecapService } from '../WeeklyRecapService';

const NY = 'America/New_York';
const at = (iso: string) => new Date(iso);
const tick = () => new Promise(r => setImmediate(r));

class MemoryStore implements SnapshotStore {
  rows = new Map<string, SnapshotRow>();
  creates = 0;
  async find(userId: string, weekKey: string) { await tick(); return this.rows.get(`${userId}|${weekKey}`) ?? null; }
  async create(i: Parameters<SnapshotStore['create']>[0]) {
    await tick();
    const k = `${i.userId}|${i.weekKey}`;
    if (this.rows.has(k)) return null; // unique (user, GLOBAL, weekKey)
    this.creates++;
    const row: SnapshotRow = { id: `snap-${this.rows.size + 1}`, userId: i.userId, weekKey: i.weekKey, timeZone: i.timeZone, status: i.recap.status, provenance: i.recap.provenance, snapshot: i.recap, feedback: null, finalizedAt: i.recap.status === 'FINAL' ? new Date() : null, updatedAt: new Date() };
    this.rows.set(k, row);
    return row;
  }
  private byId(id: string) { return [...this.rows.values()].find(r => r.id === id); }
  async updateDraft(id: string, recap: WeeklyRecapV2) { await tick(); const r = this.byId(id); if (!r || r.status !== 'DRAFT') return false; r.snapshot = recap; return true; }
  async finalize(id: string, recap: WeeklyRecapV2, atTime: Date) { await tick(); const r = this.byId(id); if (!r || r.status !== 'DRAFT') return false; r.snapshot = recap; r.status = 'FINAL'; r.finalizedAt = atTime; return true; }
  async list(userId: string, o: { before?: string; limit: number }) {
    return [...this.rows.values()].filter(r => r.userId === userId && (!o.before || r.weekKey < o.before)).sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1)).slice(0, o.limit);
  }
}

type Data = {
  practices?: any[]; moves?: any[]; waypoints?: any[]; courses?: any[]; completions?: any[]; releases?: any[]; milestones?: any[]; visions?: any[];
  anchors?: any[]; history?: boolean; fail?: string[];
};
const reader = (d: Data): RecapReader & { calls: number } => {
  const guard = (domain: string) => { if (d.fail?.includes(domain)) throw new Error(`${domain} down`); };
  const r = {
    calls: 0,
    hasAnyHistory: async () => { r.calls++; guard('history'); return d.history ?? true; },
    practices: async (_u: string, from: Date, to: Date) => { guard('practices'); return (d.practices ?? []).filter(p => p.completedAt >= from && p.completedAt < to); },
    priorPracticeAt: async () => null,
    chart: async () => { guard('chart'); return { waypoints: d.waypoints ?? [], courses: d.courses ?? [] }; },
    moves: async () => { guard('moves'); return d.moves ?? []; },
    completions: async () => { guard('lifecycle'); return d.completions ?? []; },
    releases: async () => d.releases ?? [],
    milestones: async () => { guard('milestones'); return d.milestones ?? []; },
    visions: async () => d.visions ?? [],
    anchors: async () => d.anchors ?? [{ id: 'a1', intention: 'Run a marathon', categoryKey: 'health', isReleased: false }],
  };
  return r;
};
const pr = (id: string, key: string, hourZ = 15) => ({ id, anchorId: 'a1', localDateKey: key, mode: 'focus', completedAt: at(`${key}T${String(hourZ).padStart(2, '0')}:00:00Z`) });
const mv = (id: string, iso: string) => ({ id, courseId: 'c1', waypointId: 'wx', anchorId: 'a1', title: id, completedAt: at(iso) });
const WEEK = '2026-10-12';
const svc = (d: Data, now: string, store = new MemoryStore()) => ({ store, service: new WeeklyRecapService(reader(d), store, () => at(now)) });
const recapOf = async (s: WeeklyRecapService, now?: any, weekKey = 'latest', tz = NY) => { const r = await s.get('u1', { weekKey, timeZone: tz }); if (r.kind !== 'RECAP') throw new Error('no recap'); return r; };

describe('moves reach the user through the full service', () => {
  it('several moves, no waypoint → a progress recap with canonical counts', async () => {
    const { service } = svc({ moves: [mv('m1', '2026-10-13T14:00:00Z'), mv('m2', '2026-10-14T14:00:00Z'), mv('m3', '2026-10-15T14:00:00Z')] }, '2026-10-21T18:00:00Z');
    const r = await recapOf(service);
    expect(r.recap.hero.kind).toBe('MOVES_PROGRESS');
    expect(r.recap.stats.find(s => s.id === 'MOVES')!.value).toBe(3);
  });
});

describe('lifecycle: preview → syncing → final', () => {
  const data: Data = { practices: [pr('p1', '2026-10-13')] };
  it('Sunday 19:00 local previews the current week as a provisional draft', async () => {
    const { service } = svc(data, '2026-10-18T23:30:00Z');
    const r = await recapOf(service);
    expect(r.recap.weekKey).toBe(WEEK);
    expect(r.recap.status).toBe('DRAFT');
    expect(r.recap.provisional).toEqual({ isProvisional: true, reason: 'WEEK_IN_PROGRESS' });
  });
  it('Monday shows the completed week, still provisional while data syncs', async () => {
    const { service } = svc(data, '2026-10-19T14:00:00Z');
    const r = await recapOf(service);
    expect(r.recap.weekKey).toBe(WEEK);
    expect(r.recap.provisional.reason).toBe('SYNCING');
  });
  it('late-synced offline practice appears in the draft and survives into the final', async () => {
    const store = new MemoryStore();
    const d: Data = { practices: [pr('p1', '2026-10-13')] };
    const monday = new WeeklyRecapService(reader(d), store, () => at('2026-10-19T14:00:00Z'));
    expect((await recapOf(monday)).recap.stats.find(s => s.id === 'PRACTICES')!.value).toBe(1);
    d.practices!.push(pr('p2-offline', '2026-10-17')); // syncs Monday night
    const tuesday = new WeeklyRecapService(reader(d), store, () => at('2026-10-20T16:00:00Z'));
    const final = await recapOf(tuesday);
    expect(final.recap.status).toBe('FINAL');
    expect(final.recap.stats.find(s => s.id === 'PRACTICES')!.value).toBe(2);
    expect(store.rows.size).toBe(1); // same row throughout, so feedback ids stay stable
  });
  it('a FINAL snapshot is immutable: later data and later requests never change it', async () => {
    const store = new MemoryStore();
    const d: Data = { practices: [pr('p1', '2026-10-13')] };
    const before = await recapOf(new WeeklyRecapService(reader(d), store, () => at('2026-10-21T12:00:00Z')));
    expect(before.recap.status).toBe('FINAL');
    d.practices!.push(pr('p-late', '2026-10-14'), pr('p-late2', '2026-10-15'));
    const reader2 = reader(d);
    const after = await recapOf(new WeeklyRecapService(reader2, store, () => at('2026-12-01T12:00:00Z')), undefined, WEEK);
    expect(after.recap).toEqual(before.recap);
    expect(reader2.calls).toBe(0); // not even recomputed
  });
  it('a week not yet open is refused', async () => {
    const { service } = svc(data, '2026-10-18T12:00:00Z');
    await expect(service.get('u1', { weekKey: '2026-10-12', timeZone: NY })).rejects.toMatchObject({ code: 'WEEK_NOT_AVAILABLE', status: 404 });
  });
  it('a never-opened old week is reconstructed and finalized immediately', async () => {
    const { service, store } = svc(data, '2026-12-01T12:00:00Z');
    const r = await recapOf(service, undefined, WEEK);
    expect(r.recap.status).toBe('FINAL');
    expect(r.recap.provenance).toBe('RECONSTRUCTED');
    expect(store.rows.size).toBe(1);
  });
});

describe('data failures never finalize or read as quiet', () => {
  it('a failing Chart source keeps the week a draft after Tuesday noon, then it finalizes once the source recovers', async () => {
    const store = new MemoryStore();
    const d: Data = { fail: ['chart'], practices: [pr('p1', '2026-10-13')] };
    const first = await recapOf(new WeeklyRecapService(reader(d), store, () => at('2026-10-21T12:00:00Z')));
    expect(first.recap.status).toBe('DRAFT');
    expect(first.recap.dataQuality.missing).toEqual(['CHART']);
    expect(first.recap.stats.find(s => s.id === 'WAYPOINTS')).toBeUndefined();
    d.fail = [];
    const second = await recapOf(new WeeklyRecapService(reader(d), store, () => at('2026-10-21T13:00:00Z')));
    expect(second.recap.status).toBe('FINAL');
    expect(second.recap.dataQuality.missing).toEqual([]);
  });
  it('total failure of everything is INCOMPLETE, never "A quiet week"', async () => {
    const { service } = svc({ fail: ['practices', 'chart', 'moves'] }, '2026-10-21T12:00:00Z');
    const r = await recapOf(service);
    expect(r.recap.hero.kind).toBe('INCOMPLETE');
    expect(JSON.stringify(r.recap)).not.toMatch(/quiet week/i);
  });
  it('an account with no history gets no recap and nothing is stored', async () => {
    const { service, store } = svc({ history: false }, '2026-10-21T12:00:00Z');
    expect(await service.get('u1', { weekKey: 'latest', timeZone: NY })).toMatchObject({ kind: 'NO_HISTORY' });
    expect(store.rows.size).toBe(0);
  });
});

describe('concurrent requests and cross-device identity', () => {
  it('ten simultaneous first opens create exactly one snapshot and all see it', async () => {
    const { service, store } = svc({ practices: [pr('p1', '2026-10-13')] }, '2026-10-19T14:00:00Z');
    const results = await Promise.all(Array.from({ length: 10 }, () => recapOf(service)));
    expect(store.creates).toBe(1);
    expect(store.rows.size).toBe(1);
    expect(new Set(results.map(r => r.id)).size).toBe(1);
  });
  it('simultaneous finalizers: one wins, everyone returns the same final recap', async () => {
    const store = new MemoryStore();
    const d: Data = { practices: [pr('p1', '2026-10-13')] };
    await recapOf(new WeeklyRecapService(reader(d), store, () => at('2026-10-19T14:00:00Z'))); // draft exists
    const late = new WeeklyRecapService(reader(d), store, () => at('2026-10-20T16:00:00Z'));
    const results = await Promise.all(Array.from({ length: 8 }, () => recapOf(late)));
    expect(results.every(r => r.recap.status === 'FINAL')).toBe(true);
    expect(store.rows.size).toBe(1);
    expect([...store.rows.values()][0].status).toBe('FINAL');
  });
  it('a second device in another timezone gets the same week, same zone, same row', async () => {
    const store = new MemoryStore();
    const d: Data = { practices: [pr('p1', '2026-10-13')] };
    const phone = await recapOf(new WeeklyRecapService(reader(d), store, () => at('2026-10-19T14:00:00Z')), undefined, WEEK, NY);
    const tablet = await recapOf(new WeeklyRecapService(reader(d), store, () => at('2026-10-19T15:00:00Z')), undefined, WEEK, 'Asia/Tokyo');
    expect(tablet.id).toBe(phone.id);
    expect(tablet.recap.timeZone).toBe(NY);
    expect(tablet.recap.weekKey).toBe(WEEK);
    expect(store.rows.size).toBe(1);
  });
  it('users are isolated', async () => {
    const store = new MemoryStore();
    const s = new WeeklyRecapService(reader({ practices: [pr('p1', '2026-10-13')] }), store, () => at('2026-10-21T12:00:00Z'));
    await s.get('u1', { weekKey: WEEK, timeZone: NY });
    await s.get('u2', { weekKey: WEEK, timeZone: NY });
    expect(store.rows.size).toBe(2);
  });
});

describe('timezones and DST', () => {
  it('rejects bad zones and non-Monday weeks', async () => {
    const { service } = svc({}, '2026-10-21T12:00:00Z');
    await expect(service.get('u1', { weekKey: 'latest', timeZone: 'Mars/Base' })).rejects.toMatchObject({ code: 'INVALID_TIME_ZONE' });
    await expect(service.get('u1', { weekKey: '2026-10-13', timeZone: NY })).rejects.toMatchObject({ code: 'INVALID_WEEK_KEY' });
    await expect(service.get('u1', { weekKey: 'latest', timeZone: undefined })).rejects.toBeInstanceOf(WeeklyRecapError);
  });
  it('the fall-back week (Oct 26 – Nov 1, 2026) includes the 25-hour Sunday and excludes Monday 00:00', async () => {
    const d: Data = { moves: [mv('inside', '2026-11-02T04:59:00Z'), mv('outside', '2026-11-02T05:00:00Z')] };
    const { service } = svc(d, '2026-11-04T18:00:00Z');
    const r = await recapOf(service, undefined, '2026-10-26');
    expect(r.recap.stats.find(s => s.id === 'MOVES')!.value).toBe(1);
  });
  it('same instant, different zone: Tokyo has already rolled into the next week', async () => {
    const d: Data = { moves: [mv('m', '2026-10-18T20:00:00Z')] }; // Sun 16:00 NY / Mon 05:00 Tokyo
    const ny = await recapOf(svc(d, '2026-10-21T12:00:00Z').service, undefined, WEEK, NY);
    const tokyo = await recapOf(svc(d, '2026-10-21T12:00:00Z').service, undefined, WEEK, 'Asia/Tokyo');
    expect(ny.recap.stats.find(s => s.id === 'MOVES')?.value).toBe(1);
    expect(tokyo.recap.stats.find(s => s.id === 'MOVES')).toBeUndefined();
  });
});

describe('completion, release, archived Anchors', () => {
  it('completion and release of different Anchors stay distinct; a released Anchor stays readable', async () => {
    const d: Data = {
      completions: [{ anchorId: 'a1', at: at('2026-10-14T15:00:00Z') }], releases: [{ anchorId: 'a2', at: at('2026-10-16T15:00:00Z') }],
      anchors: [{ id: 'a1', intention: 'Run', categoryKey: 'health', isReleased: false }, { id: 'a2', intention: 'Learn piano', categoryKey: 'creativity', isReleased: true }],
    };
    const r = (await recapOf(svc(d, '2026-10-21T12:00:00Z').service)).recap;
    expect(r.stats.find(s => s.id === 'COMPLETED')!.value).toBe(1);
    expect(r.stats.find(s => s.id === 'RELEASED')!.value).toBe(1);
    expect(r.refs.anchors.a2).toEqual({ intention: 'Learn piano', categoryKey: 'creativity', isReleased: true });
  });
});

describe('history list', () => {
  it('lists light rows newest first with a cursor', async () => {
    const store = new MemoryStore();
    const s = new WeeklyRecapService(reader({ practices: [pr('p1', '2026-10-13'), pr('p2', '2026-10-06')] }), store, () => at('2026-10-21T12:00:00Z'));
    await s.get('u1', { weekKey: '2026-10-05', timeZone: NY });
    await s.get('u1', { weekKey: WEEK, timeZone: NY });
    const page = await s.history('u1', { limit: 1 });
    expect(page.items.map(i => i.weekKey)).toEqual([WEEK]);
    expect(page.nextCursor).toBe(WEEK);
    expect((await s.history('u1', { before: page.nextCursor!, limit: 5 })).items.map(i => i.weekKey)).toEqual(['2026-10-05']);
    expect(Object.keys(page.items[0]).sort()).toEqual(['headline', 'heroKind', 'id', 'label', 'provisional', 'schemaVersion', 'status', 'weekKey']);
  });
});
