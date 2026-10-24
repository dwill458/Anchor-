/**
 * Plain parameterised SQL for the Weekly Recap read-model.
 *
 * Kept as text so the exact same statements run through Prisma ($queryRawUnsafe) in
 * production and through `pg` in the real-PostgreSQL integration tests.
 * All Prisma timestamp columns are `timestamp without time zone` holding UTC, so window
 * parameters are converted with `AT TIME ZONE 'UTC'`.
 */

const WIN_START = `($2::timestamptz AT TIME ZONE 'UTC')`;
const WIN_END = `($3::timestamptz AT TIME ZONE 'UTC')`;
const ISO = (col: string) => `to_char(${col}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/** $1 userId, $2 window start (ISO), $3 window end (ISO). Canonical rows only. */
export const CANDIDATES_SQL = `
SELECT 'WAYPOINT_REACHED' AS kind, w.id AS entity_id, NULL::text AS entity_kind, NULL::text AS annotates_id,
       'WAYPOINT_ROW' AS origin, ${ISO('w.reached_at')} AS occurred_at, c.anchor_id AS anchor_id,
       a."intentionText" AS anchor_title, w.title::text AS title, NULL::text AS waypoint_id, c.id AS course_id
  FROM waypoints w
  JOIN courses c ON c.id = w.course_id
  LEFT JOIN anchors a ON a.id = c.anchor_id
 WHERE w.user_id = $1 AND w.reached_at >= ${WIN_START} AND w.reached_at < ${WIN_END} AND w.cancelled_at IS NULL
UNION ALL
SELECT 'MOVE_COMPLETED', m.id, NULL, NULL, 'MOVE_ROW', ${ISO('m.completed_at')}, c.anchor_id,
       a."intentionText", m.title::text, m.waypoint_id, c.id
  FROM moves m
  JOIN courses c ON c.id = m.course_id
  LEFT JOIN anchors a ON a.id = c.anchor_id
 WHERE m.user_id = $1 AND m.status = 'COMPLETED' AND m.completed_at >= ${WIN_START} AND m.completed_at < ${WIN_END}
UNION ALL
SELECT 'DESTINATION_REACHED', c.id, NULL, NULL, 'OTHER', ${ISO('c.completed_at')}, c.anchor_id,
       a."intentionText", c.destination_text::text, NULL, c.id
  FROM courses c
  LEFT JOIN anchors a ON a.id = c.anchor_id
 WHERE c.user_id = $1 AND c.status = 'COMPLETED' AND c.completed_at >= ${WIN_START} AND c.completed_at < ${WIN_END}
UNION ALL
SELECT 'INTENTION_COMPLETED', a.id, NULL, NULL, 'OTHER', ${ISO('a.intention_completed_at')}, a.id,
       a."intentionText", a."intentionText", NULL, NULL
  FROM anchors a
 WHERE a."userId" = $1 AND a.intention_completed_at >= ${WIN_START} AND a.intention_completed_at < ${WIN_END}
UNION ALL
SELECT 'ANCHOR_RELEASED', a.id, NULL, NULL, 'OTHER', ${ISO('a.released_at')}, a.id,
       a."intentionText", a."intentionText", NULL, NULL
  FROM anchors a
 WHERE a."userId" = $1 AND a.released_at >= ${WIN_START} AND a.released_at < ${WIN_END}
UNION ALL
SELECT 'MILESTONE_EARNED', am.id,
       CASE WHEN am.source_kind = 'COURSE_EVENT' THEN lower(ce.source_entity_type)
            WHEN am.source_kind = 'ANCHOR_LIFECYCLE' THEN 'intention' END,
       CASE WHEN am.source_kind = 'COURSE_EVENT' THEN ce.source_entity_id
            WHEN am.source_kind = 'ANCHOR_LIFECYCLE' THEN am.anchor_id END,
       'OTHER', ${ISO('am.earned_at')}, am.anchor_id, a."intentionText", NULL, NULL, NULL
  FROM anchor_milestones am
  LEFT JOIN course_events ce ON am.source_kind = 'COURSE_EVENT' AND ce.id = am.source_entity_id
  LEFT JOIN anchors a ON a.id = am.anchor_id
 WHERE am.user_id = $1 AND am.earned_at >= ${WIN_START} AND am.earned_at < ${WIN_END}
