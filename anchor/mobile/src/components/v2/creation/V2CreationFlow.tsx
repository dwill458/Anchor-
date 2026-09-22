import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { AnalyticsService } from '@/services/AnalyticsService';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { colors } from '@/theme/v2';
import type { AnchorExpression, CreationStep } from '@/constants/v2/creation';
import { useCreationStore, whenCreationHydrated, type CreationDraft, type SaveFailure } from '@/stores/v2/creationStore';
import { CreationStage, type WindowRect } from './CreationStage';
import { IntentionStep } from './IntentionStep';

export { sanitizeIntention } from './IntentionStep';
export type { WindowRect } from './CreationStage';

/**
 * Persists the drafted Anchor. It MUST honour `idempotencyKey` (retries reuse it) and resolve
 * with the server's Anchor id. A rejection may carry `failure` (see `SaveFailure`) so the flow
 * can tell a lost connection from the second-Anchor gate.
 */
export type CreationSaveAdapter = (input: { draft: CreationDraft; idempotencyKey: string }) => Promise<{ anchorId: string }>;

/** Persists the Destination for the saved Anchor. */
export type CreationDestinationAdapter = (input: { anchorId: string; description: string }) => Promise<void>;

/** Everything the next screen needs to receive the Anchor exactly where creation left it. */
export type CreationHandoff = {
  anchorId: string;
  /** The mark's on-screen square at the moment of hand-off, in window coordinates. */
  markRect: WindowRect | null;
  svg: string;
  category?: string;
  expression: AnchorExpression;
};

export interface V2CreationFlowProps {
  saveAnchor: CreationSaveAdapter;
  saveDestination: CreationDestinationAdapter;
  /** Creation is finished and the Anchor is saved; carry it into Home. */
  onComplete: (handoff: CreationHandoff) => void;
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

/**
 * Anchor 2.0 creation: one route, one state machine.
 *
 *   Intention → Distillation → Formation → Reveal → Expression → Destination → Home
 *
 * The intention is written on its own page; from the moment it is accepted everything
 * happens on one continuous stage, so the letters, the grid, the traced line and the finished
 * mark are the same objects throughout rather than a sequence of screens.
 */
export function V2CreationFlow({ saveAnchor, saveDestination, onComplete, onExit, onPaywall, onSignIn }: V2CreationFlowProps) {
  const draft = useCreationStore((state) => state.draft);
  const store = useCreationStore;
  const reduceMotion = useV2ReduceMotion();
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
  }, [onPaywall, saveAnchor, store]);

  const submitDestination = useCallback(async () => {
    if (!store.getState().beginDestinationSave()) return;
    const current = store.getState().draft;
    if (!current?.persistedAnchorId) return;
    try {
      await saveDestination({ anchorId: current.persistedAnchorId, description: current.destination.trim() });
      store.getState().completeDestination();
      track('v2_creation_destination_saved');
    } catch {
      store.getState().failDestination();
      track('v2_creation_destination_failed');
    }
  }, [saveDestination, store]);

  const skipDestination = useCallback(() => {
    store.getState().skipDestination();
    track('v2_creation_destination_skipped');
  }, [store]);

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
      onBack={goBack}
      onFormAnchor={formAnchor}
      onFormationDone={formationDone}
      onOpenExpression={store.getState().openExpression}
      onSelectExpression={store.getState().selectExpression}
      onKeep={keep}
      onSignIn={onSignIn}
      onPaywall={onPaywall}
      onDestinationChange={store.getState().setDestination}
      onDestinationSubmit={submitDestination}
      onDestinationSkip={skipDestination}
      onHandoff={handoff}
    />
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.canvas },
});
