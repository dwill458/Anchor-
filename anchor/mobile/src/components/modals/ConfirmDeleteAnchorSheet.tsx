import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';

export interface ConfirmDeleteAnchorSheetProps {
  visible: boolean;
  intentionText?: string;
  onBurnInstead: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteAnchorSheet: React.FC<ConfirmDeleteAnchorSheetProps> = ({
  visible,
  intentionText,
  onBurnInstead,
  onDelete,
  onCancel,
}) => {
  const handleBurnInstead = (): void => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    onBurnInstead();
  };

  const handleDelete = (): void => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Heavy);
    onDelete();
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
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />

            <Text style={styles.eyebrow}>ANCHOR WARNING</Text>
            <Text style={styles.title}>Burn & Release is the proper practice.</Text>

            {intentionText ? (
              <Text style={styles.intention} numberOfLines={2}>
                "{intentionText}"
              </Text>
            ) : null}

            <Text style={styles.body}>
              Deleting skips the ceremony and quietly archives this anchor.
              {'\n\n'}
              If you are truly ready to let it go, Burn & Release is the intended path.
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleBurnInstead}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#b8920a', '#d4a820', '#c49a15']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButtonGradient}
                >
                  <Text style={styles.primaryButtonText}>Burn & Release</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteButtonText}>Delete Anyway</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Keep Anchor</Text>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2,
    textAlign: 'center',
    color: colors.gold,
    fontFamily: typography.fonts.bodyBold,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    color: colors.text.primary,
    fontFamily: typography.fonts.headingBold,
    marginBottom: spacing.md,
  },
  intention: {
    fontSize: 15,
    textAlign: 'center',
    color: colors.gold,
    fontFamily: typography.fonts.body,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.text.secondary,
    fontFamily: typography.fonts.body,
    marginBottom: spacing.xl,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    color: '#000',
    fontFamily: typography.fonts.bodyBold,
  },
  deleteButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 110, 110, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    color: 'rgba(255, 135, 135, 0.95)',
    fontFamily: typography.fonts.bodyBold,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: colors.text.tertiary,
    fontFamily: typography.fonts.bodyBold,
  },
});
