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
import { ChevronDown } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import { detectTimezoneLabel, TIMEZONE_OPTIONS, type ProfileMono, type StoredProfile } from '@/stores/profileStore';
import { PROFILE_MARK_SLOTS, ProfileAvatar, ProfileAvatarMarkCell } from '@/components/profile/ProfileAvatar';

interface EditProfileSheetProps {
  open: boolean;
  profile: Pick<StoredProfile, 'name' | 'axiom' | 'timezone' | 'mono' | 'photo'>;
  onClose: () => void;
  onSave: (updates: Pick<StoredProfile, 'name' | 'axiom' | 'timezone' | 'mono' | 'photo'>) => Promise<void> | void;
}

const SHEET_ANIMATION_DURATION_MS = 450;
type ImagePickerModule = typeof import('expo-image-picker');

function getImagePickerModule(): ImagePickerModule | null {
  try {
    return require('expo-image-picker') as ImagePickerModule;
  } catch (error) {
    console.warn('[EditProfileSheet] expo-image-picker is unavailable in this build', error);
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
      Alert.alert('Unavailable', 'Photo picking is not available in this build yet.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library in Settings.');
      return;
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
      Alert.alert('Unavailable', 'Camera capture is not available in this build yet.');
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
            <View style={styles.topShimmer} />
            <View style={styles.handle} />

            <View style={styles.headerRow}>
              <Pressable hitSlop={8} onPress={onClose}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
              <Text style={styles.title}>EDIT PROFILE</Text>
              <Pressable hitSlop={8} onPress={() => void handleSave()} style={styles.savePill}>
                <Text style={styles.savePillText}>Save</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.avatarSection}>
                <ProfileAvatar
                  size={84}
                  name={displayName}
                  mono={mono}
                  photoUri={photo}
                  badgeSize={26}
                  onPress={handlePhotoPress}
                  onBadgePress={handlePhotoPress}
                />
                <Text style={styles.photoHint}>Tap to upload photo</Text>
              </View>

              <View style={styles.fieldBlock}>
                <FieldLabel>DISPLAY NAME</FieldLabel>
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
                    placeholderTextColor={withAlpha(colors.silver, 0.42)}
                    selectionColor={colors.gold}
                    style={styles.input}
                  />
                  <Text style={styles.counterText}>{name.length}/24</Text>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <FieldLabel>OPERATING PRINCIPLE</FieldLabel>
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
                    placeholderTextColor={withAlpha(colors.silver, 0.42)}
                    selectionColor={colors.gold}
                    style={[styles.input, axiom.trim().length > 0 ? styles.axiomInput : null]}
                  />
                  <Text style={styles.counterText}>{axiom.length}/40</Text>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <FieldLabel>AVATAR MARK</FieldLabel>
                <FieldHint>Shown when no photo is set · custom marks via Nano Banana</FieldHint>
                <View style={styles.markGrid}>
                  <ProfileAvatarMarkCell
                    mono="initial"
                    selected={mono === 'initial'}
                    initial={displayName.charAt(0).toUpperCase() || 'P'}
                    onPress={() => setMono('initial')}
                  />
                  {PROFILE_MARK_SLOTS.map((slotId) => (
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
                <FieldLabel>TIMEZONE</FieldLabel>
                <FieldHint>Auto-detected · used for streak accuracy</FieldHint>
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
                          <Text style={[styles.dropdownItemText, selected ? styles.dropdownItemTextSelected : null]}>
                            {selected ? `✓  ${option}` : option}
                          </Text>
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
    backgroundColor: withAlpha(colors.black, 0.8),
  },
  sheet: {
    height: '100%',
    backgroundColor: colors.black,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: withAlpha(colors.gold, 0.15),
    overflow: 'hidden',
  },
  topShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: withAlpha(colors.gold, 0.34),
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 3,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.white, 0.13),
    marginTop: 14,
    marginBottom: 14,
  },
  headerRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelLabel: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: withAlpha(colors.silver, 0.62),
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    letterSpacing: 2.8,
    color: colors.gold,
  },
  savePill: {
    minWidth: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  savePillText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    color: colors.black,
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  photoHint: {
    marginTop: spacing.sm,
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 11,
    color: withAlpha(colors.silver, 0.35),
  },
  fieldBlock: {
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    letterSpacing: 2.4,
    color: colors.gold,
    marginBottom: 6,
  },
  fieldHint: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 11,
    color: withAlpha(colors.silver, 0.38),
    marginBottom: 12,
  },
  textField: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.08),
    backgroundColor: withAlpha(colors.white, 0.04),
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textFieldFocused: {
    borderColor: withAlpha(colors.gold, 0.28),
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: colors.bone,
    fontFamily: typography.fonts.bodySerif,
    fontSize: 16,
  },
  axiomInput: {
    fontFamily: typography.fonts.bodySerifItalic,
  },
  counterText: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: withAlpha(colors.silver, 0.28),
  },
  markGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  dropdownTrigger: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.08),
    backgroundColor: withAlpha(colors.white, 0.04),
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTriggerOpen: {
    borderColor: withAlpha(colors.gold, 0.3),
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownValue: {
    flex: 1,
    color: colors.bone,
    fontFamily: typography.fonts.bodySerif,
    fontSize: 14,
    marginRight: spacing.sm,
  },
  dropdownList: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: withAlpha(colors.gold, 0.18),
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: withAlpha(colors.black, 0.96),
    maxHeight: 180,
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withAlpha(colors.white, 0.04),
  },
  dropdownItemSelected: {
    backgroundColor: withAlpha(colors.gold, 0.07),
  },
  dropdownItemText: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 13,
    color: withAlpha(colors.silver, 0.75),
  },
  dropdownItemTextSelected: {
    color: colors.gold,
  },
});
