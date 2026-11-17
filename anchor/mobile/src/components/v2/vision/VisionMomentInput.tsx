import { useEffect, useMemo, useRef, useState } from 'react';
import { DevImageModelPicker } from '@/components/dev/DevImageModelPicker';
import { ActivityIndicator, Image, Keyboard, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ChevronRight, Images, Plus, RefreshCw, Trash2, User as UserIcon } from 'lucide-react-native';
import { v2Haptics } from '@/hooks/v2';
import { useVisionAppearanceReference } from '@/hooks/v2/vision';
import { ChartKeyboardFrame } from '@/components/v2/chart/ChartKeyboardFrame';
import { CircularAnchorRenderer } from '@/components/v2/anchor';
import { AnchorMotion, colors as paperColors, getCategoryColor, radii, spacing } from '@/theme/v2';
import type { VisionReferenceAttachment } from '@/types/visionConversation';
import type { VisionAnchorArt } from './VisionChrome';
import { VisionChoiceSheet, type VisionChoiceAction } from './VisionChoiceSheet';
import { AttentionWash, useAttention, useVisionContentMotion } from './VisionMotion';
import { VisionReferenceStrip } from './VisionReferenceStrip';
import { type VisionStartPhoto } from './VisionReferencePhoto';
import { VisionSceneField, type VisionSceneFieldHandle } from './VisionSceneField';
import { VisionBackButton, VisionInkPill, VISION_GOLD, VISION_SERIF, VISION_SERIF_ITALIC } from './VisionPaperChrome';
import { applySceneSuggestion } from './visionSceneSuggestions';
import { visionDetailHint, visionDetailLevel } from './visionGuidance';

export type { VisionStartPhoto };

export interface VisionMomentInputProps {
  /** Uses the persistent ceremony ink stage and its top-center Anchor. */
  ceremony?: boolean;
  mode: 'create' | 'add';
  anchorId: string;
  anchorIntention: string;
  anchorCategory?: string | null;
  anchorArt?: VisionAnchorArt | null;
  anchorImageUrl?: string | null;
  previewImageUrl?: string | null;
  initialDescription?: string;
  description?: string;
  onChangeDescription?: (val: string) => void;
  /** Saves draft text without lifting controlled typing into the ceremony. */
  onDraftChange?: (val: string) => void;
  placeholder?: string;
  onBack: () => void;
  /** The start photo is passed only when the person chose "Start from a photo"; the words path calls this with two arguments, as it always has. */
  onSubmit: (description: string, appearanceReferenceId?: string | null, startPhoto?: VisionStartPhoto | null, references?: VisionReferenceAttachment[]) => Promise<boolean | void> | void;
  /** Shows the optional reference photo surface. Off: the screen is the description alone. */
  startPhotoEnabled?: boolean;
  startPhoto?: VisionStartPhoto | null;
  onChangeStartPhoto?: (photo: VisionStartPhoto | null) => void;
  /** Structured references selected for this scene. If omitted, the strip keeps a local draft. */
  references?: VisionReferenceAttachment[];
  onChangeReferences?: (references: VisionReferenceAttachment[]) => void;
  /** Starts the own-photo path (each photo goes to the board as it is): from the library or the camera. */
  onAddPhotos?: (source: 'library' | 'camera') => void;
  loading?: boolean;
  error?: string | null;
  testID?: string;
  textInputTestID?: string;
}

export const SPARK_SUGGESTIONS = ['The day it happens', 'Who is with me', 'An ordinary morning after', 'A quiet moment of it'] as const;

/** The guidance written inside the field until the person starts typing. */
export const VISION_FIELD_GUIDANCE = 'Where you are, what you\'re doing, how it feels. A little more detail makes a stronger picture.';
/** The character counter appears only once the description nears its limit. */
const COUNTER_VISIBLE_AFTER = 1500;

