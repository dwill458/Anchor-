import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ArrowLeft, Check } from 'lucide-react-native';
import type { VisionNoteFontId, VisionNoteStyleId } from '@/adapters/v2/vision';
import { useV2ReduceMotion } from '@/hooks/v2';
import { useV2Vision } from '@/hooks/v2/vision';
import type { VisionNotePresentation } from '@/adapters/v2/vision';
import { clampVisionNotePresentationForAspect, defaultVisionNoteOccupancy, nextVisionNotePresentation, visionBoardAspectForCount } from '@/components/v2/vision/notes/visionNotePlacement';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { VisionNoteRenderer } from '@/components/v2/vision/notes/VisionNoteRenderer';
import { VISION_SERIF } from '@/components/v2/vision/VisionPaperChrome';
import { VisionPaperSurface, VisionTapeOverlay, VISION_PAPER } from '@/components/v2/vision/material';
import {
  getVisionNotePreset, type VisionNotePreset,
  VISION_NOTE_FAMILIES, VISION_NOTE_MAX_CHARS,
  VISION_NOTE_PRESETS, VISION_NOTE_STYLE_TRANSITION_MS, VISION_NOTE_FONTS, type VisionNoteFamily,
} from '@/components/v2/vision/notes/visionNoteStyles';
import { ApiClientError } from '@/services/ApiClient';

type RouteParams = { anchorId: string; visionId?: string; noteId?: string };
type Props = {
  route: { params: RouteParams };
  navigation: { goBack: () => void;
    navigate?: (name: 'V2Vision', params: { anchorId: string; savedNoteId: string }) => void;
    popTo?: (name: 'V2Vision', params: { anchorId: string; savedNoteId: string }, options: { merge: boolean }) => void };
};

const FAMILY_LABELS: Record<VisionNoteFamily, string> = { sticky: 'Sticky Notes', paper: 'Paper', editorial: 'Editorial' };
/** Four swatches per row for every family; Sticky's eight colours fill exactly two rows. */
const SWATCH_COLUMNS = 4;
const TILE_COLUMNS = 3;
/** Stable style reference so the paper layer's props never change while typing. */
const PAPER_FILL = StyleSheet.absoluteFill;
/** Shown inside every material tile while the note is empty, so each thumbnail reads as its material. */
const TILE_SAMPLE_TEXT = '';
/** Preview size: share of the screen width, height relative to width, and the cap on its share of the screen height. */
const PREVIEW_WIDTH_SHARE = 0.68;
const PREVIEW_ASPECT = 1;
const PREVIEW_MAX_HEIGHT_SHARE = 0.3;
/** The preview is set at a slight tilt, like a note stuck to the page. */
const PREVIEW_TILT = '2deg';
/** Inset of the thumbnail inside its tile box, so the note never touches or clips at the rounded edge. */
const TILE_INSET = 8;
const TILE_TEXT_LIMIT = 40;

function noteSaveErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case 'VALIDATION_ERROR':
      case 'VISION_NOTE_LIMIT':
        return error.message;
      case 'ANCHOR_NOT_FOUND':
        return 'This Anchor is no longer available. Return to your Anchors and try again.';
      case 'VISION_NOT_FOUND':
        return 'This Vision is no longer available. Return to the board and try again.';
      case 'IDEMPOTENCY_CONFLICT':
        return 'This note was saved with an earlier version. Return to your Vision board and edit the saved note.';
      case 'NOT_FOUND':
        return 'The note service is unavailable. Check for an app update, then try again.';
    }
    if (error.status !== undefined && error.status >= 500) {
      return 'The server could not save your note. Your draft is still here; try again shortly.';
    }
    if (error.message && error.message !== 'An unexpected error occurred') return error.message;
  }
  if (error instanceof Error) {
    if (error.message === 'Network error. Please check your connection.') {
      return 'No connection. Your draft is still here; reconnect and try again.';
    }
    if (error.message === 'Session expired. Please sign in again.') return error.message;
    if (error.message === 'Access denied.') return 'You do not have access to save a note on this Anchor.';
  }
  return 'Your note could not be saved. Your draft is still here; please try again.';
}

