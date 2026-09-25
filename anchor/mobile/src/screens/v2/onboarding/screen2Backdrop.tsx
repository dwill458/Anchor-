import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import type { ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Screen 2 environment plate. Swapping in a different plate is a one-line change:
 * keep the aspect below in sync with the file.
 */
export const screen2Environment = require("@/assets/onboarding/screen2/environment.jpg");
const ENV_ASPECT = 1536 / 2732;
/** Horizontal focal point: keeps the window frame, plant and sun in frame when the sides crop. */
const ENV_FOCAL_X = 0.3;

export function getScreen2EnvironmentFrame(width: number, height: number) {
  const coverWidth = Math.max(width, height * ENV_ASPECT);
  const coverHeight = coverWidth / ENV_ASPECT;
  return {
    width: coverWidth,
    height: coverHeight,
    left: -(coverWidth - width) * ENV_FOCAL_X,
    top: -(coverHeight - height) * 0.5,
  };
}

/**
 * Environment plate plus its cinematic grade. Screen 1 renders this same component as
 * its outgoing wash so Screen 2's first frame is pixel-identical to Screen 1's last.
 */
export function Screen2Backdrop({
  width,
  height,
  plateStyle,
}: {
  width: number;
  height: number;
  plateStyle?: AnimatedStyle<ViewStyle>;
}) {
  const frame = getScreen2EnvironmentFrame(width, height);
  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.plate, frame, plateStyle]}>
        <Animated.Image
          source={screen2Environment}
          resizeMode="cover"
          style={styles.fillImage}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
      {/* Warm grade: deepens the edges toward the storyboard's dusk tone. */}
      <LinearGradient
        colors={[
          "rgba(12, 12, 22, 0.58)",
          "rgba(28, 16, 8, 0.10)",
          "rgba(28, 16, 8, 0.08)",
          "rgba(10, 10, 16, 0.42)",
        ]}
        locations={[0, 0.24, 0.62, 1]}
        style={styles.fill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  plate: { position: "absolute" },
  fillImage: { width: "100%", height: "100%" },
});
