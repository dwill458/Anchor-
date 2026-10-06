import React from 'react';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import IntentionInputScreen from '../IntentionInputScreen';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => false }),
    useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]),
    useRoute: () => ({ params: {} }),
}));

// Mock stores with minimal required state (selector-aware, matching zustand's API)
jest.mock('@/stores/anchorStore', () => ({
    useAnchorStore: (selector?: (state: Record<string, unknown>) => unknown) => {
        const state = { anchors: [], isLoading: false };
        return selector ? selector(state) : state;
    },
}));
jest.mock('@/stores/authStore', () => ({
    useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
        const state = { user: null, anchorCount: 0, isAuthenticated: false };
        return selector ? selector(state) : state;
    },
}));

jest.mock('@/stores/teachingStore', () => ({
    useTeachingStore: () => ({ recordShown: jest.fn() }),
}));
jest.mock('@/utils/useTeachingGate', () => ({
    useTeachingGate: () => null,
}));
jest.mock('@/services/AnalyticsService', () => ({
    AnalyticsService: { track: jest.fn() },
}));
const mockWarmUp = jest.fn();
jest.mock('@/services/backendWarmup', () => ({
    warmUpBackend: () => mockWarmUp(),
}));
jest.mock('@/utils/categoryDetection', () => ({
    detectCategoryFromText: () => 'custom',
}));

