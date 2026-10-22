import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT, V2Button } from '@/components/v2/primitives';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';

export interface ConfirmDeleteAnchorSheetProps {
  visible: boolean;
  intentionText?: string;
  onBurnInstead: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

/**
 * Anchor 2.0 Confirm Delete Anchor Sheet.
 *
 * Prompts the user before deleting an anchor, offering the proper Burn & Release practice.
 * Built with Anchor 2.0 design language and spring bottom sheet physics.
 */
export const ConfirmDeleteAnchorSheet: React.FC<ConfirmDeleteAnchorSheetProps> = ({
  visible,
  intentionText,
  onBurnInstead,
  onDelete,
  onCancel,
}) => {
  const reduceMotion = useV2ReduceMotion();

  const handleBurnInstead = (): void => {
    v2Haptics.selection();
    onBurnInstead();
  };

  const handleDelete = (): void => {
    v2Haptics.destructiveCommit();
    onDelete();
  };

  const handleCancel = (): void => {
    v2Haptics.selection();
    onCancel();
  };

  return (
    <V2SheetModal
      visible={visible}
      onClose={onCancel}
      reduceMotion={reduceMotion}
      scrimAccessibilityLabel="Cancel deletion"
      testID="confirm-delete-anchor-sheet"
    >
      <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
        <V2SheetGrabZone>
          <View style={styles.handle} />
          <Text style={styles.eyebrow} accessibilityRole="none">
            ANCHOR ARCHIVE
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            Release is the proper practice.
          </Text>
        </V2SheetGrabZone>

        {intentionText ? (
          <View style={styles.intentionCard}>
            <Text style={styles.intention} numberOfLines={2}>
              "{intentionText}"
            </Text>
          </View>
        ) : null}

        <Text style={styles.body}>
          Deleting skips the ceremony and quietly archives this Anchor. If you are ready to let it go, Release is the intended path.
        </Text>

        <View style={styles.actions}>
          <V2Button
            variant="primary"
            size="large"
            onPress={handleBurnInstead}
            accessibilityLabel="Burn and Release"
            testID="confirm-delete-burn-instead-btn"
          >
            Release with Ceremony
          </V2Button>

          <V2Button
            variant="destructive"
            size="large"
            onPress={handleDelete}
            accessibilityLabel="Delete Anyway"
            testID="confirm-delete-anyway-btn"
          >
            Delete Anyway
          </V2Button>

          <V2Button
            variant="secondary"
            size="large"
            onPress={handleCancel}
            accessibilityLabel="Cancel"
            testID="confirm-delete-cancel-btn"
          >
            Keep Anchor
          </V2Button>
        </View>
      </SafeAreaView>
    </V2SheetModal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4] + V2_SHEET_SKIRT,
    marginBottom: -V2_SHEET_SKIRT,
    flexShrink: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.border.default,
    marginBottom: spacing[3],
  },
  eyebrow: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 0.8,
    marginBottom: spacing[1],
  },
  title: {
    ...typography.headingLG,
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  intentionCard: {
    marginTop: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    backgroundColor: colors.grouped,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  intention: {
    ...typography.bodyMD,
    fontStyle: 'italic',
    color: colors.text.primary,
  },
  body: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    marginTop: spacing[3],
    lineHeight: 22,
  },
  actions: {
    marginTop: spacing[5],
    gap: spacing[2],
  },
});

export default ConfirmDeleteAnchorSheet;
