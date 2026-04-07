/**
 * TimerPicker - Reusable modal component for selecting custom durations
 *
 * Used for:
 * - Custom charge duration selection
 * - Future: custom activation durations, scheduled anchors
 *
 * Features:
 * - Bottom sheet modal with BlurView backdrop
 * - Scrollable minute selector (1-30 minutes)
 * - Confirm/Cancel actions
 * - Glassmorphic Zen Architect design
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';

const { height: screenHeight } = Dimensions.get('window');

export interface TimerPickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (minutes: number) => void;
  initialMinutes?: number;
  minMinutes?: number;
  maxMinutes?: number;
  title?: string;
}

/**
 * TimerPicker Component
 *
 * Modal picker for selecting duration in minutes.
 * Follows glassmorphic pattern with blur effect and gold accents.
 */
export const TimerPicker: React.FC<TimerPickerProps> = ({
  visible,
  onClose,
  onConfirm,
  initialMinutes = 2,
  minMinutes = 1,
  maxMinutes = 30,
  title = 'Select Duration',
}) => {
  const insets = useSafeAreaInsets();
  const [selectedMinutes, setSelectedMinutes] = useState(initialMinutes);
  const scrollViewRef = useRef<ScrollView>(null);

  // Generate array of minutes to display
  const minuteOptions = Array.from(
    { length: maxMinutes - minMinutes + 1 },
    (_, i) => minMinutes + i
  );

  // Scroll to initial value when modal opens
  useEffect(() => {
    if (visible && scrollViewRef.current) {
      const initialIndex = selectedMinutes - minMinutes;
      const scrollOffset = initialIndex * 60;
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: scrollOffset,
          animated: true,
        });
      }, 100);
    }
  }, [visible, selectedMinutes, minMinutes]);

  const handleConfirm = () => {
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm(selectedMinutes);
    onClose();
  };

  const handleCancel = () => {
    void safeHaptics.selection();
    onClose();
  };

  const handleMinutePress = (minute: number) => {
    void safeHaptics.selection();
    setSelectedMinutes(minute);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      {/* Blur overlay backdrop */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleCancel}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]} />
        )}
      </TouchableOpacity>

      {/* Bottom sheet container */}
      <View
        style={[
          styles.container,
          {
            paddingBottom: insets.bottom || spacing.lg,
          },
        ]}
      >
        {/* Header with title and close button */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity
            onPress={handleCancel}
            activeOpacity={0.7}
            style={styles.closeButton}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Minute selector with ScrollView */}
        <View style={styles.pickerContainer}>
          {/* Top fade indicator */}
          <View style={styles.fadeMask} pointerEvents="none" />

          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            snapToInterval={60}
            decelerationRate="fast"
            onMomentumScrollEnd={(event) => {
              const offsetY = event.nativeEvent.contentOffset.y;
              const index = Math.round(offsetY / 60);
              setSelectedMinutes(minuteOptions[index]);
            }}
          >
            {minuteOptions.map((minute) => (
              <TouchableOpacity
                key={minute}
                style={[
                  styles.minuteOption,
                  selectedMinutes === minute && styles.minuteOptionSelected,
                ]}
                onPress={() => handleMinutePress(minute)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.minuteText,
                    selectedMinutes === minute && styles.minuteTextSelected,
                  ]}
                >
                  {minute === 1 ? `${minute} minute` : `${minute} minutes`}
                </Text>
                {selectedMinutes === minute && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Bottom fade indicator */}
          <View
            style={[styles.fadeMask, styles.fadeMaskBottom]}
            pointerEvents="none"
          />
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.confirmButton]}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },

  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: `${colors.gold}20`,
    maxHeight: screenHeight * 0.7,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: `rgba(192, 192, 192, 0.05)`,
  },

  title: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    letterSpacing: 0.5,
  },

  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  closeIcon: {
    fontSize: 24,
    color: colors.text.tertiary,
  },

  pickerContainer: {
    height: 240,
    overflow: 'hidden',
    position: 'relative',
  },

  fadeMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.05)',
    zIndex: 1,
    pointerEvents: 'none',
  },

  fadeMaskBottom: {
    top: 'auto',
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingVertical: 90, // Center the selected item vertically
    alignItems: 'center',
  },

  minuteOption: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
  },

  minuteOptionSelected: {
    backgroundColor: `${colors.gold}15`,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    borderRightWidth: 3,
    borderRightColor: colors.gold,
  },

  minuteText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    flex: 1,
  },

  minuteTextSelected: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    flex: 1,
  },

  checkmark: {
    fontSize: 20,
    color: colors.gold,
    marginLeft: spacing.md,
  },

  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: `rgba(192, 192, 192, 0.05)`,
  },

  button: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },

  cancelButton: {
    backgroundColor: `rgba(192, 192, 192, 0.1)`,
    borderWidth: 1,
    borderColor: `rgba(212, 175, 55, 0.3)`,
  },

  cancelButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.primary,
    letterSpacing: 0.5,
  },

  confirmButton: {
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  confirmButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.navy,
    letterSpacing: 0.5,
  },
});
