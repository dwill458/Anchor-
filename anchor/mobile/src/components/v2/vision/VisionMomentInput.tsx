import { useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Image, Keyboard, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ChevronRight, Heart, MapPin, Plus, RefreshCw, Sun, Trash2, User as UserIcon } from 'lucide-react-native';
import { v2Haptics } from '@/hooks/v2';
import { pickVisionPhoto, useVisionAppearanceReference, type VisionPhotoSource } from '@/hooks/v2/vision';
import { ChartKeyboardFrame } from '@/components/v2/chart/ChartKeyboardFrame';
import { colors, getCategoryColor, radii, spacing } from '@/theme/v2';
import { VisionIdentity, type VisionAnchorArt } from './VisionChrome';
import { VisionBackButton, VisionInkPill, VisionKicker, VISION_GOLD, VISION_SERIF, VISION_SERIF_ITALIC } from './VisionPaperChrome';
import { visionCueGuidance, visionDescriptionExample, visionDetailHint, visionDetailLevel, visionTransformCueGuidance, type VisionCueKey, type VisionTransformCueKey } from './visionGuidance';

/** The photo of the person's real world today that a photo-first Vision starts from. Not uploaded until they continue. */
export type VisionStartPhoto = { uri: string; mimeType: string };
export type VisionInputPath = 'photo' | 'words';