/** The own-photo path: one link under the CTA opens this choice. Sheet testID `vision-add` keeps `vision-add-photos` and `vision-add-camera`. */
const OWN_PHOTO_ACTIONS: ReadonlyArray<VisionChoiceAction> = [
  { key: 'photos', label: 'Use my own photos', Icon: Images },
  { key: 'camera', label: 'Take a photo', Icon: Camera },
];

/** Colours the animated styles interpolate between, held as plain strings so no theme object is carried into a worklet. */
const colors = paperColors;
/** The "Make it look like you" card is hidden for now; flip this to bring it back. */
const SHOW_APPEARANCE_REFERENCE_CARD = false;

const REFERENCE_ACTIONS: ReadonlyArray<VisionChoiceAction> = [
  { key: 'change', label: 'Change reference photo', Icon: RefreshCw },
  { key: 'remove', label: 'Remove reference photo', Icon: Trash2, destructive: true },
];

/**
 * Screen 3: "What do you see?" It should read as authorship on paper, not as
 * an AI settings form. The real Anchor, the person's intention, one field,
 * three prompts, an optional identity reference, one action.
 *
 * Motion here only explains change. The path toggle's ink pill travels between
 * its stops and the body beneath it cross-fades and re-flows instead of
 * cutting; the Anchor card, being the constant, never moves. The Create pill
 * eases to ready, and tapped while blocked it points at what is missing.
 */
