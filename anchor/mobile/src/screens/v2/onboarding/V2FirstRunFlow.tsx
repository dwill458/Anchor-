import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { V2CreationFlow, type CreationGenerationAdapter, type CreationSaveAdapter } from '@/components/v2/creation/V2CreationFlow';
import { V2AuthScreen } from '@/screens/v2/auth/V2AuthScreen';
import { V2OnboardingJourney } from './V2OnboardingJourney';
import { useFirstRunStore } from '@/stores/v2/firstRunStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { generateExpressionCandidates } from '@/services/v2/creationPersistence';
import { saveOnboardingContext } from '@/services/v2/onboardingContext';
import { logger } from '@/utils/logger';
import { CATEGORY_TO_TIER, type Anchor } from '@/types';
import { colors } from '@/theme/v2';

const generateFirstExpression: CreationGenerationAdapter = ({ draft, generationAttempt, count }) =>
  generateExpressionCandidates({ draft, generationAttempt, count });

/** The shared creation flow owns intention, methodology, expression and candidate selection. */
const saveFirstAnchor: CreationSaveAdapter = async ({ draft }) => {
  if (!draft.structureSvg || !draft.distilledLetters?.length) {
    throw Object.assign(new Error('The Anchor structure is not ready.'), { failure: 'server' });
  }
  const localId = useFirstRunStore.getState().adoptCreation({
    intention: draft.normalizedIntention ?? draft.intention.trim(),
    category: draft.category,
    distilledLetters: draft.distilledLetters,
    anchorSvg: draft.structureSvg,
    expression: draft.expression,
    styleChoice: draft.expression === 'original' ? undefined : draft.styleChoice,
    enhancedImageUrl: draft.selectedCandidateIndex >= 0 ? draft.enhancedImageUrl : undefined,
  });
  const existing = useAnchorStore.getState().getAnchorById(localId);
  if (!existing) {
    const now = new Date();
    const category = draft.category ?? 'custom';
    const anchor: Anchor = {
      id: localId, localId, userId: 'pending',
      intentionText: draft.normalizedIntention ?? draft.intention.trim(),
      category, classifierMeta: { v2Expression: draft.expression, ...(draft.styleChoice ? { v2StyleChoice: draft.styleChoice } : {}) },
      ...(draft.enhancedImageUrl ? { enhancedImageUrl: draft.enhancedImageUrl } : {}),
      distilledLetters: draft.distilledLetters, baseSigilSvg: draft.structureSvg,
      structureVariant: 'balanced', planetaryTier: CATEGORY_TO_TIER[category],
      isCharged: false, activationCount: 0, chargeCount: 0, threadStrength: 0,
      createdAt: now, updatedAt: now,
    };
    useAnchorStore.getState().addAnchor(anchor);
  }
  useAuthStore.getState().setPendingFirstAnchorDraft({
    tempAnchorId: localId, source: 'onboarding_first_anchor', requiresAccountGate: true, createdAt: new Date(),
  });
  return { anchorId: localId };
};

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
      if (!user) reset();
      else navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
    }
  }, [draft.accountId, draft.currentStep, hydrated, navigation, reset, user]);

  if (!hydrated) return <View style={styles.loading}><Text style={styles.loadingText}>Restoring your progress…</Text></View>;

  if (['creation', 'intention', 'formation', 'anchor', 'expression'].includes(draft.currentStep)) {
    return <V2CreationFlow
      saveAnchor={saveFirstAnchor}
      generateExpression={generateFirstExpression}
      onComplete={() => setStep('auth')}
      onExit={() => setStep('handoff')}
      onSignIn={() => navigation.navigate('V2Auth', { initialMode: 'signin' })}
    />;
  }

  if (draft.currentStep === 'auth' || draft.currentStep === 'vision' || draft.currentStep === 'focus') {
    return <V2AuthScreen
      initialMode="create"
      saveProgress
      onBack={() => setStep('creation')}
      onSuccess={async (user) => {
        if (useAuthStore.getState().pendingFirstAnchorDraft) {
          const finalized = await useAuthStore.getState().finalizePendingFirstAnchorDraft();
          if (!finalized) throw new Error(useAuthStore.getState().pendingFirstAnchorError ?? 'Your first Anchor has not finished saving. Try again.');
        }
        bindAccount(user.id);
        try {
          await saveOnboardingContext(useFirstRunStore.getState().draft);
        } catch (contextError) {
          logger.warn('[V2FirstRunFlow] Could not save onboarding context', contextError);
        }
        markAnchorPersisted();
        markAuthCompleted();
        useAuthStore.getState().completeOnboarding();
        complete();
      }}
    />;
  }

  return <V2OnboardingJourney
    onSignIn={() => navigation.navigate('V2Auth', { initialMode: 'signin' })}
    onCreate={() => setStep('creation')}
  />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, loadingText: { color: colors.text.primary, fontSize: 16 } });
