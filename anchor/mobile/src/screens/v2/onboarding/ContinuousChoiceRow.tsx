import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Check } from "lucide-react-native";

const ROW_BORDER = "rgba(20, 22, 43, 0.08)";
const INK = "#14162B";

interface Props {
  index: number;
  testID?: string;
  label: string;
  accent: string;
  selected: boolean;
  hasSelection: boolean;
  height: number;
  reduceMotion: boolean;
  onPress: () => void;
}

export function ContinuousChoiceRow({
  index,
  testID,
  label,
  accent,
  selected,
  hasSelection,
  height,
  reduceMotion,
  onPress,
}: Props) {
  const on = useSharedValue(selected ? 1 : 0);
  const pressScale = useSharedValue(1);
  const cardScale = useSharedValue(1);
  const indicatorScale = useSharedValue(selected ? 1 : 0.85);
  const checkOpacity = useSharedValue(selected ? 1 : 0);
  const checkScale = useSharedValue(selected ? 1 : 0.7);
  const unselectedDim = useSharedValue(hasSelection && !selected ? 0.74 : 1);

  useEffect(() => {
    if (selected) {
      if (reduceMotion) {
        on.value = withTiming(1, { duration: 150 });
        cardScale.value = 1;
        indicatorScale.value = 1;
        checkOpacity.value = withTiming(1, { duration: 150 });
        checkScale.value = 1;
        unselectedDim.value = 1;
      } else {
        on.value = withTiming(1, {
          duration: 220,
          easing: Easing.out(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        });
        cardScale.value = withSequence(
          withTiming(0.98, { duration: 80, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
          withTiming(1.01, { duration: 110, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
          withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }),
        );
        indicatorScale.value = withSequence(
          withTiming(1.08, {
            duration: 130,
            easing: Easing.out(Easing.quad),
            reduceMotion: ReduceMotion.Never,
          }),
          withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }),
        );
        checkOpacity.value = withTiming(1, {
          duration: 220,
          easing: Easing.out(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        });
        checkScale.value = withTiming(1, { duration: 190, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
        unselectedDim.value = withTiming(1, { duration: 180, reduceMotion: ReduceMotion.Never });
      }
    } else {
      if (reduceMotion) {
        on.value = withTiming(0, { duration: 150 });
        cardScale.value = 1;
        indicatorScale.value = 1;
        checkOpacity.value = withTiming(0, { duration: 150 });
        checkScale.value = 0.7;
        unselectedDim.value = withTiming(hasSelection ? 0.74 : 1, { duration: 150 });
      } else {
        on.value = withTiming(0, {
          duration: 190,
          easing: Easing.out(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        });
        cardScale.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
        indicatorScale.value = withTiming(1.0, {
          duration: 180,
          easing: Easing.out(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        });
        checkOpacity.value = withTiming(0, {
          duration: 160,
          easing: Easing.in(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        });
        checkScale.value = withTiming(0.7, {
          duration: 160,
          easing: Easing.in(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        });
        unselectedDim.value = withTiming(hasSelection ? 0.74 : 1, {
          duration: 200,
          easing: Easing.out(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        });
      }
    }
  }, [selected, hasSelection, reduceMotion, on, cardScale, indicatorScale, checkOpacity, checkScale, unselectedDim]);

  const frameStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], [ROW_BORDER, accent]),
    borderWidth: 1.2 + 0.8 * on.value,
    shadowOpacity: 0.065 + 0.075 * on.value,
    elevation: 1 + 1 * on.value,
    opacity: unselectedDim.value,
    transform: [{ scale: (reduceMotion ? 1 : cardScale.value) * pressScale.value }],
  }));

  const tintStyle = useAnimatedStyle(() => ({
    opacity: on.value,
  }));

  const radioRingStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], ["rgba(20, 22, 43, 0.22)", accent]),
    backgroundColor: interpolateColor(on.value, [0, 1], ["transparent", accent]),
    transform: [{ scale: reduceMotion ? 1 : indicatorScale.value }],
  }));

  const radioCheckStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: reduceMotion ? (selected ? 1 : 0.7) : checkScale.value }],
  }));

  const handlePressIn = () => {
    if (!reduceMotion) {
      pressScale.value = withTiming(0.985, {
        duration: 90,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.Never,
      });
    }
  };

  const handlePressOut = () => {
    if (!reduceMotion) {
      pressScale.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
    }
  };

  const handlePress = () => {
    if (!reduceMotion && pressScale.value === 1) {
      pressScale.value = withSequence(
        withTiming(0.985, {
          duration: 90,
          easing: Easing.out(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        }),
        withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }),
      );
    }
    onPress();
  };

  return (
    <View style={{ height }}>
      <Pressable
        testID={testID ?? `choice-row-${index}`}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ selected, checked: selected }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={styles.rowPress}
      >
        <Animated.View style={[styles.row, frameStyle]}>
          <Animated.View
            pointerEvents="none"
            style={[styles.rowTint, { backgroundColor: `${accent}0E` }, tintStyle]}
          />
          <Text
            style={styles.rowLabel}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.88}
            maxFontSizeMultiplier={1.25}
          >
            {label}
          </Text>
          <Animated.View style={[styles.radio, radioRingStyle]}>
            <Animated.View pointerEvents="none" style={[styles.radioCheck, radioCheckStyle]}>
              <Check size={12} color="#FFFFFF" strokeWidth={3} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rowPress: { flex: 1 },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#F8F4EC",
    paddingHorizontal: 18,
    overflow: "hidden",
    shadowColor: "#172235",
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  rowTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  rowLabel: {
    flex: 1,
    color: INK,
    fontFamily: "Inter-Regular",
    fontSize: 16.5,
    lineHeight: 22,
    letterSpacing: -0.2,
    marginRight: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radioCheck: {
    alignItems: "center",
    justifyContent: "center",
  },
});
