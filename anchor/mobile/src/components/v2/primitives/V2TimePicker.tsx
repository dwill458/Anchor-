import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { v2Haptics } from '@/hooks/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';

export interface V2TimePickerProps {
  value: Date;
  onChange: (nextDate: Date) => void;
  testID?: string;
}

const COMMON_MINUTES = [0, 15, 30, 45];
const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Anchor 2.0 Time Picker.
 *
 * Grounded editorial replacement for native iOS UIDatePicker and Android TimePickerDialog.
 * Displays hours and minutes on warm paper with 44pt+ touch targets and haptics.
 */
export function V2TimePicker({
  value,
  onChange,
  testID = 'custom-time-picker',
}: V2TimePickerProps) {
  const currentHours24 = value.getHours();
  const currentMinutes = value.getMinutes();

  const isPM = currentHours24 >= 12;
  const currentHours12 = currentHours24 % 12 || 12;

  const setTime = useCallback(
    (newHours12: number, newMinutes: number, newIsPM: boolean) => {
      v2Haptics.selection();
      const updatedDate = new Date(value.getTime());
      let hours24 = newHours12 % 12;
      if (newIsPM) hours24 += 12;
      updatedDate.setHours(hours24, newMinutes, 0, 0);
      onChange(updatedDate);
    },
    [onChange, value]
  );

  const toggleMeridiem = useCallback(
    (nextIsPM: boolean) => {
      if (nextIsPM === isPM) return;
      setTime(currentHours12, currentMinutes, nextIsPM);
    },
    [currentHours12, currentMinutes, isPM, setTime]
  );

  const stepHour = useCallback(
    (delta: number) => {
      let nextH = currentHours12 + delta;
      if (nextH > 12) nextH = 1;
      if (nextH < 1) nextH = 12;
      setTime(nextH, currentMinutes, isPM);
    },
    [currentHours12, currentMinutes, isPM, setTime]
  );

  const stepMinute = useCallback(
    (delta: number) => {
      let nextM = currentMinutes + delta;
      if (nextM >= 60) nextM = 0;
      if (nextM < 0) nextM = 55;
      setTime(currentHours12, nextM, isPM);
    },
    [currentHours12, currentMinutes, isPM, setTime]
  );

  const formattedHour = String(currentHours12).padStart(2, '0');
  const formattedMinute = String(currentMinutes).padStart(2, '0');

  return (
    <View testID={testID} style={styles.container} accessibilityRole="none">
      {/* Time Display Header with Steppers */}
      <View style={styles.clockRow}>
        {/* Hour Column */}
        <View style={styles.column}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase hour"
            onPress={() => stepHour(1)}
            style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperPressed]}
          >
            <ChevronUp size={20} color={colors.text.primary} />
          </Pressable>
          <View style={styles.digitBox}>
            <Text style={styles.digitText}>{formattedHour}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease hour"
            onPress={() => stepHour(-1)}
            style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperPressed]}
          >
            <ChevronDown size={20} color={colors.text.primary} />
          </Pressable>
        </View>

        <Text style={styles.colon}>:</Text>

        {/* Minute Column */}
        <View style={styles.column}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase minute"
            onPress={() => stepMinute(5)}
            style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperPressed]}
          >
            <ChevronUp size={20} color={colors.text.primary} />
          </Pressable>
          <View style={styles.digitBox}>
            <Text style={styles.digitText}>{formattedMinute}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease minute"
            onPress={() => stepMinute(-5)}
            style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperPressed]}
          >
            <ChevronDown size={20} color={colors.text.primary} />
          </Pressable>
        </View>

        {/* AM / PM Segment */}
        <View style={styles.meridiemColumn}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: !isPM }}
            accessibilityLabel="AM"
            onPress={() => toggleMeridiem(false)}
            style={[styles.meridiemPill, !isPM && styles.meridiemPillActive]}
          >
            <Text style={[styles.meridiemText, !isPM && styles.meridiemTextActive]}>AM</Text>
          </Pressable>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: isPM }}
            accessibilityLabel="PM"
            onPress={() => toggleMeridiem(true)}
            style={[styles.meridiemPill, isPM && styles.meridiemPillActive]}
          >
            <Text style={[styles.meridiemText, isPM && styles.meridiemTextActive]}>PM</Text>
          </Pressable>
        </View>
      </View>

      {/* Quick Minutes Selection */}
      <View style={styles.quickMinutesRow}>
        {COMMON_MINUTES.map((m) => {
          const selected = currentMinutes === m;
          const label = `:${String(m).padStart(2, '0')}`;
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityLabel={`Set minute to ${label}`}
              accessibilityState={{ selected }}
              onPress={() => setTime(currentHours12, m, isPM)}
              style={[styles.minuteChip, selected && styles.minuteChipActive]}
            >
              <Text style={[styles.minuteChipText, selected && styles.minuteChipTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    gap: spacing[3],
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  column: {
    alignItems: 'center',
    gap: 4,
  },
  stepperButton: {
    width: 44,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.grouped,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperPressed: {
    backgroundColor: colors.border.default,
  },
  digitBox: {
    width: 64,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: {
    ...typography.numericMedium,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  colon: {
    ...typography.headingXL,
    fontSize: 28,
    lineHeight: 32,
    color: colors.text.secondary,
    paddingBottom: 2,
  },
  meridiemColumn: {
    marginLeft: spacing[2],
    borderRadius: radii.md,
    backgroundColor: colors.grouped,
    padding: 3,
    gap: 3,
  },
  meridiemPill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    minWidth: 44,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meridiemPillActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  meridiemText: {
    ...typography.labelMD,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  meridiemTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  quickMinutesRow: {
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'center',
    width: '100%',
    paddingTop: 2,
  },
  minuteChip: {
    flex: 1,
    minHeight: 38,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.grouped,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minuteChipActive: {
    backgroundColor: colors.text.primary,
  },
  minuteChipText: {
    ...typography.labelSM,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  minuteChipTextActive: {
    color: colors.text.inverse,
    fontWeight: '700',
  },
});
