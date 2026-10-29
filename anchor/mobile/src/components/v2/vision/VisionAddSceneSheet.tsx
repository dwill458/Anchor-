import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { Camera, Images, StickyNote } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { useV2ReduceMotion } from '@/hooks/v2';
import { AnchorMotion, colors, radii, spacing, typography } from '@/theme/v2';
import { VISION_ADD_SHEET_HANDOFF_MS } from './VisionAddSheet';
import { VisionInkPill, VISION_SERIF } from './VisionPaperChrome';
import { VisionReferenceStrip } from './VisionReferenceStrip';
import type { VisionStartPhoto } from './VisionReferencePhoto';
import type { VisionReferenceAttachment } from '@/types/visionConversation';
import { VisionSceneField, type VisionSceneFieldHandle } from './VisionSceneField';
import { VisionSceneShortcuts } from './VisionSceneShortcuts';
import { applySceneSuggestion } from './visionSceneSuggestions';
import { createSingleFlight } from './visionSingleFlight';

export const ADD_SCENE_MIN_CHARS = 6;
export const ADD_SCENE_MAX_CHARS = 2000;
const MAX_BOARD_REFERENCE_PHOTOS = 2;
/** Stable identity: an inline `= []` default is a new array each render and re-fires every effect that depends on it. */
const NO_BOARD_PHOTOS: VisionReferenceAttachment[] = [];

export type AddSceneRequest = { description: string; photo: VisionStartPhoto | null; references?: VisionReferenceAttachment[]; sessionId?: string };

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
  /** A request taken back from generation: its words and photo refill the composer, then this is cleared. */
  restoreDraft?: AddSceneRequest | null;
  onDraftRestored?: () => void;
  /** Reports a local draft mutation so the owning ceremony can persist it. */
  onDraftChange?: (request: AddSceneRequest) => void;
  /** False at the board's image limit: the composer is replaced by a short explanation. */
  canAddImage?: boolean;
  /** Existing private board photos that can guide the next generated scene. */
  boardReferencePhotos?: VisionReferenceAttachment[];
  testID?: string;
};

/**
 * "What else do you see in this future?": the compact way to add another scene without leaving the
 * board. An optional reference photo, a description (typed or spoken), and optional shortcuts. The
 * board underneath is never remounted; submitting hands a prepared request to the existing generation
 * experience. A draft survives closing the sheet and clears once a request is sent.
 */
