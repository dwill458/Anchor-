import React, { memo, useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoreHorizontal } from 'lucide-react-native';
import { colors, radii, spacing } from '@/theme/v2';
import { COACH_STYLE_COPY, MEMORY_LABELS, type useAskProfile } from '@/hooks/v2/chart/useAskProfile';
import type { AskMemoryKey, CoachStyle } from '@/services/v2/askChartApi';
import { chartTypography as typography } from '../chartTypography';
import type { AskAccent } from './askChartTheme';

type Profile = ReturnType<typeof useAskProfile>;

export const AskSettingsButton = memo(function AskSettingsButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Ask Chart settings" onPress={onPress} hitSlop={8} style={styles.moreButton} testID="ask-settings-button">
      <MoreHorizontal size={22} color={colors.text.primary} />
    </Pressable>
  );
});

type Props = {
  visible: boolean;
  accent: AskAccent;
  profile: Profile;
  onClose: () => void;
  /** Called after the conversation has been cleared on the server. */
  onCleared: () => void;
};

const STYLES: CoachStyle[] = ['SUPPORTIVE', 'DRIVEN', 'DIRECT'];

/**
 * Coaching style, and what Ask Chart remembers about how this person works on this Anchor, with the controls to
 * correct or delete it. In-screen (not a Modal): back and a tap outside close it.
 */
export const AskSettingsSheet = memo(function AskSettingsSheet({ visible, accent, profile, onClose, onCleared }: Props) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState<AskMemoryKey | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription?.remove?.();
  }, [onClose, visible]);
  useEffect(() => { if (!visible) setEditing(null); }, [visible]);

  const confirmClear = useCallback(() => {
    Alert.alert('Clear this conversation?', 'Your messages and any photos you sent are deleted. What Ask Chart remembers stays unless you forget it too. Your Chart is not affected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { void profile.clearConversation().then(ok => { if (ok) { onCleared(); onClose(); } }); } },
    ]);
  }, [onClose, onCleared, profile]);
  const confirmForgetAll = useCallback(() => {
    Alert.alert('Forget everything?', 'Ask Chart will no longer remember anything about how you work on this Anchor.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Forget', style: 'destructive', onPress: () => { void profile.forgetAll(); } },
    ]);
  }, [profile]);

  if (!visible) return null;
  const data = profile.profile;
  return (
    <View style={StyleSheet.absoluteFill} testID="ask-settings-sheet">
      <Pressable style={[StyleSheet.absoluteFill, styles.scrim]} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close settings" testID="ask-settings-scrim" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[3] }]}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>Coaching style</Text>
          <View style={styles.segments} accessibilityRole="radiogroup">
            {STYLES.map(style => {
              const selected = data?.style === style;
              return (
                <Pressable
                  key={style}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${COACH_STYLE_COPY[style].label}. ${COACH_STYLE_COPY[style].blurb}`}
                  onPress={() => void profile.setStyle(style)}
                  disabled={!data}
                  style={[styles.segment, { borderColor: selected ? accent.fill : accent.border, backgroundColor: selected ? accent.wash : colors.surface }]}
                  testID={`ask-style-${style}`}
                >
                  <Text style={styles.segmentLabel}>{COACH_STYLE_COPY[style].label}</Text>
                  <Text style={styles.segmentBlurb}>{COACH_STYLE_COPY[style].blurb}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.note}>Changes how Ask Chart talks, never what it tells you.</Text>

          <Text style={[styles.sectionTitle, styles.sectionGap]}>What Ask Chart remembers</Text>
          {profile.loading && !data ? <Text style={styles.note}>Loading…</Text> : null}
          {data && data.memories.length === 0 ? <Text style={styles.note} testID="ask-memory-empty">Nothing yet. Ask Chart only remembers what you tell it about how you work, and only for this Anchor.</Text> : null}
          {data?.memories.map(memory => (
            <View key={memory.key} style={styles.memory} testID={`ask-memory-${memory.key}`}>
              <Text style={styles.memoryLabel}>{MEMORY_LABELS[memory.key]}</Text>
              {editing === memory.key ? (
                <View style={styles.editRow}>
                  <TextInput value={draft} onChangeText={setDraft} maxLength={200} autoFocus style={[styles.input, { borderColor: accent.border }]} accessibilityLabel={MEMORY_LABELS[memory.key]} testID="ask-memory-input" />
                  <Pressable accessibilityRole="button" onPress={() => { void profile.editMemory(memory.key, draft).then(ok => { if (ok) setEditing(null); }); }} hitSlop={8} testID="ask-memory-save"><Text style={[styles.link, { color: accent.text }]}>Save</Text></Pressable>
                </View>
              ) : (
                <Text style={styles.memoryValue}>{memory.value}</Text>
              )}
              {editing !== memory.key ? (
                <View style={styles.memoryActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${MEMORY_LABELS[memory.key]}`} onPress={() => { setEditing(memory.key); setDraft(memory.value); }} hitSlop={8} testID={`ask-memory-edit-${memory.key}`}><Text style={[styles.link, { color: accent.text }]}>Edit</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Forget ${MEMORY_LABELS[memory.key]}`} onPress={() => void profile.forgetMemory(memory.key)} hitSlop={8} testID={`ask-memory-forget-${memory.key}`}><Text style={styles.danger}>Forget</Text></Pressable>
                </View>
              ) : null}
            </View>
          ))}
          {data && data.memories.length > 1 ? (
            <Pressable accessibilityRole="button" onPress={confirmForgetAll} hitSlop={8} style={styles.rowLink} testID="ask-memory-forget-all"><Text style={styles.danger}>Forget everything</Text></Pressable>
          ) : null}

          {profile.error ? <Text style={styles.error} accessibilityLiveRegion="polite" testID="ask-settings-error">{profile.error}</Text> : null}

          <Pressable accessibilityRole="button" onPress={confirmClear} style={styles.clear} testID="ask-clear-conversation">
            <Text style={styles.danger}>Clear this conversation</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(17,24,32,.32)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '82%', backgroundColor: colors.canvas, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, paddingTop: spacing[2], borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border.strong, marginBottom: spacing[2] },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[4], gap: spacing[2] },
  moreButton: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  sectionTitle: { ...typography.headingSM, color: colors.text.primary },
  sectionGap: { marginTop: spacing[4] },
  segments: { flexDirection: 'row', gap: spacing[2] },
  segment: { flex: 1, minHeight: 64, padding: spacing[3], borderRadius: radii.md, borderWidth: 1, gap: 2, justifyContent: 'center' },
  segmentLabel: { ...typography.labelMD, color: colors.text.primary },
  segmentBlurb: { ...typography.bodySM, color: colors.text.secondary },
  note: { ...typography.bodySM, color: colors.text.secondary },
  memory: { padding: spacing[3], borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.subtle, gap: 4 },
  memoryLabel: { ...typography.labelSM, color: colors.text.secondary },
  memoryValue: { ...typography.bodyMD, color: colors.text.primary },
  memoryActions: { flexDirection: 'row', gap: spacing[5], paddingTop: spacing[1] },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  input: { flex: 1, ...typography.bodyMD, color: colors.text.primary, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing[3], minHeight: 44 },
  link: { ...typography.labelMD, textDecorationLine: 'underline' },
  danger: { ...typography.labelMD, color: colors.semantic.error },
  rowLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  error: { ...typography.bodySM, color: colors.semantic.error },
  clear: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: spacing[3] },
});
