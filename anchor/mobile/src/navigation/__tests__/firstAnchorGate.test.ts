import {
  getPendingFirstAnchorGate,
  navigateToVaultDestination,
} from '../firstAnchorGate';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';

jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: jest.fn() },
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: { getState: jest.fn() },
}));

jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn() },
}));

const mockGetState = useAuthStore.getState as unknown as jest.Mock;
const mockAnchorGetState = useAnchorStore.getState as unknown as jest.Mock;
const mockAnchor = {
  id: 'pending-first-anchor-1',
  intentionText: 'Build focus',
  baseSigilSvg: '<svg></svg>',
};

const setAuthState = (overrides: Record<string, unknown>) => {
  mockGetState.mockReturnValue({
    isAuthenticated: false,
    pendingFirstAnchorDraft: null,
    ...overrides,
  });
};

describe('firstAnchorGate', () => {
  let navigation: { navigate: jest.Mock; replace: jest.Mock; reset: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnchorGetState.mockReturnValue({
      getAnchorById: jest.fn(() => mockAnchor),
    });
    navigation = { navigate: jest.fn(), replace: jest.fn(), reset: jest.fn() };
  });

  describe('getPendingFirstAnchorGate', () => {
    it('returns the gate params for an unauthenticated guest with a pending first anchor', () => {
      setAuthState({
        isAuthenticated: false,
        pendingFirstAnchorDraft: { tempAnchorId: 'pending-first-anchor-1' },
      });

      expect(getPendingFirstAnchorGate()).toEqual({ anchor: mockAnchor });
    });

    it('returns null once the user is authenticated', () => {
      setAuthState({
        isAuthenticated: true,
        pendingFirstAnchorDraft: { tempAnchorId: 'pending-first-anchor-1' },
      });

      expect(getPendingFirstAnchorGate()).toBeNull();
    });

    it('returns null when there is no pending first anchor', () => {
      setAuthState({ isAuthenticated: false, pendingFirstAnchorDraft: null });

      expect(getPendingFirstAnchorGate()).toBeNull();
    });
  });

  describe('navigateToVaultDestination', () => {
    it('routes a pending-first-anchor guest to SaveProgress instead of the Vault', () => {
      setAuthState({
        isAuthenticated: false,
        pendingFirstAnchorDraft: { tempAnchorId: 'pending-first-anchor-1' },
      });

      navigateToVaultDestination(navigation, 'replace');

      expect(navigation.replace).toHaveBeenCalledWith('SaveProgress', {
        anchor: mockAnchor,
      });
      expect(navigation.replace).not.toHaveBeenCalledWith('Vault');
    });

    it('uses navigate (push) for the gate when no replace action is requested', () => {
      setAuthState({
        isAuthenticated: false,
        pendingFirstAnchorDraft: { tempAnchorId: 'pending-first-anchor-1' },
      });

      navigateToVaultDestination(navigation);

      expect(navigation.navigate).toHaveBeenCalledWith('SaveProgress', {
        anchor: mockAnchor,
      });
    });

    it('routes an authenticated user straight to the Vault', () => {
      setAuthState({ isAuthenticated: true, pendingFirstAnchorDraft: null });

      navigateToVaultDestination(navigation, 'replace');

      expect(navigation.replace).toHaveBeenCalledWith('Vault');
    });

    it('can reset the stack to the Vault', () => {
      setAuthState({ isAuthenticated: true, pendingFirstAnchorDraft: null });

      navigateToVaultDestination(navigation, 'reset');

      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Vault' }],
      });
    });

    it('can reset the stack to SaveProgress for a pending-first-anchor guest', () => {
      setAuthState({
        isAuthenticated: false,
        pendingFirstAnchorDraft: { tempAnchorId: 'pending-first-anchor-1' },
      });

      navigateToVaultDestination(navigation, 'reset');

      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'SaveProgress', params: { anchor: mockAnchor } }],
      });
    });
  });
});