export function VisionAddSceneSheet({ visible, onClose, anchorIntention, onSubmit, onAddOwnPhoto, onAddNote, restoreDraft = null, onDraftRestored, onDraftChange, canAddImage = true, boardReferencePhotos = NO_BOARD_PHOTOS, testID = 'vision-add-scene-sheet' }: Props) {
  const reduceMotion = useV2ReduceMotion();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const [text, setText] = useState('');
  const latestText = useRef(text);
  latestText.current = text;
  const [photo, setPhoto] = useState<VisionStartPhoto | null>(null);
  const boardReferenceIds = useMemo(() => new Set(boardReferencePhotos.map(reference => reference.assetId).filter(Boolean)), [boardReferencePhotos]);
  const initialBoardReferences = useMemo(() => boardReferencePhotos.filter(reference => reference.assetId).slice(0, MAX_BOARD_REFERENCE_PHOTOS), [boardReferencePhotos]);
  const [references, setReferences] = useState<VisionReferenceAttachment[]>(initialBoardReferences);
  const [useBoardPhotos, setUseBoardPhotos] = useState(initialBoardReferences.length > 0);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Android's animated keyboard value is not reported inside a native Modal window, so its lift comes from the keyboard events instead.
  const [androidLift, setAndroidLift] = useState(0);
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const fieldY = useRef(0);
  const fieldRef = useRef<VisionSceneFieldHandle>(null);
  const flight = useRef(createSingleFlight()).current;
  const handoff = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (handoff.current) clearTimeout(handoff.current); }, []);

  // With the keyboard up there is little room left: the secondary links step aside and the field scrolls into view, so what is being typed stays visible.
  useEffect(() => {
    if (!visible) { setKeyboardOpen(false); setAndroidLift(0); return undefined; }
    const show = Keyboard.addListener('keyboardDidShow', event => {
      setKeyboardOpen(true);
      setAndroidLift(Math.max(0, windowHeight - (event.endCoordinates?.screenY ?? windowHeight)));
      scrollRef.current?.scrollTo({ y: Math.max(0, fieldY.current - spacing[2]), animated: true });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => { setKeyboardOpen(false); setAndroidLift(0); });
    return () => { show.remove(); hide.remove(); };
  }, [visible, windowHeight]);

  useEffect(() => {
    if (!restoreDraft) return;
    setText(restoreDraft.description);
    const restoredReferences = restoreDraft.references?.length
      ? restoreDraft.references
      : restoreDraft.photo
        ? [{ id: `legacy-reference-${Date.now()}`, ...restoreDraft.photo, role: 'inspiration' as const }]
        : [];
    setReferences(restoredReferences);
    setUseBoardPhotos(restoredReferences.some(reference => reference.assetId && boardReferenceIds.has(reference.assetId)));
    setPhoto(restoredReferences.length ? null : restoreDraft.photo);
    onDraftChange?.({
      description: restoreDraft.description,
      photo: restoredReferences.length ? null : restoreDraft.photo,
      ...(restoredReferences.length ? { references: restoredReferences } : {}),
    });
    onDraftRestored?.();
  }, [restoreDraft, onDraftRestored, onDraftChange, boardReferenceIds]);

  const trimmed = text.trim();
  const hasReference = photo !== null || references.length > 0;
  const valid = hasReference ? trimmed.length === 0 || (trimmed.length >= ADD_SCENE_MIN_CHARS && trimmed.length <= ADD_SCENE_MAX_CHARS)
    : trimmed.length >= ADD_SCENE_MIN_CHARS && trimmed.length <= ADD_SCENE_MAX_CHARS;

  const draftRequest = (description: string, nextReferences = references, nextPhoto = photo): AddSceneRequest => ({
    description,
    photo: nextReferences.length ? null : nextPhoto,
    ...(nextReferences.length ? { references: nextReferences } : {}),
  });

  const updateReferences = useCallback((nextReferences: VisionReferenceAttachment[]) => {
    setReferences(nextReferences);
    setUseBoardPhotos(nextReferences.some(reference => reference.assetId && boardReferenceIds.has(reference.assetId)));
    setPhoto(null);
    setNotice(null);
    onDraftChange?.({ description: latestText.current, photo: null, ...(nextReferences.length ? { references: nextReferences } : {}) });
  }, [boardReferenceIds, onDraftChange]);

  const toggleBoardPhotos = (enabled: boolean) => {
    setUseBoardPhotos(enabled);
    const boardRefs = boardReferencePhotos.filter(reference => reference.assetId).slice(0, MAX_BOARD_REFERENCE_PHOTOS);
    const manualRefs = references.filter(reference => !reference.assetId || !boardReferenceIds.has(reference.assetId));
    const nextReferences = enabled
      ? [...boardRefs, ...manualRefs].slice(0, 5)
      : manualRefs;
    setReferences(nextReferences);
    setPhoto(null);
    onDraftChange?.({ description: latestText.current, photo: null, ...(nextReferences.length ? { references: nextReferences } : {}) });
  };

  // The keyboard's height rides on the UI thread, so the sheet lifts with it frame by frame on iOS and Android.
  // flexShrink lets the sheet yield to the modal's height cap, so its scrolling body gives way instead of the fixed actions row running off-screen.
  const lift = useAnimatedStyle(() => ({ paddingBottom: Platform.OS === 'android' ? 0 : keyboard.height.value, flexShrink: 1 }));

  const close = () => { fieldRef.current?.stopDictation(); Keyboard.dismiss(); onClose(); };

  const submit = async () => {
    if (!valid) { setNotice(hasReference ? `Describe it in ${ADD_SCENE_MIN_CHARS}–${ADD_SCENE_MAX_CHARS} characters, or clear the text.` : `Describe the scene in ${ADD_SCENE_MIN_CHARS}–${ADD_SCENE_MAX_CHARS} characters.`); return; }
    // One request per tap sequence: a second tap while the first is closing the sheet is dropped.
    await flight.run(async () => {
      fieldRef.current?.stopDictation();
      Keyboard.dismiss();
      const request = draftRequest(trimmed);
      setText(''); setPhoto(null); setReferences(initialBoardReferences); setUseBoardPhotos(initialBoardReferences.length > 0); setNotice(null); setShowSuggestions(false);
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
    // Even with reduced motion the native Modal needs its short exit to finish
    // before iOS can present another native controller over it.
    const delay = reduceMotion ? AnchorMotion.duration.micro + 32 : VISION_ADD_SHEET_HANDOFF_MS;
    handoff.current = setTimeout(() => onAddOwnPhoto(source), delay);
  };

  return (
    <V2SheetModal visible={visible} onClose={close} reduceMotion={reduceMotion} scrimAccessibilityLabel="Close" testID={testID}
      bottomInset={Platform.OS === 'android' ? androidLift : 0}>
      <Animated.View style={lift}>
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[3]) + V2_SHEET_SKIRT }, androidLift > 0 ? { maxHeight: windowHeight - androidLift + V2_SHEET_SKIRT - insets.top - spacing[2] } : null]} accessibilityViewIsModal>
        <V2SheetGrabZone>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>What Else Do You See?</Text>
          <Text style={styles.sub}>Imagine another moment from your future.</Text>
        </V2SheetGrabZone>
        {!canAddImage ? (
          <View style={styles.body}>
            <Text testID="vision-add-scene-full" accessibilityLiveRegion="polite" style={styles.sub}>Your board is full. Remove an image to add another, or add a note.</Text>
          </View>
        ) : (
        <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <View onLayout={event => { fieldY.current = event.nativeEvent.layout.y; }}>
          <VisionSceneField
            handleRef={fieldRef}
            testID="vision-scene-input"
            accessibilityLabel="Describe the next scene"
            value={text}
            onChangeText={value => { setText(value); if (notice) setNotice(null); onDraftChange?.(draftRequest(value)); }}
            maxChars={ADD_SCENE_MAX_CHARS}
            placeholder="Describe your next scene…"
            minHeight={64}
          />
          </View>
          <VisionReferenceStrip references={references} onChange={updateReferences} onNotice={setNotice}
            collapsed={keyboardOpen} compact={keyboardOpen} testID="vision-add-scene-reference" />
          {boardReferencePhotos.length > 0 ? (
            <View style={styles.boardReferenceToggle}>
              <View style={styles.boardReferenceCopy}>
                <Text style={styles.boardReferenceTitle}>Use up to two photos from this board</Text>
                <Text style={styles.boardReferenceHint}>Guide the new images with your existing vision</Text>
              </View>
              <Switch testID="vision-add-scene-board-reference-toggle" value={useBoardPhotos} onValueChange={toggleBoardPhotos}
                accessibilityLabel="Use photos from this Vision board as references"
                trackColor={{ false: colors.border.default, true: colors.paywall.gold }} thumbColor={colors.canvas} />
            </View>
          ) : null}
          {!keyboardOpen ? <View style={styles.suggestions}>
            <Pressable testID="vision-add-scene-show-suggestions" accessibilityRole="button" accessibilityLabel={showSuggestions ? 'Hide suggestions' : text.trim() ? 'Show suggestions' : 'Need a spark? Show suggestions'}
              onPress={() => setShowSuggestions(value => !value)} style={styles.suggestionToggle}>
              <Text style={styles.suggestionToggleText}>{showSuggestions ? 'Hide suggestions' : text.trim() ? 'Show suggestions' : 'Need a spark? Show suggestions'}</Text>
            </Pressable>
            {showSuggestions ? <VisionSceneShortcuts label="Suggested for your vision" goal={anchorIntention} text={text}
              onPick={item => { const next = applySceneSuggestion(text, item); setText(next); onDraftChange?.(draftRequest(next)); }} /> : null}
          </View> : null}
          {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
        </ScrollView>
        )}
        <View style={styles.actions}>
          {canAddImage ? <VisionInkPill testID="vision-scene-generate" label="Generate Images" accessibilityLabel="Generate images" disabled={!valid}
            onDisabledPress={() => setNotice(`Describe the scene in ${ADD_SCENE_MIN_CHARS}–${ADD_SCENE_MAX_CHARS} characters, or add a reference photo.`)} onPress={() => { void submit(); }} /> : null}
          {onAddOwnPhoto && canAddImage && !keyboardOpen ? (
            <View style={styles.ownRow}>
              <Pressable testID="vision-add-own-photo" accessibilityRole="button" accessibilityLabel="Use my own photo" onPress={() => addOwn('library')} style={styles.photoAction}>
                <Images size={16} color={colors.text.primary} strokeWidth={1.7} />
                <Text style={styles.photoLabel}>Use my own photo</Text>
              </Pressable>
              <Pressable testID="vision-add-own-camera" accessibilityRole="button" accessibilityLabel="Take a photo" onPress={() => addOwn('camera')} style={styles.photoAction}>
                <Camera size={16} color={colors.text.primary} strokeWidth={1.7} />
                <Text style={styles.photoLabel}>Take a photo</Text>
              </Pressable>
            </View>
          ) : null}
          {onAddNote && !keyboardOpen ? (
            <Pressable testID="vision-add-note" accessibilityRole="button" accessibilityLabel="Add a note" onPress={addNote} style={[styles.photoAction, styles.noteAction]}>
              <StickyNote size={16} color={colors.text.primary} strokeWidth={1.7} />
              <Text style={styles.photoLabel}>Add a note</Text>
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
  title: { fontFamily: VISION_SERIF, fontSize: 26, lineHeight: 31, color: colors.text.primary, textAlign: 'center' },
  body: { gap: spacing[3], paddingBottom: spacing[3] },
  boardReferenceToggle: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3], paddingHorizontal: spacing[3], borderRadius: radii.md, backgroundColor: colors.grouped },
  boardReferenceCopy: { flex: 1, gap: 2 },
  boardReferenceTitle: { ...typography.bodySM, color: colors.text.primary },
  boardReferenceHint: { ...typography.caption, color: colors.text.secondary },
  suggestions: { gap: spacing[1] },
  suggestionToggle: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  suggestionToggleText: { ...typography.bodySM, color: colors.text.secondary, textDecorationLine: 'underline' },
  notice: { ...typography.bodySM, color: colors.semantic.error },
  sub: { ...typography.bodyMD, color: colors.text.secondary, textAlign: 'center', marginTop: spacing[1], marginBottom: spacing[3] },
  noteAction: { alignSelf: 'center', flex: 0, width: '50%' },
  actions: { gap: spacing[2], paddingTop: spacing[2] },
  ownRow: { flexDirection: 'row', gap: spacing[2] },
  photoAction: { flex: 1, minHeight: 44, flexDirection: 'row', gap: spacing[2], alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[2], borderWidth: 1, borderColor: colors.border.default, borderRadius: radii.pill, backgroundColor: colors.surface },
  photoLabel: { flexShrink: 1, fontFamily: 'Inter-SemiBold', fontSize: 12, textAlign: 'center', color: colors.text.primary },
});
