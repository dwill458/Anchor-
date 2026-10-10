import { releaseArtworkRect } from '@/components/v2/release/releaseBurn';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2DevelopmentHome } from '@/screens/v2/home';
import { V2EvolvingAnchorPrototype, V2SystemGallery } from '@/screens/v2/system';
import { V2FirstRunFlow } from '@/screens/v2/onboarding';
import { V2AuthScreen } from '@/screens/v2/auth';
import {
  V2CreationScreen,
  type CreationGenerationAdapter,
  type CreationHandoff,
  type CreationSaveAdapter,
} from '@/screens/v2/creation';
import { V2PaywallScreen, type V2PaywallEntitlementResult } from '@/screens/v2/paywall';
import IntentionInputScreen from '@/screens/create/IntentionInputScreen';
import AnchorCreationFlowScreen from '@/screens/create/flow/AnchorCreationFlowScreen';
import { V2PracticeScreen } from '@/screens/v2/practice';
import { V2VisionScreen } from '@/screens/v2/vision';
import { V2VisionNoteComposer } from '@/screens/v2/vision/V2VisionNoteComposer';
import { V2ChartAdjustScreen, V2ChartJourneyScreen, V2ChartScreen, V2ChartWaypointScreen } from '@/screens/v2/chart';
import { V2ProgressScreen } from '@/screens/v2/progress';
import { V2AnchorLibraryScreen, V2AnchorDetailsScreen } from '@/screens/v2/anchors';
import { V2ReleaseScreen } from '@/screens/v2/release';
import { createReleaseContinuations, releaseHomeScreenOptions } from './releaseNavigation';
import { V2WeeklyInsightScreen } from '@/screens/v2/weeklyInsight';
import { SettingsScreen } from '@/screens/settings';
import { LoginScreen } from '@/screens/auth';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useFirstRunStore } from '@/stores/v2/firstRunStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { generateExpressionCandidates, persistCreatedAnchor } from '@/services/v2/creationPersistence';
import type { V2PracticeMode } from '@/constants/v2/practice';
import type { Anchor } from '@/types';
import type { AnchorV2StackParamList } from './types';
import { useV2ReduceMotion } from '@/hooks/v2';
import { V2_TRANSITION_SETTLE_MS, v2ScreenBackground, v2StackScreenOptions } from './transitions';
import { visionPreviewScreenOptions } from './visionPreviewTransition';
import { ProgressiveFocusTransitionProvider, useOptionalAnchorTransition } from './ProgressiveFocusTransition';
import { handOffToHome, prepareHomeArrival } from './creationHandoff';
import { handOffPracticeToHome } from './practiceHandoff';
import { takePracticeDeparture } from '@/stores/v2/practiceDeparture';
import { useCelebrationReduceMotion } from '@/hooks/useCelebrationReduceMotion';
import { handOffPracticeToInvitation } from './invitationHandoff';
import { V2NotificationInvitationScreen } from '@/screens/v2/notifications/V2NotificationInvitationScreen';
import { V2ReminderTimeScreen } from '@/screens/v2/notifications/V2ReminderTimeScreen';
import { loadNotificationStateSnapshot, shouldShowReminderInvitation } from '@/screens/v2/notifications/invitationEligibility';
import { markFirstPracticeCompletedInStorage } from '@/hooks/useNotificationController';
import { useReminderInvitationStore } from '@/stores/v2/reminderInvitationStore';
import type { NotificationState } from '@/services/NotificationState';

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
        returnRoute: resume.returnRoute,
      });
    } else if (resume.type === 'open_visualize') {
      navigation.navigate('V2Practice', {
        anchorId: resume.anchorId,
        resumeMode: 'visualize',
        resumeDuration: resume.durationSeconds,
        resumeSource: 'recommended_today',
        returnRoute: resume.returnRoute,
      });
    } else if (resume.type === 'create_anchor') {
      navigation.navigate('FirstAnchorCreation'); // the main creation flow
    } else if (resume.type === 'open_chart') {
      navigation.navigate('V2Chart', { anchorId: resume.anchorId });
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
  const transition = useOptionalAnchorTransition();
  const viewport = useWindowDimensions();
  const recommendedMode = route.params?.recommendedMode;
  const resumeMode = route.params?.resumeMode;
  const resumeDuration = route.params?.resumeDuration;
  const resumeSource = route.params?.resumeSource;
  const returnRoute = route.params?.returnRoute;
  const source = route.params?.source;
  const anchorTransition = route.params?.anchorTransition === true;
  const reduceMotion = useV2ReduceMotion();
  // The same Reduce Motion source Home's arrival reads, so both ends of a hand-off agree on the flight.
  const celebrationReduceMotion = useCelebrationReduceMotion();

  // Arriving with the Anchor, the push ran without an animation of its own
  // (see PRACTICE_OPTIONS). Once it has landed, leaving gets the ordinary V2
  // pop back, including the iOS edge swipe.
  useEffect(() => {
    if (!anchorTransition) return undefined;
    const timer = setTimeout(() => {
      navigation.setOptions({ animation: v2StackScreenOptions(reduceMotion).animation });
    }, V2_TRANSITION_SETTLE_MS + 200);
    return () => clearTimeout(timer);
  }, [anchorTransition, navigation, reduceMotion]);

  const anchorStore = useAnchorStore as typeof useAnchorStore | { getState?: () => { anchors?: Anchor[] } };
  const anchors = typeof anchorStore === 'function'
    ? anchorStore((s) => s.anchors)
    : (anchorStore.getState?.()?.anchors ?? []);
  const suppliedAnchor = anchorId
    ? anchors.find((a) => a.id === anchorId || a.localId === anchorId)
    : undefined;

  const resolvedReturnRoute = useMemo(() => {
    if (returnRoute) return returnRoute;
    if (source === 'vision') return 'V2Vision';
    if (source === 'chart') return 'V2Chart';
    if (source === 'home') return 'V2DevelopmentHome';
    if (source === 'anchor_details') return 'V2AnchorDetails';
    return undefined;
  }, [returnRoute, source]);

  const handleBack = useCallback(() => {
    if (resolvedReturnRoute) {
      if (resolvedReturnRoute === 'V2DevelopmentHome') {
        navigation.navigate('V2DevelopmentHome');
      } else if (anchorId) {
        navigation.navigate(resolvedReturnRoute, { anchorId });
      } else {
        navigation.navigate(resolvedReturnRoute);
      }
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [anchorId, navigation, resolvedReturnRoute]);

  // Reminder invitation: the notification state as it stands before this practice records itself.
  // Read once on mount (read only) so the completion can decide synchronously; unknown means no.
  const notificationSnapshotRef = useRef<NotificationState | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadNotificationStateSnapshot().then((snapshot) => {
      if (!cancelled && notificationSnapshotRef.current === null) notificationSnapshotRef.current = snapshot;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Set once a completion has started the invitation hand-off: a second Continue changes nothing. */
  const invitationStartedRef = useRef(false);

  const handleSessionCompleted = useCallback(
    (completion?: { source?: string; saved?: boolean }): boolean | void => {
      // The invitation hand-off already owns leaving: the complete screen stays up until it does.
      if (invitationStartedRef.current) return true;
      // The complete screen offers what it knows about itself when Continue is tapped. Taking it
      // here also clears it, so a completion that goes elsewhere leaves nothing behind.
      const departure = takePracticeDeparture();
      const staysOnHub = completion?.source === 'practice_hub' && !returnRoute;
      const canOpenInvitation = !staysOnHub && Boolean(suppliedAnchor) && resolvedReturnRoute === 'V2DevelopmentHome';
      // Saved completions record the first practice (a state write only: nothing is scheduled and
      // nothing is consented). Eligibility is decided from the state before that write. The record
      // is withheld when the state is unknown, or when this person is eligible but this completion
      // cannot open the invitation, so eligibility carries to the next practice that returns Home.
      let showInvitation = false;
      const snapshot = notificationSnapshotRef.current;
      if (completion?.saved === true && snapshot) {
        const auth = useAuthStore.getState();
        const eligible = !useReminderInvitationStore.getState().shownThisSession && shouldShowReminderInvitation({
          state: snapshot,
          isAuthenticated: auth?.isAuthenticated === true && auth?.isGuest !== true,
          hasCompletedOnboarding: auth?.hasCompletedOnboarding === true,
          sessionSaved: true,
        });
        showInvitation = eligible && canOpenInvitation;
        if (!eligible || showInvitation) {
          void markFirstPracticeCompletedInStorage();
          if (!snapshot.firstPracticeCompletedAt) {
            notificationSnapshotRef.current = { ...snapshot, firstPracticeCompletedAt: new Date().toISOString() };
          }
        }
      }
      // If the practice was launched from the practice screen itself (practice_hub)
      // and no explicit returnRoute was specified, stay on the practice screen.
      if (staysOnHub) {
        return;
      }
      // First practice to the reminder invitation instead of Home: the same Anchor flies there, and
      // the invitation hands it on to Home when the person leaves. Only for a return to Home.
      if (showInvitation && suppliedAnchor) {
        invitationStartedRef.current = true;
        const anchor = suppliedAnchor;
        const invitationDeparture = departure ?? { sessionId: null, at: Date.now(), measure: async () => null };
        const fallBackHome = () => {
          // This call did not run the invitation: return Home the ordinary way, never stuck.
          invitationStartedRef.current = false;
          if (departure) void handOffPracticeToHome(navigation, { anchor, departure }, { reduceMotion: celebrationReduceMotion });
          else navigation.navigate('V2DevelopmentHome');
        };
        void handOffPracticeToInvitation(navigation, { anchor, departure: invitationDeparture }, { reduceMotion: celebrationReduceMotion })
          .then((result) => { if (result === 'ignored') fallBackHome(); })
          .catch(fallBackHome);
        return true;
      }
      // Complete to Home: a saved practice that returns to Home carries its Anchor there. The
      // practice screen keeps the complete screen up (returning true) until the hand-off changes
      // the route itself.
      if (departure && suppliedAnchor && completion?.saved !== false && resolvedReturnRoute === 'V2DevelopmentHome') {
        void handOffPracticeToHome(navigation, { anchor: suppliedAnchor, departure }, { reduceMotion: celebrationReduceMotion });
        return true;
      }
      if (resolvedReturnRoute) {
        if (resolvedReturnRoute === 'V2DevelopmentHome') {
          navigation.navigate('V2DevelopmentHome');
        } else if (anchorId) {
          navigation.navigate(resolvedReturnRoute, { anchorId });
        } else {
          navigation.navigate(resolvedReturnRoute);
        }
      }
    },
    [anchorId, celebrationReduceMotion, navigation, resolvedReturnRoute, returnRoute, suppliedAnchor]
  );

  return (
    <V2PracticeScreen
      anchor={suppliedAnchor}
      initialMode={recommendedMode}
      resumeMode={resumeMode}
      resumeDuration={resumeDuration}
      resumeSource={resumeSource}
      onBack={handleBack}
      leaveOnSetupBack={Boolean(resolvedReturnRoute)}
      onSessionCompleted={handleSessionCompleted}
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
            returnRoute: resolvedReturnRoute,
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
        const navigate = (withHero: boolean) => navigation.navigate('V2Release', { anchorId: id, reason, ...(withHero ? { anchorTransition: true } : {}) });
        if (suppliedAnchor && transition) transition.startAnchorTransition({ anchor: suppliedAnchor, from: 'practiceSetup', to: { target: 'release', rect: releaseArtworkRect(viewport.width, viewport.height) }, onNavigate: navigate });
        else navigate(false);
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

  const generateExpression: CreationGenerationAdapter = useCallback(
    ({ draft, generationAttempt, count }) => generateExpressionCandidates({ draft, generationAttempt, count }),
    [],
  );

  const handleComplete = useCallback((handoff: CreationHandoff) => {
    void handOffToHome(navigation, handoff, { reduceMotion });
  }, [navigation, reduceMotion]);

  const handlePrepareHandoff = useCallback((handoff: Omit<CreationHandoff, 'markRect'>) => {
    prepareHomeArrival(handoff);
  }, []);

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
      generateExpression={generateExpression}
      onComplete={handleComplete}
      onPrepareHandoff={handlePrepareHandoff}
      onExit={handleExit}
      onPaywall={handlePaywall}
      onSignIn={handleSignIn}
    />
  );
}

function V2ReleaseRouteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AnchorV2StackParamList, 'V2Release'>>();
  const [active, setActive] = useState(false);
  const reduceMotion = useV2ReduceMotion();
  useEffect(() => {
    if (!active) return;
    const unsubscribe = navigation.addListener('beforeRemove', (event: { preventDefault: () => void }) => event.preventDefault());
    const hardwareBack = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => { unsubscribe(); hardwareBack.remove(); };
  }, [active, navigation]);
  useEffect(() => { navigation.setOptions({ gestureEnabled: !active }); }, [active, navigation]);
  useEffect(() => {
    if (!route.params.anchorTransition) return;
    const timer = setTimeout(() => navigation.setOptions({ animation: v2StackScreenOptions(reduceMotion).animation }), V2_TRANSITION_SETTLE_MS + 200);
    return () => clearTimeout(timer);
  }, [navigation, reduceMotion, route.params.anchorTransition]);
  const focused = useIsFocused();
  // Return Home reads the same Reduce Motion source Home's arrival reads, at the moment it is tapped.
  const celebrationReduceMotion = useCelebrationReduceMotion();
  const celebrationReduceMotionRef = useRef(celebrationReduceMotion);
  celebrationReduceMotionRef.current = celebrationReduceMotion;
  const continuations = useMemo(
    () => createReleaseContinuations(navigation, undefined, { getReduceMotion: () => celebrationReduceMotionRef.current }),
    [navigation],
  );
  return <V2ReleaseScreen {...route.params} {...continuations} focused={focused} onSessionActiveChange={setActive} />;
}

function V2VisionRouteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AnchorV2StackParamList, 'V2Vision'>>();
  const anchorId = route.params?.anchorId;

  return (
    <V2VisionScreen
      anchorId={anchorId}
      initialMode={route.params?.initialMode}
      edit={route.params?.edit}
      onBack={() => {
        if (navigation.canGoBack()) navigation.goBack();
      }}
      onChart={(id: string) => {
        navigation.navigate('V2Chart', { anchorId: id });
      }}
      onAddNote={(params: { anchorId: string; visionId?: string }) => navigation.navigate('V2VisionNoteComposer', params)}

    />
  );
}

function V2WeeklyInsightRouteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AnchorV2StackParamList, 'V2WeeklyInsight'>>();
  return <V2WeeklyInsightScreen route={route} navigation={navigation} onBack={() => navigation.goBack()} />;
}

function V2ProgressRouteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AnchorV2StackParamList, 'V2Progress'>>();
  const transition = useOptionalAnchorTransition();
  const reduceMotion = useV2ReduceMotion();
  const anchorTransition = route.params?.anchorTransition === true;
  const shownAnchorRef = useRef<Anchor | undefined>(undefined);
  const handleShownAnchor = useCallback((anchor?: Anchor) => { shownAnchorRef.current = anchor; }, []);

  // Arriving with the Anchor, the push only cross-faded (see PROGRESS_OPTIONS).
  // Once it has landed, leaving by edge swipe gets the ordinary V2 pop again.
  useEffect(() => {
    if (!anchorTransition) return undefined;
    const timer = setTimeout(() => {
      navigation.setOptions({ animation: v2StackScreenOptions(reduceMotion).animation });
    }, V2_TRANSITION_SETTLE_MS + 400);
    return () => clearTimeout(timer);
  }, [anchorTransition, navigation, reduceMotion]);

  const leave = useCallback(() => {
    // Release replaces this route, so there may be nothing behind it.
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('V2DevelopmentHome');
  }, [navigation]);

  /**
   * Back: the Anchor leaves the ring and returns to its place on the Details
   * underneath - but only to the Anchor Details actually holds. If the person
   * switched Anchors here, Details is not showing this one, and the route just
   * pops (the flight refuses any pair of places that are not the same Anchor).
   */
  const handleBack = useCallback((anchor?: Anchor) => {
    if (!transition || !anchor) {
      leave();
      return;
    }
    const restore = v2StackScreenOptions(reduceMotion).animation;
    // Set well before the pop is dispatched: the route cross-fades under the returning Anchor.
    navigation.setOptions({ animation: 'fade' });
    const accepted = transition.returnAnchor({
      anchor,
      from: 'progress',
      to: 'details',
      onNavigate: (withHero) => {
        if (withHero) {
          leave();
          return;
        }
        // No flight: the route's ordinary pop, after the options commit.
        navigation.setOptions({ animation: restore });
        setTimeout(leave, 0);
      },
    });
    // Another flight owns the Anchor: swallow the tap, keep the ordinary animation.
    if (!accepted) navigation.setOptions({ animation: restore });
  }, [leave, navigation, reduceMotion, transition]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false;
      handleBack(shownAnchorRef.current);
      return true;
    });
    return () => subscription.remove();
  }, [handleBack, navigation]);

  return (
    <V2ProgressScreen
      anchorId={route.params?.anchorId}
      onBack={handleBack}
      onAnchorResolved={handleShownAnchor}
      onNavigateToChart={(id: string) => navigation.navigate('V2Chart', { anchorId: id })}
      onNavigateToWeeklyInsight={(id: string) => navigation.navigate('V2WeeklyInsight', { anchorId: id })}
    />
  );
}

