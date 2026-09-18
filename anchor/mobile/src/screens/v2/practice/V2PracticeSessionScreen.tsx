import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { V2Button, V2EmptyState, V2InlineError, V2Screen } from '@/components/v2';
import { V2PracticeAnchorContext } from '@/components/v2/practice';
import { V2_PRACTICE_MODE_BY_ID, type V2PracticeMode } from '@/constants/v2/practice';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { isBackendAnchorId } from '@/services/BackendAnchorService';
import { colors, spacing, typography } from '@/theme/v2';
import type { GuidanceVoice } from '@/types/sessionAudio';
import { V2FocusActiveScreen, V2FocusCompleteScreen } from './focus';

type Props = {
  anchorId: string;
  mode: Exclude<V2PracticeMode, 'release'>;
  durationSeconds: number;
  source: 'practice_hub' | 'recommended_today';
  voice?: GuidanceVoice;
  ambient?: boolean;
  onBack: () => void;
  onCompleted: () => void;
};

type SessionStatus = 'active' | 'completing' | 'error';

export function V2PracticeSessionScreen({
  anchorId,
  mode,
  durationSeconds,
  source,
  voice,
  ambient,
  onBack,
  onCompleted,
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

  const defaultFocusSettings = useSettingsStore((state) => state.sessionAudioDefaults?.focus);
  const resolvedVoice = voice ?? defaultFocusSettings?.guidanceVoice ?? 'female';
  const resolvedAmbient = ambient ?? (defaultFocusSettings?.backgroundAudio !== 'off');

  // Focus redesign state
  const startedAtRef = useRef(new Date());
  const [focusPhase, setFocusPhase] = useState<'active' | 'complete'>('active');
  const [focusKey, setFocusKey] = useState<number>(0);
  const [strengthSnapshot, setStrengthSnapshot] = useState<{
    before: number | null;
    after: number | null;
  }>({ before: null, after: null });

  // Legacy state for other modes fallback
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [legacyStatus, setLegacyStatus] = useState<SessionStatus>('active');
  const [legacyError, setLegacyError] = useState<string | null>(null);

  const definition = V2_PRACTICE_MODE_BY_ID[mode];

  // Focus completion handler
  const handleFocusComplete = useCallback(
    async (sessionData: {
      plannedDurationSeconds: number;
      actualDurationSeconds: number;
      completedAt: string;
    }) => {
      if (!anchor) return;
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

        await PracticeCompletionService.flush(resolvedAccountId);
      } catch {
        // PracticeCompletionService durably persists to encrypted queue on failure
      }

      const freshAnchor = useAnchorStore
        .getState()
        .anchors.find((a) => a.id === anchor.id || a.localId === anchor.id);
      const afterStrength =
        typeof freshAnchor?.threadStrength === 'number'
          ? freshAnchor.threadStrength
          : beforeStrength;

      setStrengthSnapshot({
        before: beforeStrength,
        after: afterStrength,
      });
      setFocusPhase('complete');
    },
    [accountId, anchor, resolvedAmbient, resolvedVoice, source]
  );

  const handleDone = useCallback(() => {
    if (source === 'recommended_today') {
      onCompleted();
    } else {
      onBack();
    }
  }, [onBack, onCompleted, source]);

  const handleAgain = useCallback(() => {
    startedAtRef.current = new Date();
    setFocusPhase('active');
    setFocusKey((k) => k + 1);
  }, []);

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

  // Focus Mode Redesign
  if (mode === 'focus') {
    if (focusPhase === 'active') {
      return (
        <V2FocusActiveScreen
          key={focusKey}
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
      await PracticeCompletionService.flush(accountId);
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
      <View style={styles.content}>
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
      </View>
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
    flex: 1,
    gap: spacing[5],
    paddingTop: spacing[4],
    justifyContent: 'space-between',
    paddingBottom: spacing[6],
  },
  eyebrow: { ...typography.labelSM },
  title: { ...typography.displayMedium, color: colors.text.primary },
  timerBlock: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[8] },
  timer: { ...typography.numericLarge },
  hint: { ...typography.bodyMD, color: colors.text.secondary, textAlign: 'center' },
  empty: { flex: 1, justifyContent: 'center' },
});
