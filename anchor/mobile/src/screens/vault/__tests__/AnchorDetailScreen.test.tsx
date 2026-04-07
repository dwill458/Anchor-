import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { AnchorDetailScreen } from '../AnchorDetailScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigateToPractice = jest.fn();
const mockExportAnchorArtwork = jest.fn();
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), popToTop: jest.fn() }),
    useRoute: () => ({ params: { anchorId: 'anchor-123' } }),
}));

jest.mock('@/contexts/TabNavigationContext', () => ({
    TabNavigationProvider: ({ children }: any) => children,
    useTabNavigation: () => ({
        navigateToPractice: mockNavigateToPractice,
        navigateToVault: jest.fn(),
        registerTabNav: jest.fn(),
        activeTabIndex: 0,
    }),
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
    useSessionStore: (selector: any) => {
        const today = new Date().toISOString().slice(0, 10);
        const state = {
            todayPractice: null,
            sessionLog: [
                {
                    id: 'session-1',
                    anchorId: 'anchor-123',
                    type: 'activate',
                    durationSeconds: 30,
                    mode: 'silent',
                    completedAt: new Date().toISOString(),
                },
                {
                    id: 'session-2',
                    anchorId: 'anchor-999',
                    type: 'reinforce',
                    durationSeconds: 300,
                    mode: 'silent',
                    completedAt: new Date().toISOString(),
                },
            ],
            threadStrength: 28,
            totalSessionsCount: 2,
            lastPrimedAt: today,
            weekHistory: [true, false, false, false, false, false, false],
        };
        return selector ? selector(state) : state;
    },
}));

jest.mock('@/utils/haptics', () => ({
    safeHaptics: { impact: jest.fn(), selection: jest.fn() },
}));

jest.mock('@/services/ApiClient', () => ({
    del: jest.fn(),
}));

jest.mock('@/services/AnchorArtworkExportService', () => ({
    exportAnchorArtwork: (...args: any[]) => mockExportAnchorArtwork(...args),
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
    const navigation = {
        navigate: mockNavigate,
        goBack: jest.fn(),
        popToTop: jest.fn(),
    };
    const route = { params: { anchorId: 'anchor-123' } };

    beforeEach(() => {
        mockNavigate.mockClear();
        mockExportAnchorArtwork.mockReset();
        mockExportAnchorArtwork.mockResolvedValue({
            localUri: 'file:///tmp/anchor.png',
            filename: 'test-intention-wallpaper.png',
            mode: 'wallpaper',
        });
    });

    it('stub: renders anchor name and symbol', () => {
        render(<AnchorDetailScreen navigation={navigation} route={route} />);
        expect(screen.getByText('ANCHOR DETAILS')).toBeTruthy();
        expect(screen.getByText('CURRENT ANCHOR')).toBeTruthy();
        expect(screen.getAllByText('Test Intention').length).toBeGreaterThan(0);
    });

    it('stub: Open Practice button navigates to Practice', () => {
        render(<AnchorDetailScreen navigation={navigation} route={route} />);
        fireEvent.press(screen.getByText('Open Practice'));
        expect(mockNavigateToPractice).toHaveBeenCalled();
    });

    it('stub: shows the new priming CTA copy', () => {
        render(<AnchorDetailScreen navigation={navigation} route={route} />);
        expect(screen.getByText('Ready to prime?')).toBeTruthy();
        expect(screen.getByText('Open Practice')).toBeTruthy();
    });

    it('stub: shows the compact priming stats', () => {
        render(<AnchorDetailScreen navigation={navigation} route={route} />);
        expect(screen.getByText('Dormant')).toBeTruthy();
        expect(screen.getByText('Sessions Primed')).toBeTruthy();
        expect(screen.getByText('The symbol is becoming part of you.')).toBeTruthy();
        expect(screen.getByTestId('anchor-detail-streak-value').props.children[0]).toBe(1);
    });

    it('renders wallpaper and png export actions', () => {
        render(<AnchorDetailScreen navigation={navigation} route={route} />);
        expect(screen.getByText('WALLPAPER & EXPORT')).toBeTruthy();
        expect(screen.getByText('Set as Wallpaper')).toBeTruthy();
        expect(screen.getByText('Download PNG')).toBeTruthy();
    });

    it('exports wallpaper from the detail screen', () => {
        render(<AnchorDetailScreen navigation={navigation} route={route} />);
        fireEvent.press(screen.getByText('Set as Wallpaper'));
        expect(mockExportAnchorArtwork).toHaveBeenCalledWith(expect.objectContaining({
            anchor: expect.objectContaining({
                anchorName: 'Test Intention',
                intentionText: 'Test Intention',
            }),
            mode: 'wallpaper',
            captureArtwork: expect.any(Function),
        }));
    });

    it('downloads png from the detail screen', () => {
        render(<AnchorDetailScreen navigation={navigation} route={route} />);
        fireEvent.press(screen.getByText('Download PNG'));
        expect(mockExportAnchorArtwork).toHaveBeenCalledWith(expect.objectContaining({
            anchor: expect.objectContaining({
                anchorName: 'Test Intention',
                intentionText: 'Test Intention',
            }),
            mode: 'download',
            captureArtwork: expect.any(Function),
        }));
    });
});
