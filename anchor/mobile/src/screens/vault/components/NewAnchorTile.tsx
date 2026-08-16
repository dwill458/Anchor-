/**
 * NewAnchorTile — Trailing Create Card for the Sanctuary Anchor Rail.
 *
 * Implements the trailing create card in the horizontal FlatList.
 * Matches specifications in `Create New Anchor - Implementation Prompt (Standalone).html`
 * and `Sanctuary Home (Standalone).html`.
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import { typography } from '@/theme';

const CHIP_SIZE = 60;
const TILE_WIDTH = 72;

export interface NewAnchorTileProps {
  onPress: () => void;
}

export const NewAnchorTile: React.FC<NewAnchorTileProps> = ({ onPress }) => {
  const handlePress = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Create new anchor"
      style={({ pressed }) => [
        styles.tile,
        pressed && styles.tilePressed,
      ]}
      testID="new-anchor-tile"
    >
      <View style={styles.circleContainer}>
        <Svg width={CHIP_SIZE} height={CHIP_SIZE} style={StyleSheet.absoluteFill}>
          <Circle
            cx={CHIP_SIZE / 2}
            cy={CHIP_SIZE / 2}
            r={(CHIP_SIZE - 1) / 2}
            stroke="rgba(192, 192, 192, 0.3)"
            strokeWidth={1}
            strokeDasharray="4 4"
            fill="none"
          />
        </Svg>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 4v16M4 12h16"
            stroke="#D4AF37"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        New Anchor
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tile: {
    width: TILE_WIDTH,
    alignItems: 'center',
    gap: 8,
  },
  tilePressed: {
    opacity: 0.75,
  },
  circleContainer: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: CHIP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  label: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(244, 239, 230, 0.8)',
    textAlign: 'center',
  },
});
