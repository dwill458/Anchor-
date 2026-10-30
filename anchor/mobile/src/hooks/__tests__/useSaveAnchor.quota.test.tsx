import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
const mockPost = jest.fn();
const mockAdd = jest.fn();
const mockPending = jest.fn();
const mockFlushDraft = jest.fn(async () => {});
const mockAuth = { user: null, isAuthenticated: false, accountRevision: 1, token: null, anchorCount: 0, wallpaperPromptSeen: false,
  incrementAnchorCount: jest.fn(), setPendingFirstAnchorDraft: mockPending,
  enqueuePendingFirstAnchorMutation: jest.fn(), clearPendingFirstAnchorState: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() }) }));
jest.mock('@/hooks/useNotificationController', () => ({ useNotificationController: () => ({ handleAnchorSaved: jest.fn(), canOfferFirstAnchorReminder: async () => false }) }));
jest.mock('@/hooks/useEntitlements', () => ({ useEntitlements: () => ({ canCreateAnchor: true }) }));
jest.mock('@/services/AuthService', () => ({ AuthService: { ensureGuestSession: async () => ({ user: { id: 'verified-guest' }, token: 'guest-token' }) } }));
jest.mock('@/services/ApiClient', () => ({
  post: (...args: unknown[]) => mockPost(...args), ApiClientError: class ApiClientError extends Error {},
}));
jest.mock('@/services/BackendAnchorService', () => ({ isBackendAnchorId: () => true }));
jest.mock('@/services/AnchorCreationSession', () => ({ creationSelection: (metadata: object) => metadata }));
jest.mock('@/services/AnalyticsService', () => ({ AnalyticsEvents: {}, AnalyticsService: { track: jest.fn(), trackFirstAnchorCreatedOnce: jest.fn() } }));
jest.mock('@/services/FrictionAnalytics', () => ({ FrictionAnalytics: { flowError: jest.fn(), stepCompleted: jest.fn(), completeFlow: jest.fn() } }));
jest.mock('@/services/ErrorTrackingService', () => ({ ErrorTrackingService: { addBreadcrumb: jest.fn(), captureException: jest.fn() } }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: Object.assign((selector: (state: unknown) => unknown) => selector(mockAuth), { getState: () => mockAuth }) }));
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (state: unknown) => unknown) => selector({ addAnchor: mockAdd, setCurrentAnchor: jest.fn() }),
  useTempStore: (selector: (state: unknown) => unknown) => selector({ tempEnhancedImage: null, setTempEnhancedImage: jest.fn() }),
}));
jest.mock('@/stores/firstAnchorFlowStore', () => ({ flushFirstAnchorFlowDraft: () => mockFlushDraft(),
  useFirstAnchorFlowStore: { getState: () => ({ clearDraft: jest.fn(), updateDraft: jest.fn() }) } }));
import { useSaveAnchor } from '../useSaveAnchor';
const input = { intentionText: 'I focus', category: 'career' as const, distilledLetters: ['F', 'C', 'S'], baseSigilSvg: '<svg/>', structureVariant: 'balanced' as const,
  enhancedImageUrl: 'https://cdn.test/image', enhancementMetadata: { creationSessionId: 'session', selectedOptionId: 'option' } as any };
beforeEach(() => { jest.clearAllMocks(); mockFlushDraft.mockReset().mockResolvedValue(undefined); mockAuth.accountRevision = 1; jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
it('saves the guest selection through verified HTTP before adding its local copy', async () => {
  mockPost.mockResolvedValue({ success: true, data: { id: 'server-anchor', enhancedImageUrl: 'https://cdn.test/canonical' } });
  const { result } = renderHook(() => useSaveAnchor(input));
  await act(async () => { expect((await result.current.saveAnchor()).status).toBe('saved'); });
  expect(mockPost).toHaveBeenCalledWith('/api/anchors', expect.objectContaining({ creationSessionId: 'session', selectedOptionId: 'option' }), expect.objectContaining({ anchorAuthToken: 'guest-token' }));
  expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'server-anchor', userId: 'guest', enhancedImageUrl: 'https://cdn.test/canonical' }));
  expect(mockPending).toHaveBeenCalledWith(expect.objectContaining({ backendAnchorId: 'server-anchor' }));
});
it('keeps failed saves retryable without inventing a locally saved Anchor or changing the key', async () => {
  mockPost.mockRejectedValue(new Error('Connection lost'));
  const { result } = renderHook(() => useSaveAnchor(input));
  await act(async () => { expect((await result.current.saveAnchor()).status).toBe('blocked'); });
  await act(async () => { expect((await result.current.saveAnchor()).status).toBe('blocked'); });
  expect(mockAdd).not.toHaveBeenCalled();
  expect(mockPost.mock.calls[0][1].idempotencyKey).toBe(mockPost.mock.calls[1][1].idempotencyKey);
});
it('rejects a late save after an A to B to A revision switch without adding local data', async () => {
  mockPost.mockImplementation(async () => {
    mockAuth.accountRevision += 2;
    return { success: true, data: { id: 'stale-server-anchor' } };
  });
  const { result } = renderHook(() => useSaveAnchor(input));
  await act(async () => { expect((await result.current.saveAnchor()).status).toBe('blocked'); });
  expect(mockAdd).not.toHaveBeenCalled();
  expect(mockPending).not.toHaveBeenCalled();
});
it('does not send a save or make a local record if its durable key write fails', async () => {
  mockFlushDraft.mockRejectedValueOnce(new Error('Private storage write failed'));
  const { result } = renderHook(() => useSaveAnchor(input));
  await act(async () => { expect((await result.current.saveAnchor()).status).toBe('blocked'); });
  expect(mockPost).not.toHaveBeenCalled();
  expect(mockAdd).not.toHaveBeenCalled();
});
