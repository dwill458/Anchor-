import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { safeHaptics } from '@/utils/haptics';
import { colors, spacing, typography } from '@/theme';

const ITEM_HEIGHT = 52;
const PICKER_HEIGHT = ITEM_HEIGHT * 5;
const ENTER_DURATION_MS = 300;
const EXIT_DURATION_MS = 220;

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<number>);

export type CustomDurationMode = 'focus' | 'charge';

export type CustomDurationSheetProps = {
  visible: boolean;
  mode: CustomDurationMode;
  initialValue: number;
  onConfirm: (value: number) => void;
  onCancel: () => void;
  reduceMotion?: boolean;
};

type PickerRowProps = {
  index: number;
  label: string;
  onPress: () => void;
  scrollY: Animated.SharedValue<number>;
  reduceMotion: boolean;
};

const PickerRow = React.memo(({ index, label, onPress, scrollY, reduceMotion }: PickerRowProps) => {
  const rowStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: 1, transform: [{ scale: 1 }] };
    }
    const distance = Math.abs(index - scrollY.value / ITEM_HEIGHT);
    return {
      opacity: interpolate(distance, [0, 1, 2.5], [1, 0.72, 0.38], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(distance, [0, 1, 2.5], [1.08, 0.97, 0.9], Extrapolation.CLAMP) }],
    };
  });

  const textStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { color: colors.text.secondary };
    }
    const distance = Math.abs(index - scrollY.value / ITEM_HEIGHT);
    return {
      color: interpolateColor(
        distance,
        [0, 1.5],
        [colors.gold, colors.text.secondary]
      ) as string,
    };
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.wheelRowButton}
      accessibilityRole="button"
      accessibilityLabel={`Select ${label}`}
    >
      <Animated.View style={[styles.wheelRowInner, rowStyle]}>
        <Animated.Text style={[styles.wheelRowText, textStyle]}>{label}</Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

PickerRow.displayName = 'PickerRow';

