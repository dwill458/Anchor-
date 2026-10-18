import type { TextInputInstance } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DevImageModelPicker } from '@/components/dev/DevImageModelPicker';
import { ActivityIndicator, Image, Keyboard, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ChevronRight, Heart, Images, MapPin, Plus, RefreshCw, Sun, Trash2, User as UserIcon } from 'lucide-react-native';
import { visionCeremonyCopy as ceremonyCopy } from './ceremony/visionCeremonyCopy';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { pickVisionPhoto, useVisionAppearanceReference, type VisionPhotoSource } from '@/hooks/v2/vision';
import { ChartKeyboardFrame } from '@/components/v2/chart/ChartKeyboardFrame';
import { AnchorMotion, colors as paperColors, getCategoryColor, radii, spacing } from '@/theme/v2';
import { VisionIdentity, type VisionAnchorArt } from './VisionChrome';
import { VisionChoiceSheet, type VisionChoiceAction } from './VisionChoiceSheet';
import { AttentionWash, VISION_PHOTO_ACTIONS_IN, VISION_PHOTO_ARRIVE, useAttention, useVisionContentMotion } from './VisionMotion';
import { VisionBackButton, VisionInkPill, VisionKicker, VISION_GOLD, VISION_SERIF, VISION_SERIF_ITALIC } from './VisionPaperChrome';
import { visionCueGuidance, visionDescriptionExample, visionDetailHint, visionDetailLevel, visionTransformCueGuidance, type VisionCueKey, type VisionTransformCueKey } from './visionGuidance';

/** The photo of the person's real world today that a photo-first Vision starts from. Not uploaded until they continue. */
export type VisionStartPhoto = { uri: string; mimeType: string };
export type VisionInputPath = 'photo' | 'words';

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
  /** Offers "Start from a photo" (the default path) next to "Imagine from words". Off: the screen is the words screen alone. */
  startPhotoEnabled?: boolean;
  startPhoto?: VisionStartPhoto | null;
  onChangeStartPhoto?: (photo: VisionStartPhoto | null) => void;
  inputPath?: VisionInputPath;
  onChangeInputPath?: (path: VisionInputPath) => void;
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
const PATH_LABEL_ON = colors.paper;
const PATH_LABEL_OFF = colors.text.secondary;
const FIELD_REST = colors.text.primary;

