import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import IntentionInputScreen from '@/screens/create/IntentionInputScreen';
import { V2SealedSaveScreen } from './V2SealedSaveScreen';
import { V2OnboardingJourney } from './V2OnboardingJourney';
import { useFirstRunStore } from '@/stores/v2/firstRunStore';
import { useAuthStore } from '@/stores/authStore';
import { saveOnboardingContext } from '@/services/v2/onboardingContext';
import { logger } from '@/utils/logger';
import { colors } from '@/theme/v2';
import { isSpecificFocus } from '@/constants/v2/focusAreas';
import { useSettingsStore } from '@/stores/settingsStore';
import { seedV2DemoAnchor } from '@/utils/v2DevSeeder';

export function V2FirstRunFlow() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);
  const { draft, hydrated, setStep, bindAccount, markAnchorPersisted, markAuthCompleted, complete, reset } = useFirstRunStore();

  useEffect(() => {
    if (!hydrated) return;
    if (draft.accountId && draft.accountId !== user?.id) { reset(); return; }
    if (user?.id && user.hasCompletedOnboarding) {
      navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
      return;
    }
    if (draft.currentStep === 'complete') {
      if (!user && !useAuthStore.getState().isGuest) reset();
      else navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
      return;
    }
    // A relaunch on the save step needs the Anchor it is saving; without it, make one.
    if (draft.currentStep === 'auth' && !user && !useAuthStore.getState().pendingFirstAnchorDraft) setStep('creation');
  }, [setStep, draft.accountId, draft.currentStep, hydrated, navigation, reset, user]);

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
      onContinue={() => {
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
      useAuthStore.getState().setHasCompletedOnboarding(true);
      useSettingsStore.getState().setDeveloperSkipOnboardingEnabled(true);
      navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
    }}
    onDevSeed={() => {
      seedV2DemoAnchor();
      navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
    }}
  />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, loadingText: { color: colors.text.primary, fontSize: 16 } });
