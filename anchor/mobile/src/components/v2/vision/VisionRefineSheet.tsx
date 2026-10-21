import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import type { VisionReferenceAttachment } from '@/types/visionConversation';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { ChartKeyboardFrame } from '@/components/v2/chart/ChartKeyboardFrame';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, radii, spacing } from '@/theme/v2';
import { VisionInkPill, VISION_GOLD, VISION_SERIF } from './VisionPaperChrome';
import { VisionReferenceStrip } from './VisionReferenceStrip';
import { VisionSceneField } from './VisionSceneField';

export type VisionRefineSource = {
  candidateId: string;
  imageUrl: string;
  optionNumber: number;
  roundNumber: number;
};

export interface VisionRefineSheetProps {
  visible: boolean;
  source: VisionRefineSource | null;
  references: VisionReferenceAttachment[];
  onChangeReferences: (refs: VisionReferenceAttachment[]) => void;
  initialPrompt?: string;
  onChangePrompt?: (text: string) => void;
  onClose: () => void;
  onSubmit: (instruction: string) => Promise<boolean | void> | boolean | void;
  loading?: boolean;
  error?: string | null;
  testID?: string;
}

export const VISION_REFINE_MIN_PROMPT_CHARS = 6;
export const VISION_REFINE_MAX_PROMPT_CHARS = 2000;

const QUICK_CHANGES = ['Change lighting', 'Adjust composition', 'Add someone', 'Replace an object', 'Make it more realistic'] as const;
const KEYBOARD_QUICK_CHANGES = QUICK_CHANGES.slice(0, 3);

function sourceLabel(source: VisionRefineSource) {
  return source.roundNumber === 0
    ? `Editing Option ${source.optionNumber}`
    : `Based on Version ${source.roundNumber} · Option ${source.optionNumber}`;
}

