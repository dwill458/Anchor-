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

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() =>
        Promise.resolve({
          sound: {
            replayAsync: jest.fn(() => Promise.resolve()),
            unloadAsync: jest.fn(() => Promise.resolve()),
          },
        })
      ),
    },
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    INTERRUPTION_MODE_IOS_DUCK_OTHERS: 1,
    INTERRUPTION_MODE_ANDROID_DUCK_OTHERS: 1,
  },
}));

jest.mock('expo-image', () => {
  const Image = () => null;
  Image.prefetch = jest.fn(() => Promise.resolve());
  return { Image };
});

// Mock native settings manager to avoid TurboModule errors in tests
jest.mock('react-native/Libraries/Settings/NativeSettingsManager', () => ({
  __esModule: true,
  default: {
    settings: {},
    getConstants: () => ({ settings: {} }),
  },
}));

// Mock analytics providers
jest.mock(
  'mixpanel-react-native',
  () => ({
    Mixpanel: jest.fn().mockImplementation(() => ({
      init: jest.fn(),
      track: jest.fn(),
      identify: jest.fn(),
      getPeople: jest.fn(() => ({
        set: jest.fn(),
        increment: jest.fn(),
      })),
      reset: jest.fn(),
    })),
  }),
  { virtual: true }
);

jest.mock(
  '@amplitude/analytics-react-native',
  () => ({
    createInstance: jest.fn(() => ({
      init: jest.fn(),
      track: jest.fn(),
      setUserId: jest.fn(),
      identify: jest.fn(),
      reset: jest.fn(),
    })),
    Identify: jest.fn().mockImplementation(() => ({
      set: jest.fn(),
      add: jest.fn(),
    })),
  }),
  { virtual: true }
);

// Mock Sentry
jest.mock(
  '@sentry/react-native',
  () => ({
    init: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setUser: jest.fn(),
    setContext: jest.fn(),
    setTag: jest.fn(),
    setExtra: jest.fn(),
  }),
  { virtual: true }
);

// Mock Firebase Performance
jest.mock(
  '@react-native-firebase/perf',
  () => {
    return () => ({
      startTrace: jest.fn(() =>
        Promise.resolve({
          putAttribute: jest.fn(),
          putMetric: jest.fn(),
          stop: jest.fn(),
        })
      ),
      setPerformanceCollectionEnabled: jest.fn(),
    });
  },
  { virtual: true }
);

// Mock reanimated to avoid native crashes in tests
jest.mock('react-native-reanimated', () => ({
  runOnJS: (fn: any) => fn,
}));

// Mock gesture handler for tests
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  return {
    GestureDetector: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    Gesture: {
      Pan: () => {
        const api: any = {};
        api.onStart = () => api;
        api.onUpdate = () => api;
        api.onEnd = () => api;
        return api;
      },
    },
  };
});

// Mock SafeAreaProvider
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    SafeAreaView: (props: any) =>
      React.createElement(View, props, props.children),
    useSafeAreaInsets: () => ({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    }),
  };
});

// Silence native animated helper warnings
jest.mock(
  'react-native/Libraries/Animated/NativeAnimatedHelper',
  () => ({}),
  { virtual: true }
);

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
    setOptions: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const createMock = () => (props: any) =>
    React.createElement(View, props, props.children);
  return {
    __esModule: true,
    default: createMock(),
    SvgXml: createMock(),
    Svg: createMock(),
    Circle: createMock(),
    Path: createMock(),
    G: createMock(),
  };
});

// Mock Lucide icons
jest.mock('lucide-react-native', () => ({
  Plus: 'Plus',
  X: 'X',
  Check: 'Check',
  AlertCircle: 'AlertCircle',
}));

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Set up test timeout
jest.setTimeout(10000);