describe('IntentionInputScreen', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockWarmUp.mockClear();
        // Continue writes the draft; each test starts from an empty field.
        useFirstAnchorFlowStore.getState().clearDraft();
        jest.useFakeTimers();
    });

    afterEach(() => {
        act(() => { jest.advanceTimersByTime(1000); });
        jest.clearAllTimers();
        act(() => { cleanup(); });
        jest.useRealTimers();
    });

    it('renders the cream Intention layout', () => {
        render(<IntentionInputScreen />);
        expect(screen.getByText('INTENTION')).toBeTruthy();
        expect(screen.getByText('Every Anchor starts')).toBeTruthy();
        expect(screen.getByText('here.')).toBeTruthy();
        expect(screen.getByText('Write one clear intention.')).toBeTruthy();
        expect(screen.getByText('YOUR INTENTION')).toBeTruthy();
        expect(screen.getByText('0/100')).toBeTruthy();
        expect(screen.getByText('Continue →')).toBeTruthy();
        expect(screen.getByText('Or draw it yourself')).toBeTruthy();
    });

    it('shows the static hint pair before anything is typed', () => {
        render(<IntentionInputScreen />);
        expect(screen.getByText('“I want to stop getting distracted.”')).toBeTruthy();
        expect(screen.getByText('“I am fully present with my work.”')).toBeTruthy();
        expect(screen.getByText('Three rules for a stronger intention.')).toBeTruthy();
    });

    it('gives the info glyph a 45 pt target', () => {
        render(<IntentionInputScreen />);
        expect(screen.getByRole('button', { name: 'About the three rules' }).props.hitSlop).toBe(14);
    });

    it('keeps the principles legible and the draw link at least 44 pt high', () => {
        render(<IntentionInputScreen />);
        fireEvent.changeText(screen.getByLabelText('Your intention'), 'Stay calm');
        expect(StyleSheet.flatten(screen.getByText('SHORT  ·  PRESENT  ·  FELT').props.style).fontSize).toBe(12);
        const link = screen.getByText('Or draw it yourself');
        expect(StyleSheet.flatten(link.props.style)).toMatchObject({ fontSize: 14, opacity: 0.8 });
        let face = link.parent;
        while (face && !StyleSheet.flatten(face.props.style)?.minHeight) face = face.parent;
        expect(StyleSheet.flatten(face!.props.style).minHeight).toBeGreaterThanOrEqual(44);
    });

    it('disables Continue button when input is empty', () => {
        render(<IntentionInputScreen />);
        expect(screen.getByRole('button', { name: 'Continue' }).props.accessibilityState?.disabled).toBe(true);
    });

    it('enables Continue button after valid input', async () => {
        render(<IntentionInputScreen />);
        const input = screen.getByLabelText('Your intention');
        fireEvent.changeText(input, 'Stay calm under pressure');
        act(() => { jest.advanceTimersByTime(500); });
        const continueBtn = screen.getByRole('button', { name: 'Continue' });
        expect(continueBtn.props.accessibilityState?.disabled).not.toBe(true);
        expect(screen.getByText('24/100')).toBeTruthy();
    });

    it('enforces 100 character max length', () => {
        render(<IntentionInputScreen />);
        const input = screen.getByLabelText('Your intention');
        const longText = 'a'.repeat(110);
        fireEvent.changeText(input, longText);
        // The input applies maxLength={100} so text longer than 100 chars won't be accepted
        expect(input.props.maxLength).toBe(100);
    });

    it('stays silent while typing and checks consonants once, on Continue', () => {
        render(<IntentionInputScreen />);
        const input = screen.getByLabelText('Your intention');

        fireEvent.changeText(input, 'aaa eee ooo');
        act(() => { jest.advanceTimersByTime(500); });
        expect(screen.queryByText('Use at least two different consonants.')).toBeNull();
        fireEvent(input, 'blur');
        expect(screen.queryByText('Use at least two different consonants.')).toBeNull();

        fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByText('Use at least two different consonants.')).toBeTruthy();
        expect(mockNavigate).not.toHaveBeenCalledWith('AnchorCreationFlow', expect.anything());

        // Editing clears it, and a valid intention goes through.
        fireEvent.changeText(input, 'aaa bcd ooo');
        expect(screen.queryByText('Use at least two different consonants.')).toBeNull();
    });

    it.each([
        ['health', 'I am healthy, strong, and full of energy', 'I nourish my body every day.'],
        ['career', 'I do work I’m proud of', 'I am trusted with work that matters.'],
        ['relationships', 'I am surrounded by people who love me', 'I show up fully for the people I love.'],
        ['abundance', 'I am financially free', 'Money flows to me through work I love.'],
        ['family', 'My family is close and thriving', 'I am present with my family every day.'],
    ] as const)('frames the field for %s with a true placeholder and its own tip', (category, placeholder, tryLine) => {
        render(<IntentionInputScreen fromOnboarding chosenCategory={category} />);
        const input = screen.getByLabelText('Your intention');
        expect(input.props.value).toBe('');
        expect(input.props.placeholder).toBe(placeholder);
        expect(screen.getByText(`“${tryLine}”`)).toBeTruthy();
    });

    it('gives "Something else" the open placeholder and a plain tip', () => {
        render(<IntentionInputScreen fromOnboarding />);
        expect(screen.getByLabelText('Your intention').props.placeholder).toBe('I am becoming who I’m meant to be');
        expect(screen.getByText('Write it as if it’s already true.')).toBeTruthy();
    });

    it('goes to the creation flow on Continue and wakes the backend', () => {
        render(<IntentionInputScreen />);
        const input = screen.getByLabelText('Your intention');
        fireEvent.changeText(input, 'Stay calm under pressure');
        act(() => { jest.advanceTimersByTime(500); });
        fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
        // The field measurement falls back to a centred fade if it does not arrive.
        act(() => { jest.advanceTimersByTime(300); });

        expect(mockWarmUp).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith('AnchorCreationFlow', expect.objectContaining({
            intentionText: 'Stay calm under pressure',
            source: 'typed',
            category: 'custom',
        }));
        expect(mockNavigate).not.toHaveBeenCalledWith('LetterDistillation', expect.anything());
    });

    it('carries the onboarding continuation and selected category into the new flow', () => {
        render(<IntentionInputScreen fromOnboarding chosenCategory="health" />);
        fireEvent.changeText(screen.getByLabelText('Your intention'), 'Stay calm under pressure');
        act(() => { jest.advanceTimersByTime(500); });
        fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
        act(() => { jest.advanceTimersByTime(300); });
        expect(mockNavigate).toHaveBeenCalledWith('AnchorCreationFlow', expect.objectContaining({
            fromOnboarding: true, category: 'health', source: 'typed',
        }));
    });

    it('keeps the onboarding continuation when drawing an Anchor', () => {
        render(<IntentionInputScreen fromOnboarding />);
        fireEvent.changeText(screen.getByLabelText('Your intention'), 'Stay calm');
        fireEvent.press(screen.getByRole('button', { name: 'Or draw it yourself' }));
        act(() => { jest.advanceTimersByTime(300); });
        expect(mockNavigate).toHaveBeenCalledWith('AnchorCreationFlow', expect.objectContaining({
            fromOnboarding: true, source: 'drawn',
        }));
    });

    it('offers onboarding Back even when the navigation stack starts here', () => {
        const onBack = jest.fn();
        render(<IntentionInputScreen fromOnboarding onBack={onBack} />);
        fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('offers a draw path once there is at least one character', () => {
        render(<IntentionInputScreen />);
        expect(
            screen.getByRole('button', { name: 'Or draw it yourself' }).props.accessibilityState?.disabled
        ).toBe(true);

        const input = screen.getByLabelText('Your intention');
        fireEvent.changeText(input, 'Calm');
        expect(
            screen.getByRole('button', { name: 'Or draw it yourself' }).props.accessibilityState?.disabled
        ).not.toBe(true);

        fireEvent.press(screen.getByRole('button', { name: 'Or draw it yourself' }));
        act(() => { jest.advanceTimersByTime(300); });

        expect(mockNavigate).toHaveBeenCalledWith('AnchorCreationFlow', expect.objectContaining({
            intentionText: 'Calm',
            source: 'drawn',
        }));
    });

    it('opens the rules sheet from the info button', () => {
        render(<IntentionInputScreen />);
        fireEvent.press(screen.getByLabelText('About the three rules'));
        expect(screen.getByText('Short. Present. Felt.')).toBeTruthy();
    });

    it.each([
        'zzzzzz',
        'I will focus today',
        "I don't check social media",
    ])('shows no inline guidance while typing %s', (text) => {
        render(<IntentionInputScreen />);
        fireEvent.changeText(screen.getByLabelText('Your intention'), text);
        expect(screen.queryByText(/doesn't look like an intention/)).toBeNull();
        expect(screen.queryByText(/Try present tense/)).toBeNull();
        expect(screen.queryByText(/Try affirmative/)).toBeNull();
    });

    it('says an unreadable intention is not one only when Continue is pressed', () => {
        render(<IntentionInputScreen />);
        fireEvent.changeText(screen.getByLabelText('Your intention'), 'bcbcbcbcbc');
        fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByText("That doesn't look like an intention. What do you actually want?")).toBeTruthy();
        expect(mockNavigate).not.toHaveBeenCalledWith('AnchorCreationFlow', expect.anything());
    });

    it('resets the intention text and clears the draft on fresh entry even if previous draft existed', () => {
        // Simulate a stale draft left in the store from a previous session
        useFirstAnchorFlowStore.getState().updateDraft({
            originalIntention: 'I get stronger and strgonger everyday',
            distilledLetters: ['g', 't', 's', 'r', 'n', 'd', 'v', 'y'],
            generationStatus: 'complete',
        });

        render(<IntentionInputScreen />);
        const input = screen.getByLabelText('Your intention');
        // Must reset to empty string on fresh entry
        expect(input.props.value).toBe('');
        expect(screen.getByText('0/100')).toBeTruthy();
        expect(useFirstAnchorFlowStore.getState().draft).toBeNull();
    });

    it('resets the intention text and clears draft on Back button press', () => {
        const onBack = jest.fn();
        render(<IntentionInputScreen onBack={onBack} />);
        const input = screen.getByLabelText('Your intention');
        fireEvent.changeText(input, 'I am fully present');
        expect(input.props.value).toBe('I am fully present');

        fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
        expect(onBack).toHaveBeenCalledTimes(1);
        expect(useFirstAnchorFlowStore.getState().draft).toBeNull();
    });
});
