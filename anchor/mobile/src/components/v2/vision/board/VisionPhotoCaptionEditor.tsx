import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { VISION_SERIF } from '../VisionPaperChrome';

export type VisionPhotoCaptionEditorProps = {
  visible: boolean;
  caption?: string | null;
  saving?: boolean;
  error?: string | null;
  onSave: (caption: string | null) => Promise<boolean>;
  onClose: () => void;
  testID?: string;
};

/** A short editor for the caption attached to one saved Vision scene. */
export function VisionPhotoCaptionEditor({
  visible, caption, saving = false, error, onSave, onClose, testID = 'vision-photo-caption-editor',
}: VisionPhotoCaptionEditorProps) {
  const [draft, setDraft] = useState(caption ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const busy = saving || submitting;

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const ios = Platform.OS === 'ios';
    const showSub = Keyboard.addListener(
      ios ? 'keyboardWillShow' : 'keyboardDidShow',
      (event: KeyboardEvent) => {
        setKeyboardHeight(event.endCoordinates?.height ?? 0);
      }
    );
    const hideSub = Keyboard.addListener(
      ios ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setDraft(caption ?? '');
    setSaveError(null);
  }, [caption, visible]);

  const save = async () => {
    if (busy) return;
    Keyboard.dismiss();
    setSaveError(null);
    setSubmitting(true);
    try {
      const ok = await onSave(draft.trim() || null);
      if (ok) onClose();
      else setSaveError('Could not save this caption. Try again.');
    } catch {
      setSaveError('Could not save this caption. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    Keyboard.dismiss();
    if (!busy) onClose();
  };

  const bottomPadding = Math.max(insets.bottom, keyboardHeight) + spacing[4] + V2_SHEET_SKIRT;

  return (
    <V2SheetModal visible={visible} onClose={close} scrimAccessibilityLabel="Close caption editor" testID={testID}>
      <View
        testID={`${testID}-surface`}
        style={[styles.sheet, { paddingBottom: bottomPadding }]}
        accessibilityViewIsModal
      >
        <V2SheetGrabZone>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>Edit photo caption</Text>
          <Text style={styles.subtitle}>Add a short line beneath this photo.</Text>
        </V2SheetGrabZone>
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextInput
            testID={`${testID}-input`}
            accessibilityLabel="Photo caption"
            value={draft}
            onChangeText={setDraft}
            maxLength={80}
            multiline={false}
            returnKeyType="done"
            onSubmitEditing={save}
            editable={!busy}
            style={styles.input}
            placeholder="Add caption"
            placeholderTextColor={colors.text.secondary}
            autoFocus
          />
          <Text style={styles.count}>{draft.length}/80</Text>
          {error || saveError ? <Text accessibilityRole="alert" style={styles.error}>{error || saveError}</Text> : null}
          <View style={styles.actions}>
            <Pressable testID={`${testID}-cancel`} accessibilityRole="button" accessibilityLabel="Cancel caption edit"
              disabled={busy} onPress={close} style={({ pressed }) => [styles.cancel, pressed && styles.pressed, busy && styles.disabled]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable testID={`${testID}-save`} accessibilityRole="button" accessibilityLabel="Save photo caption"
              disabled={busy} onPress={save} style={({ pressed }) => [styles.save, pressed && styles.pressed, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color={colors.canvas} /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </View>
        </ScrollView>
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
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 99, backgroundColor: colors.border.default, marginBottom: spacing[3] },
  title: { fontFamily: VISION_SERIF, fontSize: 25, lineHeight: 31, color: colors.text.primary },
  subtitle: { fontFamily: typography.body, fontSize: 12, lineHeight: 16, color: colors.text.secondary, marginTop: spacing[1], marginBottom: spacing[4] },
  input: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.default, fontFamily: VISION_SERIF, fontSize: 20, color: colors.text.primary, paddingVertical: spacing[2] },
  count: { fontFamily: typography.body, fontSize: 12, lineHeight: 16, color: colors.text.secondary, textAlign: 'right', marginTop: spacing[1] },
  error: { fontFamily: typography.body, fontSize: 12, lineHeight: 16, color: colors.semantic.error, marginTop: spacing[2] },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[4] },
  cancel: { minWidth: 92, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border.default },
  cancelText: { fontFamily: typography.body, fontSize: 15, lineHeight: 22, color: colors.text.primary },
  save: { minWidth: 112, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg, backgroundColor: colors.ink.base },
  saveText: { fontFamily: typography.body, fontSize: 15, lineHeight: 22, color: colors.canvas },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.55 },
});
