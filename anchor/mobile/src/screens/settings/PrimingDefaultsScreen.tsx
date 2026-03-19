import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsState } from '@/hooks/useSettings';
import { DurationGrid } from '@/components/settings/DurationGrid';
import { InfoCard } from '@/components/settings/InfoCard';
import { OptionCard } from '@/components/settings/OptionCard';
import {
  SETTINGS_MUTED_TEXT,
  SETTINGS_SCREEN_BACKGROUND,
} from './shared';

export const PrimingDefaultsScreen: React.FC = () => {
  const { settings, updateSetting } = useSettingsState();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Priming Mode</Text>
        <Text style={styles.sectionDescription}>
          Choose your preferred approach for daily anchor priming.
        </Text>

        <OptionCard
          icon="⚡"
          title="Quick Prime"
          description="Brief, focused alignment session"
          selected={settings.primingMode === 'quick'}
          onPress={() => updateSetting('primingMode', 'quick')}
        />
        <OptionCard
          icon="◎"
          title="Deep Prime"
          description="Extended, immersive practice"
          selected={settings.primingMode === 'deep'}
          onPress={() => updateSetting('primingMode', 'deep')}
        />

        <Text style={[styles.sectionLabel, styles.sectionLabelOffset]}>Default Duration</Text>
        <Text style={styles.sectionDescription}>Quick Prime uses faster preset durations.</Text>

        <DurationGrid
          options={[
            { label: '30s', value: 30 },
            { label: '2 min', value: 120 },
            { label: '5 min', value: 300, fullWidth: true },
          ]}
          selected={settings.primingDuration}
          onSelect={(value) => updateSetting('primingDuration', value as 30 | 120 | 300)}
        />

        <InfoCard
          title="About Priming"
          body="Priming your anchor daily strengthens the neurological bond between the symbol and your intention — making the belief easier to access under pressure."
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
  sectionLabelOffset: {
    marginTop: 8,
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