export function VisionMomentInput({
  mode,
  ceremony = false,
  anchorIntention,
  anchorCategory,
  anchorArt,
  initialDescription = '',
  description: propDescription,
  onChangeDescription: propOnChangeDescription,
  onDraftChange,
  placeholder: customPlaceholder,
  onBack,
  onSubmit,
  startPhotoEnabled = false,
  startPhoto: propStartPhoto,
  onChangeStartPhoto,
  references: propReferences,
  onChangeReferences,
  onAddPhotos,
  loading = false,
  error = null,
  testID = 'vision-moment-input',
  textInputTestID,
}: VisionMomentInputProps) {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const styles = paperStyles;
  const [internalDescription, setInternalDescription] = useState(propDescription ?? initialDescription);
  const descriptionRef = useRef(internalDescription);
  const description = internalDescription;
  useEffect(() => {
    if (propDescription !== undefined && propDescription !== descriptionRef.current) {
      descriptionRef.current = propDescription;
      setInternalDescription(propDescription);
    }
  }, [propDescription]);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const setDescription = (text: string) => {
    descriptionRef.current = text;
    setInternalDescription(text);
    onDraftChange?.(text);
    if (localNotice) setLocalNotice(null);
  };

  const [internalStartPhoto, setInternalStartPhoto] = useState<VisionStartPhoto | null>(null);
  const startPhoto = propStartPhoto !== undefined ? propStartPhoto : internalStartPhoto;
  const [internalReferences, setInternalReferences] = useState<VisionReferenceAttachment[]>([]);
  const hasControlledReferences = propReferences !== undefined;
  const localStartPhotoReference = useMemo<VisionReferenceAttachment | null>(() => startPhoto ? ({
    id: `legacy-start-photo:${startPhoto.uri}`,
    uri: startPhoto.uri,
    mimeType: startPhoto.mimeType,
    role: 'inspiration',
  }) : null, [startPhoto]);
  const displayedReferences = useMemo(() => {
    if (hasControlledReferences) return propReferences ?? [];
    if (!localStartPhotoReference || internalReferences.some(reference => reference.uri === localStartPhotoReference.uri)) return internalReferences;
    return [localStartPhotoReference, ...internalReferences].slice(0, 5);
  }, [hasControlledReferences, internalReferences, localStartPhotoReference, propReferences]);
  /** The legacy single-photo path stays compatible; structured references describe a scene, not a photo edit. */
  const photoPath = startPhotoEnabled && Boolean(startPhoto) && !hasControlledReferences && displayedReferences.length === 1;
  const setStartPhoto = (photo: VisionStartPhoto | null) => {
    if (onChangeStartPhoto) onChangeStartPhoto(photo); else setInternalStartPhoto(photo);
  };
  const setReferences = (next: VisionReferenceAttachment[]) => {
    if (!hasControlledReferences) setInternalReferences(next);
    onChangeReferences?.(next);
    if (!hasControlledReferences && startPhoto) {
      const legacy = displayedReferences.find(reference => reference.uri === startPhoto.uri);
      const nextLegacy = legacy ? next.find(reference => reference.id === legacy.id) : null;
      if (!nextLegacy) setStartPhoto(null);
      else if (nextLegacy.uri !== startPhoto.uri || nextLegacy.mimeType !== startPhoto.mimeType) {
        setStartPhoto({ uri: nextLegacy.uri, mimeType: nextLegacy.mimeType });
      }
    }
  };
  const fieldRef = useRef<VisionSceneFieldHandle>(null);

  const [inputFocused, setInputFocused] = useState(false);
  const fieldFocused = useRef(false);
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      if (fieldFocused.current) setInputFocused(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setInputFocused(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);
  const handleFieldFocus = () => {
    fieldFocused.current = true;
    setInputFocused(true);
  };
  const handleFieldBlur = () => {
    fieldFocused.current = false;
    setInputFocused(false);
  };
  const isCreate = mode === 'create';
  const categoryColor = getCategoryColor(anchorCategory);

  const content = useVisionContentMotion();
  const inputAttention = useAttention();
  const [sheet, setSheet] = useState<'reference' | 'own-photo' | null>(null);

  const minChars = isCreate ? 12 : 6;
  const maxChars = 2000;

  const hint = visionDetailHint(description);
  const level = visionDetailLevel(description);

  const appearance = useVisionAppearanceReference();
  const [useAppearance, setUseAppearance] = useState(true);
  const [pickingReference, setPickingReference] = useState(false);
  const activeReferenceUrl = useMemo(() => {
    if (!useAppearance) return null;
    if (appearance.reference?.previewUrl) return appearance.reference.previewUrl;
    if (appearance.reference?.source === 'PROFILE' && appearance.profilePhoto) return appearance.profilePhoto;
    if (appearance.profilePhoto && appearance.enabledByPreference) return appearance.profilePhoto;
    return null;
  }, [appearance.enabledByPreference, appearance.profilePhoto, appearance.reference, useAppearance]);

  const trimmed = description.trim();
  // A photo alone is enough to generate; a description is encouraged, but when one is started it must be long enough to mean something.
  const isValid = displayedReferences.length > 0 && trimmed.length === 0 ? true : photoPath
    ? Boolean(startPhoto) && (trimmed.length === 0 || (trimmed.length >= minChars && trimmed.length <= maxChars))
    : trimmed.length >= minChars && trimmed.length <= maxChars;

  const handleChipPress = (suggestion: string) => {
    v2Haptics.selection();
    setDescription(applySceneSuggestion(description, suggestion));
  };

  const handlePickReferencePhoto = async () => {
    Keyboard.dismiss();
    setPickingReference(true);
    try {
      // Quality 0.7: a reference only needs the face and build, and a phone original would be several MB of base64.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
      });
      const item = result.assets?.[0];
      if (result.canceled || !item) return;
      let failure: string | null = null;
      const next = await appearance.upload(item.uri, 'CUSTOM', item.mimeType, message => { failure = message; });
      if (!next) { setLocalNotice(failure ?? 'The photo could not be used as a reference.'); return; }
      setUseAppearance(true);
      setLocalNotice(null);
    } catch {
      setLocalNotice('Unable to open photo library.');
    } finally {
      setPickingReference(false);
    }
  };

  const removeReference = () => { void appearance.remove(); setUseAppearance(false); };
  const handleReferenceOptions = () => {
    if (!activeReferenceUrl) { void handlePickReferencePhoto(); return; }
    setSheet('reference');
  };

  const handleSubmit = () => {
    if (!isValid || loading) return;
    fieldRef.current?.stopDictation();
    Keyboard.dismiss();
    // A saved profile-photo reference is only usable while the user has opted in; without a
    // profile photo or consent the scene is created without a likeness.
    const usableReference = appearance.reference && (appearance.reference.source !== 'PROFILE' || appearance.enabledByPreference)
      ? appearance.reference : null;
    const refId = useAppearance ? (usableReference?.id ?? null) : null;
    const refsToSubmit = displayedReferences.filter(reference => !startPhoto || reference.uri !== startPhoto.uri);
    const hasReferencesArgument = hasControlledReferences || refsToSubmit.length > 0;
    const requestedDescription = hasReferencesArgument && !trimmed ? (anchorIntention.trim().length >= minChars ? anchorIntention.trim() : `A future moment: ${anchorIntention.trim()}`) : trimmed;
    propOnChangeDescription?.(requestedDescription);
    if (hasReferencesArgument) void onSubmit(requestedDescription, photoPath ? null : refId, startPhoto ?? null, refsToSubmit);
    else if (photoPath) void onSubmit(trimmed, null, startPhoto);
    else void onSubmit(trimmed, refId);
  };

  const handleBack = () => {
    fieldRef.current?.stopDictation();
    propOnChangeDescription?.(descriptionRef.current);
    onBack();
  };

  // DEFERRED: the placeholder text. The guidance now sits inside the field under the text; a caller's custom placeholder still wins.
  // const placeholderText = customPlaceholder ?? 'Describe the moment you want to see...';
  const placeholderText = customPlaceholder ?? '';
  // DEFERRED: the kicker / title / subtitle stack.
  // const kicker = isCreate ? 'CREATE YOUR VISION' : 'ADD TO YOUR VISION';
  // const subtitle = isCreate ? 'Bring a moment from your future to life.' : 'Imagine another moment from your future.';
  const title = isCreate ? 'When it\'s true, what do you see?' : 'What else do you see?';
  const compactEmpty = viewportHeight < 820 && displayedReferences.length === 0 && !trimmed && !inputFocused;
  const ctaLabel = 'Create my scene';
  const ctaA11y = isCreate ? 'Continue to create your Vision' : 'Create this scene';
  // DEFERRED: const footnote = 'You’ll choose what belongs in your Vision.';
  const fieldHint = photoPath
    ? (trimmed.length > 0 && trimmed.length < minChars ? 'Add a little more, or clear it to continue with the photo alone.' : 'What changes · what stays · how it feels')
    : hint ?? VISION_FIELD_GUIDANCE;

  // A blocked tap says why: the field still waiting on the person takes a brief wash of gold, and the reason is written beneath it.
  const handleBlockedSubmit = () => {
    v2Haptics.warning();
    inputAttention.pulse();
    if (trimmed.length > maxChars) setLocalNotice(`Shorten the description to ${maxChars} characters.`);
    else if (photoPath) setLocalNotice('Add a little more, or clear it to continue with the photo alone.');
    else setLocalNotice(isCreate
      ? `Describe your moment in at least ${minChars} characters, or add a reference photo.`
      : `Describe the scene in at least ${minChars} characters.`);
  };

  const submit = (focusedState: boolean) => (
    <VisionInkPill
      testID={isCreate ? (focusedState ? 'vision-generate-focused' : 'vision-generate') : (focusedState ? 'vision-scene-generate-focused' : 'vision-scene-generate')}
      label={loading ? 'Starting…' : ctaLabel}
      accessibilityLabel={ctaA11y}
      disabled={!isValid || loading}
      onDisabledPress={loading ? undefined : handleBlockedSubmit}
      onPress={handleSubmit}
    />
  );

  const footer = inputFocused ? (
    <View style={styles.footer}>
      {submit(true)}
    </View>
  ) : (
    <View style={styles.footer}>
      {submit(false)}
      {onAddPhotos ? (
        <Pressable testID="vision-own-photo-link" accessibilityRole="button" accessibilityLabel="Use a photo I already have" disabled={loading}
          hitSlop={6} onPress={() => { Keyboard.dismiss(); setSheet('own-photo'); }} style={[styles.ownPhotoLink, loading && styles.disabled]}>
          <Text style={styles.ownPhotoLinkText}>Use a photo I already have</Text>
        </Pressable>
      ) : null}
      {/* DEFERRED: the two own-photo buttons; the link above opens them as a sheet.
      {onAddPhotos ? (
        <View style={styles.ownPhotoRow}>
          <Pressable testID="vision-add-photos" accessibilityRole="button" accessibilityLabel="Add my own images" disabled={loading}
            onPress={() => onAddPhotos('library')} style={[styles.textAction, loading && styles.disabled]}>
            <Images size={16} color={colors.text.primary} strokeWidth={1.7} />
            <Text style={styles.textActionLabel}>Use my own photos</Text>
          </Pressable>
          <Pressable testID="vision-add-camera" accessibilityRole="button" accessibilityLabel="Take a photo" disabled={loading}
            onPress={() => onAddPhotos('camera')} style={[styles.textAction, loading && styles.disabled]}>
            <Camera size={16} color={colors.text.primary} strokeWidth={1.7} />
            <Text style={styles.textActionLabel}>Take a photo</Text>
          </Pressable>
        </View>
      ) : null}
      DEFERRED: the footnote.
      {(!onAddPhotos || (mode === 'add' && displayedReferences.length > 0)) ? (
        <Text style={[styles.footnote, mode === 'add' && displayedReferences.length > 0 && styles.referenceFootnote]}>
          {mode === 'add' && displayedReferences.length > 0 ? 'Tap a photo to replace or remove it' : footnote}
        </Text>
      ) : null} */}
    </View>
  );

  return (
    <View testID={testID} style={[styles.stage, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <ChartKeyboardFrame
        contentContainerStyle={[styles.content, compactEmpty && { gap: spacing[1] }, { paddingTop: spacing[2] }]}
        footer={footer}
        footerStyle={styles.footerFrame}
        restingBottom={spacing[3]}
      >
        <View style={styles.headerRow}>
          {/* DEFERRED: <View pointerEvents="none" style={styles.kickerSlot}><VisionKicker>{kicker}</VisionKicker></View> */}
          {isCreate ? <View style={styles.intentionChip} testID={`${testID}-anchor`}>
          {anchorArt?.svg || anchorArt?.imageUrl ? (
            <CircularAnchorRenderer
              svg={anchorArt.svg}
              imageUrl={anchorArt.imageUrl ?? undefined}
              category={anchorArt.category ?? anchorCategory}
              expression={anchorArt.expression ?? undefined}
              size={32}
              appearance="paper"
              accessibilityLabel="Anchor artwork"
              testID={`${testID}-anchor-art`}
            />
          ) : null}
          <Text numberOfLines={1} style={styles.intentionText}>{anchorIntention}</Text>
          <View style={[styles.intentionDot, { backgroundColor: categoryColor }]} />
          </View> : null}
          <View style={styles.backOverlay}><VisionBackButton onPress={handleBack} style={styles.back} color={colors.text.primary} /></View>
          {__DEV__ ? <View style={styles.devModelOverlay}><DevImageModelPicker purpose="vision" disabled={loading} tone="paper" compact /></View> : null}
        </View>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {/* DEFERRED: <Animated.Text key={subtitle} entering={content.entering} exiting={content.exiting} style={styles.subtitle}>{subtitle}</Animated.Text> */}
        </View>

        {/* The body beneath the toggle cross-fades as one piece when the path changes: the old fades out, the new follows. Nothing here
            animates layout, so the field never trails its own text while it grows. */}
        <Animated.View key={photoPath ? 'photo-body' : 'words-body'} entering={content.entering} exiting={content.exiting} style={[styles.region, compactEmpty && { gap: spacing[2] }]}>
          <View>
            <AttentionWash level={inputAttention.level} color={VISION_GOLD} radius={radii.lg} />
            {/* DEFERRED: {!inputFocused ? <Text style={styles.fieldLabel}>Describe the moment you want to see</Text> : null} */}
            <VisionSceneField
              handleRef={fieldRef}
              testID={textInputTestID ?? (isCreate ? 'vision-prompt-input' : 'vision-scene-input')}
              accessibilityLabel={isCreate ? 'Vision description' : 'Describe the scene'}
              value={description}
              onChangeText={setDescription}
              maxChars={maxChars}
              placeholder={placeholderText}
              onFocus={handleFieldFocus}
              onBlur={handleFieldBlur}
              hint={fieldHint}
              hintTestID="vision-detail-hint"
              hintStyle={!ceremony && !photoPath && level === 'rich' ? { color: colors.semantic.success } : undefined}
            />
          </View>

          {description.length > COUNTER_VISIBLE_AFTER ? (
            <Text testID="vision-description-counter" style={styles.counterText}>{description.length} / {maxChars}</Text>
          ) : null}

          {/* Sparks: always one horizontally scrolling row under the field. A tap appends on a new line. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            testID={`${testID}-suggestions`} style={styles.sparkScroller} contentContainerStyle={styles.suggestionChips}>
            {SPARK_SUGGESTIONS.map((suggestion, index) => (
              <Pressable key={suggestion} testID={`${testID}-suggestion-${index}`}
                accessibilityRole="button" accessibilityLabel={suggestion} disabled={loading} hitSlop={4}
                onPress={() => handleChipPress(suggestion)}
                style={({ pressed }) => [styles.suggestionChip, pressed && styles.chipPressed, loading && styles.disabled]}>
                <Text style={styles.suggestionChipText}>{suggestion}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {startPhotoEnabled ? (
            <View>
              <AttentionWash level={inputAttention.level} color={VISION_GOLD} />
              <VisionReferenceStrip
                references={displayedReferences}
                onChange={setReferences}
                onNotice={setLocalNotice}
                disabled={loading || (hasControlledReferences && !onChangeReferences)}
                collapsed={inputFocused}
                compact={inputFocused}
                testID={`${testID}-references`}
              />
            </View>
          ) : null}

          {/* DEFERRED: the "Need a spark?" heading, toggle and wrapping chips; the row above replaces them.
          {!inputFocused ? (
            <View style={styles.suggestionGroup}>
              {trimmed.length === 0 ? (
                <Text style={styles.suggestionHeading}>Need a spark?</Text>
              ) : (
                <Pressable testID={`${testID}-suggestions-toggle`} accessibilityRole="button"
                  accessibilityLabel={showSuggestions ? 'Hide suggestions' : 'Need a spark? Show suggestions'}
                  accessibilityState={{ expanded: showSuggestions }} hitSlop={8}
                  onPress={() => setShowSuggestions(value => !value)} style={styles.suggestionToggle}>
                  <Text style={styles.suggestionToggleText}>{showSuggestions ? 'Need a spark?' : 'Need a spark? Show suggestions'}</Text>
                </Pressable>
              )}
              {suggestionsVisible ? (
                <View style={styles.suggestionChips}>
                  {SPARK_SUGGESTIONS.map(suggestion => (
                    <Pressable key={suggestion} testID={`${testID}-suggestion-${SPARK_SUGGESTIONS.indexOf(suggestion)}`}
                      accessibilityRole="button" accessibilityLabel={suggestion} disabled={loading} hitSlop={4}
                      onPress={() => handleChipPress(suggestion)}
                      style={({ pressed }) => [styles.suggestionChip, pressed && styles.chipPressed, loading && styles.disabled]}>
                      <Text style={styles.suggestionChipText}>{suggestion}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null} */}

          {SHOW_APPEARANCE_REFERENCE_CARD && !inputFocused && !photoPath ? (
            <Animated.View key="reference-group" exiting={content.exiting} style={styles.referenceGroup}>
              <View style={styles.divider} />
              <Pressable
                testID={`${testID}-reference-card`}
                onPress={handleReferenceOptions}
                accessibilityRole="button"
                accessibilityLabel="Make it look like you reference photo"
                style={({ pressed }) => [styles.referenceCard, pressed && styles.cardPressed]}
              >
                <UserIcon size={26} color={colors.text.primary} strokeWidth={1.5} />
                <View style={styles.referenceCopy}>
                  <Text style={styles.referenceTitle} numberOfLines={ceremony ? 1 : undefined}>Make it look like you</Text>
                  <Text style={styles.referenceSubtitle}>Optional · Add photos of yourself for more personal images.</Text>
                </View>
                {pickingReference || appearance.saving ? (
                  <ActivityIndicator size="small" color={VISION_GOLD} style={{ marginHorizontal: 12 }} />
                ) : activeReferenceUrl ? (
                  <Image source={{ uri: activeReferenceUrl }} style={styles.referenceThumb} accessibilityLabel="Your reference photo" />
                ) : (
                  <View style={styles.silhouettes} accessible={false}>
                    {[0, 1, 2].map(index => (
                      <View key={index} style={[styles.silhouette, { marginLeft: index === 0 ? 0 : -14 }]}>
                        <UserIcon size={18} color={colors.text.disabled} strokeWidth={1.5} />
                      </View>
                    ))}
                    <View style={styles.plusBadge}><Plus size={14} color={colors.text.primary} /></View>
                  </View>
                )}
                <ChevronRight size={18} color={colors.text.secondary} />
              </Pressable>
            </Animated.View>
          ) : null}
        </Animated.View>

        {(localNotice || error) ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>{localNotice ?? error}</Text>
        ) : null}
      </ChartKeyboardFrame>

      <VisionChoiceSheet
        neutral={false}
        visible={sheet === 'reference'}
        onClose={() => setSheet(null)}
        title="Reference photo"
        subtitle="Replace it, or take it away."
        actions={REFERENCE_ACTIONS}
        onChoose={key => { if (key === 'remove') removeReference(); else void handlePickReferencePhoto(); }}
        testID="vision-reference-sheet"
      />
      {onAddPhotos ? (
        <VisionChoiceSheet
          neutral={false}
          visible={sheet === 'own-photo'}
          onClose={() => setSheet(null)}
          title="Use your own photo"
          subtitle="It goes on the board as it is."
          actions={OWN_PHOTO_ACTIONS}
          onChoose={key => onAddPhotos(key === 'camera' ? 'camera' : 'library')}
          testID="vision-add"
        />
      ) : null}
    </View>
  );
}

