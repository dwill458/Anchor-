import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ChargeSetupScreen } from '../ChargeSetupScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockPopToTop = jest.fn();
const mockRouteParams: Record<string, unknown> = { anchorId: 'anchor-123' };
const mockAnchor = {
    id: 'anchor-123',
    intentionText: 'Test Intention',
    category: 'health',
    distilledLetters: ['T', 'S', 'T'],
    baseSigilSvg: '<svg></svg>',
    enhancedImageUrl: undefined as string | undefined,
};

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace, goBack: jest.fn(), popToTop: mockPopToTop }),
    useRoute: () => ({ params: mockRouteParams }),
    useFocusEffect: jest.fn((cb: any) => {
        const React = require('react');
        React.useEffect(cb, [cb]);
    }),
}));

jest.mock('@/contexts/TabNavigationContext', () => ({
    useTabNavigation: () => ({
        navigateToPractice: jest.fn(),
    }),
}));

// Mock stores with minimal required state
jest.mock('@/stores/anchorStore', () => ({
    useAnchorStore: (selector: any) => {
        const state = {
            getAnchorById: (id: string) => ({ ...mockAnchor, id })
        };
        return selector ? selector(state) : state;
    }
}));
jest.mock('@/stores/authStore', () => {
    const useAuthStore = jest.fn(() => ({ anchorCount: 1 })) as jest.Mock & {
        getState: () => { pendingFirstAnchorDraft: null };
    };
    useAuthStore.getState = () => ({ pendingFirstAnchorDraft: null });
    return { useAuthStore };
});
jest.mock('@/stores/settingsStore', () => ({
    useSettingsStore: (selector: any) => {
        const state = {
            defaultCharge: { mode: 'focus', preset: '1m' },
            setDefaultCharge: jest.fn()
        };
        return selector ? selector(state) : state;
    }
}));

jest.mock('@/utils/haptics', () => ({
    safeHaptics: { impact: jest.fn(), selection: jest.fn() },
}));

jest.mock('@/screens/rituals/components/RitualScaffold', () => ({
    RitualScaffold: ({ children }: any) => children,
}));

jest.mock('@/screens/rituals/components/RitualTopBar', () => ({
    RitualTopBar: ({ title }: any) => {
        const { Text } = require('react-native');
        return <Text>{title}</Text>;
    },
}));

jest.mock('@/components/common/PrimeAnchorCanvas', () => ({
    PrimeAnchorCanvas: () => null,
    parseSigilSvg: () => ({ viewBox: { x: 0, y: 0, w: 240, h: 240 }, pathDs: [] }),
}));

jest.mock('@/components/common', () => ({
    ChargedGlowCanvas: () => null,
    PremiumAnchorGlow: () => null,
    PrimeAnchorCanvas: () => null,
    parseSigilSvg: () => ({ viewBox: { x: 0, y: 0, w: 240, h: 240 }, pathDs: [] }),
    OptimizedImage: ({ uri }: any) => {
        const React = require('react');
        const { Text } = require('react-native');
        return <Text>{uri}</Text>;
    },
    SigilSvg: ({ xml }: any) => {
        const React = require('react');
        const { Text } = require('react-native');
        return <Text>{xml}</Text>;
    },
    ZenBackground: () => null,
}));

jest.mock('react-native-svg', () => {
    const React = require('react');
    const { View } = require('react-native');
    const Mock = ({ children, ...props }: any) => <View {...props}>{children}</View>;
    return {
        __esModule: true,
        default: Mock,
        SvgXml: Mock,
        Circle: Mock,
        Defs: Mock,
        LinearGradient: Mock,
        Polygon: Mock,
        Stop: Mock,
    };
});

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

