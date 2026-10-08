import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT, V2Button } from '@/components/v2/primitives';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  body: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onBackdropPress?: () => void;
}

/**
 * Anchor 2.0 Confirmation Bottom Sheet Modal.
 *
 * Used for session exit confirmations and irreversible practice transitions.
 * Rebuilt from legacy 1.0 gold/dark modal into Anchor 2.0 design language
 * with paper surface, Figtree/Inter typography, and spring physics.
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  body,
  primaryCtaLabel,
  secondaryCtaLabel,
  onPrimary,
  onSecondary,
  onBackdropPress,
}) => {
  const reduceMotion = useV2ReduceMotion();

  const handlePrimary = () => {
    v2Haptics.selection();
    onPrimary();
  };

  const handleSecondary = () => {
    v2Haptics.destructiveCommit();
    onSecondary();
  };

  const handleClose = () => {
    v2Haptics.selection();
    if (onBackdropPress) {
      onBackdropPress();
    } else {
      onPrimary();
    }
  };

  return (
    <V2SheetModal
      visible={visible}
      onClose={handleClose}
      reduceMotion={reduceMotion}
      scrimAccessibilityLabel="Dismiss confirmation"
      testID="confirm-modal-sheet"
    >
      <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
        <V2SheetGrabZone>
          <View style={styles.handle} />
          <Text style={styles.eyebrow} accessibilityRole="none">
            CONFIRMATION
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>
        </V2SheetGrabZone>

        <View style={styles.buttonGroup}>
          <V2Button
            variant="primary"
            size="large"
            onPress={handlePrimary}
            accessibilityLabel={primaryCtaLabel}
            testID="confirm-modal-primary"
          >
            {primaryCtaLabel}
          </V2Button>
          <V2Button
            variant="secondary"
            size="medium"
            onPress={handleSecondary}
            accessibilityLabel={secondaryCtaLabel}
            testID="confirm-modal-secondary"
            style={styles.secondaryButton}
          >
            {secondaryCtaLabel}
          </V2Button>
        </View>
      </SafeAreaView>
    </V2SheetModal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[4] + V2_SHEET_SKIRT,
    marginBottom: -V2_SHEET_SKIRT,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border.default,
    alignSelf: 'center',
    marginBottom: spacing[3],
  },
  eyebrow: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 1.2,
    marginBottom: spacing[1],
    textTransform: 'uppercase',
  },
  title: {
    ...typography.headingSM,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  body: {
    ...typography.bodySM,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing[4],
  },
  buttonGroup: {
    gap: spacing[2],
  },
  secondaryButton: {
    minHeight: 48,
  },
});
