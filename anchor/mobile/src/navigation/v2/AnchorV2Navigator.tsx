import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { V2DevelopmentHome } from '@/screens/v2/home';
import { V2SystemGallery } from '@/screens/v2/system';
import { V2FirstRunFlow } from '@/screens/v2/onboarding';
import {
  V2CreationScreen,
  type CreationDestinationAdapter,
  type CreationHandoff,
  type CreationSaveAdapter,
} from '@/screens/v2/creation';
import { V2PaywallScreen, type V2PaywallEntitlementResult } from '@/screens/v2/paywall';
import { V2PracticeScreen } from '@/screens/v2/practice';
import { V2VisionScreen } from '@/screens/v2/vision';
import { V2ChartScreen } from '@/screens/v2/chart';
import { V2ProgressScreen } from '@/screens/v2/progress';
import { V2AnchorLibraryScreen, V2AnchorDetailsScreen } from '@/screens/v2/anchors';
import { V2ReleaseScreen } from '@/screens/v2/release';
import { V2WeeklyInsightScreen } from '@/screens/v2/weeklyInsight';
import { SettingsScreen } from '@/screens/settings';
import { LoginScreen } from '@/screens/auth';
import { useAnchorStore } from '@/stores/anchorStore';
import { persistCreatedAnchor, persistDestination } from '@/services/v2/creationPersistence';
import type { V2PracticeMode } from '@/constants/v2/practice';
import type { AnchorV2StackParamList } from './types';
import { useV2ReduceMotion } from '@/hooks/v2';
import { v2ScreenBackground, v2StackScreenOptions } from './transitions';
import { handOffToHome } from './creationHandoff';

const Stack = createNativeStackNavigator<AnchorV2StackParamList>();

function V2PaywallRouteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AnchorV2StackParamList, 'V2Paywall'>>();
  const params = route.params;

  const handleDismiss = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleEntitled = useCallback((_result: V2PaywallEntitlementResult) => {
    navigation.goBack();
    const resume = params?.resumeIntent;
    if (!resume || resume.type === 'none') return;
    if (resume.type === 'open_practice') {
      // Resume exactly the practice that raised the paywall.
      const mode: V2PracticeMode = resume.practiceMode ?? (resume.mode === 'deep' ? 'deep_prime' : 'focus');
      navigation.navigate('V2Practice', {
        anchorId: resume.anchorId,
        resumeMode: mode,
        resumeDuration: resume.durationSeconds,
        resumeSource: resume.source,
      });
    } else if (resume.type === 'open_visualize') {
      navigation.navigate('V2Practice', {
        anchorId: resume.anchorId,
        resumeMode: 'visualize',
        resumeDuration: resume.durationSeconds,
        resumeSource: 'recommended_today',
      });
    } else if (resume.type === 'create_anchor') {
      navigation.navigate('V2Creation');
    } else if (resume.type === 'vision_premium_action') {
      navigation.navigate('V2Vision', {
        anchorId: resume.anchorId,
        initialMode: 'create',
        resumeGeneration: resume.action === 'generate',
      });
    }
  }, [navigation, params]);

  return (
    <V2PaywallScreen
      context={params?.context ?? 'GENERAL_UPGRADE'}
      onDismiss={handleDismiss}
      onEntitled={handleEntitled}
    />
  );
}

function V2PracticeRouteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AnchorV2StackParamList, 'V2Practice'>>();
  const anchorId = route.params?.anchorId;
  const recommendedMode = route.params?.recommendedMode;
  const resumeMode = route.params?.resumeMode;
  const resumeDuration = route.params?.resumeDuration;
  const resumeSource = route.params?.resumeSource;
  const returnRoute = route.params?.returnRoute;

  const anchors = useAnchorStore((s) => s.anchors);
  const suppliedAnchor = anchorId
    ? anchors.find((a) => a.id === anchorId || a.localId === anchorId)
    : undefined;

  const handleBack = () => {
    if (returnRoute) {
      navigation.navigate(returnRoute, { anchorId });
    } else {
      navigation.goBack();
    }
  };

  return (
    <V2PracticeScreen
      anchor={suppliedAnchor}
      initialMode={recommendedMode}
      resumeMode={resumeMode}
      resumeDuration={resumeDuration}
      resumeSource={resumeSource}
      onBack={handleBack}
      onPremiumCapabilityRequired={(req) => {
        navigation.navigate('V2Paywall', {
          context: req.capability === 'visualize' ? 'VISUALIZE' : req.capability === 'deep_prime' ? 'DEEP_PRIME' : 'PRACTICE',
          resumeIntent: {
            type: 'open_practice',
            anchorId: req.anchorId,
            mode: req.capability === 'deep_prime' ? 'deep' : 'focus',
            practiceMode: req.capability,
            durationSeconds: req.durationSeconds,
            source: req.source,
          },
        });
      }}
      onCreateVision={(id) => {
        navigation.navigate('V2Vision', { anchorId: id });
      }}
      onOpenVision={(id) => {
        navigation.navigate('V2Vision', { anchorId: id });
      }}
      onReleaseRequested={(id, reason) => {
        navigation.navigate('V2Release', { anchorId: id, reason });
      }}
    />
  );
}

