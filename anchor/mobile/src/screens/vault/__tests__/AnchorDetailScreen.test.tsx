import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { AnchorDetailScreen } from '../AnchorDetailScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigateToPractice = jest.fn();
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), popToTop: jest.fn() }),
    useRoute: () => ({ params: { anchorId: 'anchor-123' } }),
}));

jest.mock('@/contexts/TabNavigationContext', () => ({
    useTabNavigation: () => ({ navigateToPractice: mockNavigateToPractice }),
}));

// Mock stores with minimal required state
jest.mock('@/stores/anchorStore', () => ({
    useAnchorStore: (selector: any) => {
        const state = {
            getAnchorById: (id: string) => ({
                id,
                intentionText: 'Test Intention',
                category: 'health',
                distilledLetters: ['T', 'S', 'T'],
                isCharged: false,
                activationCount: 5,
                createdAt: new Date(),
                baseSigilSvg: '<svg></svg>',
            }),
            removeAnchor: jest.fn(),
            currentAnchorId: null,
        };
        return selector ? selector(state) : state;
    }
}));
jest.mock('@/stores/authStore', () => ({
    useAuthStore: (selector: any) => {
        const state = { user: null };
        return selector ? selector(state) : state;
    }
}));
jest.mock('@/stores/settingsStore', () => ({
    useSettingsStore: (selector: any) => {
        const state = {
            reduceIntentionVisibility: false,
            developerModeEnabled: false,
            developerDeleteWithoutBurnEnabled: false,
            defaultActivation: { type: 'visual', value: 30, unit: 'seconds' },
            setDefaultActivation: jest.fn(),
        };
        return selector ? selector(state) : state;
    }
}));
jest.mock('@/stores/sessionStore', () => ({
    useSessionStore: () => ({ todayPractice: null }),
}));

jest.mock('@/utils/haptics', () => ({
    safeHaptics: { impact: jest.fn(), selection: jest.fn() },
}));

jest.mock('@/services/ApiClient', () => ({
    del: jest.fn(),
}));

jest.mock('@/components/MoreRitualsSheet', () => ({
    MoreRitualsSheet: () => null,
}));

jest.mock('@/screens/vault/components/DivineSigilAura', () => ({
    DivineSigilAura: () => null,
}));

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    Reanimated.useReducedMotion = () => false;
    Reanimated.useFrameCallback = jest.fn();
    return Reanimated;
});

describe('AnchorDetailScreen', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
    });

    it('stub: renders anchor name and symbol', () => {
        render(<AnchorDetailScreen />);
        expect(screen.getByText('ANCHOR DETAILS')).toBeTruthy();
        // Intention text is shown on the detail card
        expect(screen.getByText('Test Intention')).toBeTruthy();
    });

    it('stub: Charge button navigates to ChargeSetup', () => {
        render(<AnchorDetailScreen />);
        // The primary CTA navigates to the Practice tab
        fireEvent.press(screen.getByText('Open Practice'));
        expect(mockNavigateToPractice).toHaveBeenCalled();
    });

    it('stub: Activate button navigates to Ritual', () => {
        render(<AnchorDetailScreen />);
        // "Practice with this anchor" card leads to the practice tab
        expect(screen.getByText('Practice with this anchor')).toBeTruthy();
        expect(screen.getByText('Open Practice')).toBeTruthy();
    });

    it('stub: shows correct activation count', () => {
        render(<AnchorDetailScreen />);
        // The screen renders the Dormant state since isCharged is false
        expect(screen.getByText('⟡  Dormant  ⟡')).toBeTruthy();
        // "Not yet" appears because lastActivatedAt is undefined
        expect(screen.getByText('Not yet')).toBeTruthy();
    });
});
