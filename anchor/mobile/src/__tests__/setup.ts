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

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  saveToLibraryAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
  EncodingType: {
    Base64: 'base64',
  },
}));

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();

  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@sentry/react-native', () => {
  const addBreadcrumb = jest.fn();
  const routingIntegration = {
    registerNavigationContainer: jest.fn(),
  };
  return {
    init: jest.fn(),
    setTag: jest.fn(),
    setUser: jest.fn(),
    setContext: jest.fn(),
    addBreadcrumb,
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    withScope: (callback: any) =>
      callback({
        setContext: jest.fn(),
        setExtra: jest.fn(),
      }),
    reactNavigationIntegration: jest.fn(() => routingIntegration),
    reactNativeTracingIntegration: jest.fn(() => ({ name: 'tracing-integration' })),
  };
});

jest.mock('@shopify/react-native-skia', () => {
  // ChargedGlowCanvas uses Skia.Paint(), Skia.PictureRecorder(), PaintStyle,
  // Picture, and TileMode. Provide minimal stubs so modules load without the
  // native Skia runtime that is unavailable in Jest.
  const makePaint = (): any => ({
    setColor: jest.fn(),
    setStyle: jest.fn(),
    setStrokeWidth: jest.fn(),
    setAlpha: jest.fn(),
    setAntiAlias: jest.fn(),
    setBlendMode: jest.fn(),
    setMaskFilter: jest.fn(),
    setShader: jest.fn(),
    copy: jest.fn((): any => makePaint()),
  });

  return {
    Canvas: 'Canvas',
    Circle: 'Circle',
    Group: 'Group',
    Line: 'Line',
    BlurMask: 'BlurMask',
    Picture: 'Picture',
    PaintStyle: { Fill: 'Fill', Stroke: 'Stroke' },
    TileMode: { Clamp: 'Clamp', Repeat: 'Repeat', Mirror: 'Mirror', Decal: 'Decal' },
    Skia: {
      Paint: jest.fn(() => makePaint()),
      PictureRecorder: jest.fn(() => ({
        beginRecording: jest.fn(() => ({
          drawPaint: jest.fn(),
          drawPicture: jest.fn(),
          drawCircle: jest.fn(),
          drawLine: jest.fn(),
          save: jest.fn(),
          restore: jest.fn(),
          scale: jest.fn(),
          translate: jest.fn(),
          rotate: jest.fn(),
          concat: jest.fn(),
          clipRect: jest.fn(),
        })),
        finishRecordingAsPicture: jest.fn(() => ({})),
      })),
      Color: jest.fn((c: unknown) => c),
      Matrix: jest.fn(() => ({})),
      XYWHRect: jest.fn((x: number, y: number, w: number, h: number) => ({ x, y, w, h })),
      Shader: {
        MakeRadialGradient: jest.fn(() => ({})),
        MakeLinearGradient: jest.fn(() => ({})),
        MakeTwoPointConicalGradient: jest.fn(() => ({})),
      },
    },
  };
});

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
  __esModule: true,
  default: 'Svg',
  SvgXml: 'SvgXml',
  Svg: 'Svg',
  Circle: 'Circle',
  Ellipse: 'Ellipse',
  Path: 'Path',
  G: 'G',
  Line: 'Line',
  Polyline: 'Polyline',
  Rect: 'Rect',
  Defs: 'Defs',
  Stop: 'Stop',
  LinearGradient: 'LinearGradient',
  RadialGradient: 'RadialGradient',
}));

jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

jest.mock('react-native-view-shot', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockViewShot = React.forwardRef(({ children }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      capture: jest.fn(() => Promise.resolve('file:///tmp/anchor-export.png')),
    }));

    return React.createElement(View, null, children);
  });

  return {
    __esModule: true,
    default: MockViewShot,
    captureRef: jest.fn(() => Promise.resolve('file:///tmp/anchor-export.png')),
  };
});

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

// ChargedGlowCanvas is a GPU animation component that depends on native Skia.
// Mock it globally so screen tests don't need to provide a full Skia environment.
jest.mock('@/components/common/ChargedGlowCanvas', () => ({
  ChargedGlowCanvas: () => null,
}));

// Mock @react-native-firebase — native modules are unavailable in Jest (node env)
jest.mock('@react-native-firebase/app', () => ({}));
jest.mock('@react-native-firebase/auth', () => {
  const mockUser = null;
  const authInstance = {
    currentUser: mockUser,
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn((_cb: unknown) => jest.fn()),
  };
  const mockAuth = jest.fn(() => authInstance);
  (mockAuth as any).FirebaseAuthTypes = {};
  return { __esModule: true, default: mockAuth, FirebaseAuthTypes: {} };
});

// Mock AuthService to prevent the Firebase import chain from blowing up in tests
jest.mock('@/services/AuthService', () => ({
  AuthService: {
    getIdToken: jest.fn().mockResolvedValue(null),
    getCurrentUser: jest.fn().mockReturnValue(null),
    getCachedUser: jest.fn().mockResolvedValue(null),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock TabNavigationContext — screens using useTabNavigation() need a provider
jest.mock('@/contexts/TabNavigationContext', () => ({
  TabNavigationProvider: ({ children }: any) => children,
  useTabNavigation: jest.fn(() => ({
    navigateToTab: jest.fn(),
    navigateToVault: jest.fn(),
    navigateToPractice: jest.fn(),
    registerTabNav: jest.fn(),
    activeTabIndex: 0,
    currentTab: 'Vault',
  })),
}));

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Set up test timeout
jest.setTimeout(10000);
