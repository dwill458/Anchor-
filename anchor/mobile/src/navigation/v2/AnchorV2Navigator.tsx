import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
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
import { SettingsScreen } from '@/screens/settings';
import { LoginScreen } from '@/screens/auth';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import type { Anchor, SigilVariationStyle } from '@/types';
import type { V2PracticeMode } from '@/constants/v2/practice';
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

  const saveAnchor: CreationSaveAdapter = useCallback(async ({ draft, candidate }) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      throw new Error('A signed-in account is required to save an Anchor.');
    }
    const anchorId = draft.draftId || `anchor-${Date.now()}`;
    const now = new Date();
    const structureVariant: SigilVariationStyle =
      draft.structureType === 'raw' ? 'minimal' : draft.structureType === 'contained' ? 'dense' : 'balanced';
    const newAnchor: Anchor = {
      id: anchorId,
      localId: anchorId,
      userId,
      intentionText: draft.intention,
      category: draft.category ?? 'career',
      classifierMeta: { v2Expression: candidate.expression },
      distilledLetters: draft.distilledLetters ?? [],
      baseSigilSvg: candidate.structureSvg,
      structureVariant,
      isCharged: false,
      activationCount: 0,
      chargeCount: 0,
      threadStrength: 0,
      createdAt: now,
      updatedAt: now,
    };
    useAnchorStore.getState().addAnchor(newAnchor);
    return { anchorId };
  }, []);

  const handleContinue = useCallback((continuation: CreationContinuation) => {
    const { type, anchorId } = continuation;
    if (type === 'vision' || type === 'vision_and_chart') {
      navigation.replace('V2Vision', { anchorId });
    } else if (type === 'chart') {
      navigation.replace('V2Chart', { anchorId });
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
      <Stack.Screen name="V2Settings" component={SettingsScreen} />
      <Stack.Screen name="Login" component={V2LoginRouteScreen} />
    </Stack.Navigator>
  );
}

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
