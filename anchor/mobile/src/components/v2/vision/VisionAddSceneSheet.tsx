import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, radii, spacing } from '@/theme/v2';
import { VISION_ADD_SHEET_HANDOFF_MS } from './VisionAddSheet';
import { VisionInkPill, VISION_SERIF } from './VisionPaperChrome';
import { VisionReferencePhoto, type VisionStartPhoto } from './VisionReferencePhoto';
import { VisionSceneField, type VisionSceneFieldHandle } from './VisionSceneField';
import { VisionSceneShortcuts } from './VisionSceneShortcuts';
import { applySceneSuggestion } from './visionSceneSuggestions';
import { createSingleFlight } from './visionSingleFlight';

export const ADD_SCENE_MIN_CHARS = 6;
export const ADD_SCENE_MAX_CHARS = 400;

export type AddSceneRequest = { description: string; photo: VisionStartPhoto | null };

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The person's own goal; the shortcuts are derived from it. */
  anchorIntention: string;
  /** Receives the prepared request. The sheet has already closed; generation belongs to the existing ceremony. */
  onSubmit: (request: AddSceneRequest) => void;
  /** Adds a personal photograph to the board as it is (it is fitted to the Vision frame next). */
  onAddOwnPhoto?: (source: 'library' | 'camera') => void;
  /** Opens the note composer. Notes stay available when the board has no room for another image. */
  onAddNote?: () => void;
  /** False at the board's image limit: the composer is replaced by a short explanation. */
  canAddImage?: boolean;
  testID?: string;
};

/**
 * "What else do you see in this future?": the compact way to add another scene without leaving the
 * board. An optional reference photo, a description (typed or spoken), and optional shortcuts. The
 * board underneath is never remounted; submitting hands a prepared request to the existing generation
 * experience. A draft survives closing the sheet and clears once a request is sent.
 */
