import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { T, settingsTypography } from '@/components/settings/settingsTheme';
import { IconBack, IconPencil } from '@/components/settings/SettingsIcons';
import type { StoredProfile } from '@/stores/profileStore';
import { logger } from '@/utils/logger';

interface EditProfileSheetProps {
  open: boolean;
  profile: Pick<StoredProfile, 'name' | 'axiom' | 'timezone' | 'mono' | 'photo'>;
  onClose: () => void;
  onSave: (updates: Pick<StoredProfile, 'name' | 'axiom' | 'timezone' | 'mono' | 'photo'>) => Promise<void> | void;
}

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
  const [photo, setPhoto] = useState<string | null>(profile.photo);
  const [isSaving, setIsSaving] = useState(false);

  const translateY = useRef(new Animated.Value(600)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setRendered(true);
      setName(profile.name);
      setPhoto(profile.photo);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!rendered) return;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 600,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setRendered(false);
      }
    });
  }, [open, profile.name, profile.photo, rendered, translateY, backdropOpacity]);

  const trimmedName = name.trim();
  const originalTrimmedName = (profile.name || '').trim();
  const isDirty = (trimmedName !== originalTrimmedName && trimmedName.length > 0) || photo !== profile.photo;

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      await onSave({
        ...profile,
        name: trimmedName || 'Practitioner',
        photo,
      });
      onClose();
    } catch (error) {
      logger.error('[EditProfileSheet] Failed to save profile', error);
      Alert.alert('Save Failed', 'Could not save profile changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const pickFromLibrary = async () => {
    const ImagePicker = getImagePickerModule();
    if (!ImagePicker) {
      Alert.alert('Photos unavailable', 'Photo selection is not available in this version of Anchor.');
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
      Alert.alert('Camera unavailable', 'Camera is not available in this version of Anchor.');
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

  if (!rendered) return null;

  const displayInitial = (trimmedName.charAt(0) || 'P').toUpperCase();

  return (
    <Modal transparent visible onRequestClose={onClose} animationType="none">
      <View style={styles.modalRoot}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: backdropOpacity }]}>
          <Pressable style={styles.backdrop} onPress={onClose} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoiding}
        >
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing profile"
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.headerButton}
                  activeOpacity={0.65}
                >
                  <IconBack size={22} color={T.ink} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit profile</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Save profile"
                  disabled={!isDirty || isSaving}
                  onPress={() => void handleSave()}
                  style={styles.headerButton}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.saveText, isDirty && !isSaving ? styles.saveTextActive : styles.saveTextDisabled]}>
                    {isSaving ? 'Saving…' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Avatar Section */}
                <View style={styles.avatarSection}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Change profile photo"
                    onPress={handlePhotoPress}
                    activeOpacity={0.85}
                    style={styles.avatarWrapper}
                  >
                    <View style={styles.avatarCircle}>
                      {photo ? (
                        <Image source={{ uri: photo }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarInitial}>{displayInitial}</Text>
                      )}
                    </View>
                    <View style={styles.avatarBadge}>
                      <IconPencil size={14} color={T.surface} />
                    </View>
                  </TouchableOpacity>

                  <View style={styles.avatarActions}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Change photo"
                      onPress={handlePhotoPress}
                      style={styles.photoActionBtn}
                      activeOpacity={0.65}
                    >
                      <Text style={styles.photoActionText}>Change photo</Text>
                    </TouchableOpacity>
                    {photo ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Remove photo"
                        onPress={() => setPhoto(null)}
                        style={styles.photoActionBtn}
                        activeOpacity={0.65}
                      >
                        <Text style={styles.photoRemoveText}>Remove photo</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {/* Display Name Input */}
                <View style={styles.fieldSection}>
                  <View style={styles.fieldHeader}>
                    <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
                    <Text style={styles.fieldCounter}>{name.length}/24</Text>
                  </View>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      maxLength={24}
                      placeholder="Your name"
                      placeholderTextColor={T.ink3}
                      selectionColor={T.ink}
                      autoCapitalize="words"
                      autoCorrect={false}
                      style={styles.input}
                    />
                  </View>
                  <Text style={styles.fieldHint}>
                    Your display name appears in your personal reflections and profile header.
                  </Text>
                </View>
              </ScrollView>
            </SafeAreaView>
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(23, 23, 20, 0.45)',
  },
  keyboardAvoiding: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    flex: 1,
    marginTop: 50,
    backgroundColor: T.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 25,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.line,
  },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: settingsTypography.displaySemiBold,
    fontSize: 21,
    color: T.ink,
    letterSpacing: -0.2,
  },
  saveText: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 15,
  },
  saveTextActive: {
    color: T.ink,
  },
  saveTextDisabled: {
    color: T.ink3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 36,
  },
  avatarWrapper: {
    position: 'relative',
    width: 92,
    height: 92,
  },
  avatarCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: T.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarInitial: {
    fontFamily: settingsTypography.displayBold,
    fontSize: 36,
    color: T.ink,
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: T.bg,
  },
  avatarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  photoActionBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionText: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 14,
    color: T.ink,
  },
  photoRemoveText: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 14,
    color: T.danger,
  },
  fieldSection: {
    gap: 8,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fieldLabel: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: T.ink2,
  },
  fieldCounter: {
    fontFamily: settingsTypography.body,
    fontSize: 12,
    color: T.ink3,
  },
  inputWrapper: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: T.line,
    paddingHorizontal: 16,
    height: 54,
    justifyContent: 'center',
  },
  input: {
    fontFamily: settingsTypography.bodyMedium,
    fontSize: 16,
    color: T.ink,
    padding: 0,
  },
  fieldHint: {
    fontFamily: settingsTypography.body,
    fontSize: 12.5,
    color: T.ink3,
    lineHeight: 17,
    marginTop: 4,
  },
});
