import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAnchorStore } from '../stores/anchorStore';
import { useAuthStore } from '../stores/authStore';
import { useFirstRunStore } from '../stores/v2/firstRunStore';
import { reloadCurrentApp } from '../services/reloadCurrentApp';
import App from '../../App';

const mockAuthCallbacks: Array<(user: unknown) => Promise<void>> = [];

jest.mock('@/services/AuthService', () => ({
  AuthService: {
    initialize: jest.fn(),
    onAuthStateChanged: jest.fn((callback: (user: unknown) => Promise<void>) => {
      mockAuthCallbacks.push(callback);
      return jest.fn();
    }),
    hasAuthenticatedSession: jest.fn(() => false),
  },
}));

jest.mock('@/services/reloadCurrentApp', () => ({ reloadCurrentApp: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../components/splash/SplashController', () => ({ SplashController: () => null }));

const anchor = {
  id: 'persisted-anchor',
  intentionText: 'Saved before a slow restore',
  category: 'career',
  distilledLetters: ['S', 'A', 'V'],
  baseSigilSvg: '<svg />',
  structureVariant: 'balanced',
  isCharged: false,
  activationCount: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('App startup hydration recovery', () => {
  let restorePersistenceMocks: Array<() => void>;
  let anchorHydrationListeners: Array<() => void>;
  let firstRunHydrationListeners: Array<() => void>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockAuthCallbacks.length = 0;
    anchorHydrationListeners = [];
    firstRunHydrationListeners = [];
    restorePersistenceMocks = [];

    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasCompletedOnboarding: false,
      isGuest: true,
      pendingFirstAnchorDraft: null,
      pendingFirstAnchorMutations: [],
    } as never);
    useAnchorStore.setState({ anchors: [anchor], currentAnchorId: anchor.id, persistenceRecoveryRequired: false } as never);
    useFirstRunStore.getState().setStep('creation');
    useFirstRunStore.getState().setIntention('I am still restoring');

    const originalAuthHasHydrated = useAuthStore.persist.hasHydrated;
    useAuthStore.persist.hasHydrated = () => true;
    restorePersistenceMocks.push(() => {
      useAuthStore.persist.hasHydrated = originalAuthHasHydrated;
    });

    for (const [store, listeners] of [
      [useAnchorStore, anchorHydrationListeners],
      [useFirstRunStore, firstRunHydrationListeners],
    ] as const) {
      const originalHasHydrated = store.persist.hasHydrated;
      const originalOnFinishHydration = store.persist.onFinishHydration;
      store.persist.hasHydrated = () => false;
      store.persist.onFinishHydration = ((callback: (state: unknown) => void) => {
        const listener = () => callback(undefined);
        listeners.push(listener);
        return () => {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        };
      }) as typeof store.persist.onFinishHydration;
      restorePersistenceMocks.push(() => {
        store.persist.hasHydrated = originalHasHydrated;
        store.persist.onFinishHydration = originalOnFinishHydration;
      });
    }
  });

  afterEach(() => {
    restorePersistenceMocks.forEach((restore) => restore());
    jest.useRealTimers();
  });

  it('keeps the recovery surface hidden at nine seconds, then shows retry after ten while preserving local data', async () => {
    render(<App />);

    await act(async () => {
      await mockAuthCallbacks[0](null);
    });

    act(() => jest.advanceTimersByTime(9000));
    expect(screen.queryByText('Unable to restore saved data')).toBeNull();

    act(() => jest.advanceTimersByTime(1001));
    expect(screen.getByText('Unable to restore saved data')).toBeTruthy();
    expect(useAnchorStore.getState().anchors).toEqual([anchor]);
    expect(useFirstRunStore.getState().draft).toMatchObject({
      currentStep: 'intention',
      intention: 'I am still restoring',
    });

    fireEvent.press(screen.getByRole('button', { name: 'Restart Anchor and try again' }));
    expect(reloadCurrentApp).toHaveBeenCalledTimes(1);
    expect(useAnchorStore.getState().anchors).toEqual([anchor]);
  });

  it('cancels recovery when both required stores hydrate at nine seconds', async () => {
    render(<App />);

    await act(async () => {
      await mockAuthCallbacks[0](null);
    });

    act(() => jest.advanceTimersByTime(9000));
    expect(screen.queryByText('Unable to restore saved data')).toBeNull();

    act(() => {
      useAnchorStore.persist.hasHydrated = () => true;
      useFirstRunStore.persist.hasHydrated = () => true;
      anchorHydrationListeners.forEach((listener) => listener());
      firstRunHydrationListeners.forEach((listener) => listener());
    });

    await act(async () => {
      await mockAuthCallbacks[0](null);
      await mockAuthCallbacks[0](null);
    });
    act(() => jest.advanceTimersByTime(6001));
    expect(screen.queryByText('Unable to restore saved data')).toBeNull();
    expect(useAnchorStore.getState().anchors).toEqual([anchor]);
    expect(useFirstRunStore.getState().draft).toMatchObject({
      currentStep: 'intention',
      intention: 'I am still restoring',
    });
  });

  it('dismisses the recovery surface when a slow restore succeeds after the deadline', async () => {
    render(<App />);
    await act(async () => { await mockAuthCallbacks[0](null); });
    act(() => jest.advanceTimersByTime(10001));
    expect(screen.getByText('Unable to restore saved data')).toBeTruthy();
    act(() => {
      useAnchorStore.persist.hasHydrated = () => true;
      useFirstRunStore.persist.hasHydrated = () => true;
      anchorHydrationListeners.forEach((listener) => listener());
      firstRunHydrationListeners.forEach((listener) => listener());
    });
    expect(screen.queryByText('Unable to restore saved data')).toBeNull();
    expect(useAnchorStore.getState().anchors).toEqual([anchor]);
    expect(reloadCurrentApp).not.toHaveBeenCalled();
  });

  it.each([false, true])('handles late auth hydration while preserving storage recovery guard=%s', async (recoveryRequired) => {
    let hydrated = false;
    const originalOnFinishHydration = useAuthStore.persist.onFinishHydration;
    const listeners = new Set<() => void>();
    useAuthStore.persist.hasHydrated = () => hydrated;
    useAuthStore.persist.onFinishHydration = (callback) => {
      const listener = () => callback(useAuthStore.getState());
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    };
    restorePersistenceMocks.push(() => {
      useAuthStore.persist.onFinishHydration = originalOnFinishHydration;
    });
    useAnchorStore.persist.hasHydrated = () => true;
    useFirstRunStore.persist.hasHydrated = () => true;
    useAnchorStore.setState({ persistenceRecoveryRequired: recoveryRequired });
    const rendered = render(<App />);
    try {
      const restoring = mockAuthCallbacks[0](null);
      await act(async () => { await jest.advanceTimersByTimeAsync(10001); await restoring; });
      expect(screen.getByText('Unable to restore saved data')).toBeTruthy();
      await act(async () => {
        hydrated = true;
        [...listeners].forEach((listener) => listener());
        await jest.advanceTimersByTimeAsync(0);
      });
      if (recoveryRequired) expect(screen.getByText('Unable to restore saved data')).toBeTruthy();
      else expect(screen.queryByText('Unable to restore saved data')).toBeNull();
      expect(useAnchorStore.getState().anchors).toEqual([anchor]);
      expect(reloadCurrentApp).not.toHaveBeenCalled();
    } finally {
      rendered.unmount();
    }
  });

  it('keeps a storage or ownership recovery failure closed even after hydration callbacks finish', async () => {
    render(<App />);
    await act(async () => { await mockAuthCallbacks[0](null); });
    act(() => {
      useAnchorStore.persist.hasHydrated = () => true;
      useFirstRunStore.persist.hasHydrated = () => true;
      anchorHydrationListeners.forEach((listener) => listener());
      firstRunHydrationListeners.forEach((listener) => listener());
      useAnchorStore.setState({ persistenceRecoveryRequired: true });
    });
    expect(screen.getByText('Unable to restore saved data')).toBeTruthy();
    expect(useAnchorStore.getState().anchors).toEqual([anchor]);
  });
});