const makeStyles = (colors: { canvas: string; surface: string; grouped: string; paper: string; text: { primary: string; secondary: string; tertiary: string }; border: { default: string; strong: string }; ink: { deep: string }; semantic: { error: string } }) => StyleSheet.create({
  stage: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[3] },
  headerRow: { minHeight: 44, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  back: { backgroundColor: 'transparent', borderColor: 'transparent' },
  kickerSlot: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  backOverlay: { position: 'absolute', left: 0, top: 0, minWidth: 44, minHeight: 44, justifyContent: 'center' },
  devModelOverlay: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'flex-start', gap: spacing[3], marginTop: spacing[2], marginBottom: spacing[1] },
  title: { alignSelf: 'stretch', fontFamily: VISION_SERIF, fontSize: 34, lineHeight: 37, letterSpacing: -0.4, textAlign: 'left', color: colors.text.primary },
  subtitle: { alignSelf: 'stretch', fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, textAlign: 'center', color: colors.text.secondary },
  intentionChip: { minHeight: 34, alignSelf: 'center', maxWidth: '72%', flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[3], borderRadius: radii.pill, backgroundColor: colors.grouped, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default },
  intentionText: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.primary, flexShrink: 1 },
  intentionDot: { width: 7, height: 7, borderRadius: 4 },
  fieldLabel: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 20, color: colors.text.primary, marginBottom: spacing[2] },
  pathToggle: { flexDirection: 'row', padding: 3, borderRadius: radii.pill, backgroundColor: colors.grouped, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default },
  pathPill: { position: 'absolute', left: 3, top: 3, bottom: 3, borderRadius: radii.pill, backgroundColor: colors.ink.deep },
  pathOption: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[2], borderRadius: radii.pill },
  pathLabel: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.secondary },
  pathLabelActive: { fontFamily: 'Inter-SemiBold', color: colors.paper },
  photoZone: { height: 208, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surface },
  photoZoneEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: VISION_GOLD },
  photoZoneSet: { borderWidth: 1, borderColor: colors.text.primary },
  photoEmptyWrap: { flex: 1 },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingHorizontal: spacing[4] },
  photoEmptyTitle: { fontFamily: VISION_SERIF, fontSize: 22, lineHeight: 28, color: colors.text.primary, textAlign: 'center' },
  photoEmptySub: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: colors.text.secondary, textAlign: 'center' },
  photoImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  photoActions: { position: 'absolute', right: spacing[2], bottom: spacing[2], flexDirection: 'row', gap: spacing[2] },
  photoAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], borderRadius: radii.pill, backgroundColor: 'rgba(10,15,20,0.72)' },
  photoActionLabel: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 18, color: colors.paper },
  inputFrame: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.text.primary, backgroundColor: colors.surface },
  textInput: { fontFamily: VISION_SERIF_ITALIC, fontSize: 20, lineHeight: 28, color: colors.text.primary, minHeight: 124, maxHeight: 200, padding: spacing[4] },
  region: { gap: spacing[3] },
  referenceGroup: { gap: spacing[3] },
  ownPhotoRow: { flexDirection: 'row', gap: spacing[2] },
  meter: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  meterHint: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.secondary },
  counterText: { alignSelf: 'flex-end', fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.secondary },
  suggestionGroup: { gap: spacing[2] },
  suggestionHeading: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 18, color: colors.text.secondary },
  suggestionToggle: { minHeight: 32, alignSelf: 'flex-start', justifyContent: 'center' },
  suggestionToggleText: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.secondary },
  suggestionChips: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4] },
  sparkScroller: { marginHorizontal: -spacing[4], flexGrow: 0 },
  ownPhotoLink: { minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: spacing[3] },
  ownPhotoLinkText: { fontFamily: 'Inter-Medium', fontSize: 14, lineHeight: 20, color: colors.text.primary, textDecorationLine: 'underline', textDecorationColor: '#C9B98F' },
  suggestionChip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[3], borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(176,138,74,0.65)' },
  suggestionChipText: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.primary },
  chipPressed: { opacity: 0.7 },
  divider: { height: StyleSheet.hairlineWidth * 2, backgroundColor: VISION_GOLD, opacity: 0.5, marginTop: spacing[1] },
  referenceCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: radii.lg,
    backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default,
  },
  cardPressed: { opacity: 0.85 },
  referenceCopy: { flex: 1, gap: 2 },
  referenceTitle: { fontFamily: VISION_SERIF, fontSize: 19, lineHeight: 24, color: colors.text.primary },
  referenceSubtitle: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: colors.text.secondary },
  referenceThumb: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.grouped },
  silhouettes: { flexDirection: 'row', alignItems: 'center' },
  silhouette: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.grouped, borderWidth: 2, borderColor: colors.surface,
  },
  plusBadge: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginLeft: -10, marginTop: 16,
    backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.strong,
  },
  errorText: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.semantic.error },
  footerFrame: { backgroundColor: colors.canvas, paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  footer: { gap: spacing[2] },
  footnote: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, textAlign: 'center', color: colors.text.secondary },
  referenceFootnote: { textDecorationLine: 'underline' },
  textAction: { flex: 1, minHeight: 44, flexDirection: 'row', gap: spacing[2], alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[2], borderWidth: 1, borderColor: colors.border.default, borderRadius: radii.pill, backgroundColor: colors.surface },
  textActionLabel: { flexShrink: 1, fontFamily: 'Inter-SemiBold', fontSize: 12, textAlign: 'center', color: colors.text.primary },
  disabled: { opacity: 0.45 },
});

const paperStyles = { ...makeStyles(paperColors),
};
