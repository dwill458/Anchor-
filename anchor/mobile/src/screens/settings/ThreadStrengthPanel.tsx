import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  RadioRow,
  SettingsGroup,
  SettingsScreenFrame,
  cardTheme,
} from '@/components/settings/SettingsCards';
import { settingsTypography } from '@/components/settings/settingsTheme';
import { apiClient } from '@/services/ApiClient';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore, type ThreadStrengthSensitivity } from '@/stores/settingsStore';
import { logger } from '@/utils/logger';

interface Props {
  onBack: () => void;
}

type DayState = 'practiced' | 'holds' | 'thins';

const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

const OPTIONS: Array<{
  id: ThreadStrengthSensitivity;
  label: string;
  description: string;
  week: DayState[];
}> = [
  {
    id: 'lenient',
    label: 'Lenient',
    description: 'Miss up to 2 days and your thread holds. Any thinning is gradual.',
    week: ['practiced', 'practiced', 'practiced', 'holds', 'holds', 'practiced', 'practiced'],
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'One missed day pauses your thread. Two in a row and it starts to thin.',
    week: ['practiced', 'practiced', 'practiced', 'holds', 'thins', 'practiced', 'practiced'],
  },
  {
    id: 'strict',
    label: 'Strict',
    description: 'Every missed day thins your thread.',
    week: ['practiced', 'practiced', 'practiced', 'thins', 'thins', 'practiced', 'practiced'],
  },
];

const Dot: React.FC<{ state: DayState; size?: number }> = ({ state, size = 14 }) => (
  <View
    style={[
      { width: size, height: size, borderRadius: size / 2 },
      state === 'practiced' && { backgroundColor: cardTheme.ink },
      state === 'holds' && { borderWidth: 2, borderColor: cardTheme.muted },
      state === 'thins' && { backgroundColor: cardTheme.thin },
    ]}
  />
);

export const ThreadStrengthPanel: React.FC<Props> = ({ onBack }) => {
  const sensitivity = useSettingsStore((s) => s.threadStrengthSensitivity ?? 'balanced');
  const setSensitivity = useSettingsStore((s) => s.setThreadStrengthSensitivity);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const choose = (next: ThreadStrengthSensitivity) => {
    if (next === sensitivity) return;
    setSensitivity(next);
    if (isAuthenticated) {
      void apiClient.put('/api/auth/settings', { threadStrengthSensitivity: next }).catch((error) => {
        // The choice is already saved on this device and syncs again on the next settings write.
        logger.warn('[ThreadStrengthPanel] Failed to sync Thread Strength choice', error);
      });
    }
  };

  return (
    <SettingsScreenFrame title="Thread Strength" onBack={onBack} testID="thread-strength-screen">
      <Text style={styles.intro}>
        Choose what happens to your thread when you miss a day. Each example shows the same week.
      </Text>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Dot state="practiced" size={12} />
          <Text style={styles.legendText}>Practiced</Text>
        </View>
        <View style={styles.legendItem}>
          <Dot state="holds" size={12} />
          <Text style={styles.legendText}>Missed, thread holds</Text>
        </View>
        <View style={styles.legendItem}>
          <Dot state="thins" size={12} />
          <Text style={styles.legendText}>Thread thins</Text>
        </View>
      </View>

      <SettingsGroup accessibilityRole="radiogroup" accessibilityLabel="Thread Strength behavior">
        {OPTIONS.map((option) => (
          <RadioRow
            key={option.id}
            title={option.label}
            subtitle={option.description}
            selected={sensitivity === option.id}
            onPress={() => choose(option.id)}
            topAligned
            testID={`thread-strength-${option.id}`}
          >
            <View style={styles.week}>
              {option.week.map((state, index) => (
                <View key={index} style={styles.day}>
                  <Dot state={state} />
                  <Text style={styles.dayLetter}>{WEEK_LETTERS[index]}</Text>
                </View>
              ))}
            </View>
          </RadioRow>
        ))}
      </SettingsGroup>

      <Text style={styles.saved}>Saved as soon as you choose.</Text>
    </SettingsScreenFrame>
  );
};

const styles = StyleSheet.create({
  intro: {
    marginTop: 12,
    marginHorizontal: 20,
    fontFamily: settingsTypography.body,
    fontSize: 16,
    lineHeight: 22,
    color: cardTheme.muted,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 16,
    rowGap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: settingsTypography.body, fontSize: 13, color: cardTheme.muted },
  week: { flexDirection: 'row', gap: 4, marginTop: 10 },
  day: { width: 30, alignItems: 'center', gap: 5 },
  dayLetter: { fontFamily: settingsTypography.body, fontSize: 12, color: cardTheme.muted },
  saved: {
    marginTop: 16,
    marginHorizontal: 20,
    textAlign: 'center',
    fontFamily: settingsTypography.body,
    fontSize: 14,
    color: cardTheme.muted,
  },
});
