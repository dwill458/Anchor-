import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { AnchorMotion, colors, radii, spacing, typography } from '@/theme/v2';
import { segmentGeometry } from './segmentedGeometry';

type Option = { value: string; label: string; accessibilityLabel?: string };

const PADDING = 3;

export function V2SegmentedControl({ options, value, onChange, accessibilityLabel }: { options: Option[]; value: string; onChange: (value: string) => void; accessibilityLabel: string }) {
  const reduceMotion = useV2ReduceMotion();
  const [width, setWidth] = useState(0);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const { segmentWidth, offset } = segmentGeometry(width, options.length, selectedIndex, PADDING);
  const pillX = useSharedValue(offset);
  const pillWidth = useSharedValue(segmentWidth);
  const placed = useRef(false);

  useEffect(() => {
    pillWidth.value = segmentWidth;
    if (width === 0) return;
    // The first measurement puts the pill in place; only later selections slide it.
    if (!placed.current) {
      placed.current = true;
      pillX.value = offset;
      return;
    }
    pillX.value = reduceMotion
      ? withTiming(offset, { duration: AnchorMotion.duration.micro, reduceMotion: ReduceMotion.Never })
      : withSpring(offset, { ...AnchorMotion.spring.snap, reduceMotion: ReduceMotion.Never });
  }, [offset, pillWidth, pillX, reduceMotion, segmentWidth, width]);

  const pillStyle = useAnimatedStyle(() => ({ width: pillWidth.value, transform: [{ translateX: pillX.value }] }));
  const handleLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.control} onLayout={handleLayout}>
      {selectedIndex >= 0 ? <Animated.View testID="v2-segmented-pill" pointerEvents="none" style={[styles.pill, pillStyle]} /> : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected }}
            style={styles.option}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  control: { minHeight: 44, flexDirection: 'row', padding: PADDING, borderRadius: radii.md, backgroundColor: colors.grouped },
  pill: { position: 'absolute', top: PADDING, bottom: PADDING, left: 0, borderRadius: radii.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border.subtle },
  option: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm, paddingHorizontal: spacing[2] },
  label: { ...typography.labelMD, color: colors.text.secondary, textAlign: 'center' },
  selectedLabel: { color: colors.text.primary },
});
