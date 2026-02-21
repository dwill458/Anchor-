import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSettingsStore, type ActivationMode } from '@/stores/settingsStore';
import { colors, spacing, typography } from '@/theme';

const MODES: { key: ActivationMode; label: string }[] = [
  { key: 'ambient', label: 'Ambient' },
  { key: 'mantra', label: 'Voice' },
  { key: 'silent', label: 'Silent' },
];

export const SoundModeToggle: React.FC = () => {
  const defaultActivationMode = useSettingsStore((state) => state.defaultActivation.mode ?? 'silent');
  const setDefaultActivationMode = useSettingsStore((state) => state.setDefaultActivationMode);
  const mantraVoice = useSettingsStore((state) => state.mantraVoice);
  const setMantraVoice = useSettingsStore((state) => state.setMantraVoice);
  const [voiceSheetVisible, setVoiceSheetVisible] = useState(false);

  const voiceLabel = useMemo(
    () => (mantraVoice === 'generated' ? 'Voice One' : 'Silent'),
    [mantraVoice]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Sound</Text>
      <View style={styles.pills}>
        {MODES.map((mode) => {
          const selected = defaultActivationMode === mode.key;
          return (
            <Pressable
              key={mode.key}
              onPress={() => setDefaultActivationMode(mode.key)}
              style={[styles.pill, selected && styles.pillSelected]}
              accessibilityRole="button"
              accessibilityLabel={mode.label}
            >
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{mode.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {defaultActivationMode === 'mantra' ? (
        <TouchableOpacity
          onPress={() => setVoiceSheetVisible(true)}
          activeOpacity={0.8}
          style={styles.voiceMeta}
          accessibilityRole="button"
          accessibilityLabel={`Selected voice ${voiceLabel}`}
        >
          <Text style={styles.voiceMetaText}>{voiceLabel}</Text>
          <Text style={styles.voiceMetaHint}>Change</Text>
        </TouchableOpacity>
      ) : null}

      <Modal
        transparent
        visible={voiceSheetVisible}
        animationType="slide"
        onRequestClose={() => setVoiceSheetVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setVoiceSheetVisible(false)} />
          <View style={styles.voiceSheet}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFillObject} />
            ) : (
              <View style={[StyleSheet.absoluteFillObject, styles.androidFill]} />
            )}
            <Text style={styles.voiceTitle}>Voice</Text>
            <TouchableOpacity
              onPress={() => {
                setMantraVoice('generated');
                setVoiceSheetVisible(false);
              }}
              style={[styles.voiceOption, mantraVoice === 'generated' && styles.voiceOptionSelected]}
            >
              <Text style={styles.voiceOptionText}>Voice One</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setMantraVoice('my_voice');
                setVoiceSheetVisible(false);
              }}
              style={[styles.voiceOption, mantraVoice === 'my_voice' && styles.voiceOptionSelected]}
            >
              <Text style={styles.voiceOptionText}>Silent</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: typography.fontFamily.sansBold,
    color: colors.text.secondary,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  pillSelected: {
    borderColor: 'rgba(212,175,55,0.42)',
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  pillText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    color: colors.text.secondary,
  },
  pillTextSelected: {
    color: colors.gold,
    fontFamily: typography.fontFamily.sansBold,
  },
  voiceMeta: {
    marginTop: 2,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  voiceMetaText: {
    fontFamily: typography.fontFamily.sansBold,
    color: colors.text.primary,
    fontSize: 12,
  },
  voiceMetaHint: {
    fontFamily: typography.fontFamily.sans,
    color: colors.text.tertiary,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  voiceSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: 'rgba(12,17,24,0.94)',
    gap: spacing.sm,
  },
  androidFill: {
    backgroundColor: 'rgba(12,17,24,0.97)',
  },
  voiceTitle: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 22,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  voiceOption: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  voiceOptionSelected: {
    borderColor: 'rgba(212,175,55,0.45)',
    backgroundColor: 'rgba(212,175,55,0.14)',
  },
  voiceOptionText: {
    fontFamily: typography.fontFamily.sansBold,
    color: colors.text.primary,
    fontSize: 14,
  },
});