export interface VisionMomentInputProps {
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

/**
 * Screen 3: "What do you see?" It should read as authorship on paper, not as
 * an AI settings form. The real Anchor, the person's intention, one field,
 * three prompts, an optional identity reference, one action.
 */
export function VisionMomentInput({
  mode,
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
  const [internalDescription, setInternalDescription] = useState(initialDescription);
  const description = propDescription !== undefined ? propDescription : internalDescription;
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const setDescription = (text: string) => {
    if (propOnChangeDescription) propOnChangeDescription(text);
    else setInternalDescription(text);
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
  const inputRef = useRef<TextInput>(null);
  const isCreate = mode === 'create';
  const categoryColor = getCategoryColor(anchorCategory);

  const minChars = isCreate ? 12 : 6;
  const maxChars = isCreate ? 2000 : 400;

  const example = useMemo(() => visionDescriptionExample(anchorIntention, anchorCategory), [anchorCategory, anchorIntention]);
  const hint = visionDetailHint(description);
  const level = visionDetailLevel(description);

  const appearance = useVisionAppearanceReference();
  const [useAppearance, setUseAppearance] = useState(true);
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
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take a photo', 'Choose from library'], cancelButtonIndex: 0 },
        buttonIndex => { if (buttonIndex === 1) void takeOrChoosePhoto('camera'); else if (buttonIndex === 2) void takeOrChoosePhoto('library'); },
      );
    } else {
      Alert.alert('Your photo', 'Show the world as it is now.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Choose from library', onPress: () => void takeOrChoosePhoto('library') },
        { text: 'Take a photo', onPress: () => void takeOrChoosePhoto('camera') },
      ]);
    }
  };

  const handleChipPress = (key: string) => {
    v2Haptics.selection();
    // Guidance only: a chip never focuses the field, opens the keyboard, or edits the text.
    setActiveCue(key);
  };

  const handlePickReferencePhoto = async () => {
    try {
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') { setLocalNotice('Allow photo library access to add a reference photo.'); return; }
      }
      // Quality 0.7: a reference only needs the face and build, and a phone original would be several MB of base64.
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: false, legacy: true });
      const item = result.assets?.[0];
      if (result.canceled || !item) return;
      let failure: string | null = null;
      const next = await appearance.upload(item.uri, 'CUSTOM', item.mimeType, message => { failure = message; });
      if (!next) { setLocalNotice(failure ?? 'The photo could not be used as a reference.'); return; }
      setUseAppearance(true);
      setLocalNotice(null);
    } catch {
      setLocalNotice('Unable to open photo library.');
    }
  };

  const removeReference = () => { void appearance.remove(); setUseAppearance(false); };
  const handleReferenceOptions = () => {
    if (!activeReferenceUrl) { void handlePickReferencePhoto(); return; }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Change Reference Photo', 'Remove Reference Photo'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
        buttonIndex => { if (buttonIndex === 1) void handlePickReferencePhoto(); else if (buttonIndex === 2) removeReference(); },
      );
    } else {
      Alert.alert('Reference Photo', 'Would you like to replace or remove this reference photo?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: removeReference },
        { text: 'Change Photo', onPress: () => void handlePickReferencePhoto() },
      ]);
    }
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
  const title = isCreate ? 'What do you see?' : 'What else do you see?';
  const subtitle = photoPath
    ? 'Show the world as it is now, then describe how it changes.'
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

  const submit = (focusedState: boolean) => (
    <VisionInkPill
      testID={isCreate ? (focusedState ? 'vision-generate-focused' : 'vision-generate') : (focusedState ? 'vision-scene-generate-focused' : 'vision-scene-generate')}
      label={loading ? 'Starting…' : ctaLabel}
      accessibilityLabel={ctaA11y}
      disabled={!isValid || loading}
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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[2] }]}
        footer={footer}
        footerStyle={styles.footerFrame}
        restingBottom={spacing[3]}
      >
        <VisionBackButton onPress={onBack} style={styles.back} />
        <View style={styles.header}>
          <VisionKicker>{kicker}</VisionKicker>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {startPhotoEnabled ? (
          <View style={styles.pathToggle} accessibilityRole="tablist">
            {([['photo', 'Start from a photo'], ['words', 'Imagine from words']] as const).map(([key, label]) => (
              <Pressable
                key={key}
                testID={`vision-path-${key}`}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: inputPath === key }}
                onPress={() => choosePath(key)}
                style={[styles.pathOption, inputPath === key && styles.pathOptionActive]}
              >
                <Text style={[styles.pathLabel, inputPath === key && styles.pathLabelActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.anchorCard} testID={`${testID}-anchor`}>
          <View style={[styles.accentBar, { backgroundColor: categoryColor }]} />
          <VisionIdentity intention={anchorIntention} category={anchorCategory} art={anchorArt} imageUrl={anchorImageUrl} showAnchor size={58} tone="dark" />
        </View>

        {photoPath ? (
          <View testID="vision-start-photo" style={[styles.photoZone, startPhoto ? styles.photoZoneSet : styles.photoZoneEmpty]}>
            {startPhoto ? (
              <>
                <Image source={{ uri: startPhoto.uri }} style={styles.photoImage} resizeMode="cover" resizeMethod="resize" accessibilityLabel="Your photo of the world as it is now" />
                <View style={styles.photoActions}>
                  <Pressable testID="vision-start-photo-replace" accessibilityRole="button" accessibilityLabel="Replace photo" onPress={handlePhotoOptions} style={styles.photoAction}>
                    <RefreshCw size={14} color={colors.paper} strokeWidth={1.8} />
                    <Text style={styles.photoActionLabel}>Replace</Text>
                  </Pressable>
                  <Pressable testID="vision-start-photo-remove" accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => { v2Haptics.selection(); setStartPhoto(null); }} style={styles.photoAction}>
                    <Trash2 size={14} color={colors.paper} strokeWidth={1.8} />
                    <Text style={styles.photoActionLabel}>Remove</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Pressable testID="vision-start-photo-pick" accessibilityRole="button" accessibilityLabel="Take or choose a photo of the world as it is now" onPress={handlePhotoOptions}
                style={({ pressed }) => [styles.photoEmpty, pressed && styles.cardPressed]}>
                <Camera size={30} color={VISION_GOLD} strokeWidth={1.4} />
                <Text style={styles.photoEmptyTitle}>Take or choose a photo</Text>
                <Text style={styles.photoEmptySub}>Show the world as it is now</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        <View style={[styles.inputFrame, inputFocused && styles.inputFrameFocused]}>
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
        </View>

        {isCreate && !trimmed && !photoPath ? (
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
        ) : null}

        {cue ? (
          <View testID="vision-cue" accessibilityLiveRegion="polite" style={styles.cue}>
            <Text style={styles.cueQuestion}>{cue.question}</Text>
            {cue.hint ? <Text style={styles.cueHint}>{cue.hint}</Text> : null}
          </View>
        ) : null}

        <View style={styles.meter}>
          <Text testID="vision-detail-hint" style={[styles.meterHint, !photoPath && level === 'rich' && { color: colors.semantic.success }]} numberOfLines={2}>
            {photoPath
              ? (trimmed.length > 0 && trimmed.length < minChars ? 'Add a little more, or clear it to continue with the photo alone.' : 'What changes · what stays · how it feels')
              : hint ?? 'Where you are · what you’re doing · how it feels'}
          </Text>
          <Text style={styles.counterText}>{description.length} / {maxChars}</Text>
        </View>

        {!inputFocused ? chips : null}

        {!inputFocused && !photoPath ? (
          <>
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
                <Text style={styles.referenceTitle}>Make it look like you</Text>
                <Text style={styles.referenceSubtitle}>Optional · Add photos of yourself for more personal images.</Text>
              </View>
              {activeReferenceUrl ? (
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
          </>
        ) : null}

        {(localNotice || error) ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>{localNotice ?? error}</Text>
        ) : null}
      </ChartKeyboardFrame>
    </View>
  );
}

const styles = StyleSheet.create({
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
  pathOption: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[2], borderRadius: radii.pill },
  pathOptionActive: { backgroundColor: colors.ink.deep },
  pathLabel: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.secondary },
  pathLabelActive: { fontFamily: 'Inter-SemiBold', color: colors.paper },
  photoZone: { height: 208, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surface },
  photoZoneEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: VISION_GOLD },
  photoZoneSet: { borderWidth: 1, borderColor: colors.text.primary },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingHorizontal: spacing[4] },
  photoEmptyTitle: { fontFamily: VISION_SERIF, fontSize: 22, lineHeight: 28, color: colors.text.primary, textAlign: 'center' },
  photoEmptySub: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: colors.text.secondary, textAlign: 'center' },
  photoImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  photoActions: { position: 'absolute', right: spacing[2], bottom: spacing[2], flexDirection: 'row', gap: spacing[2] },
  photoAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], borderRadius: radii.pill, backgroundColor: 'rgba(10,15,20,0.72)' },
  photoActionLabel: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 18, color: colors.paper },
  inputFrame: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.text.primary, backgroundColor: colors.surface },
  inputFrameFocused: { borderColor: VISION_GOLD },
  textInput: { fontFamily: VISION_SERIF_ITALIC, fontSize: 20, lineHeight: 28, color: colors.text.primary, minHeight: 124, maxHeight: 200, padding: spacing[4] },
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