type MaterialTileProps = {
  family: VisionNoteFamily;
  preset: VisionNotePreset;
  selected: boolean;
  fontId: VisionNoteFontId;
  size: number;
  /** The text each thumbnail shows: the draft when there is one, otherwise the sample. */
  sampleText: string;
  onSelectFamily: (family: VisionNoteFamily) => void;
};

/**
 * One material choice: an equal, rounded square with the shared renderer's thumbnail inside, a label beneath,
 * and a tinted box with an ink outline and a check badge when chosen.
 */
const MaterialTile = memo(function MaterialTile({ family, preset, selected, fontId, size, sampleText, onSelectFamily }: MaterialTileProps) {
  const thumb = Math.max(0, size - TILE_INSET * 2);
  const onPress = useCallback(() => onSelectFamily(family), [family, onSelectFamily]);
  return (
    <Pressable testID={`vision-note-family-${family}`} accessibilityRole="tab"
      accessibilityLabel={`${FAMILY_LABELS[family]} styles`} accessibilityState={{ selected }} onPress={onPress}
      style={[styles.tile, { width: size }]}>
      <View testID={`vision-note-tile-box-${family}`} style={[styles.tileBox, { width: size, height: size }, selected ? styles.tileBoxSelected : styles.tileBoxIdle]}>
        <View style={[styles.tileThumb, { width: thumb, height: thumb }]}>
          <VisionNoteRenderer materialMode="photographic" styleId={preset.id} fontId={family === 'editorial' ? undefined : fontId} text={sampleText} width={thumb} height={thumb}
            testID={`vision-note-tile-${family}`} scrollText={false} shadowOverride="none" compact />
        </View>
        {selected ? <View testID={`vision-note-family-check-${family}`} style={styles.check}><Check size={13} color={colors.paper} /></View> : null}
      </View>
      <Text numberOfLines={1} style={[styles.tileLabel, selected && styles.tileLabelSelected]}>{FAMILY_LABELS[family]}</Text>
    </Pressable>
  );
});

type StyleSwatchProps = {
  preset: VisionNotePreset;
  selected: boolean;
  fontId: VisionNoteFontId;
  size: number;
  onSelect: (id: VisionNoteStyleId) => void;
};

/** A colour or paper swatch. Only the selected swatch carries the heavy border and the check badge. */
const StyleSwatch = memo(function StyleSwatch({ preset, selected, fontId, size, onSelect }: StyleSwatchProps) {
  const inner = size - 12;
  const onPress = useCallback(() => onSelect(preset.id), [onSelect, preset.id]);
  return (
    <View style={[styles.swatchCell, { width: size }]}>
      <Pressable testID={`vision-note-style-${preset.id}`} accessibilityRole="button"
        accessibilityLabel={`${preset.label} note style`} accessibilityState={{ selected }} onPress={onPress}
        style={[styles.swatch, { width: size, height: size }, selected ? styles.swatchSelected : styles.swatchIdle]}>
        <VisionNoteRenderer materialMode="photographic" styleId={preset.id} fontId={preset.family === 'editorial' ? undefined : fontId} text="" width={inner} height={inner}
          testID={`vision-note-swatch-${preset.id}`} scrollText={false} shadowOverride="none" />
        {selected ? <View testID={`vision-note-style-check-${preset.id}`} style={styles.check}><Check size={13} color={colors.paper} /></View> : null}
      </Pressable>
      <Text numberOfLines={2} style={[styles.swatchText, { width: size }]}>{preset.label}</Text>
    </View>
  );
});

