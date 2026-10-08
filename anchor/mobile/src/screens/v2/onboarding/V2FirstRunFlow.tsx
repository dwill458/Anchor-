import React, { useEffect, useRef } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import IntentionInputScreen from '@/screens/create/IntentionInputScreen';
import { V2SealedSaveScreen, type SaveKind } from './V2SealedSaveScreen';
import { V2OnboardingJourney } from './V2OnboardingJourney';
import { useFirstRunStore } from '@/stores/v2/firstRunStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { isBackendAnchorId } from '@/services/BackendAnchorService';
import { saveOnboardingContext } from '@/services/v2/onboardingContext';
import { logger } from '@/utils/logger';
import { colors } from '@/theme/v2';
import { isSpecificFocus } from '@/constants/v2/focusAreas';
import { useSettingsStore } from '@/stores/settingsStore';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import { seedV2DemoAnchor } from '@/utils/v2DevSeeder';
import { OnboardingAnalytics } from '@/services/v2/onboardingAnalytics';

export function V2FirstRunFlow() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);
  const { draft, hydrated, setStep, bindAccount, markAnchorPersisted, markAuthCompleted, complete, reset } = useFirstRunStore();
  const prevStepRef = useRef<typeof draft.currentStep | undefined>(undefined);

  useEffect(() => {
    if (!hydrated) return;
    if (draft.accountId && draft.accountId !== user?.id) { reset(); return; }
    if (user?.id && user.hasCompletedOnboarding) {
      const isLockedFreeUser = !useSubscriptionStore.getState().hasActiveEntitlement &&
        Boolean(user.freeAnchorConsumed || (user.totalAnchorsCreated ?? 0) >= 1);
      if (isLockedFreeUser) {
        const anchorStore = useAnchorStore.getState();
        anchorStore.anchors
          .filter((a) => !isBackendAnchorId(a.id))
          .forEach((a) => anchorStore.removeAnchor(a.id));
        useAuthStore.getState().clearPendingFirstAnchorState();
      }
      OnboardingAnalytics.bypassed('returning_user');
      navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
      return;
    }
    if (draft.currentStep === 'complete') {
      if (!user && !useAuthStore.getState().isGuest) reset();
      else {
        if (user) {
          const isLockedFreeUser = !useSubscriptionStore.getState().hasActiveEntitlement &&
            Boolean(user.freeAnchorConsumed || (user.totalAnchorsCreated ?? 0) >= 1);
          if (isLockedFreeUser) {
            const anchorStore = useAnchorStore.getState();
            anchorStore.anchors
              .filter((a) => !isBackendAnchorId(a.id))
              .forEach((a) => anchorStore.removeAnchor(a.id));
            useAuthStore.getState().clearPendingFirstAnchorState();
          }
        }
        OnboardingAnalytics.bypassed('already_complete');
        navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
      }
      return;
    }
    // A relaunch on the save step needs the Anchor it is saving; without it, make one.
    if (draft.currentStep === 'auth' && !user && !useAuthStore.getState().pendingFirstAnchorDraft) setStep('creation');
  }, [setStep, draft.accountId, draft.currentStep, hydrated, navigation, reset, user]);

  useEffect(() => {
    if (!hydrated) return;
    const isBeingBypassed = Boolean(user?.id && user.hasCompletedOnboarding)
      || (draft.currentStep === 'complete' && (user || useAuthStore.getState().isGuest));
    if (isBeingBypassed) return;
    const step = draft.currentStep;
    if (prevStepRef.current === undefined) {
      OnboardingAnalytics.started(step);
      OnboardingAnalytics.stepChanged(undefined, step);
    } else {
      OnboardingAnalytics.stepChanged(prevStepRef.current, step);
    }
    prevStepRef.current = step;
  }, [hydrated, draft.currentStep]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' && hydrated && draft.currentStep !== 'complete') {
        OnboardingAnalytics.backgrounded(draft.currentStep);
      }
    });
    return () => subscription?.remove();
  }, [draft.currentStep, hydrated]);

  if (!hydrated) return <View style={styles.loading}><Text style={styles.loadingText}>Restoring your progress…</Text></View>;

  if (['creation', 'intention', 'formation', 'anchor', 'expression'].includes(draft.currentStep)) {
    return <IntentionInputScreen
      fromOnboarding
      onBack={() => setStep('motivation')}
      // The one onboarding answer names the Anchor's category. "Something else" is the
      // default (Desire), so the words decide and fall back to it.
      chosenCategory={isSpecificFocus(draft.focusCategory) ? draft.focusCategory : undefined}
    />;
  }

  if (draft.currentStep === 'auth' || draft.currentStep === 'vision' || draft.currentStep === 'focus') {
    // The Anchor is already safe on this device. An account is an upgrade, never a gate.
    return <V2SealedSaveScreen
      initialSaved={user && draft.anchorPersisted && !useAuthStore.getState().pendingFirstAnchorDraft ? 'account' : null}
      onBack={() => setStep('creation')}
      onAccountReady={async (signedIn) => {
        if (useAuthStore.getState().pendingFirstAnchorDraft) {
          const finalized = await useAuthStore.getState().finalizePendingFirstAnchorDraft();
          if (!finalized) throw new Error(useAuthStore.getState().pendingFirstAnchorError ?? 'Your first Anchor has not finished saving. Try again.');
        }
        useAuthStore.getState().setIsGuest(false);
        bindAccount(signedIn.id);
        try {
          await saveOnboardingContext(useFirstRunStore.getState().draft);
        } catch (contextError) {
          logger.warn('[V2FirstRunFlow] Could not save onboarding context', contextError);
        }
        markAnchorPersisted();
        markAuthCompleted();
      }}
      // Guest: the Anchor stays in the local vault with its pending draft; signing in later from
      // Settings uploads it. isGuest is what keeps the next launch from replaying onboarding.
      onContinueWithout={() => {
        const auth = useAuthStore.getState();
        auth.setIsGuest(true);
        if (auth.pendingFirstAnchorDraft) auth.setPendingFirstAnchorDraft({ ...auth.pendingFirstAnchorDraft, requiresAccountGate: false });
      }}
      onContinue={(kind: SaveKind) => {
        OnboardingAnalytics.completed(kind === 'account' ? 'account' : 'guest');
        useFirstAnchorFlowStore.getState().clearDraft();
        useAuthStore.getState().completeOnboarding();
        complete();
        navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
      }}
    />;
  }

  return <V2OnboardingJourney
    onSignIn={() => navigation.navigate('V2Auth', { initialMode: 'signin' })}
    onCreate={() => setStep('creation')}
    onDevSkip={() => {
      useFirstAnchorFlowStore.getState().clearDraft();
      useAuthStore.getState().setHasCompletedOnboarding(true);
      useSettingsStore.getState().setDeveloperSkipOnboardingEnabled(true);
      navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
    }}
    onDevSeed={() => {
      useFirstAnchorFlowStore.getState().clearDraft();
      seedV2DemoAnchor();
      navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
    }}
  />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, loadingText: { color: colors.text.primary, fontSize: 16 } });
