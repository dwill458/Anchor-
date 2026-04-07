import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InfoCard } from '@/components/settings/InfoCard';
import { PillSelector } from '@/components/settings/PillSelector';
import { useSettingsState } from '@/hooks/useSettings';
import { colors } from '@/theme';
import { SETTINGS_MUTED_TEXT, SETTINGS_SCREEN_BACKGROUND } from './shared';

const FOCUS_PRESETS = [10, 30, 60] as const;

const clampFocus = (value: number): number => Math.min(60, Math.max(10, Math.round(value)));

export const DefaultFocusModeScreen: React.FC = () => {
  const { settings, updateSetting } = useSettingsState();
  const derivedSelection = useMemo(
    () =>
      FOCUS_PRESETS.includes(settings.focusDuration as 10 | 30 | 60)
        ? settings.focusDuration
        : 'custom',
    [settings.focusDuration]
  );
  const initialCustomValue = useMemo(
    () => (derivedSelection === 'custom' ? settings.focusDuration : 20),
    [derivedSelection, settings.focusDuration]
  );
  const [durationSelection, setDurationSelection] = useState<string | number>(derivedSelection);
  const [customValue, setCustomValue] = useState(String(initialCustomValue));

  useEffect(() => {
    setDurationSelection(derivedSelection);
    setCustomValue(String(initialCustomValue));
  }, [derivedSelection, initialCustomValue]);

  const applyCustomValue = async (nextValue: number) => {
    const clampedValue = clampFocus(nextValue);
    setDurationSelection('custom');
    setCustomValue(String(clampedValue));
    await updateSetting('focusDuration', clampedValue);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* DEFERRED: v1.1 — Focus Type selector (Visual / Mantra / Full Prime) */}

        <Text style={styles.sectionLabel}>Focus Duration</Text>
        <Text style={styles.sectionDescription}>
          Visual Focus runs for 10–60 seconds. Choose a preset or set a custom duration.
        </Text>
        <PillSelector
          options={[
            { label: '10s', value: 10 },
            { label: '30s', value: 30 },
            { label: '60s', value: 60 },
            { label: 'Custom', value: 'custom' },
          ]}
          selected={durationSelection}
          onSelect={(value) => {
            if (value === 'custom') {
              setDurationSelection('custom');
              setCustomValue((current) => current || '20');
              return;
            }
            setDurationSelection(value);
            updateSetting('focusDuration', value as 10 | 30 | 60);
          }}
        />

        {durationSelection === 'custom' ? (
          <View style={styles.customDurationRow}>
            <Text style={styles.customLabel}>Custom Duration</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => applyCustomValue(Number(customValue || 20) - 1)}
                style={({ pressed }) => [styles.stepButton, pressed ? styles.stepButtonPressed : null]}
              >
                <Text style={styles.stepButtonText}>−</Text>
              </Pressable>
              <TextInput
                value={customValue}
                onChangeText={setCustomValue}
                onEndEditing={() => applyCustomValue(Number(customValue || 20))}
                keyboardType="number-pad"
                style={styles.customInput}
                maxLength={2}
              />
              <Pressable
                onPress={() => applyCustomValue(Number(customValue || 20) + 1)}
                style={({ pressed }) => [styles.stepButton, pressed ? styles.stepButtonPressed : null]}
              >
                <Text style={styles.stepButtonText}>+</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Default Mode</Text>
        <Text style={styles.sectionDescription}>
          How you want to show up for each priming session.
        </Text>
        <PillSelector
          options={[
            { label: 'Silent', value: 'silent' },
            { label: 'Ambient', value: 'ambient' },
          ]}
          selected={settings.focusDefaultMode}
          onSelect={(value) =>
            updateSetting('focusDefaultMode', value as 'silent' | 'ambient')
          }
        />
        {/* DEFERRED: v1.1 — Mantra pill option */}

        <InfoCard
          title="About Your Practice"
          body="Your daily practice reconnects you with your anchor's intention. This setting determines your preferred starting point — you can always adjust in the moment."
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
  customDurationRow: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customLabel: {
    color: colors.bone,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  stepButtonPressed: {
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  stepButtonText: {
    color: colors.gold,
    fontSize: 18,
    lineHeight: 18,
  },
  customInput: {
    minWidth: 42,
    color: colors.gold,
    fontSize: 18,
    fontFamily: 'Cinzel-Regular',
    textAlign: 'center',
    paddingVertical: 0,
  },
});
