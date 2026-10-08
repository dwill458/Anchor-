import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from './V2SheetModal';
import { V2Button } from './V2Button';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';

export interface V2ConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  eyebrow?: string;
  type?: 'confirm' | 'alert';
  onConfirm: () => void;
  onCancel?: () => void;
  testID?: string;
}

/**
 * Anchor 2.0 bottom sheet confirmation & alert.
 *
 * Grounded editorial replacement for native iOS UIAlertController and
 * Android AlertDialog. Springs from the lower edge on warm paper (#FBF9F4),
 * provides 44pt touch targets, supports haptics, and dismisses on flick.
 */
export function V2ConfirmSheet({
  visible,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  eyebrow,
  type = 'confirm',
  onConfirm,
  onCancel,
  testID = 'v2-confirm-sheet',
}: V2ConfirmSheetProps) {
  const reduceMotion = useV2ReduceMotion();

  const handleConfirm = () => {
    if (loading) return;
    if (destructive) {
      v2Haptics.destructiveCommit();
    } else {
      v2Haptics.confirmation();
    }
    onConfirm();
  };

  const handleCancel = () => {
    if (loading) return;
    v2Haptics.selection();
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  return (
    <V2SheetModal
      visible={visible}
      onClose={loading ? () => undefined : onClose}
      reduceMotion={reduceMotion}
      scrimAccessibilityLabel="Close"
      testID={testID}
    >
      <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
        <V2SheetGrabZone>
          <View style={styles.handle} />
          {eyebrow ? (
            <Text style={styles.eyebrow} accessibilityRole="none">
              {eyebrow}
            </Text>
          ) : null}
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </V2SheetGrabZone>

        <View style={styles.actions}>
          <V2Button
            variant={destructive ? 'destructive' : 'primary'}
            size="large"
            loading={loading}
            onPress={handleConfirm}
            testID={`${testID}-confirm`}
            accessibilityLabel={confirmLabel}
          >
            {confirmLabel}
          </V2Button>

          {type === 'confirm' ? (
            <V2Button
              variant="secondary"
              size="large"
              disabled={loading}
              onPress={handleCancel}
              testID={`${testID}-cancel`}
              accessibilityLabel={cancelLabel}
            >
              {cancelLabel}
            </V2Button>
          ) : null}
        </View>
      </SafeAreaView>
    </V2SheetModal>
  );
}

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
  message: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    marginTop: spacing[2],
    lineHeight: 22,
  },
  actions: {
    marginTop: spacing[5],
    gap: spacing[3],
  },
});
