import { createMockAnchor, createMockUser } from '@/__tests__/utils/testUtils';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { saveAnchorSnapshot, saveProfileSnapshot, saveSessionSnapshot } from '../UserLocalStateService';

const mockApiGet = jest.fn();
const mockFetchCompleteProfile = jest.fn();

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
  fetchCompleteProfile: (...args: unknown[]) => mockFetchCompleteProfile(...args),
}));

import AuthHydrationService from '../AuthHydrationService';

describe('AuthHydrationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAnchorStore.getState().clearAnchors();
    useProfileStore.getState().resetProfile();
    useSessionStore.setState({
      lastSession: null,
      todayPractice: { date: '2026-05-18', sessionsCount: 0, totalSeconds: 0 },
      weeklyPractice: { weekKey: '2026-W21', sessionsCount: 0, totalSeconds: 0 },
      lastGraceDayUsedAt: null,
      sessionLog: [],
      threadStrength: 50,
      totalSessionsCount: 0,
      lastPrimedAt: null,
      weekHistory: [false, false, false, false, false, false, false],
      weekHistoryKey: '2026-W21',
      primingHistory: [],
      journeyWeekStart: null,
      lastDecayDate: null,
    } as any);
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasCompletedOnboarding: false,
      profileData: null,
      profileLastFetched: null,
      pendingFirstAnchorDraft: null,
      pendingFirstAnchorMutations: [],
      isFinalizingPendingFirstAnchor: false,
      pendingFirstAnchorError: null,
      isOfflineMode: false,
    } as any);
    useSettingsStore.setState({
      focusSessionMode: 'quick',
      focusSessionDuration: 30,
      focusSessionAudio: 'silent',
      primeSessionDuration: 120,
      primeSessionAudio: 'silent',
    } as any);
  });

  it('preserves unsynced local temp anchors during authenticated hydration', async () => {
    const localTempAnchor = createMockAnchor({
      id: 'anchor-1779092632674',
      updatedAt: new Date('2026-05-18T08:00:00.000Z'),
    });
    const remoteAnchor = createMockAnchor({
      id: 'server-anchor-1',
      updatedAt: new Date('2026-05-18T08:10:00.000Z'),
    });
    const activatedAt = new Date().toISOString();

    useAnchorStore.getState().setAnchors([localTempAnchor]);

    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/api/anchors') {
        return {
          data: {
            data: [remoteAnchor],
          },
        };
      }

      if (url === '/api/auth/me/export') {
        return {
          data: {
            data: {
              account: {
                activations: [
                  {
                    id: 'activation-1',
                    anchorId: remoteAnchor.id,
                    activationType: 'visual',
                    durationSeconds: 30,
                    activatedAt,
                  },
                ],
              },
            },
          },
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });
    mockFetchCompleteProfile.mockResolvedValue({
      user: createMockUser({
        settings: {
          userId: 'user-1',
          notificationsEnabled: true,
          dailyReminderTime: '09:00',
          streakProtection: true,
          defaultChargeDuration: 300,
          focusSessionMode: 'deep',
          focusSessionDuration: 60,
          focusSessionAudio: 'ambient',
          primeSessionDuration: 300,
          primeSessionAudio: 'ambient',
          hapticIntensity: 3,
          vaultViewType: 'grid',
          updatedAt: new Date(),
        },
      }),
      stats: {},
      activeAnchors: [],
    });

    await AuthHydrationService.hydrateAuthenticatedData();

    expect(useAnchorStore.getState().anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'server-anchor-1' }),
        expect.objectContaining({ id: 'anchor-1779092632674' }),
      ])
    );
    expect(useSessionStore.getState().primingHistory).toHaveLength(1);
    expect(useSessionStore.getState().lastPrimedAt).toBe(
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
    );
    expect(useSessionStore.getState().weekHistory.some(Boolean)).toBe(true);
    expect(useSettingsStore.getState().focusSessionMode).toBe('deep');
    expect(useSettingsStore.getState().focusSessionDuration).toBe(60);
    expect(useSettingsStore.getState().focusSessionAudio).toBe('ambient');
    expect(useSettingsStore.getState().primeSessionDuration).toBe(300);
    expect(useSettingsStore.getState().primeSessionAudio).toBe('ambient');
  });

  it('hydrates profile and anchors when account export fails', async () => {
    const remoteAnchor = createMockAnchor({
      id: 'server-anchor-2',
      updatedAt: new Date('2026-05-18T08:10:00.000Z'),
    });
    const user = createMockUser({
      hasCompletedOnboarding: true,
      totalActivations: 17,
      currentStreak: 3,
    });

    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/api/anchors') {
        return {
          data: {
            data: [remoteAnchor],
          },
        };
      }

      if (url === '/api/auth/me/export') {
        throw new Error('EXPORT_ERROR');
      }

      throw new Error(`Unexpected url: ${url}`);
    });
    mockFetchCompleteProfile.mockResolvedValue({
      user,
      stats: {},
      activeAnchors: [],
    });

    await AuthHydrationService.hydrateAuthenticatedData();

    expect(useAuthStore.getState().user).toEqual(expect.objectContaining({ id: user.id }));
    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
    expect(useAnchorStore.getState().anchors).toEqual([
      expect.objectContaining({ id: 'server-anchor-2' }),
    ]);
    expect(useSessionStore.getState().totalSessionsCount).toBe(17);
    expect(useSessionStore.getState().threadStrength).toBe(75);
    expect(useSessionStore.getState().primingHistory).toEqual([]);
  });

  it('restores anchors and thread stats from account export when anchor list is empty', async () => {
    const exportAnchor = createMockAnchor({
      id: 'server-anchor-export-fallback',
      updatedAt: new Date('2026-05-18T08:10:00.000Z'),
      lastActivatedAt: new Date('2026-06-08T10:00:00.000Z'),
    });
    const user = createMockUser({
      id: 'user-export-fallback',
      totalAnchorsCreated: 1,
      totalActivations: 0,
      currentStreak: 0,
      hasCompletedOnboarding: true,
    });

    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/api/anchors') {
        return { data: { data: [] } };
      }

      if (url === '/api/auth/me/export') {
        return {
          data: {
            data: {
              account: {
                anchors: [exportAnchor],
                activations: [
                  {
                    id: 'activation-export-fallback',
                    anchorId: exportAnchor.id,
                    activationType: 'visual',
                    durationSeconds: 30,
                    activatedAt: '2026-06-08T10:00:00.000Z',
                  },
                ],
              },
            },
          },
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });
    mockFetchCompleteProfile.mockResolvedValue({
      user,
      stats: {},
      activeAnchors: [],
    });

    await AuthHydrationService.hydrateAuthenticatedData();

    expect(useAnchorStore.getState().anchors).toEqual([
      expect.objectContaining({ id: 'server-anchor-export-fallback' }),
    ]);
    expect(useAnchorStore.getState().currentAnchorId).toBe('server-anchor-export-fallback');
    expect(useSessionStore.getState().totalSessionsCount).toBe(1);
    expect(useSessionStore.getState().primingHistory).toEqual([
      expect.objectContaining({ id: 'activation-export-fallback' }),
    ]);
  });

  it('restores Deep Prime and burned-anchor lifetime history without making burned anchors active', async () => {
    const user = createMockUser({
      id: 'user-lifetime-history',
      totalAnchorsCreated: 2,
      totalActivations: 2,
      currentStreak: 2,
      hasCompletedOnboarding: true,
    });
    const activeAnchor = createMockAnchor({
      id: '11111111-1111-4111-8111-111111111111',
      userId: user.id,
      activationCount: 2,
      updatedAt: new Date('2026-07-11T12:00:00.000Z'),
    });

    mockFetchCompleteProfile.mockResolvedValue({
      user,
      stats: {},
      activeAnchors: [],
    });
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/api/anchors') {
        return { data: { data: [activeAnchor] } };
      }

      if (url === '/api/auth/me/export') {
        return {
          data: {
            data: {
              exportVersion: 2,
              account: {
                anchors: [activeAnchor],
                activations: [
                  {
                    id: 'activation-live',
                    anchorId: activeAnchor.id,
                    activationType: 'visual',
                    durationSeconds: 30,
                    activatedAt: '2026-07-08T12:00:00.000Z',
                  },
                ],
                charges: [
                  // /activate creates this matching first-charge row; hydration
                  // must not turn it into a second practice session.
                  {
                    id: 'charge-live-duplicate',
                    anchorId: activeAnchor.id,
                    chargeType: 'initial_quick',
                    durationSeconds: 30,
                    completed: true,
                    chargedAt: '2026-07-08T12:00:00.000Z',
                  },
                  {
                    id: 'charge-live-deep',
                    anchorId: activeAnchor.id,
                    chargeType: 'recharge',
                    durationSeconds: 300,
                    completed: true,
                    chargedAt: '2026-07-09T12:00:00.000Z',
                  },
                ],
              },
              burnedAnchors: [
                {
                  id: 'burned-snapshot-1',
                  originalAnchorId: '22222222-2222-4222-8222-222222222222',
                  userId: user.id,
                  intentionText: 'Released intention',
                  category: 'custom',
                  distilledLetters: ['R'],
                  baseSigilSvg: '<svg/>',
                  enhancedImageUrl: null,
                  activationCount: 2,
                  activationHistory: [
                    {
                      id: 'activation-burned',
                      anchorId: '22222222-2222-4222-8222-222222222222',
                      activationType: 'mantra',
                      durationSeconds: 60,
                      activatedAt: '2026-07-10T12:00:00.000Z',
                    },
                  ],
                  chargeHistory: [
                    {
                      id: 'charge-burned-deep',
                      anchorId: '22222222-2222-4222-8222-222222222222',
                      chargeType: 'initial_deep',
                      durationSeconds: 300,
                      completed: true,
                      chargedAt: '2026-07-11T12:00:00.000Z',
                    },
                  ],
                  createdAt: '2026-07-01T12:00:00.000Z',
                  burnedAt: '2026-07-12T12:00:00.000Z',
                },
                {
                  id: 'foreign-burned-snapshot',
                  originalAnchorId: '33333333-3333-4333-8333-333333333333',
                  userId: 'another-user',
                  intentionText: 'Do not hydrate',
                  category: 'custom',
                  distilledLetters: ['X'],
                  activationCount: 50,
                  activationHistory: [],
                  chargeHistory: [],
                  createdAt: '2026-07-01T12:00:00.000Z',
                  burnedAt: '2026-07-12T12:00:00.000Z',
                },
              ],
            },
          },
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    await AuthHydrationService.hydrateAuthenticatedData();

    const anchorState = useAnchorStore.getState();
    const sessionState = useSessionStore.getState();
    expect(anchorState.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: activeAnchor.id }),
        expect.objectContaining({
          id: '22222222-2222-4222-8222-222222222222',
          isReleased: true,
          releasedAt: expect.any(Date),
          archivedAt: expect.any(Date),
          activationCount: 2,
        }),
      ])
    );
    expect(anchorState.anchors).toHaveLength(2);
    expect(anchorState.getActiveAnchors().map(anchor => anchor.id)).toEqual([activeAnchor.id]);
    expect(anchorState.currentAnchorId).toBe(activeAnchor.id);
    expect(anchorState.totalPrimes).toBe(4);

    expect(sessionState.primingHistory.map(entry => entry.id)).toEqual([
      'charge-burned-deep',
      'activation-burned',
      'charge-live-deep',
      'activation-live',
    ]);
    expect(sessionState.primingHistory).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'charge-live-duplicate' })])
    );
    expect(sessionState.primingHistory.filter(entry => entry.type === 'reinforce')).toHaveLength(2);
    expect(new Set(sessionState.primingHistory.map(entry => entry.localDate)).size).toBe(4);
    expect(sessionState.totalSessionsCount).toBe(4);
  });

  it('does not resurrect a stale active snapshot after the server has burned that anchor', async () => {
    const user = createMockUser({
      id: 'user-burned-snapshot',
      totalAnchorsCreated: 1,
      totalActivations: 3,
    });
    const originalAnchorId = '44444444-4444-4444-8444-444444444444';
    const staleSnapshotAnchor = createMockAnchor({
      id: originalAnchorId,
      userId: user.id,
      activationCount: 3,
    });
    await saveAnchorSnapshot(user.id, {
      anchors: [staleSnapshotAnchor],
      currentAnchorId: originalAnchorId,
    });

    mockFetchCompleteProfile.mockResolvedValue({
      user,
      stats: {},
      activeAnchors: [],
    });
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/api/anchors') {
        return { data: { data: [] } };
      }
      if (url === '/api/auth/me/export') {
        return {
          data: {
            data: {
              exportVersion: 2,
              account: { anchors: [], activations: [], charges: [] },
              burnedAnchors: [
                {
                  id: 'burned-snapshot-legacy',
                  originalAnchorId,
                  userId: user.id,
                  intentionText: staleSnapshotAnchor.intentionText,
                  category: staleSnapshotAnchor.category,
                  distilledLetters: staleSnapshotAnchor.distilledLetters,
                  baseSigilSvg: staleSnapshotAnchor.baseSigilSvg,
                  activationCount: 3,
                  activationHistory: [],
                  chargeHistory: [],
                  createdAt: staleSnapshotAnchor.createdAt.toISOString(),
                  burnedAt: '2026-07-12T12:00:00.000Z',
                },
              ],
            },
          },
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    await AuthHydrationService.hydrateAuthenticatedData();

    expect(useAnchorStore.getState().anchors).toEqual([
      expect.objectContaining({
        id: originalAnchorId,
        isReleased: true,
        archivedAt: expect.any(Date),
      }),
    ]);
    expect(useAnchorStore.getState().getActiveAnchors()).toEqual([]);
    expect(useAnchorStore.getState().currentAnchorId).toBeUndefined();
    expect(useSessionStore.getState().totalSessionsCount).toBe(3);
  });

  it('keeps local progress when anchor hydration fails after login', async () => {
    const localTempAnchor = createMockAnchor({
      id: 'anchor-local-only',
      updatedAt: new Date('2026-05-18T08:00:00.000Z'),
    });
    const user = createMockUser({
      id: 'user-keep-local',
      hasCompletedOnboarding: true,
      totalActivations: 9,
      currentStreak: 2,
      settings: {
        userId: 'user-keep-local',
        notificationsEnabled: true,
        dailyReminderTime: '09:00',
        streakProtection: true,
        defaultChargeDuration: 300,
        focusSessionMode: 'deep',
        focusSessionDuration: 60,
        focusSessionAudio: 'ambient',
        primeSessionDuration: 300,
        primeSessionAudio: 'ambient',
        hapticIntensity: 3,
        vaultViewType: 'grid',
        updatedAt: new Date(),
      },
    });

    useAnchorStore.getState().setAnchors([localTempAnchor]);

    mockFetchCompleteProfile.mockResolvedValue({
      user,
      stats: {},
      activeAnchors: [],
    });
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/api/anchors') {
        throw new Error('ANCHOR_FETCH_FAILED');
      }

      if (url === '/api/auth/me/export') {
        return {
          data: {
            data: {
              account: {
                activations: [],
              },
            },
          },
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    await expect(AuthHydrationService.hydrateAuthenticatedData()).resolves.toBeUndefined();

    expect(useAuthStore.getState().user).toEqual(expect.objectContaining({ id: user.id }));
    expect(useAnchorStore.getState().anchors).toEqual([
      expect.objectContaining({ id: 'anchor-local-only' }),
    ]);
    expect(useSettingsStore.getState().focusSessionMode).toBe('deep');
    expect(useSettingsStore.getState().primeSessionDuration).toBe(300);
  });

  it('falls back to same-user snapshots when remote hydration fails completely', async () => {
    const localTempAnchor = createMockAnchor({
      id: 'anchor-local-fallback',
      updatedAt: new Date('2026-05-18T08:00:00.000Z'),
    });
    const user = createMockUser({
      id: 'user-snapshot-fallback',
      totalActivations: 0,
      currentStreak: 0,
    });
    const completedAt = '2026-06-08T10:00:00.000Z';

    useAuthStore.setState({
      user,
      token: 'token-123',
      isAuthenticated: true,
    } as any);

    await saveAnchorSnapshot(user.id, {
      anchors: [localTempAnchor],
      currentAnchorId: localTempAnchor.id,
    });
    await saveProfileSnapshot(user.id, {
      ownerUserId: user.id,
      name: 'Snapshot User',
      axiom: 'Steady hands.',
      timezone: 'UTC-6 (CST)',
      mono: 'avatar_2',
      photo: 'file:///documents/profile-media/user-snapshot-fallback.jpg',
      memberSince: '2026-05-01T00:00:00.000Z',
    });
    await saveSessionSnapshot(user.id, {
      lastSession: {
        id: 'session-1',
        anchorId: 'anchor-local-fallback',
        type: 'reinforce',
        durationSeconds: 120,
        mode: 'ambient',
        completedAt,
      },
      todayPractice: { date: '2026-06-08', sessionsCount: 1, totalSeconds: 120 },
      weeklyPractice: { weekKey: '2026-W24', sessionsCount: 1, totalSeconds: 120 },
      lastGraceDayUsedAt: null,
      sessionLog: [
        {
          id: 'session-1',
          anchorId: 'anchor-local-fallback',
          type: 'reinforce',
          durationSeconds: 120,
          mode: 'ambient',
          completedAt,
        },
      ],
      threadStrength: 90,
      totalSessionsCount: 17,
      lastPrimedAt: '2026-06-08',
      weekHistory: [true, false, false, false, false, false, false],
      weekHistoryKey: '2026-W24',
      primingHistory: [
        {
          id: 'session-1',
          anchorId: 'anchor-local-fallback',
          type: 'reinforce',
          completedAt,
          localDate: '2026-06-08',
          weekKey: '2026-W24',
          weekStart: '2026-06-08',
          weekdayIndex: 0,
          hourOfDay: 10,
          timeOfDay: 'morning',
        },
      ],
      journeyWeekStart: '2026-06-08',
      lastDecayDate: '2026-06-08',
    });

    mockFetchCompleteProfile.mockRejectedValue(new Error('PROFILE_FETCH_FAILED'));
    mockApiGet.mockRejectedValue(new Error('REMOTE_FETCH_FAILED'));

    await expect(AuthHydrationService.hydrateAuthenticatedData()).resolves.toBeUndefined();

    expect(useProfileStore.getState()).toEqual(
      expect.objectContaining({
        ownerUserId: user.id,
        name: 'Snapshot User',
        axiom: 'Steady hands.',
        mono: 'avatar_2',
      })
    );
    expect(useSessionStore.getState()).toEqual(
      expect.objectContaining({
        totalSessionsCount: 17,
        threadStrength: 90,
        lastPrimedAt: '2026-06-08',
      })
    );
    expect(useAnchorStore.getState().anchors).toEqual([
      expect.objectContaining({ id: 'anchor-local-fallback' }),
    ]);
    expect(useAnchorStore.getState().currentAnchorId).toBe('anchor-local-fallback');
  });

  it('restores anchor snapshot when remote anchor list is empty but the user has saved progress', async () => {
    const snapshotAnchor = createMockAnchor({
      id: 'anchor-snapshot-only',
      updatedAt: new Date('2026-05-18T08:00:00.000Z'),
    });
    const user = createMockUser({
      id: 'user-empty-anchors',
      totalAnchorsCreated: 4,
      totalActivations: 6,
      currentStreak: 2,
      hasCompletedOnboarding: true,
    });

    await saveAnchorSnapshot(user.id, {
      anchors: [snapshotAnchor],
      currentAnchorId: snapshotAnchor.id,
    });

    mockFetchCompleteProfile.mockResolvedValue({
      user,
      stats: {},
      activeAnchors: [],
    });
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/api/anchors') {
        return { data: { data: [] } };
      }

      if (url === '/api/auth/me/export') {
        return {
          data: {
            data: {
              account: {
                activations: [],
              },
            },
          },
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    await expect(AuthHydrationService.hydrateAuthenticatedData()).resolves.toBeUndefined();

    expect(useAnchorStore.getState().anchors).toEqual([
      expect.objectContaining({ id: 'anchor-snapshot-only' }),
    ]);
    expect(useAnchorStore.getState().currentAnchorId).toBe('anchor-snapshot-only');
  });

  it('does not let stale session snapshots overwrite server-hydrated practice history', async () => {
    const remoteAnchor = createMockAnchor({
      id: 'server-anchor-with-history',
      updatedAt: new Date('2026-06-08T10:00:00.000Z'),
      lastActivatedAt: new Date('2026-06-08T10:00:00.000Z'),
    });
    const user = createMockUser({
      id: 'user-server-history',
      totalAnchorsCreated: 1,
      totalActivations: 20,
      currentStreak: 3,
      hasCompletedOnboarding: true,
    });

    await saveSessionSnapshot(user.id, {
      lastSession: null,
      todayPractice: { date: '2026-06-08', sessionsCount: 0, totalSeconds: 0 },
      weeklyPractice: { weekKey: '2026-W24', sessionsCount: 0, totalSeconds: 0 },
      lastGraceDayUsedAt: null,
      sessionLog: [],
      threadStrength: 50,
      totalSessionsCount: 0,
      lastPrimedAt: null,
      weekHistory: [false, false, false, false, false, false, false],
      weekHistoryKey: '2026-W24',
      primingHistory: [],
      journeyWeekStart: null,
      lastDecayDate: null,
    });

    mockFetchCompleteProfile.mockResolvedValue({
      user,
      stats: {},
      activeAnchors: [],
    });
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/api/anchors') {
        return { data: { data: [remoteAnchor] } };
      }

      if (url === '/api/auth/me/export') {
        return {
          data: {
            data: {
              account: {
                anchors: [remoteAnchor],
                activations: [
                  {
                    id: 'activation-server-history',
                    anchorId: remoteAnchor.id,
                    activationType: 'visual',
                    durationSeconds: 30,
                    activatedAt: '2026-06-08T10:00:00.000Z',
                  },
                ],
              },
            },
          },
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    await AuthHydrationService.hydrateAuthenticatedData();

    expect(useSessionStore.getState().totalSessionsCount).toBe(20);
    expect(useSessionStore.getState().primingHistory).toEqual([
      expect.objectContaining({ id: 'activation-server-history' }),
    ]);
    expect(useSessionStore.getState().lastPrimedAt).toBe('2026-06-08');
  });

  it('merges the local and server copy of one completion by client event ID', async () => {
    const user = createMockUser({
      id: 'user-event-identity',
      totalActivations: 1,
      currentStreak: 1,
    });
    const anchor = createMockAnchor({
      id: '55555555-5555-4555-8555-555555555555',
      userId: user.id,
      activationCount: 1,
    });
    useSessionStore.getState().recordSession({
      idempotencyKey: 'practice-shared-event',
      anchorId: anchor.id,
      type: 'activate',
      durationSeconds: 30,
      mode: 'silent',
      completedAt: '2026-07-12T10:05:00.000Z',
    });
    mockFetchCompleteProfile.mockResolvedValue({ user, stats: {}, activeAnchors: [] });
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/api/anchors') return { data: { data: [anchor] } };
      if (url === '/api/auth/me/export') {
        return {
          data: {
            data: {
              exportVersion: 2,
              account: {
                anchors: [anchor],
                activations: [
                  {
                    id: 'database-activation-id',
                    clientEventId: 'practice-shared-event',
                    anchorId: anchor.id,
                    activationType: 'visual',
                    durationSeconds: 30,
                    activatedAt: '2026-07-12T10:00:00.000Z',
                  },
                ],
                charges: [],
              },
              burnedAnchors: [],
            },
          },
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    await AuthHydrationService.hydrateAuthenticatedData();

    expect(useSessionStore.getState().primingHistory).toEqual([
      expect.objectContaining({ id: 'practice-shared-event' }),
    ]);
    expect(useSessionStore.getState().totalSessionsCount).toBe(1);
  });

  it('does not trust a partial v2 export enough to resurrect a stale snapshot', async () => {
    const user = createMockUser({
      id: 'user-partial-v2',
      totalAnchorsCreated: 1,
      hasCompletedOnboarding: true,
    });
    const staleAnchor = createMockAnchor({ id: 'server-anchor-already-burned' });
    useAuthStore.setState({ user, token: 'token', isAuthenticated: true } as any);
    await saveAnchorSnapshot(user.id, {
      anchors: [staleAnchor],
      currentAnchorId: staleAnchor.id,
    });
    mockFetchCompleteProfile.mockResolvedValue({ user, stats: {}, activeAnchors: [] });
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/api/anchors') return { data: { data: [] } };
      if (url === '/api/auth/me/export') {
        return {
          data: {
            data: {
              exportVersion: 2,
              account: { anchors: [], activations: [], charges: [] },
              // burnedAnchors is missing, so v2 is explicitly incomplete.
            },
          },
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    await AuthHydrationService.hydrateAuthenticatedData();

    expect(useAnchorStore.getState().anchors).toEqual([]);
    expect(useAnchorStore.getState().currentAnchorId).toBeUndefined();
  });

  it('abandons hydration when the active account changes mid-request', async () => {
    const userA = createMockUser({ id: 'user-a' });
    const userB = createMockUser({ id: 'user-b' });
    const accountBAnchor = createMockAnchor({ id: 'account-b-anchor', userId: userB.id });
    let resolveProfile: ((value: unknown) => void) | undefined;
    const profilePromise = new Promise(resolve => {
      resolveProfile = resolve;
    });
    useAuthStore.setState({ user: userA, token: 'token-a', isAuthenticated: true } as any);
    mockFetchCompleteProfile.mockReturnValue(profilePromise);
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/api/anchors') return { data: { data: [] } };
      if (url === '/api/auth/me/export') throw new Error('export unavailable');
      throw new Error(`Unexpected url: ${url}`);
    });

    const hydration = AuthHydrationService.hydrateAuthenticatedData();
    useAuthStore.setState({ user: userB, token: 'token-b', isAuthenticated: true } as any);
    useAnchorStore.getState().setAnchors([accountBAnchor]);
    resolveProfile?.({ user: userA, stats: {}, activeAnchors: [] });
    await hydration;

    expect(useAuthStore.getState().user?.id).toBe(userB.id);
    expect(useAnchorStore.getState().anchors).toEqual([
      expect.objectContaining({ id: accountBAnchor.id }),
    ]);
  });
});
