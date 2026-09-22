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
import { useV2Vision } from '@/hooks/v2/vision';
import { colors, spacing, typography } from '@/theme/v2';
import type { GuidanceVoice } from '@/types/sessionAudio';
import { V2FocusActiveScreen, V2FocusCompleteScreen } from './focus';
import { V2VisualizeSessionScreen } from './visualize/V2VisualizeSessionScreen';
import { isV2VisualizeDuration } from './visualize/visualizeVisionPlan';

type Props = {
  anchorId: string;
  mode: Exclude<V2PracticeMode, 'release'>;
  durationSeconds: number;
  source: 'practice_hub' | 'recommended_today';
  voice?: GuidanceVoice;
  ambient?: boolean;
  haptics?: boolean;
  onBack: () => void;
  onCompleted: () => void;
  onFocusAgain: () => void;
};

type SessionStatus = 'active' | 'completing' | 'error';

export function V2PracticeSessionScreen({
  anchorId,
  mode,
  durationSeconds,
  source,
  voice,
  ambient,
  haptics,
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
  const defaultVisualizeSettings = useSettingsStore((state) => state.sessionAudioDefaults?.visualize);
  const hapticIntensity = useSettingsStore((state) => state.hapticIntensity);
  const resolvedVoice = voice ?? defaultFocusSettings?.guidanceVoice ?? 'female';
  const resolvedAmbient = ambient ?? (defaultFocusSettings?.backgroundAudio !== 'off');

  // Focus redesign state
  const startedAtRef = useRef(new Date());
  const legacyClockStartedRef = useRef(false);
  const [focusPhase, setFocusPhase] = useState<'active' | 'complete'>('active');
  const focusCompletionStartedRef = useRef(false);
  const [strengthSnapshot, setStrengthSnapshot] = useState<{
    before: number | null;
    after: number | null;
  }>({ before: null, after: null });

  // Legacy state for other modes fallback
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [legacyStatus, setLegacyStatus] = useState<SessionStatus>('active');
  const [legacyError, setLegacyError] = useState<string | null>(null);

  const definition = V2_PRACTICE_MODE_BY_ID[mode];

  // The non-Focus practice modes use their own active-time clock. Background
  // time is excluded and a delayed JS tick catches up from the monotonic wall
  // timestamp rather than adding one second per callback.
  useEffect(() => {
    // Focus and Visualize own their clocks (Visualize: the shared session engine).
    if (mode === 'focus' || mode === 'visualize' || legacyStatus !== 'active') return;
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
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = appIsActive ? Math.max(0, now - lastTick) : 0;
      lastTick = now;
      if (delta > 0) setElapsedSeconds(previous => Math.min(durationSeconds, previous + delta / 1000));
    }, 250);
    return () => { clearInterval(interval); subscription.remove(); };
  }, [durationSeconds, legacyStatus, mode, visionModel.state.state]);

  // Focus completion handler
  const handleFocusComplete = useCallback(
    async (sessionData: {
      plannedDurationSeconds: number;
      actualDurationSeconds: number;
      completedAt: string;
    }) => {
      if (!anchor || focusCompletionStartedRef.current) return;
      // Lock before the asynchronous completion service begins. Both automatic
      // and manual endings enter here through the same active-screen callback.
      focusCompletionStartedRef.current = true;
      const resolvedAccountId = accountId ?? anchor.userId ?? 'local-user';

      const beforeStrength =
        typeof anchor.threadStrength === 'number' ? anchor.threadStrength : null;
      const sessionId = `v2-focus-${anchor.id}-${Date.now()}`;

      try {
        await PracticeCompletionService.completePracticeSession(
          {
            sessionId,
            accountId: resolvedAccountId,
            anchorId: isBackendAnchorId(anchor.id) ? anchor.id : null,
            anchorLocalId: anchor.localId ?? anchor.id,
            anchorServerId: isBackendAnchorId(anchor.id) ? anchor.id : null,
            mode: 'focus',
            plannedDurationSeconds: sessionData.plannedDurationSeconds,
            actualDurationSeconds: sessionData.actualDurationSeconds,
            startedAt: startedAtRef.current.toISOString(),
            completedAt: sessionData.completedAt,
            source: 'practice_screen',
            guidanceVoice: resolvedVoice,
            backgroundAudio: resolvedAmbient ? 'ambient' : 'off',
            metadata: { v2_entry_source: source },
          },
          { flushImmediately: false }
        );

        // The canonical record is already durable locally. Network sync must
        // not hold the completion surface hostage when the account API is slow
        // or unavailable; `flush` retains the queued record on failure.
        void PracticeCompletionService.flush(resolvedAccountId).catch(() => undefined);
      } catch {
        // PracticeCompletionService durably persists to encrypted queue on failure
      }

      const freshAnchor = useAnchorStore
        .getState()
        .anchors.find((a) => a.id === anchor.id || a.localId === anchor.id);
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
      setFocusPhase('complete');
    },
    [accountId, anchor, resolvedAmbient, resolvedVoice, source]
  );

  const handleDone = useCallback(() => {
    // Continue has a semantic destination: the Practice hub. The parent clears
    // both the session and setup layers, rather than relying on stack history.
    onCompleted();
  }, [onCompleted]);

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

  if (mode === 'visualize' && visionModel.state.state !== 'ready') {
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
    if (!isV2VisualizeDuration(durationSeconds)) {
      return (
        <V2Screen testID="v2-practice-session">
          <View style={styles.empty}>
            <V2EmptyState title="Visualize unavailable" message="Choose 1, 3 or 5 minutes and begin again." />
          </View>
        </V2Screen>
      );
    }
    return (
      <V2VisualizeSessionScreen
        anchor={anchor}
        accountId={accountId}
        tiles={visionModel.tiles}
        statement={visionModel.description}
        visionId={visionModel.vision?.id ?? null}
        durationSeconds={durationSeconds}
        voice={voice ?? defaultVisualizeSettings?.guidanceVoice ?? 'female'}
        ambient={ambient ?? (defaultVisualizeSettings?.backgroundAudio !== 'off')}
        haptics={haptics ?? (hapticIntensity ?? 70) > 0}
        source={source}
        onExit={onBack}
        onContinue={onCompleted}
      />
    );
  }

  // Focus Mode Redesign
  if (mode === 'focus') {
    if (focusPhase === 'active') {
      return (
        <V2FocusActiveScreen
          anchor={anchor}
          durationSeconds={durationSeconds}
          voice={resolvedVoice}
          ambient={resolvedAmbient}
          onExit={onBack}
          onComplete={handleFocusComplete}
        />
      );
    }

    return (
      <V2FocusCompleteScreen
        anchor={anchor}
        durationSeconds={durationSeconds}
        beforeStrength={strengthSnapshot.before}
        afterStrength={strengthSnapshot.after}
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
          actualDurationSeconds: Math.max(1, elapsed),
          startedAt: startedAtRef.current.toISOString(),
          source: 'practice_screen',
          guidanceVoice: 'none',
          backgroundAudio: 'off',
          metadata: { v2_entry_source: source },
        },
        { flushImmediately: false }
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
          disabled={legacyStatus === 'completing' || legacyStatus === 'error'}
          accessibilityLabel={
            remaining > 0 ? `Finish ${definition.title}` : `Complete ${definition.title}`
          }
          onPress={() => void completeLegacy()}
        >
          {remaining > 0 ? `Finish ${definition.title}` : `Complete ${definition.title}`}
        </V2Button>
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
