-- Numeric-only summary for the isolated Anchor PERF LAB trace.
-- The only process matched in every section is the exact package below.
INCLUDE PERFETTO MODULE slices.with_context;
INCLUDE PERFETTO MODULE android.frames.timeline;

-- Thread codes: 0 other/unknown, 1 main (Trace Processor flag), 2 mqt_js,
-- 3 mqt_native_modules, 4 RenderThread, 5 Jit thread pool,
-- 6 HeapTaskDaemon. Raw thread/slice names are never selected for output.
WITH app_slices AS (
  SELECT
    CASE
      WHEN is_main_thread = 1 THEN 1
      WHEN thread_name = 'main' THEN 1
      WHEN thread_name = 'mqt_js' THEN 2
      WHEN thread_name = 'mqt_native_modules' THEN 3
      WHEN thread_name = 'RenderThread' THEN 4
      WHEN thread_name = 'Jit thread pool' THEN 5
      WHEN thread_name = 'HeapTaskDaemon' THEN 6
      ELSE 0
    END AS thread_code,
    dur
  FROM thread_slice
  WHERE process_name = 'com.anchorintentions.perflab20261012'
    AND dur >= 0
)
SELECT
  thread_code,
  COUNT(*) AS slice_count,
  ROUND(SUM(dur) / 1000000.0, 3) AS inclusive_duration_sum_ms,
  ROUND(AVG(dur) / 1000000.0, 3) AS inclusive_duration_mean_ms,
  ROUND(MAX(dur) / 1000000.0, 3) AS inclusive_duration_max_ms
FROM app_slices
GROUP BY thread_code
ORDER BY thread_code;

-- FrameTimeline rows are present only when the device/trace captured them.
-- Kind 1 is expected-frame duration; kind 2 is actual-frame duration.
WITH app_frames AS (
  SELECT 1 AS frame_kind_code, f.dur
  FROM expected_frame_timeline_slice AS f
  JOIN process AS p ON p.upid = f.upid
  WHERE p.name = 'com.anchorintentions.perflab20261012'
    AND f.dur >= 0
  UNION ALL
  SELECT 2 AS frame_kind_code, f.dur
  FROM actual_frame_timeline_slice AS f
  JOIN process AS p ON p.upid = f.upid
  WHERE p.name = 'com.anchorintentions.perflab20261012'
    AND f.dur >= 0
),
frame_kinds AS (
  SELECT 1 AS frame_kind_code
  UNION ALL
  SELECT 2 AS frame_kind_code
)
SELECT
  k.frame_kind_code,
  COUNT(f.dur) AS frame_count,
  ROUND(SUM(f.dur) / 1000000.0, 3) AS duration_sum_ms,
  ROUND(AVG(f.dur) / 1000000.0, 3) AS duration_mean_ms,
  ROUND(MAX(f.dur) / 1000000.0, 3) AS duration_max_ms
FROM frame_kinds AS k
LEFT JOIN app_frames AS f USING (frame_kind_code)
GROUP BY k.frame_kind_code
ORDER BY k.frame_kind_code;

-- sched_slice has rows only when scheduler events were captured.
-- Durations here are scheduled CPU execution time.
WITH app_sched AS (
  SELECT
    CASE
      WHEN t.is_main_thread = 1 THEN 1
      WHEN t.name = 'main' THEN 1
      WHEN t.name = 'mqt_js' THEN 2
      WHEN t.name = 'mqt_native_modules' THEN 3
      WHEN t.name = 'RenderThread' THEN 4
      WHEN t.name = 'Jit thread pool' THEN 5
      WHEN t.name = 'HeapTaskDaemon' THEN 6
      ELSE 0
    END AS thread_code,
    s.cpu,
    s.dur
  FROM sched_slice AS s
  JOIN thread AS t ON t.utid = s.utid
  JOIN process AS p ON p.upid = t.upid
  WHERE p.name = 'com.anchorintentions.perflab20261012'
    AND s.dur >= 0
)
SELECT
  thread_code,
  cpu,
  COUNT(*) AS scheduled_slice_count,
  ROUND(SUM(dur) / 1000000.0, 3) AS scheduled_duration_sum_ms,
  ROUND(AVG(dur) / 1000000.0, 3) AS scheduled_duration_mean_ms,
  ROUND(MAX(dur) / 1000000.0, 3) AS scheduled_duration_max_ms
FROM app_sched
GROUP BY thread_code, cpu
ORDER BY thread_code, cpu;
