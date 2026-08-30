import { renderHook } from "@testing-library/react-native";

import { useThreadHistory } from "../useThreadHistory";
import { useSessionStore } from "@/stores/sessionStore";
import { useAuthStore } from '@/stores/authStore';
import type { PracticeMode, PracticeSessionRecord } from '@/types/practice';

describe("useThreadHistory Visualize integration", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    useAuthStore.setState({ user: { id: 'account-1' } as any });
  });

  it("keeps Visualize separate from Focus and Deep Prime in totals and daily history", () => {
    const now = new Date();
    const entry = (
      id: string,
      practiceMode: PracticeMode,
      offsetSeconds: number,
    ): PracticeSessionRecord => {
      const completedAt = new Date(now.getTime() + offsetSeconds * 1000).toISOString();
      return {
        id,
        accountId: 'account-1',
        anchorId: "anchor-1",
        anchorLocalId: 'anchor-1', anchorServerId: 'anchor-1', practiceMode,
        plannedDurationSeconds: 60, completedDurationSeconds: 60,
        completionStatus: 'completed', startedAt: completedAt, completedAt,
        localDateKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
        timeZone: 'UTC', utcOffsetMinutesAtCompletion: 0,
        completionSource: 'practice_screen', schemaVersion: 2, legacyType: null,
        guidanceVoice: 'none', backgroundAudio: 'off', sceneSnapshot: null,
        nextAction: null, clientVersion: 'test', syncState: 'synced',
      };
    };

    useSessionStore.setState({
      practiceHistory: [
        entry("visualize-1", "visualize", 20),
        entry("deep-1", "deep_prime", 10),
        entry("focus-1", "focus", 0),
        entry("release-1", "release", 30),
      ],
    });

    const { result } = renderHook(() => useThreadHistory());
    expect(result.current.totalSessions).toBe(4);
    expect(result.current.focusCount).toBe(1);
    expect(result.current.deepCount).toBe(1);
    expect(result.current.visualizeCount).toBe(1);
    expect(result.current.releaseCount).toBe(1);
    expect(result.current.weeks.flat().find((day) => day.isToday)).toEqual(
      expect.objectContaining({
        focusCount: 1,
        deepCount: 1,
        visualizeCount: 1,
        releaseCount: 1,
      }),
    );
    expect(
      result.current.currentWeekDays.find((day) => day.isToday)?.hasVisualize,
    ).toBe(true);
  });
});