`;

/** $1 userId, $2 first local date key, $3 last local date key (inclusive). */
export const SESSIONS_SQL = `
SELECT local_date_key
  FROM practice_sessions
 WHERE "userId" = $1 AND local_date_key >= $2 AND local_date_key <= $3 AND lower(completion_status) = 'completed'
`;

/** $1 courseId, $2 week end (ISO). Structural route changes after the week ended. */
export const STRUCTURAL_AFTER_SQL = `
SELECT count(*)::int AS n
  FROM course_events
 WHERE course_id = $1
   AND occurred_at >= ($2::timestamptz AT TIME ZONE 'UTC')
   AND event_type::text IN ('WAYPOINT_ADDED','WAYPOINT_REORDERED','DESTINATION_CHANGED','WAYPOINT_CANCELLED','ROUTE_ADJUSTED','COURSE_ARCHIVED','COURSE_RESTORED')
`;

/** $1 courseId, $2 week end (ISO). Route state as of the end of the week. */
export const MAP_STATE_SQL = `
SELECT w.id,
       (w.reached_at IS NOT NULL AND w.reached_at < ($2::timestamptz AT TIME ZONE 'UTC')) AS reached
  FROM waypoints w
 WHERE w.course_id = $1 AND w.cancelled_at IS NULL AND w.created_at < ($2::timestamptz AT TIME ZONE 'UTC')
 ORDER BY w.position
`;

export const SELECT_ROW_SQL = `
SELECT id, user_id, scope_key, week_key, time_zone, status, content_version, content, revision,
       ${ISO('generated_at')} AS generated_at, ${ISO('finalized_at')} AS finalized_at, feedback
  FROM weekly_recap_snapshots
 WHERE user_id = $1 AND scope_key = $2 AND week_key = $3
`;

const RETURNING = `RETURNING id, user_id, scope_key, week_key, time_zone, status, content_version, content, revision,
       ${ISO('generated_at')} AS generated_at, ${ISO('finalized_at')} AS finalized_at, feedback`;

/** $1 id, $2 user, $3 scope, $4 weekKey, $5 tz, $6 start, $7 end, $8 status, $9 contentJson, $10 finalizedAt|null */
export const INSERT_ROW_SQL = `
INSERT INTO weekly_recap_snapshots
  (id, user_id, scope_key, week_key, time_zone, week_start, week_end, status, content, finalized_at, updated_at)
VALUES ($1, $2, $3, $4, $5, ($6::timestamptz AT TIME ZONE 'UTC'), ($7::timestamptz AT TIME ZONE 'UTC'),
        $8, $9::jsonb, ($10::timestamptz AT TIME ZONE 'UTC'), CURRENT_TIMESTAMP)
ON CONFLICT (user_id, scope_key, week_key) DO NOTHING
${RETURNING}
`;

/** Compare-and-set refresh of a DRAFT. $1 id, $2 expected revision, $3 contentJson */
export const UPDATE_DRAFT_SQL = `
UPDATE weekly_recap_snapshots
   SET content = $3::jsonb, revision = revision + 1, generated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
 WHERE id = $1 AND status = 'DRAFT' AND revision = $2
${RETURNING}
`;

/** Compare-and-set DRAFT -> FINAL. $1 id, $2 expected revision, $3 contentJson, $4 finalizedAt */
export const FINALIZE_SQL = `
UPDATE weekly_recap_snapshots
   SET status = 'FINAL', content = $3::jsonb, revision = revision + 1,
       finalized_at = ($4::timestamptz AT TIME ZONE 'UTC'), generated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
 WHERE id = $1 AND status = 'DRAFT' AND revision = $2
${RETURNING}
`;

/** FINAL only. $1 user, $2 scope, $3 weekKey, $4 answer */
export const FEEDBACK_SQL = `
UPDATE weekly_recap_snapshots
   SET feedback = $4, feedback_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
 WHERE user_id = $1 AND scope_key = $2 AND week_key = $3 AND status = 'FINAL'
${RETURNING}
`;

/** $1 user, $2 scope, $3 limit */
export const LIST_SQL = `
SELECT week_key, time_zone, status, content->'core'->>'headline' AS headline,
       content->'core'->'hero'->>'kind' AS hero_kind, feedback IS NOT NULL AS has_feedback
  FROM weekly_recap_snapshots
 WHERE user_id = $1 AND scope_key = $2
 ORDER BY week_key DESC
 LIMIT $3
`;
