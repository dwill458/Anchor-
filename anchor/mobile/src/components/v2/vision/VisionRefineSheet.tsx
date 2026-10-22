import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Keyboard, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import type { VisionReferenceAttachment } from '@/types/visionConversation';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { ChartKeyboardFrame } from '@/components/v2/chart/ChartKeyboardFrame';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';
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
  const { height: windowHeight } = useWindowDimensions();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardLift, setKeyboardLift] = useState(0);
  const availableHeight = Math.max(0, windowHeight - keyboardLift - insets.top - spacing[2]);
  const shortKeyboard = keyboardLift > 0 && availableHeight < 430;
  const restingBound = Math.max(0, Math.floor(windowHeight * 0.7) - 12);
  const boundedHeight = keyboardOpen ? Math.min(Math.max(0, availableHeight - (shortKeyboard ? 60 : 88)), 330) : Math.min(restingBound, availableHeight);
  const surfaceHeight = Math.floor(boundedHeight) + V2_SHEET_SKIRT;
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
      setKeyboardLift(0);
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
    const show = Keyboard.addListener('keyboardDidShow', event => {
      setKeyboardOpen(true);
      setKeyboardLift(Math.max(0, windowHeight - (event.endCoordinates?.screenY ?? windowHeight)));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOpen(false);
      setKeyboardLift(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, [initialPrompt, visible, windowHeight]);

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
  const quickChanges = keyboardOpen ? KEYBOARD_QUICK_CHANGES : QUICK_CHANGES;
  const quickChips = quickChanges.map(change => (
    <Pressable key={change} accessibilityRole="button" accessibilityLabel={change}
      onPress={() => addQuickChange(change)} hitSlop={6}
      style={({ pressed }) => [styles.quickChip, pressed && styles.quickChipPressed]}>
      <Text style={styles.quickText}>{change}</Text>
    </Pressable>
  ));
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
  const sheetHeader = keyboardOpen ? (
    <>
      <View style={[styles.handle, { marginBottom: 4 }]} />
      <View style={styles.compactHeading}>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.compactTitle}>What would you like to change?</Text>
        <Pressable testID="vision-refine-keyboard-done" accessibilityRole="button" accessibilityLabel="Done editing" onPress={() => Keyboard.dismiss()} style={styles.doneButton}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
      {source ? <View testID="vision-refine-fixed-references" style={styles.fixedReferences}>
        <VisionReferenceStrip references={references} onChange={onChangeReferences} onNotice={setReferenceNotice}
          disabled={busy} collapsed={false} compact density="refine" testID="vision-refine-references" />
      </View> : null}
    </>
  ) : (
    <>
      <View style={styles.handle} />
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={styles.title}>Refine This Scene</Text>
          <Text numberOfLines={1} style={styles.subtitle}>Tell us what you’d like to change or add.</Text>
        </View>
        <Pressable testID="vision-refine-close" accessibilityRole="button" accessibilityLabel="Close refinement sheet" onPress={dismiss} hitSlop={8} style={styles.closeButton}>
          <X size={22} color={colors.text.secondary} strokeWidth={1.6} />
        </Pressable>
      </View>
    </>
  );

  return (
    <V2SheetModal visible={visible} onClose={handleModalClose} reduceMotion={reduceMotion} deferDragDismiss scrimColor={keyboardOpen ? '#14162B' : undefined} scrimAccessibilityLabel="Close refinement sheet" testID={testID}>
      <View collapsable={false} accessibilityViewIsModal testID="vision-refine-native-frame" style={[styles.sheetSlot, keyboardLift > 0 && { transform: [{ translateY: -keyboardLift }] }, { height: surfaceHeight - V2_SHEET_SKIRT }]}>
        {keyboardOpen && source ? (
          <View testID="vision-refine-compact-source" style={[styles.compactSource, { top: -Math.min(120, Math.max(0, availableHeight - boundedHeight)) }, shortKeyboard && { minHeight: 44 }]}>
            <Image source={{ uri: source.imageUrl }} style={[styles.compactImage, shortKeyboard && { width: 34, height: 44 }]} accessibilityLabel="Selected vision image" />
            <View style={styles.compactCopy}>
              <Text style={styles.sourceKicker}>{sourceText}</Text>
              <Text style={styles.savedTitle}>Your current image is safe</Text>
              {!shortKeyboard ? <Text style={styles.savedSub}>Original stays saved</Text> : null}
            </View>
          </View>
        ) : null}
        {!keyboardOpen && source ? (
          <Text key="refine-source-label" testID="vision-refine-source-label" numberOfLines={1} style={styles.sourceLabelOutside}>{sourceText}</Text>
        ) : null}
        <View
          key="refine-surface"
          testID="vision-refine-surface"
          style={[styles.sheet, { height: surfaceHeight, paddingBottom: (keyboardOpen ? spacing[2] : Math.max(insets.bottom, spacing[3])) + V2_SHEET_SKIRT }]}
        >
          <V2SheetGrabZone>
            <View testID="vision-refine-stable-header">{sheetHeader}</View>
          </V2SheetGrabZone>

          <ChartKeyboardFrame
            key="refine-frame"
            externalKeyboard={keyboardOpen}
            style={styles.keyboardFrame}
            restingBottom={0}
            contentContainerStyle={styles.content}
            footer={(
              <View style={styles.footer}>
                {keyboardOpen ? <View testID="vision-refine-keyboard-quick-changes" style={styles.keyboardQuickRows}>{quickChips}</View> : null}
                {error || submitError || promptNotice ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error ?? submitError ?? promptNotice}</Text> : null}
                {submitButton}
              </View>
            )}
            testID="vision-refine-keyboard-frame"
          >
            {!keyboardOpen ? (
              <View style={styles.reassurance}>
                <Text style={styles.shield}>◇</Text>
                <Text style={styles.reassuranceText}>Your current image stays saved. You can always return to it.</Text>
              </View>
            ) : null}

            {!keyboardOpen ? <View>
              <VisionReferenceStrip
                references={references}
                onChange={onChangeReferences}
                onNotice={setReferenceNotice}
                disabled={busy}
                collapsed={false}
                compact={false}
                density="refine"
                testID="vision-refine-references"
              />
            </View> : null}
            {referenceNotice ? <Text accessibilityLiveRegion="polite" style={styles.error}>{referenceNotice}</Text> : null}

            <VisionSceneField
              key="refine-prompt"
              testID="vision-refine-input"
              accessibilityLabel="Describe what to change in this scene"
              value={prompt}
              onChangeText={setText}
              maxChars={VISION_REFINE_MAX_PROMPT_CHARS}
              placeholder="Describe what you’d like to change…"
              minHeight={keyboardOpen ? (shortKeyboard ? 56 : 80) : 125}
              compact={keyboardOpen}
              compactMaxHeight={shortKeyboard ? 56 : 100}
              onFocus={() => setKeyboardOpen(true)}
            />

            {!keyboardOpen ? <View style={styles.quickGroup}>
              <Text style={styles.quickTitle}>Quick changes</Text>
              <View style={styles.quickRows}>{quickChips}</View>
            </View> : null}
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
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  sheetSlot: { width: '100%', position: 'relative' },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 99, backgroundColor: colors.border.default, marginBottom: spacing[3] },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], marginBottom: spacing[3] },
  headingCopy: { flex: 1 },
  title: { fontFamily: VISION_SERIF, fontSize: 25, lineHeight: 30, color: colors.text.primary },
  compactHeading: { height: 32, position: 'relative', paddingRight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  compactTitle: { flex: 1, fontFamily: VISION_SERIF, fontSize: 18, lineHeight: 24, color: colors.text.primary },
  subtitle: { fontFamily: typography.body, fontSize: 14, lineHeight: 18, color: colors.text.secondary, marginTop: spacing[1] },
  closeButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.grouped },
  compactSource: { position: 'absolute', zIndex: 3, top: -120, left: spacing[5], right: spacing[5], minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: radii.lg, backgroundColor: 'transparent' },
  fixedReferences: { minHeight: 48, marginBottom: spacing[1] },
  sourceLabelOutside: { position: 'absolute', zIndex: 2, top: -34, alignSelf: 'center', paddingHorizontal: spacing[3], minHeight: 26, overflow: 'hidden', borderRadius: 13, borderWidth: 1, borderColor: colors.text.primary, backgroundColor: colors.text.primary, color: colors.canvas, fontFamily: typography.bodyMedium, fontSize: 12, lineHeight: 24, textAlign: 'center' },
  compactImage: { width: 56, height: 72, borderRadius: radii.sm, backgroundColor: colors.grouped },
  compactCopy: { flex: 1 },
  sourceKicker: { fontFamily: typography.bodySemiBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.canvas },
  savedTitle: { fontFamily: VISION_SERIF, fontSize: 18, lineHeight: 22, color: colors.canvas, marginTop: 2 },
  savedSub: { fontFamily: typography.body, fontSize: 13, lineHeight: 17, color: colors.canvas },
  doneButton: { position: 'absolute', right: 0, top: -6, minWidth: 48, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: typography.bodyMedium, fontSize: 15, color: colors.text.secondary },
  keyboardFrame: { flex: 1, minHeight: 0 },
  content: { gap: spacing[2], paddingBottom: spacing[2] },
  reassurance: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 42, paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.grouped },
  shield: { color: VISION_GOLD, fontSize: 22, width: 20, textAlign: 'center' },
  reassuranceText: { flex: 1, fontFamily: typography.body, fontSize: 13, lineHeight: 17, color: colors.text.secondary },
  quickGroup: { gap: spacing[1] },
  quickTitle: { fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 18, color: colors.text.secondary },
  quickRows: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  keyboardQuickRows: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  quickChip: { minHeight: 30, justifyContent: 'center', paddingHorizontal: spacing[2], borderRadius: 24, borderWidth: 1, borderColor: 'rgba(176,138,74,0.62)', backgroundColor: colors.surface },
  quickChipPressed: { backgroundColor: colors.grouped },
  quickText: { fontFamily: typography.body, fontSize: 12, lineHeight: 17, color: colors.text.primary },
  footer: { gap: spacing[2], paddingTop: spacing[2], paddingHorizontal: 0, paddingBottom: spacing[2] },
  submit: { minHeight: 52 },
  error: { fontFamily: typography.body, fontSize: 13, lineHeight: 18, color: colors.semantic.error },
});
