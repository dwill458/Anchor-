import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { AppState, StatusBar, View, StyleSheet, Platform, Dimensions } from 'react-native';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
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
import { SettingsRevealProvider } from './src/components/transitions/SettingsRevealProvider';
import type { RootNavigatorParamList } from './src/navigation/RootNavigator';
import { ErrorTrackingService, setupGlobalErrorHandler } from './src/services/ErrorTrackingService';
import { PerformanceMonitoring, type PerformanceTrace } from './src/services/PerformanceMonitoring';
import { monitoringConfig } from './src/config/monitoring';

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

export default function App() {
  const computeStreak = useAuthStore((state) => state.computeStreak);
  const user = useAuthStore((state) => state.user);
  const navRef = useNavigationContainerRef<RootNavigatorParamList>();
  const routeNameRef = useRef<string | undefined>(undefined);
  const screenTraceRef = useRef<PerformanceTrace | null>(null);
  const [fontsLoaded] = useFonts({
    'Cinzel-Regular': Cinzel_400Regular,
    'Cinzel-SemiBold': Cinzel_600SemiBold,
    'Cinzel-Bold': Cinzel_700Bold,
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'CrimsonPro-Regular': CrimsonPro_400Regular,
    'CrimsonPro-Italic': CrimsonPro_400Regular_Italic,
  });

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
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        ErrorTrackingService.addBreadcrumb('App foregrounded', 'app_state', { nextState });
        computeStreak();
      } else {
        ErrorTrackingService.addBreadcrumb('App state changed', 'app_state', { nextState });
      }
    });
    return () => subscription.remove();
  }, [computeStreak]);

  useEffect(() => {
    return () => {
      screenTraceRef.current?.stop({ reason: 'app_unmount' });
      screenTraceRef.current = null;
    };
  }, []);

  if (!fontsLoaded) {
    return <View style={styles.fontLoadingFallback} />;
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
              </View>
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