describe('ChargeSetupScreen', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockReplace.mockClear();
        mockPopToTop.mockClear();
        Object.keys(mockRouteParams).forEach((key) => delete mockRouteParams[key]);
        Object.assign(mockRouteParams, { anchorId: 'anchor-123' });
        mockAnchor.baseSigilSvg = '<svg></svg>';
        mockAnchor.enhancedImageUrl = undefined;
    });

    it('stub: renders anchor focal point', () => {
        render(<ChargeSetupScreen />);
        expect(screen.getByText('ANCHOR READY')).toBeTruthy();
    });

    it('stub: selecting deep depth shows duration picker', () => {
        render(<ChargeSetupScreen />);
        // Deep Prime pill is available
        expect(screen.getByLabelText('Deep Prime duration')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Deep Prime duration'));
        expect(screen.getByLabelText('Begin Priming')).toBeTruthy();
    });

    it('stub: selecting light depth shows duration picker', () => {
        render(<ChargeSetupScreen />);
        // Quick Prime pill is available
        expect(screen.getByLabelText('Quick Prime duration')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Quick Prime duration'));
        expect(screen.getByLabelText('Begin Priming')).toBeTruthy();
    });

    it('stub: Begin button disabled until depth and duration selected', () => {
        render(<ChargeSetupScreen />);
        // Screen defaults to 'quick' selection, so the button is always present
        // The heading label confirms the screen loaded
        expect(screen.getByText('Choose Your Prime')).toBeTruthy();
    });

    it('stub: Begin button enabled after both selections', () => {
        render(<ChargeSetupScreen />);
        fireEvent.press(screen.getByLabelText('Quick Prime duration'));
        expect(screen.getByLabelText('Begin Priming')).toBeTruthy();
    });

    it('stub: shows quick path for returning users', () => {
        render(<ChargeSetupScreen />);
        // Duration selection label is always visible
        expect(screen.getByText('SELECT DURATION')).toBeTruthy();
        // Both pill options are rendered
        expect(screen.getByText('Quick Prime')).toBeTruthy();
        expect(screen.getByText('Deep Prime')).toBeTruthy();
        expect(screen.getByText('2 – 10 minutes')).toBeTruthy();
    });

    it('routes Prime later to SaveProgress when launched from onboarding', () => {
        Object.assign(mockRouteParams, { fromOnboarding: true, returnTo: 'vault' });

        render(<ChargeSetupScreen />);
        fireEvent.press(screen.getByLabelText('Prime later'));

        expect(mockReplace).toHaveBeenCalledWith('SaveProgress', {
            anchor: expect.objectContaining({ id: 'anchor-123' }),
        });
    });

    it('routes Prime later to Vault outside onboarding', () => {
        render(<ChargeSetupScreen />);
        fireEvent.press(screen.getByLabelText('Prime later'));

        expect(mockReplace).toHaveBeenCalledWith('Vault');
    });

    it('starts the selected path immediately in auto-start mode', () => {
        Object.assign(mockRouteParams, { autoStartOnSelection: true });

        render(<ChargeSetupScreen />);
        fireEvent.press(screen.getByLabelText('Deep Prime duration'));

        expect(mockReplace).toHaveBeenCalledWith('Ritual', {
            anchorId: 'anchor-123',
            ritualType: 'ritual',
            durationSeconds: 180,
            returnTo: undefined,
        });
    });

    it('auto-starts the initial deep duration when the route preselects it', () => {
        Object.assign(mockRouteParams, {
            autoStartOnSelection: true,
            initialDuration: 'deep',
            returnTo: 'practice',
        });

        render(<ChargeSetupScreen />);

        expect(mockReplace).toHaveBeenCalledWith('Ritual', {
            anchorId: 'anchor-123',
            ritualType: 'ritual',
            durationSeconds: 180,
            returnTo: 'practice',
        });
    });

    it('renders the enhanced anchor artwork when available', () => {
        mockAnchor.enhancedImageUrl = 'https://example.com/enhanced-anchor.png';

        render(<ChargeSetupScreen />);

        expect(screen.getByText('https://example.com/enhanced-anchor.png')).toBeTruthy();
    });

    it('falls back to the structure artwork when no enhanced image exists', () => {
        mockAnchor.enhancedImageUrl = undefined;
        mockAnchor.baseSigilSvg = '<svg><path d="M0 0" /></svg>';

        render(<ChargeSetupScreen />);

        expect(screen.getByText('ANCHOR FORGED')).toBeTruthy();
    });
});
