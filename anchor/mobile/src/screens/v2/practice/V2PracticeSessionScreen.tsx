import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { V2Button, V2EmptyState, V2InlineError, V2Screen } from '@/components/v2';
import { V2PracticeAnchorContext } from '@/components/v2/practice';
import { V2_PRACTICE_MODE_BY_ID, type V2PracticeMode } from '@/constants/v2/practice';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { isBackendAnchorId } from '@/services/BackendAnchorService';
import { markStabilizationStage, traceStabilizationStage } from '@/utils/stabilizationDiagnostics';
import { useV2Vision } from '@/hooks/v2/vision';
import { colors, spacing, typography } from '@/theme/v2';
import type { GuidanceVoice } from '@/types/sessionAudio';
import { V2FocusActiveScreen, V2FocusCompleteScreen } from './focus';
import { waitForFocusSave, type FocusSaveWaitResult } from './focus/focusSaveWait';
import { V2DeepFocusActiveScreen } from './deepFocus/V2DeepFocusActiveScreen';
import { isDeepFocusDuration } from './deepFocus/deepFocusTimeline';
import { V2CinematicSessionScreen, type PreparedCinematicSession, type CinematicCompletion } from './visualize/V2CinematicSessionScreen';
import { isV2VisualizeDuration } from './visualize/visualizeVisionPlan';
import { guideForVoice, loadBeatMap, trackForDuration } from './visualize/guided/visualizeBeatMap';
import type { V2PracticeCompletionResult } from './practiceRoutes';
import { useMilestonePresentationHold } from '@/hooks/v2/milestones/useMilestonePresentationHold';

type Props = {
  anchorId: string;
  mode: Exclude<V2PracticeMode, 'release'>;
  durationSeconds: number;
  source: 'practice_hub' | 'recommended_today';
  voice?: GuidanceVoice;
  preparedVisualize?: PreparedCinematicSession;
  ambient?: boolean;
  haptics?: boolean;
  focusEntryAnchorCenterY?: number;
  focusEntryAnchorSize?: number;
  /** The shared Anchor transition is carrying the Anchor in; the session hands its entry to it. */
  anchorTransition?: boolean;
  onBack: () => void;
  onCompleted: (result?: V2PracticeCompletionResult) => void;
  onFocusAgain: () => void;
};

type SessionStatus = 'active' | 'completing' | 'error';
type FocusSessionData = {
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  startedAt: string;
  completedAt: string;
};

const FOCUS_SAVE_UI_WAIT_MS = 5_000;

