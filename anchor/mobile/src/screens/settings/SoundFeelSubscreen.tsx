import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  GroupLabel,
  Segmented,
  SettingsGroup,
  SettingsScreenFrame,
  SwitchRow,
  cardTheme,
} from '@/components/settings/SettingsCards';
import { settingsTypography } from '@/components/settings/settingsTheme';
import { mapFeedbackToHapticIntensity, mapHapticIntensityToFeedback } from '@/utils/hapticFeedbackLevel';
import { useSettingsStore, type ReduceMotionPreference } from '@/stores/settingsStore';

interface Props {
  onBack: () => void;
}

type HapticValue = 'strong' | 'medium' | 'light';

const HAPTIC_OPTIONS: Array<{ label: string; value: HapticValue }> = [
  { label: 'Strong', value: 'strong' },
  { label: 'Standard', value: 'medium' },
  { label: 'Soft', value: 'light' },
];

const HAPTIC_HELP: Record<HapticValue, string> = {
  strong: 'Prominent, tactile pulses.',
  medium: 'Balanced tactile feedback.',
  light: 'Gentle, subtle touches.',
};

const MOTION_OPTIONS: Array<{ label: string; value: ReduceMotionPreference }> = [
  { label: 'Match device', value: 'system' },
  { label: 'Reduced', value: 'on' },
  { label: 'Full', value: 'off' },
];

const MOTION_HELP: Record<ReduceMotionPreference, string> = {
  system: "Follows your phone's Reduce Motion setting.",
  on: 'Minimizes transitions and movement.',
  off: 'Full, fluid animation.',
};

export const SoundFeelSubscreen: React.FC<Props> = ({ onBack }) => {
  const hapticIntensity = useSettingsStore((s) => s.hapticIntensity);
  const setHapticIntensity = useSettingsStore((s) => s.setHapticIntensity);
  const soundEffectsEnabled = useSettingsStore((s) => s.soundEffectsEnabled);
  const setSoundEffectsEnabled = useSettingsStore((s) => s.setSoundEffectsEnabled);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion ?? 'system');
  const setReduceMotion = useSettingsStore((s) => s.setReduceMotion);

  const mappedHaptic = mapHapticIntensityToFeedback(hapticIntensity ?? 55);
  const haptic: HapticValue = mappedHaptic === 'none' ? 'light' : mappedHaptic;

  return (
    <SettingsScreenFrame title="Sound & feel" onBack={onBack} testID="sound-feel-screen">
      <GroupLabel first>Haptics</GroupLabel>
      <SettingsGroup>
        <View>
        <View style={styles.segmentBlock}>
          <Segmented
            options={HAPTIC_OPTIONS}
            value={haptic}
            onChange={(value) => setHapticIntensity(mapFeedbackToHapticIntensity(value))}
            label="Haptic feedback"
            compact
            inset={false}
            testIDPrefix="settings-haptics"
          />
        </View>
        <Text style={styles.help}>{HAPTIC_HELP[haptic]}</Text>
        </View>
      </SettingsGroup>

      <GroupLabel>Sound</GroupLabel>
      <SettingsGroup>
        <SwitchRow
          title="Sound effects"
          subtitle="Interface and practice sounds"
          on={soundEffectsEnabled}
          onChange={setSoundEffectsEnabled}
          testID="settings-row-Sound Effects"
        />
      </SettingsGroup>

      <GroupLabel>Motion</GroupLabel>
      <SettingsGroup>
        <View>
        <View style={styles.segmentBlock}>
          <Segmented
            options={MOTION_OPTIONS}
            value={reduceMotion}
            onChange={setReduceMotion}
            label="Motion"
            compact
            inset={false}
            testIDPrefix="settings-motion"
          />
        </View>
        <Text style={styles.help}>{MOTION_HELP[reduceMotion]}</Text>
        </View>
      </SettingsGroup>
    </SettingsScreenFrame>
  );
};

const styles = StyleSheet.create({
  segmentBlock: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  help: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
    fontFamily: settingsTypography.body,
    fontSize: 14,
    color: cardTheme.muted,
  },
});
