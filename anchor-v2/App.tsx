import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar, View, StyleSheet, Platform, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ToastProvider } from './src/components/ToastProvider';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <View style={styles.webContainer}>
              <View style={styles.appContainer}>
                <NavigationContainer>
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
