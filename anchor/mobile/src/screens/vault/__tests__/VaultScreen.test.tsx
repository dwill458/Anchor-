import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// Mock navigation
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({
        navigate: mockNavigate,
        push: mockNavigate,
        goBack: jest.fn(),
        replace: mockReplace,
    }),
    useRoute: () => ({ params: {} }),
}));

// Mock stores with minimal required state
let mockAnchors: any[] = [];
let mockIsLoading = false;
let mockIsAuthenticated = true;
let mockHasActiveEntitlement = true;
let mockPendingFirstAnchorDraft: { tempAnchorId: string } | null = null;
const mockSetPendingForgeResumeTarget = jest.fn();

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
            anchorCount: 0,
            shouldRedirectToCreation: false,
            setShouldRedirectToCreation: jest.fn(),
            setPendingForgeResumeTarget: mockSetPendingForgeResumeTarget,
            pendingFirstAnchorDraft: mockPendingFirstAnchorDraft,
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
        mockReplace.mockClear();
        mockSetPendingForgeResumeTarget.mockClear();
        mockAnchors = [];
        mockIsLoading = false;
        mockIsAuthenticated = true;
        mockHasActiveEntitlement = true;
        mockPendingFirstAnchorDraft = null;
    });

    it('redirects an un-accounted guest with a pending first anchor to SaveProgress', () => {
        mockIsAuthenticated = false;
        mockPendingFirstAnchorDraft = { tempAnchorId: 'pending-first-anchor-1' };
        mockAnchors = [{
            id: 'pending-first-anchor-1',
            intentionText: 'Build focus',
            category: 'career',
            isCharged: false,
            activationCount: 0,
            baseSigilSvg: '<svg></svg>',
            createdAt: new Date(),
            updatedAt: new Date(),
        }];

        render(<VaultScreen />);

        expect(mockReplace).toHaveBeenCalledWith('SaveProgress', {
            anchor: expect.objectContaining({ id: 'pending-first-anchor-1' }),
        });
        // Vault contents must never render for an un-accounted guest.
        expect(screen.queryByTestId('hero-anchor-card')).toBeNull();
        expect(screen.queryByText('CREATE NEW ANCHOR')).toBeNull();
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

    it('routes unauthenticated returning users to the create flow', () => {
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

        expect(mockNavigate).toHaveBeenCalledWith('CreateAnchor');
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
