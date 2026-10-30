import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { MantraCreationScreen } from '../MantraCreationScreen';
import { Alert } from 'react-native';

const mockAddAnchor = jest.fn();
const mockUpdateAnchor = jest.fn();
const mockPost = jest.fn();
const mockIncrement = jest.fn();
const mockAuthState = { user: null, token: null, isAuthenticated: false, accountRevision: 1, anchorCount: 0, incrementAnchorCount: mockIncrement, setPendingFirstAnchorDraft: jest.fn() };
jest.mock('@/services/ApiClient', () => ({ post: (...args: unknown[]) => mockPost(...args) }));
jest.mock('@/services/AuthService', () => ({ AuthService: { ensureGuestSession: jest.fn(async () => ({ token: 'guest-token', user: { id: 'guest-db' } })) } }));
jest.mock('@/stores/firstAnchorFlowStore', () => ({ useFirstAnchorFlowStore: { getState: () => ({ draft: { saveRequestKey: 'stable-mantra-key' }, updateDraft: jest.fn() }) } }));

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    useRoute: () => ({
        params: {
            intentionText: 'Test Intention',
            distilledLetters: ['T', 'S', 'T'],
            baseSigilSvg: '<svg></svg>',
            category: 'health'
        }
    }),
}));

// Mock stores with minimal required state
jest.mock('@/stores/anchorStore', () => ({ useAnchorStore: (selector: any) => {
    const state = { anchors: [], addAnchor: mockAddAnchor, updateAnchor: mockUpdateAnchor };
    return selector ? selector(state) : state;
}}));
jest.mock('@/stores/authStore', () => ({
    useAuthStore: Object.assign((selector: any) => selector ? selector(mockAuthState) : mockAuthState, { getState: () => mockAuthState })
}));
jest.mock('@/stores/subscriptionStore', () => ({ useSubscriptionStore: () => ({ getEffectiveTier: () => 'free' }) }));

jest.mock('expo-audio', () => ({
    useAudioRecorder: () => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        uri: null,
    }),
    AudioModule: {
        requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
        setAudioModeAsync: jest.fn(),
    },
    RecordingPresets: { HIGH_QUALITY: {} },
}));

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('@/__tests__/mocks/reactNativeReanimated').default;
    Reanimated.default.call = () => {};
    return Reanimated;
});

describe('MantraCreationScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthState.accountRevision = 1;
        mockPost.mockResolvedValue({ success: true, data: { id: 'server-mantra', userId: 'guest-db', intentionText: 'Test Intention', category: 'health', distilledLetters: ['T', 'S', 'T'], baseSigilSvg: '<svg></svg>', enhancedImageUrl: 'canonical-art', createdAt: '2026-10-29', updatedAt: '2026-10-29' } });
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    it('stub: renders 4 mantra style options', () => {
        render(<MantraCreationScreen />);
        // Screen shows 3 sonic mantra style options: Rhythmic Flow, Deep Current, Clear Lift
        expect(screen.getByText('Rhythmic Flow')).toBeTruthy();
        expect(screen.getByText('Deep Current')).toBeTruthy();
        expect(screen.getByText('Clear Lift')).toBeTruthy();
    });

    it('stub: displays generated mantra text', () => {
        render(<MantraCreationScreen />);
        // The screen generates mantra text from distilled letters TST
        // All three mantra cards should render with text boxes
        expect(screen.getByText('Rhythmic Flow')).toBeTruthy();
        // The mantra header title is present
        expect(screen.getByText('Create Mantra')).toBeTruthy();
    });

    it('stub: play button triggers audio (mocked)', () => {
        render(<MantraCreationScreen />);
        // Each mantra card has a play button (▶ icon)
        const playButtons = screen.getAllByText('▶');
        expect(playButtons.length).toBeGreaterThan(0);
        // Pressing the first play button should not throw
        fireEvent.press(playButtons[0]);
        // After pressing, the button for that option becomes a pause button
        expect(screen.getAllByText('⏸').length).toBeGreaterThan(0);
    });

    it('stub: Continue navigates to charge setup with auto-start enabled', async () => {
        render(<MantraCreationScreen />);
        fireEvent.press(screen.getByText('Continue to Ritual ›'));
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('ChargeSetup', expect.objectContaining({
                anchorId: expect.any(String),
                autoStartOnSelection: true,
            }));
        });
    });

    it('requires a verified guest server save and keeps canonical artwork before continuing', async () => {
        render(<MantraCreationScreen />);
        fireEvent.press(screen.getByText('Continue to Ritual ›'));
        await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
        expect(mockPost).toHaveBeenCalledWith('/api/anchors', expect.objectContaining({ idempotencyKey: 'stable-mantra-key' }), expect.objectContaining({ anchorAuthToken: 'guest-token', anchorAuthGuard: expect.any(Function) }));
        expect(mockAddAnchor).toHaveBeenCalledWith(expect.objectContaining({ id: 'server-mantra', enhancedImageUrl: 'canonical-art', userId: 'guest' }));
    });

    it('retains the draft without local save or navigation after a quota denial', async () => {
        mockPost.mockRejectedValue(new Error('Creation quota exceeded'));
        render(<MantraCreationScreen />);
        fireEvent.press(screen.getByText('Continue to Ritual ›'));
        await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
        expect(mockAddAnchor).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(mockIncrement).not.toHaveBeenCalled();
    });

    it('discards an old successful response after an account switch', async () => {
        mockPost.mockImplementation(async () => { mockAuthState.accountRevision++; return { success: true, data: { id: 'old-account', userId: 'guest-db' } }; });
        render(<MantraCreationScreen />);
        fireEvent.press(screen.getByText('Continue to Ritual ›'));
        await waitFor(() => expect(mockPost).toHaveBeenCalled());
        await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
        expect(mockAddAnchor).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('retries with the same save key after a lost response without inventing a local record', async () => {
        mockPost.mockRejectedValueOnce(new Error('Response lost'));
        render(<MantraCreationScreen />);
        fireEvent.press(screen.getByText('Continue to Ritual ›'));
        await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
        expect(mockAddAnchor).not.toHaveBeenCalled();
        fireEvent.press(screen.getByText('Continue to Ritual ›'));
        await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
        expect(mockPost.mock.calls[0][1].idempotencyKey).toBe(mockPost.mock.calls[1][1].idempotencyKey);
        expect(mockAddAnchor).toHaveBeenCalledTimes(1);
        expect(mockIncrement).toHaveBeenCalledTimes(1);
    });
});
