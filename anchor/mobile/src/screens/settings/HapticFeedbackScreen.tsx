import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InfoCard } from '@/components/settings/InfoCard';
import { PillSelector } from '@/components/settings/PillSelector';
import { useSettingsState } from '@/hooks/useSettings';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import { SETTINGS_MUTED_TEXT, SETTINGS_SCREEN_BACKGROUND } from './shared';

export const HapticFeedbackScreen: React.FC = () => {
  const { settings, updateSetting } = useSettingsState();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Haptic Feedback</Text>
        <Text style={styles.sectionDescription}>
          Choose the intensity of physical feedback during your practice.
        </Text>
        <PillSelector
          options={[
            { label: 'Strong', value: 'strong' },
            { label: 'Medium', value: 'medium' },
            { label: 'Soft', value: 'light' },
          ]}
          selected={settings.hapticFeedback}
          onSelect={(value) => {
            const level = value as 'strong' | 'medium' | 'light';
            updateSetting('hapticFeedback', level);
            
            if (level === 'strong') {
              void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
            } else if (level === 'medium') {
              void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
            } else if (level === 'light') {
              void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
        />

        <InfoCard
          title="Tactile Connection"
          body="Haptic feedback helps root you in the moment by pairing a physical sensation with your intention activations."
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SETTINGS_SCREEN_BACKGROUND,
  },
  content: {
    paddingBottom: 32,
  },
  sectionLabel: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    color: SETTINGS_MUTED_TEXT,
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionDescription: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    color: SETTINGS_MUTED_TEXT,
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
  },
});
