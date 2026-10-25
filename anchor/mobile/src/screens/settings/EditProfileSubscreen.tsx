import React, { useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getImagePickerModule } from '@/components/EditProfileSheet';
import {
  ActionButton,
  GroupLabel,
  SettingsGroup,
  SettingsNote,
  SettingsScreenFrame,
  SwitchRow,
  TextAction,
  cardTheme,
} from '@/components/settings/SettingsCards';
import { IconPencil } from '@/components/settings/SettingsIcons';
import { settingsTypography } from '@/components/settings/settingsTheme';
import { useVisionAppearanceReference } from '@/hooks/v2/vision';
import { logger } from '@/utils/logger';

export const PROFILE_NAME_MAX_LENGTH = 24;

interface Props {
  name: string;
  photo: string | null;
  onBack: () => void;
  onSave: (updates: { name: string; photo: string | null; usePhotoInVision?: boolean }) => Promise<void>;
}

export const EditProfileSubscreen: React.FC<Props> = ({ name: savedName, photo: savedPhoto, onBack, onSave }) => {
  const [name, setName] = useState(savedName);
  const [photo, setPhoto] = useState<string | null>(savedPhoto);
  const [isSaving, setIsSaving] = useState(false);
  const visionAppearance = useVisionAppearanceReference();
  const [visionOptIn, setVisionOptIn] = useState<boolean>(
    Boolean(visionAppearance.enabledByPreference && savedPhoto)
  );

  const trimmedName = name.trim();
  const hasPhoto = Boolean(photo);
  const hasSavedPhoto = Boolean(savedPhoto) && photo === savedPhoto;
  const isDirty =
    (trimmedName.length > 0 && trimmedName !== savedName.trim()) ||
    photo !== savedPhoto ||
    (photo !== null && visionOptIn !== Boolean(visionAppearance.enabledByPreference && savedPhoto));
  const initial = (trimmedName.charAt(0) || savedName.charAt(0) || 'P').toUpperCase();

  const handleToggleVision = async (next: boolean) => {
    setVisionOptIn(next);
    if (hasSavedPhoto && savedPhoto) {
      if (!next) {
        await visionAppearance.setProfilePreference(false);
      } else {
        const ok = await visionAppearance.setProfilePreference(true, savedPhoto, (err) => {
          Alert.alert('Vision photo', err);
        });
        if (!ok) {
          setVisionOptIn(false);
        }
      }
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
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
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
  };

  const handlePhotoPress = () => {
    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: 'Choose from library', onPress: () => void pickFromLibrary() },
      { text: 'Take photo', onPress: () => void takePhoto() },
    ];
    if (photo) buttons.push({ text: 'Remove photo', style: 'destructive', onPress: () => setPhoto(null) });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile photo', undefined, buttons);
  };

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      await onSave({ name: trimmedName || 'Practitioner', photo, usePhotoInVision: visionOptIn });
      onBack();
    } catch (error) {
      logger.error('[EditProfileSubscreen] Failed to save profile', error);
      Alert.alert('Save failed', 'Could not save profile changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsScreenFrame title="Edit profile" onBack={onBack} testID="edit-profile-screen">
      <View style={styles.avatarSection}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          onPress={handlePhotoPress}
          style={styles.avatar}
          testID="edit-profile-avatar"
        >
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitial}>{initial}</Text>
          )}
          <View style={styles.avatarBadge}>
            <IconPencil size={16} color={cardTheme.gold} />
          </View>
        </Pressable>
        <TextAction label="Change photo" tone="ink" onPress={handlePhotoPress} testID="edit-profile-change-photo" />
      </View>

      <View style={styles.field}>
        <View style={styles.fieldHeader}>
          <Text style={styles.fieldLabel} nativeID="edit-profile-name-label">
            Display name
          </Text>
          <Text style={styles.counter}>{`${name.length}/${PROFILE_NAME_MAX_LENGTH}`}</Text>
        </View>
        <TextInput
          accessibilityLabel="Display name"
          value={name}
          onChangeText={setName}
          maxLength={PROFILE_NAME_MAX_LENGTH}
          autoCorrect={false}
          returnKeyType="done"
          style={styles.input}
          testID="edit-profile-name"
        />
        <Text style={styles.helper}>Shown in your reflections and at the top of your profile.</Text>
      </View>

      <GroupLabel>Vision</GroupLabel>
      <SettingsGroup>
        <SwitchRow
          title="Use my photo in Vision"
          subtitle="Make your profile photo available as an image for your vision board."
          on={Boolean(hasPhoto && visionOptIn)}
          onChange={(next) => void handleToggleVision(next)}
          disabled={!hasPhoto || visionAppearance.saving}
          switchLabel="Use my profile photo in Vision"
          testID="settings-toggle-vision-profile-photo"
        />
      </SettingsGroup>
      {!hasPhoto ? (
        <SettingsNote style={styles.noteTight}>Add a profile photo first to turn this on.</SettingsNote>
      ) : null}

      <View style={styles.saveBlock}>
        <ActionButton
          label={isSaving ? 'Saving…' : 'Save changes'}
          onPress={() => void handleSave()}
          disabled={!isDirty || isSaving}
          testID="edit-profile-save"
        />
      </View>
    </SettingsScreenFrame>
  );
};

const styles = StyleSheet.create({
  avatarSection: { alignItems: 'center', marginTop: 16, gap: 4 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: cardTheme.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarInitial: { fontFamily: settingsTypography.bodySemiBold, fontSize: 40, color: '#F4F0E8' },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: cardTheme.goldTint,
    borderWidth: 2,
    borderColor: '#F4F0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { marginHorizontal: 16, marginTop: 12 },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  fieldLabel: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: cardTheme.muted,
  },
  counter: { fontFamily: settingsTypography.body, fontSize: 14, color: cardTheme.muted },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: cardTheme.field,
    backgroundColor: cardTheme.card,
    paddingHorizontal: 16,
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 17,
    color: cardTheme.ink,
  },
  helper: {
    marginTop: 8,
    marginHorizontal: 4,
    fontFamily: settingsTypography.body,
    fontSize: 14,
    color: cardTheme.muted,
  },
  noteTight: { marginTop: -4 },
  saveBlock: { marginHorizontal: 16, marginTop: 28 },
});
