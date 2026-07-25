import { renderHook } from "@testing-library/react-native";

import { useThreadHistory } from "../useThreadHistory";
import { useSessionStore } from "@/stores/sessionStore";
import { buildPrimingHistoryEntry } from "@/utils/primingAnalytics";

describe("useThreadHistory Visualize integration", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it("keeps Visualize separate from Focus and Deep Prime in totals and daily history", () => {
    const now = new Date();
    const entry = (
      id: string,
      type: "activate" | "reinforce" | "visualize",
      offsetSeconds: number,
    ) =>
      buildPrimingHistoryEntry({
        id,
        anchorId: "anchor-1",
        type,
        completedAt: new Date(
          now.getTime() + offsetSeconds * 1000,
        ).toISOString(),
      })!;

    useSessionStore.setState({
      primingHistory: [
        entry("visualize-1", "visualize", 20),
        entry("deep-1", "reinforce", 10),
        entry("focus-1", "activate", 0),
      ],
    });

    const { result } = renderHook(() => useThreadHistory());
    expect(result.current.totalSessions).toBe(3);
    expect(result.current.focusCount).toBe(1);
    expect(result.current.deepCount).toBe(1);
    expect(result.current.visualizeCount).toBe(1);
    expect(result.current.weeks.flat().find((day) => day.isToday)).toEqual(
      expect.objectContaining({
        focusCount: 1,
        deepCount: 1,
        visualizeCount: 1,
      }),
    );
    expect(
      result.current.currentWeekDays.find((day) => day.isToday)?.hasVisualize,
    ).toBe(true);
  });
});
