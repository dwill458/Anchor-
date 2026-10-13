import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { detailsFonts, detailsPalette } from '@/components/v2/anchors/anchorDetailsTokens';
import {
  VISION_SHARE_BACKGROUNDS,
  type VisionShareBackgroundId,
  type VisionShareBackgroundOption,
} from './visionShareBackgrounds';
import { SHARE_ASPECT } from './shareTypes';

const THUMB_WIDTH = 48;
const THUMB_HEIGHT = Math.round(THUMB_WIDTH * SHARE_ASPECT);

type Props = {
  selected: VisionShareBackgroundId;
  onSelect: (id: VisionShareBackgroundId) => void;
  reduceMotion?: boolean;
};

function BackgroundThumbItem({
  option,
  active,
  onPress,
  reduceMotion,
}: {
  option: VisionShareBackgroundOption;
  active: boolean;
  onPress: () => void;
  reduceMotion?: boolean;
}) {
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: active
      ? detailsPalette.gold
      : 'transparent',
  }));

  return (
    <Pressable
      testID={`vision-background-option-${option.id}`}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${option.name} background`}
      onPress={onPress}
      style={styles.item}
    >
      <Animated.View style={[styles.thumb, borderStyle]}>
        <View style={styles.thumbInner}>
          <Image source={option.thumbSource} style={styles.thumbImage} resizeMode="cover" />
        </View>
      </Animated.View>
      <Text style={[styles.label, active && styles.labelActive]}>{option.name}</Text>
    </Pressable>
  );
}

export function VisionBackgroundPicker({ selected, onSelect, reduceMotion }: Props) {
  return (
    <View style={styles.container} testID="vision-background-picker">
      <Text style={styles.sectionTitle}>Choose background</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
      >
        {VISION_SHARE_BACKGROUNDS.map((option) => (
          <BackgroundThumbItem
            key={option.id}
            option={option}
            active={option.id === selected}
            onPress={() => onSelect(option.id)}
            reduceMotion={reduceMotion}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    fontFamily: detailsFonts.uiStrong,
    fontSize: 12,
    letterSpacing: 0.8,
    color: detailsPalette.creamMuted,
    textTransform: 'uppercase',
  },
  row: {
    paddingHorizontal: 20,
    gap: 12,
  },
  item: {
    alignItems: 'center',
    gap: 6,
  },
  thumb: {
    width: THUMB_WIDTH + 6,
    height: THUMB_HEIGHT + 6,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInner: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#1E232B',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  label: {
    fontFamily: detailsFonts.ui,
    fontSize: 11,
    color: detailsPalette.creamMuted,
  },
  labelActive: {
    fontFamily: detailsFonts.uiStrong,
    color: detailsPalette.cream,
  },
});
