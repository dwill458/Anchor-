import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar, View, StyleSheet, Platform, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableFreeze, enableScreens } from 'react-native-screens';
import { RootNavigator } from './src/navigation';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ToastProvider } from './src/components/ToastProvider';
import { AnalyticsService } from './src/services/AnalyticsService';
import { ErrorTrackingService, setupGlobalErrorHandler } from './src/services/ErrorTrackingService';
import { PerformanceMonitoring } from './src/services/PerformanceMonitoring';
import { SubscriptionService } from './src/services/SubscriptionService';
import { useAuthStore } from './src/stores/authStore';

declare const process: {
  env: Record<string, string | undefined>;
};

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

if (!isWeb) {
  enableScreens(true);
  enableFreeze(true);
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
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    AnalyticsService.initialize();
    ErrorTrackingService.initialize();
    PerformanceMonitoring.initialize();
    SubscriptionService.initialize({ userId: user?.id });
    setupGlobalErrorHandler();
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    if (!user) {
      AnalyticsService.reset();
      ErrorTrackingService.clearUser();
      void SubscriptionService.logOut();
      return;
    }

    AnalyticsService.identify(user.id, {
      email: user.email,
      displayName: user.displayName,
      subscriptionStatus: user.subscriptionStatus,
      totalAnchorsCreated: user.totalAnchorsCreated,
      currentStreak: user.currentStreak,
    });
    ErrorTrackingService.setUser(user.id, user.email, user.displayName);
    void SubscriptionService.setUser(user.id);
  }, [user]);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <View style={styles.webContainer}>
              <View style={styles.appContainer}>
                <NavigationContainer theme={AppTheme}>
                  <StatusBar barStyle="light-content" backgroundColor="#1A1A1D" />
                  <RootNavigator />
                </NavigationContainer>
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
});
