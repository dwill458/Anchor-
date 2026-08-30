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
import { colors, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import { detectTimezoneLabel, TIMEZONE_OPTIONS, type ProfileMono, type StoredProfile } from '@/stores/profileStore';
import { PROFILE_AVATAR_SLOTS, ProfileAvatar, ProfileAvatarMarkCell } from '@/components/profile/ProfileAvatar';
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

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.fieldLabel}>{children}</Text>
);

const FieldHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.fieldHint}>{children}</Text>
);

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
            <View pointerEvents="none" style={styles.sheetAtmosphere} />
            <View style={styles.handle} />

            <View style={styles.headerRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel editing profile"
                hitSlop={8}
                onPress={onClose}
                style={styles.headerAction}
              >
                <X color={colors.anchor15.ash} size={17} strokeWidth={1.35} />
              </Pressable>
              <View pointerEvents="none" style={styles.headerTitleGroup}>
                <Text style={styles.headerEyebrow}>Account</Text>
                <Text style={styles.title}>EDIT PROFILE</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save profile"
                hitSlop={8}
                onPress={() => void handleSave()}
                style={styles.saveAction}
              >
                <Text style={styles.saveActionText}>Save</Text>
              </Pressable>
            </View>
            <View style={styles.headerRule} />

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.avatarSection}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionNumber}>01</Text>
                  <Text style={styles.sectionTitle}>PROFILE MARK</Text>
                </View>
                <View style={styles.avatarRow}>
                  <ProfileAvatar
                    size={84}
                    name={displayName}
                    mono={mono}
                    photoUri={photo}
                    badgeSize={26}
                    onPress={handlePhotoPress}
                    onBadgePress={handlePhotoPress}
                  />
                  <View style={styles.avatarCopy}>
                    <Text style={styles.avatarTitle}>{photo ? 'Profile photo selected' : 'Your profile mark'}</Text>
                    <Text style={styles.photoHint}>Tap the mark to choose a photo, or choose a symbol below.</Text>
                  </View>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionNumber}>02</Text>
                  <FieldLabel>DISPLAY NAME</FieldLabel>
                </View>
                <View
                  style={[
                    styles.textField,
                    focusedField === 'name' ? styles.textFieldFocused : null,
                  ]}
                >
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    maxLength={24}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Your name"
                    placeholderTextColor={withAlpha(colors.anchor15.ash, 0.62)}
                    selectionColor={colors.anchor15.gilt}
                    style={styles.input}
                  />
                  <Text style={styles.counterText}>{name.length}/24</Text>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionNumber}>03</Text>
                  <FieldLabel>OPERATING PRINCIPLE</FieldLabel>
                </View>
                <FieldHint>One line. Your personal axiom. Shown beneath your name.</FieldHint>
                <View
                  style={[
                    styles.textField,
                    focusedField === 'axiom' || axiom.trim().length > 0
                      ? styles.textFieldFocused
                      : null,
                  ]}
                >
                  <TextInput
                    value={axiom}
                    onChangeText={setAxiom}
                    maxLength={40}
                    onFocus={() => setFocusedField('axiom')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Build in silence."
                    placeholderTextColor={withAlpha(colors.anchor15.ash, 0.62)}
                    selectionColor={colors.anchor15.gilt}
                    style={[styles.input, axiom.trim().length > 0 ? styles.axiomInput : null]}
                  />
                  <Text style={styles.counterText}>{axiom.length}/40</Text>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionNumber}>04</Text>
                  <FieldLabel>DEFAULT MARK</FieldLabel>
                </View>
                <FieldHint>Shown when no photo is set · choose the placeholder avatar you want</FieldHint>
                <View style={styles.markGrid}>
                  <ProfileAvatarMarkCell
                    mono="initial"
                    selected={mono === 'initial'}
                    initial={displayName.charAt(0).toUpperCase() || 'P'}
                    onPress={() => setMono('initial')}
                  />
                  {PROFILE_AVATAR_SLOTS.map((slotId) => (
                    <ProfileAvatarMarkCell
                      key={slotId}
                      mono={slotId}
                      selected={mono === slotId}
                      initial={displayName.charAt(0).toUpperCase() || 'P'}
                      onPress={() => setMono(slotId)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionNumber}>05</Text>
                  <FieldLabel>TIMEZONE</FieldLabel>
                </View>
                <FieldHint>Auto-detected · used for Constancy accuracy</FieldHint>
                <Pressable
                  onPress={() => setTimezoneOpen((value) => !value)}
                  style={[
                    styles.dropdownTrigger,
                    timezoneOpen ? styles.dropdownTriggerOpen : null,
                  ]}
                >
                  <Text style={styles.dropdownValue}>{timezone}</Text>
                  <ChevronDown
                    color={colors.gold}
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
                          <Text style={[styles.dropdownItemText, selected ? styles.dropdownItemTextSelected : null]}>{option}</Text>
                          {selected ? <Check color={colors.anchor15.gilt} size={15} strokeWidth={1.45} /> : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardAvoiding: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 11, 15, 0.78)',
  },
  sheet: {
    height: '94%',
    backgroundColor: colors.anchor15.navy,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: colors.anchor15.goldHairline,
    overflow: 'hidden',
  },
  sheetAtmosphere: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -210,
    right: -112,
    backgroundColor: 'rgba(217, 179, 108, 0.055)',
  },
  handle: {
    alignSelf: 'center',
    width: 32,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(217, 179, 108, 0.42)',
    marginTop: 13,
    marginBottom: 8,
  },
  headerRow: {
    minHeight: 48,
    paddingHorizontal: 20,
    paddingBottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    alignItems: 'center',
    gap: 1,
  },
  headerEyebrow: {
    color: colors.anchor15.ash,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 9,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.anchor15.bone,
  },
  saveAction: {
    minWidth: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  saveActionText: {
    color: colors.anchor15.gilt,
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 10,
    letterSpacing: 1.25,
    textTransform: 'uppercase',
  },
  headerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.anchor15.hairline,
    marginHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 42,
  },
  avatarSection: {
    paddingBottom: 28,
    marginBottom: 27,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.anchor15.hairline,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 12,
  },
  sectionNumber: {
    color: 'rgba(217, 179, 108, 0.62)',
    fontFamily: typography.fontFamily.instrument,
    fontSize: 9,
    letterSpacing: 0.75,
    width: 17,
  },
  sectionTitle: {
    color: colors.anchor15.gilt,
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 9,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 17,
  },
  avatarCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  avatarTitle: {
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.voice,
    fontSize: 19,
    lineHeight: 23,
  },
  photoHint: {
    marginTop: 5,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 11,
    lineHeight: 16,
    color: colors.anchor15.ash,
  },
  fieldBlock: {
    marginBottom: 29,
  },
  fieldLabel: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.anchor15.gilt,
  },
  fieldHint: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 11,
    lineHeight: 16,
    color: colors.anchor15.ash,
    marginTop: -3,
    marginBottom: 9,
  },
  textField: {
    minHeight: 55,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(244, 239, 230, 0.22)',
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textFieldFocused: {
    borderBottomColor: colors.anchor15.gilt,
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.voice,
    fontSize: 19,
    paddingVertical: 0,
  },
  axiomInput: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
  },
  counterText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 10,
    color: 'rgba(135, 147, 157, 0.74)',
    fontVariant: ['tabular-nums'],
  },
  markGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dropdownTrigger: {
    minHeight: 55,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(244, 239, 230, 0.22)',
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTriggerOpen: {
    borderBottomColor: colors.anchor15.gilt,
  },
  dropdownValue: {
    flex: 1,
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 14,
    marginRight: 10,
  },
  dropdownList: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.anchor15.goldHairline,
    backgroundColor: colors.anchor15.veil,
    maxHeight: 180,
  },
  dropdownItem: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.anchor15.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(217, 179, 108, 0.07)',
  },
  dropdownItemText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 13,
    color: colors.anchor15.ash,
  },
  dropdownItemTextSelected: {
    color: colors.anchor15.bone,
  },
});
