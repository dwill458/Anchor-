import React from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AnchorRevealScreen } from '../AnchorRevealScreen';

const mockReplace = jest.fn();
const mockPost = jest.fn();
const mockAddAnchor = jest.fn();
const mockIncrementAnchorCount = jest.fn();
const mockHandleAnchorSaved = jest.fn();
const mockCanOfferFirstAnchorReminder = jest.fn();

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
    useAnchorStore: (selector: any) => selector({ addAnchor: mockAddAnchor }),
    useTempStore: (selector: any) =>
        selector({ tempEnhancedImage: null, setTempEnhancedImage: jest.fn() }),
}));

jest.mock('@/stores/authStore', () => ({
    useAuthStore: (selector: any) =>
        selector({
            incrementAnchorCount: mockIncrementAnchorCount,
            wallpaperPromptSeen: true,
            user: { id: 'user-1' },
            isAuthenticated: true,
            anchorCount: 0,
            setPendingFirstAnchorDraft: jest.fn(),
            enqueuePendingFirstAnchorMutation: jest.fn(),
            clearPendingFirstAnchorState: jest.fn(),
        }),
}));

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
        mockReplace.mockClear();
        mockPost.mockReset();
        mockAddAnchor.mockClear();
        mockIncrementAnchorCount.mockClear();
        mockHandleAnchorSaved.mockClear();
        mockCanOfferFirstAnchorReminder.mockReset();
        mockPost.mockResolvedValue({ success: true, data: { id: 'anchor-1' } });
        jest.spyOn(Animated, 'timing').mockReturnValue(createAnimation() as any);
        jest.spyOn(Animated, 'spring').mockReturnValue(createAnimation() as any);
        jest.spyOn(Animated, 'parallel').mockReturnValue(createAnimation() as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('does not start another create request while reminder eligibility is pending', async () => {
        let resolveEligibility!: (value: boolean) => void;
        mockCanOfferFirstAnchorReminder.mockImplementation(
            () => new Promise<boolean>((resolve) => { resolveEligibility = resolve; })
        );

        render(<AnchorRevealScreen />);

        fireEvent.press(screen.getByTestId('begin-priming-button'));

        await waitFor(() => {
            expect(mockCanOfferFirstAnchorReminder).toHaveBeenCalledTimes(1);
        });

        const continueButton = screen.getByTestId('begin-priming-button');
        fireEvent.press(continueButton);
        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockAddAnchor).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolveEligibility(false);
        });

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('ChargeSetup', expect.objectContaining({
                anchorId: 'anchor-1',
            }));
        });
    });
});
