import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCourseStore } from '@/stores/courseStore';
import { useAuthStore } from '@/stores/authStore';
import { useReflectionDraftStore, type ReflectionDraft } from '@/stores/reflectionDraftStore';
import { draftToCreateRequest, isReflectionNetworkError, reflectionService } from '@/services/ReflectionService';
import { ChartButton, ChartCard, ReadOnlyNotice } from '@/screens/chart/chartUi';
import { colors, spacing, typography } from '@/theme';
import type {
  ReflectionMood,
  ReflectionPromptType,
  ReflectionRecord,
  ReflectionSource,
  ReflectionStructuredContent,
} from '@/types/chart';
import { reflectionPrompt } from './reflectionPrompts';
import { ReflectionMoodPicker } from './ReflectionMoodPicker';
import { StructuredCompletionFields } from './StructuredCompletionFields';

export type ReflectionComposerProps = {
  source: ReflectionSource;
  promptType: ReflectionPromptType;
  promptVersion: number;
  practiceSessionId?: string;
  anchorId?: string;
  courseId?: string;
  waypointId?: string;
  initialReflection?: ReflectionRecord;
  draftKey: string;
  autoPresented?: boolean;
  onSaved: (reflection: ReflectionRecord) => void;
  onSkipped: () => void;
  onDeleted?: () => void;
};

