import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  AppState,
  StatusBar,
  View,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NavigationContainer,
  useNavigationContainerRef,
  type InitialState,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import {
  Cinzel_400Regular,
  Cinzel_600SemiBold,
  Cinzel_700Bold,
} from '@expo-google-fonts/cinzel';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  CrimsonPro_400Regular,
  CrimsonPro_400Regular_Italic,
} from '@expo-google-fonts/crimson-pro';
import { RootNavigator } from './src/navigation';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ToastProvider } from './src/components/ToastProvider';
import { useAuthStore } from './src/stores/authStore';
import { useSessionStore } from './src/stores/sessionStore';
import { useSettingsStore } from './src/stores/settingsStore';
import { SettingsRevealProvider } from './src/components/transitions/SettingsRevealProvider';
import type { RootNavigatorParamList } from './src/navigation/RootNavigator';
import type { Anchor } from './src/types';
import { ErrorTrackingService, setupGlobalErrorHandler } from './src/services/ErrorTrackingService';
import { PerformanceMonitoring, type PerformanceTrace } from './src/services/PerformanceMonitoring';
import { monitoringConfig } from './src/config/monitoring';
import { AuthService } from './src/services/AuthService';
import {
  syncDailyGoalNudgesFromStores,
  syncDailyReminderFromStores,
} from './src/services/DailyGoalNudgeService';
import { loadSettingsSnapshot } from './src/hooks/useSettings';
import { encryptedPersistStorage } from './src/stores/encryptedPersistStorage';
import { logger } from './src/utils/logger';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

if (!isWeb) {
  enableScreens(true);
}

const AppTheme = {
  dark: true,
  colors: {
    primary: '#D4AF37', // Gold
    background: 'transparent',
    card: '#1A1625',
    text: '#F5F5F1',
    border: 'rgba(212, 175, 55, 0.15)',
    notification: '#FF4444',
  },
};

const PRIME_ON_LAUNCH_KEY = '@anchor_prime_on_launch';
const ANCHOR_VAULT_STORAGE_KEY = 'anchor-vault-storage';
const PRIME_ON_LAUNCH_FADE_DURATION_MS = 300;

function parseStoredBoolean(rawValue: string | null): boolean {
  if (rawValue == null) {
    return false;
  }

  try {
    return JSON.parse(rawValue) === true;
  } catch {
    return rawValue === 'true' || rawValue === '1';
  }
}

