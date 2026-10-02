import { useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Image, Keyboard, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ChevronRight, Heart, MapPin, Plus, Sun, User as UserIcon } from 'lucide-react-native';
import { v2Haptics } from '@/hooks/v2';
import { useVisionAppearanceReference } from '@/hooks/v2/vision';
import { ChartKeyboardFrame } from '@/components/v2/chart/ChartKeyboardFrame';
import { colors, getCategoryColor, radii, spacing } from '@/theme/v2';
import { VisionIdentity, type VisionAnchorArt } from './VisionChrome';
import { VisionBackButton, VisionInkPill, VisionKicker, VISION_GOLD, VISION_SERIF, VISION_SERIF_ITALIC } from './VisionPaperChrome';
import { visionCueGuidance, visionDescriptionExample, visionDetailHint, visionDetailLevel, type VisionCueKey } from './visionGuidance';

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
  onSubmit: (description: string, appearanceReferenceId?: string | null) => Promise<boolean | void> | void;
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
  const isValid = trimmed.length >= minChars && trimmed.length <= maxChars;

  const [activeCue, setActiveCue] = useState<VisionCueKey | null>(null);
  const cue = useMemo(() => (activeCue ? visionCueGuidance(activeCue, anchorIntention, anchorCategory) : null), [activeCue, anchorCategory, anchorIntention]);

  const handleChipPress = (key: VisionCueKey) => {
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
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: false });
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
    const refId = useAppearance ? (appearance.reference?.id ?? null) : null;
    void onSubmit(trimmed, refId);
  };

  const placeholderText = customPlaceholder ?? (isCreate ? example : 'Describe the moment in detail...');
  const kicker = isCreate ? 'CREATE YOUR VISION' : 'ADD TO YOUR VISION';
  const title = isCreate ? 'What do you see?' : 'What else do you see?';
  const subtitle = isCreate ? 'Describe the moment you want to see for this Anchor.' : 'Describe another moment from this future.';
  const ctaLabel = 'Create my images';
  const ctaA11y = isCreate ? 'Continue to create your Vision' : 'Generate image';
  const footnote = 'You’ll choose what belongs in your Vision.';

  const chips = (
    <View style={inputFocused ? styles.chipsAccessory : styles.chipsRow}>
      {PROMPT_CHIPS.map(({ key, label, icon: Icon }) => (
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

        <View style={styles.anchorCard} testID={`${testID}-anchor`}>
          <View style={[styles.accentBar, { backgroundColor: categoryColor }]} />
          <VisionIdentity intention={anchorIntention} category={anchorCategory} art={anchorArt} imageUrl={anchorImageUrl} showAnchor size={58} tone="dark" />
        </View>

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

        {cue ? (
          <View testID="vision-cue" accessibilityLiveRegion="polite" style={styles.cue}>
            <Text style={styles.cueQuestion}>{cue.question}</Text>
            {cue.hint ? <Text style={styles.cueHint}>{cue.hint}</Text> : null}
          </View>
        ) : null}

        <View style={styles.meter}>
          <Text testID="vision-detail-hint" style={[styles.meterHint, level === 'rich' && { color: colors.semantic.success }]} numberOfLines={2}>
            {hint ?? 'Where you are · what you’re doing · how it feels'}
          </Text>
          <Text style={styles.counterText}>{description.length} / {maxChars}</Text>
        </View>

        {!inputFocused ? chips : null}

        {!inputFocused ? (
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
  inputFrame: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.text.primary, backgroundColor: colors.surface },
  inputFrameFocused: { borderColor: VISION_GOLD },
  textInput: { fontFamily: VISION_SERIF_ITALIC, fontSize: 20, lineHeight: 28, color: colors.text.primary, minHeight: 124, maxHeight: 200, padding: spacing[4] },
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