export function VisionRefineSheet({
  visible,
  source,
  references,
  onChangeReferences,
  initialPrompt = '',
  onChangePrompt,
  onClose,
  onSubmit,
  loading = false,
  error = null,
  testID = 'vision-refine-sheet',
}: VisionRefineSheetProps) {
  const reduceMotion = useV2ReduceMotion();
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [promptNotice, setPromptNotice] = useState<string | null>(null);
  const [referenceNotice, setReferenceNotice] = useState<string | null>(null);
  const submitLock = useRef(false);
  const closing = useRef(false);
  const wasVisible = useRef(false);
  const promptBaseline = useRef(initialPrompt);

  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      setKeyboardOpen(false);
      return undefined;
    }
    if (!wasVisible.current) {
      setPrompt(initialPrompt);
      setSubmitError(null);
      setPromptNotice(null);
      setReferenceNotice(null);
      promptBaseline.current = initialPrompt;
      closing.current = false;
      wasVisible.current = true;
    }
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardOpen(true);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOpen(false);
    });
    return () => { show.remove(); hide.remove(); };
  }, [initialPrompt, visible]);

  const changed = prompt.trim() !== promptBaseline.current.trim();

  const dismiss = useCallback(() => {
    if (closing.current) return;
    if (!changed) {
      closing.current = true;
      Keyboard.dismiss();
      onClose();
      return;
    }
    closing.current = true;
    Alert.alert('Discard this instruction?', 'Your current image stays saved. The instruction will be cleared.', [
      { text: 'Keep editing', style: 'cancel', onPress: () => { closing.current = false; } },
      { text: 'Discard', style: 'destructive', onPress: () => { Keyboard.dismiss(); onClose(); } },
    ], { cancelable: true, onDismiss: () => { closing.current = false; } });
  }, [changed, onClose]);

  const handleModalClose = useCallback(() => {
    // Native Android modal back first dismisses the keyboard, then closes the sheet on the next press.
    if (keyboardOpen) {
      Keyboard.dismiss();
      return;
    }
    dismiss();
  }, [dismiss, keyboardOpen]);

  const setText = (value: string) => {
    setPrompt(value);
    setSubmitError(null);
    setPromptNotice(null);
    onChangePrompt?.(value);
  };

  const addQuickChange = (change: string) => {
    const trimmed = prompt.trim();
    setText(trimmed ? `${trimmed.replace(/[.!?]+$/, '')}. ${change}` : change);
  };

  const submit = async () => {
    const instruction = prompt.trim();
    if (instruction.length < VISION_REFINE_MIN_PROMPT_CHARS || instruction.length > VISION_REFINE_MAX_PROMPT_CHARS || !source || submitLock.current || loading) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const accepted = await onSubmit(instruction);
      if (accepted === false) return;
      closing.current = true;
      Keyboard.dismiss();
      onClose();
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Could not create a new version. Try again.');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const sourceText = source ? sourceLabel(source) : '';
  const busy = loading || submitting;
  const validPrompt = prompt.trim().length >= VISION_REFINE_MIN_PROMPT_CHARS && prompt.trim().length <= VISION_REFINE_MAX_PROMPT_CHARS;
  const submitButton = (
    <VisionInkPill
      testID="vision-refine-submit"
      label={busy ? 'Creating Version…' : 'Create New Version'}
      accessibilityLabel="Create new version"
      disabled={!validPrompt || !source || busy}
      onDisabledPress={() => setPromptNotice(`Describe the changes in ${VISION_REFINE_MIN_PROMPT_CHARS}–${VISION_REFINE_MAX_PROMPT_CHARS} characters.`)}
      onPress={() => { void submit(); }}
      style={styles.submit}
    />
  );
  const sheetHeader = keyboardOpen && source ? (
    <>
      <View style={styles.handle} />
      <View style={styles.compactSource} testID="vision-refine-compact-source">
        <Image source={{ uri: source.imageUrl }} style={styles.compactImage} accessibilityLabel="Selected vision image" />
        <View style={styles.compactCopy}>
          <Text style={styles.sourceKicker}>{sourceText}</Text>
          <Text style={styles.savedTitle}>Your current image is safe</Text>
          <Text style={styles.savedSub}>Original stays saved</Text>
        </View>
        <Pressable testID="vision-refine-keyboard-done" accessibilityRole="button" accessibilityLabel="Done editing" onPress={() => Keyboard.dismiss()} style={styles.doneButton}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </>
  ) : (
    <>
      <View style={styles.handle} />
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={styles.title}>Refine This Scene</Text>
          <Text style={styles.subtitle}>Tell us what you’d like to change or add.</Text>
        </View>
        <Pressable testID="vision-refine-close" accessibilityRole="button" accessibilityLabel="Close refinement sheet" onPress={dismiss} hitSlop={8} style={styles.closeButton}>
          <X size={22} color={colors.text.secondary} strokeWidth={1.6} />
        </Pressable>
      </View>
      {source ? <Text testID="vision-refine-source-label" style={styles.sourceLabel}>{sourceText}</Text> : null}
    </>
  );

  return (
    <V2SheetModal visible={visible} onClose={handleModalClose} reduceMotion={reduceMotion} scrimAccessibilityLabel="Close refinement sheet" testID={testID}>
      <View style={styles.flexShrink}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[3]) + V2_SHEET_SKIRT }]} accessibilityViewIsModal>
          {keyboardOpen ? sheetHeader : <V2SheetGrabZone>{sheetHeader}</V2SheetGrabZone>}

          <ChartKeyboardFrame
            style={styles.keyboardFrame}
            restingBottom={0}
            contentContainerStyle={styles.content}
            footer={(
              <View style={styles.footer}>
                {error || submitError || promptNotice ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error ?? submitError ?? promptNotice}</Text> : null}
                {submitButton}
              </View>
            )}
            testID="vision-refine-keyboard-frame"
          >
            {keyboardOpen ? <Text accessibilityRole="header" style={styles.keyboardTitle}>What would you like to change?</Text> : null}
            {!keyboardOpen ? (
              <View style={styles.reassurance}>
                <Text style={styles.shield}>◇</Text>
                <Text style={styles.reassuranceText}>Your current image stays saved. You can always return to it.</Text>
              </View>
            ) : null}

            <VisionReferenceStrip
              references={references}
              onChange={onChangeReferences}
              onNotice={setReferenceNotice}
              disabled={busy}
              collapsed={false}
              compact={keyboardOpen}
              testID="vision-refine-references"
            />
            {referenceNotice ? <Text accessibilityLiveRegion="polite" style={styles.error}>{referenceNotice}</Text> : null}

            <VisionSceneField
              testID="vision-refine-input"
              accessibilityLabel="Describe what to change in this scene"
              value={prompt}
              onChangeText={setText}
              maxChars={VISION_REFINE_MAX_PROMPT_CHARS}
              placeholder="Describe what you’d like to change…"
              minHeight={keyboardOpen ? 96 : 148}
              onFocus={() => setKeyboardOpen(true)}
            />

            <View style={styles.quickGroup}>
              <Text style={styles.quickTitle}>Quick changes</Text>
              <View style={styles.quickRows}>
                {(keyboardOpen ? KEYBOARD_QUICK_CHANGES : QUICK_CHANGES).map(change => (
                  <Pressable
                    key={change}
                    accessibilityRole="button"
                    accessibilityLabel={change}
                    onPress={() => addQuickChange(change)}
                    hitSlop={6}
                    style={({ pressed }) => [styles.quickChip, pressed && styles.quickChipPressed]}
                  >
                    <Text style={styles.quickText}>{change}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ChartKeyboardFrame>
        </View>
      </View>
    </V2SheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    marginBottom: -V2_SHEET_SKIRT,
    flexShrink: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  flexShrink: { flexShrink: 1 },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 99, backgroundColor: colors.border.default, marginBottom: spacing[3] },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], marginBottom: spacing[3] },
  headingCopy: { flex: 1 },
  title: { fontFamily: VISION_SERIF, fontSize: 31, lineHeight: 37, color: colors.text.primary },
  keyboardTitle: { fontFamily: VISION_SERIF, fontSize: 25, lineHeight: 31, color: colors.text.primary },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 16, lineHeight: 22, color: colors.text.secondary, marginTop: spacing[1] },
  closeButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.grouped },
  compactSource: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  sourceLabel: { alignSelf: 'center', marginTop: -spacing[2], marginBottom: spacing[3], paddingHorizontal: spacing[3], minHeight: 34, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: colors.border.default, color: colors.text.secondary, fontFamily: 'Inter-Medium', fontSize: 14, lineHeight: 32, textAlign: 'center' },
  compactImage: { width: 56, height: 72, borderRadius: radii.sm, backgroundColor: colors.grouped },
  compactCopy: { flex: 1 },
  sourceKicker: { fontFamily: 'Inter-SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.text.secondary },
  savedTitle: { fontFamily: VISION_SERIF, fontSize: 21, lineHeight: 25, color: colors.text.primary, marginTop: 2 },
  savedSub: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 19, color: colors.text.secondary },
  doneButton: { minWidth: 48, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: 'Inter-Medium', fontSize: 15, color: colors.text.secondary },
  keyboardFrame: { flexShrink: 1 },
  content: { gap: spacing[3], paddingBottom: spacing[2] },
  reassurance: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 64, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.grouped },
  shield: { color: VISION_GOLD, fontSize: 22, width: 20, textAlign: 'center' },
  reassuranceText: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 20, color: colors.text.secondary },
  quickGroup: { gap: spacing[2] },
  quickTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 20, color: colors.text.secondary },
  quickRows: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  quickChip: { minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing[3], borderRadius: 24, borderWidth: 1, borderColor: 'rgba(176,138,74,0.62)', backgroundColor: colors.surface },
  quickChipPressed: { backgroundColor: colors.grouped },
  quickText: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 19, color: colors.text.primary },
  footer: { gap: spacing[2], paddingTop: spacing[2], paddingHorizontal: spacing[5], paddingBottom: spacing[2] },
  submit: { minHeight: 58 },
  error: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.semantic.error },
});