function V2CreationRouteScreen() {
  const navigation = useNavigation<any>();
  const reduceMotion = useV2ReduceMotion();

  const saveAnchor: CreationSaveAdapter = useCallback(async ({ draft, idempotencyKey }) => {
    const { anchorId } = await persistCreatedAnchor({ draft, idempotencyKey });
    return { anchorId };
  }, []);

  const saveDestination: CreationDestinationAdapter = useCallback(
    ({ anchorId, description }) => persistDestination({ anchorId, description }),
    [],
  );

  const handleComplete = useCallback((handoff: CreationHandoff) => {
    void handOffToHome(navigation, handoff, { reduceMotion });
  }, [navigation, reduceMotion]);

  const handleExit = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  // The server refused a second Anchor on the free plan. The draft stays put; the paywall's
  // `create_anchor` resume brings the user straight back to it.
  const handlePaywall = useCallback(() => {
    navigation.navigate('V2Paywall', { context: 'SECOND_ANCHOR', resumeIntent: { type: 'create_anchor' } });
  }, [navigation]);

  const handleSignIn = useCallback(() => navigation.navigate('Login'), [navigation]);

  return (
    <V2CreationScreen
      saveAnchor={saveAnchor}
      saveDestination={saveDestination}
      onComplete={handleComplete}
      onExit={handleExit}
      onPaywall={handlePaywall}
      onSignIn={handleSignIn}
    />
  );
}

function V2ReleaseRouteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AnchorV2StackParamList, 'V2Release'>>();
  return <V2ReleaseScreen {...route.params} onCancel={() => navigation.goBack()} onReleaseCompleted={() => navigation.replace('V2DevelopmentHome')} />;
}

function V2WeeklyInsightRouteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AnchorV2StackParamList, 'V2WeeklyInsight'>>();
  return <V2WeeklyInsightScreen route={route} navigation={navigation} onBack={() => navigation.goBack()} />;
}

function V2LoginRouteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AnchorV2StackParamList, 'Login'>>();

  return (
    <View style={styles.loginContainer}>
      <LoginScreen navigation={navigation} route={route} />
      {navigation.canGoBack() ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.loginBackButton}
        >
          <ArrowLeft color="#F5F5F1" size={20} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Anchor 2.0 central stack navigator.
 */
export function AnchorV2Navigator() {
  const reduceMotion = useV2ReduceMotion();
  const screenOptions = useMemo(() => v2StackScreenOptions(reduceMotion), [reduceMotion]);
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="V2DevelopmentHome" component={V2DevelopmentHome} />
      <Stack.Screen name="V2FirstRun" component={V2FirstRunFlow} />
      <Stack.Screen name="V2SystemGallery" component={V2SystemGallery} />
      {/* Creation owns its back behaviour (a state machine, not a stack), so the edge swipe
          must not pop the route out from under a save or the hand-off. */}
      <Stack.Screen name="V2Creation" component={V2CreationRouteScreen} options={CREATION_OPTIONS} />
      <Stack.Screen name="V2AnchorLibrary" component={V2AnchorLibraryScreen} />
      <Stack.Screen name="V2AnchorDetails" component={V2AnchorDetailsScreen} options={PAPER_BACKGROUND} />
      {/* The paywall draws a sheet over a deliberately transparent root. */}
      <Stack.Screen name="V2Paywall" component={V2PaywallRouteScreen} options={TRANSPARENT_BACKGROUND} />
      <Stack.Screen name="V2Practice" component={V2PracticeRouteScreen} />
      <Stack.Screen name="V2Vision" component={V2VisionScreen} options={PAPER_BACKGROUND} />
      <Stack.Screen name="V2Chart" component={V2ChartScreen} />
      <Stack.Screen name="V2Progress" component={V2ProgressScreen} options={GRAPHITE_BACKGROUND} />
      <Stack.Screen name="V2Release" component={V2ReleaseRouteScreen} />
      <Stack.Screen name="V2WeeklyInsight" component={V2WeeklyInsightRouteScreen} />
      {/* Legacy dark surfaces keep the app's transparent default. */}
      <Stack.Screen name="V2Settings" component={SettingsScreen} options={TRANSPARENT_BACKGROUND} />
      <Stack.Screen name="Login" component={V2LoginRouteScreen} options={TRANSPARENT_BACKGROUND} />
    </Stack.Navigator>
  );
}

const PAPER_BACKGROUND = v2ScreenBackground('paper');
const CREATION_OPTIONS = { gestureEnabled: false };
const GRAPHITE_BACKGROUND = v2ScreenBackground('graphite');
const TRANSPARENT_BACKGROUND = { contentStyle: { backgroundColor: 'transparent' } };

const styles = StyleSheet.create({
  loginContainer: {
    flex: 1,
    backgroundColor: '#080C10',
  },
  loginBackButton: {
    position: 'absolute',
    top: 52,
    left: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
