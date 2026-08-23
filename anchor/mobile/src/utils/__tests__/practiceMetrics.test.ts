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

describe("calculateThreadStrengthScore V2", () => {
  it("starts at 0 for new anchors and increases with base gains and diminishing returns", () => {
    // Session 1: Deep Prime (+18) -> score 18
    const events = [event("d1", "deep_prime", "2026-07-01T10:00:00.000Z")];
    const score1 = calculateThreadStrengthScore(events, "2026-07-01", "balanced", []);
    expect(score1).toBe(18);

    // Session 2 on Day 2: Deep Prime (pre-session 18 -> multiplier 1.0, 1st session of day -> 1.0) -> +18 -> score 36
    const events2 = [
      ...events,
      event("d2", "deep_prime", "2026-07-02T10:00:00.000Z"),
    ];
    const score2 = calculateThreadStrengthScore(events2, "2026-07-02", "balanced", []);
    expect(score2).toBe(36);
  });

  it("applies same-day diminishing return multipliers", () => {
    const events = [
      event("d1", "focus", "2026-07-01T08:00:00.000Z"), // 1st: 12 * 1.0 = 12 (pre-strength 0)
      event("d2", "focus", "2026-07-01T12:00:00.000Z"), // 2nd: 12 * 1.0 * 0.50 = 6 (pre-strength 12)
      event("d3", "focus", "2026-07-01T16:00:00.000Z"), // 3rd: 12 * 1.0 * 0.25 = 3 (pre-strength 18)
      event("d4", "focus", "2026-07-01T20:00:00.000Z"), // 4th+: 0
    ];
    const score = calculateThreadStrengthScore(events, "2026-07-01", "balanced", []);
    expect(score).toBe(12 + 6 + 3); // 21
  });

  it("never decays on consecutive daily streak under strict sensitivity", () => {
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
    // Day 1: 18
    // Day 2: 18 + round(18 * 1.0) = 36
    // Day 3: 36 + round(18 * 0.80) = 36 + 14 = 50
    expect(score).toBe(50);
  });

  it("applies prospective sensitivity and rest-day settings without altering past decay", () => {
    // 2026-07-01: practice (+18) -> 18
    // 2026-07-02: skipped (missedDayIndex 0: Balanced -> 0 decay)
    // 2026-07-03: skipped (missedDayIndex 1: Balanced -> -4 decay) -> 14
    // 2026-07-04: sensitivity changed to Strict at noon.
    // 2026-07-04: skipped (missedDayIndex 2: Strict -> -8 decay) -> 6
    const events = [event("d1", "deep_prime", "2026-07-01T10:00:00.000Z")];
    const score = calculateThreadStrengthScore(
      events,
      "2026-07-05",
      "strict",
      [],
      {
        sensitivityHistory: [
          { sensitivity: "balanced", effectiveAt: "2026-07-01T00:00:00.000Z" },
          { sensitivity: "strict", effectiveAt: "2026-07-04T12:00:00.000Z" },
        ],
      }
    );
    // 07-02 (Balanced, day 0): decay 0 -> 18
    // 07-03 (Balanced, day 1): decay 4 -> 14
    // 07-04 (Strict, day 2): decay 6 -> 8
    expect(score).toBe(8);
  });

  it("calculates per-anchor thread strength independently", () => {
    const events = [
      event("a1", "focus", "2026-07-01T10:00:00.000Z", { anchorId: "anchor-A" }),
      event("b1", "deep_prime", "2026-07-01T11:00:00.000Z", { anchorId: "anchor-B" }),
    ];
    const { calculateAnchorThreadStrength } = require("../practiceMetrics");
    const resultA = calculateAnchorThreadStrength({
      events,
      anchorId: "anchor-A",
      now: new Date("2026-07-01T12:00:00.000Z"),
    });
    const resultB = calculateAnchorThreadStrength({
      events,
      anchorId: "anchor-B",
      now: new Date("2026-07-01T12:00:00.000Z"),
    });

    expect(resultA.score).toBe(12);
    expect(resultB.score).toBe(18);
  });

  it("respects migration baselines and durable memory floors", () => {
    const { createThreadStrengthV2Baseline } = require("../practiceMetrics");
    const baseline = createThreadStrengthV2Baseline({
      anchorId: "anchor-legacy",
      startingScore: 75,
      effectiveAt: "2026-07-01T00:00:00.000Z",
      highestStageReached: "tempered",
    });

    // Starting at 75 (tempered floor 30). With 20 missed days under strict, it will clamp to 30.
    const score = calculateThreadStrengthScore(
      [],
      "2026-07-21",
      "strict",
      [],
      { baseline }
    );
    expect(score).toBe(30);
  });
});
