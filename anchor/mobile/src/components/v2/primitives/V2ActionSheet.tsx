import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from './V2SheetModal';
import { V2Button } from './V2Button';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';

export interface V2ActionSheetItem {
  key: string;
  label: string;
  detail?: string;
  destructive?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface V2ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  actions: ReadonlyArray<V2ActionSheetItem>;
  onSelect: (key: string) => void;
  cancelLabel?: string;
  testID?: string;
}

/**
 * Anchor 2.0 Action Sheet.
 *
 * Full platform-agnostic replacement for ActionSheetIOS and native picker dialogs.
 * Displays actions on warm paper surface with 44pt+ touch targets and haptics.
 */
export function V2ActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  actions,
  onSelect,
  cancelLabel = 'Cancel',
  testID = 'v2-action-sheet',
}: V2ActionSheetProps) {
  const reduceMotion = useV2ReduceMotion();

  const handleSelect = (key: string, destructive?: boolean) => {
    if (destructive) {
      v2Haptics.destructiveCommit();
    } else {
      v2Haptics.selection();
    }
    onClose();
    onSelect(key);
  };

  return (
    <V2SheetModal
      visible={visible}
      onClose={onClose}
      reduceMotion={reduceMotion}
      scrimAccessibilityLabel="Close"
      testID={testID}
    >
      <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
        <V2SheetGrabZone>
          <View style={styles.handle} />
          {title ? (
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          ) : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </V2SheetGrabZone>

        <View style={styles.actionsList}>
          {actions.map((action, index) => {
            const isDestructive = action.destructive;
            return (
              <Pressable
                key={action.key}
                testID={`${testID}-item-${action.key}`}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityHint={action.detail}
                disabled={action.disabled}
                onPress={() => handleSelect(action.key, isDestructive)}
                style={({ pressed }) => [
                  styles.actionRow,
                  index > 0 && styles.rowBorder,
                  pressed && styles.actionRowPressed,
                  action.disabled && styles.actionRowDisabled,
                ]}
              >
                {action.icon ? <View style={styles.iconContainer}>{action.icon}</View> : null}
                <View style={styles.textContainer}>
                  <Text
                    style={[
                      styles.actionLabel,
                      isDestructive && styles.actionLabelDestructive,
                      action.disabled && styles.actionLabelDisabled,
                    ]}
                  >
                    {action.label}
                  </Text>
                  {action.detail ? (
                    <Text style={styles.actionDetail}>{action.detail}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.cancelContainer}>
          <V2Button
            variant="secondary"
            size="large"
            onPress={onClose}
            testID={`${testID}-cancel`}
            accessibilityLabel={cancelLabel}
          >
            {cancelLabel}
          </V2Button>
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
  title: {
    ...typography.headingLG,
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  subtitle: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    marginTop: spacing[1],
    marginBottom: spacing[2],
  },
  actionsList: {
    marginTop: spacing[3],
    borderRadius: radii.md,
    backgroundColor: colors.grouped,
    overflow: 'hidden',
  },
  actionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  actionRowPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  actionRowDisabled: {
    opacity: 0.45,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  actionLabel: {
    ...typography.bodyLG,
    fontWeight: '500',
    color: colors.text.primary,
  },
  actionLabelDestructive: {
    color: colors.semantic.error,
  },
  actionLabelDisabled: {
    color: colors.text.disabled,
  },
  actionDetail: {
    ...typography.bodySM,
    color: colors.text.secondary,
  },
  cancelContainer: {
    marginTop: spacing[4],
  },
});
