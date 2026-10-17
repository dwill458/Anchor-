import { useEffect, useMemo, useRef, useState } from 'react';
import { DevImageModelPicker } from '@/components/dev/DevImageModelPicker';
import { ActivityIndicator, Image, Keyboard, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ChevronRight, Heart, MapPin, Plus, RefreshCw, Sun, Trash2, User as UserIcon } from 'lucide-react-native';
import { visionCeremonyCopy as ceremonyCopy } from './ceremony/visionCeremonyCopy';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { useVisionAppearanceReference } from '@/hooks/v2/vision';
import { ChartKeyboardFrame } from '@/components/v2/chart/ChartKeyboardFrame';
import { AnchorMotion, colors as paperColors, getCategoryColor, radii, spacing } from '@/theme/v2';
import { VisionIdentity, type VisionAnchorArt } from './VisionChrome';
import { VisionChoiceSheet, type VisionChoiceAction } from './VisionChoiceSheet';
import { AttentionWash, useAttention, useVisionContentMotion } from './VisionMotion';
import { VisionReferencePhoto, type VisionStartPhoto } from './VisionReferencePhoto';
import { VisionSceneField, type VisionSceneFieldHandle } from './VisionSceneField';
import { VisionSceneShortcuts } from './VisionSceneShortcuts';
import { VisionBackButton, VisionInkPill, VisionKicker, VISION_GOLD, VISION_SERIF, VISION_SERIF_ITALIC } from './VisionPaperChrome';
import { applySceneSuggestion } from './visionSceneSuggestions';
import { visionCueGuidance, visionDescriptionExample, visionDetailHint, visionDetailLevel, visionTransformCueGuidance, type VisionCueKey, type VisionTransformCueKey } from './visionGuidance';

export type { VisionStartPhoto };

export interface VisionMomentInputProps {
  /** Uses the persistent ceremony ink stage and its top-center Anchor. */
  ceremony?: boolean;
  /** Ceremony only: Describe began from an example print. Shows its thumbnail and the "Make it yours" copy. */
  fromExample?: { image: ImageSourcePropType };
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
  placeholder?: string;
  onBack: () => void;
  /** The start photo is passed only when the person chose "Start from a photo"; the words path calls this with two arguments, as it always has. */
  onSubmit: (description: string, appearanceReferenceId?: string | null, startPhoto?: VisionStartPhoto | null) => Promise<boolean | void> | void;
  /** Shows the optional reference photo surface. Off: the screen is the description alone. */
  startPhotoEnabled?: boolean;
  startPhoto?: VisionStartPhoto | null;
  onChangeStartPhoto?: (photo: VisionStartPhoto | null) => void;
  onAddPhotos?: () => void;
  loading?: boolean;
  error?: string | null;
  testID?: string;
  textInputTestID?: string;
}

/** Three thinking aids, not autocomplete: each asks a question and never touches the description. */
const PROMPT_CHIPS: ReadonlyArray<{ key: VisionCueKey; label: string; icon: typeof MapPin }> = [
  { key: 'where', label: 'Where are you?', icon: MapPin },
  { key: 'doing', label: 'What are you doing?', icon: Sun },
  { key: 'feel', label: 'How does it feel?', icon: Heart },
];

/** The photo path asks about the change to the person's own photo, not for a scene from nothing. */
const PHOTO_CHIPS: ReadonlyArray<{ key: VisionTransformCueKey; label: string; icon: typeof MapPin }> = [
  { key: 'change', label: 'What should change?', icon: Sun },
  { key: 'stays', label: 'What stays the same?', icon: MapPin },
  { key: 'feel', label: 'How does it feel?', icon: Heart },
];

