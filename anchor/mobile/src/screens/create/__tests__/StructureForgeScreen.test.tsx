import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import StructureForgeScreen from '../StructureForgeScreen';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    useRoute: () => ({
        params: {
            intentionText: 'Test Intention',
            category: 'health',
            distilledLetters: ['T', 'E', 'S', 'T']
        }
    }),
}));

// Mock stores with minimal required state
jest.mock('@/stores/anchorStore', () => ({ useAnchorStore: () => ({ anchors: [], isLoading: false }) }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: null, anchorCount: 0 }) }));

jest.mock('@/utils/sigil/traditional-generator', () => ({
    generateAllVariants: () => [
        { variant: 'balanced', svg: '<svg></svg>' },
        { variant: 'dense', svg: '<svg></svg>' },
        { variant: 'minimal', svg: '<svg></svg>' },
    ],
}));

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

describe('StructureForgeScreen', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
    });

    it('stub: renders 4 structure variant cards', () => {
        render(<StructureForgeScreen />);
        expect(screen.getByText('Focused')).toBeTruthy();
        expect(screen.getByText('Contained')).toBeTruthy();
        expect(screen.getByText('Raw')).toBeTruthy();
        expect(screen.getByText('Drawn')).toBeTruthy();
    });

    it('stub: selects Dense variant on tap', () => {
        render(<StructureForgeScreen />);
        fireEvent.press(screen.getByLabelText('Contained structure'));
        expect(screen.getByText('Contained selected')).toBeTruthy();
    });

    it('stub: selects Balanced variant on tap', () => {
        render(<StructureForgeScreen />);
        // Focused is default — press it again to confirm it stays selected
        fireEvent.press(screen.getByLabelText('Focused structure'));
        expect(screen.getByText('Focused selected')).toBeTruthy();
    });

    it('stub: selects Minimal variant on tap', () => {
        render(<StructureForgeScreen />);
        fireEvent.press(screen.getByLabelText('Raw structure'));
        expect(screen.getByText('Raw selected')).toBeTruthy();
    });

    it('stub: navigates to ManualReinforcement after selection', () => {
        render(<StructureForgeScreen />);
        fireEvent.press(screen.getByLabelText('Begin Forging'));
        expect(mockNavigate).toHaveBeenCalledWith('ManualReinforcement', expect.objectContaining({
            intentionText: 'Test Intention',
            category: 'health',
        }));
    });

    it('stub: navigates to ManualForge for Drawn selection', () => {
        render(<StructureForgeScreen />);
        fireEvent.press(screen.getByLabelText('Drawn structure'));
        fireEvent.press(screen.getByLabelText('Draw Your Anchor'));
        expect(mockNavigate).toHaveBeenCalledWith('ManualForge', expect.objectContaining({
            intentionText: 'Test Intention',
            category: 'health',
            isFromScratch: true,
        }));
    });
});
