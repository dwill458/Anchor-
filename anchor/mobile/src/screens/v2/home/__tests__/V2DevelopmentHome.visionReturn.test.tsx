import { fireEvent, render, screen } from '@testing-library/react-native';

const mockSetParams = jest.fn();
let mockParams: Record<string, unknown> | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), setParams: mockSetParams }),
  useRoute: () => ({ name: 'V2DevelopmentHome', key: 'k', params: mockParams }),
}));
jest.mock('@/hooks/v2/paywall', () => ({ useV2AnchorCreationGate: () => ({ evaluate: () => ({ allowed: true }) }) }));
jest.mock('@/utils/premiumAccess', () => ({ isProFeatureLocked: () => false }));
jest.mock('@/utils/v2DevSeeder', () => ({ seedV2DemoAnchor: jest.fn() }));
jest.mock('../V2DevFloatingToolbar', () => ({ V2DevFloatingToolbar: () => null }));
jest.mock('../dailyShell', () => {
  const { Pressable: Press, Text: Label } = require('react-native');
  const { useVisionHomeReturnRequest } = require('../visionHomeReturn');
  return {
    V2DailyShellNavigator: () => {
      const { request, consume } = useVisionHomeReturnRequest();
      return <Press testID="take" onPress={consume}><Label testID="request">{request ? `${request.anchorId}:${request.nonce}` : 'none'}</Label></Press>;
    },
  };
});

import { V2DevelopmentHome } from '../V2DevelopmentHome';

describe('V2DevelopmentHome vision return', () => {
  beforeEach(() => { jest.clearAllMocks(); mockParams = undefined; });
  it('carries the route param to Home, and clears it when Home takes it', () => {
    mockParams = { visionReturn: { anchorId: 'a', nonce: 5 } };
    render(<V2DevelopmentHome />);
    expect(screen.getByTestId('request').props.children).toBe('a:5');
    expect(mockSetParams).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('take'));
    expect(mockSetParams).toHaveBeenCalledTimes(1);
    expect(mockSetParams).toHaveBeenCalledWith({ visionReturn: undefined });
  });
  it('passes nothing when the route has no param', () => {
    render(<V2DevelopmentHome />);
    expect(screen.getByTestId('request').props.children).toBe('none');
  });
});
