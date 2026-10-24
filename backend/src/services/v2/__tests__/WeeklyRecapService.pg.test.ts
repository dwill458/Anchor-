/**
 * Real-PostgreSQL integration tests. Requires TEST_DATABASE_URL pointing at a DISPOSABLE
 * database that has all repo migrations plus the weekly_recap_snapshots migration applied.
 * Skipped (not failed) when TEST_DATABASE_URL is unset so the default suite stays hermetic.
 */
import type { Pool as PgPool } from 'pg';
import { randomUUID } from 'crypto';
import { WeeklyRecapService, SqlExecutor, RecapError } from '../WeeklyRecapService';

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;

d('WeeklyRecapService on real PostgreSQL', () => {
  let pool: PgPool;
  let db: SqlExecutor;
  const TZ = 'America/New_York';
  const WEEK = '2026-10-12';
  const T = (iso: string) => new Date(iso);

  beforeAll(() => {
    // Lazy require: `pg` is only needed (and only a devDependency) when the suite is enabled.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: URL, max: 20 });
    db = { query: async (text, values) => (await pool.query(text, values as any[])).rows };
  });
  afterAll(async () => { await pool.end(); });

  const q = (text: string, values: unknown[] = []) => pool.query(text, values);
  const ts = (iso: string) => iso.replace('T', ' ').replace('Z', '');

  async function mkUser() {
    const id = randomUUID();
    await q(`INSERT INTO users (id,email,"authProvider","authUid","updatedAt") VALUES ($1,$2,'test',$1,now())`, [id, `${id}@t.io`]);
    return id;
  }
  async function mkAnchor(userId: string, text = 'Fitness', extra: { archived?: string; completed?: string; released?: string } = {}) {
    const id = randomUUID();
    await q(
      `INSERT INTO anchors (id,"userId","intentionText",category,"updatedAt","archivedAt","isArchived",intention_completed_at,released_at)
       VALUES ($1,$2,$3,'health',now(),$4,$5,$6,$7)`,
      [id, userId, text, extra.archived ? ts(extra.archived) : null, !!extra.archived, extra.completed ? ts(extra.completed) : null, extra.released ? ts(extra.released) : null]
    );
    return id;
  }
  async function mkCourse(userId: string, anchorId: string | null, o: { completed?: string } = {}) {
    const id = randomUUID();
    await q(
      `INSERT INTO courses (id,user_id,destination_text,updated_at,anchor_id,status,completed_at)
       VALUES ($1,$2,'Run a 5K',now(),$3,$4::"CourseStatus",$5)`,
      [id, userId, anchorId, o.completed ? 'COMPLETED' : 'ACTIVE', o.completed ? ts(o.completed) : null]
    );
    return id;
  }
  async function mkWaypoint(userId: string, courseId: string, position: number, o: { reached?: string; created?: string; cancelled?: string } = {}) {
    const id = randomUUID();
    await q(
      `INSERT INTO waypoints (id,user_id,course_id,position,title,updated_at,reached_at,created_at,cancelled_at)
       VALUES ($1,$2,$3,$4,$5,now(),$6,COALESCE($7::timestamp, now()),$8)`,
      [id, userId, courseId, position, `Waypoint ${position}`, o.reached ? ts(o.reached) : null, o.created ? ts(o.created) : null, o.cancelled ? ts(o.cancelled) : null]
    );
    return id;
  }
  async function mkMove(userId: string, courseId: string, waypointId: string, completedAt: string | null, n = 1) {
    const id = randomUUID();
    await q(
      `INSERT INTO moves (id,user_id,course_id,waypoint_id,title,source,status,position,updated_at,completed_at)
       VALUES ($1,$2,$3,$4,$5,'USER',$6,$7,now(),$8)`,
      [id, userId, courseId, waypointId, `Move ${n}`, completedAt ? 'COMPLETED' : 'ACTIVE', n, completedAt ? ts(completedAt) : null]
    );
    return id;
  }
  async function mkEvent(userId: string, courseId: string, type: string, occurred: string, src?: { type: string; id: string }) {
    const id = randomUUID();
    await q(
      `INSERT INTO course_events (id,user_id,course_id,event_type,occurred_at,idempotency_key,source_entity_type,source_entity_id)
       VALUES ($1,$2,$3,$4::"CourseEventType",$5,$6,$7,$8)`,
      [id, userId, courseId, type, ts(occurred), randomUUID(), src?.type ?? null, src?.id ?? null]
    );
    return id;
  }
  async function mkMilestone(userId: string, anchorId: string, sourceKind: string, sourceEntityId: string | null, earned: string) {
    await q(
      `INSERT INTO anchor_milestones (id,user_id,anchor_id,definition_id,earned_at,source_kind,source_entity_id)
       VALUES ($1,$2,$3,'test_def',$4,$5,$6)`,
      [randomUUID(), userId, anchorId, ts(earned), sourceKind, sourceEntityId]
    );
  }
  async function mkSession(userId: string, anchorId: string | null, localDateKey: string, completedAt: string) {
    await q(
      `INSERT INTO practice_sessions (id,"userId","anchorId",practice_mode,planned_duration_seconds,completed_duration_seconds,
         started_at,completed_at,guidance_voice,background_audio,updated_at,local_date_key,time_zone,utc_offset_minutes_at_completion,completion_source)
       VALUES ($1,$2,$3,'focus',60,60,$4,$4,'none','none',now(),$5,'America/New_York',-240,'live')`,
      [randomUUID(), userId, anchorId, ts(completedAt), localDateKey]
    );
  }
  const rows = async (userId: string, weekKey = WEEK) =>
    (await q(`SELECT * FROM weekly_recap_snapshots WHERE user_id=$1 AND week_key=$2`, [userId, weekKey])).rows;
  const svc = (now: string) => new WeeklyRecapService(db, () => T(now));

  // Wed Oct 21 2026: week 10-12 is long final
  const WED = '2026-10-21T15:00:00Z';

  it('a moves-only week produces a MOVES_PROGRESS recap and ignores duplicate CourseEvent annotations', async () => {
    const u = await mkUser(); const a = await mkAnchor(u); const c = await mkCourse(u, a); const w = await mkWaypoint(u, c, 1);
    const m1 = await mkMove(u, c, w, '2026-10-13T14:00:00Z', 1);
    const m2 = await mkMove(u, c, w, '2026-10-14T14:00:00Z', 2);
    const m3 = await mkMove(u, c, w, '2026-10-15T14:00:00Z', 3);
    for (const m of [m1, m2, m3]) await mkEvent(u, c, 'MOVE_COMPLETED', '2026-10-15T14:00:00Z', { type: 'move', id: m });
    const v = await svc(WED).getRecap(u, { timeZone: TZ });
    if (!v.available) throw new Error('unavailable');
    expect(v.weekKey).toBe(WEEK);
    expect(v.content.core.hero.kind).toBe('MOVES_PROGRESS');
    expect(v.content.core.stats.moves).toBe(3);
    expect(v.content.core.stats.waypoints).toBe(0);
    expect(v.content.core.headline).toMatch(/3 moves on Fitness/);
  });

  it('reconciles displayed counts to canonical rows, including moves omitted from the capped highlight list', async () => {
    const u = await mkUser(); const a = await mkAnchor(u); const c = await mkCourse(u, a); const w = await mkWaypoint(u, c, 1);
    for (let i = 0; i < 12; i++) await mkMove(u, c, w, `2026-10-1${3 + (i % 4)}T15:00:00Z`, i + 1);
    const wp = await mkWaypoint(u, c, 2, { reached: '2026-10-16T15:00:00Z' });
    await mkMove(u, c, wp, '2026-10-16T14:00:00Z', 20); // associated with the reached waypoint
    const v = await svc(WED).getRecap(u, { timeZone: TZ });
    if (!v.available) throw new Error('unavailable');
    const canonMoves = Number((await q(`SELECT count(*) FROM moves WHERE user_id=$1 AND status='COMPLETED'`, [u])).rows[0].count);
    const canonWps = Number((await q(`SELECT count(*) FROM waypoints WHERE user_id=$1 AND reached_at IS NOT NULL`, [u])).rows[0].count);
    const core = v.content.core;
    expect(core.stats.moves).toBe(canonMoves);
    expect(core.stats.waypoints).toBe(canonWps);
    const rec = core.reconciliation;
    expect(rec.listed + rec.absorbed + rec.omitted).toBe(rec.countedTotal);
    expect(rec.countedTotal).toBe(canonMoves + canonWps);
    expect(core.omittedHighlightCount).toBeGreaterThan(0);
    expect(core.highlights.find((h) => h.kind === 'WAYPOINT_REACHED')!.absorbedMoveCount).toBe(1);
  });

  it('counts a milestone that labels a counted waypoint once, via the COURSE_EVENT link', async () => {
    const u = await mkUser(); const a = await mkAnchor(u); const c = await mkCourse(u, a);
    const w = await mkWaypoint(u, c, 1, { reached: '2026-10-14T15:00:00Z' });
    const ev = await mkEvent(u, c, 'WAYPOINT_REACHED', '2026-10-14T15:00:00Z', { type: 'waypoint', id: w });
    await mkMilestone(u, a, 'COURSE_EVENT', ev, '2026-10-14T15:00:01Z');
    const v = await svc(WED).getRecap(u, { timeZone: TZ });
    if (!v.available) throw new Error('unavailable');
    expect(v.content.core.stats.waypoints).toBe(1);
    expect(v.content.core.stats.milestones).toBe(0);
    expect(v.content.core.hero.kind).toBe('WAYPOINT');
  });

  it('keeps intention completion and release distinct, and still reports archived anchors', async () => {
    const u = await mkUser();
    await mkAnchor(u, 'Calm', { completed: '2026-10-14T15:00:00Z', released: '2026-10-15T15:00:00Z', archived: '2026-10-16T15:00:00Z' });
    await mkAnchor(u, 'Gone', { released: '2026-10-15T16:00:00Z', archived: '2026-10-16T16:00:00Z' });
    const v = await svc(WED).getRecap(u, { timeZone: TZ });
    if (!v.available) throw new Error('unavailable');
    expect(v.content.core.stats.intentionsCompleted).toBe(1);
    expect(v.content.core.stats.releases).toBe(2);
    expect(v.content.core.hero.kind).toBe('INTENTION_COMPLETED');
  });

  it('does not leak another user\'s activity', async () => {
    const u = await mkUser(); const other = await mkUser();
    const a = await mkAnchor(other); const c = await mkCourse(other, a); const w = await mkWaypoint(other, c, 1);
    await mkMove(other, c, w, '2026-10-14T15:00:00Z');
    const v = await svc(WED).getRecap(u, { timeZone: TZ });
    if (!v.available) throw new Error('unavailable');
    expect(v.content.core.hero.kind).toBe('QUIET');
  });

  it('draft -> provisional refresh -> final at Tuesday noon, then immutable; feedback only after FINAL', async () => {
    const u = await mkUser(); const a = await mkAnchor(u); const c = await mkCourse(u, a); const w = await mkWaypoint(u, c, 1);
    await mkMove(u, c, w, '2026-10-13T15:00:00Z', 1);

    // Sunday 20:00 local = PREVIEW
    const prev = await svc('2026-10-19T00:00:00Z').getRecap(u, { timeZone: TZ });
    if (!prev.available) throw new Error('unavailable');
    expect(prev.phase).toBe('PREVIEW'); expect(prev.provisional).toBe(true); expect(prev.status).toBe('DRAFT');
    expect(prev.content.core.stats.moves).toBe(1);
    await expect(svc('2026-10-19T00:00:00Z').submitFeedback(u, WEEK, 'Yes')).rejects.toMatchObject({ code: 'NOT_FINAL' });

    // Late Sunday-night move syncs on Monday; Monday = PROVISIONAL, content refreshes
    await mkMove(u, c, w, '2026-10-19T02:00:00Z', 2); // Sun 22:00 local
    const mon = await svc('2026-10-19T14:00:00Z').getRecap(u, { timeZone: TZ });
    if (!mon.available) throw new Error('unavailable');
    expect(mon.phase).toBe('PROVISIONAL'); expect(mon.provisional).toBe(true);
    expect(mon.content.core.stats.moves).toBe(2);
    expect((await rows(u)).length).toBe(1);
    expect((await rows(u))[0].revision).toBeGreaterThan(1);

    // Tuesday 11:59 local still provisional; 12:00 local finalizes
    const tueAm = await svc('2026-10-20T15:59:00Z').getRecap(u, { timeZone: TZ });
    if (!tueAm.available) throw new Error('unavailable');
    expect(tueAm.phase).toBe('PROVISIONAL');
    const fin = await svc('2026-10-20T16:00:00Z').getRecap(u, { timeZone: TZ });
    if (!fin.available) throw new Error('unavailable');
    expect(fin.phase).toBe('FINAL'); expect(fin.provisional).toBe(false); expect(fin.status).toBe('FINAL');

    // Late data after finalization never changes the frozen week
    await mkMove(u, c, w, '2026-10-15T15:00:00Z', 3);
    const again = await svc('2026-10-22T10:00:00Z').getRecap(u, { timeZone: TZ });
    if (!again.available) throw new Error('unavailable');
    expect(again.content.core.stats.moves).toBe(2);
    expect(again.generatedAt).toBe(fin.generatedAt);

    await svc('2026-10-22T10:00:00Z').submitFeedback(u, WEEK, 'Mostly');
    expect((await rows(u))[0].feedback).toBe('Mostly');
    await expect(svc('2026-10-22T10:00:00Z').submitFeedback(u, WEEK, 'Maybe')).rejects.toMatchObject({ code: 'INVALID_ANSWER' });
    await expect(svc('2026-10-22T10:00:00Z').submitFeedback(u, '2026-01-05', 'Yes')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('does not write anything before the preview window opens', async () => {
    const u = await mkUser();
    const v = await svc('2026-10-18T22:00:00Z').getRecap(u, { weekKey: WEEK, timeZone: TZ }); // Sun 18:00 local
    expect(v.available).toBe(false);
    expect((await rows(u)).length).toBe(0);
  });

  it('latest-week selection: Sunday evening previews the current week, midweek serves the last completed week', async () => {
    const u = await mkUser();
    const sunEve = await svc('2026-10-18T23:30:00Z').getRecap(u, { timeZone: TZ });
    expect(sunEve.weekKey).toBe(WEEK);
    const wed = await svc(WED).getRecap(u, { timeZone: TZ });
    expect(wed.weekKey).toBe(WEEK);
    const nextWed = await svc('2026-10-28T15:00:00Z').getRecap(u, { timeZone: TZ });
    expect(nextWed.weekKey).toBe('2026-10-19');
  });

  it('locks the first generating time zone so a different device sees the same week', async () => {
    const u = await mkUser(); const a = await mkAnchor(u); const c = await mkCourse(u, a); const w = await mkWaypoint(u, c, 1);
    await mkMove(u, c, w, '2026-10-19T03:00:00Z'); // Sun 23:00 NY; already Monday in Tokyo
    const ny = await svc('2026-10-19T14:00:00Z').getRecap(u, { weekKey: WEEK, timeZone: TZ });
    const tokyo = await svc('2026-10-19T15:00:00Z').getRecap(u, { weekKey: WEEK, timeZone: 'Asia/Tokyo' });
    if (!ny.available || !tokyo.available) throw new Error('unavailable');
    expect(tokyo.timeZone).toBe(TZ);
    expect(tokyo.content.core.stats.moves).toBe(1);
    expect((await rows(u)).length).toBe(1);
  });

  it('rejects invalid time zones and non-Monday week keys', async () => {
    const u = await mkUser();
    await expect(svc(WED).getRecap(u, { timeZone: 'Mars/Olympus' })).rejects.toBeInstanceOf(RecapError);
    await expect(svc(WED).getRecap(u, { weekKey: '2026-10-13', timeZone: TZ })).rejects.toMatchObject({ code: 'INVALID_WEEK' });
  });

  it('concurrent first-generation requests create exactly one draft row', async () => {
    const u = await mkUser(); const a = await mkAnchor(u); const c = await mkCourse(u, a); const w = await mkWaypoint(u, c, 1);
    await mkMove(u, c, w, '2026-10-14T15:00:00Z');
    const res = await Promise.all(Array.from({ length: 16 }, () => svc('2026-10-19T14:00:00Z').getRecap(u, { timeZone: TZ })));
    expect(res.every((r) => r.available && r.status === 'DRAFT')).toBe(true);
    expect((await rows(u)).length).toBe(1);
  });

  it('concurrent finalization (existing draft) yields one FINAL row and identical content for every caller', async () => {
    const u = await mkUser(); const a = await mkAnchor(u); const c = await mkCourse(u, a); const w = await mkWaypoint(u, c, 1);
    await mkMove(u, c, w, '2026-10-14T15:00:00Z');
    await svc('2026-10-19T14:00:00Z').getRecap(u, { timeZone: TZ });
    const res = await Promise.all(Array.from({ length: 16 }, () => svc('2026-10-20T17:00:00Z').getRecap(u, { timeZone: TZ })));
    const r = await rows(u);
    expect(r.length).toBe(1); expect(r[0].status).toBe('FINAL');
    const contents = new Set(res.map((x) => (x.available ? JSON.stringify(x.content) : 'x')));
    expect(contents.size).toBe(1);
    expect(res.every((x) => x.available && x.status === 'FINAL')).toBe(true);
  });

  it('concurrent finalization with no prior row also yields exactly one FINAL row', async () => {
    const u = await mkUser();
    const res = await Promise.all(Array.from({ length: 16 }, () => svc(WED).getRecap(u, { timeZone: TZ })));
    expect((await rows(u)).length).toBe(1);
    expect(res.every((x) => x.available && x.status === 'FINAL')).toBe(true);
  });

  it('the database itself enforces global uniqueness and status integrity', async () => {
    const u = await mkUser();
    const ins = (status: string, fin: string | null, id = randomUUID(), scope = 'GLOBAL') =>
      q(`INSERT INTO weekly_recap_snapshots (id,user_id,scope_key,week_key,time_zone,week_start,week_end,status,content,finalized_at,updated_at)
         VALUES ($1,$2,$3,'2026-10-12','UTC',now(),now(),$4,'{}'::jsonb,$5,now())`, [id, u, scope, status, fin]);
    await ins('DRAFT', null);
    await expect(ins('DRAFT', null)).rejects.toMatchObject({ code: '23505' });
    await expect(ins('FINAL', null, randomUUID(), 'OTHER')).rejects.toMatchObject({ code: '23514' });
    await expect(ins('BOGUS', null, randomUUID(), 'OTHER2')).rejects.toMatchObject({ code: '23514' });
    await expect(q(`INSERT INTO weekly_recap_snapshots (id,user_id,scope_key,week_key,time_zone,week_start,week_end,content,updated_at)
         VALUES ($1,$2,NULL,'2026-10-12','UTC',now(),now(),'{}'::jsonb,now())`, [randomUUID(), u])).rejects.toMatchObject({ code: '23502' });
  });

  it('DST: week window is 7 local days across fall-back; boundary moves land in the correct week', async () => {
    const u = await mkUser(); const a = await mkAnchor(u); const c = await mkCourse(u, a); const w = await mkWaypoint(u, c, 1);
    await mkMove(u, c, w, '2026-11-02T04:30:00Z', 1); // Sun Nov 1 23:30 EST -> inside week 10-26
    await mkMove(u, c, w, '2026-11-02T05:30:00Z', 2); // Mon Nov 2 00:30 EST -> next week
    await mkMove(u, c, w, '2026-10-26T03:59:00Z', 3); // Sun Oct 25 23:59 EDT -> previous week
    await mkMove(u, c, w, '2026-10-26T04:00:00Z', 4); // Mon Oct 26 00:00 EDT -> inside
    const v = await svc('2026-11-04T15:00:00Z').getRecap(u, { weekKey: '2026-10-26', timeZone: TZ });
    if (!v.available) throw new Error('unavailable');
    expect(v.content.core.stats.moves).toBe(2);
    expect(v.content.core.days).toHaveLength(7);
    const row = (await rows(u, '2026-10-26'))[0];
    expect((new Date(row.week_end + 'Z').getTime() - new Date(row.week_start + 'Z').getTime()) / 3600000).toBe(169);
  });

  it('practice days come from local date keys, not UTC timestamps', async () => {
    const u = await mkUser(); const a = await mkAnchor(u);
    await mkSession(u, a, '2026-10-18', '2026-10-19T03:30:00Z'); // Sunday local, Monday UTC
    await mkSession(u, a, '2026-10-18', '2026-10-18T14:00:00Z');
    await mkSession(u, a, '2026-10-19', '2026-10-19T14:00:00Z'); // next week
    const v = await svc(WED).getRecap(u, { timeZone: TZ });
    if (!v.available) throw new Error('unavailable');
    expect(v.content.core.stats.practiceDays).toBe(1);
    expect(v.content.core.stats.sessions).toBe(2);
    expect(v.content.core.days[6]).toMatchObject({ dateKey: '2026-10-18', practiced: true });
  });

  it('historical map is VERIFIED only with no later structural change, and never fabricates progress otherwise', async () => {
    const mk = async (extraEvent: boolean) => {
      const u = await mkUser(); const a = await mkAnchor(u); const c = await mkCourse(u, a);
      const w1 = await mkWaypoint(u, c, 1, { reached: '2026-10-14T15:00:00Z', created: '2026-10-01T00:00:00Z' });
      await mkWaypoint(u, c, 2, { created: '2026-10-01T00:00:00Z' });
      await mkWaypoint(u, c, 3, { created: '2026-10-01T00:00:00Z' });
      await mkWaypoint(u, c, 4, { created: '2026-10-25T00:00:00Z' }); // added after the week: not part of that week's route
      if (extraEvent) await mkEvent(u, c, 'WAYPOINT_ADDED', '2026-10-25T00:00:00Z');
      return { u, w1 };
    };
    const ok = await mk(false);
    const v = await svc('2026-10-28T15:00:00Z').getRecap(ok.u, { weekKey: WEEK, timeZone: TZ });
    if (!v.available) throw new Error('unavailable');
    expect(v.content.map).toMatchObject({ status: 'VERIFIED', frozen: { waypointIndex: 1, waypointTotal: 3, reachedWaypointIds: [ok.w1] } });
    const bad = await mk(true);
    const v2 = await svc('2026-10-28T15:00:00Z').getRecap(bad.u, { weekKey: WEEK, timeZone: TZ });
    if (!v2.available) throw new Error('unavailable');
    expect(v2.content.map).toMatchObject({ status: 'UNVERIFIED', frozen: null });
  });

  it('lists recaps newest first with headline and feedback flag', async () => {
    const u = await mkUser();
    await svc(WED).getRecap(u, { weekKey: WEEK, timeZone: TZ });
    await svc('2026-10-28T15:00:00Z').getRecap(u, { weekKey: '2026-10-19', timeZone: TZ });
    const list = await svc('2026-10-28T15:00:00Z').listRecaps(u);
    expect(list.map((l) => l.week_key)).toEqual(['2026-10-19', WEEK]);
    expect(list[0].headline).toBe('A quiet week.');
  });
});
