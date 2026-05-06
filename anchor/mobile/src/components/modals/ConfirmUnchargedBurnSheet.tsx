/**
 * Anchor App - Confirm Uncharged Burn Bottom Sheet
 *
 * Warning for users attempting to burn/release an uncharged anchor.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';

export interface ConfirmUnchargedBurnSheetProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  intentionText?: string;
}

export const ConfirmUnchargedBurnSheet: React.FC<ConfirmUnchargedBurnSheetProps> = ({
  visible,
  onConfirm,
  onCancel,
  intentionText,
}) => {
  const handleConfirm = (): void => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm();
  };

  const handleCancel = (): void => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.pressableOverlay} onPress={onCancel}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />

            <Text style={styles.title}>Unplanted Intention</Text>

            {intentionText && (
              <Text style={styles.intention} numberOfLines={2}>
                "{intentionText}"
              </Text>
            )}

            <Text style={styles.body}>
              Your intention has not been implanted. Releasing this anchor now will disperse its energy before it has been grounded.
              {"\n\n"}
              Are you certain you wish to proceed with the ritual of release?
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>Release Anyway</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Keep & Ground</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  pressableOverlay: {
    flex: 1,
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: 'rgba(30, 30, 35, 0.95)',
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontFamily: typography.fonts.headingBold,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  intention: {
    fontSize: 15,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: 15,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  actions: {
    gap: 12,
  },
  confirmButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 80, 80, 0.4)',
  },
  confirmButtonText: {
    fontSize: 14,
    fontFamily: typography.fonts.bodyBold,
    color: 'rgba(255, 120, 120, 0.9)',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: colors.gold,
    paddingVertical: 14,
    borderRadius: 14,
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: typography.fonts.bodyBold,
    color: '#000',
    textAlign: 'center',
  },
});
