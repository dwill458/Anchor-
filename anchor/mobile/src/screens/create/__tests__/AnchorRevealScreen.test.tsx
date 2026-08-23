import React from 'react';
import { Alert, Animated, Text, TouchableOpacity, View } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AnchorRevealScreen } from '../AnchorRevealScreen';

const mockReplace = jest.fn();
const mockPost = jest.fn();
const mockAddAnchor = jest.fn();
const mockSetCurrentAnchor = jest.fn();
const mockIncrementAnchorCount = jest.fn();
const mockHandleAnchorSaved = jest.fn();
const mockCanOfferFirstAnchorReminder = jest.fn();
let mockActiveAccountId = 'user-1';

const mockRouteParams = {
    intentionText: 'I return to the present',
    category: 'custom',
    distilledLetters: ['I', 'R', 'P'],
    baseSigilSvg: '<svg />',
    structureVariant: 'balanced' as const,
};

jest.mock('expo-status-bar', () => ({
    StatusBar: () => null,
}));

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({
        goBack: jest.fn(),
        navigate: jest.fn(),
        replace: mockReplace,
        setOptions: jest.fn(),
    }),
    useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@/components/common', () => {
    const React = require('react');
    const { Text, TouchableOpacity } = require('react-native');

    return {
        ZenBackground: () => null,
        GlassIconButton: ({ children, ...props }: any) =>
            React.createElement(TouchableOpacity, props, children),
        UndertoneLine: ({ text }: { text: string }) => React.createElement(Text, null, text),
        OptimizedImage: () => null,
        SigilSvg: () => null,
    };
});

jest.mock('@/components/notifications', () => ({
    DailyReminderPrompt: () => null,
}));

jest.mock('@/stores/anchorStore', () => ({
    useAnchorStore: (selector: any) => selector({ addAnchor: mockAddAnchor, setCurrentAnchor: mockSetCurrentAnchor }),
    useTempStore: (selector: any) =>
        selector({ tempEnhancedImage: null, setTempEnhancedImage: jest.fn() }),
}));

jest.mock('@/stores/authStore', () => {
    const getState = () => ({
            incrementAnchorCount: mockIncrementAnchorCount,
            wallpaperPromptSeen: true,
            user: { id: mockActiveAccountId },
            isAuthenticated: true,
            anchorCount: 0,
            setPendingFirstAnchorDraft: jest.fn(),
            enqueuePendingFirstAnchorMutation: jest.fn(),
            clearPendingFirstAnchorState: jest.fn(),
    });
    const useAuthStore: any = (selector: any) => selector(getState());
    useAuthStore.getState = getState;
    return { useAuthStore };
});

jest.mock('@/stores/settingsStore', () => ({
    useSettingsStore: (selector: any) => selector({ guideMode: false }),
}));

jest.mock('@/hooks/useNotificationController', () => ({
    useNotificationController: () => ({
        handleAnchorSaved: mockHandleAnchorSaved,
        canOfferFirstAnchorReminder: mockCanOfferFirstAnchorReminder,
    }),
}));

jest.mock('@/hooks/useEntitlements', () => ({
    useEntitlements: () => ({
        canCreateAnchor: true,
        anchorCreationLimitReason: null,
        anchorsCreatedToday: 0,
        anchorsCreatedDuringTrial: 0,
        tier: 'pro',
    }),
}));

jest.mock('@/services/ApiClient', () => ({
    ApiClientError: class ApiClientError extends Error {},
    post: (...args: any[]) => mockPost(...args),
}));

jest.mock('@/services/ErrorTrackingService', () => ({
    ErrorTrackingService: { addBreadcrumb: jest.fn(), captureException: jest.fn() },
}));

jest.mock('@/services/AnalyticsService', () => ({
    AnalyticsEvents: { ANCHOR_CREATION_COMPLETED: 'anchor_creation_completed' },
    AnalyticsService: { track: jest.fn() },
}));

jest.mock('@/services/FrictionAnalytics', () => ({
    FrictionAnalytics: { flowError: jest.fn(), stepCompleted: jest.fn(), completeFlow: jest.fn() },
}));

jest.mock('@/services/BackendAnchorService', () => ({
    isBackendAnchorId: () => true,
}));

jest.mock('@/utils/intentionPatterns', () => ({
    analyzeIntention: () => ({ hasFutureTense: false, hasNegation: false, shouldShowGuidance: false }),
    getGuidanceText: () => null,
}));

