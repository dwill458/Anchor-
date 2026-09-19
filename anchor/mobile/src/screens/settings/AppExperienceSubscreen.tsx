import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '@/components/settings/settingsTheme';
import {
  CompactConfirmSheet,
  CompactPickerSheet,
  SectionLabel,
  SettingsHeader,
  SettingsRow,
  SettingsToggleRow,
} from '@/components/settings/SettingsPrimitives';
import { useSettingsState } from '@/hooks/useSettings';
import { useSettingsStore, type ReduceMotionPreference } from '@/stores/settingsStore';
import { useTeachingStore } from '@/stores/teachingStore';
import { AnalyticsService } from '@/services/AnalyticsService';

interface Props {
  onBack: () => void;
}

type PickerType = 'haptics' | 'motion' | null;

const HAPTIC_OPTIONS = [
  { label: 'Strong', value: 'strong', desc: 'Prominent, tactile pulses' },
  { label: 'Standard', value: 'medium', desc: 'Balanced tactile feedback' },
  { label: 'Soft', value: 'light', desc: 'Gentle, subtle touches' },
];

const MOTION_OPTIONS = [
  { label: 'Device setting', value: 'system', desc: 'Follow system reduce motion preference' },
  { label: 'Reduced', value: 'on', desc: 'Minimize transitions and movement' },
  { label: 'Full', value: 'off', desc: 'Full fluid animations' },
];

export const AppExperienceSubscreen: React.FC<Props> = ({ onBack }) => {
  const [picker, setPicker] = useState<PickerType>(null);
  const [confirmResetTips, setConfirmResetTips] = useState(false);

  const { settings, updateSetting, isLoading } = useSettingsState();
  const reduceMotionPreference = useSettingsStore((s) => s.reduceMotion ?? 'system');
  const setReduceMotion = useSettingsStore((s) => s.setReduceMotion);

  const formatHapticLabel = (val: string): string => {
    if (val === 'strong') return 'Strong';
    if (val === 'light') return 'Soft';
    return 'Standard';
  };

  const formatMotionLabel = (val: ReduceMotionPreference): string => {
    if (val === 'on') return 'Reduced';
    if (val === 'off') return 'Full';
    return 'Device setting';
  };

  const handleResetTeachingTips = () => {
    useTeachingStore.getState().reset();
    AnalyticsService.track('teaching_reset');
    setConfirmResetTips(false);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <SettingsHeader title="App experience" onBack={onBack} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SectionLabel first>Interface</SectionLabel>
          <SettingsRow
            label="Haptic feedback"
            value={formatHapticLabel(settings.hapticFeedback)}
            onPress={() => setPicker('haptics')}
            disabled={isLoading}
            testID="settings-row-Haptic Feedback"
          />
          <SettingsToggleRow
            label="Sound effects"
            desc="Interface and practice sound effects"
            on={settings.soundEffectsEnabled}
            onToggle={(val) => void updateSetting('soundEffectsEnabled', val)}
            disabled={isLoading}
            testID="settings-row-Sound Effects"
          />
          <SettingsToggleRow
            label="Open to Practice"
            desc="Open directly to Practice when you return."
            on={settings.openDailyAnchorAutomatically}
            onToggle={(val) => void updateSetting('openDailyAnchorAutomatically', val)}
            disabled={isLoading}
            testID="settings-row-Open to Practice"
          />
          <SettingsRow
            label="Reduce motion"
            value={formatMotionLabel(reduceMotionPreference)}
            onPress={() => setPicker('motion')}
            disabled={isLoading}
            testID="settings-row-Reduce Motion"
          />

          <SectionLabel>Support Tools</SectionLabel>
          <SettingsRow
            label="Reset teaching tips"
            desc="Show first-use guidance again."
            onPress={() => setConfirmResetTips(true)}
            disabled={isLoading}
            showDivider={false}
            testID="settings-row-Reset Teaching Tips"
          />
        </ScrollView>
      </SafeAreaView>

      {/* Haptic Feedback Picker */}
      <CompactPickerSheet
        open={picker === 'haptics'}
        title="Haptic Feedback"
        options={HAPTIC_OPTIONS}
        value={settings.hapticFeedback}
        onPick={(val) => void updateSetting('hapticFeedback', val as any)}
        onClose={() => setPicker(null)}
      />

      {/* Reduce Motion Picker */}
      <CompactPickerSheet
        open={picker === 'motion'}
        title="Reduce Motion"
        options={MOTION_OPTIONS}
        value={reduceMotionPreference}
        onPick={(val) => setReduceMotion(val as ReduceMotionPreference)}
        onClose={() => setPicker(null)}
      />

      {/* Reset Teaching Tips Confirmation */}
      <CompactConfirmSheet
        open={confirmResetTips}
        title="Reset teaching tips?"
        desc="This will make first-use guidance available again."
        confirmLabel="Reset"
        onConfirm={handleResetTeachingTips}
        onClose={() => setConfirmResetTips(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
});
