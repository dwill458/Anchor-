import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({
        navigate: mockNavigate,
        push: mockNavigate,
        goBack: jest.fn(),
        replace: jest.fn(),
    }),
    useRoute: () => ({ params: {} }),
}));

// Mock stores with minimal required state
let mockAnchors: any[] = [];
let mockIsLoading = false;
let mockIsAuthenticated = true;
let mockHasActiveEntitlement = true;
let mockHasCompletedOnboarding = false;
let mockPendingFirstAnchorDraft: any = null;
let mockLegacyGuestMigrationDismissed = false;
const mockSetPendingForgeResumeTarget = jest.fn();
const mockSetLegacyGuestMigrationDismissed = jest.fn((value: boolean) => {
    mockLegacyGuestMigrationDismissed = value;
});

jest.mock('@/stores/anchorStore', () => ({
    useAnchorStore: (selector: any) => {
        const state = {
            anchors: mockAnchors,
            isLoading: mockIsLoading,
            currentAnchorId: null,
            setCurrentAnchor: jest.fn(),
            setLoading: jest.fn(),
            setError: jest.fn(),
        };
        return selector ? selector(state) : state;
    }
}));
jest.mock('@/stores/authStore', () => ({
    useAuthStore: (selector: any) => {
        const state = {
            user: { id: 'test-user', displayName: 'Test User', stabilizeStreakDays: 0, lastStabilizeAt: null },
            isAuthenticated: mockIsAuthenticated,
            hasCompletedOnboarding: mockHasCompletedOnboarding,
            anchorCount: 0,
            pendingFirstAnchorDraft: mockPendingFirstAnchorDraft,
            legacyGuestMigrationDismissed: mockLegacyGuestMigrationDismissed,
            setLegacyGuestMigrationDismissed: mockSetLegacyGuestMigrationDismissed,
            shouldRedirectToCreation: false,
            setShouldRedirectToCreation: jest.fn(),
            setPendingForgeResumeTarget: mockSetPendingForgeResumeTarget,
        };
        return selector ? selector(state) : state;
    }
}));
jest.mock('@/hooks/useSubscription', () => ({
    useSubscription: () => ({ isFree: true, features: { maxAnchors: 3 } })
}));
jest.mock('@/hooks/useTrialStatus', () => ({
    useTrialStatus: () => ({ hasActiveEntitlement: mockHasActiveEntitlement }),
}));
jest.mock('@/contexts/TabNavigationContext', () => ({
    useTabNavigation: () => ({
        registerTabNav: jest.fn(),
        activeTabIndex: 0,
    }),
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
    useReduceMotionEnabled: () => true,
}));

jest.mock('@/components/ToastProvider', () => ({
    useToast: () => ({ error: jest.fn(), info: jest.fn(), success: jest.fn() }),
}));

jest.mock('@/services/AnalyticsService', () => ({
    AnalyticsService: { track: jest.fn() },
    AnalyticsEvents: { VAULT_VIEWED: 'vault_viewed', ANCHOR_LIMIT_REACHED: 'anchor_limit_reached', ANCHOR_CREATION_STARTED: 'anchor_creation_started', UPGRADE_INITIATED: 'upgrade_initiated' },
}));

jest.mock('@/services/ErrorTrackingService', () => ({
    ErrorTrackingService: { captureException: jest.fn() },
}));

jest.mock('@/services/PerformanceMonitoring', () => ({
    PerformanceMonitoring: { startTrace: () => ({ putAttribute: jest.fn(), stop: jest.fn() }) },
}));

jest.mock('@/screens/vault/components/SanctuaryHeader', () => ({
    SanctuaryHeader: ({ greeting }: any) => {
        const { Text } = require('react-native');
        return <Text>{greeting}</Text>;
    },
}));

jest.mock('@/screens/vault/components/AtmosphericOrbs', () => ({
    AtmosphericOrbs: () => null,
}));

jest.mock('@/screens/vault/components/HeroAnchorCard', () => ({
    HeroAnchorCard: ({ anchor }: any) => {
        if (!anchor) return null;
        const { Text } = require('react-native');
        return <Text testID="hero-anchor-card">{`Hero: ${anchor.intentionText}`}</Text>;
    },
}));

jest.mock('@/screens/vault/components/AnchorStack', () => ({
    AnchorStack: ({ anchors }: any) => {
        const { Text } = require('react-native');
        return <Text>Stack: {anchors.length}</Text>;
    },
}));

jest.mock('@/components/modals/AnchorLimitModal', () => ({
    AnchorLimitModal: () => null,
}));

