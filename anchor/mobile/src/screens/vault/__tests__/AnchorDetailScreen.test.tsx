import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { AnchorDetailScreen } from '../AnchorDetailScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigateToPractice = jest.fn();
const mockExportAnchorArtwork = jest.fn();
const mockCaptureRef = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockSaveToLibraryAsync = jest.fn();
const mockToastError = jest.fn();
const mockAnalyticsTrack = jest.fn();
const mockShareCardRendererProps = jest.fn();
const mockAnchor = {
    id: 'anchor-123',
    intentionText: 'Test Intention',
    category: 'health',
    distilledLetters: ['T', 'S', 'T'],
    isCharged: false,
    activationCount: 5,
    createdAt: new Date(),
    baseSigilSvg: '<svg></svg>',
    enhancedImageUrl: undefined as string | undefined,
    sigilUri: undefined as string | undefined,
};

jest.mock('react-native-view-shot', () => ({
    __esModule: true,
    default: require('react').forwardRef(({ children }: any, ref: any) => {
        const React = require('react');
        const { View } = require('react-native');
        React.useImperativeHandle(ref, () => ({
            capture: jest.fn(() => mockCaptureRef()),
        }));
        return React.createElement(View, null, children);
    }),
    captureRef: (...args: any[]) => mockCaptureRef(...args),
}));

jest.mock('expo-media-library', () => ({
    requestPermissionsAsync: (...args: any[]) => mockRequestPermissionsAsync(...args),
    saveToLibraryAsync: (...args: any[]) => mockSaveToLibraryAsync(...args),
}));
jest.mock('@/hooks/useAppPerformanceTier', () => ({
    useAppPerformanceTier: () => 'high',
}));
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
                ...mockAnchor,
                id,
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

jest.mock('@/components/ToastProvider', () => ({
    useToast: () => ({
        error: mockToastError,
        info: jest.fn(),
        success: jest.fn(),
        warning: jest.fn(),
        showToast: jest.fn(),
    }),
}));

jest.mock('@/services/AnalyticsService', () => ({
    AnalyticsService: {
        track: (...args: any[]) => mockAnalyticsTrack(...args),
    },
}));

jest.mock('@/components/MoreRitualsSheet', () => ({
    MoreRitualsSheet: () => null,
}));

jest.mock('@/components/ShareCardRenderer', () => {
    const React = require('react');
    const { View } = require('react-native');

    return React.forwardRef((props: any, ref: any) => {
        mockShareCardRendererProps(props);

        React.useImperativeHandle(ref, () => ({
            capture: jest.fn(() => mockCaptureRef()),
        }));

        React.useEffect(() => {
            props.onRenderReady?.();
        }, [props.onRenderReady]);

        return React.createElement(View, { testID: 'mock-share-card-renderer' });
    });
});

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
        jest.restoreAllMocks();
        mockNavigate.mockClear();
        mockExportAnchorArtwork.mockReset();
        mockCaptureRef.mockReset();
        mockRequestPermissionsAsync.mockReset();
        mockSaveToLibraryAsync.mockReset();
        mockToastError.mockReset();
        mockAnalyticsTrack.mockReset();
        mockShareCardRendererProps.mockReset();
        mockAnchor.enhancedImageUrl = undefined;
        mockAnchor.sigilUri = undefined;
        mockExportAnchorArtwork.mockResolvedValue({
            localUri: 'file:///tmp/anchor.png',
            filename: 'test-intention-wallpaper.png',
            mode: 'wallpaper',
        });
        mockCaptureRef.mockResolvedValue('file:///tmp/anchor-card.png');
        mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true });
        mockSaveToLibraryAsync.mockResolvedValue(undefined);
        jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
        jest.spyOn(Sharing, 'isAvailableAsync').mockResolvedValue(true);
        jest.spyOn(Sharing, 'shareAsync').mockResolvedValue(undefined);
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
        expect(screen.getByText('Thread Strength')).toBeTruthy();
        expect(screen.getByText('The symbol is becoming part of you.')).toBeTruthy();
        expect(screen.getByTestId('anchor-detail-streak-value').props.children[0]).toBe(1);
    });

    it('renders wallpaper and png export actions', () => {
        render(<AnchorDetailScreen navigation={navigation} route={route} />);
        expect(screen.getByText('WALLPAPER & EXPORT')).toBeTruthy();
        expect(screen.getByText('SHARE MY ANCHOR')).toBeTruthy();
        expect(screen.getByText('Set as Wallpaper')).toBeTruthy();
        expect(screen.getByText('SAVE PNG')).toBeTruthy();
    });

    it('shares a branded anchor card from the detail screen', async () => {
        render(<AnchorDetailScreen navigation={navigation} route={route} />);
        fireEvent.press(screen.getByText('SHARE MY ANCHOR'));

        await waitFor(() => {
            expect(mockCaptureRef).toHaveBeenCalled();
            expect(mockAnalyticsTrack).toHaveBeenCalledWith('shareCard_initiated', { format: 'square' });
        });

        const usedExpoSharing = (Sharing.shareAsync as jest.Mock).mock.calls.length > 0;
        if (usedExpoSharing) {
            expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/anchor-card.png', expect.objectContaining({
                dialogTitle: 'Share My Anchor',
                mimeType: 'image/png',
            }));
        } else {
            expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Share My Anchor',
                url: 'file:///tmp/anchor-card.png',
            }));
        }

        expect(mockSaveToLibraryAsync).not.toHaveBeenCalled();
    });

    it('passes legacy sigil artwork into the share card renderer', async () => {
        mockAnchor.sigilUri = 'https://example.com/legacy-share-card.png';

        render(<AnchorDetailScreen navigation={navigation} route={route} />);
        fireEvent.press(screen.getByText('SHARE MY ANCHOR'));

        await waitFor(() => {
            expect(mockShareCardRendererProps).toHaveBeenCalledWith(
                expect.objectContaining({
                    artworkUri: 'https://example.com/legacy-share-card.png',
                })
            );
        });
    });

    it('exports wallpaper from the detail screen', async () => {
        render(<AnchorDetailScreen navigation={navigation} route={route} />);
        fireEvent.press(screen.getByText('Set as Wallpaper'));
        await waitFor(() => {
            expect(mockCaptureRef).toHaveBeenCalled();
            expect(mockSaveToLibraryAsync).toHaveBeenCalledWith('file:///tmp/anchor-card.png');
            expect(Share.share).toHaveBeenCalledWith({ url: 'file:///tmp/anchor-card.png' });
        });
    });

    it('downloads png from the detail screen', async () => {
        render(<AnchorDetailScreen navigation={navigation} route={route} />);
        fireEvent.press(screen.getByText('SAVE PNG'));
        await waitFor(() => {
            expect(screen.getByText('SAVE PNG')).toBeTruthy();
        });
        expect(Share.share).not.toHaveBeenCalled();
    });
});
