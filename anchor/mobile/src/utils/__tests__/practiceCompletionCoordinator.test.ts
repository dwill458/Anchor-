import { calculatePracticeCompleteResult } from '../practiceCompletionCoordinator';
import type { PracticeSessionRecord } from '@/types/practice';

const makeSession = (
  id: string,
  anchorId: string,
  practiceMode: 'focus' | 'visualize' | 'deep_prime' | 'release',
  localDateKey: string,
  completedAt: string,
): PracticeSessionRecord => ({
  id,
  accountId: 'test-account',
  anchorId,
  anchorLocalId: anchorId,
  anchorServerId: anchorId,
  practiceMode,
  plannedDurationSeconds: 60,
  completedDurationSeconds: 60,
  completionStatus: 'completed',
  startedAt: new Date(new Date(completedAt).getTime() - 60000).toISOString(),
  completedAt,
  localDateKey,
  timeZone: 'UTC',
  utcOffsetMinutesAtCompletion: 0,
  completionSource: 'practice_screen',
  schemaVersion: 1,
  legacyType: null,
  guidanceVoice: 'none',
  backgroundAudio: 'off',
  sceneSnapshot: null,
  nextAction: null,
  clientVersion: '1.5.0',
  syncState: 'synced',
});

describe('practiceCompletionCoordinator', () => {
  const anchorId = 'anchor-1';
  const today = '2026-05-10';
  const now = new Date('2026-05-10T12:00:00.000Z');

  it('calculates first practice result correctly when an anchor has no prior history', () => {
    const newSession = makeSession(
      'session-1',
      anchorId,
      'focus',
      today,
      '2026-05-10T12:00:00.000Z',
    );

    const result = calculatePracticeCompleteResult({
      anchorId,
      practiceMode: 'focus',
      practiceHistory: [newSession],
      accountId: 'test-account',
      completedSessionId: 'session-1',
      newRecord: newSession,
      now,
    });

    expect(result.isFirstPractice).toBe(true);
    expect(result.previousThreadStrength).toBe(0);
    // Focus base gain from 0 is 12
    expect(result.newThreadStrength).toBe(12);
    expect(result.previousStage).toBe('Nascent');
    expect(result.newStage).toBe('Nascent');
    expect(result.didCrossStage).toBe(false);
  });

  it('calculates returning practice result and detects stage crossing', () => {
    const priorSession = makeSession(
      'session-0',
      anchorId,
      'focus',
      '2026-05-09',
      '2026-05-09T12:00:00.000Z',
    );
    const newSession = makeSession(
      'session-1',
      anchorId,
      'deep_prime',
      today,
      '2026-05-10T12:00:00.000Z',
    );

    const result = calculatePracticeCompleteResult({
      anchorId,
      practiceMode: 'deep_prime',
      practiceHistory: [priorSession, newSession],
      accountId: 'test-account',
      completedSessionId: 'session-1',
      newRecord: newSession,
      now,
    });

    expect(result.isFirstPractice).toBe(false);
    // Previous session: 12 (Nascent)
    expect(result.previousThreadStrength).toBe(12);
    // New session: 12 + 18 = 30 (Kindling)
    expect(result.newThreadStrength).toBe(30);
    expect(result.previousStage).toBe('Nascent');
    expect(result.newStage).toBe('Kindling');
    expect(result.didCrossStage).toBe(true);
  });

  it('detects no stage transition when scores stay within stage boundaries', () => {
    const priorSession1 = makeSession(
      'session-0',
      anchorId,
      'focus',
      '2026-05-09',
      '2026-05-09T10:00:00.000Z',
    );
    const newSession = makeSession(
      'session-1',
      anchorId,
      'focus',
      '2026-05-09',
      '2026-05-09T12:00:00.000Z',
    );

    const result = calculatePracticeCompleteResult({
      anchorId,
      practiceMode: 'focus',
      practiceHistory: [priorSession1, newSession],
      accountId: 'test-account',
      completedSessionId: 'session-1',
      newRecord: newSession,
      now,
    });

    expect(result.isFirstPractice).toBe(false);
    expect(result.previousThreadStrength).toBe(12);
    expect(result.newThreadStrength).toBe(18); // 12 + 6
    expect(result.previousStage).toBe('Nascent');
    expect(result.newStage).toBe('Nascent');
    expect(result.didCrossStage).toBe(false);
  });

  it('only considers events for the specified anchor', () => {
    const otherAnchorSession = makeSession(
      'session-other',
      'anchor-other',
      'deep_prime',
      '2026-05-09',
      '2026-05-09T12:00:00.000Z',
    );
    const newSession = makeSession(
      'session-1',
      anchorId,
      'focus',
      today,
      '2026-05-10T12:00:00.000Z',
    );

    const result = calculatePracticeCompleteResult({
      anchorId,
      practiceMode: 'focus',
      practiceHistory: [otherAnchorSession, newSession],
      accountId: 'test-account',
      completedSessionId: 'session-1',
      newRecord: newSession,
      now,
    });

    expect(result.isFirstPractice).toBe(true);
    expect(result.previousThreadStrength).toBe(0);
    expect(result.newThreadStrength).toBe(12);
  });
});
