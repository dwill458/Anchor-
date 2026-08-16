import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import { detectTimezoneLabel, TIMEZONE_OPTIONS, type ProfileMono, type StoredProfile } from '@/stores/profileStore';
import { PROFILE_AVATAR_SLOTS, ProfileAvatar, ProfileAvatarMarkCell } from '@/components/profile/ProfileAvatar';
import { getAvatarByIndex } from '@/utils/avatarUtils';
import { logger } from '@/utils/logger';

interface EditProfileSheetProps {
  open: boolean;
  profile: Pick<StoredProfile, 'name' | 'axiom' | 'timezone' | 'mono' | 'photo'>;
  onClose: () => void;
  onSave: (updates: Pick<StoredProfile, 'name' | 'axiom' | 'timezone' | 'mono' | 'photo'>) => Promise<void> | void;
}

const SHEET_ANIMATION_DURATION_MS = 450;
type ImagePickerModule = typeof import('expo-image-picker');

function getImagePickerModule(): ImagePickerModule | null {
  if (!requireOptionalNativeModule('ExponentImagePicker')) {
    logger.warn('[EditProfileSheet] ExponentImagePicker native module is unavailable in this build');
    return null;
  }

  try {
    return require('expo-image-picker') as ImagePickerModule;
  } catch (error) {
    logger.warn('[EditProfileSheet] expo-image-picker is unavailable in this build', error);
    return null;
  }
}

