import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSettingsStore, type ActivationMode } from '@/stores/settingsStore';
import { colors, spacing, typography } from '@/theme';

const MODES: { key: ActivationMode; label: string }[] = [
  { key: 'ambient', label: 'Ambient' },
  { key: 'silent', label: 'Silent' },
];

export const SoundModeToggle: React.FC = () => {
  const defaultActivationMode = useSettingsStore((state) => state.defaultActivation.mode ?? 'silent');
  const setDefaultActivationMode = useSettingsStore((state) => state.setDefaultActivationMode);
  const normalizedMode = useMemo(
    () => (defaultActivationMode === 'mantra' ? 'silent' : defaultActivationMode),
    [defaultActivationMode]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Sound</Text>
      <View style={styles.pills}>
        {MODES.map((mode) => {
          const selected = normalizedMode === mode.key;
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
});