function toMillis(value?: Date | string): number {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getMostRecentlyPrimedAnchorId(anchors: Anchor[]): string | undefined {
  return anchors
    .filter((anchor) => !anchor.isReleased && !anchor.archivedAt && anchor.chargedAt != null)
    .sort((left, right) => {
      const primedDelta = toMillis(right.chargedAt) - toMillis(left.chargedAt);
      if (primedDelta !== 0) return primedDelta;
      return toMillis(right.updatedAt) - toMillis(left.updatedAt);
    })[0]?.id;
}

function buildPrimeOnLaunchInitialState(anchorId: string): InitialState {
  return {
    index: 0,
    routes: [
      {
        name: 'Main',
        state: {
          index: 1,
          routes: [
            { name: 'Vault' },
            {
              name: 'ChargeSetup',
              params: {
                anchorId,
              },
            },
          ],
        },
      },
    ],
  };
}

async function resolvePrimeOnLaunchInitialState(): Promise<InitialState | undefined> {
  const primeOnLaunchEnabled = parseStoredBoolean(await AsyncStorage.getItem(PRIME_ON_LAUNCH_KEY));
  if (!primeOnLaunchEnabled) {
    return undefined;
  }

  const rawAnchorStore = await encryptedPersistStorage.getItem(ANCHOR_VAULT_STORAGE_KEY);
  if (!rawAnchorStore) {
    return undefined;
  }

  const parsedStore = JSON.parse(rawAnchorStore) as {
    state?: {
      anchors?: Anchor[];
    };
  };
  const persistedAnchors = Array.isArray(parsedStore.state?.anchors) ? parsedStore.state.anchors : [];
  const anchorId = getMostRecentlyPrimedAnchorId(persistedAnchors);

  if (!anchorId) {
    return undefined;
  }

  return buildPrimeOnLaunchInitialState(anchorId);
}

export default function App() {
  const computeStreak = useAuthStore((state) => state.computeStreak);
  const user = useAuthStore((state) => state.user);
  const dailyPracticeGoal = useSettingsStore((state) => state.dailyPracticeGoal);
  const dailyReminderEnabled = useSettingsStore((state) => state.dailyReminderEnabled);
  const dailyReminderTime = useSettingsStore((state) => state.dailyReminderTime);
  const lastSessionId = useSessionStore((state) => state.lastSession?.id);
  const navRef = useNavigationContainerRef<RootNavigatorParamList>();
  const routeNameRef = useRef<string | undefined>(undefined);
  const screenTraceRef = useRef<PerformanceTrace | null>(null);
  const launchOpacity = useRef(new Animated.Value(1)).current;
  const [settingsHydrated, setSettingsHydrated] = React.useState(false);
  const [launchStateResolved, setLaunchStateResolved] = React.useState(false);
  const [initialNavigationState, setInitialNavigationState] = React.useState<
    InitialState | undefined
  >(undefined);
  const [shouldFadePrimeOnLaunch, setShouldFadePrimeOnLaunch] = React.useState(false);
  const [fontsLoaded] = useFonts({
    'Cinzel-Regular': Cinzel_400Regular,
    'Cinzel-SemiBold': Cinzel_600SemiBold,
    'Cinzel-Bold': Cinzel_700Bold,
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'CrimsonPro-Regular': CrimsonPro_400Regular,
    'CrimsonPro-Italic': CrimsonPro_400Regular_Italic,
    'CormorantGaramond-Regular': CrimsonPro_400Regular,
    'CormorantGaramond-Italic': CrimsonPro_400Regular_Italic,
  });

  useEffect(() => {
    let isMounted = true;

    loadSettingsSnapshot()
      .catch((error) => {
        logger.error('Failed to hydrate settings snapshot', error);
      })
      .finally(() => {
        if (isMounted) {
          setSettingsHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    resolvePrimeOnLaunchInitialState()
      .then((initialState) => {
        if (!isMounted) {
          return;
        }

        setInitialNavigationState(initialState);
        const shouldFade = initialState != null;
        setShouldFadePrimeOnLaunch(shouldFade);
        launchOpacity.setValue(shouldFade ? 0 : 1);
      })
      .catch((error) => {
        logger.error('Failed to resolve Prime on Launch initial state', error);
      })
      .finally(() => {
        if (isMounted) {
          setLaunchStateResolved(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [launchOpacity]);

  useEffect(() => {
    if (!launchStateResolved || !shouldFadePrimeOnLaunch) {
      return;
    }

    Animated.timing(launchOpacity, {
      toValue: 1,
      duration: PRIME_ON_LAUNCH_FADE_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [launchOpacity, launchStateResolved, shouldFadePrimeOnLaunch]);

  useEffect(() => {
    AuthService.initialize();

    let isActive = true;
    let authStateVersion = 0;
    useAuthStore.getState().setLoading(true);

    const unsubscribe = AuthService.onAuthStateChanged(async (firebaseUser) => {
      const currentVersion = ++authStateVersion;

      if (!firebaseUser) {
        if (!isActive || currentVersion !== authStateVersion) {
          return;
        }

        const store = useAuthStore.getState();
        store.signOut();
        store.setLoading(false);
        return;
      }

      try {
        const session = await AuthService.syncCurrentUser();

        if (!isActive || currentVersion !== authStateVersion) {
          return;
        }

        const store = useAuthStore.getState();
        if (!session) {
          store.signOut();
          store.setLoading(false);
          return;
        }

        store.setSession(session.user, session.token);
      } catch (error) {
        if (!isActive || currentVersion !== authStateVersion) {
          return;
        }

        logger.error('Failed to restore authenticated session', error);
        const store = useAuthStore.getState();
        store.signOut();
        store.setLoading(false);
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    ErrorTrackingService.initialize({
      enabled: monitoringConfig.sentryEnabled,
      environment: monitoringConfig.environment,
      release: monitoringConfig.release,
      traceSampleRate: monitoringConfig.traceSampleRate,
      profileSampleRate: monitoringConfig.profileSampleRate,
    });
    setupGlobalErrorHandler();
    PerformanceMonitoring.initialize({ enabled: true });
  }, []);

  useEffect(() => {
    if (user?.id) {
      ErrorTrackingService.setUser(user.id, user.email, user.displayName);
      return;
    }

    ErrorTrackingService.clearUser();
  }, [user?.displayName, user?.email, user?.id]);

  useEffect(() => {
    if (!settingsHydrated) {
      return;
    }

    void syncDailyReminderFromStores();
  }, [dailyReminderEnabled, dailyReminderTime, settingsHydrated]);

  useEffect(() => {
    if (!settingsHydrated) {
      return;
    }

    void syncDailyGoalNudgesFromStores();
  }, [dailyPracticeGoal, dailyReminderEnabled, dailyReminderTime, lastSessionId, settingsHydrated]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        ErrorTrackingService.addBreadcrumb('App foregrounded', 'app_state', { nextState });
        computeStreak();
        if (settingsHydrated) {
          void syncDailyReminderFromStores();
          void syncDailyGoalNudgesFromStores();
        }
      } else {
        ErrorTrackingService.addBreadcrumb('App state changed', 'app_state', { nextState });
      }
    });
    return () => subscription.remove();
  }, [computeStreak, settingsHydrated]);

  useEffect(() => {
    return () => {
      screenTraceRef.current?.stop({ reason: 'app_unmount' });
      screenTraceRef.current = null;
    };
  }, []);

  if (!fontsLoaded || !launchStateResolved) {
    return <View style={styles.fontLoadingFallback} />;
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <View style={styles.webContainer}>
              <Animated.View style={[styles.appContainer, { opacity: launchOpacity }]}>
                <SettingsRevealProvider navigationRef={navRef}>
                  <NavigationContainer
                    ref={navRef}
                    initialState={initialNavigationState}
                    theme={AppTheme}
                    onReady={() => {
                      ErrorTrackingService.registerNavigationContainer(navRef);
                      const initialRouteName = navRef.getCurrentRoute()?.name;

                      if (!initialRouteName) {
                        return;
                      }

                      routeNameRef.current = initialRouteName;
                      ErrorTrackingService.trackNavigation(undefined, initialRouteName);
                      screenTraceRef.current = PerformanceMonitoring.startTrace(
                        `screen_${initialRouteName}`,
                        { route: initialRouteName }
                      );
                    }}
                    onStateChange={() => {
                      const previousRouteName = routeNameRef.current;
                      const currentRouteName = navRef.getCurrentRoute()?.name;

                      if (!currentRouteName || previousRouteName === currentRouteName) {
                        return;
                      }

                      screenTraceRef.current?.stop({
                        route: previousRouteName ?? 'unknown',
                        next_route: currentRouteName,
                      });

                      screenTraceRef.current = PerformanceMonitoring.startTrace(
                        `screen_${currentRouteName}`,
                        { from: previousRouteName ?? 'unknown', to: currentRouteName }
                      );

                      ErrorTrackingService.trackNavigation(previousRouteName, currentRouteName);
                      routeNameRef.current = currentRouteName;
                    }}
                  >
                    <StatusBar barStyle="light-content" backgroundColor="#1A1A1D" />
                    <RootNavigator />
                  </NavigationContainer>
                </SettingsRevealProvider>
              </Animated.View>
            </View>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ToastProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: '#000', // Black background outside the app on web
    justifyContent: 'center',
    alignItems: 'center',
  },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: isWeb ? 450 : undefined, // Mobile width on web
    maxHeight: isWeb ? 900 : undefined, // Mobile height on web
    backgroundColor: '#0F1419',
    overflow: 'hidden',
    // shadow for web
    ...Platform.select({
      web: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
        marginVertical: 20,
        borderRadius: 20,
      }
    })
  },
  fontLoadingFallback: {
    flex: 1,
    backgroundColor: '#09060f',
  },
});
