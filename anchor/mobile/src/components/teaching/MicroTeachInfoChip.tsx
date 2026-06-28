/**
 * MicroTeachInfoChip — always-accessible "Why this matters" affordance.
 *
 * A small, subtle gold info chip. Tapping opens a MicroTeachBottomSheet with
 * the referenced teaching(s). This is intentionally ungated and repeatable:
 * it never records a show or marks a first-time tip complete, so guidance
 * stays reachable after the contextual tip has been dismissed.
 */
import React, { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { InfoIcon } from '@/components/icons/InfoIcon';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { AnalyticsService } from '@/services/AnalyticsService';
import { MicroTeachBottomSheet } from './MicroTeachBottomSheet';

interface MicroTeachInfoChipProps {
  /** Registry id(s) shown in the sheet when tapped. */
  teachingIds: string | string[];
  screenId: string;
  /** Chip label. Defaults to "Why this matters". */
  label?: string;
  /** Optional sheet heading. */
  sheetTitle?: string;
  style?: StyleProp<ViewStyle>;
}

export const MicroTeachInfoChip: React.FC<MicroTeachInfoChipProps> = ({
  teachingIds,
  screenId,
  label = 'Why this matters',
  sheetTitle,
  style,
}) => {
  const [open, setOpen] = useState(false);
  const ids = Array.isArray(teachingIds) ? teachingIds : [teachingIds];

  const handleOpen = () => {
    void safeHaptics.selection();
    AnalyticsService.track('teaching_info_opened', {
      teaching_id: ids[0],
      screen: screenId,
    });
    setOpen(true);
  };

  return (
    <>
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed, style]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <InfoIcon size={14} color={colors.gold} />
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      <MicroTeachBottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        teachingIds={ids}
        title={sheetTitle}
      />
    </>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
  },
  chipPressed: {
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
  },
  label: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: colors.gold,
  },
});