export function VisionAddSceneSheet({ visible, onClose, anchorIntention, onSubmit, onAddOwnPhoto, onAddNote, canAddImage = true, testID = 'vision-add-scene-sheet' }: Props) {
  const reduceMotion = useV2ReduceMotion();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<VisionStartPhoto | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fieldRef = useRef<VisionSceneFieldHandle>(null);
  const flight = useRef(createSingleFlight()).current;
  const handoff = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (handoff.current) clearTimeout(handoff.current); }, []);

  const trimmed = text.trim();
  const valid = photo ? trimmed.length === 0 || (trimmed.length >= ADD_SCENE_MIN_CHARS && trimmed.length <= ADD_SCENE_MAX_CHARS)
    : trimmed.length >= ADD_SCENE_MIN_CHARS && trimmed.length <= ADD_SCENE_MAX_CHARS;

  // The keyboard's height rides on the UI thread, so the sheet lifts with it frame by frame on iOS and Android.
  const lift = useAnimatedStyle(() => ({ paddingBottom: keyboard.height.value }));

  const close = () => { fieldRef.current?.stopDictation(); Keyboard.dismiss(); onClose(); };

  const submit = async () => {
    if (!valid) { setNotice(photo ? `Describe it in ${ADD_SCENE_MIN_CHARS}–${ADD_SCENE_MAX_CHARS} characters, or clear the text.` : `Describe the scene in ${ADD_SCENE_MIN_CHARS}–${ADD_SCENE_MAX_CHARS} characters.`); return; }
    // One request per tap sequence: a second tap while the first is closing the sheet is dropped.
    await flight.run(async () => {
      fieldRef.current?.stopDictation();
      Keyboard.dismiss();
      const request: AddSceneRequest = { description: trimmed, photo };
      setText(''); setPhoto(null); setNotice(null);
      onClose();
      onSubmit(request);
    });
  };

  const addNote = () => {
    if (!onAddNote) return;
    close();
    if (handoff.current) clearTimeout(handoff.current);
    handoff.current = setTimeout(onAddNote, reduceMotion ? 0 : VISION_ADD_SHEET_HANDOFF_MS);
  };

  const addOwn = (source: 'library' | 'camera') => {
    if (!onAddOwnPhoto) return;
    close();
    if (handoff.current) clearTimeout(handoff.current);
    // A native picker cannot open over a dismissing Modal on iOS; the sheet's exit finishes first.
    handoff.current = setTimeout(() => onAddOwnPhoto(source), reduceMotion ? 0 : VISION_ADD_SHEET_HANDOFF_MS);
  };

  return (
    <V2SheetModal visible={visible} onClose={close} reduceMotion={reduceMotion} scrimAccessibilityLabel="Close" testID={testID}>
      <Animated.View style={lift}>
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[3]) + V2_SHEET_SKIRT }]} accessibilityViewIsModal>
        <V2SheetGrabZone>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>What else do you see in this future?</Text>
        </V2SheetGrabZone>
        {!canAddImage ? (
          <View style={styles.body}>
            <Text testID="vision-add-scene-full" accessibilityLiveRegion="polite" style={styles.sub}>Your board is full. Remove an image to add another, or add a note.</Text>
          </View>
        ) : (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <Text style={styles.label}>Reference photo (optional)</Text>
          <VisionReferencePhoto compact photo={photo} onChange={setPhoto} onNotice={setNotice} testID="vision-add-scene-reference" />
          <Text style={styles.label}>Describe the next scene…</Text>
          <VisionSceneField
            handleRef={fieldRef}
            testID="vision-scene-input"
            accessibilityLabel="Describe the next scene"
            value={text}
            onChangeText={value => { setText(value); if (notice) setNotice(null); }}
            maxChars={ADD_SCENE_MAX_CHARS}
            placeholder="e.g. The kitchen with a big island and natural light."
            minHeight={88}
          />
          <VisionSceneShortcuts goal={anchorIntention} text={text} onPick={item => setText(current => applySceneSuggestion(current, item))} />
          {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
        </ScrollView>
        )}
        <View style={styles.actions}>
          {canAddImage ? <VisionInkPill testID="vision-scene-generate" label="Generate Images" accessibilityLabel="Generate images" disabled={!valid}
            onDisabledPress={() => setNotice(`Describe the scene in ${ADD_SCENE_MIN_CHARS}–${ADD_SCENE_MAX_CHARS} characters, or add a photo.`)} onPress={() => { void submit(); }} /> : null}
          {onAddOwnPhoto && canAddImage ? (
            <View style={styles.ownRow}>
              <Pressable testID="vision-add-own-photo" accessibilityRole="button" accessibilityLabel="Use my own photo" onPress={() => addOwn('library')} style={styles.ownAction}>
                <Text style={styles.ownLabel}>Use my own photo</Text>
              </Pressable>
              <Pressable testID="vision-add-own-camera" accessibilityRole="button" accessibilityLabel="Take a photo" onPress={() => addOwn('camera')} style={styles.ownAction}>
                <Text style={styles.ownLabel}>Take a photo</Text>
              </Pressable>
            </View>
          ) : null}
          {onAddNote ? (
            <Pressable testID="vision-add-note" accessibilityRole="button" accessibilityLabel="Add a note" onPress={addNote} style={[styles.ownAction, styles.noteAction]}>
              <Text style={styles.ownLabel}>Add a note</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      </Animated.View>
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
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 99, backgroundColor: colors.border.default, marginBottom: 14 },
  title: { fontFamily: VISION_SERIF, fontSize: 26, lineHeight: 31, color: colors.text.primary, textAlign: 'center', marginBottom: spacing[3] },
  body: { gap: spacing[3], paddingBottom: spacing[3] },
  label: { fontFamily: 'Inter-SemiBold', fontSize: 12, lineHeight: 16, color: colors.text.secondary },
  notice: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.semantic.error },
  sub: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 21, color: colors.text.secondary, textAlign: 'center' },
  noteAction: { alignSelf: 'center' },
  actions: { gap: spacing[2], paddingTop: spacing[2] },
  ownRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing[5] },
  ownAction: { minHeight: 44, justifyContent: 'center' },
  ownLabel: { fontFamily: 'Inter-Regular', fontSize: 13, color: colors.text.secondary, textDecorationLine: 'underline' },
});
