/**
 * Anchor App - Jest Setup
 *
 * Global test configuration and mocks
 */

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock Expo modules
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      reset: jest.fn(),
      setOptions: jest.fn(),
      setParams: jest.fn(),
      dispatch: jest.fn(),
      canGoBack: jest.fn(() => true),
      isFocused: jest.fn(() => true),
      addListener: jest.fn(() => jest.fn()),
      removeListener: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
      key: 'test-route-key',
      name: 'TestScreen',
    }),
    useFocusEffect: jest.fn((callback) => {
      if (typeof callback === 'function') {
        callback();
      }
      return jest.fn();
    }),
    useIsFocused: jest.fn(() => true),
    NavigationContainer: ({ children }: any) => children,
  };
});

// Mock react-native-svg
jest.mock('react-native-svg', () => ({
  SvgXml: 'SvgXml',
  Svg: 'Svg',
  Circle: 'Circle',
  Path: 'Path',
  G: 'G',
}));

// Mock Lucide icons - comprehensive mock for all commonly used icons
jest.mock('lucide-react-native', () => {
  const mockIcon = (name: string) => name;
  return new Proxy({}, {
    get: (target, prop) => {
      if (typeof prop === 'string') {
        return mockIcon(prop);
      }
      return undefined;
    }
  });
});

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Set up test timeout
jest.setTimeout(10000);
