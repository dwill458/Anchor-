import React, { memo, useEffect } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { boardCameraEasing, boardTiming } from '../board/visionBoardMotion';
import { resolveVisionEnvironment } from './visionEnvironmentAssets';

export interface VisionEnvironmentProps {
  /** Intention category used to resolve environmental artwork. */
  category?: string | null;
  /** Calculated width of the central physical Vision board. */
  boardWidth: number;
  /** Whether system or user requested reduced motion. */
  reduceMotion?: boolean;
  /** Optional test identifier. */
  testID?: string;
}

/**
 * Environmental illustration layer for the Vision screen.
 *
 * Implements the approved Anchor 2.0 atmosphere:
 * - Subtle cartographic compass and navigation linework in the dark header.
 * - Pen-line botanical branch and celestial navigation stars in the upper right.
 * - Left terrain linework and botanical leaves that naturally pass BEHIND the board.
 * - Right topographic contours, route marks, and botanical sprig tucking under the board.
 * - Faint contour remnants bridging navy into cream that fade before "My Vision".
 *
 * Sits in Layer 1 (behind the physical board in Layer 3).
 * Positions responsively based on board geometry so occlusion works across all screen sizes.
 */
export const VisionEnvironment = memo(function VisionEnvironment({
  category,
  boardWidth,
  reduceMotion = false,
  testID = 'vision-environment',
}: VisionEnvironmentProps) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pack = resolveVisionEnvironment(category);

  // Geometric layout derived from physical board proportions
  const boardHeight = boardWidth * (1080 / 1024);
  const boardLeft = (windowWidth - boardWidth) / 2;
  const boardRight = boardLeft + boardWidth;

  // Approximate top coordinate of the board relative to the ink band top
  // Insets top + header (52) + gap (16) + identity (~48) + board wrap padding (16)
  const boardTop = insets.top + 132;

  // Asset dimensions and placements
  // 1. Header Compass (top-left) - aspect ratio 270/320 = 0.84375
  const compassWidth = Math.min(boardWidth * 0.32, 130);
  const compassHeight = compassWidth / 0.84375;
  const compassLeft = Math.max(-10, boardLeft - compassWidth * 0.45);
  const compassTop = insets.top + 6;

  // 2. Header Botanical (top-right) - aspect ratio 404/490 = 0.8245
  const botanicalWidth = Math.min(boardWidth * 0.46, 185);
  const botanicalHeight = botanicalWidth / 0.8245;
  const botanicalRight = Math.max(-12, windowWidth - boardRight - botanicalWidth * 0.42);
  const botanicalTop = insets.top + 12;

  // 3. Left Environment (mountains + leaves + contours) - aspect ratio 290/960 = 0.302
  const leftHeight = boardHeight * 1.05;
  const leftWidth = leftHeight * 0.302;
  // Right edge tucks 14dp under the board frame
  const leftPos = boardLeft - leftWidth + 14;
  const leftTop = boardTop - boardHeight * 0.08;

  // 4. Right Environment (contours + stars + route + leaves) - aspect ratio 294/940 = 0.3128
  const rightHeight = boardHeight * 1.05;
  const rightWidth = rightHeight * 0.3128;
  // Left edge tucks 16dp under the board frame
  const rightPos = boardRight - 16;
  const rightTop = boardTop - boardHeight * 0.02;

  // 5. Bottom Contours (bridging navy into cream) - aspect ratio 1364/260 = 5.246
  const bottomWidth = windowWidth;
  const bottomHeight = bottomWidth / 5.246;
  const bottomTop = boardTop + boardHeight - 34;

  // Restrained entrance parallax motion
  // Environmental illustration moves ~4px (approx 28% of board's 14px travel)
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : -4);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    opacity.value = boardTiming(1, { duration: 600, easing: boardCameraEasing });
    translateY.value = boardTiming(0, { duration: 850, easing: boardCameraEasing });
  }, [opacity, reduceMotion, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.container, animatedStyle]}
    >
      {/* 1. Upper-Left Compass & Navigation Linework */}
      <Image
        testID={`${testID}-compass`}
        source={pack.headerCompass}
        resizeMode="contain"
        accessible={false}
        style={[
          styles.asset,
          {
            left: compassLeft,
            top: compassTop,
            width: compassWidth,
            height: compassHeight,
          },
        ]}
      />

      {/* 2. Upper-Right Botanical Branch & Celestial Marks */}
      <Image
        testID={`${testID}-botanical`}
        source={pack.headerBotanical}
        resizeMode="contain"
        accessible={false}
        style={[
          styles.asset,
          {
            right: botanicalRight,
            top: botanicalTop,
            width: botanicalWidth,
            height: botanicalHeight,
          },
        ]}
      />

      {/* 3. Left Terrain & Botanical Leaves (Passes Behind Board) */}
      <Image
        testID={`${testID}-left`}
        source={pack.leftEnvironment}
        resizeMode="contain"
        accessible={false}
        style={[
          styles.asset,
          {
            left: leftPos,
            top: leftTop,
            width: leftWidth,
            height: leftHeight,
          },
        ]}
      />

      {/* 4. Right Contours & Navigation Route (Passes Behind Board) */}
      <Image
        testID={`${testID}-right`}
        source={pack.rightEnvironment}
        resizeMode="contain"
        accessible={false}
        style={[
          styles.asset,
          {
            left: rightPos,
            top: rightTop,
            width: rightWidth,
            height: rightHeight,
          },
        ]}
      />

      {/* 5. Bottom Contours (Transitions Into Cream Canvas) */}
      <Image
        testID={`${testID}-bottom`}
        source={pack.bottomContours}
        resizeMode="stretch"
        accessible={false}
        style={[
          styles.asset,
          {
            left: 0,
            top: bottomTop,
            width: bottomWidth,
            height: bottomHeight,
          },
        ]}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    zIndex: 0,
  },
  asset: {
    position: 'absolute',
  },
});
