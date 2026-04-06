import React from 'react';
import { render, fireEvent, screen, act } from '@testing-library/react-native';
import IntentionInputScreen from '../IntentionInputScreen';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    useRoute: () => ({ params: {} }),
}));

// Mock stores with minimal required state
jest.mock('@/stores/anchorStore', () => ({ useAnchorStore: () => ({ anchors: [], isLoading: false }) }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: null, anchorCount: 0 }) }));

jest.mock('@/stores/teachingStore', () => ({
    useTeachingStore: () => ({ recordShown: jest.fn() }),
}));
jest.mock('@/utils/useTeachingGate', () => ({
    useTeachingGate: () => null,
}));
jest.mock('@/services/AnalyticsService', () => ({
    AnalyticsService: { track: jest.fn() },
}));
jest.mock('@/utils/sigil/distillation', () => ({
    distillIntention: (text: string) => ({ finalLetters: text.split(' ').map((w: string) => w[0].toUpperCase()) }),
}));
jest.mock('@/utils/categoryDetection', () => ({
    detectCategoryFromText: () => 'custom',
}));
jest.mock('@/components/common', () => ({
    ZenBackground: () => null,
    UndertoneLine: ({ text }: any) => {
        const { Text } = require('react-native');
        return <Text>{text}</Text>;
    },
}));

describe('IntentionInputScreen', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
    });

    it('stub: renders correctly', () => {
        render(<IntentionInputScreen />);
        expect(screen.getByText('What are you anchoring right now?')).toBeTruthy();
        expect(screen.getByText('Continue')).toBeTruthy();
    });

    it('stub: disables Continue button when input is empty', () => {
        render(<IntentionInputScreen />);
        const continueBtn = screen.getByAccessibilityState({ disabled: true });
        expect(continueBtn).toBeTruthy();
    });

    it('stub: enables Continue button after valid input', async () => {
        jest.useFakeTimers();
        render(<IntentionInputScreen />);
        const input = screen.getByLabelText('What are you anchoring right now?');
        fireEvent.changeText(input, 'Stay calm under pressure');
        act(() => { jest.advanceTimersByTime(500); });
        const continueBtn = screen.getByRole('button', { name: 'Continue' });
        expect(continueBtn.props.accessibilityState?.disabled).not.toBe(true);
        jest.useRealTimers();
    });

    it('stub: enforces 100 character max length', () => {
        render(<IntentionInputScreen />);
        const input = screen.getByLabelText('What are you anchoring right now?');
        const longText = 'a'.repeat(110);
        fireEvent.changeText(input, longText);
        // The input applies maxLength={100} so text longer than 100 chars won't be accepted
        expect(input.props.maxLength).toBe(100);
    });

    it('stub: navigates to DistillationAnimation on submit', () => {
        jest.useFakeTimers();
        render(<IntentionInputScreen />);
        const input = screen.getByLabelText('What are you anchoring right now?');
        fireEvent.changeText(input, 'Stay calm under pressure');
        act(() => { jest.advanceTimersByTime(500); });
        fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
        expect(mockNavigate).toHaveBeenCalledWith('LetterDistillation', expect.objectContaining({
            intentionText: 'Stay calm under pressure',
        }));
        jest.useRealTimers();
    });
});