/** Photo source choice in 2.0 bottom sheet. */
const PHOTO_SOURCE_ACTIONS: ReadonlyArray<VisionChoiceAction> = [
  { key: 'camera', label: 'Take a photo', detail: 'Capture where you are right now', Icon: Camera },
  { key: 'library', label: 'Choose from library', detail: 'Use a photo you already have', Icon: Images },
];
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
  inputPath: propInputPath,
  onChangeInputPath,
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

  const [internalPath, setInternalPath] = useState<VisionInputPath>('photo');
  const [internalStartPhoto, setInternalStartPhoto] = useState<VisionStartPhoto | null>(null);
  const inputPath = propInputPath ?? internalPath;
  const startPhoto = propStartPhoto !== undefined ? propStartPhoto : internalStartPhoto;
  const photoPath = startPhotoEnabled && inputPath === 'photo';
  const setStartPhoto = (photo: VisionStartPhoto | null) => {
    if (onChangeStartPhoto) onChangeStartPhoto(photo); else setInternalStartPhoto(photo);
  };

  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<TextInputInstance>(null);
  const isCreate = mode === 'create';
  const categoryColor = getCategoryColor(anchorCategory);

  const reduceMotion = useV2ReduceMotion();
  const content = useVisionContentMotion();
  const photoAttention = useAttention();
  const inputAttention = useAttention();
  const [sheet, setSheet] = useState<'photo' | 'reference' | null>(null);

  // The path toggle's ink pill travels between its two stops; each label changes colour with it.
  const [toggleWidth, setToggleWidth] = useState(0);
  const pathProgress = useSharedValue(inputPath === 'words' ? 1 : 0);
  useEffect(() => {
    const target = inputPath === 'words' ? 1 : 0;
    pathProgress.value = reduceMotion
      ? withTiming(target, { duration: AnchorMotion.duration.quick })
      : withSpring(target, AnchorMotion.spring.snap);
  }, [inputPath, pathProgress, reduceMotion]);
  const optionWidth = Math.max(0, (toggleWidth - 6 - StyleSheet.hairlineWidth * 2) / 2);
  const pathPillStyle = useAnimatedStyle(() => ({ width: optionWidth, transform: [{ translateX: pathProgress.value * optionWidth }] }));
  const photoLabelStyle = useAnimatedStyle(() => ({ color: interpolateColor(pathProgress.value, [0, 1], [PATH_LABEL_ON, PATH_LABEL_OFF]) }));
  const wordsLabelStyle = useAnimatedStyle(() => ({ color: interpolateColor(pathProgress.value, [0, 1], [PATH_LABEL_OFF, PATH_LABEL_ON]) }));

  // The description frame warms from ink to gold as it takes focus.
  const focus = useSharedValue(0);
  useEffect(() => {
    focus.value = withTiming(inputFocused ? 1 : 0, { duration: AnchorMotion.duration.quick, easing: AnchorMotion.easing.standard });
  }, [focus, inputFocused]);
  const inputFrameStyle = useAnimatedStyle(() => ({ borderColor: interpolateColor(focus.value, [0, 1], [FIELD_REST, VISION_GOLD]) }));

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

  const choosePath = (next: VisionInputPath) => {
    if (next === inputPath) return;
    v2Haptics.selection();
    // The body (and its field) is replaced, so the keyboard goes with it.
    Keyboard.dismiss();
    setInputFocused(false);
    setActiveCue(null);
    setLocalNotice(null);
    if (onChangeInputPath) onChangeInputPath(next); else setInternalPath(next);
  };

  const takeOrChoosePhoto = async (source: VisionPhotoSource) => {
    // Quality 0.6: the server accepts 5 MB per photo and a phone original at 0.85 can pass that. A start photo needs the place, not the pixels.
    const result = await pickVisionPhoto(source, 0.6);
    if (result.status === 'picked') { setStartPhoto({ uri: result.photo.uri, mimeType: result.photo.mimeType }); setLocalNotice(null); }
    else if (result.status === 'denied' || result.status === 'error') setLocalNotice(result.message);
  };

  const handlePhotoOptions = () => {
    v2Haptics.selection();
    setSheet('photo');
  };

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
    Keyboard.dismiss();
    if (photoPath) { void onSubmit(trimmed, null, startPhoto); return; }
    const refId = useAppearance ? (appearance.reference?.id ?? null) : null;
    void onSubmit(trimmed, refId);
  };

  const placeholderText = customPlaceholder ?? (photoPath ? 'Describe how it changes...' : isCreate ? example : 'Describe the moment in detail...');
  const kicker = isCreate ? 'CREATE YOUR VISION' : 'ADD TO YOUR VISION';
  const exampleStart = ceremony && Boolean(fromExample) && !photoPath;
  const title = exampleStart ? ceremonyCopy.makeItYours : isCreate ? "Describe the moment it's already true." : 'Describe another moment from this future.';
  const subtitle = exampleStart ? ceremonyCopy.makeItYoursSub : photoPath
    ? 'Show the world as it is now, then describe how it changes.'
    : ceremony ? 'Present tense. Where you are, what you’re doing, how it feels.'
      : isCreate ? 'Describe the moment you want to see for this Anchor.' : 'Describe another moment from this future.';
  const ctaLabel = 'Create my images';
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
    if (photoPath && !startPhoto) photoAttention.pulse(); else inputAttention.pulse();
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
      <StatusBar barStyle="dark-content" />
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
        {startPhotoEnabled ? (
          <View style={styles.pathToggle} accessibilityRole="tablist" onLayout={event => setToggleWidth(event.nativeEvent.layout.width)}>
            <Animated.View pointerEvents="none" style={[styles.pathPill, pathPillStyle]} />
            {([['photo', 'Start from a photo', photoLabelStyle], ['words', 'Imagine from words', wordsLabelStyle]] as const).map(([key, label, labelStyle]) => (
              <Pressable
                key={key}
                testID={`vision-path-${key}`}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: inputPath === key }}
                onPress={() => choosePath(key)}
                style={styles.pathOption}
              >
                <Animated.Text style={[styles.pathLabel, inputPath === key && styles.pathLabelActive, labelStyle]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Animated.Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!ceremony ? <View style={styles.anchorCard} testID={`${testID}-anchor`}>
          <View style={[styles.accentBar, { backgroundColor: categoryColor }]} />
          <VisionIdentity intention={anchorIntention} category={anchorCategory} art={anchorArt} imageUrl={anchorImageUrl} showAnchor size={58} tone="dark" />
        </View> : null}

        {/* The body beneath the toggle cross-fades as one piece when the path changes: the old fades out, the new follows. Nothing here
            animates layout, so the field never trails its own text while it grows. */}
        <Animated.View key={photoPath ? 'photo-body' : 'words-body'} entering={content.entering} exiting={content.exiting} style={styles.region}>
          {photoPath ? (
            <View testID="vision-start-photo" style={[styles.photoZone, startPhoto ? styles.photoZoneSet : styles.photoZoneEmpty]}>
              <AttentionWash level={photoAttention.level} color={VISION_GOLD} />
              {startPhoto ? (
                <>
                  <Animated.Image entering={reduceMotion ? content.entering : VISION_PHOTO_ARRIVE} source={{ uri: startPhoto.uri }} style={styles.photoImage} resizeMode="cover" resizeMethod="resize" accessibilityLabel="Your photo of the world as it is now" />
                  <Animated.View entering={VISION_PHOTO_ACTIONS_IN} style={styles.photoActions}>
                    <Pressable testID="vision-start-photo-replace" accessibilityRole="button" accessibilityLabel="Replace photo" onPress={handlePhotoOptions} style={styles.photoAction}>
                      <RefreshCw size={14} color={colors.paper} strokeWidth={1.8} />
                      <Text style={styles.photoActionLabel}>Replace</Text>
                    </Pressable>
                    <Pressable testID="vision-start-photo-remove" accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => { v2Haptics.selection(); setStartPhoto(null); }} style={styles.photoAction}>
                      <Trash2 size={14} color={colors.paper} strokeWidth={1.8} />
                      <Text style={styles.photoActionLabel}>Remove</Text>
                    </Pressable>
                  </Animated.View>
                </>
              ) : (
                <Animated.View key="photo-empty" exiting={content.exiting} style={styles.photoEmptyWrap}>
                  <Pressable testID="vision-start-photo-pick" accessibilityRole="button" accessibilityLabel="Take or choose a photo of the world as it is now" onPress={handlePhotoOptions}
                    style={({ pressed }) => [styles.photoEmpty, pressed && styles.cardPressed]}>
                    <Camera size={30} color={VISION_GOLD} strokeWidth={1.4} />
                    <Text style={styles.photoEmptyTitle}>Take or choose a photo</Text>
                    <Text style={styles.photoEmptySub}>Show the world as it is now</Text>
                  </Pressable>
                </Animated.View>
              )}
            </View>
          ) : null}

          <Animated.View style={[styles.inputFrame, inputFrameStyle]}>
            <AttentionWash level={inputAttention.level} color={VISION_GOLD} radius={radii.lg} />
            <TextInput
              ref={inputRef}
              testID={textInputTestID ?? (isCreate ? 'vision-prompt-input' : 'vision-scene-input')}
              accessibilityLabel={isCreate ? 'Vision description' : 'Describe the scene'}
              accessibilityHint="Describe one ordinary moment from this future."
              multiline
              maxLength={maxChars}
              value={description}
              onChangeText={setDescription}
              placeholder={placeholderText}
              placeholderTextColor="rgba(23,23,23,0.42)"
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              style={styles.textInput}
              textAlignVertical="top"
              scrollEnabled
            />
          </Animated.View>

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
        visible={sheet === 'photo'}
        onClose={() => setSheet(null)}
        title="Your photo"
        subtitle="Show the world as it is now."
        actions={PHOTO_SOURCE_ACTIONS}
        onChoose={key => void takeOrChoosePhoto(key === 'camera' ? 'camera' : 'library')}
        testID="vision-photo-source-sheet"
      />
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
