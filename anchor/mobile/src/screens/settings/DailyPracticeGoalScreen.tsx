import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoalCard } from '@/components/settings/GoalCard';
import { useSettingsState } from '@/hooks/useSettings';
import { colors } from '@/theme';
import { SETTINGS_GOLD_DIM, SETTINGS_MUTED_TEXT, SETTINGS_SCREEN_BACKGROUND } from './shared';

const PRESET_GOALS = [1, 3, 5, 7] as const;

const clampGoal = (value: number): number => Math.min(20, Math.max(1, Math.round(value)));

export const DailyPracticeGoalScreen: React.FC = () => {
  const { settings, updateSetting } = useSettingsState();
  const initialSelectedPreset = useMemo(
    () =>
      PRESET_GOALS.includes(settings.focusBurstGoal as 1 | 3 | 5 | 7)
        ? settings.focusBurstGoal
        : null,
    [settings.focusBurstGoal]
  );
  const [selectedPreset, setSelectedPreset] = useState<number | null>(initialSelectedPreset);
  const [customCount, setCustomCount] = useState(
    PRESET_GOALS.includes(settings.focusBurstGoal as 1 | 3 | 5 | 7)
      ? 3
      : settings.focusBurstGoal
  );

  useEffect(() => {
    if (PRESET_GOALS.includes(settings.focusBurstGoal as 1 | 3 | 5 | 7)) {
      setSelectedPreset(settings.focusBurstGoal);
      return;
    }

    setSelectedPreset(null);
    setCustomCount(settings.focusBurstGoal);
  }, [settings.focusBurstGoal]);

  const handlePresetSelect = async (value: number) => {
    setSelectedPreset(value);
    await updateSetting('focusBurstGoal', value);
  };

  const handleCustomAdjust = async (delta: number) => {
    const nextValue = clampGoal(customCount + delta);
    setSelectedPreset(null);
    setCustomCount(nextValue);
    await updateSetting('focusBurstGoal', nextValue);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.pageHeader}>
          <Text style={styles.heading}>Daily Focus Goal</Text>
          <Text style={styles.subtitle}>Set a gentle target for consistency.</Text>
          <Text style={styles.note}>
            Counts Visual Focus sessions (10–60s). Deep Prime is optional.
          </Text>
        </View>

        {PRESET_GOALS.map((goal) => (
          <GoalCard
            key={goal}
            label={`${goal} Focus Burst${goal === 1 ? '' : 's'} / day`}
            value={goal}
            selected={selectedPreset === goal}
            onPress={() => handlePresetSelect(goal)}
          />
        ))}

        <View style={styles.customGoal}>
          <View style={styles.customText}>
            <Text style={styles.customTitle}>⚡ Custom</Text>
            <Text style={styles.customSubtitle}>1–20 Focus Bursts</Text>
          </View>
          <View style={styles.counter}>
            <Pressable
              onPress={() => handleCustomAdjust(-1)}
              style={({ pressed }) => [styles.counterButton, pressed ? styles.counterButtonPressed : null]}
            >
              <Text style={styles.counterButtonText}>−</Text>
            </Pressable>
            <Text style={styles.counterValue}>{customCount}</Text>
            <Pressable
              onPress={() => handleCustomAdjust(1)}
              style={({ pressed }) => [styles.counterButton, pressed ? styles.counterButtonPressed : null]}
            >
              <Text style={styles.counterButtonText}>+</Text>
            </Pressable>
          </View>
        </View>
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
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  heading: {
    marginBottom: 6,
    color: colors.gold,
    fontSize: 20,
    fontFamily: 'Cinzel-Regular',
  },
  subtitle: {
    color: SETTINGS_MUTED_TEXT,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  note: {
    marginTop: 4,
    color: SETTINGS_GOLD_DIM,
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  customGoal: {
    marginHorizontal: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  customText: {
    flex: 1,
  },
  customTitle: {
    marginBottom: 3,
    color: colors.bone,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  customSubtitle: {
    color: SETTINGS_MUTED_TEXT,
    fontSize: 11,
    fontFamily: 'Inter-Regular',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  counterButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  counterButtonPressed: {
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  counterButtonText: {
    color: colors.gold,
    fontSize: 18,
    lineHeight: 18,
  },
  counterValue: {
    minWidth: 20,
    color: colors.gold,
    fontSize: 18,
    fontFamily: 'Cinzel-Regular',
    textAlign: 'center',
  },
});