/** Create or edit a persisted Vision note while keeping material choices presentation-only. */
export function V2VisionNoteComposer({ route, navigation }: Props) {
  const model = useV2Vision(route.params.anchorId);
  const editingNote = route.params.noteId ? model.vision?.notes?.find(note => note.id === route.params.noteId) : undefined;
  const reduceMotion = useV2ReduceMotion();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(() => editingNote?.content.text ?? '');
  const [family, setFamily] = useState<VisionNoteFamily>('sticky');
  const [styleId, setStyleId] = useState<VisionNoteStyleId>(() => editingNote?.presentation.styleId ?? 'sticky_blush_pink');
  const [fontId, setFontId] = useState<VisionNoteFontId>(() => editingNote?.presentation.fontId ?? 'handwritten');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hydratedNoteId = useRef<string | null>(null);
  const clientRequestId = useRef(createClientRequestId()).current;
  const saveLock = useRef(false);
  const [previousStyleId, setPreviousStyleId] = useState<VisionNoteStyleId | null>(null);
  const progress = useSharedValue(1);
  const settle = useSharedValue(1);
  const text = draft || 'Your note will appear here';
  const contentWidth = Math.min(screenWidth, 540) - spacing[5] * 2;
  // About 56% of the screen's width and at most 30% of its height, so the material tiles and font row stay visible
  // beneath the preview on a 6.1 to 6.8 inch phone.
  const previewWidth = Math.max(200, Math.min(280, screenWidth * PREVIEW_WIDTH_SHARE, contentWidth - spacing[4]));
  const previewHeight = Math.max(160, Math.min(previewWidth * PREVIEW_ASPECT, screenHeight * PREVIEW_MAX_HEIGHT_SHARE));
  const swatchWidth = (contentWidth - spacing[3] * (SWATCH_COLUMNS - 1)) / SWATCH_COLUMNS;
  const tileWidth = (contentWidth - spacing[3] * (TILE_COLUMNS - 1)) / TILE_COLUMNS;
  const tileSampleText = draft.trim() ? Array.from(draft.trim()).slice(0, TILE_TEXT_LIMIT).join('') : TILE_SAMPLE_TEXT;
  const familyPresets = useMemo(() => VISION_NOTE_PRESETS.filter(preset => preset.family === family), [family]);
  /** Each tile previews its family: the chosen style where selected, otherwise the family's first style. */
  const tiles = useMemo(() => VISION_NOTE_FAMILIES.map(option => ({
    family: option,
    preset: option === family ? getVisionNotePreset(styleId) : VISION_NOTE_PRESETS.find(preset => preset.family === option)!,
  })), [family, styleId]);

  React.useEffect(() => {
    if (!route.params.noteId || !editingNote || hydratedNoteId.current === editingNote.id) return;
    hydratedNoteId.current = editingNote.id;
    setDraft(editingNote.content.text);
    setStyleId(editingNote.presentation.styleId);
    setFontId(editingNote.presentation.fontId ?? 'handwritten');
    setFamily(VISION_NOTE_PRESETS.find(preset => preset.id === editingNote.presentation.styleId)?.family ?? 'sticky');
  }, [editingNote, route.params.noteId]);

  const clearPrevious = useCallback(() => setPreviousStyleId(null), []);
  const selectStyle = useCallback((next: VisionNoteStyleId) => {
    if (next === styleId) return;
    if (reduceMotion) {
      setPreviousStyleId(null);
      progress.value = 1;
      settle.value = 1;
    } else {
      setPreviousStyleId(styleId);
      progress.value = 0;
      settle.value = 1.02;
      progress.value = withTiming(1, { duration: VISION_NOTE_STYLE_TRANSITION_MS }, finished => {
        if (finished) runOnJS(clearPrevious)();
      });
      settle.value = withSpring(1, { damping: 20, stiffness: 210, mass: 0.8 });
    }
    setStyleId(next);
  }, [clearPrevious, progress, reduceMotion, settle, styleId]);

  const currentMaterial = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : progress.value,
    transform: reduceMotion ? [] : [{ translateY: (1 - settle.value) * 150 }, { scale: settle.value }],
  }), [reduceMotion]);
  const previousMaterial = useAnimatedStyle(() => ({ opacity: reduceMotion ? 0 : 1 - progress.value }), [reduceMotion]);

  const selectFamily = useCallback((next: VisionNoteFamily) => {
    if (next === family) return;
    setFamily(next);
    const first = VISION_NOTE_PRESETS.find(preset => preset.family === next);
    if (first) selectStyle(first.id);
  }, [family, selectStyle]);

  const saveNote = async () => {
    if (saveLock.current || !draft.trim() || (route.params.noteId && (model.loading || !editingNote))) return;
    saveLock.current = true;
    setSaving(true);
    setSaveError(null);
    const boardAspectRatio = visionBoardAspectForCount(model.tiles.length);
    const materialPresentation: VisionNotePresentation = editingNote
      ? { ...editingNote.presentation, styleId }
      : clampVisionNotePresentationForAspect({
        ...nextVisionNotePresentation(styleId, model.vision?.notes ?? [], defaultVisionNoteOccupancy(model.tiles.length), boardAspectRatio),
      }, boardAspectRatio);
    const presentation: VisionNotePresentation = family === 'editorial' ? materialPresentation : { ...materialPresentation, fontId };
    try {
      const result = route.params.noteId
        ? await model.updateNote(route.params.noteId, { content: { text: draft }, presentation })
        : await model.createNote({ clientRequestId, content: { text: draft }, presentation });
      if (result) {
        const savedNote = route.params.noteId
          ? result.notes?.find(note => note.id === route.params.noteId)
          : result.notes?.find(note => !model.vision?.notes?.some(existing => existing.id === note.id));
        const destination = { anchorId: route.params.anchorId, savedNoteId: savedNote?.id ?? route.params.noteId ?? clientRequestId };
        if (navigation.popTo) navigation.popTo('V2Vision', destination, { merge: true });
        // React Navigation 6 resolves navigate to the existing stack route.
        // Carry the saved ID on this path too, so reveal/settle runs on devices.
        else if (navigation.navigate) navigation.navigate('V2Vision', destination);
        else navigation.goBack();
      }
      else setSaveError('Your note could not be saved. Please try again.');
    } catch (error: unknown) {
      setSaveError(noteSaveErrorMessage(error));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const changeDraft = (value: string) => setDraft(Array.from(value).slice(0, VISION_NOTE_MAX_CHARS).join(''));
  const materialFontId = family === 'editorial' ? undefined : fontId;
  return (
    <View style={styles.safe}>
      <VisionPaperSurface testID="v2-vision-note-paper" style={PAPER_FILL} />
      <SafeAreaView testID={`v2-vision-note-composer-${route.params.anchorId}`} style={styles.screen} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.header}>
            <Pressable onPress={navigation.goBack} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} style={styles.back}>
              <ArrowLeft size={21} color={colors.text.primary} />
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>{route.params.noteId ? 'Edit Note' : 'Add a Note'}</Text>
            <View style={styles.headerBalance} />
          </View>
          <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} showsVerticalScrollIndicator={false}>
            <View style={styles.previewSection}>
              <View style={[styles.previewStage, { width: previewWidth, height: previewHeight }]}>
                <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(240).withInitialValues({ transform: [{ translateY: 6 }] })}
                  testID="vision-note-preview" accessibilityLabel={`Note preview. ${text}`} style={styles.previewFill}>
                  {previousStyleId ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                    style={[styles.materialLayer, previousMaterial]}>
                    <VisionNoteRenderer materialMode="photographic" styleId={previousStyleId} fontId={materialFontId} text={text} width={previewWidth} height={previewHeight} testID="vision-note-previous-material" />
                  </Animated.View> : null}
                  <Animated.View style={[styles.materialLayer, currentMaterial]}>
                    <VisionNoteRenderer materialMode="photographic" styleId={styleId} fontId={materialFontId} text={text} width={previewWidth} height={previewHeight} testID="vision-note-current-renderer" />
                  </Animated.View>
                </Animated.View>
                <VisionTapeOverlay photographic testID="vision-note-preview-tape" width={Math.round(previewWidth * 0.34)} rotation={-3} tone="cream" style={styles.tape} />
              </View>
              <Text style={styles.previewCaption}>Preview</Text>
            </View>

            <View style={styles.inputBlock}>
              <TextInput testID="vision-note-input" value={draft} onChangeText={changeDraft} multiline
                // Native input counts UTF-16; allow two units per emoji, then clamp and count Unicode code points above.
                maxLength={VISION_NOTE_MAX_CHARS * 2}
                textAlignVertical="top" placeholder="Write a note..." placeholderTextColor={colors.text.tertiary}
                accessibilityLabel="Write a note" style={styles.input} returnKeyType="default" />
              <Text testID="vision-note-counter" accessibilityLiveRegion="polite" style={styles.counter}>{Array.from(draft).length} / {VISION_NOTE_MAX_CHARS}</Text>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Choose a material</Text>
              <Text style={styles.styleHint}>Your words stay the same as you explore.</Text>
              <View accessibilityRole="tablist" style={styles.tileRow}>
                {tiles.map(tile => <MaterialTile key={tile.family} family={tile.family} preset={tile.preset}
                  selected={family === tile.family} fontId={fontId} size={tileWidth} sampleText={tileSampleText} onSelectFamily={selectFamily} />)}
              </View>
            </View>

            {family !== 'editorial' ? <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Choose a font</Text>
              <View accessibilityRole="tablist" style={styles.fontOptions}>
                {VISION_NOTE_FONTS.map(font => {
                  const selected = fontId === font.id;
                  return <Pressable key={font.id} testID={`vision-note-font-${font.id}`} accessibilityRole="tab"
                    accessibilityLabel={`${font.label} font`} accessibilityState={{ selected }} onPress={() => setFontId(font.id)}
                    style={[styles.fontOption, selected && styles.fontOptionSelected]}>
                    <Text style={[styles.fontOptionText, selected && styles.fontOptionTextSelected]}>{font.label}</Text>
                  </Pressable>;
                })}
              </View>
            </View> : null}

            <View testID="vision-note-style-grid" accessibilityLabel={`${family} styles`} style={styles.grid}>
              {familyPresets.map(preset => <StyleSwatch key={preset.id} preset={preset} selected={styleId === preset.id}
                fontId={fontId} size={swatchWidth} onSelect={selectStyle} />)}
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing[3]) }]}>
            {route.params.noteId && model.loading && !editingNote ? <Text style={styles.notice}>Loading note…</Text> : null}
            {route.params.noteId && !model.loading && model.error ? <View style={styles.loadRecovery}>
              <Text accessibilityRole="alert" style={styles.error}>Could not load this note.</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Retry loading note" onPress={() => { void model.refresh(); }}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View> : null}
            {route.params.noteId && !model.loading && !model.error && !editingNote ? <Text accessibilityRole="alert" style={styles.error}>This note is no longer available. It has not been replaced.</Text> : null}
            {saveError ? <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text> : null}
            <Pressable onPress={saveNote} accessibilityRole="button" accessibilityLabel={route.params.noteId ? 'Save note' : 'Add to Vision'}
              testID="vision-note-submit"
              accessibilityState={{ disabled: saving || !draft.trim() || Boolean(route.params.noteId && (!editingNote || model.loading)), busy: saving }}
              disabled={saving || !draft.trim() || Boolean(route.params.noteId && (!editingNote || model.loading))}
              style={[styles.addButton, (!draft.trim() || saving) && styles.addButtonDisabled]}>
              <Text style={styles.addButtonText}>{saving ? 'Saving…' : route.params.noteId ? 'Save note' : 'Add to Vision'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: VISION_PAPER.base },
  screen: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  header: { height: 56, paddingHorizontal: spacing[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: VISION_SERIF, fontSize: 26, lineHeight: 32, color: colors.text.primary },
  headerBalance: { width: 44 },
  content: { alignSelf: 'center', width: '100%', maxWidth: 540, paddingHorizontal: spacing[5], paddingBottom: spacing[5] },
  previewSection: { alignItems: 'center', marginTop: spacing[4], marginBottom: spacing[4] },
  previewStage: { alignItems: 'center', justifyContent: 'center', overflow: 'visible', transform: [{ rotate: PREVIEW_TILT }] },
  previewFill: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  materialLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  /** Tape sits across the top edge of the note, half on the paper and half on the print. */
  tape: { position: 'absolute', top: -9, alignSelf: 'center', zIndex: 3 },
  previewCaption: { ...typography.caption, color: colors.text.secondary, marginTop: spacing[2] },
  // Reserve two input lines plus the counter; longer drafts grow within the scrollable form.
  inputBlock: { minHeight: 88, padding: spacing[3], borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth, borderColor: VISION_PAPER.foxing, backgroundColor: colors.surface },
  input: { ...typography.bodyMD, color: colors.text.primary, minHeight: 40, maxHeight: 140, padding: 0 },
  counter: { ...typography.caption, color: colors.text.tertiary, textAlign: 'right', marginTop: spacing[1] },
  sectionBlock: { marginTop: spacing[5] },
  sectionLabel: { ...typography.caption, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '600' },
  styleHint: { ...typography.caption, color: colors.text.secondary, marginTop: spacing[1], marginBottom: spacing[3] },
  tileRow: { flexDirection: 'row', gap: spacing[3] },
  tile: { alignItems: 'center', gap: spacing[2] },
  tileBox: { borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: VISION_PAPER.base },
  tileBoxIdle: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(42, 30, 16, 0.16)' },
  tileBoxSelected: { borderWidth: 1.5, borderColor: colors.ink.base, backgroundColor: '#EFE3CB' },
  tileThumb: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tileLabel: { ...typography.caption, color: colors.text.secondary, textAlign: 'center' },
  tileLabelSelected: { color: colors.text.primary },
  fontOptions: { flexDirection: 'row', gap: spacing[2] },
  fontOption: { minHeight: 38, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  fontOptionSelected: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.text.primary },
  fontOptionText: { ...typography.labelMD, color: colors.text.tertiary },
  fontOptionTextSelected: { color: colors.text.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', columnGap: spacing[3], rowGap: spacing[3], marginTop: spacing[5] },
  swatchCell: { alignItems: 'center', gap: spacing[1] },
  swatch: { borderRadius: radii.sm, justifyContent: 'center', alignItems: 'center', overflow: 'visible' },
  swatchIdle: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.subtle },
  swatchSelected: { borderWidth: 2, borderColor: colors.text.primary },
  swatchText: { ...typography.caption, color: colors.text.secondary, textAlign: 'center', minHeight: 30 },
  check: { position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.ink.base, justifyContent: 'center', alignItems: 'center' },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[2], paddingBottom: spacing[3], backgroundColor: 'transparent' },
  notice: { ...typography.caption, color: colors.text.secondary, textAlign: 'center', marginBottom: spacing[2] },
  error: { ...typography.caption, color: '#A33B35', textAlign: 'center', marginBottom: spacing[2] },
  loadRecovery: { alignItems: 'center' },
  retryText: { ...typography.labelMD, color: colors.text.primary, textDecorationLine: 'underline' },
  addButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: colors.ink.base },
  addButtonDisabled: { opacity: 0.55 },
  addButtonText: { ...typography.labelLG, color: colors.paper },
});

function createClientRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, marker => {
    const random = Math.floor(Math.random() * 16);
    const value = marker === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

