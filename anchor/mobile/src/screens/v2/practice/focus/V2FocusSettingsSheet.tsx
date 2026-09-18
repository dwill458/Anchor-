import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { practiceColors } from '@/theme/v2/practiceColors';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { GuidanceVoice } from '@/types/sessionAudio';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { safeHaptics } from '@/utils/haptics';

export interface V2FocusSettingsSheetProps {
  visible: boolean;
  voice: GuidanceVoice;
  ambient: boolean;
  onVoiceChange: (voice: GuidanceVoice) => void;
  onAmbientChange: (ambient: boolean) => void;
  onClose: () => void;
}

export function V2FocusSettingsSheet({
  visible,
  voice,
  ambient,
  onVoiceChange,
  onAmbientChange,
  onClose,
}: V2FocusSettingsSheetProps) {
  const insets = useSafeAreaInsets();
  const [makeDefault, setMakeDefault] = useState(false);
  const userId = useAuthStore((state) => state.user?.id);

  const handleDone = () => {
    if (makeDefault) {
      useSettingsStore
        .getState()
        .setSessionAudioDefaults(
          'focus',
          {
            guidanceVoice: voice,
            backgroundAudio: ambient ? 'ambient' : 'off',
          },
          userId
        );
    }
    onClose();
  };

  const handleSelectVoice = (nextVoice: GuidanceVoice) => {
    void safeHaptics.selection();
    onVoiceChange(nextVoice);
  };

  const handleSelectAmbient = (nextAmbient: boolean) => {
    void safeHaptics.selection();
    onAmbientChange(nextAmbient);
  };

  const toggleMakeDefault = () => {
    void safeHaptics.selection();
    setMakeDefault((prev) => !prev);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropDismiss}
          accessibilityLabel="Dismiss settings"
          onPress={onClose}
        />
        <View
          testID="v2-focus-settings-sheet"
          style={[
            styles.sheet,
            { paddingBottom: Math.max(26, insets.bottom + 16) },
          ]}
        >
          <View style={styles.handle} />

          <Text style={styles.sectionEyebrow}>Guidance</Text>
          <View style={styles.optionGroup}>
            <OptionRow
              label="Female Voice"
              selected={voice === 'female'}
              onPress={() => handleSelectVoice('female')}
              testID="focus-voice-female"
            />
            <OptionRow
              label="Male Voice"
              selected={voice === 'male'}
              onPress={() => handleSelectVoice('male')}
              testID="focus-voice-male"
            />
            <OptionRow
              label="No Voice"
              selected={voice === 'none'}
              onPress={() => handleSelectVoice('none')}
              testID="focus-voice-none"
            />
          </View>

          <Text style={[styles.sectionEyebrow, { marginTop: spacing[4] }]}>
            Background
          </Text>
          <View style={styles.optionGroup}>
            <OptionRow
              label="Ambient"
              selected={ambient}
              onPress={() => handleSelectAmbient(true)}
              testID="focus-ambient-on"
            />
            <OptionRow
              label="Silence"
              selected={!ambient}
              onPress={() => handleSelectAmbient(false)}
              testID="focus-ambient-off"
            />
          </View>

          <Pressable
            testID="focus-make-default-toggle"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: makeDefault }}
            accessibilityLabel="Also make this my default"
            onPress={toggleMakeDefault}
            style={styles.defaultRow}
          >
            <View
              style={[
                styles.checkbox,
                makeDefault && styles.checkboxChecked,
              ]}
            >
              {makeDefault && <Check size={10} color="#FFFFFF" strokeWidth={2.5} />}
            </View>
            <Text style={styles.defaultLabel}>Also make this my default</Text>
          </Pressable>

          <View style={styles.doneContainer}>
            <V2Button
              size="large"
              onPress={handleDone}
              accessibilityLabel="Done"
              testID="focus-settings-done"
              style={{ backgroundColor: '#5C3A82' }}
            >
              Done
            </V2Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function OptionRow({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}${selected ? ', selected' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        pressed && styles.optionRowPressed,
      ]}
    >
      <Text
        style={[
          styles.optionLabel,
          selected ? styles.optionLabelSelected : null,
        ]}
      >
        {label}
      </Text>
      {selected ? (
        <Check size={16} color={practiceColors.focus} strokeWidth={2.4} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 20, 15, 0.4)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.default,
    alignSelf: 'center',
    marginBottom: 18,
  },
  sectionEyebrow: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 0.7,
  },
  optionGroup: {
    marginTop: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: 13,
    paddingHorizontal: 2,
  },
  optionRowPressed: {
    opacity: 0.7,
  },
  optionLabel: {
    ...typography.bodyMD,
    fontSize: 15,
    color: colors.text.primary,
  },
  optionLabelSelected: {
    fontFamily: typography.bodyBold,
    fontWeight: '700',
  },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 2,
    minHeight: 36,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.text.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.text.secondary,
  },
  defaultLabel: {
    ...typography.caption,
    fontFamily: typography.bodySemiBold,
    fontSize: 12.5,
    color: colors.text.secondary,
  },
  doneContainer: {
    marginTop: 18,
  },
});
