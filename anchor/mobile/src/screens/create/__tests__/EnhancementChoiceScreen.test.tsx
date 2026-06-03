import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, render, fireEvent, screen } from '@testing-library/react-native';
import { EnhancementChoiceScreen } from '../EnhancementChoiceScreen';

jest.mock('expo-blur', () => ({
    BlurView: ({ children, ...props }: any) => {
        const { View } = require('react-native');
        return <View {...props}>{children}</View>;
    },
}));

jest.mock('expo-status-bar', () => ({
    StatusBar: () => null,
}));

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    ImpactFeedbackStyle: { Medium: 'Medium' },
}));

jest.mock('@/components/common', () => ({
    ScreenHeader: () => null,
    ZenBackground: () => null,
}));

// Mock navigation
const mockNavigate = jest.fn();
const mockAddAnchor = jest.fn();
const mockIncrementAnchorCount = jest.fn();
const mockRouteParams = {
    intentionText: 'Test Intention',
    category: 'health',
    distilledLetters: ['T', 'S', 'T'],
    baseSigilSvg: '<svg></svg>',
    structureVariant: 'balanced',
};
const createAnimation = () => ({
    start: jest.fn((cb?: () => void) => cb?.()),
    stop: jest.fn(),
});
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    useFocusEffect: () => undefined,
    useRoute: () => ({
        params: mockRouteParams
    }),
}));

// Mock stores with minimal required state
jest.mock('@/stores/anchorStore', () => ({
    useAnchorStore: (selector: any) => {
        const state = { anchors: [], isLoading: false, addAnchor: mockAddAnchor };
        return selector ? selector(state) : state;
    }
}));
jest.mock('@/stores/authStore', () => ({
    useAuthStore: () => ({ user: null, anchorCount: 0, incrementAnchorCount: mockIncrementAnchorCount })
}));

describe('EnhancementChoiceScreen', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockNavigate.mockClear();
        Object.assign(mockRouteParams, {
            intentionText: 'Test Intention',
            category: 'health',
            distilledLetters: ['T', 'S', 'T'],
            baseSigilSvg: '<svg></svg>',
            structureVariant: 'balanced',
        });
        jest.spyOn(Animated, 'timing').mockReturnValue(createAnimation() as any);
        jest.spyOn(Animated, 'spring').mockReturnValue(createAnimation() as any);
        jest.spyOn(Animated, 'sequence').mockReturnValue(createAnimation() as any);
        jest.spyOn(Animated, 'parallel').mockReturnValue(createAnimation() as any);
        jest.spyOn(Animated, 'loop').mockReturnValue(createAnimation() as any);
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('stub: renders Keep Pure and Enhance options', () => {
        render(<EnhancementChoiceScreen />);
        expect(screen.getByLabelText('Keep as Forged')).toBeTruthy();
        expect(screen.getByLabelText('Refine Expression')).toBeTruthy();
    });

    it('renders rooted letters in a horizontal scroll container', () => {
        Object.assign(mockRouteParams, {
            distilledLetters: Array.from('VERYLONGROOTEDINTENTIONCHAIN'),
        });

        render(<EnhancementChoiceScreen />);

        const lettersScroll = screen.getByTestId('rooted-letters-scroll');
        expect(lettersScroll.props.horizontal).toBe(true);
        expect(screen.getByText('V')).toBeTruthy();
        expect(screen.getAllByText('N').length).toBeGreaterThan(1);
    });

    it('shows full-card feedback before Keep as Forged navigation and clears it', () => {
        render(<EnhancementChoiceScreen />);
        fireEvent.press(screen.getByLabelText('Keep as Forged'));

        expect(
            StyleSheet.flatten(screen.getByTestId('expression-option-overlay-pure').props.style).opacity
        ).toBe(1);

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(mockNavigate).toHaveBeenCalledWith('AnchorReveal', expect.objectContaining({
            intentionText: 'Test Intention',
        }));
        expect(
            StyleSheet.flatten(screen.getByTestId('expression-option-overlay-pure').props.style).opacity
        ).toBe(0);
    });

    it('shows full-card feedback before Refine Expression navigation', () => {
        render(<EnhancementChoiceScreen />);
        fireEvent.press(screen.getByLabelText('Refine Expression'));

        expect(
            StyleSheet.flatten(screen.getByTestId('expression-option-overlay-enhance').props.style).opacity
        ).toBe(1);

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(mockNavigate).toHaveBeenCalledWith('StyleSelection', expect.objectContaining({
            intentionText: 'Test Intention',
        }));
    });
});
