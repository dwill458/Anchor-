import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { EnhancementChoiceScreen } from '../EnhancementChoiceScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockAddAnchor = jest.fn();
const mockIncrementAnchorCount = jest.fn();
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
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
    });

    it('stub: renders Keep Pure and Enhance options', () => {
        render(<EnhancementChoiceScreen />);
        expect(screen.getByText('Keep as Forged')).toBeTruthy();
        expect(screen.getByText('Refine Expression')).toBeTruthy();
    });

    it('stub: Keep Pure navigates directly to ChargeSetup', () => {
        jest.useFakeTimers();
        render(<EnhancementChoiceScreen />);
        fireEvent.press(screen.getByText('Keep as Forged'));
        jest.runAllTimers();
        expect(mockNavigate).toHaveBeenCalledWith('AnchorReveal', expect.objectContaining({
            intentionText: 'Test Intention',
        }));
        jest.useRealTimers();
    });

    it('stub: Enhance navigates to StyleSelection', () => {
        jest.useFakeTimers();
        render(<EnhancementChoiceScreen />);
        fireEvent.press(screen.getByText('Refine Expression'));
        jest.runAllTimers();
        expect(mockNavigate).toHaveBeenCalledWith('StyleSelection', expect.objectContaining({
            intentionText: 'Test Intention',
        }));
        jest.useRealTimers();
    });
});