function V2LoginRouteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AnchorV2StackParamList, 'Login'>>();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.loginContainer}>
      <LoginScreen navigation={navigation} route={route} />
      {navigation.canGoBack() ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          hitSlop={8}
          // Centred on the Login hero's 44pt top row, which starts 8pt below the inset.
          style={[styles.loginBackButton, { top: insets.top + 10 }]}
        >
          <ArrowLeft color="#171717" size={20} strokeWidth={1.9} />
        </Pressable>
      ) : null}
    </View>
  );
}

function V2AuthRouteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AnchorV2StackParamList, 'V2Auth'>>();

  return (
    <V2AuthScreen
      initialMode={route.params?.initialMode}
      onBack={() => navigation.goBack()}
      onSuccess={(user) => {
        if (user.hasCompletedOnboarding) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'V2DevelopmentHome' }],
          });
        } else if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.replace('V2FirstRun');
        }
      }}
    />
  );
}

/**
 * Anchor 2.0 central stack navigator.
 */
export function AnchorV2Navigator() {
  const reduceMotion = useV2ReduceMotion();
  const user = useAuthStore((state) => state.user);
  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);
  const isGuest = useAuthStore((state) => state.isGuest);
  // A person who kept their Anchor on this device has finished onboarding without an account.
  const hasSession = Boolean(user?.id) || isGuest;
  const firstRunStep = useFirstRunStore((state) => state.draft.currentStep);
  const developerSkipOnboardingEnabled = useSettingsStore((state) => state.developerSkipOnboardingEnabled);
  const developerMasterAccountEnabled = useSettingsStore((state) => state.developerMasterAccountEnabled);
  const screenOptions = useMemo(() => v2StackScreenOptions(reduceMotion), [reduceMotion]);
  // The app shell withholds this navigator until Firebase restoration settles.
  // Remount on trusted auth/onboarding changes so a restored account never
  // briefly lands in first-run, and a new account returns to its draft.
  const shouldBypassOnboarding = __DEV__ && (developerSkipOnboardingEnabled || developerMasterAccountEnabled);
  const initialRouteName = shouldBypassOnboarding || (hasSession && hasCompletedOnboarding)
    ? 'V2DevelopmentHome'
    : 'V2FirstRun';
  return (
    <ProgressiveFocusTransitionProvider>
      <Stack.Navigator
        key={`${initialRouteName}:${hasSession && hasCompletedOnboarding ? (user?.id ? 'user' : 'guest-home') : firstRunStep === 'auth' ? 'onboarding-save' : user?.id ?? 'guest'}`}
        initialRouteName={initialRouteName}
        screenOptions={screenOptions}
      >
        <Stack.Screen name="V2DevelopmentHome" component={V2DevelopmentHome}
          options={({ route }) => releaseHomeScreenOptions(route.params, reduceMotion)}
          listeners={({ navigation, route }) => ({
            transitionEnd: ({ data }) => {
              // Consume the entry flag after arrival so later Home transitions keep their defaults.
              if (!data.closing && route.params?.releaseReturnFade) navigation.setParams({ releaseReturnFade: undefined });
            },
          })} />
        <Stack.Screen name="V2FirstRun" component={V2FirstRunFlow} />
        <Stack.Screen name="V2SystemGallery" component={V2SystemGallery} />
        {__DEV__ ? <Stack.Screen name="V2EvolvingAnchor" component={V2EvolvingAnchorPrototype} /> : null}
        {/* Tactile Creation Flow */}
        <Stack.Screen name="FirstAnchorCreation" component={IntentionInputScreen} options={{ headerShown: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="AnchorCreationFlow" component={AnchorCreationFlowScreen} options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="Paywall" component={V2PaywallRouteScreen} options={TRANSPARENT_BACKGROUND} />
        {/* Creation owns its back behaviour (a state machine, not a stack), so the edge swipe
          must not pop the route out from under a save or the hand-off. */}
        <Stack.Screen name="V2Creation" component={V2CreationRouteScreen} options={CREATION_OPTIONS} />
        <Stack.Screen name="V2AnchorLibrary" component={V2AnchorLibraryScreen} />
        <Stack.Screen name="V2AnchorDetails" component={V2AnchorDetailsScreen} options={{ ...PAPER_BACKGROUND, animation: 'none' }} />
        {/* The paywall draws a sheet over a deliberately transparent root. */}
        <Stack.Screen name="V2Paywall" component={V2PaywallRouteScreen} options={TRANSPARENT_BACKGROUND} />
        <Stack.Screen name="V2Practice" component={V2PracticeRouteScreen} options={PRACTICE_OPTIONS} />
        <Stack.Screen name="V2Vision" component={V2VisionRouteScreen} options={visionPreviewScreenOptions(reduceMotion)} />
        <Stack.Screen name="V2VisionNoteComposer" component={V2VisionNoteComposer} options={visionPreviewScreenOptions(reduceMotion)} />
        {/* DEFERRED: GRAPHITE_BACKGROUND on V2Chart and V2ChartWaypoint; frame one of the Chart is now map paper. */}
        <Stack.Screen name="V2Chart" component={V2ChartScreen} options={CREAM_BACKGROUND} />
        <Stack.Screen name="V2ChartWaypoint" component={V2ChartWaypointScreen} options={{ ...CREAM_BACKGROUND, animation: 'none', gestureEnabled: false }} />
        <Stack.Screen name="V2ChartAdjust" component={V2ChartAdjustScreen} options={CREAM_BACKGROUND} />
        <Stack.Screen name="V2ChartJourney" component={V2ChartJourneyScreen} options={CREAM_BACKGROUND} />
        <Stack.Screen name="V2Progress" component={V2ProgressRouteScreen} options={PROGRESS_OPTIONS} />
        <Stack.Screen name="V2Release" component={V2ReleaseRouteScreen} options={({ route }) => route.params?.anchorTransition ? { animation: 'none' } : {}} />
        <Stack.Screen name="V2WeeklyInsight" component={V2WeeklyInsightRouteScreen} />
        {/* Reminder invitation after the first practice. The invitation owns its back (it is "Not now"),
          and the time step must not be swiped away mid-permission. */}
        <Stack.Screen name="V2NotificationInvitation" component={V2NotificationInvitationScreen} options={INVITATION_OPTIONS} />
        <Stack.Screen name="V2ReminderTime" component={V2ReminderTimeScreen} options={REMINDER_TIME_OPTIONS} />
        {/* Legacy dark surfaces keep the app's transparent default. */}
        <Stack.Screen name="V2Settings" component={SettingsScreen} options={TRANSPARENT_BACKGROUND} />
        <Stack.Screen name="V2Auth" component={V2AuthRouteScreen} options={TRANSPARENT_BACKGROUND} />
        <Stack.Screen name="Login" component={V2LoginRouteScreen} options={TRANSPARENT_BACKGROUND} />
      </Stack.Navigator>
    </ProgressiveFocusTransitionProvider>
  );
}

const CREAM_BACKGROUND = v2ScreenBackground('cream');
const PAPER_BACKGROUND = v2ScreenBackground('paper');
const CREATION_OPTIONS = { gestureEnabled: false };
const GRAPHITE_BACKGROUND = v2ScreenBackground('graphite');
/**
 * When the Anchor flies in from Details the shared transition owns the motion,
 * so the route only cross-fades beneath the copy (no slide to fight it).
 */
const PROGRESS_OPTIONS = ({ route }: { route: RouteProp<AnchorV2StackParamList, 'V2Progress'> }) =>
  (route.params?.anchorTransition ? { ...GRAPHITE_BACKGROUND, animation: 'fade' as const } : GRAPHITE_BACKGROUND);
const TRANSPARENT_BACKGROUND = { contentStyle: { backgroundColor: 'transparent' } };
/** When the Anchor flies in from Details, the shared transition owns all the motion. */
const PRACTICE_OPTIONS = ({ route }: { route: RouteProp<AnchorV2StackParamList, 'V2Practice'> }) =>
  (route.params?.anchorTransition ? { animation: 'none' as const } : {});
/**
 * When the mark flies in from the complete screen the invitation owns the motion, and under Reduce
 * Motion the screen runs its own <=reducedMs crossfade: the push itself does not animate in either
 * case. Otherwise (no measurement) the route fades in.
 */
export const INVITATION_OPTIONS = ({ route }: { route: RouteProp<AnchorV2StackParamList, 'V2NotificationInvitation'> }) => ({
  ...CREAM_BACKGROUND,
  gestureEnabled: false,
  animation: route.params?.anchorTransition || route.params?.reducedMotion ? ('none' as const) : ('fade' as const),
});
const REMINDER_TIME_OPTIONS = { ...CREAM_BACKGROUND, gestureEnabled: false };

const styles = StyleSheet.create({
  // Login opens on cream paper; matching it keeps the push transition from flashing dark.
  loginContainer: {
    flex: 1,
    backgroundColor: '#F4F1E9',
  },
  loginBackButton: {
    position: 'absolute',
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(23, 23, 23, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