export const EditProfileSheet: React.FC<EditProfileSheetProps> = ({
  open,
  profile,
  onClose,
  onSave,
}) => {
  const [rendered, setRendered] = useState(open);
  const [name, setName] = useState(profile.name);
  const [axiom, setAxiom] = useState(profile.axiom);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [mono, setMono] = useState<ProfileMono>(profile.mono);
  const [photo, setPhoto] = useState<string | null>(profile.photo);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'axiom' | null>(null);

  const translateY = useRef(new Animated.Value(520)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const displayName = useMemo(() => name.trim() || 'Practitioner', [name]);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setName(profile.name);
      setAxiom(profile.axiom);
      setTimezone(profile.timezone || detectTimezoneLabel());
      setMono(profile.mono);
      setPhoto(profile.photo);
      setTimezoneOpen(false);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: SHEET_ANIMATION_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();

      return;
    }

    if (!rendered) {
      return;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 520,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setRendered(false);
      }
    });
  }, [backdropOpacity, open, profile.axiom, profile.mono, profile.name, profile.photo, profile.timezone, rendered, translateY]);

  if (!rendered) {
    return null;
  }

  const handleSave = async () => {
    await onSave({
      name: name.trim() || 'Practitioner',
      axiom: axiom.trim(),
      timezone,
      mono,
      photo,
    });
  };

  const pickFromLibrary = async () => {
    const ImagePicker = getImagePickerModule();
    if (!ImagePicker) {
      Alert.alert('Photos unavailable', 'Photo selection is not available in this version of Anchor. Please update the app and try again.');
      return;
    }

    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photo library in Settings.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const ImagePicker = getImagePickerModule();
    if (!ImagePicker) {
      Alert.alert('Camera unavailable', 'The camera is not available in this version of Anchor. Please update the app and try again.');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handlePhotoPress = () => {
    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: 'Choose from Library', onPress: () => void pickFromLibrary() },
      { text: 'Take Photo', onPress: () => void takePhoto() },
    ];
    if (photo) {
      buttons.push({ text: 'Remove Photo', style: 'destructive', onPress: () => setPhoto(null) });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile Photo', undefined, buttons);
  };

  return (
    <Modal transparent visible onRequestClose={onClose} animationType="none">
      <View style={styles.modalRoot}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose}>
            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={styles.backdropTint} />
          </Pressable>
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoiding}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.headerRow}>
              <Pressable hitSlop={10} onPress={onClose} style={styles.headerButton}>
                <X color={colors.anchor15.ash} size={18} strokeWidth={1.5} />
              </Pressable>
              <View style={styles.headerTitleGroup}>
                <Text style={styles.headerKicker}>SANCTUARY / PROFILE</Text>
                <Text style={styles.title}>EDIT YOUR SIGNAL</Text>
              </View>
              <View style={styles.headerButtonPlaceholder} />
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.previewBlock}>
                <View style={styles.previewCopy}>
                  <Text style={styles.previewEyebrow}>YOUR SIGNAL</Text>
                  <Text style={styles.previewName}>{displayName}</Text>
                  <Text style={styles.previewAxiom} numberOfLines={2}>
                    {axiom.trim() || 'A quiet place to return to.'}
                  </Text>
                  <Text style={styles.previewMeta}>This is how you appear in Anchor.</Text>
                </View>
                <Pressable onPress={handlePhotoPress} style={styles.previewAvatarButton}>
                  <ProfileAvatar
                    size={92}
                    name={displayName}
                    mono={mono}
                    photoUri={photo}
                    badgeSize={26}
                    onPress={handlePhotoPress}
                    onBadgePress={handlePhotoPress}
                  />
                  <Text style={styles.photoHint}>Change image</Text>
                </Pressable>
              </View>

              <View style={styles.rule} />

              <View style={styles.sectionHeading}>
                <Text style={styles.sectionIndex}>01</Text>
                <View style={styles.sectionHeadingCopy}>
                  <Text style={styles.sectionTitle}>IDENTITY</Text>
                  <Text style={styles.sectionDescription}>The name you return to.</Text>
                </View>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>NAME</Text>
                <View style={[styles.inputControl, focusedField === 'name' ? styles.inputControlFocused : null]}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    maxLength={24}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Your name"
                    placeholderTextColor={withAlpha(colors.anchor15.ash, 0.62)}
                    selectionColor={colors.anchor15.giltBright}
                    style={styles.input}
                  />
                  <Text style={styles.counterText}>{name.length}/24</Text>
                </View>
              </View>

              <View style={styles.rule} />

              <View style={styles.sectionHeading}>
                <Text style={styles.sectionIndex}>02</Text>
                <View style={styles.sectionHeadingCopy}>
                  <Text style={styles.sectionTitle}>AXIOM</Text>
                  <Text style={styles.sectionDescription}>One sentence for the way forward.</Text>
                </View>
              </View>

              <View style={[styles.axiomPanel, focusedField === 'axiom' ? styles.axiomPanelFocused : null]}>
                <Text style={styles.quoteMark}>“</Text>
                <View style={styles.axiomControl}>
                  <TextInput
                    value={axiom}
                    onChangeText={setAxiom}
                    maxLength={40}
                    onFocus={() => setFocusedField('axiom')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Build in silence."
                    placeholderTextColor={withAlpha(colors.anchor15.ash, 0.62)}
                    selectionColor={colors.anchor15.giltBright}
                    style={styles.axiomInput}
                    multiline
                    numberOfLines={2}
                  />
                  <Text style={styles.counterText}>{axiom.length}/40</Text>
                </View>
              </View>

              <View style={styles.rule} />

              <View style={styles.sectionHeading}>
                <Text style={styles.sectionIndex}>03</Text>
                <View style={styles.sectionHeadingCopy}>
                  <Text style={styles.sectionTitle}>YOUR MARK</Text>
                  <Text style={styles.sectionDescription}>The quiet symbol that stands in for you.</Text>
                </View>
              </View>

              <View style={styles.markPanel}>
                <View style={styles.markPanelHeader}>
                  <Text style={styles.markPanelLabel}>PLACEHOLDER AVATAR</Text>
                  <Text style={styles.markPanelValue}>{mono === 'initial' ? 'INITIAL' : 'SIGIL'}</Text>
                </View>
                <View style={styles.markGrid}>
                  <ProfileAvatarMarkCell
                    mono="initial"
                    selected={mono === 'initial'}
                    initial={displayName.charAt(0).toUpperCase() || 'P'}
                    onPress={() => setMono('initial')}
                  />
                  {PROFILE_AVATAR_SLOTS.map((slotId, index) => (
                    <ProfileAvatarMarkCell
                      key={slotId}
                      mono={slotId}
                      selected={mono === slotId}
                      initial={displayName.charAt(0).toUpperCase() || 'P'}
                      avatarSource={getAvatarByIndex(index)}
                      onPress={() => setMono(slotId)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.rule} />

              <View style={styles.sectionHeading}>
                <Text style={styles.sectionIndex}>04</Text>
                <View style={styles.sectionHeadingCopy}>
                  <Text style={styles.sectionTitle}>CONSTANCY</Text>
                  <Text style={styles.sectionDescription}>Keep your practice aligned to local time.</Text>
                </View>
              </View>

              <View style={styles.timezonePanel}>
                <View style={styles.timezoneLabelGroup}>
                  <Text style={styles.inputLabel}>TIMEZONE</Text>
                  <Text style={styles.timezoneHint}>Used for streak accuracy</Text>
                </View>
                <Pressable
                  onPress={() => setTimezoneOpen((value) => !value)}
                  style={[
                    styles.dropdownTrigger,
                    timezoneOpen ? styles.dropdownTriggerOpen : null,
                  ]}
                >
                  <Text style={styles.dropdownValue}>{timezone}</Text>
                  <ChevronDown
                    color={colors.anchor15.gilt}
                    size={16}
                    style={{
                      transform: [{ rotate: timezoneOpen ? '180deg' : '0deg' }],
                    }}
                  />
                </Pressable>
                {timezoneOpen ? (
                  <ScrollView
                    style={styles.dropdownList}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {TIMEZONE_OPTIONS.map((option) => {
                      const selected = option === timezone;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => {
                            setTimezone(option);
                            setTimezoneOpen(false);
                          }}
                          style={[styles.dropdownItem, selected ? styles.dropdownItemSelected : null]}
                        >
                          <Text style={[styles.dropdownItemText, selected ? styles.dropdownItemTextSelected : null]}>
                            {selected ? `✓  ${option}` : option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}
              </View>

              <View style={styles.footerNote}>
                <Check color={colors.anchor15.gilt} size={15} strokeWidth={1.5} />
                <Text style={styles.footerNoteText}>Your profile is private to your Anchor.</Text>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                onPress={() => void handleSave()}
                style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
              >
                <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
                <Text style={styles.saveButtonArrow}>↗</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: colors.anchor15.ink,
  },
  keyboardAvoiding: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.anchor15.ink, 0.82),
  },
  sheet: {
    height: '100%',
    backgroundColor: colors.anchor15.ink,
    borderWidth: 0,
    overflow: 'hidden',
  },
  topShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.anchor15.goldLine,
  },
  handle: {
    display: 'none',
  },
  headerRow: {
    minHeight: 72,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.anchor15.hairlineGold,
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  headerTitleGroup: {
    alignItems: 'center',
    gap: 3,
  },
  headerKicker: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 9,
    letterSpacing: 1.6,
    color: withAlpha(colors.anchor15.ash, 0.7),
  },
  title: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.anchor15.giltBright,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 12,
  },
  previewBlock: {
    minHeight: 148,
    paddingTop: 18,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  previewCopy: {
    flex: 1,
    minWidth: 0,
  },
  previewEyebrow: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 9,
    letterSpacing: 2.3,
    color: colors.anchor15.ash,
    marginBottom: 10,
  },
  previewName: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 26,
    letterSpacing: 0.3,
    color: colors.anchor15.bone,
    marginBottom: 5,
  },
  previewAxiom: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 16,
    lineHeight: 20,
    color: withAlpha(colors.anchor15.bone, 0.75),
  },
  previewMeta: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 9,
    letterSpacing: 0.25,
    color: withAlpha(colors.anchor15.ash, 0.65),
    marginTop: 10,
  },
  previewAvatarButton: {
    alignItems: 'center',
  },
  photoHint: {
    marginTop: 8,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.anchor15.gilt,
    textTransform: 'uppercase',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.anchor15.hairlineGold,
    marginVertical: 20,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  sectionIndex: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.anchor15.gilt,
    paddingTop: 1,
  },
  sectionHeadingCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 12,
    letterSpacing: 2.2,
    color: colors.anchor15.bone,
    marginBottom: 4,
  },
  sectionDescription: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 12,
    color: withAlpha(colors.anchor15.ash, 0.82),
  },
  inputRow: {
    gap: 8,
  },
  inputLabel: {
    fontFamily: typography.fontFamily.instrumentSemiBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.anchor15.ash,
  },
  inputControl: {
    minHeight: 54,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.anchor15.hairline,
    backgroundColor: colors.anchor15.navy,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputControlFocused: {
    borderColor: colors.anchor15.goldLine,
  },
  axiomPanel: {
    minHeight: 108,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.anchor15.hairline,
    backgroundColor: colors.anchor15.navy,
    borderRadius: 4,
    flexDirection: 'row',
    gap: 6,
  },
  axiomPanelFocused: {
    borderColor: colors.anchor15.goldLine,
  },
  quoteMark: {
    fontFamily: typography.fontFamily.voice,
    fontSize: 28,
    lineHeight: 30,
    color: colors.anchor15.gilt,
  },
  axiomControl: {
    flex: 1,
    minWidth: 0,
  },
  markPanel: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.anchor15.hairline,
    backgroundColor: withAlpha(colors.anchor15.navy, 0.72),
    borderRadius: 4,
  },
  markPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  markPanelLabel: {
    fontFamily: typography.fontFamily.instrumentSemiBold,
    fontSize: 9,
    letterSpacing: 1.3,
    color: colors.anchor15.ash,
  },
  markPanelValue: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.anchor15.gilt,
  },
  timezonePanel: {
    gap: 10,
  },
  timezoneLabelGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  timezoneHint: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 11,
    color: withAlpha(colors.anchor15.ash, 0.72),
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    marginBottom: 18,
  },
  footerNoteText: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 11,
    color: withAlpha(colors.anchor15.ash, 0.72),
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.anchor15.hairlineGold,
    backgroundColor: colors.anchor15.ink,
  },
  saveButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 4,
    backgroundColor: colors.anchor15.gilt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveButtonPressed: {
    opacity: 0.78,
  },
  saveButtonText: {
    fontFamily: typography.fontFamily.instrumentSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.anchor15.ink,
  },
  saveButtonArrow: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 21,
    color: colors.anchor15.ink,
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.voice,
    fontSize: 16,
  },
  axiomInput: {
    fontFamily: typography.fontFamily.voiceItalic,
  },
  counterText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 10,
    color: withAlpha(colors.anchor15.ash, 0.7),
  },
  markGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  dropdownTrigger: {
    minHeight: 54,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.anchor15.hairline,
    backgroundColor: colors.anchor15.navy,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTriggerOpen: {
    borderColor: colors.anchor15.goldLine,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownValue: {
    flex: 1,
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.voice,
    fontSize: 14,
    marginRight: spacing.sm,
  },
  dropdownList: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.anchor15.goldLine,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: colors.anchor15.navy,
    maxHeight: 180,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.anchor15.hairline,
  },
  dropdownItemSelected: {
    backgroundColor: withAlpha(colors.anchor15.gilt, 0.10),
  },
  dropdownItemText: {
    fontFamily: typography.fontFamily.voice,
    fontSize: 13,
    color: withAlpha(colors.anchor15.ash, 0.9),
  },
  dropdownItemTextSelected: {
    color: colors.anchor15.giltBright,
  },
});
