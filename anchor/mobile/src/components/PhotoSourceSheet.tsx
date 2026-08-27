import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Camera, ChevronRight, Images, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import { safeHaptics } from '@/utils/haptics';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

export interface PhotoSourceSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectLibrary: () => void;
  onRemovePhoto?: () => void;
  hasExistingPhoto?: boolean;
}

const ANIMATION_DURATION_MS = 350;
const EXIT_DURATION_MS = 240;

export const PhotoSourceSheet: React.FC<PhotoSourceSheetProps> = ({
  visible,
  onClose,
  onSelectCamera,
  onSelectLibrary,
  onRemovePhoto,
  hasExistingPhoto = false,
}) => {
  const [mounted, setMounted] = useState(visible);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionEnabled();

  const translateY = useSharedValue(400);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduceMotion) {
        translateY.value = 0;
        backdropOpacity.value = 1;
      } else {
        translateY.value = withTiming(0, {
          duration: ANIMATION_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        });
        backdropOpacity.value = withTiming(1, {
          duration: 250,
          easing: Easing.out(Easing.cubic),
        });
      }
      return;
    }

    if (reduceMotion) {
      translateY.value = 400;
      backdropOpacity.value = 0;
      setMounted(false);
      return;
    }

    backdropOpacity.value = withTiming(0, {
      duration: EXIT_DURATION_MS,
      easing: Easing.in(Easing.cubic),
    });
    translateY.value = withTiming(
      400,
      {
        duration: EXIT_DURATION_MS,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      }
    );
  }, [backdropOpacity, reduceMotion, translateY, visible]);

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleCameraPress = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    onSelectCamera();
  };

  const handleLibraryPress = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    onSelectLibrary();
  };

  const handleRemovePress = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    onRemovePhoto?.();
  };

  const handleCancelPress = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  if (!mounted) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, animatedBackdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={handleCancelPress}
          accessibilityRole="button"
          accessibilityLabel="Dismiss photo options"
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : null}
          <View style={styles.backdropTint} />
        </Pressable>
      </Animated.View>

      {/* Sheet Container */}
      <View style={styles.sheetPositioner} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheetCard,
            animatedSheetStyle,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
          accessibilityViewIsModal
        >
          <LinearGradient
            colors={[colors.anchor15.navy, colors.anchor15.ink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Top 1px Gold Hairline */}
          <View style={styles.topHairline} />

          {/* Centered Drag Handle Pill */}
          <View style={styles.handleContainer}>
            <View style={styles.handlePill} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.eyebrow}>YOUR IMAGE</Text>
            <Text style={styles.title}>Update Your Profile Photo</Text>
            <Text style={styles.subtitle}>Choose how you would like to add it.</Text>
          </View>

          {/* Options */}
          <View style={styles.optionsList}>
            {/* Take Photo */}
            <Pressable
              onPress={handleCameraPress}
              style={({ pressed }) => [
                styles.optionRow,
                pressed && styles.optionRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Take Photo"
              accessibilityHint="Opens camera to capture a new photo"
            >
              <View style={styles.iconBadge}>
                <Camera color={colors.anchor15.gilt} size={19} strokeWidth={1.6} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionLabel}>Take Photo</Text>
                <Text style={styles.optionCaption}>Capture a new image with your camera</Text>
              </View>
              <ChevronRight color={withAlpha(colors.anchor15.ash, 0.45)} size={18} strokeWidth={1.5} />
            </Pressable>

            {/* Choose from Library */}
            <Pressable
              onPress={handleLibraryPress}
              style={({ pressed }) => [
                styles.optionRow,
                pressed && styles.optionRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Choose from Library"
              accessibilityHint="Select an existing image from your photo library"
            >
              <View style={styles.iconBadge}>
                <Images color={colors.anchor15.gilt} size={19} strokeWidth={1.6} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionLabel}>Choose from Library</Text>
                <Text style={styles.optionCaption}>Select an existing photo from your library</Text>
              </View>
              <ChevronRight color={withAlpha(colors.anchor15.ash, 0.45)} size={18} strokeWidth={1.5} />
            </Pressable>

            {/* Remove Photo (if present) */}
            {hasExistingPhoto && onRemovePhoto ? (
              <Pressable
                onPress={handleRemovePress}
                style={({ pressed }) => [
                  styles.optionRow,
                  styles.optionRowDestructive,
                  pressed && styles.optionRowDestructivePressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Remove Photo"
                accessibilityHint="Removes current photo and reverts to your default mark"
              >
                <View style={[styles.iconBadge, styles.iconBadgeDestructive]}>
                  <Trash2 color="#E05454" size={18} strokeWidth={1.6} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionLabel, styles.optionLabelDestructive]}>Remove Photo</Text>
                  <Text style={styles.optionCaption}>Revert to your default anchor mark</Text>
                </View>
                <ChevronRight color={withAlpha('#E05454', 0.5)} size={18} strokeWidth={1.5} />
              </Pressable>
            ) : null}
          </View>

          {/* Hairline Divider */}
          <View style={styles.divider} />

          {/* Cancel */}
          <Pressable
            onPress={handleCancelPress}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.cancelButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>CANCEL</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    zIndex: 100,
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.anchor15.ink, 0.85),
  },
  sheetPositioner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 101,
  },
  sheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.anchor15.ink,
  },
  topHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handlePill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(212, 175, 55, 0.32)',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  eyebrow: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.anchor15.gilt,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 18,
    letterSpacing: 0.5,
    color: colors.anchor15.bone,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.silver,
    textAlign: 'center',
  },
  optionsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 239, 230, 0.07)',
    backgroundColor: 'rgba(15, 20, 25, 0.65)',
  },
  optionRowPressed: {
    backgroundColor: 'rgba(212, 175, 55, 0.07)',
    borderColor: 'rgba(212, 175, 55, 0.28)',
  },
  optionRowDestructive: {
    borderColor: 'rgba(224, 84, 84, 0.15)',
  },
  optionRowDestructivePressed: {
    backgroundColor: 'rgba(224, 84, 84, 0.08)',
    borderColor: 'rgba(224, 84, 84, 0.35)',
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconBadgeDestructive: {
    borderColor: 'rgba(224, 84, 84, 0.3)',
    backgroundColor: 'rgba(224, 84, 84, 0.08)',
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontFamily: typography.fontFamily.voice,
    fontSize: 16,
    color: colors.anchor15.bone,
  },
  optionLabelDestructive: {
    color: '#E08484',
  },
  optionCaption: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 12,
    fontStyle: 'italic',
    color: withAlpha(colors.anchor15.ash, 0.85),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    marginTop: 16,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  cancelButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  cancelText: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.silver,
  },
});
