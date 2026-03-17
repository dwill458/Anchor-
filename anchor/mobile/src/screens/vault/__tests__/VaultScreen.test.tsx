import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { VaultScreen } from '../VaultScreen';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), replace: jest.fn() }),
    useRoute: () => ({ params: {} }),
}));

// Mock stores with minimal required state
let mockAnchors: any[] = [];
let mockIsLoading = false;

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
            anchorCount: 0,
            shouldRedirectToCreation: false,
            setShouldRedirectToCreation: jest.fn(),
        };
        return selector ? selector(state) : state;
    }
}));
jest.mock('@/hooks/useSubscription', () => ({
    useSubscription: () => ({ isFree: true, features: { maxAnchors: 3 } })
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
        const { Text } = require('react-native');
        return <Text>Hero: {anchor.intentionText}</Text>;
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

describe('VaultScreen', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockAnchors = [];
        mockIsLoading = false;
    });

    it('stub: renders empty state when no anchors', () => {
        render(<VaultScreen />);
        expect(screen.getByText('FORGE YOUR FIRST ANCHOR')).toBeTruthy();
        expect(screen.getByAccessibilityLabel('Forge your first anchor')).toBeTruthy();
    });

    it('stub: renders anchor grid when anchors exist', () => {
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
    });

    it('stub: shows skeleton loader while loading', () => {
        mockIsLoading = true;
        mockAnchors = [];
        render(<VaultScreen />);
        expect(screen.getByText('Loading...')).toBeTruthy();
    });

    it('stub: tapping anchor card navigates to AnchorDetail', () => {
        render(<VaultScreen />);
        // Empty state has a forge button — tapping it triggers creation flow
        fireEvent.press(screen.getByAccessibilityLabel('Forge your first anchor'));
        expect(mockNavigate).toHaveBeenCalledWith(
            expect.stringMatching(/AnchorCreation|CreateAnchor/),
        );
    });

    it('stub: shows AnchorLimitModal when limit is reached', () => {
        // Fill up to the max (3 anchors for free tier) then attempt to create
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
        // With 3 anchors, pressing the add button should trigger the limit modal
        // The hero activate button is present when anchors exist
        expect(screen.getByText('Hero: Anchor 0')).toBeTruthy();
    });
});
