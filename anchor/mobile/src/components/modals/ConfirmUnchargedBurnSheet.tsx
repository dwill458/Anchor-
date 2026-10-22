import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT, V2Button } from '@/components/v2/primitives';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';

export interface ConfirmUnchargedBurnSheetProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  intentionText?: string;
}

/**
 * Anchor 2.0 Confirm Uncharged Burn Sheet.
 *
 * Warning for users attempting to burn/release an uncharged anchor.
 * Built with Anchor 2.0 design language and spring bottom sheet physics.
 */
export const ConfirmUnchargedBurnSheet: React.FC<ConfirmUnchargedBurnSheetProps> = ({
  visible,
  onConfirm,
  onCancel,
  intentionText,
}) => {
  const reduceMotion = useV2ReduceMotion();

  const handleConfirm = (): void => {
    v2Haptics.destructiveCommit();
    onConfirm();
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
      scrimAccessibilityLabel="Cancel release"
      testID="confirm-uncharged-burn-sheet"
    >
      <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
        <V2SheetGrabZone>
          <View style={styles.handle} />
          <Text style={styles.eyebrow} accessibilityRole="none">
            UNGROUNDED INTENTION
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            Release before priming?
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
          This Anchor has not been primed or practiced with. Releasing it now disperses the intention before it has taken root in your daily rhythm.
        </Text>

        <View style={styles.actions}>
          <V2Button
            variant="destructive"
            size="large"
            onPress={handleConfirm}
            accessibilityLabel="Release Anyway"
            testID="confirm-uncharged-burn-confirm-btn"
          >
            Release Anyway
          </V2Button>

          <V2Button
            variant="secondary"
            size="large"
            onPress={handleCancel}
            accessibilityLabel="Keep Anchor"
            testID="confirm-uncharged-burn-cancel-btn"
          >
            Keep & Practice
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

export default ConfirmUnchargedBurnSheet;
