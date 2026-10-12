import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import IntentionInputScreen from '../IntentionInputScreen';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';

const mockNavigate = jest.fn();
let mockRouteParams: Record<string, unknown> = {};
let mockEntitlements: Record<string, unknown> = {};
let mockAuth = { user: { id: 'u1' }, anchorCount: 1, isAuthenticated: true };

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => true }),
    useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]),
    useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('@/hooks/useEntitlements', () => ({ useEntitlements: () => mockEntitlements }));
jest.mock('@/stores/anchorStore', () => ({
    useAnchorStore: (selector?: (state: Record<string, unknown>) => unknown) => {
        const state = { anchors: [{ id: 'a1' }], isLoading: false };
        return selector ? selector(state) : state;
    },
}));
jest.mock('@/stores/authStore', () => ({
    useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => (selector ? selector(mockAuth) : mockAuth),
}));
jest.mock('@/stores/teachingStore', () => ({ useTeachingStore: () => ({ recordShown: jest.fn() }) }));
jest.mock('@/utils/useTeachingGate', () => ({ useTeachingGate: () => null }));
jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));
jest.mock('@/services/backendWarmup', () => ({ warmUpBackend: jest.fn() }));
jest.mock('@/utils/categoryDetection', () => ({ detectCategoryFromText: () => 'custom' }));

const OPEN = { canCreateAnchor: true, anchorCreationLimitReason: null, anchorsCreatedToday: 1, anchorsCreatedDuringTrial: 0, tier: 'free' };
const FREE_LOCKED = { ...OPEN, canCreateAnchor: false, anchorCreationLimitReason: 'create_anchor_free_locked' };
const DAILY_CAP = { ...OPEN, canCreateAnchor: false, anchorCreationLimitReason: 'pro_daily_anchor_cap_reached', tier: 'pro' };

function continueToCreation() {
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    act(() => { jest.advanceTimersByTime(300); });
}

describe('IntentionInputScreen: Evolve', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockRouteParams = {};
        mockEntitlements = OPEN;
        mockAuth = { user: { id: 'u1' }, anchorCount: 1, isAuthenticated: true };
        useFirstAnchorFlowStore.getState().clearDraft();
        jest.useFakeTimers();
    });
    afterEach(() => {
        act(() => { jest.advanceTimersByTime(1000); });
        jest.clearAllTimers();
        act(() => { cleanup(); });
        jest.useRealTimers();
    });

    it('starts with the old intention in the field and lets the user edit it', () => {
        mockRouteParams = { initialIntention: 'Publish my novel', evolve: { fromAnchorId: 'old-1' } };
        render(<IntentionInputScreen />);
        const input = screen.getByLabelText('Your intention');
        expect(input.props.value).toBe('Publish my novel');
        expect(screen.getByText('16/100')).toBeTruthy();
        fireEvent.changeText(input, 'Finish my novel this year');
        expect(screen.getByLabelText('Your intention').props.value).toBe('Finish my novel this year');
    });

    it('carries the evolve marker into creation with the (possibly edited) intention', () => {
        mockRouteParams = { initialIntention: 'Publish my novel', evolve: { fromAnchorId: 'old-1' } };
        render(<IntentionInputScreen />);
        continueToCreation();
        expect(mockNavigate).toHaveBeenCalledWith('AnchorCreationFlow', expect.objectContaining({
            intentionText: 'Publish my novel', source: 'typed', evolve: { fromAnchorId: 'old-1' },
        }));
    });

    it('starts creation once when Continue is tapped twice in a row', () => {
        mockRouteParams = { initialIntention: 'Publish my novel', evolve: { fromAnchorId: 'old-1' } };
        render(<IntentionInputScreen />);
        const button = screen.getByRole('button', { name: 'Continue' });
        fireEvent.press(button);
        fireEvent.press(button);
        act(() => { jest.advanceTimersByTime(1000); });
        expect(mockNavigate.mock.calls.filter(([name]) => name === 'AnchorCreationFlow')).toHaveLength(1);
    });

    it('is unchanged without the marker: empty field, no evolve param', () => {
        render(<IntentionInputScreen />);
        expect(screen.getByLabelText('Your intention').props.value).toBe('');
        fireEvent.changeText(screen.getByLabelText('Your intention'), 'Stay calm under pressure');
        continueToCreation();
        const params = mockNavigate.mock.calls.find(([name]) => name === 'AnchorCreationFlow')?.[1];
        expect(params).toBeDefined();
        expect(params).not.toHaveProperty('evolve');
    });

    it('ignores initialIntention when the evolve marker is absent', () => {
        mockRouteParams = { initialIntention: 'Publish my novel' };
        render(<IntentionInputScreen />);
        expect(screen.getByLabelText('Your intention').props.value).toBe('');
    });

    it('never starts above the field limit', () => {
        mockRouteParams = { initialIntention: 'a'.repeat(140), evolve: { fromAnchorId: 'old-1' } };
        render(<IntentionInputScreen />);
        expect(screen.getByLabelText('Your intention').props.value).toHaveLength(100);
    });

    describe('second-Anchor count gate', () => {
        it('still sends a free user with an Anchor to the paywall when not evolving', () => {
            mockEntitlements = FREE_LOCKED;
            mockRouteParams = {};
            render(<IntentionInputScreen />);
            fireEvent.changeText(screen.getByLabelText('Your intention'), 'Stay calm under pressure');
            continueToCreation();
            expect(mockNavigate).toHaveBeenCalledWith('Paywall', expect.objectContaining({ source: 'create_anchor_free_locked' }));
            expect(mockNavigate).not.toHaveBeenCalledWith('AnchorCreationFlow', expect.anything());
        });

        it('sends a free user to the paywall at Continue when evolving: Evolve is a paid path', () => {
            mockEntitlements = FREE_LOCKED;
            mockRouteParams = { initialIntention: 'Publish my novel', evolve: { fromAnchorId: 'old-1' } };
            render(<IntentionInputScreen />);
            continueToCreation();
            expect(mockNavigate).toHaveBeenCalledWith('Paywall', expect.objectContaining({ source: 'create_anchor_free_locked' }));
            expect(mockNavigate).not.toHaveBeenCalledWith('AnchorCreationFlow', expect.anything());
        });

        it('does not let Evolve past the Pro daily cap', () => {
            mockEntitlements = DAILY_CAP;
            mockRouteParams = { initialIntention: 'Publish my novel', evolve: { fromAnchorId: 'old-1' } };
            const alert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => undefined);
            render(<IntentionInputScreen />);
            continueToCreation();
            expect(alert).toHaveBeenCalled();
            expect(mockNavigate).not.toHaveBeenCalledWith('AnchorCreationFlow', expect.anything());
            alert.mockRestore();
        });
    });
});