jest.mock('@/utils/tierClassifier', () => ({
    classifyToTierPreliminary: () => ({ tier: 'mercury', confidenceScore: 1, isCustomFallback: false }),
}));

jest.mock('@/utils/layout', () => ({
    isCompactPhoneViewport: () => false,
    isShortPhoneViewport: () => false,
}));

jest.mock('@/utils/entitlements', () => ({
    getAnchorCreationLimitCopy: () => null,
}));

jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn() },
}));

const createAnimation = () => ({
    start: jest.fn(),
    stop: jest.fn(),
});

describe('AnchorRevealScreen', () => {
    beforeEach(() => {
        mockActiveAccountId = 'user-1';
        mockReplace.mockClear();
        mockPost.mockReset();
        mockAddAnchor.mockClear();
        mockSetCurrentAnchor.mockClear();
        mockIncrementAnchorCount.mockClear();
        mockHandleAnchorSaved.mockClear();
        mockCanOfferFirstAnchorReminder.mockReset();
        mockPost.mockResolvedValue({ success: true, data: { id: 'anchor-1' } });
        jest.spyOn(Animated, 'timing').mockReturnValue(createAnimation() as any);
        jest.spyOn(Animated, 'spring').mockReturnValue(createAnimation() as any);
        jest.spyOn(Animated, 'parallel').mockReturnValue(createAnimation() as any);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('does not start another first-anchor create request and continues to Prime', async () => {
        render(<AnchorRevealScreen />);

        fireEvent.press(screen.getByTestId('begin-priming-button'));
        const continueButton = screen.getByTestId('begin-priming-button');
        fireEvent.press(continueButton);

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledTimes(1);
            expect(mockAddAnchor).toHaveBeenCalledTimes(1);
            expect(mockReplace).toHaveBeenCalledWith('PrimeYourAnchor', { anchorId: 'anchor-1' });
        });
        expect(mockCanOfferFirstAnchorReminder).not.toHaveBeenCalled();
    });

    it('does not project a late Anchor response into a newly active account', async () => {
        let resolvePost!: (value: unknown) => void;
        mockPost.mockReturnValue(new Promise((resolve) => { resolvePost = resolve; }));
        render(<AnchorRevealScreen />);

        fireEvent.press(screen.getByTestId('begin-priming-button'));
        mockActiveAccountId = 'user-2';
        resolvePost({ success: true, data: { id: 'anchor-for-user-1' } });

        await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
        await act(async () => {});
        expect(mockAddAnchor).not.toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('retains the same first-Anchor intent when both network responses are lost', async () => {
        jest.useFakeTimers();
        const networkError = new Error('Network error. Please check your connection.');
        mockPost.mockRejectedValue(networkError);
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        render(<AnchorRevealScreen />);

        fireEvent.press(screen.getByTestId('begin-priming-button'));
        await act(async () => { await Promise.resolve(); });
        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(mockPost).toHaveBeenCalledTimes(2);
        const firstKey = mockPost.mock.calls[0][1].idempotencyKey;
        expect(mockPost.mock.calls[1][1].idempotencyKey).toBe(firstKey);
        expect(mockAddAnchor).not.toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalledWith(
            'Anchor not yet confirmed',
            expect.stringContaining('tap Continue again'),
        );

        mockPost.mockResolvedValueOnce({ success: true, data: { id: 'anchor-reconciled' } });
        fireEvent.press(screen.getByTestId('begin-priming-button'));
        await act(async () => { await Promise.resolve(); await Promise.resolve(); });
        expect(mockPost.mock.calls[2][1].idempotencyKey).toBe(firstKey);
        expect(mockAddAnchor).toHaveBeenCalledWith(expect.objectContaining({ id: 'anchor-reconciled' }));
        jest.useRealTimers();
    });

    it('does not authenticate a delayed retry as a newly active account', async () => {
        jest.useFakeTimers();
        mockPost.mockRejectedValueOnce(new Error('Network error. Please check your connection.'));
        render(<AnchorRevealScreen />);

        fireEvent.press(screen.getByTestId('begin-priming-button'));
        await act(async () => { await Promise.resolve(); });
        mockActiveAccountId = 'user-2';
        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
        });

        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockAddAnchor).not.toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('automatically advances after 5 seconds countdown', async () => {
        jest.useFakeTimers();
        render(<AnchorRevealScreen />);

        await act(async () => {
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
        });

        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockAddAnchor).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith('PrimeYourAnchor', { anchorId: 'anchor-1' });
        jest.useRealTimers();
    });
});