const createIdempotencyKey = () => `reflection-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
const clean = (value?: string) => value?.trim() || undefined;

/**
 * The identity fields a draft is built from. Memoizing on these scalars rather
 * than on the props object keeps the draft stable across ordinary rerenders —
 * `props` is a new object every render, so depending on it recomputed the draft
 * (and re-ran the autosave effect) on every keystroke and every error render.
 */
type ReflectionDraftIdentity = Pick<
  ReflectionComposerProps,
  'source' | 'promptType' | 'promptVersion' | 'practiceSessionId' | 'anchorId' | 'courseId' | 'waypointId' | 'draftKey'
>;

function draftFromProps(props: ReflectionDraftIdentity, accountId: string, idempotencyKey: string): ReflectionDraft {
  const relationships = props.source === 'POST_PRACTICE'
    ? { ...(props.practiceSessionId ? { practiceSessionId: props.practiceSessionId } : {}), ...(props.anchorId ? { anchorId: props.anchorId } : {}) }
    : props.source === 'WAYPOINT_COMPLETION'
      ? { ...(props.courseId ? { courseId: props.courseId } : {}), ...(props.waypointId ? { waypointId: props.waypointId } : {}), ...(props.anchorId ? { anchorId: props.anchorId } : {}) }
      : props.source === 'ANCHOR_RELEASE'
        ? { ...(props.anchorId ? { anchorId: props.anchorId } : {}) }
        : { ...(props.courseId ? { courseId: props.courseId } : {}), ...(props.anchorId ? { anchorId: props.anchorId } : {}) };
  return {
    draftKey: props.draftKey,
    accountId,
    source: props.source,
    promptType: props.promptType,
    promptVersion: props.promptVersion,
    ...relationships,
    updatedAt: new Date().toISOString(),
    saveState: 'draft',
    retryCount: 0,
    idempotencyKey,
  };
}

export const ReflectionComposer: React.FC<ReflectionComposerProps> = (props) => {
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const flags = useCourseStore((state) => state.flags);
  const offline = useCourseStore((state) => state.offline);
  const draftStore = useReflectionDraftStore();
  const prompt = reflectionPrompt(props.promptType, props.promptVersion);
  const initial = props.initialReflection;
  const [body, setBody] = useState(initial?.body ?? '');
  const [structured, setStructured] = useState<ReflectionStructuredContent>(initial?.structuredContent ?? {});
  const [moodAfter, setMoodAfter] = useState<ReflectionMood | undefined>(initial?.moodAfter ?? undefined);
  const [moodBefore, setMoodBefore] = useState<ReflectionMood | undefined>(initial?.moodBefore ?? undefined);
  const [idempotencyKey, setIdempotencyKey] = useState(() => initial?.idempotencyKey ?? createIdempotencyKey());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedDraft = useRef(false);
  const { source, promptType, promptVersion, practiceSessionId, anchorId, courseId, waypointId, draftKey } = props;

  useEffect(() => { void draftStore.bindAccount(accountId); }, [accountId]);
  useEffect(() => {
    if (!accountId || !draftStore.hydrated || loadedDraft.current || initial) return;
    const draft = draftStore.drafts[props.draftKey];
    if (!draft || draft.tombstoned) return;
    loadedDraft.current = true;
    setBody(draft.body ?? '');
    setStructured(draft.structuredContent ?? {});
    setMoodBefore(draft.moodBefore);
    setMoodAfter(draft.moodAfter);
    // Adopt the stored replay key so a queued reflection surviving a restart is
    // resumed rather than re-created under a second key.
    setIdempotencyKey(draft.idempotencyKey);
  }, [accountId, draftStore.drafts, draftStore.hydrated, initial, props.draftKey]);

  const hasWriting = Boolean(clean(body) || clean(structured.whatHelped) || clean(structured.whatLearned) || moodAfter || moodBefore);
  const isStructured = props.promptType === 'WAYPOINT_COMPLETION';
  const draft = useMemo(() => {
    if (!accountId) return null;
    const next = draftFromProps(
      { source, promptType, promptVersion, practiceSessionId, anchorId, courseId, waypointId, draftKey },
      accountId,
      idempotencyKey,
    );
    return {
      ...next,
      ...(clean(body) ? { body } : {}),
      ...(isStructured ? { structuredContent: structured } : {}),
      ...(moodBefore ? { moodBefore } : {}),
      ...(moodAfter ? { moodAfter } : {}),
    };
  }, [accountId, anchorId, body, courseId, draftKey, idempotencyKey, isStructured, moodAfter, moodBefore, practiceSessionId, promptType, promptVersion, source, structured, waypointId]);

  // encryptedPersistStorage coalesces these writes; typing is persisted as a draft,
  // never submitted or queued unless the person explicitly chooses Save.
  useEffect(() => {
    if (draft && draftStore.hydrated && !props.initialReflection) void draftStore.upsert(draft);
  }, [draft, draftStore.hydrated, props.initialReflection]);

  const saveDraft = async () => {
    if (draft && !props.initialReflection) await draftStore.upsert(draft);
  };

  const validate = (): boolean => {
    const validBody = clean(body);
    const validStructured = { whatHelped: clean(structured.whatHelped), whatLearned: clean(structured.whatLearned) };
    if (isStructured) {
      if (!validStructured.whatHelped && !validStructured.whatLearned) {
        setError('Add what helped or what you learned before saving.');
        return false;
      }
      if ((validStructured.whatHelped?.length ?? 0) + (validStructured.whatLearned?.length ?? 0) > 2000) {
        setError('This reflection is too long.');
        return false;
      }
      return true;
    }
    // The current frozen backend requires a body for non-completion reflections.
    if (!validBody) {
      setError('Add a few words before saving.');
      return false;
    }
    return true;
  };

  /**
   * Queue, then confirm the queued record is actually on disk before telling
   * the person it is safe. Claiming a durable save the store did not make is
   * how writing was lost.
   */
  const queueOffline = async () => {
    if (!draft) return;
    await reflectionService.queueExplicitCreate(draft);
    if (!reflectionService.isQueued(props.draftKey)) {
      setError('Your writing is still here. Please try again when you’re ready.');
      return;
    }
    setError('Saved on this device. It will sync when you’re back online.');
  };

  const save = async () => {
    setError(null);
    if (!validate() || !draft) return;
    setSaving(true);
    try {
      if (props.initialReflection) {
        if (offline) {
          await saveDraft();
          setError('Reconnect to update this reflection.');
          return;
        }
        const reflection = await reflectionService.update(props.initialReflection.id, {
          ...(isStructured ? { structuredContent: { whatHelped: clean(structured.whatHelped), whatLearned: clean(structured.whatLearned) } } : { body: clean(body) }),
          ...(moodAfter ? { moodAfter } : {}),
        });
        props.onSaved(reflection);
        return;
      }
      if (offline) {
        await queueOffline();
        return;
      }
      const reflection = await reflectionService.create(draftToCreateRequest(draft));
      await draftStore.remove(props.draftKey);
      props.onSaved(reflection);
    } catch (caught) {
      await saveDraft();
      if (isReflectionNetworkError(caught) && !props.initialReflection) {
        await queueOffline();
      } else {
        setError('Your writing is still here. Please try again when you’re ready.');
      }
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    const confirm = async () => {
      if (hasWriting && !props.initialReflection) await draftStore.remove(props.draftKey);
      if (props.autoPresented && props.practiceSessionId) await draftStore.markOfferHandled(`post-practice:${props.practiceSessionId}`);
      props.onSkipped();
    };
    if (hasWriting) Alert.alert('Discard this reflection?', 'Your unsaved writing will be removed from this device.', [{ text: 'Keep writing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => void confirm() }]);
    else void confirm();
  };

  const remove = () => {
    if (!props.initialReflection || !props.onDeleted) return;
    Alert.alert('Delete this reflection?', 'This removes the writing from your account. The Course Log may still show that a reflection was added.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await reflectionService.delete(props.initialReflection!.id);
          await draftStore.tombstoneByIdempotencyKey(props.initialReflection!.idempotencyKey);
          props.onDeleted?.();
        } catch { setError('This reflection could not be deleted. Please try again.'); }
      } },
    ]);
  };

  const disabled = !flags.chart_reflections_enabled || saving;
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading} accessibilityRole="header">{prompt.heading}</Text>
        <Text style={styles.subheading}>This is optional and private to your account.</Text>
        {!flags.chart_reflections_enabled ? <ReadOnlyNotice reason="Reflections are currently unavailable. Existing Course Log entries remain readable." /> : null}
        <ChartCard>
          {isStructured ? <StructuredCompletionFields value={structured} onChange={setStructured} /> : <>
            <Text style={styles.label}>Reflection</Text>
            <TextInput value={body} onChangeText={setBody} onBlur={() => void saveDraft()} editable={!disabled} multiline maxLength={1000} textAlignVertical="top" accessibilityLabel="Reflection" style={styles.input} />
            {body.length >= 850 ? <Text accessibilityLiveRegion="polite" style={styles.count}>{body.length}/1000</Text> : null}
          </>}
          {(props.source === 'POST_PRACTICE' || props.source === 'WAYPOINT_COMPLETION' || props.source === 'COURSE_COMPLETION') ? <ReflectionMoodPicker value={moodAfter} onChange={setMoodAfter} /> : null}
        </ChartCard>
        {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
        <ChartButton label={saving ? 'Saving…' : 'Save reflection'} onPress={() => void save()} disabled={disabled} />
        <ChartButton label="Skip" onPress={skip} secondary disabled={saving} />
        {props.initialReflection && props.onDeleted ? <ChartButton label="Delete reflection" onPress={remove} destructive secondary disabled={saving || offline || !flags.chart_reflections_enabled} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.lg, paddingBottom: 72, gap: spacing.md },
  heading: { ...typography.h2, color: colors.text.primary, marginTop: spacing.sm },
  subheading: { ...typography.body, color: colors.text.secondary },
  label: { ...typography.bodyBold, color: colors.text.primary, marginBottom: spacing.xs },
  input: { minHeight: 180, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 14, padding: spacing.md, ...typography.body, color: colors.text.primary },
  count: { ...typography.caption, color: colors.text.secondary, textAlign: 'right' },
  error: { ...typography.caption, color: '#FFB1B1' },
});