/** Colours the animated styles interpolate between, held as plain strings so no theme object is carried into a worklet. */
const colors = paperColors;
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
  fromExample,
  anchorIntention,
  anchorCategory,
  anchorArt,
  anchorImageUrl,
  initialDescription = '',
  description: propDescription,
  onChangeDescription: propOnChangeDescription,
  placeholder: customPlaceholder,
  onBack,
  onSubmit,
  startPhotoEnabled = false,
  startPhoto: propStartPhoto,
  onChangeStartPhoto,
  onAddPhotos,
  loading = false,
  error = null,
  testID = 'vision-moment-input',
  textInputTestID,
}: VisionMomentInputProps) {
  const insets = useSafeAreaInsets();
  const styles = paperStyles;
  const [internalDescription, setInternalDescription] = useState(initialDescription);
  const description = propDescription !== undefined ? propDescription : internalDescription;
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const setDescription = (text: string) => {
    if (propDescription === undefined) setInternalDescription(text);
    propOnChangeDescription?.(text);
    if (localNotice) setLocalNotice(null);
  };

  const [internalStartPhoto, setInternalStartPhoto] = useState<VisionStartPhoto | null>(null);
  const startPhoto = propStartPhoto !== undefined ? propStartPhoto : internalStartPhoto;
  /** True while a reference photo is attached: the description then says what changes, not a scene from nothing. */
  const photoPath = startPhotoEnabled && Boolean(startPhoto);
  const setStartPhoto = (photo: VisionStartPhoto | null) => {
    if (onChangeStartPhoto) onChangeStartPhoto(photo); else setInternalStartPhoto(photo);
  };
  const fieldRef = useRef<VisionSceneFieldHandle>(null);

  const [inputFocused, setInputFocused] = useState(false);
  const isCreate = mode === 'create';
  const categoryColor = getCategoryColor(anchorCategory);

  const reduceMotion = useV2ReduceMotion();
  const content = useVisionContentMotion();
  const inputAttention = useAttention();
  const [sheet, setSheet] = useState<'reference' | null>(null);

  const minChars = isCreate ? 12 : 6;
  const maxChars = isCreate ? 2000 : 400;

  const example = useMemo(() => visionDescriptionExample(anchorIntention, anchorCategory), [anchorCategory, anchorIntention]);
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
  const isValid = photoPath
    ? Boolean(startPhoto) && (trimmed.length === 0 || (trimmed.length >= minChars && trimmed.length <= maxChars))
    : trimmed.length >= minChars && trimmed.length <= maxChars;

  const [activeCue, setActiveCue] = useState<string | null>(null);
  const cue = useMemo(() => {
    if (!activeCue) return null;
    return photoPath
      ? visionTransformCueGuidance(activeCue as VisionTransformCueKey, anchorIntention)
      : visionCueGuidance(activeCue as VisionCueKey, anchorIntention, anchorCategory);
  }, [activeCue, anchorCategory, anchorIntention, photoPath]);

  const handleChipPress = (key: string) => {
    v2Haptics.selection();
    // Guidance only: a chip never focuses the field, opens the keyboard, or edits the text.
    setActiveCue(key);
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
    if (photoPath) { void onSubmit(trimmed, null, startPhoto); return; }
    const refId = useAppearance ? (appearance.reference?.id ?? null) : null;
    void onSubmit(trimmed, refId);
  };

  const placeholderText = customPlaceholder ?? 'Describe the moment you want to see...';
  const kicker = isCreate ? 'CREATE YOUR VISION' : 'ADD TO YOUR VISION';
  const exampleStart = ceremony && Boolean(fromExample) && !photoPath;
  const title = exampleStart ? ceremonyCopy.makeItYours : isCreate ? 'Create Your First Scene' : 'What else do you see in this future?';
  const subtitle = exampleStart ? ceremonyCopy.makeItYoursSub : photoPath
    ? 'Describe what changes, or leave it blank to continue with your photo.'
    : isCreate ? 'Add a reference photo for a more personal result.' : 'Add a photo, say it, or type it. Then we’ll make your images.';
  const ctaLabel = isCreate ? 'Create My Images' : 'Generate Images';
  const ctaA11y = isCreate ? 'Continue to create your Vision' : 'Generate image';
  const footnote = 'You’ll choose what belongs in your Vision.';

  const chipSet: ReadonlyArray<{ key: string; label: string; icon: typeof MapPin }> = photoPath ? PHOTO_CHIPS : PROMPT_CHIPS;
  const chips = (
    <View style={inputFocused ? styles.chipsAccessory : styles.chipsRow}>
      {chipSet.map(({ key, label, icon: Icon }) => (
        <Pressable key={key} onPress={() => handleChipPress(key)} accessibilityRole="button" accessibilityLabel={label}
          accessibilityState={{ selected: activeCue === key }}
          style={({ pressed }) => [styles.chip, inputFocused && styles.chipAccessory, activeCue === key && styles.chipActive, pressed && styles.chipPressed]}>
          <Icon size={14} color={VISION_GOLD} strokeWidth={1.7} />
          <Text style={styles.chipText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );

  // A blocked tap says why: the field still waiting on the person takes a brief wash of gold.
  const handleBlockedSubmit = () => {
    v2Haptics.warning();
    inputAttention.pulse();
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
      <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accessoryScroll}>{chips}</ScrollView>
      {submit(true)}
    </View>
  ) : (
    <View style={styles.footer}>
      {submit(false)}
      {onAddPhotos ? (
        <Pressable testID="vision-add-photos" accessibilityRole="button" accessibilityLabel="Add my own images" disabled={!isValid}
          onPress={onAddPhotos} style={[styles.textAction, !isValid && styles.disabled]}>
          <Text style={styles.textActionLabel}>Use my own photos instead</Text>
        </Pressable>
      ) : <Text style={styles.footnote}>{footnote}</Text>}
    </View>
  );

  return (
    <View testID={testID} style={styles.stage}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />
      <ChartKeyboardFrame
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (ceremony ? 56 : spacing[2]) }]}
        footer={footer}
        footerStyle={styles.footerFrame}
        restingBottom={spacing[3]}
      >
        <VisionBackButton onPress={onBack} style={[styles.back, ceremony && { position: 'absolute', top: insets.top + 10, left: 18 }, { backgroundColor: 'transparent', borderColor: 'transparent' }]} color={colors.text.primary} />
        <View style={styles.header}>
          {exampleStart ? <View testID="vision-example-thumb" style={styles.exampleThumb}><Image testID="vision-example-thumb-image" source={fromExample!.image} resizeMode="cover" style={styles.exampleThumbImage} accessible={false} /></View> : null}
          {exampleStart ? null : <VisionKicker>{kicker}</VisionKicker>}
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Animated.Text key={subtitle} entering={content.entering} exiting={content.exiting} style={styles.subtitle}>{subtitle}</Animated.Text>
        </View>

        {__DEV__ ? <DevImageModelPicker purpose="vision" disabled={loading} tone="paper" /> : null}
        {!ceremony ? <View style={styles.anchorCard} testID={`${testID}-anchor`}>
          <View style={[styles.accentBar, { backgroundColor: categoryColor }]} />
          <VisionIdentity intention={anchorIntention} category={anchorCategory} art={anchorArt} imageUrl={anchorImageUrl} showAnchor size={58} tone="dark" />
        </View> : null}

        {/* The body beneath the toggle cross-fades as one piece when the path changes: the old fades out, the new follows. Nothing here
            animates layout, so the field never trails its own text while it grows. */}
        <Animated.View key={photoPath ? 'photo-body' : 'words-body'} entering={content.entering} exiting={content.exiting} style={styles.region}>
          {startPhotoEnabled ? (
            <View>
              <AttentionWash level={inputAttention.level} color={VISION_GOLD} />
              <VisionReferencePhoto photo={startPhoto ?? null} onChange={setStartPhoto} onNotice={setLocalNotice} disabled={loading} />
            </View>
          ) : null}

          <View>
            <AttentionWash level={inputAttention.level} color={VISION_GOLD} radius={radii.lg} />
            <VisionSceneField
              handleRef={fieldRef}
              testID={textInputTestID ?? (isCreate ? 'vision-prompt-input' : 'vision-scene-input')}
              accessibilityLabel={isCreate ? 'Vision description' : 'Describe the scene'}
              value={description}
              onChangeText={setDescription}
              maxChars={maxChars}
              placeholder={placeholderText}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
            />
          </View>

          {exampleStart ? <Text testID="vision-example-note" style={styles.exampleNote}>{ceremonyCopy.fromExample}</Text> : null}

          {isCreate && !trimmed && !photoPath ? (
            <Animated.View key="suggestion" exiting={content.exiting} style={styles.suggestionWrap}>
              <Pressable
                testID="vision-use-suggested-description"
                accessibilityRole="button"
                accessibilityLabel="Use suggested description"
                accessibilityHint="Fills the example from your Anchor. You can edit it before creating images."
                disabled={loading}
                onPress={() => { v2Haptics.selection(); setDescription(example); }}
                style={({ pressed }) => [styles.suggestionAction, pressed && styles.chipPressed, loading && styles.disabled]}
              >
                <Text style={styles.suggestionLabel}>Use suggested description</Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {cue ? (
            <Animated.View key="vision-cue" testID="vision-cue" accessibilityLiveRegion="polite" entering={content.entering} exiting={content.exiting} style={styles.cue}>
              <Animated.View key={activeCue ?? 'cue'} entering={content.entering} style={styles.cueBody}>
                <Text style={styles.cueQuestion}>{cue.question}</Text>
                {cue.hint ? <Text style={styles.cueHint}>{cue.hint}</Text> : null}
              </Animated.View>
            </Animated.View>
          ) : null}

          <View style={styles.meter}>
            <Text testID="vision-detail-hint" style={[styles.meterHint, !ceremony && !photoPath && level === 'rich' && { color: colors.semantic.success }]} numberOfLines={2}>
              {photoPath
                ? (trimmed.length > 0 && trimmed.length < minChars ? 'Add a little more, or clear it to continue with the photo alone.' : 'What changes · what stays · how it feels')
                : hint ?? 'Where you are · what you’re doing · how it feels'}
            </Text>
            <Text style={styles.counterText}>{description.length} / {maxChars}</Text>
          </View>

          {!isCreate ? <VisionSceneShortcuts goal={anchorIntention} text={description} onPick={suggestion => setDescription(applySceneSuggestion(description, suggestion))} disabled={loading} /> : null}

          {!inputFocused ? chips : null}

          {!inputFocused && !photoPath ? (
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
    </View>
  );
}

const makeStyles = (colors: { canvas: string; surface: string; grouped: string; paper: string; text: { primary: string; secondary: string; tertiary: string }; border: { default: string; strong: string }; ink: { deep: string }; semantic: { error: string } }) => StyleSheet.create({
  stage: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[3] },
  back: { alignSelf: 'flex-start' },
  header: { alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[2], marginBottom: spacing[1] },
  title: { alignSelf: 'stretch', fontFamily: VISION_SERIF, fontSize: 35, lineHeight: 39, letterSpacing: -0.7, textAlign: 'center', color: colors.text.primary },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 21, textAlign: 'center', color: colors.text.secondary, maxWidth: 300 },
  anchorCard: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[3], paddingRight: spacing[4], paddingLeft: spacing[5],
    borderRadius: radii.md, backgroundColor: colors.grouped, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default, overflow: 'hidden',
  },
  accentBar: { position: 'absolute', left: spacing[3], top: spacing[3], bottom: spacing[3], width: 3, borderRadius: 2 },
  region: { gap: spacing[3] },
  suggestionWrap: { alignSelf: 'flex-start' },
  referenceGroup: { gap: spacing[3] },
  cueBody: { gap: 2 },
  suggestionAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  suggestionLabel: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.primary, textDecorationLine: 'underline' },
  meter: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  meterHint: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.secondary },
  counterText: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.secondary },
  chipsRow: { flexDirection: 'row', gap: spacing[2] },
  chipsAccessory: { flexDirection: 'row', gap: spacing[2] },
  accessoryScroll: { paddingBottom: spacing[1] },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 44, paddingHorizontal: 4, borderRadius: radii.pill,
    backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default,
  },
  chipAccessory: { flex: 0, paddingHorizontal: spacing[3] },
  chipPressed: { opacity: 0.7 },
  chipActive: { borderColor: VISION_GOLD, backgroundColor: colors.grouped },
  cue: { gap: 2, paddingLeft: spacing[3], borderLeftWidth: 2, borderLeftColor: VISION_GOLD },
  cueQuestion: { fontFamily: VISION_SERIF_ITALIC, fontSize: 16, lineHeight: 22, color: colors.text.primary },
  cueHint: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: colors.text.secondary },
  chipText: { fontFamily: 'Inter-Regular', fontSize: 10.5, lineHeight: 15, color: colors.text.primary, flexShrink: 1 },
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
  textAction: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  textActionLabel: { fontFamily: 'Inter-Regular', fontSize: 13, color: colors.text.secondary, textDecorationLine: 'underline' },
  disabled: { opacity: 0.45 },
});

const paperStyles = { ...makeStyles(paperColors),
  exampleThumb: { width: 120, height: 150, padding: 6, paddingBottom: 22, borderRadius: 3, backgroundColor: '#F7F1E6', transform: [{ rotate: '-2deg' }],
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  exampleThumbImage: { width: '100%' as const, height: '100%' as const, backgroundColor: colors.grouped },
  exampleNote: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: colors.text.secondary },
};
