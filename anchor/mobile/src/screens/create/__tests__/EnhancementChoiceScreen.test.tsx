import React from 'react';
import { Animated } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { EnhancementChoiceScreen } from '../EnhancementChoiceScreen';

jest.mock('expo-blur', () => ({
    BlurView: () => null,
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
const createAnimation = () => ({
    start: jest.fn((cb?: () => void) => cb?.()),
    stop: jest.fn(),
});
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    useFocusEffect: () => undefined,
    useRoute: () => ({
        params: {
            intentionText: 'Test Intention',
            category: 'health',
            distilledLetters: ['T', 'S', 'T'],
            baseSigilSvg: '<svg></svg>',
            structureVariant: 'balanced'
        }
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
        mockNavigate.mockClear();
        jest.spyOn(Animated, 'timing').mockReturnValue(createAnimation() as any);
        jest.spyOn(Animated, 'spring').mockReturnValue(createAnimation() as any);
        jest.spyOn(Animated, 'sequence').mockReturnValue(createAnimation() as any);
        jest.spyOn(Animated, 'parallel').mockReturnValue(createAnimation() as any);
        jest.spyOn(Animated, 'loop').mockReturnValue(createAnimation() as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('stub: renders Keep Pure and Enhance options', () => {
        render(<EnhancementChoiceScreen />);
        expect(screen.getByLabelText('Keep as Forged')).toBeTruthy();
        expect(screen.getByLabelText('Refine Expression')).toBeTruthy();
    });

    it('stub: Keep Pure navigates directly to ChargeSetup', () => {
        render(<EnhancementChoiceScreen />);
        fireEvent.press(screen.getByLabelText('Keep as Forged'));
        return waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('AnchorReveal', expect.objectContaining({
                intentionText: 'Test Intention',
            }));
        });
    });

    it('stub: Enhance navigates to StyleSelection', () => {
        render(<EnhancementChoiceScreen />);
        fireEvent.press(screen.getByLabelText('Refine Expression'));
        return waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('StyleSelection', expect.objectContaining({
                intentionText: 'Test Intention',
            }));
        });
    });
});