export const CustomDurationSheet: React.FC<CustomDurationSheetProps> = ({
  visible,
  mode,
  initialValue,
  onConfirm,
  onCancel,
  reduceMotion,
}) => {
  const insets = useSafeAreaInsets();
  const systemReduceMotion = useReduceMotionEnabled();
  const motionReduced = reduceMotion ?? systemReduceMotion;
  const listRef = useRef<FlatList<number>>(null);
  const lastHapticValueRef = useRef<number>(0);
  const [mounted, setMounted] = useState(visible);

  const openProgress = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const valueScale = useSharedValue(1);

  const minValue = mode === 'focus' ? 10 : 1;
  const maxValue = mode === 'focus' ? 60 : 30;
  const unitSuffix = mode === 'focus' ? 's' : 'm';
  const unitWord = mode === 'focus' ? 'seconds' : 'minutes';
  const subtitle = mode === 'focus' ? 'Choose 10-60 seconds' : 'Choose 1-30 minutes';

  const values = useMemo(
    () => Array.from({ length: maxValue - minValue + 1 }, (_, index) => minValue + index),
    [maxValue, minValue]
  );
  const presets = useMemo(
    () => (mode === 'focus' ? [10, 30, 60] : [1, 5, 10]),
    [mode]
  );

  const [selectedValue, setSelectedValue] = useState(clampNumber(initialValue, minValue, maxValue));

  const runValuePulse = useCallback(() => {
    if (motionReduced) return;
    valueScale.value = withSequence(
      withTiming(1.045, { duration: 110, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) })
    );
  }, [motionReduced, valueScale]);

  const updateSelection = useCallback(
    (value: number, shouldHaptic: boolean) => {
      const nextValue = clampNumber(value, minValue, maxValue);
      setSelectedValue(nextValue);
      runValuePulse();
      if (shouldHaptic && lastHapticValueRef.current !== nextValue) {
        lastHapticValueRef.current = nextValue;
        void safeHaptics.selection();
      }
    },
    [maxValue, minValue, runValuePulse]
  );

  const snapFromOffset = useCallback(
    (offsetY: number, shouldHaptic: boolean) => {
      const snappedIndex = clampNumber(offsetY / ITEM_HEIGHT, 0, values.length - 1);
      updateSelection(values[snappedIndex], shouldHaptic);
    },
    [updateSelection, values]
  );

  const scrollToValue = useCallback(
    (value: number, animated: boolean) => {
      const clamped = clampNumber(value, minValue, maxValue);
      const targetIndex = clamped - minValue;
      listRef.current?.scrollToOffset({
        offset: targetIndex * ITEM_HEIGHT,
        animated: animated && !motionReduced,
      });
      if (motionReduced || !animated) {
        scrollY.value = targetIndex * ITEM_HEIGHT;
      }
    },
    [maxValue, minValue, motionReduced, scrollY]
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      const normalizedInitial = clampNumber(initialValue, minValue, maxValue);
      setSelectedValue(normalizedInitial);
      lastHapticValueRef.current = normalizedInitial;
      requestAnimationFrame(() => {
        scrollToValue(normalizedInitial, false);
      });

      if (motionReduced) {
        openProgress.value = 1;
      } else {
        openProgress.value = withTiming(1, {
          duration: ENTER_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
      return;
    }

    if (motionReduced) {
      openProgress.value = 0;
      setMounted(false);
      return;
    }

    openProgress.value = withTiming(
      0,
      { duration: EXIT_DURATION_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      }
    );
  }, [initialValue, maxValue, minValue, motionReduced, openProgress, scrollToValue, visible]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(openProgress.value, [0, 1], [44, 0], Extrapolation.CLAMP) },
    ],
  }));

  const displayValueStyle = useAnimatedStyle(() => ({
    transform: [{ scale: valueScale.value }],
  }));

  const handlePresetPress = useCallback(
    (value: number) => {
      updateSelection(value, true);
      scrollToValue(value, true);
    },
    [scrollToValue, updateSelection]
  );

  const handleRowPress = useCallback(
    (value: number) => {
      updateSelection(value, true);
      scrollToValue(value, true);
    },
    [scrollToValue, updateSelection]
  );

  const handleAccessibilityAdjust = useCallback(
    (direction: 1 | -1) => {
      const nextValue = clampNumber(selectedValue + direction, minValue, maxValue);
      updateSelection(nextValue, true);
      scrollToValue(nextValue, true);
    },
    [maxValue, minValue, scrollToValue, selectedValue, updateSelection]
  );

  const handleConfirm = useCallback(() => {
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm(clampNumber(selectedValue, minValue, maxValue));
  }, [maxValue, minValue, onConfirm, selectedValue]);

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.modalRoot} pointerEvents="box-none">
        <AnimatedPressable
          style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Close custom duration picker"
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]} />
          )}
        </AnimatedPressable>

        <Animated.View
          style={[
            styles.sheetContainer,
            sheetStyle,
            {
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}
          accessibilityViewIsModal
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]} />
          )}
          <LinearGradient
            colors={['rgba(212, 175, 55, 0.16)', 'rgba(212, 175, 55, 0.05)', 'rgba(212, 175, 55, 0.01)']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheetGlow}
            pointerEvents="none"
          />

          <View style={styles.header}>
            <Text style={styles.title}>Custom Duration</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.presetRow}>
            {presets.map((preset) => {
              const selected = selectedValue === preset;
              return (
                <TouchableOpacity
                  key={preset}
                  style={[styles.presetChip, selected && styles.presetChipSelected]}
                  onPress={() => handlePresetPress(preset)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Set to ${preset} ${unitWord}`}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.presetChipText, selected && styles.presetChipTextSelected]}>
                    {preset}
                    {unitSuffix}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Animated.View style={[styles.selectedValueContainer, displayValueStyle]}>
            <Text style={styles.selectedValueText}>
              {selectedValue}
              {unitSuffix}
            </Text>
            <Text style={styles.selectedValueUnit}>{mode === 'focus' ? 'Seconds' : 'Minutes'}</Text>
          </Animated.View>

          <View
            style={styles.wheelShell}
            accessibilityRole="adjustable"
            accessibilityLabel={`Duration picker, currently ${selectedValue} ${unitWord}`}
            accessibilityActions={[
              { name: 'increment', label: 'Increase duration' },
              { name: 'decrement', label: 'Decrease duration' },
            ]}
            onAccessibilityAction={({ nativeEvent }) => {
              if (nativeEvent.actionName === 'increment') {
                handleAccessibilityAdjust(1);
              } else if (nativeEvent.actionName === 'decrement') {
                handleAccessibilityAdjust(-1);
              }
            }}
          >
            <View pointerEvents="none" style={styles.centerMarker}>
              <View style={styles.centerMarkerLine} />
              <View style={[styles.centerMarkerLine, styles.centerMarkerLineBottom]} />
            </View>
            <AnimatedFlatList
              ref={listRef}
              data={values}
              keyExtractor={(item) => item.toString()}
              renderItem={({ item, index }) => (
                <PickerRow
                  index={index}
                  label={`${item}${unitSuffix}`}
                  onPress={() => handleRowPress(item)}
                  scrollY={scrollY}
                  reduceMotion={motionReduced}
                />
              )}
              style={styles.wheelList}
              contentContainerStyle={styles.wheelListContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={scrollHandler}
              onMomentumScrollEnd={(event) => {
                snapFromOffset(event.nativeEvent.contentOffset.y, true);
              }}
              onScrollEndDrag={(event) => {
                const velocityY = Math.abs(event.nativeEvent.velocity?.y ?? 0);
                if (velocityY < 0.05) {
                  snapFromOffset(event.nativeEvent.contentOffset.y, true);
                }
              }}
              getItemLayout={(_, index) => ({
                length: ITEM_HEIGHT,
                offset: ITEM_HEIGHT * index,
                index,
              })}
              initialNumToRender={11}
              maxToRenderPerBatch={12}
              windowSize={7}
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onCancel}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButtonWrapper}
              onPress={handleConfirm}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Set Duration"
            >
              <LinearGradient
                colors={[colors.gold, colors.bronze]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Set Duration</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(8, 10, 14, 0.75)',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.glassStrong,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sheetGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    opacity: 0.8,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  presetChip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  presetChipSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
  },
  presetChipText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
  },
  presetChipTextSelected: {
    color: colors.gold,
    fontFamily: typography.fonts.bodyBold,
  },
  selectedValueContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectedValueText: {
    fontSize: 48,
    lineHeight: 54,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    letterSpacing: 0.4,
  },
  selectedValueUnit: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  wheelShell: {
    height: PICKER_HEIGHT,
    marginBottom: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    backgroundColor: 'rgba(7, 11, 17, 0.55)',
    overflow: 'hidden',
  },
  wheelList: {
    flex: 1,
  },
  wheelListContent: {
    paddingVertical: (PICKER_HEIGHT - ITEM_HEIGHT) / 2,
  },
  wheelRowButton: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelRowInner: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelRowText: {
    fontSize: 26,
    lineHeight: 30,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.secondary,
  },
  centerMarker: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (PICKER_HEIGHT - ITEM_HEIGHT) / 2,
    height: ITEM_HEIGHT,
    zIndex: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  centerMarkerLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 0,
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.35)',
  },
  centerMarkerLineBottom: {
    top: undefined,
    bottom: 0,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.secondary,
  },
  primaryButtonWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButton: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.navy,
  },
});
