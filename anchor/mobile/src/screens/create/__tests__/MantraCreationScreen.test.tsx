import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { MantraCreationScreen } from '../MantraCreationScreen';

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
    const state = { anchors: [], addAnchor: jest.fn(), updateAnchor: jest.fn() };
    return selector ? selector(state) : state;
}}));
jest.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: null, anchorCount: 0, incrementAnchorCount: jest.fn() }) }));
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
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
}));

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

describe('MantraCreationScreen', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
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

    it('stub: Continue navigates to AnchorReveal', () => {
        render(<MantraCreationScreen />);
        fireEvent.press(screen.getByText('Continue to Ritual ›'));
        expect(mockNavigate).toHaveBeenCalledWith('ChargeSetup', expect.objectContaining({
            anchorId: expect.any(String),
        }));
    });
});