export function V2PracticeSessionScreen({
  anchorId,
  mode,
  durationSeconds,
  source,
  voice,
  preparedVisualize,
  ambient,
  haptics,
  focusEntryAnchorCenterY,
  focusEntryAnchorSize,
  anchorTransition = false,
  onBack,
  onCompleted,
  onFocusAgain,
}: Props) {
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const anchors = useAnchorStore((state) => state.anchors);
  const anchor = useMemo(
    () =>
      anchors.find(
        (item) =>
          (item.id === anchorId || item.localId === anchorId) &&
          !item.isReleased &&
          !item.archivedAt &&
          (!accountId || !item.userId || item.userId === accountId)
      ) ?? null,
    [accountId, anchorId, anchors]
  );
  const visionModel = useV2Vision(mode === 'visualize' ? anchorId : '');

  const defaultFocusSettings = useSettingsStore((state) => state.sessionAudioDefaults?.focus);
  const defaultDeepFocusSettings = useSettingsStore((state) => state.sessionAudioDefaults?.deep_prime);
  const defaultVisualizeSettings = useSettingsStore((state) => state.sessionAudioDefaults?.visualize);
  const hapticIntensity = useSettingsStore((state) => state.hapticIntensity);
  // Entering a Visualize session is what marks the Vision seen today, whichever way the person arrived.
  const visionViewRecorded = useRef(false);
  const recordVisionView = visionModel.recordVisionView;
  const visionIdForView = visionModel.vision?.id;
  useEffect(() => {
    if (mode !== 'visualize' || !visionIdForView || visionViewRecorded.current) return;
    visionViewRecorded.current = true;
    void recordVisionView();
  }, [mode, recordVisionView, visionIdForView]);
  const [visualizeCompletion, setVisualizeCompletion] = useState<CinematicCompletion | null>(null);
  const visualizePlaybackSeconds = mode === 'visualize' && isV2VisualizeDuration(durationSeconds)
    ? Math.round(loadBeatMap(trackForDuration(durationSeconds), guideForVoice(voice ?? defaultVisualizeSettings?.guidanceVoice ?? 'female')).durationMs / 1000)
    : durationSeconds;
  const completedVisualizeSeconds = visualizeCompletion?.record?.completedDurationSeconds ?? visualizePlaybackSeconds;
  const visualizeReturned = useRef(false);
  const finishVisualize = useCallback(() => {
    if (!visualizeCompletion || visualizeReturned.current) return;
    visualizeReturned.current = true;
    onCompleted({ mode: 'visualize', durationSeconds: completedVisualizeSeconds, saved: visualizeCompletion.saved });
  }, [completedVisualizeSeconds, onCompleted, visualizeCompletion]);
  const visualizeRecord = useSessionStore(state => visualizeCompletion?.record?.id
    ? state.practiceHistory.find(record => record.id === visualizeCompletion.record!.id) : undefined);
  const [focusSessionId, setFocusSessionId] = useState<string | null>(null);
  const [focusActualDurationSeconds, setFocusActualDurationSeconds] = useState<number | null>(null);
  const focusSessionRecord = useSessionStore((state) =>
    focusSessionId ? state.practiceHistory.find((record) => record.id === focusSessionId) : undefined
  );
  const audioDefaults = mode === 'deep_prime' ? defaultDeepFocusSettings : defaultFocusSettings;
  const resolvedVoice = voice ?? audioDefaults?.guidanceVoice ?? 'female';
  const resolvedAmbient = ambient ?? (audioDefaults?.backgroundAudio !== 'off');

  // Focus redesign state
  const startedAtRef = useRef(new Date());
  const legacyClockStartedRef = useRef(false);
  const [focusPhase, setFocusPhase] = useState<'active' | 'complete'>('active');
  useMilestonePresentationHold(mode === 'visualize' ? !visualizeCompletion : focusPhase !== 'complete');
  const [focusSaveState, setFocusSaveState] = useState<'saving' | FocusSaveWaitResult>('saving');
  const focusCompletionStartedRef = useRef(false);
  const focusSessionRequestRef = useRef<{ sessionId: string; sessionData: FocusSessionData } | null>(null);
  const [strengthSnapshot, setStrengthSnapshot] = useState<{
    before: number | null;
    after: number | null;
  }>({ before: null, after: null });

  // Legacy state for other modes fallback
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const preciseElapsedRef = useRef(0);
  const [legacyStatus, setLegacyStatus] = useState<SessionStatus>('active');
  const [legacyError, setLegacyError] = useState<string | null>(null);

  const definition = V2_PRACTICE_MODE_BY_ID[mode];

  // The non-Focus practice modes use their own active-time clock. Background
  // time is excluded and a delayed JS tick catches up from the monotonic wall
  // timestamp rather than adding one second per callback.
  useEffect(() => {
    // Focus and Visualize own their clocks (Visualize: the shared session engine).
    if (mode === 'focus' || mode === 'deep_prime' || mode === 'visualize' || legacyStatus !== 'active') return;
    if (!legacyClockStartedRef.current) {
      startedAtRef.current = new Date();
      legacyClockStartedRef.current = true;
    }
    let lastTick = Date.now();
    let appIsActive = AppState.currentState === 'active';
    const subscription = AppState.addEventListener('change', state => {
      appIsActive = state === 'active';
      lastTick = Date.now();
    });
    // Sub-second time stays in a ref; the screen only reads whole seconds, so
    // React re-renders once a second instead of on every 250ms tick.
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = appIsActive ? Math.max(0, now - lastTick) : 0;
      lastTick = now;
      if (delta <= 0) return;
      preciseElapsedRef.current = Math.min(durationSeconds, preciseElapsedRef.current + delta / 1000);
      const whole = Math.floor(preciseElapsedRef.current);
      setElapsedSeconds(previous => (previous === whole ? previous : whole));
    }, 250);
    return () => { clearInterval(interval); subscription.remove(); };
  }, [durationSeconds, legacyStatus, mode, visionModel.state.state]);

  const focusEndingPromiseRef = useRef<Promise<void> | null>(null);

  const startFocusPersistence = useCallback(
    (sessionData: FocusSessionData, retryAfterFailure = false) => {
      if (focusEndingPromiseRef.current && !retryAfterFailure) return focusEndingPromiseRef.current;
      if (sessionData.actualDurationSeconds < sessionData.plannedDurationSeconds) {
        return Promise.resolve();
      }
      setFocusActualDurationSeconds(sessionData.actualDurationSeconds);
      const resolvedAccountId = accountId ?? anchor?.userId ?? 'local-user';

      const beforeStrength =
        typeof anchor?.threadStrength === 'number' ? anchor.threadStrength : null;
      const sessionId = focusSessionRequestRef.current?.sessionId ?? `v2-${mode}-${anchor?.id}-${Date.now()}`;
      focusSessionRequestRef.current ??= { sessionId, sessionData };
      setFocusSessionId(sessionId);
      setFocusSaveState('saving');

      const promise = (async () => {
        try {
          await traceStabilizationStage('focus.persistence', () => PracticeCompletionService.completePracticeSession(
            {
              sessionId,
              accountId: resolvedAccountId,
              anchorId: anchor && isBackendAnchorId(anchor.id) ? anchor.id : null,
              anchorLocalId: anchor?.localId ?? anchor?.id,
              anchorServerId: anchor && isBackendAnchorId(anchor.id) ? anchor.id : null,
              mode,
              plannedDurationSeconds: sessionData.plannedDurationSeconds,
              actualDurationSeconds: sessionData.actualDurationSeconds,
              startedAt: sessionData.startedAt,
              completedAt: sessionData.completedAt,
              source: 'practice_screen',
              guidanceVoice: resolvedVoice,
              backgroundAudio: resolvedAmbient ? 'ambient' : 'off',
              metadata: { v2_entry_source: source },
            },
            { mirrorLegacySession: true, flushImmediately: false }
          ));

          // The canonical record is already durable locally. Network sync must
          // not hold the completion surface hostage when the account API is slow
          // or unavailable; `flush` retains the queued record on failure.
          void PracticeCompletionService.flush(resolvedAccountId).catch(() => undefined);
          setFocusSaveState('saved');
        } catch {
          // A rejection is a confirmed failure. Retry reuses this same session ID.
          setFocusSaveState('failed');
          throw new Error('Focus session durable receipt failed');
        }

        const freshAnchor = anchor
          ? useAnchorStore
              .getState()
              .anchors.find((a) => a.id === anchor.id || a.localId === anchor.id)
          : undefined;
        const sessionRecord = useSessionStore
          .getState()
          .practiceHistory.find((p) => p.id === sessionId);

        const resolvedBefore =
          sessionRecord?.threadStrengthBefore ??
          (typeof beforeStrength === 'number' ? beforeStrength : null);
        const resolvedAfter =
          sessionRecord?.threadStrengthAfter ??
          (typeof freshAnchor?.threadStrength === 'number'
            ? freshAnchor.threadStrength
            : resolvedBefore);

        setStrengthSnapshot({
          before: resolvedBefore,
          after: resolvedAfter,
        });
      })();

      focusEndingPromiseRef.current = promise;
      void promise.catch(() => undefined);
      return promise;
    },
    [accountId, anchor, mode, resolvedAmbient, resolvedVoice, source]
  );

  const handleFocusEnding = useCallback(
    (sessionData: {
      plannedDurationSeconds: number;
      actualDurationSeconds: number;
      startedAt: string;
      completedAt: string;
    }) => {
      if (!anchor || sessionData.actualDurationSeconds < sessionData.plannedDurationSeconds) return;
      void startFocusPersistence(sessionData).catch(() => undefined);
    },
    [anchor, startFocusPersistence]
  );

  // Focus completion handler
  const handleFocusComplete = useCallback(
    async (sessionData: {
      plannedDurationSeconds: number;
      actualDurationSeconds: number;
      startedAt: string;
      completedAt: string;
    }) => {
      if (!anchor || focusCompletionStartedRef.current) return;
      if (sessionData.actualDurationSeconds < sessionData.plannedDurationSeconds) {
        onBack();
        return;
      }
      // Lock before the asynchronous completion service begins. Both automatic
      // and manual endings enter here through the same active-screen callback.
      focusCompletionStartedRef.current = true;

      const persistence = focusEndingPromiseRef.current ?? startFocusPersistence(sessionData);
      const result = persistence
        ? await traceStabilizationStage('focus.receipt', () => waitForFocusSave(persistence, FOCUS_SAVE_UI_WAIT_MS))
        : 'failed';
      setFocusSaveState(result);
      markStabilizationStage('focus.complete-state');
      setFocusPhase('complete');
    },
    [anchor, startFocusPersistence]
  );

  const retryFocusPersistence = useCallback(async () => {
    const request = focusSessionRequestRef.current;
    if (!request || focusSaveState === 'saved' || focusSaveState === 'saving') return;
    let receipt = focusEndingPromiseRef.current;
    if (focusSaveState === 'failed') {
      // The canonical service is idempotent by account + this stable session ID.
      receipt = startFocusPersistence(request.sessionData, true);
    }
    if (!receipt) return;
    const result = await waitForFocusSave(receipt, FOCUS_SAVE_UI_WAIT_MS);
    setFocusSaveState(result);
  }, [focusSaveState, startFocusPersistence]);

  const handleDone = useCallback(() => {
    // Continue has a semantic destination: the Practice hub. The parent clears
    // both the session and setup layers, rather than relying on stack history.
    if (mode === 'focus' || mode === 'deep_prime') {
      onCompleted({
        mode,
        durationSeconds: focusActualDurationSeconds ?? durationSeconds,
        saved: focusSaveState === 'saved',
      });
      return;
    }
    onCompleted();
  }, [durationSeconds, focusActualDurationSeconds, focusSaveState, mode, onCompleted]);

  const handleAgain = useCallback(() => {
    onFocusAgain();
  }, [onFocusAgain]);

  if (!anchor) {
    return (
      <V2Screen testID="v2-practice-session">
        <View style={styles.empty}>
          <V2EmptyState
            title="Anchor unavailable"
            message="Choose an active Anchor before beginning a practice."
          />
        </View>
      </V2Screen>
    );
  }

  const currentBeforeStrength = focusSessionRecord?.threadStrengthBefore ?? strengthSnapshot.before;
  const currentAfterStrength =
    focusSessionRecord?.threadStrengthAfter ??
    (focusSessionRecord?.syncState === 'synced'
      ? typeof anchor.threadStrength === 'number'
        ? anchor.threadStrength
        : currentBeforeStrength
      : strengthSnapshot.after);

  if (mode === 'visualize' && !preparedVisualize && !visualizeCompletion && visionModel.state.state !== 'ready') {
    return (
      <V2Screen testID="v2-practice-session-vision-unavailable">
        <View style={styles.empty}>
          {visionModel.loading ? <ActivityIndicator color={definition.accent} /> : (
            <V2EmptyState title="Vision unavailable" message={visionModel.error ?? 'Open this Anchor’s Vision and try again.'}
              action={<V2Button onPress={() => { void visionModel.refresh(); }}>Retry Vision</V2Button>} />
          )}
        </View>
      </V2Screen>
    );
  }

  // Visualize: immersive Vision session. It records completion itself, only
  // when the full duration has run, through the Visualize completion contract.
  if (mode === 'visualize') {
    if (visualizeCompletion) return <V2FocusCompleteScreen
      anchor={preparedVisualize?.anchor ?? anchor} practiceTitle="Visualize" enterFrom="cream" durationSeconds={completedVisualizeSeconds}
      beforeStrength={visualizeRecord?.threadStrengthBefore ?? visualizeCompletion.record?.threadStrengthBefore}
      afterStrength={visualizeRecord?.threadStrengthAfter ?? visualizeCompletion.record?.threadStrengthAfter}
      strengthResultVerified={Boolean((visualizeRecord ?? visualizeCompletion.record)?.syncState === 'synced'
        && Number.isFinite((visualizeRecord ?? visualizeCompletion.record)?.threadStrengthBefore)
        && Number.isFinite((visualizeRecord ?? visualizeCompletion.record)?.threadStrengthAfter))}
      sessionSaved={visualizeCompletion.saved}
      sessionId={visualizeCompletion.record?.id ?? null}
      onDone={finishVisualize}
      onAgain={onFocusAgain} />;
    if (!isV2VisualizeDuration(durationSeconds)) {
      return (
        <V2Screen testID="v2-practice-session">
          <View style={styles.empty}>
            <V2EmptyState title="Visualize unavailable" message="Choose 1, 3 or 10 minutes and begin again." />
          </View>
        </V2Screen>
      );
    }
    return (
      <V2CinematicSessionScreen
        anchor={anchor}
        accountId={accountId}
        tiles={visionModel.tiles}
        notes={visionModel.vision?.notes}
        statement={visionModel.description}
        visionId={visionModel.vision?.id ?? null}
        durationSeconds={durationSeconds}
        voice={voice ?? defaultVisualizeSettings?.guidanceVoice ?? 'female'}
        ambient={ambient ?? (defaultVisualizeSettings?.backgroundAudio !== 'off')}
        haptics={haptics ?? (hapticIntensity ?? 70) > 0}
        source={source}
        onExit={onBack}
        prepared={preparedVisualize}
        onContinue={setVisualizeCompletion}
      />
    );
  }

  // Focus Mode Redesign
  if (mode === 'focus' || mode === 'deep_prime') {
    if (focusPhase === 'active') {
      if (mode === 'deep_prime') {
        if (!isDeepFocusDuration(durationSeconds)) {
          return <V2Screen><V2EmptyState title="Deep Focus unavailable" message="Choose 2, 5 or 10 minutes and begin again."
            action={<V2Button onPress={onBack}>Back to Practice</V2Button>} /></V2Screen>;
        }
        return <V2DeepFocusActiveScreen anchor={anchor} durationSeconds={durationSeconds}
          voice={resolvedVoice} ambient={resolvedAmbient} haptics={haptics ?? (hapticIntensity ?? 70) > 0}
          anchorHandoff={anchorTransition}
          onExit={onBack}
          onComplete={handleFocusComplete} />;
      }
      return (
        <V2FocusActiveScreen
          anchor={anchor}
          durationSeconds={durationSeconds}
          voice={resolvedVoice}
          ambient={resolvedAmbient}
          haptics={haptics ?? (hapticIntensity ?? 70) > 0}
          initialStage="entry"
          anchorHandoff={anchorTransition}
          entryStartCenterY={focusEntryAnchorCenterY}
          entryStartSize={focusEntryAnchorSize}
          onExit={onBack}
          onEnding={handleFocusEnding}
          onComplete={handleFocusComplete}
        />
      );
    }

    return (
      <V2FocusCompleteScreen
        anchor={anchor}
        practiceTitle={mode === 'deep_prime' ? 'Deep Focus' : undefined}
        durationSeconds={durationSeconds}
        beforeStrength={currentBeforeStrength}
        afterStrength={currentAfterStrength}
        strengthResultVerified={Boolean(focusSessionRecord?.syncState === 'synced' && Number.isFinite(focusSessionRecord.threadStrengthBefore) && Number.isFinite(focusSessionRecord.threadStrengthAfter))}
        sessionSaved={focusSaveState === 'saved'}
        sessionSaveState={focusSaveState}
        onRetrySave={() => void retryFocusPersistence()}
        sessionId={focusSessionId}
        onDone={handleDone}
        onAgain={handleAgain}
      />
    );
  }

  // Fallback for non-focus modes
  const elapsed = Math.min(Math.max(0, Math.floor(elapsedSeconds)), Math.max(1, durationSeconds));
  const remaining = Math.max(0, durationSeconds - elapsed);

  const completeLegacy = async () => {
    if (legacyStatus !== 'active' || !anchor || !accountId) return;
    if (elapsed < durationSeconds) return;
    setLegacyStatus('completing');
    try {
      await PracticeCompletionService.completePracticeSession(
        {
          sessionId: `v2-${mode}-${anchor.id}-${Date.now()}`,
          accountId,
          anchorId: isBackendAnchorId(anchor.id) ? anchor.id : null,
          anchorLocalId: anchor.localId ?? anchor.id,
          anchorServerId: isBackendAnchorId(anchor.id) ? anchor.id : null,
          mode,
          plannedDurationSeconds: durationSeconds,
          actualDurationSeconds: durationSeconds,
          startedAt: startedAtRef.current.toISOString(),
          source: 'practice_screen',
          guidanceVoice: 'none',
          backgroundAudio: 'off',
          metadata: { v2_entry_source: source },
        },
        { mirrorLegacySession: true, flushImmediately: false }
      );
      // Leave the session immediately after the local record is queued. Sync
      // continues in the background and the queue is retried later if needed.
      void PracticeCompletionService.flush(accountId).catch(() => undefined);
      onCompleted();
    } catch (cause) {
      setLegacyError(cause instanceof Error ? cause.message : 'This session could not be saved.');
      setLegacyStatus('error');
    }
  };

  return (
    <V2Screen testID="v2-practice-session">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Practice"
        onPress={onBack}
        disabled={legacyStatus === 'completing'}
        style={styles.back}
      >
        <ArrowLeft size={20} color={colors.text.primary} />
        <Text style={styles.backText}>Practice</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: definition.accent }]}>
          {definition.title.toUpperCase()}
        </Text>
        <Text style={styles.title}>Stay with your Anchor.</Text>
        <V2PracticeAnchorContext anchor={anchor} />
        <View>
        <View style={styles.timerBlock} accessibilityLiveRegion="polite">
          <Text
            testID="v2-practice-session-timer"
            style={[styles.timer, { color: definition.accent }]}
          >
            {`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`}
          </Text>
          <Text style={styles.hint}>
            {remaining > 0 ? 'Return to the intention in front of you.' : 'Session complete.'}
          </Text>
        </View>
        {legacyError ? (
          <V2InlineError
            message={legacyError}
            onRetry={() => {
              setLegacyError(null);
              setLegacyStatus('active');
            }}
          />
        ) : null}
        <V2Button
          size="large"
          loading={legacyStatus === 'completing'}
          disabled={legacyStatus === 'completing' || legacyStatus === 'error' || remaining > 0}
          accessibilityLabel={`Complete ${definition.title}`}
          onPress={() => void completeLegacy()}
        >
          {remaining > 0 ? `In progress (${remaining}s remaining)` : `Complete ${definition.title}`}
        </V2Button>
        </View>
      </ScrollView>
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
  },
  backText: { ...typography.labelLG, color: colors.text.primary },
  content: {
    flexGrow: 1,
    gap: spacing[5],
    paddingTop: spacing[4],
    justifyContent: 'space-between',
    paddingBottom: spacing[6],
  },
  eyebrow: { ...typography.labelSM },
  title: { ...typography.displayMedium, color: colors.text.primary },
  timerBlock: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[4] },
  timer: { ...typography.numericLarge },
  hint: { ...typography.bodyMD, color: colors.text.secondary, textAlign: 'center' },
  empty: { flex: 1, justifyContent: 'center' },
});
