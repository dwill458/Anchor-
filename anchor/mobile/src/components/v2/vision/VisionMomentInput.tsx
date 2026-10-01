import { useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Compass, Eye, Image as ImageIcon, MapPin, PenLine, User as UserIcon, ChevronRight } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { useVisionAppearanceReference } from '@/hooks/v2/vision';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { VisionHeaderRow, VisionIdentity, VisionStatusBarScrim, type VisionAnchorArt } from './VisionChrome';
import { VisionImageEdge } from './VisionImageEdge';
import { VISION_HERO_ASPECT } from './board/visionBoardLayouts';

import { visionDescriptionExample, visionDetailHint, visionDetailLevel } from './visionGuidance';

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

const PROMPT_CHIPS = [
  { key: 'where', label: 'Where are you?', icon: MapPin, cue: 'Where are you? ' },
  { key: 'doing', label: 'What are you doing?', icon: PenLine, cue: 'What are you doing? ' },
  { key: 'see', label: 'What can you see?', icon: Eye, cue: 'What can you see? ' },
  { key: 'different', label: "What's different?", icon: Compass, cue: "What's different? " },
] as const;

export function VisionMomentInput({
  mode,
  anchorId,
  anchorIntention,
  anchorCategory,
  anchorArt,
  anchorImageUrl,
  previewImageUrl,
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
  const { height } = useWindowDimensions();
  const reduceMotion = useV2ReduceMotion();
  const [internalDescription, setInternalDescription] = useState(initialDescription);
  const description = propDescription !== undefined ? propDescription : internalDescription;
  const setDescription = (text: string) => {
    if (propOnChangeDescription) {
      propOnChangeDescription(text);
    } else {
      setInternalDescription(text);
    }
    if (localNotice) setLocalNotice(null);
  };

  const [inputFocused, setInputFocused] = useState(false);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const isCreate = mode === 'create';

  const minChars = isCreate ? 12 : 6;
  const maxChars = isCreate ? 2000 : 400;

  const example = useMemo(
    () => visionDescriptionExample(anchorIntention, anchorCategory),
    [anchorCategory, anchorIntention],
  );
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

  const handleChipPress = (cue: string) => {
    v2Haptics.selection();
    inputRef.current?.focus();
    if (!description.includes(cue.trim())) {
      const spacer = description.length > 0 && !description.endsWith(' ') && !description.endsWith('\n') ? ' ' : '';
      setDescription(`${description}${spacer}${cue}`);
    }
  };

  const handlePickReferencePhoto = async () => {
    try {
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
          setLocalNotice('Allow photo library access to add a reference photo.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: false,
      });
      const item = result.assets?.[0];
      if (result.canceled || !item) return;

      const next = await appearance.upload(item.uri, 'CUSTOM');
      if (!next) {
        setLocalNotice('Photo could not be used as a reference. Choose a clear photo of one person.');
        return;
      }
      setUseAppearance(true);
      setLocalNotice(null);
    } catch {
      setLocalNotice('Unable to open photo library.');
    }
  };

  const handleReferenceOptions = () => {
    if (!activeReferenceUrl) {
      void handlePickReferencePhoto();
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Change Reference Photo', 'Remove Reference Photo'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        buttonIndex => {
          if (buttonIndex === 1) void handlePickReferencePhoto();
          else if (buttonIndex === 2) {
            void appearance.remove();
            setUseAppearance(false);
          }
        },
      );
    } else {
      Alert.alert(
        'Reference Photo',
        'Would you like to replace or remove this reference photo?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              void appearance.remove();
              setUseAppearance(false);
            },
          },
          { text: 'Change Photo', onPress: () => void handlePickReferencePhoto() },
        ],
      );
    }
  };

  const handleSubmit = () => {
    if (!isValid || loading) return;
    Keyboard.dismiss();
    const refId = useAppearance ? (appearance.reference?.id ?? null) : null;
    void onSubmit(trimmed, refId);
  };

  const placeholderText =
    customPlaceholder ?? (isCreate ? `Example: ${example}` : 'Describe the moment in detail...');

  return (
    <View testID={testID} style={styles.stage}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + (inputFocused ? spacing[3] : spacing[6]) },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.heroTint} pointerEvents="none" />
            <View style={[styles.heroContent, { paddingTop: insets.top, paddingBottom: spacing[4] }]}>
              <VisionHeaderRow
                title={isCreate ? 'Create Vision' : 'Add Image'}
                onBack={onBack}
              />
              <VisionIdentity
                intention={anchorIntention}
                category={anchorCategory}
                art={anchorArt}
                imageUrl={anchorImageUrl}
                showAnchor={false}
                tone="light"
              />
              {!isCreate && previewImageUrl ? <View style={{ aspectRatio: VISION_HERO_ASPECT, marginHorizontal: -spacing[5], overflow: 'hidden' }}>
                <Image source={{ uri: previewImageUrl }} resizeMode="cover" accessibilityLabel="Your current Vision" style={StyleSheet.absoluteFill} />
                <VisionImageEdge hero color={colors.ink.base} />
              </View> : null}
              <Text accessibilityRole="header" style={styles.heroTitle}>
                {isCreate ? 'Describe your Vision' : 'Describe your image'}
              </Text>
              <Text style={styles.heroSubtitle}>
                {isCreate
                  ? 'Tell us what you want to see in your vision.'
                  : 'Tell us what you want to see in your vision.'}
              </Text>

              {/* Four guidance chips */}
              {isCreate ? <View style={styles.chipsContainer}>
                <View style={styles.chipsRow}>
                  {PROMPT_CHIPS.slice(0, 2).map(({ key, label, icon: Icon, cue }) => (
                    <Pressable
                      key={key}
                      onPress={() => handleChipPress(cue)}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                    >
                      <Icon size={14} color="#FFFFFF" />
                      <Text style={styles.chipText} numberOfLines={1}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.chipsRow}>
                  {PROMPT_CHIPS.slice(2, 4).map(({ key, label, icon: Icon, cue }) => (
                    <Pressable
                      key={key}
                      onPress={() => handleChipPress(cue)}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                    >
                      <Icon size={14} color="#FFFFFF" />
                      <Text style={styles.chipText} numberOfLines={1}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View> : null}
            </View>
          </View>

          {/* Lower Input Section */}
          <View style={styles.bodySection}>
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
                placeholderTextColor={colors.text.disabled}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                style={[styles.textInput, { minHeight: 120, maxHeight: Math.max(160, Math.min(220, height * 0.28)) }]}
                textAlignVertical="top"
                scrollEnabled
              />
            </View>

            <View style={styles.meter}>
              <Text
                testID="vision-detail-hint"
                style={[styles.meterHint, level === 'rich' && { color: colors.semantic.success }]}
                numberOfLines={2}
              >
                {hint ?? 'Where you are · what you’re doing · what you see · what’s different'}
              </Text>
              <Text style={styles.counterText}>
                {description.length}/{maxChars}
              </Text>
            </View>

            {/* Make it look like you reference photo card */}
            <Pressable
              testID={`${testID}-reference-card`}
              onPress={handleReferenceOptions}
              accessibilityRole="button"
              accessibilityLabel="Make it look like you reference photo"
              style={({ pressed }) => [styles.referenceCard, pressed && styles.cardPressed]}
            >
              <View style={styles.referenceIconWell}>
                <UserIcon size={18} color={colors.ink.text.primary} />
              </View>
              <View style={styles.referenceCopy}>
                <Text style={styles.referenceTitle}>Make it look like you</Text>
                <Text style={styles.referenceSubtitle}>Optional — add a reference photo</Text>
              </View>
              {activeReferenceUrl ? (
                <View style={styles.thumbWrapper}>
                  <Image source={{ uri: activeReferenceUrl }} style={styles.referenceThumb} />
                  <ChevronRight size={16} color={colors.ink.text.tertiary} style={styles.thumbChevron} />
                </View>
              ) : (
                <ChevronRight size={18} color={colors.ink.text.tertiary} />
              )}
            </Pressable>

            {/* Error & Notices */}
            {(localNotice || error) && (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {localNotice ?? error}
              </Text>
            )}

            {/* CTA Button */}
            {!inputFocused ? (
              <>
                <V2Button
                  testID={isCreate ? 'vision-generate' : 'vision-scene-generate'}
                  size="large"
                  variant="secondary"
                  accessibilityLabel={isCreate ? 'Continue to create your Vision' : 'Generate image'}
                  disabled={!isValid || loading}
                  loading={loading}
                  onPress={handleSubmit}
                  style={styles.submitButton}
                >
                  {isCreate ? 'Continue' : 'Generate image →'}
                </V2Button>

                {onAddPhotos && (
                  <Pressable
                    testID="vision-add-photos"
                    accessibilityRole="button"
                    accessibilityLabel="Add my own images"
                    disabled={!isValid}
                    onPress={onAddPhotos}
                    style={[styles.textAction, !isValid && styles.disabled]}
                  >
                    <ImageIcon size={15} color={colors.ink.text.secondary} />
                    <Text style={styles.textActionLabel}>Use my own photos instead</Text>
                  </Pressable>
                )}
              </>
            ) : null}
          </View>
        </ScrollView>

        {/* Focused Floating Footer */}
        {inputFocused ? (
          <View style={[styles.focusedFooter, { paddingBottom: Math.max(insets.bottom, spacing[2]) }]}>
            <V2Button
              testID={isCreate ? 'vision-generate-focused' : 'vision-scene-generate-focused'}
              size="large"
              variant="secondary"
              accessibilityLabel={isCreate ? 'Continue to create your Vision' : 'Generate image'}
              disabled={!isValid || loading}
              loading={loading}
              onPress={handleSubmit}
              style={styles.submitButton}
            >
              {isCreate ? 'Continue' : 'Generate image →'}
            </V2Button>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      <VisionStatusBarScrim />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stage: { flex: 1, backgroundColor: colors.ink.base },
  scrollContent: { flexGrow: 1 },
  heroSection: { width: '100%' },
  heroTint: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink.base, opacity: 0.52 },
  heroContent: { paddingHorizontal: spacing[5], gap: spacing[3] },
  heroTitle: {
    ...typography.headingLG,
    color: colors.ink.text.primary,
    marginTop: spacing[3],
  },
  heroSubtitle: {
    ...typography.bodyMD,
    color: 'rgba(255, 255, 255, 0.85)',
    maxWidth: 320,
    lineHeight: 22,
  },
  chipsContainer: {
    marginTop: spacing[2],
    gap: spacing[2],
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  chipPressed: {
    opacity: 0.75,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  chipText: {
    ...typography.labelSM,
    color: '#FFFFFF',
    fontSize: 12,
    flexShrink: 1,
  },
  bodySection: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    gap: spacing[3],
    backgroundColor: colors.ink.base,
  },
  inputFrame: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.ink.hairlineStrong,
    backgroundColor: colors.ink.raised,
    padding: spacing[3],
  },
  inputFrameFocused: {
    borderColor: colors.text.primary,
  },
  textInput: {
    ...typography.bodyLG,
    color: colors.ink.text.primary,
    lineHeight: 24,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: -spacing[1],
  },
  counterText: {
    ...typography.caption,
    color: colors.ink.text.tertiary,
    fontSize: 12,
  },
  referenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.ink.hairlineStrong,
    backgroundColor: colors.ink.raised,
  },
  cardPressed: {
    opacity: 0.8,
  },
  referenceIconWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink.base,
  },
  referenceCopy: {
    flex: 1,
    gap: 2,
  },
  referenceTitle: {
    ...typography.labelMD,
    color: colors.ink.text.primary,
    fontWeight: '600',
  },
  referenceSubtitle: {
    ...typography.caption,
    color: colors.ink.text.secondary,
    fontSize: 12,
  },
  thumbWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  referenceThumb: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
  },
  thumbChevron: {
    marginLeft: 2,
  },
  errorText: {
    ...typography.caption,
    color: colors.semantic.error,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: spacing[2],
  },
  addPhotosAction: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  addPhotosText: {
    ...typography.labelMD,
    color: colors.ink.text.secondary,
    textDecorationLine: 'underline',
  },
  meter: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3], marginTop: -spacing[1] },
  meterHint: { ...typography.caption, color: colors.ink.text.secondary, flex: 1 },
  textAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], minHeight: 44 },
  textActionLabel: { ...typography.labelMD, color: colors.ink.text.secondary },
  disabled: {
    opacity: 0.45,
  },
  focusedFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    backgroundColor: colors.ink.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
  },
});
