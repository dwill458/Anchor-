import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import {
  AppState,
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import type { DevicePushToken } from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CommonActions,
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
import { Figtree_400Regular, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  CrimsonPro_400Regular,
  CrimsonPro_400Regular_Italic,
} from '@expo-google-fonts/crimson-pro';
import {
  EBGaramond_400Regular,
  EBGaramond_400Regular_Italic,
  EBGaramond_500Medium,
  EBGaramond_600SemiBold,
} from '@expo-google-fonts/eb-garamond';
import { RootNavigator } from './src/navigation';
import { AnchorV2Navigator } from './src/navigation/v2';
import { ANCHOR_V2_ROUTES } from './src/navigation/v2/routes';
import { NotificationCoordinator } from './src/services/notifications/NotificationCoordinator';
import { parseChartNotificationTarget } from './src/services/notifications/chartNotifications';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ToastProvider } from './src/components/ToastProvider';
import { V2DialogHost, V2DialogManager } from './src/components/v2';
V2DialogManager.installAlertBridge();
import { useAuthStore } from './src/stores/authStore';
import { useAnchorStore } from './src/stores/anchorStore';
import { useFirstRunStore } from './src/stores/v2/firstRunStore';
import { useSessionStore } from './src/stores/sessionStore';
import { useLocationPrimingStore } from './src/stores/locationPrimingStore';
import { useVisualizationSceneStore } from './src/stores/visualizationSceneStore';
import { useSettingsStore } from './src/stores/settingsStore';
import { SettingsRevealProvider } from './src/components/transitions/SettingsRevealProvider';
import type { RootNavigatorParamList } from './src/navigation/RootNavigator';
import { shouldShowOnboardingFlow } from './src/navigation/rootNavigationState';
import type { Anchor } from './src/types';
import { ErrorTrackingService, setupGlobalErrorHandler } from './src/services/ErrorTrackingService';
import { PerformanceMonitoring, type PerformanceTrace } from './src/services/PerformanceMonitoring';
import { FrictionAnalytics } from './src/services/FrictionAnalytics';
import { monitoringConfig } from './src/config/monitoring';
import { AuthService } from './src/services/AuthService';
import { subscribeToAppAuthState } from './src/services/AppAuthBootstrap';
import { handleUnauthenticatedAuthRestore } from './src/services/appAuthState';
import { StartupRestoreFailure } from './src/components/startup/StartupRestoreFailure';
import { useRequiredLocalHydrationGuard } from './src/hooks/useRequiredLocalHydrationGuard';

import { loadSettingsSnapshot } from './src/hooks/useSettings';
import { encryptedPersistStorage, readSecureValue } from './src/stores/encryptedPersistStorage';
import { logger } from './src/utils/logger';
import revenueCatService from './src/services/RevenueCatService';
import NotificationService from './src/services/NotificationService';
import { AnalyticsEvents, AnalyticsService } from './src/services/AnalyticsService';
import {
  clearPushTokensFromServer,
  syncPushTokensToServer,
} from './src/services/NotificationSyncService';
import { initWidgetDataSync } from './src/widgets/widgetDataBridge';
import { WIDGETS_ENABLED } from './src/config';
import { isAnchorV2Enabled } from './src/config/v2FeatureFlag';
import { isChartOpeningPreviewEnabled } from './src/config/chartOpeningPreview';
import { useAppStartup } from './src/hooks/useAppStartup';
import { ChartLabDevHost } from './src/screens/v2/system/ChartLabDevHost';
import { VisionVisualQADevHost } from './src/screens/v2/system/VisionVisualQADevHost';
import { CreationFlowQADevHost } from './src/screens/create/flow/dev/CreationFlowQADevHost';
import { SplashController } from './src/components/splash/SplashController';
import { SPLASH_BACKGROUND_COLOR } from './src/components/splash/splashAnimation.constants';
import { perfLog, startJsStallDetector, startPerfRenderReporter } from './src/utils/perfDiagnostics';

