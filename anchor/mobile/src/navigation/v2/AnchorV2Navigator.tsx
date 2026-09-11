import React, { useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { V2DevelopmentHome } from '@/screens/v2/home';
import { V2SystemGallery } from '@/screens/v2/system';
import { V2FirstRunFlow } from '@/screens/v2/onboarding';
import { V2CreationScreen, type CreationSaveAdapter, type CreationContinuation } from '@/screens/v2/creation';
import { V2PaywallScreen, type V2PaywallEntitlementResult } from '@/screens/v2/paywall';
import { V2PracticeScreen } from '@/screens/v2/practice';
import { V2VisionScreen } from '@/screens/v2/vision';
import { V2ChartScreen } from '@/screens/v2/chart';
import { V2ProgressScreen } from '@/screens/v2/progress';
import { V2AnchorLibraryScreen, V2AnchorDetailsScreen } from '@/screens/v2/anchors';
import { V2ReleaseScreen } from '@/screens/v2/release';
import { V2WeeklyInsightScreen } from '@/screens/v2/weeklyInsight';
import { createV2Anchor } from '@/adapters/v2/anchors/anchorCreationApi';
import { resolveV2ChartCourse } from '@/adapters/v2/chart/anchorCourseResolver';
import type { AnchorV2StackParamList } from './types';

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
      navigation.navigate('V2Practice', { anchorId: resume.anchorId });
    } else if (resume.type === 'open_visualize') {
      navigation.navigate('V2Practice', { anchorId: resume.anchorId });
    } else if (resume.type === 'create_anchor') {
      navigation.navigate('V2Creation');
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

  return (
    <V2PracticeScreen
      onBack={() => navigation.goBack()}
      onPremiumCapabilityRequired={(req) => {
        navigation.navigate('V2Paywall', {
          context: req.capability === 'visualize' ? 'VISUALIZE' : req.capability === 'deep_prime' ? 'DEEP_PRIME' : 'PRACTICE',
          resumeIntent: { type: 'open_practice', anchorId: req.anchorId, mode: req.capability === 'deep_prime' ? 'deep' : 'focus' },
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

  const saveAnchor: CreationSaveAdapter = useCallback(
    ({ draft, candidate, idempotencyKey }) => createV2Anchor(draft, candidate, idempotencyKey),
    [],
  );

  const handleContinue = useCallback(async (continuation: CreationContinuation) => {
    const { type, anchorId } = continuation;
    if (type === 'vision' || type === 'vision_and_chart') {
      navigation.replace('V2Vision', { anchorId });
    } else if (type === 'chart') {
      const courseId = await resolveV2ChartCourse(anchorId, `v2-chart:${anchorId}`);
      navigation.replace('V2Chart', { courseId, anchorId });
    } else {
      navigation.replace('V2DevelopmentHome');
    }
  }, [navigation]);

  return <V2CreationScreen saveAnchor={saveAnchor} onContinue={handleContinue} />;
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

/**
 * Anchor 2.0 central stack navigator.
 */
export function AnchorV2Navigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="V2DevelopmentHome" component={V2DevelopmentHome} />
      <Stack.Screen name="V2FirstRun" component={V2FirstRunFlow} />
      <Stack.Screen name="V2SystemGallery" component={V2SystemGallery} />
      <Stack.Screen name="V2Creation" component={V2CreationRouteScreen} />
      <Stack.Screen name="V2AnchorLibrary" component={V2AnchorLibraryScreen} />
      <Stack.Screen name="V2AnchorDetails" component={V2AnchorDetailsScreen} />
      <Stack.Screen name="V2Paywall" component={V2PaywallRouteScreen} />
      <Stack.Screen name="V2Practice" component={V2PracticeRouteScreen} />
      <Stack.Screen name="V2Vision" component={V2VisionScreen} />
      <Stack.Screen name="V2Chart" component={V2ChartScreen} />
      <Stack.Screen name="V2Progress" component={V2ProgressScreen} />
      <Stack.Screen name="V2Release" component={V2ReleaseRouteScreen} />
      <Stack.Screen name="V2WeeklyInsight" component={V2WeeklyInsightRouteScreen} />
    </Stack.Navigator>
  );
}
