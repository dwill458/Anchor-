import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Image, StyleSheet, View } from 'react-native';

import { AnalyticsService } from '@/services/AnalyticsService';
import { useCreationReduceMotion, useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { colors } from '@/theme/v2';
import type { AnchorExpression, CreationStep, GeneratedAnchorCandidate } from '@/constants/v2/creation';
import { useAnchorStore } from '@/stores/anchorStore';
import { GENERATION_ERRORS, useCreationStore, whenCreationHydrated, type CreationDraft, type SaveFailure } from '@/stores/v2/creationStore';
import { CreationStage, type WindowRect } from './CreationStage';
import { CREATION_PACE, GENERATION_TIMING } from './creationMotion';
import { IntentionStep } from './IntentionStep';

export { sanitizeIntention } from './IntentionStep';
export type { WindowRect } from './CreationStage';

/**
 * Persists the drafted Anchor. It MUST honour `idempotencyKey` (retries reuse it) and resolve
 * with the server's Anchor id. A rejection may carry `failure` (see `SaveFailure`) so the flow
 * can tell a lost connection from the second-Anchor gate.
 */
export type CreationSaveAdapter = (input: { draft: CreationDraft; idempotencyKey: string }) => Promise<{ anchorId: string }>;

/**
 * Starts the existing visual-expression generation for the canonical structure. `count` is how
 * many interpretations are still needed; the answer may hold fewer, never more.
 */
export type CreationGenerationAdapter = (input: { draft: CreationDraft; generationAttempt: number; count: number }) => Promise<{ candidates: GeneratedAnchorCandidate[]; metadata?: Record<string, unknown> }>;

/** Everything the next screen needs to receive the Anchor exactly where creation left it. */
export type CreationHandoff = {
  anchorId: string;
  /** The mark's on-screen square at the moment of hand-off, in window coordinates. */
  markRect: WindowRect | null;
  svg: string;
  category?: string;
  expression: AnchorExpression;
  imageUrl?: string;
};

export interface V2CreationFlowProps {
  saveAnchor: CreationSaveAdapter;
  generateExpression: CreationGenerationAdapter;
  /** Creation is finished and the Anchor is saved; carry it into Home. */
  onComplete: (handoff: CreationHandoff) => void;
  /**
   * The Anchor has just been saved and creation is resolving it into its circle. Home can
   * begin preparing for it now; `onComplete` follows with where the mark sits on screen.
   */
  onPrepareHandoff?: (handoff: Omit<CreationHandoff, 'markRect'>) => void;
  /** Leave creation from its first step. The draft is kept and resumes next time. */
  onExit?: () => void;
  /** The server refused a second Anchor on the free plan. The draft is kept for the return. */
  onPaywall?: () => void;
  onSignIn?: () => void;
}

const track = (event: string, properties?: Record<string, string | boolean | number>) => {
  try {
    AnalyticsService.track(event, properties);
  } catch {
    /* analytics never interrupts creation */
  }
};

const failureOf = (error: unknown): SaveFailure => {
  const failure = (error as { failure?: SaveFailure } | null)?.failure;
  return failure ?? 'server';
};

const generationFailureMessage = (error: unknown): string => {
  const failure = (error as { failure?: string } | null)?.failure;
  if (failure === 'network') return GENERATION_ERRORS.offline;
  if (failure === 'limit') return GENERATION_ERRORS.limit;
  return GENERATION_ERRORS.failed;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

/**
 * Resolves once the finished images are decoded (or after `timeoutMs`), so a candidate is
 * never revealed as an empty circle. Never rejects: an image that will not load falls back to
 * the structure in its circle, which is still the true Anchor.
 */
async function imagesReady(urls: string[], timeoutMs: number): Promise<void> {
  if (typeof Image.prefetch !== 'function' || !urls.length) return;
  await Promise.race([
    Promise.all(urls.map((url) => Promise.resolve().then(() => Image.prefetch(url)).catch(() => false))),
    wait(timeoutMs),
  ]);
}

/**
 * Anchor 2.0 creation: one route, one state machine.
 *
 *   Intention → Distillation → Formation → Reveal → Expression → Generation → Choose → Home
 *
 * The intention is written on its own page; from the moment it is accepted everything
 * happens on one continuous stage, so the letters, the grid, the traced line and the finished
 * mark are the same objects throughout rather than a sequence of screens.
 */
export function V2CreationFlow({ saveAnchor, generateExpression, onComplete, onPrepareHandoff, onExit, onPaywall, onSignIn }: V2CreationFlowProps) {
  const draft = useCreationStore((state) => state.draft);
  const store = useCreationStore;
  const reduceMotion = useCreationReduceMotion();
  // The first Anchor is watched at full length; the pace for later ones is tuned in one place.
  const isFirstAnchor = useAnchorStore((state) => (state.anchors?.length ?? 0) === 0);
  const pace = isFirstAnchor ? CREATION_PACE.first : CREATION_PACE.repeat;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;
  const [hydrated, setHydrated] = useState(() => useCreationStore.persist.hasHydrated());
  const entryHandled = useRef(false);
  const [entryStep, setEntryStep] = useState<CreationStep>('intention');
  const completed = useRef(false);

  useEffect(() => {
    if (hydrated) return;
    let alive = true;
    void whenCreationHydrated().then(() => {
      if (alive) setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [hydrated]);

  // Entry, once: finished work is never resumed; unfinished work is. This is deliberately not
  // reactive to the draft — saving marks it finished while the user is still on screen.
  useEffect(() => {
    if (!hydrated || entryHandled.current) return;
    entryHandled.current = true;
    const current = store.getState().draft;
    if (!current || current.anchorPersisted) {
      store.getState().start();
      track('v2_creation_started');
    } else {
      track('v2_creation_resumed', { step: current.currentStep });
    }
    setEntryStep(store.getState().draft?.currentStep ?? 'intention');
  }, [hydrated, store]);

  // A draft discarded from elsewhere while the flow is open starts clean rather than blank.
  useEffect(() => {
    if (hydrated && entryHandled.current && !draft && !completed.current) store.getState().start();
  }, [draft, hydrated, store]);

  const step = draft?.currentStep;
  const lastStep = useRef(step);
  useEffect(() => {
    // The stage mounts when the intention is accepted; it remembers where it was entered.
    if (lastStep.current === 'intention' && step && step !== 'intention') setEntryStep(step);
    lastStep.current = step;
    if (step) track('v2_creation_step_viewed', { step });
  }, [step]);

  const goBack = useCallback(() => {
    if (store.getState().goBack()) return;
    if (store.getState().draft?.currentStep === 'intention') onExit?.();
  }, [onExit, store]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack]);

  const submitIntention = useCallback(() => {
    if (store.getState().distill()) {
      v2Haptics.selection();
      track('v2_creation_intention_completed');
    }
  }, [store]);

  const formAnchor = useCallback(() => {
    if (store.getState().formAnchor()) track('v2_creation_formation_started');
  }, [store]);

  const formationDone = useCallback(() => {
    store.getState().completeFormation();
    v2Haptics.confirmation();
    track('v2_creation_revealed');
  }, [store]);

  const keep = useCallback(async () => {
    const key = store.getState().beginSave();
    const current = store.getState().draft;
    if (!key || !current) return;
    track('v2_creation_save_started', { expression: current.expression });
    try {
      const { anchorId } = await saveAnchor({ draft: current, idempotencyKey: key });
      if (current.structureSvg) {
        try {
          onPrepareHandoff?.({
            anchorId,
            svg: current.structureSvg,
            category: current.category,
            expression: current.expression,
            imageUrl: current.selectedCandidateIndex >= 0 ? current.enhancedImageUrl : undefined,
          });
        } catch {
          /* preparing Home is best-effort; the hand-off still completes without it */
        }
      }
      store.getState().completeSave(anchorId);
      v2Haptics.completion();
      track('v2_creation_saved', { expression: current.expression, category: current.category ?? 'custom' });
    } catch (error) {
      const failure = failureOf(error);
      store.getState().failSave(failure);
      track('v2_creation_save_failed', { failure });
      if (failure === 'second_anchor') onPaywall?.();
      else v2Haptics.warning();
    }
  }, [onPaywall, onPrepareHandoff, saveAnchor, store]);

  const generate = useCallback(async () => {
    const plan = store.getState().beginGeneration();
    if (!plan) return;
    const current = store.getState().draft;
    if (!current) return;
    const startedAt = Date.now();
    const style = current.styleChoice ?? current.expression;
    track('v2_creation_generation_started', { expression: current.expression, style, attempt: plan.attempt, requested: plan.missing });
    try {
      const result = await generateExpression({ draft: current, generationAttempt: plan.attempt, count: plan.missing });
      const fresh = (result.candidates ?? []).filter((candidate) => candidate?.imageUrl).slice(0, plan.missing);
      // Nothing is revealed until it exists and can be shown: the images are decoded first,
      // and ordinary latency is covered by the development sequence already on screen.
      await imagesReady(fresh.map((candidate) => candidate.imageUrl), GENERATION_TIMING.imageWait);
      if (!reduceMotionRef.current) await wait(GENERATION_TIMING.minimumBeforeReveal - (Date.now() - startedAt));
      store.getState().completeGeneration(plan.requestId, fresh, result.metadata);
      const after = store.getState().draft;
      if (after?.generationState === 'complete') {
        v2Haptics.confirmation();
        track('v2_creation_generation_completed', { expression: current.expression, style, candidateCount: after.generatedCandidates.length, ms: Date.now() - startedAt });
      } else if (after?.generationRequestId === plan.requestId) {
        track('v2_creation_generation_partial', { expression: current.expression, style, received: fresh.length, requested: plan.missing });
        v2Haptics.warning();
      }
    } catch (error) {
      store.getState().failGeneration(plan.requestId, generationFailureMessage(error));
      track('v2_creation_generation_failed', { expression: current.expression, style, failure: (error as { failure?: string } | null)?.failure ?? 'unknown' });
      v2Haptics.warning();
    }
  }, [generateExpression, store]);

  const handoff = useCallback((markRect: WindowRect | null) => {
    const current = store.getState().draft;
    if (completed.current || !current?.persistedAnchorId || !current.structureSvg) return;
    completed.current = true;
    track('v2_creation_completed', { expression: current.expression });
    onComplete({
      anchorId: current.persistedAnchorId,
      markRect,
      svg: current.structureSvg,
      category: current.category,
      expression: current.expression,
      imageUrl: current.selectedCandidateIndex >= 0 ? current.enhancedImageUrl : undefined,
    });
  }, [onComplete, store]);

  if (!hydrated || !draft) return <View style={styles.blank} testID="v2-creation-loading" />;

  if (draft.currentStep === 'intention') {
    return (
      <IntentionStep
        intention={draft.intention}
        formationError={draft.formationError}
        onChange={store.getState().setIntention}
        onSubmit={submitIntention}
        onExit={onExit}
      />
    );
  }

  return (
    <CreationStage
      draft={draft}
      reduceMotion={reduceMotion}
      entryStep={entryStep}
      pace={pace}
      onBack={goBack}
      onFormAnchor={formAnchor}
      onFormationDone={formationDone}
      onOpenExpression={store.getState().openExpression}
      onSelectStyle={store.getState().selectStyle}
      onKeep={keep}
      onGenerate={generate}
      onKeepOriginal={store.getState().keepOriginal}
      onSelectCandidate={store.getState().selectCandidate}
      onReturnToPrevious={store.getState().returnToPrevious}
      onSignIn={onSignIn}
      onPaywall={onPaywall}
      onHandoff={handoff}
    />
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.canvas },
});