const isWeb = Platform.OS === 'web';
// V2 remains opt-in. Staging preview APKs can exercise the release-mode V2 app,
// while production builds remain on the legacy navigator until rollout.
const anchorV2Enabled = isAnchorV2Enabled(
  process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED,
  __DEV__,
  process.env.EXPO_PUBLIC_APP_ENV
);

if (!isWeb) {
  void SplashScreen.preventAutoHideAsync();
  SplashScreen.setOptions({
    duration: 0,
    fade: false,
  });
}

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
const RECOVERY_DUMP_MARKER_KEY = '@anchor_recovery_dump_complete';
const RECOVERY_DUMP_VAULT_KEY = '@anchor_recovery_dump_vault';

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

function buildPrimeOnLaunchInitialState(
  anchorId: string,
  durationSeconds: number,
  ritualType: string
): InitialState {
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
              name: 'Ritual',
              params: {
                anchorId,
                durationSeconds,
                ritualType,
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

  let durationSeconds = 120;
  let ritualType = 'ritual';

  try {
    const rawSettings = await AsyncStorage.getItem('anchor-settings-storage');
    if (rawSettings) {
      const parsedSettings = JSON.parse(rawSettings);
      const settingsState = parsedSettings.state || {};
      
      if (typeof settingsState.primeSessionDuration === 'number') {
        durationSeconds = settingsState.primeSessionDuration;
      }
      
      if (settingsState.defaultCharge?.mode) {
        ritualType = settingsState.defaultCharge.mode;
      }
    }
  } catch (error) {
    // Ignore and use defaults
  }

  return buildPrimeOnLaunchInitialState(anchorId, durationSeconds, ritualType);
}

export default function App() {
  const computeStreak = useAuthStore((state) => state.computeStreak);
  const user = useAuthStore((state) => state.user);
  const dailyPracticeGoal = useSettingsStore((state) => state.dailyPracticeGoal);
  const analyticsEnabled = useSettingsStore((state) => state.analyticsEnabled);
  const anchorCount = useAnchorStore((state) => state.anchors.length);
  const lastSessionId = useSessionStore((state) => state.lastSession?.id);
  const navRef = useNavigationContainerRef<RootNavigatorParamList>();
  const routeNameRef = useRef<string | undefined>(undefined);
  const screenTraceRef = useRef<PerformanceTrace | null>(null);
  const [settingsHydrated, setSettingsHydrated] = React.useState(false);
  const [firstRunHydrated, setFirstRunHydrated] = React.useState(() =>
    useFirstRunStore.persist.hasHydrated()
  );
  const [anchorsHydrated, setAnchorsHydrated] = React.useState(() =>
    useAnchorStore.persist.hasHydrated()
  );
  const [startupSafeFailure, setStartupSafeFailure] = React.useState(false);
  const [startupFatalFailure, setStartupFatalFailure] = React.useState(false);
  const [analyticsPreferenceHydrated, setAnalyticsPreferenceHydrated] = React.useState(() =>
    useSettingsStore.persist.hasHydrated()
  );
  const requiredLocalHydrationTimedOut = useRequiredLocalHydrationGuard({
    anchorsHydrated,
    firstRunHydrated,
  });
  const anchorPersistenceRecoveryRequired = useAnchorStore((state) => state.persistenceRecoveryRequired);
  const fatalStartupFailure = startupFatalFailure || requiredLocalHydrationTimedOut || anchorPersistenceRecoveryRequired;
  const [launchStateResolved, setLaunchStateResolved] = React.useState(false);
  const [initialNavigationState, setInitialNavigationState] = React.useState<
    InitialState | undefined
  >(undefined);
  const startupStartedAtRef = useRef(Date.now());
  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);
  const developerMasterAccountEnabled = useSettingsStore(
    (state) => state.developerMasterAccountEnabled
  );
  const developerMasterAccountEnabledRef = useRef(developerMasterAccountEnabled);
  const previousUserIdRef = useRef<string | null>(null);

  const developerSkipOnboardingEnabled = useSettingsStore(
    (state) => state.developerSkipOnboardingEnabled
  );
  const shouldBypassOnboarding =
    __DEV__ && (developerSkipOnboardingEnabled || developerMasterAccountEnabled);
  const showOnboarding = shouldShowOnboardingFlow(
    hasCompletedOnboarding,
    shouldBypassOnboarding
  );
  // One-shot latch: true once the initial auth restore has settled. Must not
  // track isLoading live — Login/SignUp re-use it and would unmount the app.
  const [initialAuthResolved, setInitialAuthResolved] = React.useState(false);
  const pendingNotificationResponseRef = useRef<Notifications.NotificationResponse | null>(null);
  const processedResponseIdsRef = useRef<Set<string>>(new Set());
  const trackingContext = React.useMemo(
    () => ({
      anchor_count: anchorCount,
    }),
    [anchorCount]
  );
  const [fontsLoaded, fontLoadError] = useFonts({
    'Cinzel-Regular': Cinzel_400Regular,
    'Cinzel-SemiBold': Cinzel_600SemiBold,
    'Cinzel-Bold': Cinzel_700Bold,
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Figtree-Regular': Figtree_400Regular,
    'Figtree-SemiBold': Figtree_600SemiBold,
    'BricolageGrotesque-Regular': BricolageGrotesque_400Regular,
    'BricolageGrotesque-SemiBold': BricolageGrotesque_600SemiBold,
    'BricolageGrotesque-Bold': BricolageGrotesque_700Bold,
    'CrimsonPro-Regular': CrimsonPro_400Regular,
    'CrimsonPro-Italic': CrimsonPro_400Regular_Italic,
    'EBGaramond-Regular': EBGaramond_400Regular,
    'EBGaramond-Italic': EBGaramond_400Regular_Italic,
    'EBGaramond-Medium': EBGaramond_500Medium,
    'EBGaramond-SemiBold': EBGaramond_600SemiBold,
    'Allison-Regular': require('./node_modules/@expo-google-fonts/allison/400Regular/Allison_400Regular.ttf'),
    'CormorantGaramond-Regular': CrimsonPro_400Regular,
    'CormorantGaramond-Italic': CrimsonPro_400Regular_Italic,
  });
  const startup = useAppStartup({
    fontsReady: fontsLoaded || Boolean(fontLoadError),
    settingsHydrated,
    authRestorationSettled: initialAuthResolved,
    firstRunHydrated,
    anchorsHydrated,
    primeOnLaunchResolved: launchStateResolved,
    safeFailure: startupSafeFailure || Boolean(fontLoadError),
    fatalFailure: fatalStartupFailure,
  });
  const appIsReady = startup.isReady;
  const effectiveAnalyticsEnabled =
    process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false' && analyticsEnabled;

  useEffect(() => {
    if (!__DEV__) return undefined;
    const watch = (name: string, persistApi: any) => {
      const log = () => perfLog('store-hydration-observed', { store: name, msSinceAppComponentMount: Date.now() - startupStartedAtRef.current });
      if (persistApi.hasHydrated()) {
        perfLog('store-already-hydrated-on-app-effect', { store: name, msSinceAppComponentMount: Date.now() - startupStartedAtRef.current });
      } else return persistApi.onFinishHydration(log);
      return undefined;
    };
    const disposers = [
      watch('anchor', useAnchorStore.persist),
      watch('session', useSessionStore.persist),
      watch('locationPriming', useLocationPrimingStore.persist),
      watch('visualizationScene', useVisualizationSceneStore.persist),
      watch('auth', useAuthStore.persist),
    ].filter((dispose): dispose is () => void => Boolean(dispose));
    const stopStalls = startJsStallDetector(() => routeNameRef.current);
    const stopRenders = startPerfRenderReporter();
    perfLog('app-ready-state', { ready: appIsReady, msSinceAppStart: Date.now() - startupStartedAtRef.current });
    return () => {
      disposers.forEach((dispose) => dispose());
      stopStalls();
      stopRenders();
    };
  }, []);

  useEffect(() => {
    if (appIsReady) perfLog('app-ready', { msSinceAppStart: Date.now() - startupStartedAtRef.current });
  }, [appIsReady]);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const existingMarker = await AsyncStorage.getItem(RECOVERY_DUMP_MARKER_KEY);
      if (existingMarker === '1') {
        return;
      }

      const vaultState = await readSecureValue(ANCHOR_VAULT_STORAGE_KEY);
      if (!vaultState || cancelled) {
        return;
      }

      await AsyncStorage.setItem(RECOVERY_DUMP_VAULT_KEY, vaultState);
      await AsyncStorage.setItem(RECOVERY_DUMP_MARKER_KEY, '1');
      logger.warn('[Recovery] Copied encrypted anchor vault state into AsyncStorage for recovery.');
    })().catch((error) => {
      logger.warn('[Recovery] Failed to dump encrypted anchor vault state', error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadSettingsSnapshot()
      .catch((error) => {
        logger.error('Failed to hydrate settings snapshot', error);
        setStartupSafeFailure(true);
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
    if (useSettingsStore.persist.hasHydrated()) {
      setAnalyticsPreferenceHydrated(true);
      return undefined;
    }

    return useSettingsStore.persist.onFinishHydration(() => {
      setAnalyticsPreferenceHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (useFirstRunStore.persist.hasHydrated()) {
      setFirstRunHydrated(true);
      return undefined;
    }
    return useFirstRunStore.persist.onFinishHydration(() => setFirstRunHydrated(true));
  }, []);

  useEffect(() => {
    if (useAnchorStore.persist.hasHydrated()) {
      setAnchorsHydrated(true);
      return undefined;
    }
    return useAnchorStore.persist.onFinishHydration(() => setAnchorsHydrated(true));
  }, []);

  useEffect(() => {
    let isMounted = true;

    resolvePrimeOnLaunchInitialState()
      .then((initialState) => {
        if (!isMounted) {
          return;
        }

        setInitialNavigationState(initialState);
      })
      .catch((error) => {
        logger.error('Failed to resolve Prime on Launch initial state', error);
        setStartupSafeFailure(true);
      })
      .finally(() => {
        if (isMounted) {
          setLaunchStateResolved(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    developerMasterAccountEnabledRef.current = developerMasterAccountEnabled;
  }, [developerMasterAccountEnabled]);

  // Mirror session/anchor state into the home screen widgets. Subscribes to
  // the stores, so prime completions, decay, and hydration all propagate
  // without touching those flows.
  useEffect(() => {
    if (WIDGETS_ENABLED) {
      initWidgetDataSync();
    }
  }, []);

  useEffect(() => {
    return subscribeToAppAuthState({
      developerMasterAccountEnabled: () => developerMasterAccountEnabledRef.current,
      onInitialAuthRestoreSettled: () => setInitialAuthResolved(true),
      onStartupSafeFailure: () => setStartupSafeFailure(true),
      onStartupUnsafeFailure: () => setStartupFatalFailure(true),
    });
  }, []);

  useEffect(() => {
    if (AuthService.hasAuthenticatedSession()) return;
    if (!useAuthStore.persist.hasHydrated()) return;
    if (__DEV__ && developerMasterAccountEnabled) {
      useAuthStore.getState().enableDeveloperMasterAccount();
      return;
    }
    if (!initialAuthResolved || !useAuthStore.persist.hasHydrated()) return;

    let active = true;
    const shouldContinue = () =>
      active &&
      !AuthService.hasAuthenticatedSession() &&
      !(__DEV__ && developerMasterAccountEnabledRef.current);
    void handleUnauthenticatedAuthRestore(
      shouldContinue,
      Symbol('app-auth-reconcile'),
      () => {
        if (shouldContinue()) setStartupFatalFailure(true);
      },
    ).catch((error) => {
      if (!shouldContinue()) return;
      logger.error('[Startup] Local auth reconciliation failed', error);
      setStartupFatalFailure(true);
    });
    return () => {
      active = false;
    };
  }, [developerMasterAccountEnabled, initialAuthResolved]);

  useEffect(() => {
    // RevenueCat is configured with the authenticated database User UUID when
    // auth hydration completes; Anchor does not create anonymous purchase IDs.
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
    if (!analyticsPreferenceHydrated) {
      return;
    }

    AnalyticsService.initialize({ enabled: effectiveAnalyticsEnabled });
  }, [analyticsPreferenceHydrated, effectiveAnalyticsEnabled]);

  useEffect(() => {
    if (user?.id) {
      ErrorTrackingService.setUser(user.id);
      AnalyticsService.identify(user.id);
      // Log in to RevenueCat with the Firebase UID so purchases are linked to this account.
      revenueCatService.logIn(user.id).catch((error) => {
        logger.warn('[RevenueCat] logIn failed', error);
      });
      return;
    }

    ErrorTrackingService.clearUser();
    AnalyticsService.reset();
    FrictionAnalytics.reset();
  }, [user?.displayName, user?.email, user?.id]);

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;

    if (previousUserId && previousUserId !== user?.id) {
      void clearPushTokensFromServer();
    }

    previousUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    // Reflect server-driven entitlement changes (renewals, cancellations,
    // refunds, billing retries) in real time. The service keeps the
    // subscription store in sync on every update, so the paywall gate reacts
    // without requiring a cold restart.
    return revenueCatService.addCustomerInfoUpdateListener(() => {
      // No-op: applyTrialStatus runs inside the service listener.
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return () => undefined;
    }

    let cancelled = false;

    const hasGrantedNotificationPermissions = (
      status: Notifications.NotificationPermissionsStatus
    ): boolean => {
      if (status.granted || status.status === 'granted') {
        return true;
      }
      const iosStatus = status.ios?.status;
      return (
        iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
        iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
        iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
      );
    };

    const syncRegistration = async (
      devicePushToken?: DevicePushToken
    ) => {
      // Don't trigger the OS permission prompt at cold start. Only sync push
      // registration when the user has already granted notifications; the
      // Settings master toggle (an explicit user action) performs the first
      // request via getRemotePushRegistration().
      const permissions = await Notifications.getPermissionsAsync();
      if (cancelled) {
        return;
      }
      if (!hasGrantedNotificationPermissions(permissions)) {
        await clearPushTokensFromServer();
        return;
      }

      const registration = await NotificationService.getRemotePushRegistration(devicePushToken);
      if (cancelled) {
        return;
      }

      if (!registration.permissionGranted) {
        await clearPushTokensFromServer();
        return;
      }

      if (registration.expoPushToken) {
        await syncPushTokensToServer({
          expoPushToken: registration.expoPushToken,
          fcmToken: registration.fcmToken,
          apnsToken: registration.apnsToken,
        });
      }
    };

    void syncRegistration();

    const subscription = Notifications.addPushTokenListener((devicePushToken) => {
      void syncRegistration(devicePushToken);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [user?.id]);

  useEffect(() => {
    const cleanupCoordinator = NotificationCoordinator.initialize();
    return () => cleanupCoordinator();
  }, []);

  useEffect(() => {
    const trackNotificationPayload = (
      eventName: string,
      payload: Record<string, unknown>,
      timestampKey: 'sentAt' | 'openedAt'
    ) => {
      const category = typeof payload.category === 'string' ? payload.category : undefined;
      const templateId = typeof payload.templateId === 'string' ? payload.templateId : undefined;
      const tone = typeof payload.tone === 'string' ? payload.tone : undefined;
      const anchorId = typeof payload.anchorId === 'string' ? payload.anchorId : undefined;

      AnalyticsService.track(eventName, {
        category,
        templateId,
        tone,
        anchorId,
        [timestampKey]: new Date().toISOString(),
        completedSessionAfterOpen: timestampKey === 'openedAt' ? false : undefined,
      });
    };

    const dispatchNotificationResponse = (response: Notifications.NotificationResponse) => {
      const payload = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      trackNotificationPayload(AnalyticsEvents.NOTIFICATION_OPENED, payload, 'openedAt');

      if (!anchorV2Enabled) {
        const action = NotificationService.handleNotificationClick(response);
        switch (action.action) {
          case 'open_ritual_reminder':
          case 'open_daily_reminder':
          case 'open_streak_protection':
          case 'open_weekly_summary':
          case 'open_notification_category':
            navRef.navigate('Main');
            break;
          default:
            break;
        }
        return;
      }

      // V2 Anchor 2.0 Navigation Routing
      const authState = useAuthStore.getState();
      if (!authState.isAuthenticated || !authState.hasCompletedOnboarding) {
        logger.info('[Notifications] User unauthenticated or onboarding incomplete, skipping deep navigation');
        return;
      }

      const action = NotificationService.handleNotificationClick(response);
      const chartTarget = parseChartNotificationTarget(payload);
      const category = typeof payload.category === 'string' ? payload.category : '';

      // 1. Chart notification -> relevant Chart
      if (chartTarget || action.action === 'open_chart' || category === 'chart') {
        const anchorId =
          chartTarget?.anchorId ??
          (typeof payload.anchorId === 'string' ? payload.anchorId : null);
        const anchorState = useAnchorStore.getState();
        const anchorExists = anchorId
          ? anchorState.anchors.some(
              (a) => !a.isReleased && !a.archivedAt && (a.id === anchorId || a.localId === anchorId)
            )
          : false;

        if (anchorExists && anchorId) {
          navRef.dispatch(
            CommonActions.navigate({
              name: ANCHOR_V2_ROUTES.chart,
              params: { anchorId, source: 'notification' },
            })
          );
        } else {
          navRef.dispatch(CommonActions.navigate({ name: ANCHOR_V2_ROUTES.developmentHome }));
        }
        return;
      }

      // 2. Vision notification -> relevant Vision
      if (action.action === 'open_vision' || category === 'vision') {
        const anchorId = typeof payload.anchorId === 'string' ? payload.anchorId : null;
        const anchorState = useAnchorStore.getState();
        const anchorExists = anchorId
          ? anchorState.anchors.some(
              (a) => !a.isReleased && !a.archivedAt && (a.id === anchorId || a.localId === anchorId)
            )
          : false;

        if (anchorExists && anchorId) {
          navRef.dispatch(
            CommonActions.navigate({
              name: ANCHOR_V2_ROUTES.vision,
              params: { anchorId },
            })
          );
        } else {
          navRef.dispatch(CommonActions.navigate({ name: ANCHOR_V2_ROUTES.developmentHome }));
        }
        return;
      }

      // 3. Personal Daily Reminder -> appropriate Practice entry
      if (
        action.action === 'open_daily_reminder' ||
        category === 'personal_daily' ||
        category === 'daily_prime'
      ) {
        navRef.dispatch(
          CommonActions.navigate({
            name: ANCHOR_V2_ROUTES.practice,
            params: { source: 'daily_reminder' },
          })
        );
        return;
      }

      // 4. General reconnection / streak protection / weekly summary / unknown fallback
      navRef.dispatch(CommonActions.navigate({ name: ANCHOR_V2_ROUTES.developmentHome }));
    };

    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const stopDrainRetryLoop = () => {
      if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    };

    const drainPendingNotification = () => {
      const pending = pendingNotificationResponseRef.current;
      if (!pending) {
        stopDrainRetryLoop();
        return;
      }

      const isNavReady = navRef.isReady() && Boolean(navRef.getCurrentRoute());
      const isAuthReady = initialAuthResolved && !useAuthStore.getState().isLoading;

      if (isNavReady && isAuthReady) {
        pendingNotificationResponseRef.current = null;
        stopDrainRetryLoop();
        dispatchNotificationResponse(pending);
      }
    };

    const startDrainRetryLoop = () => {
      if (retryTimer) return;
      let retryCount = 0;
      retryTimer = setInterval(() => {
        if (!pendingNotificationResponseRef.current) {
          stopDrainRetryLoop();
          return;
        }
        if (retryCount++ > 30) {
          stopDrainRetryLoop();
          return;
        }
        drainPendingNotification();
      }, 200);
    };

    const processOrQueueNotificationResponse = (response: Notifications.NotificationResponse) => {
      const responseId = `${response.notification.request.identifier}:${response.actionIdentifier || 'default'}:${response.notification.date}`;
      if (processedResponseIdsRef.current.has(responseId)) {
        return;
      }
      processedResponseIdsRef.current.add(responseId);

      const isNavReady = navRef.isReady() && Boolean(navRef.getCurrentRoute());
      const isAuthReady = initialAuthResolved && !useAuthStore.getState().isLoading;

      if (!isNavReady || !isAuthReady) {
        logger.info('[Notifications] Navigation or auth not ready; queueing cold-start response');
        pendingNotificationResponseRef.current = response;
        startDrainRetryLoop();
        return;
      }

      dispatchNotificationResponse(response);
    };

    // Attempt drain whenever dependencies settle
    drainPendingNotification();

    const subscription = Notifications.addNotificationResponseReceivedListener(
      processOrQueueNotificationResponse
    );
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      trackNotificationPayload(
        AnalyticsEvents.NOTIFICATION_SENT,
        notification.request.content.data ?? {},
        'sentAt'
      );
    });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          processOrQueueNotificationResponse(response);
        }
      })
      .catch((error) => {
        logger.warn('[Notifications] Failed to read launch notification response', error);
      });

    return () => {
      subscription.remove();
      receivedSubscription.remove();
      stopDrainRetryLoop();
    };
  }, [anchorV2Enabled, initialAuthResolved, navRef]);



  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        ErrorTrackingService.addBreadcrumb('App foregrounded', 'app_state', { nextState });
        computeStreak();
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

  if (!appIsReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.fontLoadingFallback}>
          <StatusBar style="light" backgroundColor="transparent" translucent />
          {fatalStartupFailure ? (
            <StartupRestoreFailure />
          ) : (
            <SplashController
              startupReady={false}
              startupOutcome={startup.outcome}
              startupStartedAt={startupStartedAtRef.current}
              authState={user?.id ? 'signed_in' : 'signed_out'}
            />
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <View style={styles.webContainer}>
              <View style={styles.appContainer}>
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
                      FrictionAnalytics.trackRouteViewed(initialRouteName, trackingContext);
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
                      FrictionAnalytics.trackRouteViewed(currentRouteName, {
                        from_route: previousRouteName,
                        ...trackingContext,
                      });
                      routeNameRef.current = currentRouteName;
                    }}
                  >
                    <StatusBar style="light" />
                    {anchorV2Enabled ? <AnchorV2Navigator /> : <RootNavigator />}
                  </NavigationContainer>
                  {__DEV__ || isChartOpeningPreviewEnabled() ? <ChartLabDevHost /> : null}
                  {__DEV__ ? <VisionVisualQADevHost /> : null}
                  {__DEV__ ? <CreationFlowQADevHost /> : null}
                </SettingsRevealProvider>
              </View>
              <SplashController
                startupReady={appIsReady}
                startupOutcome={startup.outcome}
                startupStartedAt={startupStartedAtRef.current}
                authState={user?.id ? 'signed_in' : 'signed_out'}
              />
            </View>
            <V2DialogHost />
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
    backgroundColor: SPLASH_BACKGROUND_COLOR,
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
    backgroundColor: SPLASH_BACKGROUND_COLOR,
  },
});
