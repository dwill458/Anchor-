import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore, type SessionLogEntry } from '@/stores/sessionStore';
import {
  REVIEW_STORAGE_KEYS,
  shouldRequestReview,
  type ReviewEligibilityContext,
} from '@/services/reviewPromptService';

const storage = new Map<string, string>();
const now = new Date('2026-06-27T12:00:00.000Z');

const makeAnchor = (id: string) => ({
  id,
  localId: id,
  intentionText: 'Stay steady',
  category: 'focus',
  baseSigilSvg: '<svg />',
  createdAt: now,
  updatedAt: now,
});

const makeSession = (
  id: string,
  completedAt: string,
  type: SessionLogEntry['type'] = 'activate'
): SessionLogEntry => ({
  id,
  anchorId: 'anchor-1',
  type,
  durationSeconds: 30,
  mode: 'ambient',
  completedAt,
});

const seedProgress = ({
  anchorCount = 0,
  sessions = [],
}: {
  anchorCount?: number;
  sessions?: SessionLogEntry[];
}) => {
  useAnchorStore.setState({
    anchors: Array.from({ length: anchorCount }, (_, index) => makeAnchor(`anchor-${index + 1}`)) as any,
  });
  useSessionStore.setState({
    sessionLog: sessions,
    primingHistory: sessions.map((session) => ({
      id: session.id,
      anchorId: session.anchorId,
      type: session.type === 'reinforce' ? 'reinforce' : 'activate',
      completedAt: session.completedAt,
      localDate: session.completedAt.slice(0, 10),
      weekKey: '2026-W26',
      weekStart: '2026-06-22',
      weekdayIndex: 0,
      hourOfDay: 12,
      timeOfDay: 'afternoon',
    })),
    totalSessionsCount: sessions.length,
  } as any);
};

const expectEligible = (context: ReviewEligibilityContext = {}) =>
  shouldRequestReview({ now, ...context });

describe('reviewPromptService.shouldRequestReview', () => {
  beforeEach(() => {
    storage.clear();
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(storage.get(key) ?? null)
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    });
    seedProgress({ anchorCount: 0, sessions: [] });
  });

  it('does not allow a new user', async () => {
    await expect(expectEligible()).resolves.toBe(false);
  });

  it('does not allow a user with one anchor and fewer than three Focus Sessions', async () => {
    seedProgress({
      anchorCount: 1,
      sessions: [
        makeSession('session-1', '2026-06-26T12:00:00.000Z'),
        makeSession('session-2', '2026-06-27T12:00:00.000Z'),
      ],
    });

    await expect(expectEligible()).resolves.toBe(false);
  });

  it('allows a user with one anchor, three Focus Sessions, and two unique practice days', async () => {
    seedProgress({
      anchorCount: 1,
      sessions: [
        makeSession('session-1', '2026-06-25T12:00:00.000Z'),
        makeSession('session-2', '2026-06-26T12:00:00.000Z'),
        makeSession('session-3', '2026-06-26T13:00:00.000Z'),
      ],
    });

    await expect(expectEligible()).resolves.toBe(true);
  });

  it('does not allow a user prompted within ninety days', async () => {
    seedProgress({
      anchorCount: 1,
      sessions: [
        makeSession('session-1', '2026-06-25T12:00:00.000Z'),
        makeSession('session-2', '2026-06-26T12:00:00.000Z'),
        makeSession('session-3', '2026-06-26T13:00:00.000Z'),
      ],
    });
    storage.set(REVIEW_STORAGE_KEYS.lastPromptAttemptAt, '2026-06-01T12:00:00.000Z');

    await expect(expectEligible()).resolves.toBe(false);
  });

  it('does not allow a user with a recent failed session', async () => {
    seedProgress({
      anchorCount: 1,
      sessions: [
        makeSession('session-1', '2026-06-25T12:00:00.000Z'),
        makeSession('session-2', '2026-06-26T12:00:00.000Z'),
        makeSession('session-3', '2026-06-26T13:00:00.000Z'),
      ],
    });

    await expect(expectEligible({ recentSessionFailed: true })).resolves.toBe(false);
  });

  it('does not allow a user when the completed Focus Session is not returning home', async () => {
    seedProgress({
      anchorCount: 1,
      sessions: [
        makeSession('session-1', '2026-06-25T12:00:00.000Z'),
        makeSession('session-2', '2026-06-26T12:00:00.000Z'),
        makeSession('session-3', '2026-06-26T13:00:00.000Z'),
      ],
    });

    await expect(
      expectEligible({ isReturningToHomeAfterFocusSession: false })
    ).resolves.toBe(false);
  });

  it.each([
    ['onboarding', { isOnboarding: true }],
    ['paywall', { isPaywall: true }],
    ['anchor creation', { isAnchorCreation: true }],
    ['active Focus Session', { isActiveFocusSession: true }],
    ['active Deep Prime session', { isActiveDeepPrimeSession: true }],
  ])('does not allow a user inside %s', async (_label, context) => {
    seedProgress({
      anchorCount: 1,
      sessions: [
        makeSession('session-1', '2026-06-25T12:00:00.000Z'),
        makeSession('session-2', '2026-06-26T12:00:00.000Z'),
        makeSession('session-3', '2026-06-26T13:00:00.000Z'),
      ],
    });

    await expect(expectEligible(context)).resolves.toBe(false);
  });
});