jest.mock('@/components/skeletons/AnchorCardSkeleton', () => ({
    AnchorGridSkeleton: () => {
        const { Text } = require('react-native');
        return <Text>Loading...</Text>;
    },
}));

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    Reanimated.useReducedMotion = () => false;
    Reanimated.FadeInUp = { duration: () => ({ delay: () => ({ withInitialValues: () => undefined }) }) };
    return Reanimated;
});

import { VaultScreen } from '../VaultScreen';

describe('VaultScreen', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockSetPendingForgeResumeTarget.mockClear();
        mockAnchors = [];
        mockIsLoading = false;
        mockIsAuthenticated = true;
        mockHasActiveEntitlement = true;
        mockHasCompletedOnboarding = false;
        mockPendingFirstAnchorDraft = null;
        mockLegacyGuestMigrationDismissed = false;
        mockSetLegacyGuestMigrationDismissed.mockClear();
    });

    it('renders empty state when no anchors', () => {
        render(<VaultScreen />);
        expect(screen.getByText(/FORGE YOUR FIRST ANCHOR/)).toBeTruthy();
        expect(screen.getByLabelText('Forge your first anchor')).toBeTruthy();
    });

    it('renders anchor grid when anchors exist', () => {
        mockAnchors = [{
            id: 'a1',
            intentionText: 'Build focus',
            category: 'career',
            isCharged: false,
            activationCount: 0,
            baseSigilSvg: '<svg></svg>',
            createdAt: new Date(),
            updatedAt: new Date(),
        }];
        render(<VaultScreen />);
        expect(screen.getByText('Hero: Build focus')).toBeTruthy();
        expect(screen.getByText('CREATE NEW ANCHOR')).toBeTruthy();
    });

    it('shows skeleton loader while loading', () => {
        mockIsLoading = true;
        mockAnchors = [];
        render(<VaultScreen />);
        expect(screen.getByText('Loading...')).toBeTruthy();
    });

    it('tapping forge button navigates to anchor creation', () => {
        render(<VaultScreen />);
        fireEvent.press(screen.getByLabelText('Forge your first anchor'));
        expect(mockNavigate).toHaveBeenCalledWith(
            expect.stringMatching(/AnchorCreation|CreateAnchor/),
        );
    });

    it('shows hero card when anchor limit is reached', async () => {
        mockAnchors = Array.from({ length: 3 }, (_, i) => ({
            id: `a${i}`,
            intentionText: `Anchor ${i}`,
            category: 'career',
            isCharged: false,
            activationCount: 0,
            baseSigilSvg: '<svg></svg>',
            createdAt: new Date(),
            updatedAt: new Date(),
        }));
        render(<VaultScreen />);
        expect(screen.getByTestId('hero-anchor-card')).toBeTruthy();
        expect(screen.getByText(/Hero: Anchor/)).toBeTruthy();
    });

    it('tapping persistent create button navigates to create anchor', () => {
        mockAnchors = [{
            id: 'a1',
            intentionText: 'Build focus',
            category: 'career',
            isCharged: false,
            activationCount: 0,
            baseSigilSvg: '<svg></svg>',
            createdAt: new Date(),
            updatedAt: new Date(),
        }];
        render(<VaultScreen />);
        fireEvent.press(screen.getByLabelText('Create new anchor'));
        expect(mockNavigate).toHaveBeenCalledWith('CreateAnchor');
    });

    it('hides released anchors from Sanctuary content', () => {
        mockAnchors = [
            {
                id: 'active-anchor',
                intentionText: 'Build focus',
                category: 'career',
                isCharged: false,
                activationCount: 0,
                baseSigilSvg: '<svg></svg>',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'released-anchor',
                intentionText: 'Old burn',
                category: 'career',
                isCharged: true,
                isReleased: true,
                releasedAt: new Date(),
                activationCount: 2,
                baseSigilSvg: '<svg></svg>',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ];

        render(<VaultScreen />);
        expect(screen.getByText('Hero: Build focus')).toBeTruthy();
        expect(screen.getByText('Stack: 0')).toBeTruthy();
    });

    it('shows the empty sanctuary state when only released anchors remain', () => {
        mockAnchors = [{
            id: 'released-anchor',
            intentionText: 'Old burn',
            category: 'career',
            isCharged: true,
            isReleased: true,
            releasedAt: new Date(),
            activationCount: 2,
            baseSigilSvg: '<svg></svg>',
            createdAt: new Date(),
            updatedAt: new Date(),
        }];

        render(<VaultScreen />);
        expect(screen.getByText(/FORGE YOUR FIRST ANCHOR/)).toBeTruthy();
        expect(screen.queryByText('CREATE NEW ANCHOR')).toBeNull();
    });

    it('routes unauthenticated returning users to account creation before creating another anchor', () => {
        mockIsAuthenticated = false;
        mockAnchors = [{
            id: 'a1',
            intentionText: 'Build focus',
            category: 'career',
            isCharged: false,
            activationCount: 0,
            baseSigilSvg: '<svg></svg>',
            createdAt: new Date(),
            updatedAt: new Date(),
        }];

        render(<VaultScreen />);
        fireEvent.press(screen.getByLabelText('Create new anchor'));

        expect(mockNavigate).toHaveBeenCalledWith('Login', {
            context: 'save_progress',
            initialTab: 'signup',
        });
    });

    it('shows the legacy guest migration banner for returning guests in Sanctuary', () => {
        mockIsAuthenticated = false;
        mockHasCompletedOnboarding = true;
        mockAnchors = [{
            id: 'a1',
            intentionText: 'Build focus',
            category: 'career',
            isCharged: false,
            activationCount: 0,
            baseSigilSvg: '<svg></svg>',
            createdAt: new Date(),
            updatedAt: new Date(),
        }];

        render(<VaultScreen />);

        expect(screen.getByText('Save your Sanctuary.')).toBeTruthy();
        expect(screen.getByText(/Create your account to keep these anchors/)).toBeTruthy();
        fireEvent.press(screen.getByText('Save & Create Account'));
        expect(mockNavigate).toHaveBeenCalledWith('Login', {
            context: 'save_progress',
            initialTab: 'signup',
        });
    });

    it('shows the account nudge for no-account pending anchors already in Sanctuary', () => {
        mockIsAuthenticated = false;
        mockPendingFirstAnchorDraft = {
            tempAnchorId: 'a1',
            source: 'onboarding_first_anchor',
            requiresAccountGate: false,
            createdAt: new Date(),
        };
        mockAnchors = [{
            id: 'a1',
            intentionText: 'Build focus',
            category: 'career',
            isCharged: false,
            activationCount: 0,
            baseSigilSvg: '<svg></svg>',
            createdAt: new Date(),
            updatedAt: new Date(),
        }];

        render(<VaultScreen />);

        expect(screen.getByText('Save your Sanctuary.')).toBeTruthy();
        expect(screen.getByText('CREATE ACCOUNT TO CONTINUE')).toBeTruthy();

        fireEvent.press(screen.getByLabelText('Create new anchor'));

        expect(mockNavigate).toHaveBeenCalledWith('Login', {
            context: 'save_progress',
            initialTab: 'signup',
        });
    });

    it('persists dismissal for the legacy guest migration banner', () => {
        mockIsAuthenticated = false;
        mockHasCompletedOnboarding = true;
        mockAnchors = [{
            id: 'a1',
            intentionText: 'Build focus',
            category: 'career',
            isCharged: false,
            activationCount: 0,
            baseSigilSvg: '<svg></svg>',
            createdAt: new Date(),
            updatedAt: new Date(),
        }];

        render(<VaultScreen />);

        fireEvent.press(screen.getByText('✕'));
        expect(mockSetLegacyGuestMigrationDismissed).toHaveBeenCalledWith(true);
    });

    it('does not show the legacy guest migration banner for pending first-anchor guests', () => {
        mockIsAuthenticated = false;
        mockHasCompletedOnboarding = true;
        mockPendingFirstAnchorDraft = {
            tempAnchorId: 'a1',
            source: 'onboarding_first_anchor',
            requiresAccountGate: true,
            createdAt: new Date(),
        };
        mockAnchors = [{
            id: 'a1',
            intentionText: 'Build focus',
            category: 'career',
            isCharged: false,
            activationCount: 0,
            baseSigilSvg: '<svg></svg>',
            createdAt: new Date(),
            updatedAt: new Date(),
        }];

        render(<VaultScreen />);

        expect(screen.queryByText('Save your Sanctuary.')).toBeNull();
    });

    it('routes authenticated users without entitlement to the create flow', () => {
        mockHasActiveEntitlement = false;
        mockAnchors = [{
            id: 'a1',
            intentionText: 'Build focus',
            category: 'career',
            isCharged: false,
            activationCount: 0,
            baseSigilSvg: '<svg></svg>',
            createdAt: new Date(),
            updatedAt: new Date(),
        }];

        render(<VaultScreen />);
        fireEvent.press(screen.getByLabelText('Create new anchor'));

        expect(mockNavigate).toHaveBeenCalledWith('CreateAnchor');
    });
});
