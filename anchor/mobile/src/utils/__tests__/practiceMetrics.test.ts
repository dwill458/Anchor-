import {
  aggregatePracticeByDay,
  buildThreadStrengthSnapshot,
  calculateThreadStrengthScore,
  selectCanonicalPracticeEvents,
} from "../practiceMetrics";
import {
  PRACTICE_MODES,
  type PracticeMode,
  type PracticeSessionRecord,
} from "@/types/practice";

function event(
  id: string,
  mode: PracticeMode,
  completedAt: string,
  overrides: Partial<PracticeSessionRecord> = {},
): PracticeSessionRecord {
  return {
    id,
    accountId: "account-1",
    anchorId: "anchor-1",
    anchorLocalId: "anchor-1",
    anchorServerId: "anchor-1",
    practiceMode: mode,
    plannedDurationSeconds: 60,
    completedDurationSeconds: 60,
    completionStatus: "completed",
    startedAt: new Date(new Date(completedAt).getTime() - 60_000).toISOString(),
    completedAt,
    localDateKey: completedAt.slice(0, 10),
    timeZone: "UTC",
    utcOffsetMinutesAtCompletion: 0,
    completionSource: "practice_screen",
    schemaVersion: 2,
    legacyType: null,
    guidanceVoice: "none",
    backgroundAudio: "off",
    sceneSnapshot: null,
    nextAction: null,
    clientVersion: "test",
    syncState: "synced",
    ...overrides,
  };
}

describe("canonical practice metrics", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");

  it("keeps the exact four canonical modes and scopes/deduplicates by account", () => {
    expect(PRACTICE_MODES).toEqual([
      "deep_prime",
      "visualize",
      "focus",
      "release",
    ]);
    const duplicate = event("same", "deep_prime", "2026-07-21T10:00:00.000Z");
    const selected = selectCanonicalPracticeEvents(
      [
        duplicate,
        { ...duplicate },
        event("other-account", "release", "2026-07-21T11:00:00.000Z", {
          accountId: "account-2",
        }),
      ],
      "account-1",
      now,
    );
    expect(selected.map((row) => row.id)).toEqual(["same"]);
  });

  it("treats un-rebound 'legacy' entries as belonging to the signed-in account", () => {
    const selected = selectCanonicalPracticeEvents(
      [
        event("legacy-1", "deep_prime", "2026-07-20T10:00:00.000Z", {
          accountId: "legacy",
        }),
        event("other-account", "release", "2026-07-21T11:00:00.000Z", {
          accountId: "account-2",
        }),
      ],
      "account-1",
      now,
    );
    expect(selected.map((row) => row.id)).toEqual(["legacy-1"]);
  });

  it("uses the persisted local day and the latest completion to break a dominant-mode tie", () => {
    const rows = [
      event("deep", "deep_prime", "2026-07-22T01:00:00.000Z", {
        localDateKey: "2026-07-21",
      }),
      event("release", "release", "2026-07-22T02:00:00.000Z", {
        localDateKey: "2026-07-21",
      }),
    ];
    expect(aggregatePracticeByDay(rows).get("2026-07-21")).toEqual(
      expect.objectContaining({
        total: 2,
        dominantMode: "release",
        densityLevel: 2,
      }),
    );
  });

  it("uses the canonical fallback order when tied records share an incomplete timestamp", () => {
    const completedAt = "2026-07-21T23:59:59.000Z";
    const aggregate = aggregatePracticeByDay([
      event("z-focus", "focus", completedAt),
      event("a-deep", "deep_prime", completedAt),
      event("m-release", "release", completedAt),
      event("b-visualize", "visualize", completedAt),
    ]).get("2026-07-21");

    expect(aggregate).toEqual(
      expect.objectContaining({
        total: 4,
        dominantMode: "deep_prime",
        densityLevel: 4,
      }),
    );
  });

  it("keeps released-anchor history and rejects malformed future completions", () => {
    const release = event("release", "release", "2026-07-22T08:00:00.000Z", {
      anchorId: null,
      anchorLocalId: "released-local-anchor",
      anchorServerId: "released-server-anchor",
    });
    const future = event("future", "focus", "2026-07-23T12:00:00.000Z");

    expect(
      selectCanonicalPracticeEvents([release, future], "account-1", now),
    ).toEqual([release]);
  });

  it("builds 22 Monday–Sunday weeks and percentages that sum to 100", () => {
    const rows = [
      event("deep", "deep_prime", "2026-07-20T10:00:00.000Z"),
      event("visual", "visualize", "2026-07-21T10:00:00.000Z"),
      event("focus", "focus", "2026-07-22T10:00:00.000Z"),
    ];
    const snapshot = buildThreadStrengthSnapshot({
      events: rows,
      accountId: "account-1",
      dailyGoal: 3,
      sensitivity: "balanced",
      restDays: [],
      now,
    });
    expect(snapshot.heatMap).toHaveLength(22);
    expect(snapshot.heatMap.every((week) => week.length === 7)).toBe(true);
    expect(snapshot.heatMap[0][0].localDateKey).toBe("2026-02-23");
    expect(snapshot.currentWeek.map((day) => day.label)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(
      snapshot.sessionBreakdown.reduce((sum, row) => sum + row.percent, 0),
    ).toBe(100);
    expect(snapshot.todayGoal).toEqual(
      expect.objectContaining({ completed: 1, remaining: 2 }),
    );
  });
});

describe("calculateThreadStrengthScore decay", () => {
  it("never decays a consecutive daily streak, even under strict sensitivity", () => {
    const events = [
      event("d1", "deep_prime", "2026-07-01T10:00:00.000Z"),
      event("d2", "deep_prime", "2026-07-02T10:00:00.000Z"),
      event("d3", "deep_prime", "2026-07-03T10:00:00.000Z"),
    ];
    const score = calculateThreadStrengthScore(
      events,
      "2026-07-03",
      "strict",
      [],
    );
    // 50 + 40 (day1) clamps at 100 by day2 with zero missed days in between —
    // a real gap-day decay (the pre-fix bug) would have knocked 30 off here.
    expect(score).toBe(100);
  });

  it("still decays for a genuinely skipped day between sessions", () => {
    const events = [
      event("d1", "deep_prime", "2026-07-01T10:00:00.000Z"),
      // 2026-07-02 skipped
      event("d2", "deep_prime", "2026-07-03T10:00:00.000Z"),
    ];
    const score = calculateThreadStrengthScore(
      events,
      "2026-07-03",
      "strict",
      [],
    );
    // 50 + 40 = 90, then one missed day (07-02) costs 30 under strict, then +40 clamps at 100.
    expect(score).toBe(100);

    const partialEvents = [
      event("d1", "focus", "2026-07-01T10:00:00.000Z"),
      event("d2", "focus", "2026-07-03T10:00:00.000Z"),
    ];
    const partialScore = calculateThreadStrengthScore(
      partialEvents,
      "2026-07-03",
      "strict",
      [],
    );
    // 50 + 25 = 75, minus 30 for the one skipped day, plus 25 = 70.
    expect(partialScore).toBe(70);
  });

  it("does not decay the still-in-progress current day when there is no session yet today", () => {
    const events = [event("d1", "deep_prime", "2026-07-01T10:00:00.000Z")];
    const score = calculateThreadStrengthScore(
      events,
      "2026-07-02",
      "strict",
      [],
    );
    // Only one calendar day has elapsed since the last practice (today is
    // still in progress), so there is no fully-missed day yet.
    expect(score).toBe(90);
  });
});
